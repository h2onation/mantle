"use client";

import { PERSONA_NAME } from "@/lib/persona/config";

interface EntryScreenProps {
  onBegin: () => void;
  onLogin: () => void;
}

export default function EntryScreen({ onBegin, onLogin }: EntryScreenProps) {
  return (
    <main
      className="scrollable-page"
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: "var(--session-linen)",
        backgroundImage: "var(--session-bg-welcome)",
        color: "var(--session-ink)",
        WebkitTapHighlightColor: "transparent",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes mwEntryRise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mw-rise { animation: mwEntryRise 720ms ease-out both; }
        .mw-rise-1 { animation-delay: 80ms; }
        .mw-rise-2 { animation-delay: 200ms; }
        .mw-rise-3 { animation-delay: 320ms; }
        .mw-rise-4 { animation-delay: 440ms; }

        @media (prefers-reduced-motion: reduce) {
          .mw-rise { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* Centered hero — wordmark + thesis */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: 28,
          right: 28,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <p
          className="mw-rise mw-rise-1"
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2.2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          A private manual
        </p>
        <h1
          className="mw-rise mw-rise-2"
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--font-serif)",
            fontSize: 72,
            fontWeight: 400,
            letterSpacing: "-2px",
            lineHeight: 0.96,
            color: "var(--session-ink)",
          }}
        >
          mywalnut<span style={{ color: "var(--session-walnut)" }}>.</span>
        </h1>
        <p
          className="mw-rise mw-rise-3"
          style={{
            margin: "22px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 17,
            fontStyle: "italic",
            lineHeight: 1.55,
            color: "var(--session-ink-mid)",
            maxWidth: "94%",
          }}
        >
          A behavioral playbook for how you actually work &mdash; written by
          you, in conversation with {PERSONA_NAME}
          <span style={{ color: "var(--session-walnut)", fontStyle: "normal" }}>.</span>
        </p>
      </div>

      {/* Bottom — primary action + quiet sign in */}
      <div
        className="mw-rise mw-rise-4"
        style={{
          position: "absolute",
          bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
          left: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <button
          type="button"
          onClick={onBegin}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderRadius: 999,
            background: "var(--session-walnut-surface)",
            border: "1px solid var(--session-walnut-border)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: "var(--session-ink)",
            boxSizing: "border-box",
          }}
        >
          <span>Begin</span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--session-ink-mid)",
          }}
        >
          Already have access?{" "}
          <button
            type="button"
            onClick={onLogin}
            style={{
              all: "unset",
              cursor: "pointer",
              color: "var(--session-ink)",
              borderBottom: "1px solid var(--session-walnut-light)",
              paddingBottom: 1,
            }}
          >
            Sign in
          </button>
        </p>
      </div>

      {/* Legal footer */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: "var(--session-ink-faded)",
        }}
      >
        <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
        <span style={{ color: "var(--session-ink-whisper)" }}>&middot;</span>
        <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
      </div>
    </main>
  );
}
