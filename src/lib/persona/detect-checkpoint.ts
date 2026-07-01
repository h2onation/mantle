// Deterministic checkpoint detection.
//
// The system prompt defines a single contract for proposing a Manual entry:
// the model writes "I want to put something in your Manual" (or a minor
// variant). If those words appear, the message is a checkpoint. Full stop.
//
// We do NOT run a separate LLM classifier to second-guess this contract.
// Layer + name + summary all come from the composition Opus call that runs
// next; this function only answers yes/no.
//
// Variants accepted (case-insensitive). The model drifts on the exact
// phrasing more often than expected under production load. The
// dev-simulator audit on 2026-05-19 caught dyslexic-mode drift in
// particular — Jove used "Let me write this up for your Manual" (and
// similar verb variants) on every proposal across a 27-turn conversation.
// None of those fired the classifier, and one led Jove to falsely claim
// entries were saved when nothing had been written (Tier 1 Rule 1
// violation). The regex below broadened to catch:
//
//   Subject framing: "I want to" | "I'd like to" | "I'm going to" | "Let me"
//   Verb:            put | add | write (with optional " up")
//   Object:          something | this | that | it
//   Preposition:     in | into | to | for ("write this up FOR your Manual"
//                    is a common drift)
//
// The "(something|this|that|it)" anchor keeps this from false-positiving
// on prose like "you wanted to put more thought into your Manual entries."
//
// Examples now matched:
//   "I want to put something in your Manual"      (canonical)
//   "I'd like to put this in your Manual"         (canonical variant)
//   "Let me put that in your Manual"              (canonical variant)
//   "I want to add something to your Manual"      (verb drift — caught now)
//   "Let me add this to your Manual"              (verb drift — caught now)
//   "Let me write this up for your Manual"        (audit-observed — caught now)
//   "I want to write this up in your Manual"      (verb drift — caught now)
//   ...and "into your Manual" variants throughout.

const TRANSITION_LINE_PATTERN =
  /\b(?:I want to|I'd like to|I'm going to|Let me) (?:put|add|write(?: up)?) (?:something|this|that|it)(?: up)? (?:in|into|to|for) your Manual\b\s*[.!?]?/i;

export interface CheckpointDetection {
  isCheckpoint: boolean;
}

export function detectCheckpointInResponse(text: string): CheckpointDetection {
  if (!text) return { isCheckpoint: false };
  return { isCheckpoint: TRANSITION_LINE_PATTERN.test(text) };
}

/**
 * Locate the checkpoint transition line within a response, using the SAME
 * pattern that decided `isCheckpoint`. Returns the match's start index and
 * length, or null when no transition line is present.
 *
 * This is the single source of truth for the transition contract. The
 * suppression-strip path (call-persona.ts) slices at this boundary instead
 * of re-matching with a second, narrower regex — that earlier dual-regex
 * design let a transition the detector caught (e.g. "write this up for your
 * Manual") survive un-stripped, shipping entry prose to chat with no card.
 */
export function findCheckpointTransition(
  text: string
): { index: number; length: number } | null {
  if (!text) return null;
  const m = text.match(TRANSITION_LINE_PATTERN);
  if (!m || m.index === undefined) return null;
  return { index: m.index, length: m[0].length };
}

/**
 * The proposal prose AFTER the transition line — the entry text Jove wrote in
 * the save message. Under the conductor experiment this IS the user-approved
 * working version (conductor v0.5's save contract has Jove restate the
 * approved words right after the phrase), and the save path uses it VERBATIM
 * as the entry body so the composer can't re-author what the user already
 * approved. Empty string when no transition line or nothing follows it.
 */
export function extractProposalProse(text: string): string {
  const m = findCheckpointTransition(text);
  if (!m) return "";
  return text.slice(m.index + m.length).trim();
}
