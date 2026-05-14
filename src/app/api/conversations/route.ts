import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERSONA_NAME } from "@/lib/persona/config";
import { recordApiError } from "@/lib/observability/record-api-error";

function extractTitle(summary: string | null): string | null {
  if (!summary) return null;
  const match = summary.match(/^TITLE:\s*(.+)/);
  return match ? match[1].trim() : null;
}

export const dynamic = "force-dynamic";

export async function GET() {
  let capturedUserId: string | null = null;
  try {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  capturedUserId = user?.id ?? null;

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
    await recordApiError({
      admin,
      route: "/api/conversations",
      method: "GET",
      statusCode: 500,
      error: convError,
      userId: capturedUserId,
    });
    return Response.json({ error: "Failed to load conversations" }, { status: 500 });
  }

  if (!conversations || conversations.length === 0) {
    return Response.json({ conversations: [] });
  }

  // Get message counts and first user message per conversation. The count
  // and preview are split into two queries: counts don't need content (which
  // dominates payload size for power users), and the preview only needs
  // user-role rows. Both fire in parallel.
  const convIds = conversations.map((c) => c.id);
  const [countResult, userMsgResult] = await Promise.all([
    admin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .neq("role", "system"),
    admin
      .from("messages")
      .select("conversation_id, content")
      .in("conversation_id", convIds)
      .eq("role", "user")
      .order("created_at", { ascending: true }),
  ]);

  if (countResult.error) {
    console.error("[conversations] Messages count query error:", countResult.error);
  }
  if (userMsgResult.error) {
    console.error("[conversations] User messages query error:", userMsgResult.error);
  }

  const countMap: Record<string, number> = {};
  if (countResult.data) {
    for (const m of countResult.data) {
      countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
    }
  }

  const previewMap: Record<string, string> = {};
  if (userMsgResult.data) {
    for (const m of userMsgResult.data) {
      if (!previewMap[m.conversation_id]) {
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

  // Build synthetic "Text with Jove" entry if user has text channel messages.
  // The three message queries (latest, count, earliest) are independent of
  // each other once we know the conversation IDs — fire in parallel.
  const [latestRes, countRes, firstRes] = await Promise.all([
    admin
      .from("messages")
      .select("content, created_at")
      .in("conversation_id", convIds)
      .eq("channel", "text")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("channel", "text"),
    admin
      .from("messages")
      .select("created_at")
      .in("conversation_id", convIds)
      .eq("channel", "text")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const textStats = latestRes.data;
  const textCount = countRes.count;
  const firstText = firstRes.data;

  if (textStats) {
    const preview = textStats.content.length > 80
      ? textStats.content.substring(0, 80) + "…"
      : textStats.content;

    result.unshift({
      id: "text-channel",
      status: "active",
      summary: null,
      title: `Text with ${PERSONA_NAME}`,
      preview,
      created_at: firstText?.created_at ?? textStats.created_at,
      updated_at: textStats.created_at,
      message_count: textCount || 0,
      is_text_channel: true,
    } as typeof result[number]);
  }

  return Response.json({ conversations: result });
  } catch (err) {
    await recordApiError({
      admin: createAdminClient(),
      route: "/api/conversations",
      method: "GET",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
