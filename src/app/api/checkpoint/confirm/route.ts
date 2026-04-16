export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
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
    action: "confirmed" | "rejected" | "refined";
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
    // For rejected/refined: update status and insert system message
    const updatedMeta = { ...msg.checkpoint_meta, status: action };
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

  // 4. Detect if this is a guest's first confirmed checkpoint → promptAuth
  let promptAuth = false;
  if (action === "confirmed" && user.is_anonymous) {
    const { count } = await admin
      .from("manual_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count !== null && count <= 1) {
      promptAuth = true;
    }
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

  const stream = callPersona({
    conversationId,
    userId: user.id,
    message: null,
    promptAuth,
  });

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
