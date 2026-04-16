"use client";

import { APP_VERSION } from "@/lib/version";

interface DesktopVitrineProps {
  children: React.ReactNode;
}

/**
 * The desktop "vitrine" — the parchment canvas, editorial masthead, phone
 * frame, and colophon around any mywalnut surface.
 *
 * Three layouts controlled by responsive CSS classes in globals.css:
 *   - Mobile (<431px): phone fills viewport, paratext hidden.
 *   - Narrow desktop (431-1029px): vertical stack — masthead top-center,
 *     colophon bottom-center, phone reserves 400px vertical for paratext.
 *   - Wide desktop (1030px+): side-margin layout — masthead top-LEFT
 *     corner, colophon bottom-LEFT, phone at full natural maxHeight
 *     (no reservation), right margin as intentional negative space.
 *
 * The side-margin layout removes paratext from the phone's vertical
 * sightline, letting the phone sit at full height and using the
 * horizontal margins that were otherwise empty parchment. Asymmetric
 * left-weighting is a compositional statement — editorial restraint.
 *
 * Shared by every route that renders inside the phone frame so landing
 * and authenticated surfaces are visually consistent:
 *   - MainApp (authenticated /) → sessions, manual, settings
 *   - OnboardingFlow (/login) → entry screen, login, info screens, seed
 *
 * Children render inside the 430px frame and are responsible for their
 * own background and content. DesktopVitrine provides only the outer
 * canvas, masthead, frame, and colophon.
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
          inside the phone frame, 52px on the canvas. Lowercase held at
          scale with slightly-negative tracking so the letterforms sit
          tight rather than reading decorative. The masthead is a label,
          not a shout — --ink-soft, not --ink.

          Positioning lives in .mw-masthead (globals.css). Centered-top
          at narrow desktop, top-left corner at wide desktop. */}
      <header
        className="mw-desktop-paratext mw-masthead"
        aria-label="mywalnut"
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

      {/* Phone frame. maxHeight lives in .mw-phone-frame (globals.css)
          so it can vary between narrow desktop (reserved 400px for
          paratext above/below) and wide desktop (no reservation — full
          natural 932 max). Mobile clamps to viewport. */}
      <div
        className="mw-phone-frame"
        style={{
          width: "100%",
          maxWidth: 430,
          height: "100%",
          borderRadius: "clamp(0px, (100vw - 430px) * 999, 40px)",
          border: "clamp(0px, (100vw - 430px) * 999, 1px) solid rgba(26, 22, 20, 0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>

      {/* Desktop colophon — publication identity and meta. Left-aligned
          running prose + mono meta row. Editorial convention for
          colophons and indicia (NYRB, NYR, Ghost, trade-press colophons)
          is left-aligned; centered reads as invitation. No hairline
          between statement and meta — the typeface change (Instrument
          Serif → JetBrains Mono) is the register shift.

          Positioning lives in .mw-colophon / .mw-colophon-inner
          (globals.css). Centered-bottom 430px column at narrow desktop,
          bottom-left ~220-320px column at wide desktop (adaptive to
          available margin space). */}
      <footer className="mw-desktop-paratext mw-colophon">
        <div className="mw-colophon-inner">
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
              flexWrap: "wrap",
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
