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
