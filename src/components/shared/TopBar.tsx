"use client";

interface TopBarProps {
  onBack?: () => void;
}

const CIRCLE_BTN_STYLE: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  background: "var(--session-button-inset)",
  border: "1px solid var(--session-walnut-border-soft)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--session-ink)",
  fontSize: "14px",
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

const SPACER_STYLE: React.CSSProperties = { width: 38, height: 38, flexShrink: 0 };

// Left slot hosts the back chevron when present (returning from a true
// drill-down, e.g. Crisis). Primary tabs pass nothing — the persistent
// bottom nav is the way around — so both slots are spacers and the
// wordmark sits centered. (The slide-out drawer + its menu glyph were
// retired with the bottom nav.)
export default function TopBar({ onBack }: TopBarProps) {
  const leftButton = onBack ? (
    <button onClick={onBack} aria-label="Back" style={CIRCLE_BTN_STYLE}>
      ‹
    </button>
  ) : (
    <span aria-hidden="true" style={SPACER_STYLE} />
  );

  const rightButton = <span aria-hidden="true" style={SPACER_STYLE} />;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 22px",
        borderBottom: "1px solid var(--session-walnut-border)",
      }}
    >
      {leftButton}

      <span
        className="mw-topbar-wordmark"
        style={{
          fontFamily: "var(--font-display), var(--font-serif)",
          fontSize: "16px",
          fontWeight: 400,
          letterSpacing: "-0.3px",
          color: "var(--session-ink)",
          lineHeight: 1,
        }}
      >
        mywalnut
        <span style={{ color: "var(--session-walnut)" }}>.</span>
      </span>

      {rightButton}
    </div>
  );
}
