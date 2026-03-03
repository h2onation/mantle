"use client";

interface EntryScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const ENTRY_GLOW = { x: 50, y: 32, scale: 1.2, opacity: 0.16 };

export default function EntryScreen({ onGetStarted, onLogin }: EntryScreenProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        height: "100%",
        padding: "0 32px 64px",
        boxSizing: "border-box",
      }}
    >
      {/* MANTLE label */}
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "10.5px",
          fontWeight: 600,
          letterSpacing: "0.25em",
          color: "var(--color-accent-dim)",
          marginBottom: "16px",
        }}
      >
        MANTLE
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "30px",
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          color: "var(--color-text)",
          margin: "0 0 16px 0",
        }}
      >
        You understand yourself in fragments.
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "17px",
          lineHeight: 1.5,
          color: "var(--color-text-dim)",
          margin: "0 0 48px 0",
        }}
      >
        That&apos;s why the same patterns keep running.
      </p>

      {/* Primary button */}
      <button
        onClick={onGetStarted}
        style={{
          width: "100%",
          padding: "16px",
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          fontWeight: 400,
          color: "var(--color-void)",
          backgroundColor: "var(--color-accent-strong)",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          marginBottom: "12px",
        }}
      >
        Get started
      </button>

      {/* Secondary button */}
      <button
        onClick={onLogin}
        style={{
          width: "100%",
          padding: "16px",
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          fontWeight: 400,
          color: "var(--color-text-dim)",
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid var(--color-divider)",
          borderRadius: "12px",
          cursor: "pointer",
        }}
      >
        Log in
      </button>
    </div>
  );
}
