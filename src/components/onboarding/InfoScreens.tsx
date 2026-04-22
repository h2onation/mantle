"use client";

import { PERSONA_NAME } from "@/lib/persona/config";

interface InfoScreensProps {
  onNavigateToSeed: () => void;
  onBack: () => void;
}

export default function InfoScreens({ onNavigateToSeed }: InfoScreensProps) {
  return (
    <main
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
          letterSpacing: "1.5px",
          color: "var(--session-ink-faded)",
          paddingLeft: 4,
        }}
      >
        my walnut
      </div>

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 40px" }}>
        {/* Section label */}
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            fontWeight: 500,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--session-persona)",
            marginBottom: 16,
            margin: "0 0 16px 0",
          }}
        >
          HOW IT WORKS
        </h1>

        {/* Body — 2 paragraphs */}
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.55,
            color: "var(--session-ink-mid)",
          }}
        >
          <p style={{ margin: "0 0 16px 0" }}>
            You&rsquo;ll build your Manual by talking to {PERSONA_NAME}. Bring real situations &mdash; a conflict, a reaction you can&rsquo;t stop thinking about, a pattern you keep noticing. {PERSONA_NAME} reflects patterns back. You decide what goes in.
          </p>
          <p style={{ margin: 0 }}>
            Builds best when you show up most days for the first two weeks.
          </p>
        </div>
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
            backgroundColor: "var(--session-persona-soft)",
            border: "none",
            borderRadius: 8,
            padding: "12px 28px",
            cursor: "pointer",
          }}
        >
          Continue
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5 3L9.5 7L5 11" stroke="var(--session-cream)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </main>
  );
}
