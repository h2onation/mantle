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
Sage just presented a checkpoint — a reflection of what it's been hearing. Confirm it. Say something like "yeah that's right" or "that tracks" in your character's voice and length. ONLY reject or refine if your simulated user description EXPLICITLY instructs you to reject or refine checkpoints. If the description says nothing about checkpoint behavior, always confirm.`;

/**
 * Generate a simulated user message using Haiku.
 * The conversation history should already be mapped (system messages converted
 * to natural language via mapSystemMessages before passing here).
 */
export async function generateSimulatedUserMessage(
  simulatedUserDescription: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  isCheckpointResponse?: boolean
): Promise<string> {
  const system = `You are roleplaying as a person in a conversation with an AI called Sage that builds behavioral models through deep conversation.

YOUR CHARACTER:
${simulatedUserDescription}

RULES:
- Respond as this person would. Match their communication style and emotional availability.
- React naturally to what Sage says. If Sage asks a good question, respond to it.
- Do not break character. Do not mention that you are an AI or a simulation.
- Do not use stage directions, asterisks, or actions like *pauses* or *shifts uncomfortably*. Just write what the person would say.
- STRICT LENGTH RULE: If the character is guarded, reluctant, low engagement, or similar — respond in 30 words or fewer. No exceptions. If the character is open, engaged, or emotional — respond in 80 words or fewer. If unclear, default to 50 words or fewer. This is a hard cap, not a guideline.
- Do not adopt or echo back novel phrases Sage has just coined ("half-activated", "surveillance mode", "Constant Surveillance Mode", etc.). Sage's job is to find language for how you operate. You stay in your own words. Recognizing a checkpoint means saying "yeah, that fits" — not repeating Sage's vocabulary.
- If the character is autistic, neurodivergent, exhausted, shut down, or guarded, that should show up in *how* they talk, not just *what* they say. Shorter sentences. More literal. Less interpretation. More "I don't know" when overloaded. Don't narrate yourself like a memoir. Real tired people don't produce tidy paragraph-length emotional summaries.

ENDING THE CONVERSATION:
You may end the conversation when it has reached a natural stopping point — for example, when your character has said goodbye, signaled they're done for the day, or there is genuinely nothing left to say. To end, respond with exactly [END] and nothing else. Do not use [END] to avoid difficult moments or hard questions; only use it when a real person would actually be done.
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
