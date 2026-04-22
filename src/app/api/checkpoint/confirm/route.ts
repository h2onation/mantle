export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callPersona } from "@/lib/persona/call-persona";
import { confirmCheckpoint } from "@/lib/persona/confirm-checkpoint";
import {
  insertCheckpointActionMessage,
  buildEntriesSummary,
} from "@/lib/persona/persona-pipeline";
import { LAYER_NAMES } from "@/lib/manual/layers";
import {
  checkpointConfirmHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { hashUserId, logEvent } from "@/lib/observability/log";
import {
  recordConfirmFailure,
  type ConfirmErrorKind,
} from "@/lib/observability/record-failure";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const reqId = request.headers.get("x-vercel-id") || null;

  // 1. Authenticate
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logEvent({
      event: "confirm_outcome",
      req_id: reqId,
      outcome: "unauthorized",
      status_code: 401,
      duration_ms: Date.now() - startedAt,
    });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdHash = await hashUserId(user.id);

  const limit = await checkLimit(checkpointConfirmHour, user.id);
  if (!limit.success) {
    logEvent({
      event: "confirm_outcome",
      req_id: reqId,
      user_id_hash: userIdHash,
      outcome: "rate_limited",
      status_code: 429,
      duration_ms: Date.now() - startedAt,
    });
    return rateLimitedResponse(limit);
  }

  const admin = createAdminClient();
  const { messageId, action, conversationId } = (await request.json()) as {
    messageId: string;
    // "deferred" is the refinement-ceiling "Let it go" path. DB level
    // it behaves like rejected (status='rejected'), but the system
    // message is distinct so Jove does not run the POST-REJECTION
    // fixed line in response. Track A Phase 7-Mid.
    action: "confirmed" | "rejected" | "refined" | "deferred";
    conversationId: string;
  };

  logEvent({
    event: "confirm_attempt",
    req_id: reqId,
    user_id_hash: userIdHash,
    conversation_id: conversationId,
    message_id: messageId,
  });

  // Helper: emit outcome log + persist failure row, then return the response.
  async function failWith(
    statusCode: number,
    outcome: ConfirmErrorKind,
    errorMessage: string,
    errorDetail?: string
  ): Promise<Response> {
    logEvent({
      event: "confirm_outcome",
      req_id: reqId,
      user_id_hash: userIdHash,
      conversation_id: conversationId,
      message_id: messageId,
      outcome,
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      error_kind: outcome,
      error_detail: errorDetail || errorMessage,
    });
    await recordConfirmFailure({
      admin,
      userId: user!.id,
      messageId,
      conversationId,
      errorKind: outcome,
      errorDetail: errorDetail || errorMessage,
      statusCode,
      durationMs: Date.now() - startedAt,
    });
    return Response.json({ error: errorMessage }, { status: statusCode });
  }

  // 2. Load and verify the message
  const { data: msg, error: msgError } = await admin
    .from("messages")
    .select("id, conversation_id, content, is_checkpoint, checkpoint_meta")
    .eq("id", messageId)
    .single();

  if (msgError || !msg) {
    return failWith(404, "not_found", "Message not found");
  }

  // Verify conversation belongs to this user
  const { data: conv } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", msg.conversation_id)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return failWith(403, "forbidden", "Unauthorized");
  }

  if (!msg.is_checkpoint) {
    return failWith(400, "bad_request", "Message is not a checkpoint");
  }

  // 3. Handle action
  let wasAlreadyConfirmed = false;
  if (action === "confirmed") {
    // Idempotent + transactional write — see confirm-checkpoint.ts and
    // supabase/migrations/20260417000003_confirm_idempotency.sql.
    const result = await confirmCheckpoint({
      messageId,
      conversationId,
      userId: user.id,
    });

    if (!result.success) {
      const err = result.error || "Failed to save to manual";
      if (err === "Checkpoint not found.") {
        return failWith(404, "not_found", err);
      }
      if (err === "Checkpoint was rejected or refined.") {
        return failWith(400, "not_pending", err);
      }
      return failWith(500, "rpc_fail", err);
    }

    wasAlreadyConfirmed = Boolean(result.wasAlreadyConfirmed);

    logEvent({
      event: "confirm_rpc_ok",
      req_id: reqId,
      user_id_hash: userIdHash,
      conversation_id: conversationId,
      message_id: messageId,
      outcome: wasAlreadyConfirmed ? "idempotent" : "success",
    });
  } else {
    // For rejected/refined/deferred: update status, increment counter
    // on refined only, insert distinct system message per action.
    //
    // Status mapping:
    //   refined  → status="refined"   (chain continues)
    //   rejected → status="rejected"  (chain breaks)
    //   deferred → status="rejected"  (chain breaks; same DB state as
    //              rejected — only the system message differs so Jove
    //              skips the POST-REJECTION fixed line. Track A Phase
    //              7-Mid.)
    const currentRefinementCount =
      (msg.checkpoint_meta as { refinement_count?: number })
        ?.refinement_count ?? 0;
    const updatedMeta = {
      ...msg.checkpoint_meta,
      status: action === "deferred" ? "rejected" : action,
      refinement_count:
        action === "refined"
          ? currentRefinementCount + 1
          : currentRefinementCount,
    };
    await admin
      .from("messages")
      .update({ checkpoint_meta: updatedMeta })
      .eq("id", messageId);

    await insertCheckpointActionMessage(admin, conversationId, action);
  }

  // 3b. Idempotent repeat → return short JSON ack, no follow-up stream.
  if (wasAlreadyConfirmed) {
    logEvent({
      event: "confirm_outcome",
      req_id: reqId,
      user_id_hash: userIdHash,
      conversation_id: conversationId,
      message_id: messageId,
      outcome: "idempotent",
      status_code: 200,
      duration_ms: Date.now() - startedAt,
    });
    return Response.json({
      alreadyConfirmed: true,
      conversationId,
      messageId,
    });
  }

  // 4. For confirmed actions, load the post-write layer distribution
  //    in one query. Powers BOTH the guest-promptAuth check (count)
  //    AND the Phase 7-High first-vs-subsequent branching below.
  //    For non-confirmed actions (rejected/refined/deferred), the
  //    post-confirm flow is unchanged — Jove responds normally (with
  //    POST-REJECTION fixed line for rejected).
  let totalEntries = 0;
  let allEntryLayers: number[] = [];
  if (action === "confirmed") {
    const { data: entries } = await admin
      .from("manual_entries")
      .select("layer")
      .eq("user_id", user.id);
    if (entries) {
      totalEntries = entries.length;
      allEntryLayers = entries.map((e) => e.layer as number);
    }
  }

  // Preserves the original guest-promptAuth semantics: fires for
  // count in [0, 1] — 1 is the normal case (just confirmed first
  // entry); 0 is a defensive fallback covering the failed-query path.
  let promptAuth = false;
  if (action === "confirmed" && user.is_anonymous && totalEntries <= 1) {
    promptAuth = true;
  }

  // 5. Call Sage and return streaming response. We log stream_started
  //    now; stream_ended fires inside callPersona on close. The outcome
  //    log fires when the stream is complete or interrupted — we don't
  //    have a clean hook for that here without wrapping the stream, so
  //    the success "outcome" event is implicit once stream_started is
  //    emitted (any failure would surface as rpc_fail earlier).
  logEvent({
    event: "confirm_stream_started",
    req_id: reqId,
    user_id_hash: userIdHash,
    conversation_id: conversationId,
    message_id: messageId,
    duration_ms: Date.now() - startedAt,
  });

  // 5a. Track A Phase 7-High — post-confirm flow branching. Only for
  //     confirmed actions; rejected/refined/deferred fall through to
  //     a normal callPersona call with no postConfirmMode so Jove
  //     responds per existing POST-REJECTION or natural-exploration
  //     guidance.
  const personaOptions: Parameters<typeof callPersona>[0] = {
    conversationId,
    userId: user.id,
    message: null,
    promptAuth,
  };

  if (action === "confirmed") {
    const meta = (msg.checkpoint_meta ?? {}) as {
      layer?: number | null;
      name?: string | null;
      composed_name?: string | null;
    };
    const layer = meta.layer ?? null;
    const layerName =
      layer && LAYER_NAMES[layer] ? LAYER_NAMES[layer] : "your Manual";
    const proposedHeadline =
      meta.composed_name ?? meta.name ?? "Untitled";

    if (totalEntries === 1) {
      // First lifetime confirmation. Message 1 is server-templated
      // (deterministic stamp), inserted as an assistant row so it
      // persists across reloads, and emitted via prependedMessages
      // before the Message 2 LLM stream begins. Message 2 is the
      // LLM-generated scaffolding + open-thread line.
      const message1Content = `In. A working name: "${proposedHeadline}." Yours to change.`;
      const { data: message1Row } = await admin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: message1Content,
        })
        .select("id")
        .single();

      if (message1Row?.id) {
        personaOptions.prependedMessages = [
          { messageId: message1Row.id, content: message1Content },
        ];
      }
      personaOptions.postConfirmMode = "first-message-2";
      personaOptions.postConfirmContext = {
        layerName,
        proposedHeadline,
        // entriesSummary is unused by the first-message-2 prompt
        // block but the type requires it; pass a placeholder.
        entriesSummary: "",
      };
    } else {
      // Subsequent confirmation. Single LLM-generated message. The
      // entries summary is built server-side with proper pluralization
      // so the LLM reproduces a verbatim string.
      const distinctLayers = Array.from(new Set(allEntryLayers));
      const otherLayersWithMaterial = distinctLayers
        .filter((l) => l !== layer)
        .map((l) => LAYER_NAMES[l])
        .filter((n): n is string => Boolean(n));
      const remainingEmptyCount = 5 - distinctLayers.length;
      const entriesSummary = buildEntriesSummary({
        entryCount: totalEntries,
        confirmedLayerName: layerName,
        otherLayersWithMaterial,
        remainingEmptyCount,
      });

      personaOptions.postConfirmMode = "subsequent-single";
      personaOptions.postConfirmContext = {
        layerName,
        proposedHeadline,
        entriesSummary,
      };
    }
  }

  const stream = callPersona(personaOptions);

  logEvent({
    event: "confirm_outcome",
    req_id: reqId,
    user_id_hash: userIdHash,
    conversation_id: conversationId,
    message_id: messageId,
    outcome: "success",
    status_code: 200,
    duration_ms: Date.now() - startedAt,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
