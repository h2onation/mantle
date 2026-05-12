"use client";

interface TopBarProps {
  onBack?: () => void;
  onMenu?: () => void;
}

const CIRCLE_BTN_STYLE: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.30)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.85)",
  fontSize: "13.5px",
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

const SPACER_STYLE: React.CSSProperties = { width: 30, height: 30, flexShrink: 0 };

export default function TopBar({ onBack, onMenu }: TopBarProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 22px",
        borderBottom: "1px solid var(--session-walnut-border)",
      }}
    >
      {onBack ? (
        <button onClick={onBack} aria-label="Go back" style={CIRCLE_BTN_STYLE}>
          ‹
        </button>
      ) : (
        <span aria-hidden="true" style={SPACER_STYLE} />
      )}

      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "19px",
          fontWeight: 400,
          letterSpacing: "-0.4px",
          color: "var(--session-ink)",
          lineHeight: 1,
        }}
      >
        mywalnut
        <span style={{ color: "var(--session-walnut)" }}>.</span>
      </span>

      {onMenu ? (
        <button onClick={onMenu} aria-label="Open menu" style={CIRCLE_BTN_STYLE}>
          ⋯
        </button>
      ) : (
        <span aria-hidden="true" style={SPACER_STYLE} />
      )}
    </div>
  );
}
