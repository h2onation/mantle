"use client";

import { useEffect, useRef, useState } from "react";

// One-shot narrative vignette for the hero. Shows the product's core
// mechanic: a conversation → a reflection → an entry landing in the
// Manual. Plays once on mount and stays in the completed state so the
// user can read the final composition; does not loop (looping chat
// animations in peripheral vision read as distracting).
//
// Copy is deliberately short so the animation feels crisp. A longer
// realistic conversation would drag; the point is to communicate the
// shape of the mechanic, not a verbatim transcript.

const USER_MSG = "My voice left when plans changed at the last minute.";
const JOVE_MSG =
  "Something about how change lands in your body. Let's name it.";
const ENTRY_TITLE = "When plans change, voice leaves first";
const TARGET_LAYER = "How I Process Things";

const LAYERS = [
  "Some of My Patterns",
  "How I Process Things",
  "What Helps",
  "How I Show Up with People",
  "Where I'm Strong",
];

// Phase-based state machine. Each phase unlocks the next element in
// the reveal. Stays in phase 6 forever after mount.
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export default function HeroManualVignette() {
  const [phase, setPhase] = useState<Phase>(0);
  const [userTyped, setUserTyped] = useState("");
  const [joveTyped, setJoveTyped] = useState("");
  const mountedRef = useRef(true);

  // Schedule phase transitions.
  useEffect(() => {
    mountedRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => mountedRef.current && setPhase(1), 900));
    timers.push(setTimeout(() => mountedRef.current && setPhase(2), 3100));
    timers.push(setTimeout(() => mountedRef.current && setPhase(3), 3600));
    timers.push(setTimeout(() => mountedRef.current && setPhase(4), 4300));
    timers.push(setTimeout(() => mountedRef.current && setPhase(5), 7100));
    timers.push(setTimeout(() => mountedRef.current && setPhase(6), 7800));
    return () => {
      mountedRef.current = false;
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // User-message typewriter.
  useEffect(() => {
    if (phase < 1) return;
    let i = 0;
    setUserTyped("");
    const id = setInterval(() => {
      i += 1;
      setUserTyped(USER_MSG.slice(0, i));
      if (i >= USER_MSG.length) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [phase >= 1]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jove-message typewriter.
  useEffect(() => {
    if (phase < 4) return;
    let i = 0;
    setJoveTyped("");
    const id = setInterval(() => {
      i += 1;
      setJoveTyped(JOVE_MSG.slice(0, i));
      if (i >= JOVE_MSG.length) clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, [phase >= 4]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`mw-vignette mw-vignette-phase-${phase}`}
      aria-label="A short demo of a conversation producing a Manual entry"
    >
      <style>{`
        .mw-vignette {
          border: 1px solid rgba(26, 22, 20, 0.14);
          background: rgba(255, 255, 255, 0.45);
          padding: 24px 24px 26px;
          box-sizing: border-box;
          font-family: var(--font-display), Georgia, serif;
          position: relative;
        }
        .mw-vignette-section-label {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: var(--session-persona);
        }
        .mw-vignette-chat {
          min-height: 118px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 16px;
        }
        .mw-vignette-user {
          font-family: var(--font-sans), -apple-system, system-ui, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: var(--session-ink);
          background: var(--session-linen);
          padding: 8px 12px;
          border: 1px solid rgba(26, 22, 20, 0.08);
          border-radius: 4px;
          align-self: flex-start;
          max-width: 92%;
          animation: mwVigFadeIn 240ms ease-out both;
        }
        .mw-vignette-jove {
          font-family: var(--font-display), serif;
          font-style: italic;
          font-weight: 400;
          font-size: 15px;
          line-height: 1.5;
          color: var(--session-ink-mid);
          align-self: flex-start;
          max-width: 92%;
          padding-left: 12px;
          border-left: 2px solid var(--session-persona-soft);
          animation: mwVigFadeIn 240ms ease-out both;
        }
        .mw-vignette-typing {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          padding-left: 12px;
          border-left: 2px solid var(--session-persona-soft);
          height: 20px;
          align-self: flex-start;
          animation: mwVigFadeIn 200ms ease-out both;
        }
        .mw-vignette-typing span {
          width: 4px;
          height: 4px;
          background: var(--session-persona-soft);
          border-radius: 50%;
          animation: mwVigDot 1.2s ease-in-out infinite;
        }
        .mw-vignette-typing span:nth-child(2) { animation-delay: 0.2s; }
        .mw-vignette-typing span:nth-child(3) { animation-delay: 0.4s; }
        .mw-vignette-cursor::after {
          content: "";
          display: inline-block;
          width: 2px;
          height: 14px;
          background: currentColor;
          opacity: 0.65;
          vertical-align: -2px;
          margin-left: 2px;
          animation: mwVigBlink 1s steps(2) infinite;
        }
        .mw-vignette-divider {
          position: relative;
          margin: 22px 0 16px;
          height: 1px;
          background: rgba(26, 22, 20, 0.08);
        }
        .mw-vignette-divider-stamp {
          position: absolute;
          left: 50%;
          top: -10px;
          transform: translateX(-50%);
          padding: 0 10px;
          background: rgba(244, 240, 234, 0.98);
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 9px;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--session-persona);
          opacity: 0;
          transition: opacity 420ms ease 60ms;
        }
        .mw-vignette-phase-5 .mw-vignette-divider-stamp,
        .mw-vignette-phase-6 .mw-vignette-divider-stamp {
          opacity: 1;
        }
        .mw-vignette-manual-label {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: var(--session-persona);
          margin-bottom: 12px;
        }
        .mw-vignette-layers {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .mw-vignette-layer {
          font-family: var(--font-display), serif;
          font-size: 13px;
          line-height: 1.5;
          color: var(--session-ink-faded);
          padding: 6px 0;
          position: relative;
          transition: color 480ms ease;
        }
        .mw-vignette-layer.is-target {
          color: var(--session-ink);
        }
        .mw-vignette-layer.is-target::before {
          content: "";
          position: absolute;
          left: -14px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--session-persona);
          opacity: 0;
          transition: opacity 360ms ease 120ms;
        }
        .mw-vignette-phase-5 .mw-vignette-layer.is-target::before,
        .mw-vignette-phase-6 .mw-vignette-layer.is-target::before {
          opacity: 1;
        }
        .mw-vignette-entry {
          display: block;
          font-family: var(--font-display), serif;
          font-style: italic;
          font-size: 13px;
          line-height: 1.45;
          color: var(--session-persona);
          padding-left: 14px;
          margin-top: 3px;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: opacity 520ms ease, max-height 520ms ease;
        }
        .mw-vignette-phase-6 .mw-vignette-entry {
          opacity: 1;
          max-height: 36px;
        }

        @keyframes mwVigFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mwVigDot {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        @keyframes mwVigBlink {
          50% { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mw-vignette,
          .mw-vignette * {
            animation: none !important;
            transition: none !important;
          }
          .mw-vignette-layer.is-target::before,
          .mw-vignette-divider-stamp,
          .mw-vignette-entry {
            opacity: 1 !important;
          }
          .mw-vignette-entry {
            max-height: 36px !important;
          }
        }

        @media (min-width: 1024px) {
          .mw-vignette { padding: 28px 30px 32px; }
          .mw-vignette-chat { min-height: 130px; margin-top: 18px; }
          .mw-vignette-user { font-size: 14.5px; }
          .mw-vignette-jove { font-size: 16px; }
          .mw-vignette-layer { font-size: 14px; padding: 7px 0; }
          .mw-vignette-entry { font-size: 14px; }
          .mw-vignette-divider { margin: 26px 0 18px; }
        }
      `}</style>

      <div className="mw-vignette-section-label">From a conversation</div>

      <div className="mw-vignette-chat">
        {phase >= 1 && (
          <div
            className={
              "mw-vignette-user" + (phase === 1 ? " mw-vignette-cursor" : "")
            }
          >
            {userTyped}
          </div>
        )}
        {phase === 3 && (
          <div className="mw-vignette-typing" aria-label="Jove is typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {phase >= 4 && (
          <div
            className={
              "mw-vignette-jove" + (phase === 4 ? " mw-vignette-cursor" : "")
            }
          >
            {joveTyped}
          </div>
        )}
      </div>

      <div className="mw-vignette-divider" aria-hidden="true">
        <span className="mw-vignette-divider-stamp">Added to Manual</span>
      </div>

      <div>
        <div className="mw-vignette-manual-label">Your Manual</div>
        <ul className="mw-vignette-layers">
          {LAYERS.map((name) => {
            const isTarget = name === TARGET_LAYER;
            return (
              <li
                key={name}
                className={
                  "mw-vignette-layer" + (isTarget ? " is-target" : "")
                }
              >
                {name}
                {isTarget && (
                  <span className="mw-vignette-entry">{ENTRY_TITLE}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
