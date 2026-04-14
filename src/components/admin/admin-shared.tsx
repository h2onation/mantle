import type { CSSProperties } from "react";

// ── Date formatting ──────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatAdminDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const mm = m < 10 ? `0${m}` : m;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h12}:${mm} ${ampm}`;
}

export function formatAdminDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// ── Shared styles ────────────────────────────────────────────────────
//
// The admin overlay is dense and needs to fit on a phone, so the table
// styles below trade visual polish for information density. Each row uses
// a stacked label-then-value layout instead of a real <table> — at this
// width, true columns would force every cell into a single character.

export const adminListItemStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--session-ink)",
  padding: "14px 0",
  borderBottom: "1px solid var(--session-ink-hairline)",
  cursor: "pointer",
  background: "none",
  border: "none",
  width: "100%",
  textAlign: "left" as const,
  WebkitTapHighlightColor: "transparent",
};

export const adminMetaStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--session-ink-ghost)",
  marginTop: 4,
  letterSpacing: "0.5px",
};

export const adminLabelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "8px",
  fontWeight: 500,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--session-ink-faded)",
};

export const adminEmptyStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--session-ink-ghost)",
  padding: "40px 0",
  textAlign: "center",
};

// ── Pagination helper ────────────────────────────────────────────────

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = page * perPage;
  return items.slice(start, start + perPage);
}
