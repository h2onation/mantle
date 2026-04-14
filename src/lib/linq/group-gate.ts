import { PERSONA_NAME } from "@/lib/persona/config";

// ---------------------------------------------------------------------------
// Group message gate — scoring-based filter for group messages.
//
// The gate is the first filter. Even when it says SEND_TO_PERSONA, Sage can
// still output [NO_RESPONSE] as a second filter.
//
// Scoring signals (all regex/string, zero API cost):
//   - Emotional weight keywords → +3
//   - Questions / bids for engagement → +3
//   - Substantial message length → +1 or +2
//   - Brief reactions (< 5 chars) → block
//
// Counter remains as safety net so Sage never goes silent forever.
// Cooldown prevents double-responding to rapid messages.
// ---------------------------------------------------------------------------

/** Minimum messages before counter lowers the scoring threshold */
export const GATE_MIN_MESSAGES = 3;

/** After this many messages without Sage, auto-send with nudge */
export const GATE_NUDGE_MESSAGES = 6;

/** Messages shorter than this are treated as brief reactions */
export const GATE_SHORT_MESSAGE_LENGTH = 5;

/** Score needed to trigger Sage (lowered to GATE_REDUCED_THRESHOLD after GATE_MIN_MESSAGES) */
export const GATE_SCORE_THRESHOLD = 3;

/** Reduced threshold once counter hits GATE_MIN_MESSAGES — any substance gets through */
export const GATE_REDUCED_THRESHOLD = 1;

/**
 * Detects direct address of the persona in group-chat text.
 * Matches the current brand name (PERSONA_NAME) plus a "sage" transition
 * fallback so users who still type the old name during the rebrand get
 * routed correctly. Case-insensitive, word-boundary matched.
 *
 * TODO: remove the "sage" alternation once the rebrand has settled and
 * telemetry shows no meaningful volume of old-name mentions.
 */
export function mentionsPersona(text: string): boolean {
  const escaped = PERSONA_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(${escaped}|sage)\\b`, "i").test(text);
}

/** Minimum ms between Sage responses (only direct address bypasses) */
export const GATE_COOLDOWN_MS = 30_000;

export type GateDecision = "SEND_TO_PERSONA" | "SKIP";

export interface GateResult {
  decision: GateDecision;
  reason: string;
  /** When true, prepend a nudge hint to Sage's context */
  addNudgeHint: boolean;
  /** The computed score for logging/debugging */
  score: number;
}

// Emotional weight keywords — compiled once at module load
const EMOTION_RE = /\b(feel|feeling|felt|worried|frustrat\w*|insecure|afraid|hurt|scared|anxious|overwhelm\w*|confus\w*|ashamed|lonely|angry|sad|vulnerable|struggling|stuck|lost|embarrass\w*|nervous|uncertain|torn|helpless)\b/i;

// Engagement bids — questions directed at the room
const BID_RE = /\b(what do you (all |guys )?think|thoughts\??|right\??|does that make sense|you know\??|any ideas|help me|i don'?t know)\b/i;

/**
 * Score a message on conversational signals.
 * Pure function, zero cost — regex and string length only.
 */
export function scoreMessage(messageText: string): number {
  const text = messageText.trim();
  let score = 0;

  // Emotional weight
  if (EMOTION_RE.test(text)) score += 3;

  // Engagement bids or substantial questions (question mark after 40+ chars)
  if (BID_RE.test(text) || (text.length >= 40 && text.includes("?"))) {
    score += 3;
  }

  // Message substance (length)
  if (text.length >= 200) score += 2;
  else if (text.length >= 80) score += 1;

  return score;
}

/**
 * Decide whether a group message should be forwarded to Sage.
 *
 * Evaluation order:
 *   1. Direct address ("sage") → always SEND
 *   2. Very short message (< 5 chars) → always SKIP
 *   3. Cooldown active (< 30s since Sage spoke) → SKIP
 *   4. Counter >= GATE_NUDGE_MESSAGES → SEND with nudge
 *   5. Score >= threshold → SEND (threshold drops after GATE_MIN_MESSAGES)
 *   6. Otherwise → SKIP
 */
export function evaluateGate(
  messageText: string,
  messagesSincePersonaSpoke: number,
  lastPersonaSpokeAt?: Date | null
): GateResult {
  const SKIP = (reason: string, score: number): GateResult =>
    ({ decision: "SKIP", reason, addNudgeHint: false, score });
  const SEND = (reason: string, score: number, nudge = false): GateResult =>
    ({ decision: "SEND_TO_PERSONA", reason, addNudgeHint: nudge, score });

  // 1. Direct address — always respond (bypasses cooldown).
  // Matches the current brand name (PERSONA_NAME) plus a "sage" transition
  // fallback so users who still type the old name during rebrand get routed
  // correctly. TODO: remove the "sage" alternation once the rebrand settles.
  if (mentionsPersona(messageText)) {
    return SEND("direct_address", 0);
  }

  // 2. Very short message — skip
  if (messageText.trim().length < GATE_SHORT_MESSAGE_LENGTH) {
    return SKIP("short_message", 0);
  }

  // 3. Cooldown — if Sage just spoke, let people talk
  if (lastPersonaSpokeAt) {
    const elapsed = Date.now() - lastPersonaSpokeAt.getTime();
    if (elapsed < GATE_COOLDOWN_MS) {
      return SKIP("cooldown", 0);
    }
  }

  const score = scoreMessage(messageText);

  // 4. Long silence — auto-send with nudge
  if (messagesSincePersonaSpoke >= GATE_NUDGE_MESSAGES) {
    return SEND("nudge", score, true);
  }

  // 5. Score check — threshold drops after enough messages
  const threshold = messagesSincePersonaSpoke >= GATE_MIN_MESSAGES
    ? GATE_REDUCED_THRESHOLD
    : GATE_SCORE_THRESHOLD;

  if (score >= threshold) {
    const reason = messagesSincePersonaSpoke >= GATE_MIN_MESSAGES
      ? "eligible_score"
      : "high_score";
    return SEND(reason, score);
  }

  // 6. Not enough signal — skip
  return SKIP("low_score", score);
}
