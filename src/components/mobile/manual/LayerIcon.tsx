import React from "react";

// Per-section emblem icons (Tabler-style strokes), keyed by section
// display-order id (1-5). Reassigned for the life-area sections:
//   1 Relationships → people · 2 Work and career → anchor (holding up) ·
//   3 Routines and structure → refresh (systems/cycle) ·
//   4 Sensory and burnout → bulb · 5 Interests and flow → sparkles (deep/flow).
// PROVISIONAL — icon choices are a visual-review call (Jeff). An unknown id
// falls through to the people glyph.
const PATHS: Record<number, React.ReactNode> = {
  1: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.4a3 3 0 0 1 0 5.2" />
      <path d="M18.5 20a5.5 5.5 0 0 0-3-5" />
    </>
  ),
  2: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.2V20.5" />
      <path d="M5 12a7 7 0 0 0 14 0" />
      <path d="M3.5 12H5.2M18.8 12H20.5" />
    </>
  ),
  3: (
    <>
      <path d="M19.9 11.5a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  4: (
    <>
      <path d="M9.6 17.5h4.8" />
      <path d="M10.5 20.5h3" />
      <path d="M12 3a6 6 0 0 1 3.7 10.7c-.5.4-.7.9-.7 1.6v.2H9v-.2c0-.7-.2-1.2-.7-1.6A6 6 0 0 1 12 3z" />
    </>
  ),
  5: (
    <>
      <path d="M12 3.2l1.7 5.1 5.1 1.7-5.1 1.7L12 16.8l-1.7-5.1L5.2 10l5.1-1.7z" />
      <path d="M18.6 14.6l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
    </>
  ),
};

export default function LayerIcon({
  layerId,
  size = 19,
}: {
  layerId: number;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[layerId] ?? PATHS[1]}
    </svg>
  );
}
