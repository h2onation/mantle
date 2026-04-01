// ---------------------------------------------------------------------------
// Group message gate — decides whether to call Sage for a group message.
//
// The gate is the first filter. Even when it says SEND_TO_SAGE, Sage can
// still output [NO_RESPONSE] as a second filter.
//
// KNOWN LIMITATION: The counter is message-based only. It does not account
// for time between messages. A rapid argument and a slow thoughtful exchange
// hit the same thresholds differently. Time-based decay is a future
// improvement (e.g., reset counter if > 10 minutes since last message).
// ---------------------------------------------------------------------------

/** Minimum messages before Sage is eligible to respond (unless directly addressed) */
export const GATE_MIN_MESSAGES = 3;

/** After this many messages without Sage speaking, add a nudge hint to context */
export const GATE_NUDGE_MESSAGES = 6;

/** Messages shorter than this (after trim) are treated as brief reactions */
export const GATE_SHORT_MESSAGE_LENGTH = 5;

export type GateDecision = "SEND_TO_SAGE" | "SKIP";

export interface GateResult {
  decision: GateDecision;
  reason: string;
  /** When true, prepend a nudge hint to Sage's context */
  addNudgeHint: boolean;
}

/**
 * Decide whether a group message should be forwarded to Sage.
 *
 * Rules evaluated in order (first match wins):
 *   1. Direct address ("sage" as whole word) → SEND_TO_SAGE
 *   2. Very short message (< 5 chars) → SKIP
 *   3. Counter < GATE_MIN_MESSAGES → SKIP
 *   4. Counter >= GATE_MIN_MESSAGES and < GATE_NUDGE_MESSAGES → SEND_TO_SAGE
 *   5. Counter >= GATE_NUDGE_MESSAGES → SEND_TO_SAGE with nudge hint
 */
export function evaluateGate(
  messageText: string,
  messagesSinceSageSpoke: number
): GateResult {
  // Rule a: Direct address — always respond
  if (/\bsage\b/i.test(messageText)) {
    return { decision: "SEND_TO_SAGE", reason: "direct_address", addNudgeHint: false };
  }

  // Rule b: Very short message — skip
  if (messageText.trim().length < GATE_SHORT_MESSAGE_LENGTH) {
    return { decision: "SKIP", reason: "short_message", addNudgeHint: false };
  }

  // Rule c: Too soon after Sage last spoke — let people talk
  if (messagesSinceSageSpoke < GATE_MIN_MESSAGES) {
    return { decision: "SKIP", reason: "too_soon", addNudgeHint: false };
  }

  // Rule d/e: Enough messages — send to Sage, with nudge if long gap
  const addNudge = messagesSinceSageSpoke >= GATE_NUDGE_MESSAGES;
  return {
    decision: "SEND_TO_SAGE",
    reason: addNudge ? "nudge" : "eligible",
    addNudgeHint: addNudge,
  };
}
