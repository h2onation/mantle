"use client";

import MobileNav, { type MobileTab } from "./MobileNav";
import BetaFeedbackButton from "@/components/shared/BetaFeedbackButton";
import { APP_VERSION } from "@/lib/version";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  settingsContent: React.ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  settingsContent,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {
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
            fontSize: "64px",
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "var(--session-linen)",
          }}
        >
          {([
            ["session", sessionContent, "session-panel"],
            ["manual", manualContent, "manual-panel"],
            ["settings", settingsContent, "settings-panel"],
          ] as const).map(([tab, content, panelId]) => (
            <div
              key={tab}
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${panelId}-tab`}
              hidden={activeTab !== tab}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: "0px",
                overflowX: "hidden",
                display: activeTab === tab ? "block" : "none",
                background: "var(--session-linen)",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\")",
                backgroundSize: "256px 256px",
              }}
            >
              {content}
            </div>
          ))}
          <MobileNav activeTab={activeTab} onTabChange={onTabChange} />
          <BetaFeedbackButton />
        </div>
      </div>

      {/* Desktop colophon — publication identity and meta. Two sentences
          in the product's running voice (editorial), then a short
          centered hairline, then a mono meta row (structural). One rule
          where two registers meet; no rules around the phone frame —
          whitespace defines the zones, not lines. */}
      <footer
        className="mw-desktop-paratext"
        style={{
          position: "absolute",
          bottom: "40px",
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 auto",
            maxWidth: "540px",
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
            margin: "6px auto 0",
            maxWidth: "540px",
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            fontWeight: 400,
            lineHeight: 1.55,
            color: "var(--session-ink-soft)",
          }}
        >
          Nothing enters it unless you confirm.
        </p>

        {/* Hairline: the shift from editorial statement to structural
            metadata. Narrow and centered — a colophon ornament, not a
            page rule. */}
        <hr
          aria-hidden="true"
          style={{
            width: "120px",
            border: "none",
            borderTop: "1px solid var(--session-ink-hairline)",
            margin: "28px auto 20px",
          }}
        />

        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            fontWeight: 400,
            letterSpacing: "0.5px",
            color: "var(--session-ink-mid)",
            display: "flex",
            justifyContent: "center",
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
      </footer>
    </div>
  );
}
