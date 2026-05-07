"use client";

interface ExploreWithPersonaButtonProps {
  onClick: () => void;
  readOnly?: boolean;
}

export default function ExploreWithPersonaButton({
  onClick,
  readOnly,
}: ExploreWithPersonaButtonProps) {
  if (readOnly) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-serif)",
        fontSize: 15,
        fontStyle: "italic",
        fontWeight: 400,
        color: "var(--session-ink-mid)",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--session-hair)",
        borderRadius: 0,
        padding: "0 0 2px",
        cursor: "pointer",
        marginTop: "var(--sp-sm)",
      }}
    >
      explore further
    </button>
  );
}
