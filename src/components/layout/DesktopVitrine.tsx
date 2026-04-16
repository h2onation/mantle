"use client";

import { APP_VERSION } from "@/lib/version";

interface DesktopVitrineProps {
  children: React.ReactNode;
}

/**
 * The desktop "vitrine" — the parchment canvas, editorial masthead, phone
 * frame, and colophon around any mywalnut surface. On mobile (<431px), the
 * paratext collapses via media query and the phone frame expands to fill
 * the viewport, preserving the original mobile-first experience.
 *
 * Shared by every route that renders inside the phone frame so landing and
 * authenticated surfaces are visually consistent:
 *   - MainApp (authenticated /) → sessions, manual, settings
 *   - OnboardingFlow (/login) → entry screen, login, info screens, seed
 *
 * Children render inside the 430px frame and are responsible for their own
 * background and content. DesktopVitrine provides only the outer canvas,
 * masthead, frame, and colophon.
 */
export default function DesktopVitrine({ children }: DesktopVitrineProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "var(--session-parchment)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Desktop masthead — wordmark at publication scale. One name, one
          typographic treatment, different scales across surfaces: 20px
          inside the phone frame, 64px on the canvas. Lowercase held at
          scale with slightly-negative tracking so the letterforms sit
          tight rather than reading decorative. The masthead is a label,
          not a shout — --ink-soft, not --ink. */}
      <header
        className="mw-desktop-paratext"
        aria-label="mywalnut"
        style={{
          position: "absolute",
          top: "48px",
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: "52px",
            fontWeight: 400,
            letterSpacing: "-0.5px",
            lineHeight: 1,
            color: "var(--session-ink-soft)",
          }}
        >
          my walnut
        </p>
      </header>

      {/* Phone frame. On desktop we reserve ~400px of vertical space so
          the masthead and colophon have room to breathe above and below
          the phone. At mobile widths the clamp resolves to 0, preserving
          the original full-viewport behavior. */}
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          height: "100%",
          maxHeight: "min(932px, 100dvh - clamp(0px, (100vw - 430px) * 999, 400px))",
          borderRadius: "clamp(0px, (100vw - 430px) * 999, 40px)",
          border: "clamp(0px, (100vw - 430px) * 999, 1px) solid rgba(26, 22, 20, 0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>

      {/* Desktop colophon — publication identity and meta. Left-aligned in
          a column whose width matches the phone frame and whose left edge
          lines up with the phone's left edge. Editorial convention for
          colophons and indicia (NYRB, NYR, Ghost, trade-press colophons)
          is left-aligned running prose; centered reads as invitation.
          No hairline between statement and meta — the typeface change
          (Instrument Serif → JetBrains Mono) is the register shift;
          whitespace handles the rest. */}
      <footer
        className="mw-desktop-paratext"
        style={{
          position: "absolute",
          bottom: "40px",
          left: 0,
          right: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "430px",
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 400,
              lineHeight: 1.55,
              color: "var(--session-ink-soft)",
            }}
          >
            A private manual, written by you and assembled in conversation.
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 400,
              lineHeight: 1.55,
              color: "var(--session-ink-soft)",
            }}
          >
            Nothing enters it unless you confirm.
          </p>

          <p
            style={{
              margin: "24px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              fontWeight: 400,
              letterSpacing: "0.5px",
              color: "var(--session-ink-mid)",
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: "10px",
            }}
          >
            {/* EDITORIAL COPY: change this string when beta ends. It is
                intentional publication metadata (e.g. "First edition, 2026"
                or a publication date), not a forgotten feature flag.
                See docs/decisions.md. */}
            <span>In closed beta.</span>
            <span>v{APP_VERSION}</span>
            <span aria-hidden="true">·</span>
            <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
              Privacy
            </a>
            <span aria-hidden="true">·</span>
            <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
              Terms
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
