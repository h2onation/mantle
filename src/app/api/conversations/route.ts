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

  // Build synthetic "Text with Sage" entry if user has text channel messages.
  // Exclude group conversations (linq_group_chat_id is not null).
  const { data: textStats } = await admin
    .from("messages")
    .select("content, created_at")
    .in("conversation_id", convIds)
    .eq("channel", "text")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (textStats) {
    // Get count and earliest text message
    const { count: textCount } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("channel", "text");

    const { data: firstText } = await admin
      .from("messages")
      .select("created_at")
      .in("conversation_id", convIds)
      .eq("channel", "text")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const preview = textStats.content.length > 80
      ? textStats.content.substring(0, 80) + "…"
      : textStats.content;

    result.unshift({
      id: "text-channel",
      status: "active",
      summary: null,
      title: "Text with Sage",
      preview,
      created_at: firstText?.created_at ?? textStats.created_at,
      updated_at: textStats.created_at,
      message_count: textCount || 0,
      is_text_channel: true,
    } as typeof result[number]);
  }

  return Response.json({ conversations: result });
}
