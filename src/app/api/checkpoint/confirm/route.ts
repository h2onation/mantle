export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { callPersona } from "@/lib/persona/call-persona";
import { confirmCheckpoint } from "@/lib/persona/confirm-checkpoint";
import { insertCheckpointActionMessage } from "@/lib/persona/persona-pipeline";
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
  const auth = await requireUser({
    onUnauthorized: () => {
      logEvent({
        event: "confirm_outcome",
        req_id: reqId,
        outcome: "unauthorized",
        status_code: 401,
        duration_ms: Date.now() - startedAt,
      });
    },
  });
  if (auth instanceof Response) return auth;
  const { user } = auth;

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
  const {
    messageId,
    action,
    conversationId,
    editedContent,
    editedName,
  } = (await request.json()) as {
    messageId: string;
    // "deferred" is the refinement-ceiling "Let it go" path. DB level
    // it behaves like rejected (status='rejected'), but the system
    // message is distinct so Jove does not run the POST-REJECTION
    // fixed line in response. Track A Phase 7-Mid.
    action: "confirmed" | "rejected" | "refined" | "deferred";
    conversationId: string;
    // Optional edits from the review overlay. Ignored unless action ===
    // "confirmed". Trimmed and validated downstream.
    editedContent?: string | null;
    editedName?: string | null;
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

  // 2. Load and verify the message + ownership in parallel.
  // The conversation lookup uses the trusted body conversationId; we then
  // assert it matches the message's conversation_id below to catch any
  // attempt to pass a messageId from a different conversation.
  const [msgResult, convResult] = await Promise.all([
    admin
      .from("messages")
      .select("id, conversation_id, content, is_checkpoint, checkpoint_meta")
      .eq("id", messageId)
      .single(),
    admin
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .single(),
  ]);

  const { data: msg, error: msgError } = msgResult;
  const { data: conv } = convResult;

  if (msgError || !msg) {
    return failWith(404, "not_found", "Message not found");
  }

  if (!conv || conv.user_id !== user.id || conv.id !== msg.conversation_id) {
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
      editedContent,
      editedName,
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
    //
    // Idempotency: a fast double-tap (or any second call before the
    // overlay closes) would otherwise double-increment refinement_count
    // and insert two action system messages. We gate on the current
    // status — only "pending" proceeds. Any terminal status is treated
    // as already-handled and returns success without writes.
    const currentStatus =
      (msg.checkpoint_meta as { status?: string })?.status ?? null;
    if (currentStatus !== "pending") {
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
        alreadyHandled: true,
        currentStatus,
        conversationId,
        messageId,
      });
    }

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
    // DB-level precondition: only write if the row is STILL pending. The
    // currentStatus check above reads the `msg` fetched earlier, which can be
    // stale — a concurrent "confirmed" (a FOR UPDATE transactional write) can
    // land between that read and this write. Without the precondition this
    // reject/refine UPDATE would clobber the confirmed status, orphaning the
    // just-written manual_entries row (the message would read "refined" while
    // the entry exists). Filtering on checkpoint_meta->>status makes the write
    // a no-op when a concurrent action already moved it out of pending.
    const { data: updatedRows, error: updateErr } = await admin
      .from("messages")
      .update({ checkpoint_meta: updatedMeta })
      .eq("id", messageId)
      .eq("checkpoint_meta->>status", "pending")
      .select("id");

    if (updateErr) {
      return failWith(500, "rpc_fail", "Failed to update checkpoint status");
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Lost the race — a concurrent action already moved this out of pending.
      // Don't insert an action message or run the follow-up; treat as handled.
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
        alreadyHandled: true,
        conversationId,
        messageId,
      });
    }

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
  if (action === "confirmed") {
    const { count } = await admin
      .from("manual_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    totalEntries = count ?? 0;
  }

  // Preserves the original guest-promptAuth semantics: fires for
  // count in [0, 1] — 1 is the normal case (just confirmed first
  // entry); 0 is a defensive fallback covering the failed-query path.
  let promptAuth = false;
  if (action === "confirmed" && user.is_anonymous && totalEntries <= 1) {
    promptAuth = true;
  }

  // 5. Call Jove and return streaming response. We log stream_started
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
    // The post-confirm flow used to have:
    //   - First-confirm: a templated Message 1 ("In. A working name: 'X.'
    //     Yours to change.") prepended via prependedMessages, then an LLM
    //     Message 2 for scaffolding + forward question.
    //   - Subsequent: a single LLM message starting with the same "In. A
    //     working name:" stamp + an entries-summary line + forward question.
    //
    // User testing 2026-05-14 flagged that as mechanical and inauthentic
    // — the "working name" framing reads like an admin receipt, and the
    // entries summary leaks Manual metadata into chat. The title is
    // already visible in the trigger card, and the chat-history label
    // already shows "Saved to <Layer> — Layer N." Repeating it in Jove's
    // text is redundant.
    //
    // The new flow: a single LLM message that opens with "Saved.", names
    // a specific thread from the just-finished conversation, and offers
    // the user a choice — continue with that thread or pivot to
    // something else. No prepend, no entries summary, no title
    // repetition. The forming-state indicator carries the visible wait.
    if (totalEntries === 1) {
      personaOptions.postConfirmMode = "first-message-2";
    } else {
      personaOptions.postConfirmMode = "subsequent-single";
    }
  }

  if (action === "rejected") {
    // Drives the POST-REJECTION block so Jove delivers the pinned
    // "That entry didn't land..." line on this turn. Deferred and refined use
    // distinct system messages and intentionally do not fire it.
    personaOptions.postRejection = true;
  }

  const stream = callPersona(personaOptions);

  // Wrap the stream so the outcome log fires when the stream actually
  // closes (or errors), not when callPersona synchronously returns the
  // stream object. Without this wrap the metric overstates success
  // because a mid-stream interruption after a successful DB write
  // would still log "success." The DB write IS successful by this
  // point — the wrap just lets us distinguish "write + follow-up
  // delivered" from "write succeeded but follow-up died."
  let outcomeLogged = false;
  function logOutcomeOnce(
    outcome: "success" | "stream_interrupted",
    errorDetail?: string
  ) {
    if (outcomeLogged) return;
    outcomeLogged = true;
    logEvent({
      event: "confirm_outcome",
      req_id: reqId,
      user_id_hash: userIdHash,
      conversation_id: conversationId,
      message_id: messageId,
      outcome,
      status_code: 200,
      duration_ms: Date.now() - startedAt,
      ...(errorDetail ? { error_kind: "stream_interrupted", error_detail: errorDetail } : {}),
    });
  }

  const taggedStream = stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush() {
        logOutcomeOnce("success");
      },
    })
  );

  // pipeThrough propagates upstream errors to the TransformStream's
  // readable side, but flush() doesn't run on error. Attach a
  // .catch-style observer via a second tap so errors get logged.
  const observedStream = new ReadableStream({
    async start(controller) {
      const reader = taggedStream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        logOutcomeOnce(
          "stream_interrupted",
          err instanceof Error ? err.message : "stream error"
        );
        controller.error(err);
      }
    },
  });

  return new Response(observedStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
