import { anthropicFetch } from "@/lib/anthropic";

// ─── Role flipping for simulated user ────────────────────────────────────────

/**
 * Flip conversation roles for Haiku's perspective.
 * Haiku IS the simulated user, so:
 *   - Sage's messages (assistant) → become "user" (input to Haiku)
 *   - Simulated user's messages (user) → become "assistant" (Haiku's prior output)
 *
 * When history is empty, returns a single prompt to kick off the conversation.
 */
export function flipRolesForSimulation(
  history: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  if (history.length === 0) {
    return [
      {
        role: "user",
        content:
          "[Begin the conversation. Say what's on your mind — a situation, a feeling, something that won't leave you alone.]",
      },
    ];
  }

  return history.map((m) => ({
    role: (m.role === "user" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));
}

// ─── Checkpoint intent parsing ───────────────────────────────────────────────

const REJECT_SIGNALS = [
  "doesn't fit",
  "doesn't capture",
  "doesn't resonate",
  "don't think that's right",
  "don't think that's quite right",
  "don't agree",
  "that's not right",
  "that's not it",
  "that's wrong",
  "no, that's not",
  "way off",
  "miss the mark",
  "misses the",
  "off base",
  "i don't see it",
  "reject",
];

const REFINE_SIGNALS = [
  "close but",
  "almost",
  "partly",
  "the name",
  "not quite right",
  "not quite",
  "needs tweaking",
  "refine",
  "change the",
  "adjust",
  "it's close",
  "mostly right but",
  "part of it",
  "some of that",
  "mostly but",
];

/**
 * Parse a simulated user's checkpoint response for intent.
 * Checks rejection signals first (strongest), then refinement, then defaults to confirmed.
 */
export function parseCheckpointIntent(
  response: string
): "confirmed" | "rejected" | "refined" {
  const lower = response.toLowerCase();

  for (const signal of REJECT_SIGNALS) {
    if (lower.includes(signal)) return "rejected";
  }

  for (const signal of REFINE_SIGNALS) {
    if (lower.includes(signal)) return "refined";
  }

  return "confirmed";
}

// ─── Simulated user message generation ───────────────────────────────────────

const CHECKPOINT_INSTRUCTION = `
CHECKPOINT RESPONSE:
Sage just proposed a checkpoint — a reflection of how you operate, to be written into your behavioral manual.
Respond to this naturally and in character. You might:
- Confirm it if it resonates ("Yeah, that's exactly it" / "That lands")
- Reject it if it feels off ("I don't think that's quite right" / "That doesn't fit because...")
- Want to refine it if it's close but not perfect ("It's close but..." / "The name doesn't feel right")
React genuinely based on who you are. Keep your response to 2-4 sentences.`;

/**
 * Generate a simulated user message using Haiku.
 * The conversation history should already be mapped (system messages converted
 * to natural language via mapSystemMessages before passing here).
 */
export async function generateSimulatedUserMessage(
  personaDescription: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  isCheckpointResponse?: boolean
): Promise<string> {
  const system = `You are roleplaying as a person in a conversation with an AI called Sage that builds behavioral models through deep conversation.

YOUR CHARACTER:
${personaDescription}

RULES:
- Stay in character at all times. You ARE this person.
- Respond proportionally to what Sage gives you. If Sage asks a deep question, go deep (4-8 sentences). If it's a simple follow-up, keep it short (1-3 sentences).
- Be emotionally honest but not performative. Real people hedge, contradict themselves, trail off.
- Do not break character. Do not mention being an AI or simulation.
- Use your own voice — avoid clinical or therapeutic language unless your character would naturally use it.
- Reveal things gradually. Don't dump your entire backstory in one turn.
- If this is the first message, bring up something specific that's been on your mind — a situation, a feeling, a moment. Don't ask Sage what to talk about.
${isCheckpointResponse ? CHECKPOINT_INSTRUCTION : ""}`;

  const messages = flipRolesForSimulation(conversationHistory);

  const response = await anthropicFetch({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system,
    messages,
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
