"use client";

import { useEffect } from "react";
import { PERSONA_NAME } from "@/lib/persona/config";

interface EntryScreenProps {
  onLogin: () => void;
}

// Clear, confident landing. No costume, no rotating anything, no
// editorial-pastiche paratext. Seven vertical moments:
//
//   1. Wordmark (small, top-left)
//   2. Hero — one headline, one subhead, one CTA. Centered.
//   3. Sample Manual entry — the product as type
//   4. How it works — three short steps
//   5. The five Manual layers — so the viewer sees the surface area
//   6. Final CTA + login
//   7. Legal
//
// Typography carries the whole thing. Linen background, ink text,
// sage accent for the period marks and step numerals only. No
// texture, no fleurons, no pull-quote, no photograph.

export default function EntryScreen({ onLogin }: EntryScreenProps) {
  // Effect kept as a no-op for future extension hooks. The landing
  // is deliberately inert — no rotation, no scroll triggers.
  useEffect(() => {}, []);

  return (
    <main
      className="mw-entry-root scrollable-page"
      style={{
        backgroundColor: "var(--session-linen)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <style>{`
        .mw-entry-root {
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          font-family: var(--font-display), "Newsreader", Georgia, serif;
          color: var(--session-ink);
          --mw-entry-max: 1040px;
          --mw-entry-reading-max: 620px;
        }

        /* ── Page-load fade ────────────────────────────────────── */
        @keyframes mwEntryFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mw-entry-root *,
          .mw-entry-root *::before,
          .mw-entry-root *::after {
            animation-duration: 0ms !important;
            animation-delay: 0ms !important;
            transition-duration: 0ms !important;
          }
        }

        /* ── 1. Wordmark (top-left) ────────────────────────────── */
        .mw-entry-masthead {
          padding: 32px 28px 0;
          box-sizing: border-box;
          max-width: var(--mw-entry-max);
          margin: 0 auto;
        }
        .mw-entry-wordmark {
          font-family: inherit;
          margin: 0;
          font-weight: 400;
          font-size: 19px;
          letter-spacing: -0.005em;
          color: var(--session-ink);
          line-height: 1;
        }
        .mw-entry-period { color: var(--session-persona); }

        /* ── 2. Hero ───────────────────────────────────────────── */
        .mw-entry-hero {
          padding: 88px 28px 96px;
          box-sizing: border-box;
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .mw-entry-headline {
          font-family: inherit;
          margin: 0 0 28px;
          font-weight: 400;
          font-size: 40px;
          line-height: 1.08;
          letter-spacing: -0.024em;
          color: var(--session-ink);
          animation: mwEntryFadeUp 640ms ease-out 120ms both;
          max-width: 18ch;
        }
        .mw-entry-subhead {
          font-family: inherit;
          margin: 0 0 40px;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.55;
          color: var(--session-ink-mid);
          max-width: 540px;
          animation: mwEntryFadeUp 640ms ease-out 260ms both;
        }
        .mw-entry-subhead em {
          font-style: italic;
          color: var(--session-ink);
        }

        /* ── CTA (shared, text-link with nudging arrow) ────────── */
        .mw-entry-cta {
          font-family: inherit;
          font-weight: 500;
          font-size: 16px;
          line-height: 1;
          letter-spacing: -0.005em;
          color: var(--session-ink);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 24px;
          border: 1px solid var(--session-ink);
          border-radius: 2px;
          transition: background 240ms ease, color 240ms ease,
                      border-color 240ms ease;
          animation: mwEntryFadeUp 640ms ease-out 400ms both;
        }
        .mw-entry-cta:hover {
          background: var(--session-ink);
          color: var(--session-cream);
          border-color: var(--session-ink);
        }
        .mw-entry-cta:hover .mw-entry-cta-arrow {
          transform: translateX(4px);
        }
        .mw-entry-cta-arrow {
          font-size: 1em;
          line-height: 1;
          transition: transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1);
        }

        /* ── 3. Sample Manual entry ────────────────────────────── */
        .mw-entry-sample {
          padding: 24px 28px 96px;
          box-sizing: border-box;
          max-width: var(--mw-entry-reading-max);
          margin: 0 auto;
          padding-left: calc(28px + 20px);
          border-left: none;
          position: relative;
        }
        .mw-entry-sample::before {
          content: "";
          position: absolute;
          left: 28px;
          top: 24px;
          bottom: 96px;
          width: 2px;
          background: var(--session-persona-soft);
        }
        .mw-entry-sample-kicker {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--session-persona);
          margin-bottom: 20px;
        }
        .mw-entry-sample-title {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 22px;
          line-height: 1.32;
          letter-spacing: -0.008em;
          color: var(--session-ink);
          margin: 0 0 20px;
        }
        .mw-entry-sample-body {
          font-family: inherit;
          font-weight: 400;
          font-size: 16px;
          line-height: 1.58;
          color: var(--session-ink-mid);
          margin: 0;
        }

        /* ── 4. How it works ────────────────────────────────── */
        .mw-entry-method {
          padding: 24px 28px 96px;
          box-sizing: border-box;
          max-width: var(--mw-entry-reading-max);
          margin: 0 auto;
        }
        .mw-entry-method-heading {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--session-ink-faded);
          margin: 0 0 28px;
        }
        .mw-entry-method-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 28px;
        }
        .mw-entry-method-item {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 16px;
          align-items: baseline;
        }
        .mw-entry-method-num {
          font-family: inherit;
          font-style: italic;
          font-weight: 300;
          font-size: 20px;
          color: var(--session-persona);
          line-height: 1.2;
        }
        .mw-entry-method-body {
          font-family: inherit;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.58;
          color: var(--session-ink-mid);
        }
        .mw-entry-method-body strong {
          font-weight: 500;
          color: var(--session-ink);
        }

        /* ── 5. The five layers ────────────────────────────────── */
        .mw-entry-layers {
          padding: 24px 28px 112px;
          box-sizing: border-box;
          max-width: var(--mw-entry-reading-max);
          margin: 0 auto;
        }
        .mw-entry-layers-heading {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--session-ink-faded);
          margin: 0 0 28px;
        }
        .mw-entry-layers-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 14px;
        }
        .mw-entry-layers-item {
          font-family: inherit;
          font-weight: 400;
          font-size: 19px;
          line-height: 1.4;
          color: var(--session-ink);
          letter-spacing: -0.005em;
        }

        /* ── 6. Final CTA ──────────────────────────────────────── */
        .mw-entry-final-cta {
          padding: 24px 28px 96px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .mw-entry-login-line {
          font-family: inherit;
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

        /* ── 7. Footer ─────────────────────────────────────────── */
        .mw-entry-footer {
          padding: 32px 28px calc(40px + env(safe-area-inset-bottom, 0px));
          box-sizing: border-box;
          max-width: var(--mw-entry-max);
          margin: 0 auto;
          text-align: center;
        }
        .mw-entry-legal {
          display: inline-flex;
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
          .mw-entry-masthead { padding: 40px 48px 0; }
          .mw-entry-wordmark { font-size: 22px; }
          .mw-entry-hero { padding: 128px 48px 120px; }
          .mw-entry-headline { font-size: 64px; letter-spacing: -0.03em; margin-bottom: 32px; }
          .mw-entry-subhead { font-size: 18px; margin-bottom: 44px; max-width: 620px; }
          .mw-entry-cta { font-size: 16.5px; padding: 15px 28px; }
          .mw-entry-sample { padding: 24px 48px 112px; padding-left: calc(48px + 24px); }
          .mw-entry-sample::before { left: 48px; top: 24px; bottom: 112px; }
          .mw-entry-sample-title { font-size: 26px; line-height: 1.3; }
          .mw-entry-sample-body { font-size: 17px; }
          .mw-entry-method { padding: 24px 48px 112px; }
          .mw-entry-method-list { gap: 32px; }
          .mw-entry-method-item { grid-template-columns: 36px 1fr; gap: 18px; }
          .mw-entry-method-num { font-size: 22px; }
          .mw-entry-method-body { font-size: 18px; }
          .mw-entry-layers { padding: 24px 48px 128px; }
          .mw-entry-layers-list { gap: 16px; }
          .mw-entry-layers-item { font-size: 21px; }
          .mw-entry-final-cta { padding: 24px 48px 112px; gap: 28px; }
          .mw-entry-footer {
            padding: 40px 48px calc(48px + env(safe-area-inset-bottom, 0px));
          }
        }

        /* ── Desktop (≥1024px) ────────────────────────────────── */
        @media (min-width: 1024px) {
          .mw-entry-masthead { padding: 48px 64px 0; }
          .mw-entry-wordmark { font-size: 24px; }
          .mw-entry-hero { padding: 160px 64px 144px; }
          .mw-entry-headline {
            font-size: 88px;
            letter-spacing: -0.032em;
            margin-bottom: 36px;
            line-height: 1.04;
          }
          .mw-entry-subhead {
            font-size: 19px;
            line-height: 1.6;
            margin-bottom: 52px;
            max-width: 640px;
          }
          .mw-entry-cta { font-size: 17px; padding: 16px 32px; }
          .mw-entry-sample { padding: 40px 64px 128px; padding-left: calc(64px + 28px); }
          .mw-entry-sample::before { left: 64px; top: 40px; bottom: 128px; }
          .mw-entry-sample-title {
            font-size: 30px;
            line-height: 1.28;
            margin-bottom: 24px;
          }
          .mw-entry-sample-body { font-size: 18px; line-height: 1.62; }
          .mw-entry-method { padding: 40px 64px 128px; }
          .mw-entry-method-list { gap: 36px; }
          .mw-entry-method-item { grid-template-columns: 40px 1fr; gap: 24px; }
          .mw-entry-method-num { font-size: 23px; }
          .mw-entry-method-body { font-size: 19px; line-height: 1.62; }
          .mw-entry-layers { padding: 40px 64px 144px; }
          .mw-entry-layers-list { gap: 18px; }
          .mw-entry-layers-item { font-size: 23px; }
          .mw-entry-final-cta { padding: 40px 64px 128px; gap: 32px; }
          .mw-entry-footer {
            padding: 48px 64px calc(56px + env(safe-area-inset-bottom, 0px));
          }
        }

        /* ── Wide (≥1440px) — holds scale, doesn't escalate ──── */
        @media (min-width: 1440px) {
          .mw-entry-headline { font-size: 96px; }
        }
      `}</style>

      {/* 1. Wordmark */}
      <header className="mw-entry-masthead">
        <div className="mw-entry-wordmark">
          my walnut<span className="mw-entry-period">.</span>
        </div>
      </header>

      {/* 2. Hero — one headline, one subhead, one CTA */}
      <section className="mw-entry-hero">
        <h1 className="mw-entry-headline">
          A private manual of how you work<span className="mw-entry-period">.</span>
        </h1>
        <p className="mw-entry-subhead">
          my walnut is an AI that helps you write one &mdash; through conversation.
          Nothing enters unless you confirm it. Built for neurodivergent adults.
        </p>
        <a href="/waitlist" className="mw-entry-cta">
          Join the waitlist
          <span className="mw-entry-cta-arrow" aria-hidden="true">
            &rarr;
          </span>
        </a>
      </section>

      {/* 3. Sample Manual entry — the product, as type */}
      <section
        className="mw-entry-sample"
        aria-label="An example entry from a Manual"
      >
        <div className="mw-entry-sample-kicker">How I process things</div>
        <p className="mw-entry-sample-title">
          &ldquo;When plans shift without warning, my voice is the first thing
          that goes quiet.&rdquo;
        </p>
        <p className="mw-entry-sample-body">
          Not because I have nothing to say &mdash; but because speech is where
          my regulation leaves.
        </p>
      </section>

      {/* 4. How it works — three plain steps */}
      <section className="mw-entry-method">
        <h2 className="mw-entry-method-heading">How it works</h2>
        <ol className="mw-entry-method-list">
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">1</span>
            <div className="mw-entry-method-body">
              <strong>Talk to {PERSONA_NAME} about things on your mind.</strong>{" "}
              Conversations, situations, patterns you keep noticing.
            </div>
          </li>
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">2</span>
            <div className="mw-entry-method-body">
              <strong>
                {PERSONA_NAME} proposes patterns it sees. You confirm what&rsquo;s true.
              </strong>{" "}
              Nothing gets written without your explicit confirmation.
            </div>
          </li>
          <li className="mw-entry-method-item">
            <span className="mw-entry-method-num">3</span>
            <div className="mw-entry-method-body">
              <strong>The patterns become your Manual.</strong> Yours to keep,
              revise, or share with the people you trust.
            </div>
          </li>
        </ol>
      </section>

      {/* 5. The five layers of a Manual */}
      <section className="mw-entry-layers">
        <h2 className="mw-entry-layers-heading">Your Manual, in five layers</h2>
        <ul className="mw-entry-layers-list">
          <li className="mw-entry-layers-item">Some of my patterns</li>
          <li className="mw-entry-layers-item">How I process things</li>
          <li className="mw-entry-layers-item">What helps</li>
          <li className="mw-entry-layers-item">How I show up with people</li>
          <li className="mw-entry-layers-item">Where I&rsquo;m strong</li>
        </ul>
      </section>

      {/* 6. Final CTA */}
      <section className="mw-entry-final-cta">
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

      {/* 7. Legal */}
      <footer className="mw-entry-footer">
        <div className="mw-entry-legal">
          <a href="/privacy">Privacy</a>
          <span className="mw-entry-legal-sep">&middot;</span>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </main>
  );
}
