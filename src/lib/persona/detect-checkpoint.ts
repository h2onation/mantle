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
// phrasing more often than expected under production load, so we also
// accept the common paraphrases ("I'd like to put", "I'm going to put",
// "Let me put") and "in" / "into" interchangeably. The "(something|this
// |that)" anchor is what keeps this from false-positiving on prose like
// "you wanted to put more thought into your Manual entries."
//   "I want to put something in your Manual"
//   "I want to put this in your Manual"
//   "I want to put that in your Manual"
//   "I'd like to put something in your Manual"
//   "I'm going to put this in your Manual"
//   "Let me put that in your Manual"
//   ...and the "into your Manual" variant of any of the above.

const TRANSITION_LINE_PATTERN =
  /\b(?:I want to put|I'd like to put|I'm going to put|Let me put) (?:something|this|that) (?:in|into) your Manual\b\s*[.!?]?/i;

export interface CheckpointDetection {
  isCheckpoint: boolean;
}

export function detectCheckpointInResponse(text: string): CheckpointDetection {
  if (!text) return { isCheckpoint: false };
  return { isCheckpoint: TRANSITION_LINE_PATTERN.test(text) };
}
