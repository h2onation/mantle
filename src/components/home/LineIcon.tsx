// Shared line-icon primitive + path constants for the Home surfaces
// (DesktopHome's resume ribbon, the WaysToBegin doors). One copy of the SVG
// wrapper so the two consumers don't each hand-roll their own.

export function LineIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

export const IC_BOOKMARK = "M4.5 2.5h9v13l-4.5-3-4.5 3z";
// The one module glyph — Home cards and Manual section headers all render it
// (the per-module icon key was removed with the config field, 2026-07-21).
export const IC_CHAT = "M3 4.5h12v8H8l-3.5 2.8V12.5H3z";
