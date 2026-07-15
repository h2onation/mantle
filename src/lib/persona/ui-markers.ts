/**
 * Trailing boolean UI markers.
 *
 * Jove appends a marker on its own line at the END of a message to drive a
 * client-side affordance. One marker is live today: `---reflection-ready---`
 * (the landed signal that lights the reflection bar). The retired guided-
 * intake markers (`---sections---` / `---start-situation---`, modules
 * cutover 2026-07-15) have no parser — stripDefunctMarkers below is the
 * floor that keeps any of them off screen. Markers carry no payload:
 * presence is the whole signal.
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

/**
 * UI markers the product no longer consumes. A retired marker still emitted by
 * the model (or a stale live prompt) has no parser, so its raw text leaks to
 * screen — the ---chips--- regression (2026-07-08): the marker was retired in
 * code and its parser deleted, but a live conductor-prompt override kept
 * emitting it, and it rendered as raw text after every save. Retiring a marker
 * = add it here, beside the strip that owns it. Retired markers were TRAILING
 * blocks (marker on its own line, then payload lines), so we cut from the marker
 * to the end of the message.
 */
export const RETIRED_MARKERS = ["---chips---"] as const;

/**
 * Defensive net: remove any UI marker the product doesn't consume before Jove's
 * text is stored or shown. Runs AFTER the active markers are stripped, so any
 * `---word---` line left here is defunct. A retired marker (known, carries a
 * trailing payload) cuts to end-of-message; any other bare `---word---` line (a
 * stray or hallucinated token) is dropped on its own. This is the render-time
 * floor a live DB override can't undo — the raw marker never reaches the screen
 * no matter what the prompt emits.
 */
export function stripDefunctMarkers(text: string): string {
  const lines = text.split("\n");
  const retiredAt = lines.findIndex((l) =>
    RETIRED_MARKERS.some((m) => m === l.trim())
  );
  const kept = (retiredAt === -1 ? lines : lines.slice(0, retiredAt)).filter(
    (l) => !/^\s*---[a-z][a-z-]*---\s*$/.test(l)
  );
  return kept.join("\n").replace(/\s+$/, "");
}
