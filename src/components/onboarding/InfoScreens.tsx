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
          letterSpacing: "4px",
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

        {/* Body — 4 paragraphs */}
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
            You&rsquo;ll build a manual. A guide to how you operate, in your own words.
          </p>
          <p style={{ margin: "0 0 16px 0" }}>
            You build it by talking to {PERSONA_NAME}. {PERSONA_NAME} is an AI that helps you navigate situations in your life. A conflict, a reaction, something you can&rsquo;t stop thinking about.
          </p>
          <p style={{ margin: "0 0 16px 0" }}>
            Over time, {PERSONA_NAME} identifies patterns in how you process and communicate, guided by published frameworks. When it sees something worth naming, it reflects it back. You decide if it&rsquo;s accurate.
          </p>
          <p style={{ margin: 0 }}>
            Your manual is yours. Use it to navigate whatever comes up. Or share specific parts with specific people in a way you control.
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
