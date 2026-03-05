import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { userId, isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const conversationId = body.conversationId;

    if (!conversationId || typeof conversationId !== "string") {
      return Response.json({ error: "conversationId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Look up conversation to get user_id and extraction_state
    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("user_id, extraction_state")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("[admin/messages] Conversation lookup error:", convError);
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Query all messages for the conversation
    const { data: messages, error: msgError } = await admin
      .from("messages")
      .select("id, role, content, is_checkpoint, checkpoint_meta, processing_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("[admin/messages] Messages query error:", msgError);
      return Response.json({ error: "Failed to load messages" }, { status: 500 });
    }

    // Log access
    await admin.from("admin_access_logs").insert({
      admin_id: userId,
      target_user_id: conversation.user_id,
      conversation_id: conversationId,
      action: "view_conversation",
    });

    return Response.json({
      messages: messages || [],
      extractionState: conversation.extraction_state || null,
    });
  } catch (err) {
    console.error("[admin/messages] Unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
