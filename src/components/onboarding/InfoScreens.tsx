"use client";

import { PERSONA_NAME } from "@/lib/persona/config";
import TopBar from "@/components/shared/TopBar";

interface InfoScreensProps {
  onNavigateToSeed: () => void;
  onBack: () => void;
}

export default function InfoScreens({ onNavigateToSeed, onBack }: InfoScreensProps) {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <TopBar onBack={onBack} />

      {/* Plate — walnut tint, prose-led */}
      <div
        style={{
          margin: "32px 18px 0",
          padding: "26px 24px 24px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.22)",
          border: "1px solid rgba(170,120,82,0.24)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.30), 0 1px 0 rgba(220,170,120,0.12) inset",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          Before you begin
        </p>
        <h2
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: "-0.3px",
            color: "var(--session-ink)",
          }}
        >
          What this is, and isn&rsquo;t<span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
        </h2>
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 15.5,
            lineHeight: 1.62,
            color: "var(--session-ink)",
            letterSpacing: "-0.05px",
          }}
        >
          {PERSONA_NAME} is a careful, direct companion. It listens, reflects, and helps you notice patterns in how you work. Over time, the things you confirm become entries in your Manual.
        </p>
        <p
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 15.5,
            lineHeight: 1.62,
            color: "var(--session-ink-soft)",
            letterSpacing: "-0.05px",
          }}
        >
          This isn&rsquo;t therapy and {PERSONA_NAME} isn&rsquo;t a clinician. If something serious comes up, the Crisis Support link is always one tap away in the menu<span style={{ color: "var(--session-walnut)" }}>.</span>
        </p>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Action — TextBtn CTA at bottom */}
      <div
        style={{
          padding: "0 24px",
          paddingBottom: "calc(36px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={onNavigateToSeed}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 0",
            borderBottom: "1px solid var(--session-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: "var(--session-ink)",
            boxSizing: "border-box",
          }}
        >
          <span>Continue</span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>
      </div>
    </main>
  );
}
