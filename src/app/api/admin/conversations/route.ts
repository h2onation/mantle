import { requireAdmin } from "@/lib/admin/verify-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { userId, admin } = auth;

    const body = await request.json();
    const targetUserId = body.userId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

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

    // Count messages and first→last message span per conversation
    // (excluding system messages). conversations.updated_at is bumped by
    // later writes (summary, status), so it can't stand in for duration.
    const convIds = (conversations || []).map((c) => c.id);
    const countMap: Record<string, number> = {};
    const spanMap: Record<string, { first: string; last: string }> = {};

    if (convIds.length > 0) {
      const { data: messages } = await admin
        .from("messages")
        .select("conversation_id, role, created_at")
        .in("conversation_id", convIds)
        .neq("role", "system");

      if (messages) {
        for (const m of messages) {
          countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
          const span = spanMap[m.conversation_id];
          if (!span) {
            spanMap[m.conversation_id] = { first: m.created_at, last: m.created_at };
          } else {
            if (m.created_at < span.first) span.first = m.created_at;
            if (m.created_at > span.last) span.last = m.created_at;
          }
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
      duration_ms: spanMap[c.id]
        ? new Date(spanMap[c.id].last).getTime() -
          new Date(spanMap[c.id].first).getTime()
        : 0,
    }));

    return Response.json({ conversations: result });
  } catch (err) {
    console.error("[admin/conversations] Unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
