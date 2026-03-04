"use client";

interface ExploreWithSageButtonProps {
  onClick: () => void;
}

export default function ExploreWithSageButton({
  onClick,
}: ExploreWithSageButtonProps) {
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
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--session-sage-soft)",
        background: "none",
        border: "1px solid var(--session-sage-border)",
        borderRadius: 16,
        padding: "6px 14px",
        cursor: "pointer",
        marginTop: 14,
      }}
    >
      Explore further
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{ display: "block" }}
      >
        <path
          d="M3 1.5L7 5L3 8.5"
          stroke="var(--session-sage-soft)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
