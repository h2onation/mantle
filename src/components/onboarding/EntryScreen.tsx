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
          fontFamily: "Arial, sans-serif",
          fontSize: "10.5px",
          fontWeight: 600,
          letterSpacing: "0.25em",
          color: "rgba(139,157,119,0.5)",
          marginBottom: "16px",
        }}
      >
        MANTLE
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "30px",
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          color: "#E8E4DD",
          margin: "0 0 16px 0",
        }}
      >
        You understand yourself in fragments.
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "17px",
          lineHeight: 1.5,
          color: "rgba(232,228,221,0.45)",
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
          fontFamily: "Georgia, serif",
          fontSize: "15px",
          fontWeight: 400,
          color: "#1A1A18",
          backgroundColor: "rgba(139,157,119,0.55)",
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
          fontFamily: "Georgia, serif",
          fontSize: "15px",
          fontWeight: 400,
          color: "rgba(232,228,221,0.5)",
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          cursor: "pointer",
        }}
      >
        Log in
      </button>
    </div>
  );
}
