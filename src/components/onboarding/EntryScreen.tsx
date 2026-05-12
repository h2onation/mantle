"use client";

import { PERSONA_NAME } from "@/lib/persona/config";

interface EntryScreenProps {
  onBegin: () => void;
  onLogin: () => void;
}

// Logged-out landing. Renders outside DesktopVitrine so it reads as a
// real responsive web page rather than a 430px column inside a phone
// frame. Layout:
//   - Mobile (≤767px): centered single column, content pinned ~vertical center
//   - Tablet (768-1279px): centered single column, max-width 560-640px,
//     hero scaled up to 96px
//   - Wide desktop (≥1280px): centered single column, hero 120px,
//     generous vertical breathing
export default function EntryScreen({ onBegin, onLogin }: EntryScreenProps) {
  return (
    <main
      className="scrollable-page mw-entry-page"
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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
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

        /* Centered reading column — never grows beyond an editorial line. */
        .mw-entry-column {
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        .mw-entry-hero {
          font-size: 72px;
        }

        .mw-entry-thesis {
          font-size: 17px;
        }

        @media (min-width: 768px) {
          .mw-entry-column { max-width: 600px; }
          .mw-entry-hero { font-size: 88px; }
          .mw-entry-thesis { font-size: 18px; }
        }

        @media (min-width: 1024px) {
          .mw-entry-column { max-width: 640px; }
          .mw-entry-hero { font-size: 96px; }
          .mw-entry-thesis { font-size: 19px; }
        }

        @media (min-width: 1280px) {
          .mw-entry-hero { font-size: 120px; letter-spacing: -3px; }
          .mw-entry-thesis { font-size: 19px; }
        }
      `}</style>

      {/* Top eyebrow — pinned, doesn't compete with the centered hero */}
      <p
        className="mw-rise mw-rise-1"
        style={{
          position: "absolute",
          top: 32,
          left: 32,
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

      {/* Centered reading column — wordmark, thesis, CTAs */}
      <div className="mw-entry-column">
        <h1
          className="mw-entry-hero mw-rise mw-rise-2"
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            letterSpacing: "-2px",
            lineHeight: 0.96,
            color: "var(--session-ink)",
          }}
        >
          mywalnut<span style={{ color: "var(--session-walnut)" }}>.</span>
        </h1>

        <p
          className="mw-entry-thesis mw-rise mw-rise-3"
          style={{
            margin: "22px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            lineHeight: 1.55,
            color: "var(--session-ink-mid)",
            maxWidth: "44ch",
          }}
        >
          A behavioral playbook for how you actually work &mdash; written by
          you, in conversation with {PERSONA_NAME}
          <span style={{ color: "var(--session-walnut)", fontStyle: "normal" }}>.</span>
        </p>

        <div
          className="mw-rise mw-rise-4"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 20,
            marginTop: 44,
          }}
        >
          <button
            type="button"
            onClick={onBegin}
            style={{
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              maxWidth: 320,
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
      </div>

      {/* Legal footer — bottom, mono caps, ink-faded */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
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
