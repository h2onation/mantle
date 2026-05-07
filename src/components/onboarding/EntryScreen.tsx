"use client";

import { PERSONA_NAME } from "@/lib/persona/config";

interface EntryScreenProps {
  onLogin: () => void;
}

// A private manual of how you work. Clear, premium, no costume.
//
// The composition is a single centered column anchored by a sage
// hairline running from masthead to footer. Section markers (roman
// numerals for the five layers, two-digit numerals for the method
// steps) hang in the left margin across that line — the one
// formal gesture, used consistently. Type is carried by Newsreader
// throughout, with Instrument Serif italic for quoted voice and
// monospace reserved for metadata labels.
//
// Six sections, in reading order:
//   1. Masthead — wordmark + Log in
//   2. Hero — headline, subhead, primary CTA
//   3. Entry — a sample Manual entry shown as type
//   4. Five layers — the Manual's surface area
//   5. Method — three numbered steps
//   6. Final CTA + Log in + legal

export default function EntryScreen({ onLogin }: EntryScreenProps) {
  return (
    <main
      className="mw-entry-root scrollable-page"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <style>{`
        .mw-entry-root {
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          background-color: var(--session-linen);
          color: var(--session-ink);
          font-family: var(--font-display), "Newsreader", Georgia, serif;
          /* Design tokens for the landing — scoped so they never leak. */
          --mw-gutter: 20px;                 /* content gutter from viewport edge */
          --mw-rail: 40px;                   /* margin reserved for hanging numerals */
          --mw-column: 560px;                /* max body reading width */
          --mw-canvas: calc(var(--mw-column) + var(--mw-rail));
          --mw-section-pad: 88px;            /* vertical space between sections */
          --mw-meta-size: 10.5px;
          --mw-meta-tracking: 2.4px;
        }

        /* ── Page-wide architecture ─────────────────────────────
           The canvas sits centered. The rail is a thin sage rule
           at the left edge of the content column, spanning the
           whole page vertically. Numerals hang inside the rail,
           aligned right so they sit up against the rule without
           touching it. */
        .mw-entry-canvas {
          max-width: var(--mw-canvas);
          margin: 0 auto;
          padding: 0 var(--mw-gutter);
          position: relative;
        }
        .mw-entry-canvas::before {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: calc(var(--mw-gutter) + var(--mw-rail));
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent 0,
            var(--session-persona-border) 72px,
            var(--session-persona-border) calc(100% - 160px),
            transparent 100%
          );
          pointer-events: none;
        }
        .mw-entry-col {
          margin-left: var(--mw-rail);
          padding-left: 24px;
          box-sizing: border-box;
        }

        /* ── Page-load stagger ─────────────────────────────────── */
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

        /* ── Period accent (sage) ──────────────────────────────── */
        .mw-entry-period { color: var(--session-persona); }

        /* ── 1. Masthead ───────────────────────────────────────── */
        .mw-entry-masthead {
          padding-top: 28px;
          padding-bottom: 72px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
        }
        .mw-entry-wordmark {
          font-family: inherit;
          font-weight: 400;
          font-size: 18px;
          letter-spacing: -0.005em;
          line-height: 1;
          color: var(--session-ink);
          margin: 0;
        }
        .mw-entry-nav-login {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          font: inherit;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: var(--mw-meta-size);
          letter-spacing: var(--mw-meta-tracking);
          text-transform: uppercase;
          color: var(--session-ink-faded);
          cursor: pointer;
          transition: color 200ms ease;
        }
        .mw-entry-nav-login:hover { color: var(--session-ink); }

        /* ── 2. Hero ───────────────────────────────────────────── */
        .mw-entry-hero {
          padding-bottom: var(--mw-section-pad);
        }
        .mw-entry-eyebrow {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: var(--mw-meta-size);
          letter-spacing: var(--mw-meta-tracking);
          text-transform: uppercase;
          color: var(--session-persona);
          margin: 0 0 28px;
        }
        .mw-entry-headline {
          font-family: inherit;
          font-weight: 400;
          font-size: 38px;
          line-height: 1.04;
          letter-spacing: -0.028em;
          color: var(--session-ink);
          margin: 0 0 28px;
          max-width: 16ch;
        }
        .mw-entry-subhead {
          font-family: inherit;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.55;
          color: var(--session-ink-mid);
          margin: 0 0 40px;
          max-width: 38ch;
        }
        .mw-entry-subhead em {
          font-style: italic;
          color: var(--session-ink);
        }

        /* ── Ghost CTA ─────────────────────────────────────────── */
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
          gap: 12px;
          padding: 15px 26px 15px 22px;
          border: 1px solid var(--session-ink);
          border-radius: var(--radius-xs);
          background: transparent;
          transition: background 240ms ease, color 240ms ease,
                      border-color 240ms ease;
          cursor: pointer;
        }
        .mw-entry-cta:hover {
          background: var(--session-ink);
          color: var(--session-cream);
          border-color: var(--session-ink);
        }
        .mw-entry-cta:hover .mw-entry-cta-arrow {
          transform: translateX(5px);
        }
        .mw-entry-cta-arrow {
          font-size: 1em;
          line-height: 1;
          transition: transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1);
        }

        /* ── Section heading ───────────────────────────────────── */
        .mw-entry-section-heading {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: var(--mw-meta-size);
          letter-spacing: var(--mw-meta-tracking);
          text-transform: uppercase;
          color: var(--session-ink-faded);
          margin: 0 0 28px;
        }

        /* ── 3. Sample entry ───────────────────────────────────── */
        .mw-entry-sample {
          padding-bottom: var(--mw-section-pad);
        }
        .mw-entry-sample-label {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: var(--mw-meta-size);
          letter-spacing: var(--mw-meta-tracking);
          text-transform: uppercase;
          color: var(--session-persona);
          margin: 0 0 12px;
        }
        .mw-entry-sample-layer {
          font-family: inherit;
          font-style: italic;
          font-weight: 400;
          font-size: 15px;
          line-height: 1.3;
          color: var(--session-ink-faded);
          margin: 0 0 28px;
        }
        .mw-entry-sample-title {
          font-family: var(--font-serif), "Instrument Serif", Georgia, serif;
          font-style: italic;
          font-weight: 400;
          font-size: 25px;
          line-height: 1.26;
          letter-spacing: -0.008em;
          color: var(--session-ink);
          margin: 0 0 22px;
        }
        .mw-entry-sample-body {
          font-family: inherit;
          font-weight: 400;
          font-size: 17px;
          line-height: 1.58;
          color: var(--session-ink-mid);
          margin: 0;
        }

        /* ── 4. Five layers ────────────────────────────────────── */
        .mw-entry-layers {
          padding-bottom: var(--mw-section-pad);
        }
        .mw-entry-layers-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 18px;
        }
        .mw-entry-layer-item {
          display: grid;
          grid-template-columns: 40px 1fr;
          align-items: baseline;
          gap: 20px;
          color: var(--session-ink);
          font-family: inherit;
        }
        .mw-entry-layer-numeral {
          font-family: var(--font-serif), "Instrument Serif", Georgia, serif;
          font-style: italic;
          font-weight: 400;
          font-size: 20px;
          letter-spacing: 0.02em;
          color: var(--session-persona);
          text-align: right;
          line-height: 1.3;
          /* Pull left so the numeral hangs in the rail margin. */
          margin-left: -64px;
          padding-right: 0;
        }
        .mw-entry-layer-name {
          font-weight: 400;
          font-size: 19px;
          line-height: 1.35;
          letter-spacing: -0.004em;
          /* Lets the is-current underline hug the text instead of
             stretching across the whole grid cell. */
          display: inline-block;
        }
        .mw-entry-layer-item.is-current .mw-entry-layer-name {
          /* The layer shown in the sample entry above gets a quiet
             sage underline — it ties the two sections together
             without announcing itself. */
          text-decoration: underline;
          text-decoration-color: var(--session-persona-border);
          text-decoration-thickness: 1px;
          text-underline-offset: 5px;
        }

        /* ── 5. Method — three numbered steps ───────────────── */
        .mw-entry-method {
          padding-bottom: var(--mw-section-pad);
        }
        .mw-entry-method-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 30px;
        }
        .mw-entry-method-item {
          display: grid;
          grid-template-columns: 40px 1fr;
          align-items: baseline;
          gap: 20px;
        }
        .mw-entry-method-num {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--session-persona);
          text-align: right;
          line-height: 1.6;
          margin-left: -64px;
          /* Lift the mono numeral so it sits on the cap line of the
             first line of prose rather than the baseline. */
          transform: translateY(2px);
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

        /* ── 6. Final CTA + login + footer ──────────────────── */
        .mw-entry-tail {
          padding-top: 8px;
          padding-bottom: calc(48px + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 28px;
        }
        .mw-entry-login-line {
          font-family: inherit;
          font-weight: 400;
          font-size: 15px;
          line-height: 1.5;
          color: var(--session-ink-faded);
          margin: 0;
        }
        .mw-entry-login-inline {
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
        .mw-entry-login-inline:hover {
          color: var(--session-persona);
          text-decoration-color: var(--session-persona);
        }
        .mw-entry-legal {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: var(--mw-meta-size);
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: var(--session-ink-faded);
          margin-top: 32px;
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
          .mw-entry-root {
            --mw-gutter: 48px;
            --mw-rail: 96px;
            --mw-column: 600px;
            --mw-section-pad: 120px;
          }
          .mw-entry-masthead { padding-top: 40px; padding-bottom: 128px; }
          .mw-entry-wordmark { font-size: 20px; }
          .mw-entry-headline {
            font-size: 68px;
            line-height: 1.01;
            letter-spacing: -0.032em;
            margin-bottom: 36px;
            max-width: 14ch;
          }
          .mw-entry-subhead { font-size: 18px; max-width: 42ch; margin-bottom: 48px; }
          .mw-entry-cta { font-size: 16.5px; padding: 16px 28px 16px 24px; }
          .mw-entry-sample-title { font-size: 32px; line-height: 1.22; }
          .mw-entry-sample-body { font-size: 18px; }
          .mw-entry-layers-list { gap: 22px; }
          .mw-entry-layer-numeral { font-size: 24px; margin-left: -88px; }
          .mw-entry-layer-name { font-size: 22px; }
          .mw-entry-method-list { gap: 36px; }
          .mw-entry-method-num { font-size: 11.5px; margin-left: -88px; }
          .mw-entry-method-body { font-size: 18px; }
        }

        /* ── Desktop (≥1024px) ────────────────────────────────── */
        @media (min-width: 1024px) {
          .mw-entry-root {
            --mw-gutter: 64px;
            --mw-rail: 120px;
            --mw-column: 720px;
            --mw-section-pad: 152px;
          }
          .mw-entry-masthead { padding-top: 48px; padding-bottom: 168px; }
          .mw-entry-wordmark { font-size: 22px; }
          .mw-entry-headline {
            font-size: 92px;
            line-height: 1.0;
            letter-spacing: -0.036em;
            margin-bottom: 44px;
            max-width: 13ch;
          }
          .mw-entry-subhead {
            font-size: 20px;
            line-height: 1.56;
            max-width: 46ch;
            margin-bottom: 56px;
          }
          .mw-entry-cta { font-size: 17px; padding: 17px 32px 17px 26px; }
          .mw-entry-sample-title {
            font-size: 38px;
            line-height: 1.16;
            margin-bottom: 28px;
          }
          .mw-entry-sample-body { font-size: 19px; line-height: 1.58; max-width: 46ch; }
          .mw-entry-layers-list { gap: 26px; }
          .mw-entry-layer-numeral { font-size: 28px; margin-left: -112px; }
          .mw-entry-layer-name { font-size: 24px; }
          .mw-entry-method-list { gap: 42px; }
          .mw-entry-method-num { font-size: 12px; margin-left: -112px; }
          .mw-entry-method-body { font-size: 20px; line-height: 1.58; max-width: 46ch; }
        }

        /* ── Wide (≥1440px) — hold composition, don't escalate ── */
        @media (min-width: 1440px) {
          .mw-entry-root {
            --mw-gutter: 80px;
            --mw-rail: 144px;
            --mw-column: 760px;
          }
          .mw-entry-headline { font-size: 104px; }
          .mw-entry-layer-numeral { margin-left: -128px; }
          .mw-entry-method-num { margin-left: -128px; }
        }
      `}</style>

      <div className="mw-entry-canvas">
        {/* 1. Masthead */}
        <header className="mw-entry-masthead mw-rise mw-rise-1">
          <div className="mw-entry-wordmark">
            my walnut<span className="mw-entry-period">.</span>
          </div>
          <button
            type="button"
            onClick={onLogin}
            className="mw-entry-nav-login"
            aria-label="Log in to an existing account"
          >
            Log in
          </button>
        </header>

        {/* Every content block lives inside a column offset from the
            rail. Numerals hang into the rail with negative margins. */}
        <div className="mw-entry-col">
          {/* 2. Hero */}
          <section className="mw-entry-hero">
            <p className="mw-entry-eyebrow mw-rise mw-rise-1">
              mywalnut <span className="mw-entry-period">·</span> a private
              manual
            </p>
            <h1 className="mw-entry-headline mw-rise mw-rise-2">
              A private manual of how you work
              <span className="mw-entry-period">.</span>
            </h1>
            <p className="mw-entry-subhead mw-rise mw-rise-3">
              my walnut is an AI that helps you write one &mdash; through
              conversation. Nothing enters unless you confirm it. Built for
              neurodivergent adults.
            </p>
            <a href="/waitlist" className="mw-entry-cta mw-rise mw-rise-4">
              Join the waitlist
              <span className="mw-entry-cta-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
          </section>

          {/* 3. Sample entry — the product as type */}
          <section
            className="mw-entry-sample"
            aria-label="An example entry from a Manual"
          >
            <div className="mw-entry-sample-label">An entry</div>
            <div className="mw-entry-sample-layer">
              from Layer Two &mdash; How I process things
            </div>
            <p className="mw-entry-sample-title">
              &ldquo;When plans shift without warning, my voice is the first
              thing that goes quiet.&rdquo;
            </p>
            <p className="mw-entry-sample-body">
              Not because I have nothing to say &mdash; but because speech is
              where my regulation leaves.
            </p>
          </section>

          {/* 4. Five layers */}
          <section className="mw-entry-layers">
            <h2 className="mw-entry-section-heading">
              Your Manual, in five layers
            </h2>
            <ul className="mw-entry-layers-list">
              <li className="mw-entry-layer-item">
                <span className="mw-entry-layer-numeral" aria-hidden="true">
                  I
                </span>
                <span className="mw-entry-layer-name">Some of my patterns</span>
              </li>
              <li className="mw-entry-layer-item is-current">
                <span className="mw-entry-layer-numeral" aria-hidden="true">
                  II
                </span>
                <span className="mw-entry-layer-name">How I process things</span>
              </li>
              <li className="mw-entry-layer-item">
                <span className="mw-entry-layer-numeral" aria-hidden="true">
                  III
                </span>
                <span className="mw-entry-layer-name">What helps</span>
              </li>
              <li className="mw-entry-layer-item">
                <span className="mw-entry-layer-numeral" aria-hidden="true">
                  IV
                </span>
                <span className="mw-entry-layer-name">
                  How I show up with people
                </span>
              </li>
              <li className="mw-entry-layer-item">
                <span className="mw-entry-layer-numeral" aria-hidden="true">
                  V
                </span>
                <span className="mw-entry-layer-name">
                  Where I&rsquo;m strong
                </span>
              </li>
            </ul>
          </section>

          {/* 5. Method */}
          <section className="mw-entry-method">
            <h2 className="mw-entry-section-heading">How it works</h2>
            <ol className="mw-entry-method-list">
              <li className="mw-entry-method-item">
                <span className="mw-entry-method-num" aria-hidden="true">
                  01
                </span>
                <div className="mw-entry-method-body">
                  <strong>
                    Talk to {PERSONA_NAME} about things on your mind.
                  </strong>{" "}
                  Conversations, situations, patterns you keep noticing.
                </div>
              </li>
              <li className="mw-entry-method-item">
                <span className="mw-entry-method-num" aria-hidden="true">
                  02
                </span>
                <div className="mw-entry-method-body">
                  <strong>
                    {PERSONA_NAME} proposes patterns it sees. You confirm
                    what&rsquo;s true.
                  </strong>{" "}
                  Nothing gets written without your explicit confirmation.
                </div>
              </li>
              <li className="mw-entry-method-item">
                <span className="mw-entry-method-num" aria-hidden="true">
                  03
                </span>
                <div className="mw-entry-method-body">
                  <strong>The patterns become your Manual.</strong> Yours to
                  keep, revise, or share with the people you trust.
                </div>
              </li>
            </ol>
          </section>

          {/* 6. Final CTA + login + footer */}
          <section className="mw-entry-tail">
            <a href="/waitlist" className="mw-entry-cta">
              Join the waitlist
              <span className="mw-entry-cta-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
            <p className="mw-entry-login-line">
              Already have access?{" "}
              <button
                type="button"
                onClick={onLogin}
                className="mw-entry-login-inline"
              >
                Log in.
              </button>
            </p>
            <div className="mw-entry-legal">
              <a href="/privacy">Privacy</a>
              <span className="mw-entry-legal-sep">&middot;</span>
              <a href="/terms">Terms</a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
