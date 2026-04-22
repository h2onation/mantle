"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PERSONA_NAME } from "@/lib/persona/config";

const ROTATING_EXAMPLES = [
  "You shut down and people think you\u2019re upset. You\u2019re not. You\u2019re recalibrating.",
  "You see the pattern everyone else is missing.",
  "You know exactly what you need but can\u2019t say it in the moment.",
  "When you lock in, you go deeper than anyone in the room.",
  "Plans changed and your whole system locked up.",
  "You remember what people said three months ago and act on it. That\u2019s how you care.",
  "You mask all day and no one knows what that costs.",
  "You hold the room together and nobody notices because you make it look easy.",
  "You rehearse conversations before you have them.",
  "The people you love get a version of loyalty most people don\u2019t know exists.",
];

// Paper surface — subtle noise + corner vignette. The landing is the one
// screen that earns real texture; noise bumped from 2.5% to 3.5% and
// vignette darkened so the paper-bound feel actually registers.
const PAPER_BACKGROUND = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"), radial-gradient(ellipse 90% 70% at center 40%, transparent 40%, rgba(26, 22, 20, 0.055) 100%)`;

interface EntryScreenProps {
  onLogin: () => void;
}

export default function EntryScreen({ onLogin }: EntryScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setVisible(false);
    timeoutRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % ROTATING_EXAMPLES.length);
      setVisible(true);
    }, 400);
  }, []);

  useEffect(() => {
    const interval = setInterval(advance, 4500);
    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [advance]);

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
          border: 1px solid var(--mw-entry-hairline);
          background: rgba(255, 255, 255, 0.35);
          padding: 22px 22px 24px;
          box-sizing: border-box;
          animation: mwEntryFadeIn 800ms ease-out 820ms both;
        }
        .mw-entry-specimen-label {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: var(--session-persona);
          margin-bottom: 14px;
        }
        .mw-entry-specimen-text {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.5;
          color: var(--session-ink-mid);
          min-height: 102px;
          transition: opacity 400ms ease;
        }

        /* ── Method ────────────────────────────────────────────── */
        .mw-entry-method {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 24px 28px 56px;
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
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.1em;
          color: var(--session-persona);
          padding-top: 4px;
        }
        .mw-entry-method-body {
          font-family: inherit;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.55;
          color: var(--session-ink-mid);
        }
        .mw-entry-soon {
          font-style: italic;
          color: var(--session-ink-faded);
        }

        /* ── CTA block ─────────────────────────────────────────── */
        .mw-entry-cta-block {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          padding: 24px 28px 56px;
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
          .mw-entry-specimen { padding: 26px 28px 30px; }
          .mw-entry-specimen-text { font-size: 18px; min-height: 112px; }
          .mw-entry-method { padding: 32px 48px 80px; }
          .mw-entry-method-heading { font-size: 18px; margin-bottom: 36px; }
          .mw-entry-method-item { padding: 28px 0; grid-template-columns: 72px 1fr; gap: 24px; }
          .mw-entry-method-body { font-size: 18px; }
          .mw-entry-method-num { font-size: 14px; }
          .mw-entry-cta-block { padding: 40px 48px 72px; }
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
          .mw-entry-specimen { padding: 30px 32px 36px; align-self: end; }
          .mw-entry-specimen-label { font-size: 10.5px; letter-spacing: 2.6px; }
          .mw-entry-specimen-text { font-size: 19px; line-height: 1.55; min-height: 126px; }
          .mw-entry-method { padding: 24px 64px 104px; }
          .mw-entry-method-heading { font-size: 19px; margin-bottom: 40px; max-width: 560px; }
          .mw-entry-method-item { padding: 32px 0; grid-template-columns: 96px 1fr; gap: 32px; }
          .mw-entry-method-body { font-size: 19px; max-width: 760px; line-height: 1.6; }
          .mw-entry-method-num { font-size: 15px; }
          .mw-entry-cta-block { padding: 56px 64px 80px; }
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
          aria-label="A line you might see in your Manual"
        >
          <div className="mw-entry-specimen-label">In the Manual</div>
          <div
            className="mw-entry-specimen-text"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {ROTATING_EXAMPLES[activeIndex]}
          </div>
        </aside>
      </section>

      {/* 3. Method — four numbered beats */}
      <section className="mw-entry-method">
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
              Over time, your Manual becomes a more complete picture of how you work. <span className="mw-entry-soon">(Coming soon)</span> Share parts of it with the people in your life on your terms &mdash; your partner, your therapist, your manager &mdash; to help them understand how you operate.
            </div>
          </li>
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">04</span>
            <div className="mw-entry-method-body">
              <span className="mw-entry-soon">(Coming soon)</span> See how your Manual connects with others. Find patterns across relationships. Ask questions about how two Manuals fit together.
            </div>
          </li>
        </ol>
      </section>

      {/* 4. CTA block */}
      <section className="mw-entry-cta-block">
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
