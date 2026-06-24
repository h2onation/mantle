/**
 * Trailing boolean UI markers for guided intake.
 *
 * Jove appends a marker on its own line at the END of a message to drive a
 * client-side affordance — `---sections---` (section picker, tee-up turn) and
 * `---start-situation---` (the live-situation handoff action). Unlike the chip
 * delimiter, these carry no payload: presence is the whole signal.
 *
 * Matching is TAIL-ANCHORED on purpose. A bare `indexOf` would let the model
 * truncate a message mid-sentence if it ever wrote one of these tokens in prose
 * — and the system prompt now teaches the model these exact strings, so it can
 * echo them while explaining the mechanic. We only strip when the marker is the
 * last non-whitespace content AND sits on its own line (preceded by a newline,
 * or it is the entire message). Anything else is treated as ordinary prose and
 * left untouched.
 */
export function stripTrailingMarker(
  text: string,
  marker: string
): { present: boolean; text: string } {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith(marker)) return { present: false, text };
  const before = trimmed.slice(0, trimmed.length - marker.length);
  // Must be on its own line: either the whole message, or preceded by a newline.
  if (before.length > 0 && !before.endsWith("\n")) return { present: false, text };
  return { present: true, text: before.replace(/\s+$/, "") };
}
