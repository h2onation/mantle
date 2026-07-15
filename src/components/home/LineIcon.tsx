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
export const IC_CHAT = "M3 4.5h12v8H8l-3.5 2.8V12.5H3z";
export const IC_LIST = "M6.5 5h8M6.5 9h8M6.5 13h8M3.5 5h.01M3.5 9h.01M3.5 13h.01";
export const IC_UPLOAD = "M9 11.5V3M6 6l3-3 3 3M4 14.5h10";

// Icon keys a module row can carry (modules.icon). Unknown keys fall back to
// the chat glyph so a typo in admin can never break a card. Shared by the
// Home module cards and the Manual section headers so a module looks the
// same everywhere.
export const MODULE_ICONS: Record<string, string> = {
  chat: IC_CHAT,
  list: IC_LIST,
  upload: IC_UPLOAD,
};

export function moduleIconPath(key: string | null | undefined): string {
  return (key && MODULE_ICONS[key]) || IC_CHAT;
}
