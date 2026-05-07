export const GUIDED_INTAKE_OPENER =
  "Tell me about a moment in the last week or two that's still sitting with you. Doesn't have to be big. A conversation that landed wrong, a reaction that surprised you, a thing that worked when you didn't expect it to. Whatever comes to mind first is fine.";

// Distinctive phrases the opener-flow fallbacks use, sourced from the
// GUIDED INTAKE block in src/lib/persona/system-prompt.ts. The model
// generally reproduces these verbatim because the prompt quotes them,
// but we normalize quotes and whitespace before matching to absorb
// rendering drift (smart quotes, ASCII apostrophe vs. typographic).
const RECENCY_DROP_PHRASE = "Doesn't have to be recent";
const MOMENTS_TO_STATES_PHRASE = "Skip the moment";
const GENTLE_END_PHRASE = "Doesn't have to happen today";

// Anchor for the default-opener match. Using a substring rather than
// the full constant guards against the model dropping a clause or
// punctuation while still being specific enough that it can't false-
// positive on situation-mode openers (which never use this phrasing).
const DEFAULT_OPENER_ANCHOR = "Tell me about a moment in the last week or two";

function normalize(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .toLowerCase();
}

export type GuidedIntakeOpenerVariant =
  | "default"
  | "recency_drop"
  | "moments_to_states"
  | "gentle_end";

// Detects which opener-flow path a guided-intake assistant message
// represents, or null if the message is a normal deepening turn (no
// fallback phrase, not the literal opener). Caller decides whether to
// fire — this function makes no assumptions about turn count.
//
// Order matters: gentle_end > moments_to_states > recency_drop > default.
// Later fallbacks subsume earlier ones in the prompt's flow, so the
// deepest match wins when multiple phrases somehow appear in one
// message (defensive — shouldn't happen in practice).
export function detectGuidedIntakeOpenerVariant(
  message: string
): GuidedIntakeOpenerVariant | null {
  const normalized = normalize(message);
  if (normalized.includes(normalize(GENTLE_END_PHRASE))) return "gentle_end";
  if (normalized.includes(normalize(MOMENTS_TO_STATES_PHRASE)))
    return "moments_to_states";
  if (normalized.includes(normalize(RECENCY_DROP_PHRASE)))
    return "recency_drop";
  if (normalized.includes(normalize(DEFAULT_OPENER_ANCHOR))) return "default";
  return null;
}
