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
// Variants accepted (case-insensitive, end-of-sentence anchored so a stray
// reference inside other prose like "I want to put something in your manual
// that you mentioned earlier" does not match):
//   "I want to put something in your Manual"
//   "I want to put this in your Manual"
//   "I want to put that in your Manual"

const TRANSITION_LINE_PATTERN =
  /\bI want to put (?:something|this|that) in your Manual\b\s*[.!?]?/i;

export interface CheckpointDetection {
  isCheckpoint: boolean;
}

export function detectCheckpointInResponse(text: string): CheckpointDetection {
  if (!text) return { isCheckpoint: false };
  return { isCheckpoint: TRANSITION_LINE_PATTERN.test(text) };
}
