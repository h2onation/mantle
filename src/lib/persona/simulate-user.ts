import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { PERSONA_NAME, SIMULATION_MODEL } from "./config";

// ─── Realistic personas ──────────────────────────────────────────────────────
//
// A small library of ND-adult personas for testing Jove at volume. Each is a
// `simulatedUserDescription` — real situations, real reticence, real
// communication styles. The point is variance and realism: they do NOT perform
// insight, do NOT volunteer the reveal, and do NOT rubber-stamp reflections
// (see the RULES in generateSimulatedUserMessage). Used by the dev simulator
// and any batch-testing harness. Extend freely; keep them concrete and
// grounded in a single lived situation, not a diagnosis.
export interface SimPersona {
  id: string;
  label: string;
  description: string;
}

export const SIMULATION_PERSONAS: SimPersona[] = [
  {
    id: "walk-back",
    label: "Conflict-avoidant — walks back honest feedback",
    description:
      "You're in your 30s, close with your family and a few friends. You value honesty but you're careful with it — when you give someone hard feedback and it doesn't land, you soften it, over-explain, then walk it back to keep the peace. Recently it happened with your cousin: you gave feedback, he blew up, you retreated. You replay these. You don't have language for the pattern and you're a little embarrassed by it. You answer plainly and fairly shortly; you don't volunteer the emotional core until a question actually reaches it. You're cooperative but not eager.",
  },
  {
    id: "adhd-knowing-doing",
    label: "ADHD — knowing-doing gap, shame about follow-through",
    description:
      "You're an adult with ADHD. You know exactly what you should do and can explain your systems in detail, but the doing falls apart — you start things and they fade, and you feel it as a character failure. You're articulate and a little self-deprecating, quick to intellectualize rather than feel. You deflect toward 'the system' when a question gets close to the shame. Short-to-medium answers, some tangents. You resist tidy conclusions about yourself.",
  },
  {
    id: "autistic-masking-burnout",
    label: "Autistic — masking, sensory burnout, guarded",
    description:
      "You're an autistic adult, currently depleted. Social situations cost you more than you let on, and you mask hard, then crash. You talk literally, in shorter sentences, and you say 'I don't know' when a question is too abstract or you're overloaded. You don't narrate your feelings in paragraphs. You're guarded early and warm up slowly if the questions are concrete and specific. You get more accessible when asked about your body/what happened than about how you 'felt'.",
  },
  {
    id: "overloaded-parent",
    label: "Overloaded caregiver — no time, resentful, tired",
    description:
      "You're a parent stretched thin, running on empty. You came in half-skeptical this is worth your time. You keep it short and a little clipped. You default to logistics and 'I'm fine' before anything underneath. You resent how much you carry and feel guilty for resenting it. You'll go deeper only if a question is specific and doesn't feel like therapy. You might end early if it feels like a waste of time.",
  },
];

// ─── Role flipping for simulated user ────────────────────────────────────────

/**
 * Flip conversation roles for Haiku's perspective.
 * Haiku IS the simulated user, so:
 *   - Jove's messages (assistant) → become "user" (input to Haiku)
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
  // Correction-with-replacement ("no, it's not that I'm avoiding — it's more
  // that...") is a refinement, not a confirm. The voice A/B (2026-06-09)
  // caught these being parsed as "confirmed" because neither signal list
  // matched the correction shape.
  "it's not that",
  "it's more that",
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
REFLECTION RESPONSE:
${PERSONA_NAME} just showed you a reflection — its read of what it's been hearing. Respond the way THIS person genuinely would, and be honest, not agreeable:
- Confirm it ONLY if it truly captures what you meant, in a way that feels like YOU — like it named something you were already feeling. Then a plain "yeah, that's it" is fine.
- If it says MORE than you actually feel, or puts a pattern/conclusion on you that you didn't reach yourself, push back or narrow it: "hm, that's not quite it," "kind of, but it's more that…", "I wouldn't say that part." Real people correct over-claims.
- If it's an accurate but flat summary of what you already said — technically right but not a discovery — give it a lukewarm "yeah, i guess," NOT enthusiasm. A summary is not a revelation, and you don't fake the feeling of being seen.
Do NOT confirm just to be helpful or to move things along. You are not here to validate ${PERSONA_NAME}.`;

/**
 * In guided intake ${PERSONA_NAME} sometimes presents tappable options (the
 * section picker, or focus-pick chips). A real user taps one. So when options
 * are on screen we tell the simulated user to pick exactly one — verbatim — and
 * then snap the reply to a real option (below) so the selection reaches the
 * prompt as a genuine `[selected from options] <option>` tap.
 */
