"use client";

interface InfoScreensProps {
  onNavigateToSeed: () => void;
  onBack: () => void;
}

export default function InfoScreens({ onNavigateToSeed }: InfoScreensProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Wordmark (top center) */}
      <div
        style={{
          padding: "16px 0",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "15px",
          color: "var(--session-ink-faded)",
          paddingLeft: 15,
        }}
      >
        MANTLE
      </div>

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 40px" }}>
        {/* Section label */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            fontWeight: 500,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--session-sage)",
            marginBottom: 16,
          }}
        >
          HOW IT WORKS
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.2,
            letterSpacing: "-0.3px",
            color: "var(--session-ink)",
            margin: "0 0 20px 0",
          }}
        >
          You talk through a situation. Sage finds the pattern underneath.
        </h1>

        {/* Body */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.6,
            color: "var(--session-ink-mid)",
            margin: 0,
          }}
        >
          Sage listens, pushes deeper, and builds a behavioral map in the background. When it sees something worth naming, it surfaces for your review. What you confirm becomes part of your manual, a structured model of how you operate. Each conversation sharpens the picture.
        </p>
      </div>

      {/* Bottom nav */}
      <div
        style={{
          padding: "0 28px",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={onNavigateToSeed}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--session-cream)",
            backgroundColor: "var(--session-sage-soft)",
            border: "none",
            borderRadius: 8,
            padding: "12px 28px",
            cursor: "pointer",
          }}
        >
          Continue
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9.5 7L5 11" stroke="var(--session-cream)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
