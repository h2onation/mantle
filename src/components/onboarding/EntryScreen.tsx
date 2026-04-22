"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PERSONA_NAME } from "@/lib/persona/config";

// Ten first-person sentences the visitor might recognize themselves in.
// These are thesis sentences, not feature copy. They rotate slowly in
// the hero (6.5s dwell, 520ms crossfade) — long enough that each reads
// like a photograph, short enough that someone sees three or four
// before they scroll.
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

// Paper surface — subtle noise + corner vignette. The landing is the
// one screen that earns real texture.
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
    }, 520);
  }, []);

  useEffect(() => {
    const interval = setInterval(advance, 6500);
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
      {/* Editorial landing. Seven sections, composed like a thin
          publication: masthead → hero (headline + rotating specimen)
          → atmospheric band → method chapters → pull-quote →
          editorial CTA → colophon. Everything centered, generous
          vertical rhythm, no filled buttons, no tech-demo grammar. */}
      <style>{`
        .mw-entry-root {
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          font-family: var(--font-display), "Newsreader", Georgia, serif;
          color: var(--session-ink);
          --mw-entry-max: 1120px;
          --mw-entry-hero-max: 1320px;
          --mw-entry-hairline: rgba(26, 22, 20, 0.14);
          --mw-entry-hairline-soft: rgba(26, 22, 20, 0.08);
        }

        /* ── Animations ────────────────────────────────────────── */
        @keyframes mwEntryFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mwEntryFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mwEntryRuleDraw {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mw-entry-root *,
          .mw-entry-root *::before,
          .mw-entry-root *::after {
            animation-duration: 0ms !important;
            animation-delay: 0ms !important;
            transition-duration: 0ms !important;
          }
          .mw-entry-masthead-rule { transform: scaleX(1) !important; }
        }

        /* ── 1. Masthead ───────────────────────────────────────── */
        .mw-entry-masthead {
          padding: 32px 28px 0;
          box-sizing: border-box;
        }
        .mw-entry-masthead-inner {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
        }
        .mw-entry-wordmark {
          font-family: inherit;
          margin: 0;
          font-weight: 400;
          font-size: 22px;
          letter-spacing: -0.01em;
          color: var(--session-ink);
          line-height: 1;
          animation: mwEntryFadeIn 600ms ease-out both;
        }
        .mw-entry-period { color: var(--session-persona); }
        .mw-entry-paratext {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 400;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: var(--session-ink-faded);
          line-height: 1.7;
          animation: mwEntryFadeIn 600ms ease-out 160ms both;
        }
        .mw-entry-masthead-rule {
          max-width: var(--mw-entry-max);
          margin: 28px auto 0;
          height: 1px;
          background: var(--mw-entry-hairline);
          transform: scaleX(0);
          transform-origin: left center;
          animation: mwEntryRuleDraw 520ms cubic-bezier(0.25, 1, 0.35, 1) 320ms both;
        }

        /* ── 2. Hero ───────────────────────────────────────────── */
        .mw-entry-hero {
          padding: 96px 28px 112px;
          box-sizing: border-box;
        }
        .mw-entry-hero-inner {
          max-width: var(--mw-entry-hero-max);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .mw-entry-headline {
          font-family: inherit;
          margin: 0;
          font-weight: 300;
          font-size: 48px;
          line-height: 1.02;
          letter-spacing: -0.024em;
          color: var(--session-ink);
          animation: mwEntryFadeUp 780ms ease-out 520ms both;
        }
        .mw-entry-specimen {
          margin-top: 64px;
          min-height: 90px;
          max-width: 640px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          animation: mwEntryFadeIn 820ms ease-out 980ms both;
        }
        .mw-entry-specimen-line {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 21px;
          line-height: 1.5;
          color: var(--session-ink-mid);
          transition: opacity 520ms ease;
          position: relative;
          padding-left: 16px;
        }
        .mw-entry-specimen-line::before {
          content: "·";
          position: absolute;
          left: 0;
          top: -0.06em;
          color: var(--session-persona);
          font-weight: 400;
          font-size: 1.1em;
          line-height: 1;
        }

        /* ── 3. Atmospheric band ──────────────────────────────── */
        .mw-entry-atmos {
          width: 100%;
          height: 200px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg,
            #e6d0ab 0%, #d9bf94 45%, #c8a97a 100%);
          animation: mwEntryFadeIn 900ms ease-out 1200ms both;
        }
        .mw-entry-atmos-img {
          position: absolute;
          inset: 0;
          background-image: url(/images/hero-sand.jpg);
          background-size: cover;
          background-position: center 60%;
          background-repeat: no-repeat;
          -webkit-mask-image: linear-gradient(180deg,
            transparent 0%,
            rgba(0, 0, 0, 0.92) 14%,
            rgba(0, 0, 0, 0.92) 86%,
            transparent 100%);
          mask-image: linear-gradient(180deg,
            transparent 0%,
            rgba(0, 0, 0, 0.92) 14%,
            rgba(0, 0, 0, 0.92) 86%,
            transparent 100%);
        }
        .mw-entry-atmos-grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.14;
          mix-blend-mode: multiply;
          background-image: radial-gradient(
            rgba(26, 22, 20, 0.6) 1px, transparent 1px);
          background-size: 3px 3px;
        }

        /* ── 4. Method — chapters ─────────────────────────────── */
        .mw-entry-method {
          padding: 88px 28px 96px;
          box-sizing: border-box;
        }
        .mw-entry-method-inner {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
        }
        .mw-entry-method-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .mw-entry-method-item {
          display: block;
          padding: 52px 0;
          border-top: 1px solid var(--mw-entry-hairline-soft);
        }
        .mw-entry-method-item:last-child {
          border-bottom: 1px solid var(--mw-entry-hairline-soft);
        }
        .mw-entry-method-num {
          font-family: inherit;
          font-style: italic;
          font-weight: 300;
          font-size: 19px;
          color: var(--session-persona);
          line-height: 1;
          margin-bottom: 10px;
        }
        .mw-entry-method-micro {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 21px;
          color: var(--session-ink);
          letter-spacing: -0.008em;
          margin-bottom: 18px;
          line-height: 1.2;
        }
        .mw-entry-method-body {
          font-family: inherit;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.62;
          color: var(--session-ink-mid);
          max-width: 680px;
        }

        /* ── 5. Pull-quote ────────────────────────────────────── */
        .mw-entry-quote {
          padding: 112px 28px;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          text-align: center;
        }
        .mw-entry-quote-text {
          font-family: inherit;
          font-style: italic;
          font-weight: 300;
          font-size: 30px;
          line-height: 1.26;
          letter-spacing: -0.012em;
          color: var(--session-ink);
          margin: 0;
          max-width: 900px;
        }
        .mw-entry-quote-break { display: block; }

        /* ── 6. CTA ───────────────────────────────────────────── */
        .mw-entry-cta-block {
          padding: 72px 28px 96px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 28px;
        }
        .mw-entry-cta-intro {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.5;
          color: var(--session-ink-faded);
          margin: 0;
        }
        .mw-entry-cta {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 30px;
          line-height: 1.1;
          letter-spacing: -0.015em;
          color: var(--session-ink);
          text-decoration: none;
          display: inline-flex;
          align-items: baseline;
          gap: 14px;
          transition: color 280ms ease;
        }
        .mw-entry-cta-arrow {
          font-style: normal;
          font-size: 0.78em;
          color: var(--session-persona);
          transition: transform 280ms cubic-bezier(0.2, 0.9, 0.3, 1);
          line-height: 1;
        }
        .mw-entry-cta:hover { color: var(--session-persona); }
        .mw-entry-cta:hover .mw-entry-cta-arrow {
          transform: translateX(8px);
        }
        .mw-entry-cta:focus-visible .mw-entry-cta-arrow {
          transform: translateX(4px);
        }
        .mw-entry-login-line {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 15px;
          line-height: 1.5;
          color: var(--session-ink-faded);
          margin: 0;
        }
        .mw-entry-login {
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          color: var(--session-ink);
          cursor: pointer;
          text-decoration: underline;
          text-decoration-color: var(--session-ink-whisper);
          text-underline-offset: 4px;
          text-decoration-thickness: 1px;
          transition: text-decoration-color 200ms ease, color 200ms ease;
        }
        .mw-entry-login:hover {
          color: var(--session-persona);
          text-decoration-color: var(--session-persona);
        }

        /* ── 7. Footer colophon ───────────────────────────────── */
        .mw-entry-footer {
          border-top: 1px solid var(--mw-entry-hairline-soft);
          padding: 56px 28px calc(40px + env(safe-area-inset-bottom, 0px));
          box-sizing: border-box;
          text-align: center;
        }
        .mw-entry-footer-inner {
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
        }
        .mw-entry-fleuron {
          font-family: inherit;
          font-size: 22px;
          color: var(--session-persona);
          line-height: 1;
        }
        .mw-entry-colophon {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--session-ink-faded);
          margin: 0;
          max-width: 520px;
        }
        .mw-entry-legal {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: var(--session-ink-faded);
        }
        .mw-entry-legal a {
          color: inherit;
          text-decoration: none;
          transition: color 200ms ease;
        }
        .mw-entry-legal a:hover { color: var(--session-ink); }
        .mw-entry-legal-sep { color: var(--session-ink-whisper); }

        /* ── Tablet (≥768px) ──────────────────────────────────── */
        @media (min-width: 768px) {
          .mw-entry-masthead { padding: 44px 48px 0; }
          .mw-entry-wordmark { font-size: 28px; }
          .mw-entry-paratext { font-size: 10px; letter-spacing: 2.6px; }
          .mw-entry-masthead-rule { margin-top: 32px; }
          .mw-entry-hero { padding: 128px 48px 136px; }
          .mw-entry-headline {
            font-size: 80px;
            letter-spacing: -0.028em;
          }
          .mw-entry-specimen { margin-top: 76px; min-height: 96px; }
          .mw-entry-specimen-line { font-size: 23px; line-height: 1.5; }
          .mw-entry-atmos { height: 260px; }
          .mw-entry-method { padding: 112px 48px 120px; }
          .mw-entry-method-item { padding: 64px 0; }
          .mw-entry-method-num { font-size: 21px; }
          .mw-entry-method-micro { font-size: 24px; margin-bottom: 22px; }
          .mw-entry-method-body { font-size: 18px; line-height: 1.64; }
          .mw-entry-quote { padding: 144px 48px; }
          .mw-entry-quote-text { font-size: 40px; line-height: 1.22; }
          .mw-entry-cta-block { padding: 96px 48px 120px; gap: 32px; }
          .mw-entry-cta { font-size: 36px; gap: 16px; }
          .mw-entry-cta-intro { font-size: 18px; }
          .mw-entry-footer {
            padding: 64px 48px calc(56px + env(safe-area-inset-bottom, 0px));
          }
          .mw-entry-colophon { font-size: 14px; }
        }

        /* ── Desktop (≥1024px) ────────────────────────────────── */
        @media (min-width: 1024px) {
          .mw-entry-masthead { padding: 52px 64px 0; }
          .mw-entry-masthead-inner {
            flex-direction: row;
            align-items: baseline;
            justify-content: space-between;
            text-align: left;
            gap: 48px;
          }
          .mw-entry-wordmark { font-size: 36px; }
          .mw-entry-paratext {
            font-size: 10.5px;
            letter-spacing: 2.8px;
            text-align: right;
            max-width: 420px;
          }
          .mw-entry-masthead-rule { margin-top: 40px; }
          .mw-entry-hero { padding: 176px 64px 184px; }
          .mw-entry-headline {
            font-size: 108px;
            letter-spacing: -0.035em;
            line-height: 1.0;
          }
          .mw-entry-specimen { margin-top: 92px; min-height: 104px; }
          .mw-entry-specimen-line { font-size: 25px; line-height: 1.5; }
          .mw-entry-atmos { height: 360px; }
          .mw-entry-method { padding: 160px 64px 160px; }
          .mw-entry-method-list { padding-left: 120px; }
          .mw-entry-method-item {
            position: relative;
            padding: 80px 0;
          }
          .mw-entry-method-num {
            font-size: 22px;
            position: absolute;
            left: -120px;
            top: 80px;
            margin: 0;
          }
          .mw-entry-method-micro { font-size: 28px; margin-bottom: 24px; }
          .mw-entry-method-body {
            font-size: 19px;
            line-height: 1.68;
            max-width: 720px;
          }
          .mw-entry-quote { padding: 176px 64px; }
          .mw-entry-quote-text {
            font-size: 54px;
            line-height: 1.18;
            letter-spacing: -0.02em;
          }
          .mw-entry-cta-block { padding: 128px 64px 152px; gap: 40px; }
          .mw-entry-cta { font-size: 48px; gap: 20px; letter-spacing: -0.02em; }
          .mw-entry-cta-intro { font-size: 19px; }
          .mw-entry-login-line { font-size: 16px; }
          .mw-entry-footer {
            padding: 80px 64px calc(64px + env(safe-area-inset-bottom, 0px));
          }
          .mw-entry-colophon { font-size: 14.5px; }
          .mw-entry-legal {
            font-size: 11px;
            letter-spacing: 2px;
          }
        }

        /* ── Wide desktop (≥1440px) ──────────────────────────── */
        @media (min-width: 1440px) {
          .mw-entry-headline { font-size: 136px; }
          .mw-entry-quote-text { font-size: 64px; }
          .mw-entry-cta { font-size: 56px; }
        }
      `}</style>

      {/* 1. Masthead — wordmark + two-line editorial paratext */}
      <header className="mw-entry-masthead">
        <div className="mw-entry-masthead-inner">
          <h1 className="mw-entry-wordmark">
            my walnut<span className="mw-entry-period">.</span>
          </h1>
          <div className="mw-entry-paratext" aria-label="Publication information">
            Issue One · Spring 2026
            <br />
            A manual for neurodivergent adults
          </div>
        </div>
        <div className="mw-entry-masthead-rule" aria-hidden="true" />
      </header>

      {/* 2. Hero — headline + rotating thesis sentence */}
      <section className="mw-entry-hero">
        <div className="mw-entry-hero-inner">
          <h2 className="mw-entry-headline">
            A more complete manual
            <br />
            of how your mind
            <br />
            works<span className="mw-entry-period">.</span>
          </h2>

          <div
            className="mw-entry-specimen"
            aria-live="polite"
            aria-atomic="true"
          >
            <div
              className="mw-entry-specimen-line"
              style={{ opacity: visible ? 1 : 0 }}
            >
              {ROTATING_EXAMPLES[activeIndex]}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Atmospheric band — sand-ripples editorial break */}
      <div className="mw-entry-atmos" aria-hidden="true">
        <div className="mw-entry-atmos-img" />
        <div className="mw-entry-atmos-grain" />
      </div>

      {/* 4. Method — four chapters. Roman numerals in the left
          margin on desktop; italic chapter titles above each body. */}
      <section className="mw-entry-method">
        <div className="mw-entry-method-inner">
          <ol className="mw-entry-method-list">
            <li className="mw-entry-method-item">
              <div className="mw-entry-method-num">i.</div>
              <div className="mw-entry-method-micro">On bringing</div>
              <div className="mw-entry-method-body">
                You bring a situation that is on your mind &mdash; a conflict, a reaction, a pattern you keep noticing. Talking it through with {PERSONA_NAME} helps you organize what you&rsquo;re processing.
              </div>
            </li>
            <li className="mw-entry-method-item">
              <div className="mw-entry-method-num">ii.</div>
              <div className="mw-entry-method-micro">On listening</div>
              <div className="mw-entry-method-body">
                Underneath the conversation, {PERSONA_NAME} is building a model of how you operate &mdash; from your patterns, your language, and what you return to. When it sees something worth naming, it proposes an entry for your Manual. You decide what&rsquo;s true.
              </div>
            </li>
            <li className="mw-entry-method-item">
              <div className="mw-entry-method-num">iii.</div>
              <div className="mw-entry-method-micro">On composing</div>
              <div className="mw-entry-method-body">
                Over time, your Manual becomes a more complete picture of how you work. Share parts of it with the people in your life on your terms &mdash; your partner, your therapist, your manager &mdash; to help them understand how you operate.
              </div>
            </li>
            <li className="mw-entry-method-item">
              <div className="mw-entry-method-num">iv.</div>
              <div className="mw-entry-method-micro">On sharing</div>
              <div className="mw-entry-method-body">
                See how your Manual connects with others. Find patterns across relationships. Ask questions about how two Manuals fit together.
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* 5. Pull-quote — the product's promise, floating centered */}
      <section className="mw-entry-quote">
        <blockquote className="mw-entry-quote-text">
          Nothing enters the manual
          <span className="mw-entry-quote-break" />
          unless you confirm it<span className="mw-entry-period">.</span>
        </blockquote>
      </section>

      {/* 6. CTA — text-only, editorial. No filled plate. */}
      <section className="mw-entry-cta-block">
        <p className="mw-entry-cta-intro">A manual waits to be written.</p>
        <a href="/waitlist" className="mw-entry-cta">
          Join the waitlist
          <span className="mw-entry-cta-arrow" aria-hidden="true">
            &rarr;
          </span>
        </a>
        <p className="mw-entry-login-line">
          Already have access?{" "}
          <button type="button" onClick={onLogin} className="mw-entry-login">
            Log in.
          </button>
        </p>
      </section>

      {/* 7. Footer — fleuron + italic colophon + mono-caps legal */}
      <footer className="mw-entry-footer">
        <div className="mw-entry-footer-inner">
          <div className="mw-entry-fleuron" aria-hidden="true">
            ❦
          </div>
          <p className="mw-entry-colophon">
            Set in Newsreader. Printed on linen. Assembled in conversation.
          </p>
          <div className="mw-entry-legal">
            <a href="/privacy">Privacy</a>
            <span className="mw-entry-legal-sep">·</span>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
