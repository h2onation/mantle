import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { userId, isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const targetUserId = body.userId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Query conversations for the target user
    const { data: conversations, error: convError } = await admin
      .from("conversations")
      .select("id, status, summary, created_at, updated_at")
      .eq("user_id", targetUserId)
      .order("updated_at", { ascending: false });

    if (convError) {
      console.error("[admin/conversations] Query error:", convError);
      return Response.json({ error: "Failed to load conversations" }, { status: 500 });
    }

    // Count messages per conversation (excluding system messages)
    const convIds = (conversations || []).map((c) => c.id);
    const countMap: Record<string, number> = {};

    if (convIds.length > 0) {
      const { data: messages } = await admin
        .from("messages")
        .select("conversation_id, role")
        .in("conversation_id", convIds)
        .neq("role", "system");

      if (messages) {
        for (const m of messages) {
          countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
        }
      }
    }

    // Log access
    await admin.from("admin_access_logs").insert({
      admin_id: userId,
      target_user_id: targetUserId,
      action: "list_conversations",
    });

    const result = (conversations || []).map((c) => ({
      id: c.id,
      status: c.status || "active",
      summary: c.summary,
      created_at: c.created_at,
      updated_at: c.updated_at,
      message_count: countMap[c.id] || 0,
    }));

    return Response.json({ conversations: result });
  } catch (err) {
    console.error("[admin/conversations] Unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
