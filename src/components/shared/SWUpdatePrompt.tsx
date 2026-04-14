"use client";

interface SWUpdatePromptProps {
  onUpdate: () => void;
}

export default function SWUpdatePrompt({ onUpdate }: SWUpdatePromptProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        left: 16,
        right: 16,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        backgroundColor: "var(--session-cream)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: "var(--session-ink-soft)",
          fontWeight: 500,
        }}
      >
        Update available
      </span>
      <button
        onClick={onUpdate}
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--session-persona)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Update
      </button>
    </div>
  );
}
