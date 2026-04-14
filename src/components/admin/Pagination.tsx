"use client";

interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onChange: (page: number) => void;
}

// Minimal pagination — prev / page indicator / next. No page-number list,
// since the admin tables are small enough that linear paging is fine and
// page-number lists eat horizontal space on a phone.
export default function Pagination({ page, perPage, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const buttonStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
    color: "var(--session-ink-ghost)",
    background: "none",
    border: "1px solid var(--session-ink-hairline)",
    borderRadius: 4,
    padding: "6px 10px",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  };

  const disabledStyle = { ...buttonStyle, opacity: 0.4, cursor: "not-allowed" as const };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "16px 0 8px",
      }}
    >
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        style={page === 0 ? disabledStyle : buttonStyle}
      >
        ← Prev
      </button>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
        }}
      >
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        style={page >= totalPages - 1 ? disabledStyle : buttonStyle}
      >
        Next →
      </button>
    </div>
  );
}
