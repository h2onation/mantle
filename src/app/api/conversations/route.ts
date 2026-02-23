import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load all conversations for this user
  const { data: conversations } = await admin
    .from("conversations")
    .select("id, status, summary, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (!conversations || conversations.length === 0) {
    return Response.json({ conversations: [] });
  }

  // Get message counts per conversation (exclude system messages)
  const convIds = conversations.map((c) => c.id);
  const { data: messageCounts } = await admin
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", convIds)
    .neq("role", "system");

  // Count messages per conversation
  const countMap: Record<string, number> = {};
  if (messageCounts) {
    for (const m of messageCounts) {
      countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
    }
  }

  const result = conversations.map((c) => ({
    id: c.id,
    status: c.status || "active",
    summary: c.summary,
    created_at: c.created_at,
    updated_at: c.updated_at,
    message_count: countMap[c.id] || 0,
  }));

  return Response.json({ conversations: result });
}
