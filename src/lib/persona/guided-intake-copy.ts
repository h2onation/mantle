export const GUIDED_INTAKE_OPENER =
  "Pick someone of note in your life. A person — or a pet. Could be your partner, parent, a friend, a coworker. Positive or negative, high impact or low. Just someone worth naming.";

// Distinctive phrases the opener-flow fallbacks use, sourced from the
// GUIDED INTAKE block in src/lib/persona/system-prompt.ts. The model
// generally reproduces these verbatim because the prompt quotes them,
// but we normalize quotes and whitespace before matching to absorb
// rendering drift (smart quotes, ASCII apostrophe vs. typographic).
const WIDEN_SCOPE_PHRASE = "Who did you last have a conversation with";
const RELATIONSHIP_TO_PATTERN_PHRASE = "Skip the person";
const GENTLE_END_PHRASE = "Doesn't have to happen today";

// Anchor for the default-opener match. Using a substring rather than
// the full constant guards against the model dropping a clause or
// punctuation while still being specific enough that it can't false-
// positive on situation-mode openers (which never use this phrasing).
const DEFAULT_OPENER_ANCHOR = "Pick someone of note in your life";

function normalize(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .toLowerCase();
}

export type GuidedIntakeOpenerVariant =
  | "default"
  | "widen_scope"
  | "relationship_to_pattern"
  | "gentle_end";

// Detects which opener-flow path a guided-intake assistant message
// represents, or null if the message is a normal deepening turn (no
// fallback phrase, not the literal opener). Caller decides whether to
// fire — this function makes no assumptions about turn count.
//
// Order matters: gentle_end > relationship_to_pattern > widen_scope > default.
// Later fallbacks subsume earlier ones in the prompt's flow, so the
// deepest match wins when multiple phrases somehow appear in one
// message (defensive — shouldn't happen in practice).
export function detectGuidedIntakeOpenerVariant(
  message: string
): GuidedIntakeOpenerVariant | null {
  const normalized = normalize(message);
  if (normalized.includes(normalize(GENTLE_END_PHRASE))) return "gentle_end";
  if (normalized.includes(normalize(RELATIONSHIP_TO_PATTERN_PHRASE)))
    return "relationship_to_pattern";
  if (normalized.includes(normalize(WIDEN_SCOPE_PHRASE)))
    return "widen_scope";
  if (normalized.includes(normalize(DEFAULT_OPENER_ANCHOR))) return "default";
  return null;
}
