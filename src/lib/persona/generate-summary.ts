import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { SupabaseClient } from "@supabase/supabase-js";
import { PERSONA_NAME, SUMMARY_MODEL } from "./config";

/**
 * Builds a labeled transcript string from message objects.
 */
export function buildTranscript(
  messages: { role: string; content: string }[]
): string {
  return messages
    .map((m) => {
      const label =
        m.role === "user" ? "User" : m.role === "assistant" ? PERSONA_NAME : "System";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");
}

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

  const transcript = buildTranscript(messages);

  try {
    const response = await anthropicFetch({
      model: SUMMARY_MODEL,
      max_tokens: 512,
      system:
        `Summarize this conversation between a user and ${PERSONA_NAME} (an AI building behavioral models). Your response MUST begin with a short title on the first line in this exact format:\nTITLE: [3-8 word descriptive title]\n\nThen a blank line, then the summary. The title should capture the main theme (e.g. "TITLE: Conflict avoidance at work" or "TITLE: Understanding emotional triggers"). No quotes or ending punctuation in the title.\n\nFor the summary: focus on topics explored, what the user revealed, checkpoints confirmed, what was left unresolved. Keep under 300 words. This summary will be injected into ${PERSONA_NAME}'s context next session.`,
      messages: [{ role: "user", content: transcript }],
    });

    const summary = extractResponseText(response);

    // Don't overwrite a good stored summary with a blank or malformed
    // completion. A 200-but-empty Anthropic response (empty text, or a
    // non-text content block) would otherwise blank the conversation's summary
    // and title for the next session. Require the TITLE-prefixed shape the rest
    // of the pipeline expects before persisting.
    if (!/^\s*TITLE:/i.test(summary)) {
      return null;
    }

    await admin
      .from("conversations")
      .update({ summary })
      .eq("id", conversationId);

    return summary;
  } catch {
    return null;
  }
}
