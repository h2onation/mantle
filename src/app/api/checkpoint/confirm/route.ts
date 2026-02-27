export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callSage } from "@/lib/sage/call-sage";
import { confirmCheckpoint } from "@/lib/sage/confirm-checkpoint";

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
  if (action === "confirmed") {
    // Use the confirmCheckpoint utility which handles composed content,
    // changelog archiving, pattern support, and system message insertion
    const result = await confirmCheckpoint({
      messageId,
      conversationId,
      userId: user.id,
    });

    if (!result.success) {
      return Response.json(
        { error: result.error || "Failed to save to manual" },
        { status: 500 }
      );
    }
  } else {
    // For rejected/refined: update status and insert system message
    const updatedMeta = { ...msg.checkpoint_meta, status: action };
    await admin
      .from("messages")
      .update({ checkpoint_meta: updatedMeta })
      .eq("id", messageId);

    const systemContent =
      action === "rejected"
        ? "[User rejected the checkpoint]"
        : "[User wants to refine the checkpoint]";

    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "system",
      content: systemContent,
    });
  }

  // 4. Call Sage and return streaming response
  const stream = callSage({
    conversationId,
    userId: user.id,
    message: null,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