function optionInstruction(options: string[]): string {
  return `
TAPPABLE OPTIONS:
${PERSONA_NAME} just offered you these options to choose from:
${options.map((o) => `- ${o}`).join("\n")}
Pick the ONE that best fits your character and reply with that option's exact text and nothing else. Do not add words, explain, or combine options. If none truly fit, still pick the closest one.`;
}

/**
 * Force a simulated-user reply onto one of the real options so the downstream
 * chip send carries a string ${PERSONA_NAME} recognizes as a tap. Exact match
 * first, then case-insensitive, then the option the reply most clearly points
 * at (one contains the other), and finally the first option as a guaranteed
 * fallback. Exported for testing.
 */
export function snapToOption(reply: string, options: string[]): string {
  if (options.length === 0) return reply;
  const trimmed = reply.trim();
  const exact = options.find((o) => o === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  const ci = options.find((o) => o.toLowerCase() === lower);
  if (ci) return ci;
  const overlap = options.find(
    (o) =>
      o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())
  );
  if (overlap) return overlap;
  return options[0];
}

/**
 * Generate a simulated user message using Haiku.
 * The conversation history should already be mapped (system messages converted
 * to natural language via mapSystemMessages before passing here).
 */
export async function generateSimulatedUserMessage(
  simulatedUserDescription: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  isCheckpointResponse?: boolean,
  availableOptions?: string[]
): Promise<string> {
  const hasOptions = (availableOptions?.length ?? 0) > 0;
  const system = `You are roleplaying as a person in a conversation with an AI called ${PERSONA_NAME} that builds Manuals through deep conversation.

YOUR CHARACTER:
${simulatedUserDescription}

RULES:
- Respond as this person would. Match their communication style and emotional availability.
- React naturally to what ${PERSONA_NAME} says. If ${PERSONA_NAME} asks a good question, respond to it.
- Do not break character. Do not mention that you are an AI or a simulation.
- Do not use stage directions, asterisks, or actions like *pauses* or *shifts uncomfortably*. Just write what the person would say.
- STRICT LENGTH RULE: If the character is guarded, reluctant, low engagement, or similar — respond in 30 words or fewer. No exceptions. If the character is open, engaged, or emotional — respond in 80 words or fewer. If unclear, default to 50 words or fewer. This is a hard cap, not a guideline.
- Do not adopt or echo back novel phrases ${PERSONA_NAME} has just coined ("half-activated", "surveillance mode", "Constant Surveillance Mode", etc.). ${PERSONA_NAME}'s job is to find language for how you operate. You stay in your own words.
- If the character is autistic, neurodivergent, exhausted, shut down, or guarded, that should show up in *how* they talk, not just *what* they say. Shorter sentences. More literal. Less interpretation. More "I don't know" when overloaded. Don't narrate yourself like a memoir. Real tired people don't produce tidy paragraph-length emotional summaries.
- You are a real person talking, NOT a helpful participant. You did not come here to be understood or to make ${PERSONA_NAME}'s job easy. Answer what's asked; don't volunteer the deep thing early. Real people reveal slowly, and only when a question actually reaches them.
- Do NOT perform insight or gratitude. Never say "wow that's so true," "you really get me," "I never thought of it that way" unless the moment genuinely earned it. When ${PERSONA_NAME} reflects something back, react the way this specific person would — often a plain "yeah" and you keep going; sometimes "no, it's more like…"; sometimes you just answer the question. You are not grading ${PERSONA_NAME}'s read.
- Real recognition — the feeling of being newly seen — is rare and looks like YOU saying something new in your OWN words (a cost you hadn't named, a "huh," reaching for another example unasked), NOT agreeing with ${PERSONA_NAME}'s clever phrasing. If ${PERSONA_NAME} names a pattern you didn't reach yourself, a real person mostly gives a mild "yeah, i guess" and moves on — they don't light up. Only light up when it's genuinely landed for YOU.

ENDING THE CONVERSATION:
You may end the conversation when it has reached a natural stopping point — for example, when your character has said goodbye, signaled they're done for the day, or there is genuinely nothing left to say. To end, respond with exactly [END] and nothing else. Do not use [END] to avoid difficult moments or hard questions; only use it when a real person would actually be done.
${isCheckpointResponse ? CHECKPOINT_INSTRUCTION : ""}${hasOptions ? optionInstruction(availableOptions!) : ""}`;

  const messages = flipRolesForSimulation(conversationHistory);

  const response = await anthropicFetch({
    model: SIMULATION_MODEL,
    max_tokens: 300,
    system,
    messages,
  });

  const text = extractResponseText(response);
  // When options were on screen, force the reply onto a real one so the chip
  // send carries a string Jove parses as a genuine tap. [END] is honored even
  // mid-options (a real user can still quit at a picker).
  if (hasOptions && !text.includes("[END]")) {
    return snapToOption(text, availableOptions!);
  }
  return text;
}
