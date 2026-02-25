import { anthropicFetch } from "@/lib/anthropic";

const SYSTEM_PROMPT = `You generate placeholder text for a chat input field. The user just received a message from an AI conversationalist called Sage that helps people understand how they operate. Your job: produce a single question fragment that prompts the user to reflect and type something thoughtful.
Rules:
* 3 to 6 words. Never more than 6.
* Always an incomplete question the user would finish. It should invite reflection.
* Lowercase. Trailing ellipsis. No question mark — the ellipsis replaces it.
* No other punctuation.
* Pull from the emotional center of Sage's message, not the surface question.
* Never generic. Never reusable across different conversations.
* Never therapeutic or soft. ("how does that make you..." is wrong. "what does she not know..." is right.)
* Never repeats Sage's phrasing directly. Compress and redirect.
* If Sage asked where something started, prompt toward a memory: "when did that start..."
* If Sage named a pattern, prompt toward the exception or cost: "what does it cost..."
* If Sage delivered a checkpoint, prompt toward what doesn't fit: "what part feels off..."
Output the fragment and nothing else. No explanation, no quotes, no formatting.`;

export async function generatePlaceholder(
  sageResponse: string
): Promise<string | null> {
  try {
    const response = await anthropicFetch({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: sageResponse,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let fragment = rawText.trim();

    // Strip quotes if Haiku wraps them
    fragment = fragment.replace(/^["']|["']$/g, "");

    // Strip trailing ellipsis for validation, we'll add it back
    const withoutEllipsis = fragment.replace(/\.{2,}$/, "").trim();

    if (!withoutEllipsis) return null;

    // Validate word count (3-6, with some tolerance)
    const wordCount = withoutEllipsis.split(/\s+/).length;
    if (wordCount < 2 || wordCount > 8) return null;

    // Ensure trailing ellipsis
    return withoutEllipsis + "...";
  } catch (err) {
    console.error("[placeholder-generator] Failed:", err);
    return null;
  }
}
