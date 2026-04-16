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

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkLimit(checkpointConfirmHour, user.id);
  if (!limit.success) {
    return rateLimitedResponse(limit);
  }

  const admin = createAdminClient();
  const { messageId, action, conversationId } = (await request.json()) as {
    messageId: string;
    action: "confirmed" | "rejected" | "refined";
    conversationId: string;
  };

  // 2. Load and verify the message
  const { data: msg, error: msgError } = await admin
    .from("messages")
    .select("id, conversation_id, content, is_checkpoint, checkpoint_meta")
    .eq("id", messageId)
    .single();

  if (msgError || !msg) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Verify conversation belongs to this user
  const { data: conv } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", msg.conversation_id)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!msg.is_checkpoint) {
    return Response.json(
      { error: "Message is not a checkpoint" },
      { status: 400 }
    );
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
      // Map specific failures to precise HTTP statuses so clients can
      // distinguish transient from fatal from "never going to succeed".
      const err = result.error || "Failed to save to manual";
      if (err === "Checkpoint not found.") {
        return Response.json({ error: err }, { status: 404 });
      }
      if (err === "Checkpoint was rejected or refined.") {
        return Response.json({ error: err }, { status: 400 });
      }
      return Response.json({ error: err }, { status: 500 });
    }

    wasAlreadyConfirmed = Boolean(result.wasAlreadyConfirmed);
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
  //     The first call already sent Jove's follow-up; re-streaming it
  //     here would duplicate the message in the conversation. Client
  //     reads this response and triggers loadManual() to sync.
  if (wasAlreadyConfirmed) {
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
    // If this confirm just created the first component, prompt auth
    if (count !== null && count <= 1) {
      promptAuth = true;
    }
  }

  // 5. Call Sage and return streaming response
  const stream = callPersona({
    conversationId,
    userId: user.id,
    message: null,
    promptAuth,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
