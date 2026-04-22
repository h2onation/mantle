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

// Parchment + noise + corner vignette. Same paper surface used inside the
// phone frame for the rest of the app, applied here at full viewport so
// the landing page reads as paper at any width.
const PAPER_BACKGROUND = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"), radial-gradient(ellipse at center, transparent 50%, rgba(26, 22, 20, 0.04) 100%)`;

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
      className="mw-entry-root"
      style={{
        backgroundColor: "var(--session-linen)",
        backgroundImage: PAPER_BACKGROUND,
        backgroundSize: "256px 256px, 100% 100%",
        backgroundRepeat: "repeat, no-repeat",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Component-scoped responsive rules. Mobile-first; tablet at 768px,
          desktop at 1024px. The desktop column caps at 880px per the
          reading-column convention used elsewhere in the design system. */}
      <style>{`
        .mw-entry-root {
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          font-family: var(--font-serif);
        }
        .mw-entry-wordmark {
          padding: 16px 0;
          text-align: center;
          font-family: var(--font-serif);
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 1.5px;
          color: var(--session-ink-faded);
        }
        .mw-entry-column {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          padding: 24px 28px 40px;
          box-sizing: border-box;
          flex: 1 0 auto;
          display: flex;
          flex-direction: column;
        }
        .mw-entry-headline {
          font-family: var(--font-serif);
          font-size: 42px;
          font-weight: 400;
          line-height: 1.1;
          letter-spacing: -0.5px;
          color: var(--session-ink);
          margin: 0 0 14px 0;
        }
        .mw-entry-subhead {
          font-family: var(--font-serif);
          font-size: 18px;
          font-weight: 400;
          line-height: 1.4;
          color: var(--session-ink-mid);
          margin: 0 0 24px 0;
        }
        .mw-entry-examples {
          font-family: var(--font-serif);
          font-size: 16px;
          font-weight: 400;
          font-style: italic;
          line-height: 1.45;
          color: var(--session-ink-mid);
          min-height: 92px;
          margin: 0 0 48px 0;
          transition: opacity 400ms ease;
        }
        .mw-entry-explainer-heading {
          font-family: var(--font-serif);
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          color: var(--session-ink-faded);
          margin: 0 0 22px 0;
        }
        .mw-entry-list {
          list-style: none;
          padding: 0;
          margin: 0 0 48px 0;
        }
        .mw-entry-list-item {
          display: flex;
          gap: 14px;
          margin-bottom: 22px;
          font-family: var(--font-serif);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.55;
          color: var(--session-ink-mid);
        }
        .mw-entry-list-item:last-child { margin-bottom: 0; }
        .mw-entry-list-number {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.4px;
          color: var(--session-ink-faded);
          flex-shrink: 0;
          min-width: 18px;
          padding-top: 3px;
        }
        .mw-entry-list-body { flex: 1; }
        .mw-entry-soon {
          font-style: italic;
          color: var(--session-ink-faded);
        }
        .mw-entry-beta {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.3px;
          color: var(--session-ink-faded);
          text-align: center;
          margin: 0 0 14px 0;
        }
        .mw-entry-cta-wrap { margin-bottom: 14px; }
        .mw-entry-cta {
          display: block;
          width: 100%;
          padding: 16px 0;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 500;
          color: var(--session-cream);
          background-color: var(--session-persona);
          border: none;
          border-radius: 6px;
          text-decoration: none;
          text-align: center;
          box-sizing: border-box;
          cursor: pointer;
          transition: background-color 180ms ease, opacity 180ms ease;
        }
        .mw-entry-cta:hover {
          opacity: 0.92;
        }
        .mw-entry-login-wrap {
          text-align: center;
          font-family: var(--font-serif);
          font-size: 15px;
          font-style: italic;
          color: var(--session-ink-mid);
        }
        .mw-entry-login {
          all: unset;
          cursor: pointer;
          font-style: italic;
          color: var(--session-ink);
          border-bottom: 1px solid var(--session-ink-whisper);
          padding-bottom: 1px;
          transition: border-color 180ms ease;
        }
        .mw-entry-login:hover {
          border-bottom-color: var(--session-ink);
        }
        .mw-entry-legal {
          text-align: center;
          margin-top: 24px;
          padding: 0 28px calc(24px + env(safe-area-inset-bottom, 0px));
          font-family: var(--font-sans);
          font-size: 11px;
          color: var(--session-ink-mid);
        }
        .mw-entry-legal a { color: inherit; text-decoration: none; }
        .mw-entry-legal-sep { margin: 0 6px; }

        @media (min-width: 768px) {
          .mw-entry-wordmark { font-size: 18px; }
          .mw-entry-column {
            max-width: 640px;
            padding: 48px 48px 64px;
          }
          .mw-entry-headline { font-size: 52px; }
          .mw-entry-subhead { font-size: 20px; margin-bottom: 28px; }
          .mw-entry-examples { font-size: 18px; min-height: 96px; margin-bottom: 60px; }
          .mw-entry-explainer-heading { font-size: 15px; margin-bottom: 26px; }
          .mw-entry-list { margin-bottom: 60px; }
          .mw-entry-list-item { font-size: 17px; line-height: 1.6; margin-bottom: 24px; }
        }

        @media (min-width: 1024px) {
          .mw-entry-wordmark { font-size: 22px; padding: 24px 0; }
          .mw-entry-column {
            max-width: 880px;
            padding: 64px 64px 88px;
          }
          .mw-entry-headline {
            font-size: 64px;
            line-height: 1.05;
            letter-spacing: -1px;
            margin-bottom: 18px;
          }
          .mw-entry-subhead { font-size: 22px; margin-bottom: 36px; }
          .mw-entry-examples {
            font-size: 20px;
            line-height: 1.5;
            min-height: 96px;
            margin-bottom: 72px;
          }
          .mw-entry-explainer-heading { font-size: 16px; margin-bottom: 32px; }
          .mw-entry-list { margin-bottom: 72px; }
          .mw-entry-list-item {
            font-size: 18px;
            line-height: 1.65;
            margin-bottom: 28px;
            gap: 18px;
          }
          .mw-entry-list-number {
            font-size: 13px;
            min-width: 24px;
            padding-top: 4px;
          }
          .mw-entry-beta { font-size: 13px; margin-bottom: 18px; }
          .mw-entry-cta-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 18px;
          }
          .mw-entry-cta {
            display: inline-block;
            width: auto;
            padding: 16px 48px;
          }
          .mw-entry-login-wrap { font-size: 16px; }
          .mw-entry-legal {
            max-width: 480px;
            margin: 48px auto 0;
            padding: 24px 28px calc(40px + env(safe-area-inset-bottom, 0px));
            font-size: 12px;
            border-top: 1px solid var(--session-ink-hairline);
          }
        }
      `}</style>

      {/* Wordmark (top center) — kept at 13px per spec. */}
      <div className="mw-entry-wordmark">my walnut</div>

      <div className="mw-entry-column">
        <h1 className="mw-entry-headline">
          A more complete manual of how your mind works.
        </h1>

        <p className="mw-entry-subhead">Built for neurodivergent adults.</p>

        <div
          className="mw-entry-examples"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {ROTATING_EXAMPLES[activeIndex]}
        </div>

        <div className="mw-entry-explainer-heading">
          An oversimplification of how it works:
        </div>

        <ol className="mw-entry-list">
          <li className="mw-entry-list-item">
            <span className="mw-entry-list-number">1.</span>
            <span className="mw-entry-list-body">
              You bring a situation that is on your mind &mdash; a conflict, a reaction, a pattern you keep noticing. Talking it through with {PERSONA_NAME} helps you organize what you&rsquo;re processing.
            </span>
          </li>
          <li className="mw-entry-list-item">
            <span className="mw-entry-list-number">2.</span>
            <span className="mw-entry-list-body">
              Underneath the conversation, {PERSONA_NAME} is building a model of how you operate &mdash; from your patterns, your language, and what you return to. When it sees something worth naming, it proposes an entry for your Manual. You decide what&rsquo;s true.
            </span>
          </li>
          <li className="mw-entry-list-item">
            <span className="mw-entry-list-number">3.</span>
            <span className="mw-entry-list-body">
              Over time, your Manual becomes a more complete picture of how you work. <span className="mw-entry-soon">(Coming soon)</span> Share parts of it with the people in your life on your terms &mdash; your partner, your therapist, your manager &mdash; to help them understand how you operate.
            </span>
          </li>
          <li className="mw-entry-list-item">
            <span className="mw-entry-list-number">4.</span>
            <span className="mw-entry-list-body">
              <span className="mw-entry-soon">(Coming soon)</span> See how your Manual connects with others. Find patterns across relationships. Ask questions about how two Manuals fit together.
            </span>
          </li>
        </ol>

        <div className="mw-entry-beta">my walnut is in early access.</div>

        <div className="mw-entry-cta-wrap">
          <a href="/waitlist" className="mw-entry-cta">
            Join the waitlist
          </a>
        </div>

        <div className="mw-entry-login-wrap">
          Already have access?{" "}
          <button
            type="button"
            onClick={onLogin}
            className="mw-entry-login"
          >
            Log in.
          </button>
        </div>
      </div>

      {/* Mobile-only legal footer — hidden on desktop where the canvas
          colophon would normally carry Privacy/Terms. EntryScreen no
          longer renders inside the canvas vitrine on desktop, so this
          footer is shown on every viewport >= 431px too — drop the
          mw-mobile-only class. */}
      <div className="mw-entry-legal">
        <a href="/privacy">Privacy Policy</a>
        <span className="mw-entry-legal-sep">&middot;</span>
        <a href="/terms">Terms of Service</a>
      </div>
    </main>
  );
}
