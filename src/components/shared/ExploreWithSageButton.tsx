"use client";

interface ExploreWithSageButtonProps {
  onClick: () => void;
  variant?: "meadow" | "dark";
}

export default function ExploreWithSageButton({
  onClick,
  variant = "meadow",
}: ExploreWithSageButtonProps) {
  const isDark = variant === "dark";

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
        fontSize: 12,
        fontWeight: 500,
        color: isDark ? "#A8B89F" : "var(--cp-explore-text)",
        background: isDark
          ? "linear-gradient(135deg, rgba(122,139,114,0.15) 0%, rgba(122,139,114,0.08) 100%)"
          : "linear-gradient(135deg, rgba(94,112,84,0.1) 0%, rgba(94,112,84,0.05) 100%)",
        border: isDark
          ? "1px solid rgba(122,139,114,0.25)"
          : "1px solid var(--cp-explore-border)",
        borderRadius: 8,
        padding: "9px 14px 9px 12px",
        cursor: "pointer",
        marginTop: 14,
        transition: "border-color 0.2s ease",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{ display: "block" }}
      >
        <path
          d="M3 1.5L7 5L3 8.5"
          stroke={isDark ? "#A8B89F" : "rgba(94, 112, 84, 0.65)"}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Explore with Sage
    </button>
  );
}
