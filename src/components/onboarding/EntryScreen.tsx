"use client";

import { useEffect } from "react";
import { PERSONA_NAME } from "@/lib/persona/config";
import HeroManualVignette from "@/components/onboarding/HeroManualVignette";

// Paper surface — subtle noise + corner vignette. The landing is the one
// screen that earns real texture; noise bumped from 2.5% to 3.5% and
// vignette darkened so the paper-bound feel actually registers.
const PAPER_BACKGROUND = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"), radial-gradient(ellipse 90% 70% at center 40%, transparent 40%, rgba(26, 22, 20, 0.055) 100%)`;

interface EntryScreenProps {
  onLogin: () => void;
}

export default function EntryScreen({ onLogin }: EntryScreenProps) {
  // No-op — kept for parity with the former rotating-specimen effect
  // that lived here. The new HeroManualVignette owns its own timing.
  useEffect(() => {}, []);

  return (
    <main
      className="mw-entry-root scrollable-page"
      style={{
        backgroundColor: "var(--session-linen)",
        backgroundImage: PAPER_BACKGROUND,
        backgroundSize: "256px 256px, 100% 100%",
        backgroundRepeat: "repeat, no-repeat",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Editorial landing. Four sections + a minimal footer:
          1. Masthead (wordmark + hairline rule)
          2. Hero — asymmetric on desktop: headline/subhead left, specimen card right
          3. Method — four numbered beats, hairline-separated
          4. CTA block — beta line + primary plate + italic log-in link
          Footer: one fleuron ornament, mono-caps Privacy/Terms.
          Motion: one orchestrated page-load reveal; no scattered micro-fx. */}
      <style>{`
        .mw-entry-root {
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          font-family: var(--font-display), "Newsreader", Georgia, serif;
          color: var(--session-ink);
          --mw-entry-max: 1120px;
          --mw-entry-hairline: rgba(26, 22, 20, 0.14);
          --mw-entry-hairline-soft: rgba(26, 22, 20, 0.08);
        }

        @keyframes mwEntryFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mwEntryRuleDraw {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes mwEntryFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mw-entry-masthead,
          .mw-entry-masthead-rule,
          .mw-entry-headline,
          .mw-entry-subhead,
          .mw-entry-specimen {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }

        /* ── Masthead ──────────────────────────────────────────── */
        .mw-entry-masthead {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 28px 28px 0;
          box-sizing: border-box;
          animation: mwEntryFadeUp 500ms ease-out 80ms both;
        }
        .mw-entry-wordmark {
          margin: 0;
          font-family: inherit;
          font-weight: 400;
          font-size: 22px;
          letter-spacing: -0.01em;
          line-height: 1;
          color: var(--session-ink);
          text-align: center;
        }
        .mw-entry-period {
          color: var(--session-persona);
        }
        .mw-entry-masthead-rule {
          height: 1px;
          background: var(--mw-entry-hairline);
          margin: 20px 0 0;
          transform-origin: left center;
          animation: mwEntryRuleDraw 520ms cubic-bezier(0.25, 1, 0.35, 1) 280ms both;
        }

        /* ── Hero ──────────────────────────────────────────────── */
        .mw-entry-hero {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 48px 28px 56px;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 1fr;
          gap: 40px;
          align-items: start;
        }
        .mw-entry-headline {
          font-family: inherit;
          margin: 0 0 18px;
          font-weight: 400;
          font-size: 42px;
          line-height: 1.04;
          letter-spacing: -0.022em;
          color: var(--session-ink);
          animation: mwEntryFadeUp 650ms ease-out 480ms both;
        }
        .mw-entry-subhead {
          font-family: inherit;
          margin: 0;
          font-weight: 300;
          font-style: italic;
          font-size: 18px;
          line-height: 1.45;
          color: var(--session-ink-mid);
          animation: mwEntryFadeUp 650ms ease-out 620ms both;
        }
        .mw-entry-specimen {
          /* The HeroManualVignette inside carries its own border +
             background. The aside is a transparent wrapper that just
             participates in the hero grid and drives the fade-in. */
          box-sizing: border-box;
          animation: mwEntryFadeIn 800ms ease-out 820ms both;
        }

        /* ── Atmospheric band — between hero and method. ────────
           Full-bleed editorial-photography moment. The sand-ripples
           image carries the thesis visually: emergent pattern in
           something that looks random. Edges fade into the linen
           surround (mask-image) so the band reads as a section
           break, not a framed photograph. If the image file is
           absent the CSS gradient behind it still holds a warm
           atmospheric tone. */
        .mw-entry-atmos {
          width: 100%;
          height: 180px;
          position: relative;
          overflow: hidden;
          /* Fallback atmospheric gradient behind the image — if the
             JPG 404s we still get a warm sand-toned band instead of
             a transparent gap. */
          background:
            linear-gradient(180deg,
              #e6d0ab 0%,
              #d9bf94 45%,
              #c8a97a 100%
            );
          animation: mwEntryFadeIn 900ms ease-out 1200ms both;
        }
        .mw-entry-atmos-img {
          position: absolute;
          inset: 0;
          background-image: url(/images/hero-sand.jpg);
          background-size: cover;
          background-position: center 60%;
          background-repeat: no-repeat;
          /* Top and bottom soft fade so the image dissolves into
             the linen page rather than ending as a hard edge. */
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0%,
            rgba(0, 0, 0, 0.92) 14%,
            rgba(0, 0, 0, 0.92) 86%,
            transparent 100%
          );
          mask-image: linear-gradient(
            180deg,
            transparent 0%,
            rgba(0, 0, 0, 0.92) 14%,
            rgba(0, 0, 0, 0.92) 86%,
            transparent 100%
          );
        }
        .mw-entry-atmos-grain {
          /* Subtle noise veil so the photograph doesn't read as a
             pristine stock asset on the otherwise textural linen
             page. Matches the product's paper-surface intent. */
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.14;
          mix-blend-mode: multiply;
          background-image: radial-gradient(
            rgba(26, 22, 20, 0.6) 1px,
            transparent 1px
          );
          background-size: 3px 3px;
        }

        /* ── Method ────────────────────────────────────────────── */
        .mw-entry-method {
          /* Full-bleed tonal band — subtly deeper than the base linen
             so the "how it works" beat reads as its own section. The
             paper noise from the root shows through. */
          width: 100%;
          background-color: rgba(26, 22, 20, 0.025);
          border-top: 1px solid var(--mw-entry-hairline-soft);
          border-bottom: 1px solid var(--mw-entry-hairline-soft);
        }
        .mw-entry-method-inner {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 48px 28px 56px;
          box-sizing: border-box;
        }
        .mw-entry-method-heading {
          font-family: inherit;
          margin: 0 0 28px;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.4;
          color: var(--session-ink-faded);
          letter-spacing: 0.005em;
        }
        .mw-entry-method-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .mw-entry-method-item {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 20px;
          align-items: baseline;
          padding: 22px 0;
          border-top: 1px solid var(--mw-entry-hairline-soft);
        }
        .mw-entry-method-item:last-child {
          border-bottom: 1px solid var(--mw-entry-hairline-soft);
        }
        .mw-entry-method-num {
          /* Big mono numeral. Real type-scale contrast against the
             serif body copy — the hairlines alone don't carry enough
             structural weight. */
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 26px;
          font-weight: 400;
          letter-spacing: 0;
          color: var(--session-persona);
          padding-top: 6px;
          line-height: 1;
        }
        .mw-entry-method-body {
          font-family: inherit;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.55;
          color: var(--session-ink-mid);
        }

        /* ── CTA block ─────────────────────────────────────────── */
        .mw-entry-cta-block {
          /* Full-bleed lighter band — cream lift after the method
             section's tonal dip. Sends the eye toward the plate
             button and gives the final moment its own space. */
          width: 100%;
          background-color: rgba(255, 255, 255, 0.35);
        }
        .mw-entry-cta-inner {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 56px 28px 56px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .mw-entry-beta {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 400;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: var(--session-ink-faded);
          margin: 0 0 22px;
        }
        .mw-entry-cta {
          display: inline-block;
          padding: 16px 36px;
          font-family: var(--font-sans), -apple-system, system-ui, sans-serif;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.005em;
          color: var(--session-cream);
          background-color: var(--session-persona);
          border: none;
          border-radius: 4px;
          text-decoration: none;
          cursor: pointer;
          transition: background-color 220ms ease, transform 220ms ease;
        }
        .mw-entry-cta:hover {
          background-color: #45583b;
        }
        .mw-entry-cta:active {
          transform: translateY(1px);
        }
        .mw-entry-login-line {
          margin: 20px 0 0;
          font-family: inherit;
          font-size: 15px;
          font-style: italic;
          font-weight: 300;
          color: var(--session-ink-mid);
        }
        .mw-entry-login {
          all: unset;
          cursor: pointer;
          font-style: italic;
          color: var(--session-ink);
          position: relative;
          padding-bottom: 2px;
        }
        .mw-entry-login::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: var(--session-ink);
          transform: scaleX(0.35);
          transform-origin: left center;
          transition: transform 280ms cubic-bezier(0.25, 1, 0.35, 1);
        }
        .mw-entry-login:hover::after,
        .mw-entry-login:focus-visible::after {
          transform: scaleX(1);
        }

        /* ── Footer (fleuron + legal) ─────────────────────────── */
        .mw-entry-footer {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 16px 28px calc(40px + env(safe-area-inset-bottom, 0px));
          box-sizing: border-box;
          text-align: center;
        }
        .mw-entry-fleuron {
          font-family: inherit;
          font-size: 20px;
          color: var(--session-persona);
          opacity: 0.7;
          line-height: 1;
          margin: 0 0 18px;
          user-select: none;
        }
        .mw-entry-legal {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: var(--session-ink-mid);
        }
        .mw-entry-legal a {
          color: inherit;
          text-decoration: none;
          transition: color 200ms ease;
        }
        .mw-entry-legal a:hover {
          color: var(--session-ink);
        }
        .mw-entry-legal-sep {
          margin: 0 10px;
          color: var(--session-ink-whisper);
        }

        /* ── Tablet (≥768px) ──────────────────────────────────── */
        @media (min-width: 768px) {
          .mw-entry-masthead { padding: 40px 48px 0; }
          .mw-entry-wordmark { font-size: 28px; }
          .mw-entry-masthead-rule { margin-top: 28px; }
          .mw-entry-hero {
            padding: 72px 48px 72px;
            gap: 56px;
          }
          .mw-entry-headline { font-size: 56px; letter-spacing: -0.028em; }
          .mw-entry-subhead { font-size: 20px; }
          .mw-entry-atmos { height: 240px; }
          .mw-entry-method-inner { padding: 64px 48px 80px; }
          .mw-entry-method-heading { font-size: 18px; margin-bottom: 36px; }
          .mw-entry-method-item { padding: 28px 0; grid-template-columns: 80px 1fr; gap: 28px; }
          .mw-entry-method-body { font-size: 18px; }
          .mw-entry-method-num { font-size: 32px; padding-top: 8px; }
          .mw-entry-cta-inner { padding: 64px 48px 72px; }
          .mw-entry-cta { padding: 18px 48px; font-size: 15.5px; }
          .mw-entry-footer { padding: 24px 48px calc(48px + env(safe-area-inset-bottom, 0px)); }
          .mw-entry-fleuron { font-size: 22px; margin-bottom: 22px; }
        }

        /* ── Desktop (≥1024px) — asymmetric hero ─────────────── */
        @media (min-width: 1024px) {
          .mw-entry-masthead { padding: 48px 64px 0; }
          .mw-entry-wordmark { font-size: 36px; text-align: left; }
          .mw-entry-masthead-rule { margin-top: 36px; }
          .mw-entry-hero {
            padding: 104px 64px 112px;
            grid-template-columns: 1.55fr 1fr;
            gap: 80px;
            align-items: end;
          }
          .mw-entry-headline {
            font-size: 76px;
            line-height: 1.02;
            letter-spacing: -0.032em;
            margin-bottom: 22px;
          }
          .mw-entry-subhead { font-size: 22px; line-height: 1.4; }
          .mw-entry-specimen { align-self: end; }
          .mw-entry-atmos { height: 320px; }
          .mw-entry-method-inner { padding: 88px 64px 104px; }
          .mw-entry-method-heading { font-size: 19px; margin-bottom: 48px; max-width: 560px; }
          .mw-entry-method-item { padding: 36px 0; grid-template-columns: 120px 1fr; gap: 36px; }
          .mw-entry-method-body { font-size: 19px; max-width: 760px; line-height: 1.6; }
          .mw-entry-method-num { font-size: 44px; padding-top: 12px; }
          .mw-entry-cta-inner { padding: 88px 64px 96px; }
          .mw-entry-cta { padding: 20px 56px; font-size: 16px; }
          .mw-entry-login-line { font-size: 16px; margin-top: 24px; }
          .mw-entry-footer { padding: 32px 64px calc(56px + env(safe-area-inset-bottom, 0px)); }
          .mw-entry-fleuron { font-size: 24px; margin-bottom: 26px; }
          .mw-entry-legal { font-size: 11px; letter-spacing: 1.6px; }
        }

        @media (min-width: 1440px) {
          .mw-entry-headline { font-size: 88px; }
          .mw-entry-hero { padding-top: 128px; padding-bottom: 136px; }
        }
      `}</style>

      {/* 1. Masthead */}
      <header className="mw-entry-masthead">
        <h1 className="mw-entry-wordmark">
          my walnut<span className="mw-entry-period">.</span>
        </h1>
        <div className="mw-entry-masthead-rule" aria-hidden="true" />
      </header>

      {/* 2. Hero — asymmetric on desktop: headline + subhead left, specimen right */}
      <section className="mw-entry-hero">
        <div>
          <h2 className="mw-entry-headline">
            A more complete manual of how your mind works<span className="mw-entry-period">.</span>
          </h2>
          <p className="mw-entry-subhead">Built for neurodivergent adults.</p>
        </div>

        <aside
          className="mw-entry-specimen"
          aria-label="How a conversation becomes a Manual entry"
        >
          <HeroManualVignette />
        </aside>
      </section>

      {/* 3. Atmospheric band — editorial breath between the hero and
          the method. Purely atmospheric; no overlay text. Image at
          /images/hero-sand.jpg. */}
      <div className="mw-entry-atmos" aria-hidden="true">
        <div className="mw-entry-atmos-img" />
        <div className="mw-entry-atmos-grain" />
      </div>

      {/* 4. Method — four numbered beats. The outer section holds the
          full-bleed tonal band; the inner div caps at max-width. */}
      <section className="mw-entry-method">
       <div className="mw-entry-method-inner">
        <h3 className="mw-entry-method-heading">
          An oversimplification of how it works:
        </h3>
        <ol className="mw-entry-method-list">
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">01</span>
            <div className="mw-entry-method-body">
              You bring a situation that is on your mind &mdash; a conflict, a reaction, a pattern you keep noticing. Talking it through with {PERSONA_NAME} helps you organize what you&rsquo;re processing.
            </div>
          </li>
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">02</span>
            <div className="mw-entry-method-body">
              Underneath the conversation, {PERSONA_NAME} is building a model of how you operate &mdash; from your patterns, your language, and what you return to. When it sees something worth naming, it proposes an entry for your Manual. You decide what&rsquo;s true.
            </div>
          </li>
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">03</span>
            <div className="mw-entry-method-body">
              Over time, your Manual becomes a more complete picture of how you work. Share parts of it with the people in your life on your terms &mdash; your partner, your therapist, your manager &mdash; to help them understand how you operate.
            </div>
          </li>
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">04</span>
            <div className="mw-entry-method-body">
              See how your Manual connects with others. Find patterns across relationships. Ask questions about how two Manuals fit together.
            </div>
          </li>
        </ol>
       </div>
      </section>

      {/* 4. CTA block — full-bleed cream-lift band */}
      <section className="mw-entry-cta-block">
       <div className="mw-entry-cta-inner">
        <p className="mw-entry-beta">my walnut is in early access.</p>
        <a href="/waitlist" className="mw-entry-cta">
          Join the waitlist
        </a>
        <p className="mw-entry-login-line">
          Already have access?{" "}
          <button type="button" onClick={onLogin} className="mw-entry-login">
            Log in.
          </button>
        </p>
       </div>
      </section>

      {/* Footer — one fleuron, then mono-caps legal row */}
      <footer className="mw-entry-footer">
        <div className="mw-entry-fleuron" aria-hidden="true">
          ❦
        </div>
        <div className="mw-entry-legal">
          <a href="/privacy">Privacy</a>
          <span className="mw-entry-legal-sep">·</span>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </main>
  );
}
