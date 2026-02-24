import { anthropicFetch } from "@/lib/anthropic";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate a session summary via Haiku and save it to the conversation record.
 * Returns the summary text, or null if generation fails.
 */
export async function generateSessionSummary(
  conversationId: string,
  admin: SupabaseClient
): Promise<string | null> {
  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) {
    return null;
  }

  const transcript = messages
    .map((m) => {
      const label =
        m.role === "user" ? "User" : m.role === "assistant" ? "Sage" : "System";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");

  try {
    const response = await anthropicFetch({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system:
        "Summarize this conversation between a user and Sage (an AI building behavioral models). Focus on: topics explored, what the user revealed, checkpoints confirmed, what was left unresolved. Keep under 300 words. This summary will be injected into Sage's context next session.",
      messages: [{ role: "user", content: transcript }],
    });

    const summary =
      response.content[0].type === "text" ? response.content[0].text : "";

    await admin
      .from("conversations")
      .update({ summary })
      .eq("id", conversationId);

    return summary;
  } catch {
    return null;
  }
}
