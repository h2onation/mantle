import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function extractTitle(summary: string | null): string | null {
  if (!summary) return null;
  const match = summary.match(/^TITLE:\s*(.+)/);
  return match ? match[1].trim() : null;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load all 1:1 conversations for this user (exclude group conversations)
  const { data: conversations, error: convError } = await admin
    .from("conversations")
    .select("id, status, summary, created_at, updated_at")
    .eq("user_id", user.id)
    .is("linq_group_chat_id", null)
    .order("updated_at", { ascending: false });

  if (convError) {
    console.error("[conversations] Query error:", convError);
    return Response.json({ error: "Failed to load conversations" }, { status: 500 });
  }

  if (!conversations || conversations.length === 0) {
    return Response.json({ conversations: [] });
  }

  // Get message counts and first user message per conversation
  const convIds = conversations.map((c) => c.id);
  const { data: allMessages, error: msgError } = await admin
    .from("messages")
    .select("conversation_id, role, content")
    .in("conversation_id", convIds)
    .neq("role", "system")
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("[conversations] Messages query error:", msgError);
  }

  // Count messages and find first user message per conversation
  const countMap: Record<string, number> = {};
  const previewMap: Record<string, string> = {};
  if (allMessages) {
    for (const m of allMessages) {
      countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
      if (m.role === "user" && !previewMap[m.conversation_id]) {
        previewMap[m.conversation_id] = m.content;
      }
    }
  }

  const result = conversations.map((c) => ({
    id: c.id,
    status: c.status || "active",
    summary: c.summary,
    title: extractTitle(c.summary),
    preview: previewMap[c.id] || null,
    created_at: c.created_at,
    updated_at: c.updated_at,
    message_count: countMap[c.id] || 0,
  }));

  return Response.json({ conversations: result });
}
