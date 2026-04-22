"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Narrative vignette for the hero. We join the END of a conversation:
// three prior turns are visible (the oldest fading into the top edge),
// Jove asks to name a pattern, the user confirms, and the entry lands
// in the Manual. Plays once on mount and holds in its final state —
// looping chat animations in peripheral vision read as distracting.
//
// The chat copy is written in a real first-person register (specific,
// sensory, short) so the proposal that follows can mirror the exact
// language — that is how real checkpoints work. The point is to show
// the mechanic, not a verbatim transcript, so the content is tuned
// for clarity at a glance rather than realism at length.

const HISTORY: { from: "user" | "jove"; text: string }[] = [
  {
    from: "user",
    text: "Game night fell apart after Sam said they had to leave. Everyone scattered.",
  },
  {
    from: "jove",
    text: "What did you notice in yourself as it came apart?",
  },
  {
    from: "user",
    text: "I went somewhere else. Then my voice just went — I had things to say and they wouldn't come out.",
  },
];

const JOVE_SETUP = "Here's what I'm hearing — can I say it back to you?";

const JOVE_PROPOSAL =
  "When a planned interaction shifts without warning, your voice goes quiet first. Not because you have nothing to say — because speech is where your regulation leaves.";

const ENTRY_TITLE = "When plans shift, voice leaves first";
const TARGET_LAYER = "How I Process Things";

const LAYERS = [
  "Some of My Patterns",
  "How I Process Things",
  "What Helps",
  "How I Show Up with People",
  "Where I'm Strong",
];

// Phase-based state machine. Each phase unlocks the next element of
// the reveal. Stays in phase 8 forever after mount.
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export default function HeroManualVignette() {
  const [phase, setPhase] = useState<Phase>(0);
  const [setupTyped, setSetupTyped] = useState("");
  const [proposalTyped, setProposalTyped] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // 1: Jove "typing" indicator after reading history.
    timers.push(setTimeout(() => mountedRef.current && setPhase(1), 1200));
    // 2: Jove's setup line ("Here's what I'm hearing...") types in.
    timers.push(setTimeout(() => mountedRef.current && setPhase(2), 2100));
    // 3: Proposal card frame fades in.
    timers.push(setTimeout(() => mountedRef.current && setPhase(3), 3900));
    // 4: Proposal text types into the card.
    timers.push(setTimeout(() => mountedRef.current && setPhase(4), 4250));
    // 5: Confirmation buttons surface.
    timers.push(setTimeout(() => mountedRef.current && setPhase(5), 8400));
    // 6: "Put it in my Manual" button is pressed — confirmed state.
    timers.push(setTimeout(() => mountedRef.current && setPhase(6), 9400));
    // 7: Card dissolves (scale + translate + fade); entry starts to
    //    surface in the Manual layer.
    timers.push(setTimeout(() => mountedRef.current && setPhase(7), 10100));
    // 8: Settled final state.
    timers.push(setTimeout(() => mountedRef.current && setPhase(8), 11000));
    return () => {
      mountedRef.current = false;
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Setup typewriter — starts when phase hits 2.
  useEffect(() => {
    if (phase < 2) return;
    let i = 0;
    setSetupTyped("");
    const id = setInterval(() => {
      i += 1;
      setSetupTyped(JOVE_SETUP.slice(0, i));
      if (i >= JOVE_SETUP.length) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [phase >= 2]); // eslint-disable-line react-hooks/exhaustive-deps

  // Proposal typewriter — starts when phase hits 4.
  useEffect(() => {
    if (phase < 4) return;
    let i = 0;
    setProposalTyped("");
    const id = setInterval(() => {
      i += 1;
      setProposalTyped(JOVE_PROPOSAL.slice(0, i));
      if (i >= JOVE_PROPOSAL.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [phase >= 4]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize the <style> block body so React reuses the same string
  // reference across every render. Without this, Next.js dev-mode
  // re-renders have been observed to reset CSS animation startTime
  // on descendants (animations stuck at currentTime: 0, playState:
  // running). With stable text content, React leaves the style node
  // alone and animations progress normally.
  const styles = useMemo(
    () => `
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

        /* ── Chat frame ──────────────────────────────────────────
           Fixed-height window into the chat. Content is absolutely
           pinned to the bottom, so as new turns surface they push
           the oldest upward off the frame — clipped by overflow
           hidden, softened by a top mask. Reads as "the end of a
           longer conversation." */
        .mw-vignette-chat-frame {
          position: relative;
          height: 360px;
          margin-top: 16px;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0%,
            rgba(0, 0, 0, 0.4) 7%,
            rgba(0, 0, 0, 0.9) 18%,
            black 28%,
            black 100%
          );
          mask-image: linear-gradient(
            180deg,
            transparent 0%,
            rgba(0, 0, 0, 0.4) 7%,
            rgba(0, 0, 0, 0.9) 18%,
            black 28%,
            black 100%
          );
        }
        .mw-vignette-chat {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── Chat messages ──────────────────────────────────────── */
        .mw-vignette-user {
          font-family: var(--font-sans), -apple-system, system-ui, sans-serif;
          font-size: 13.5px;
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
          font-size: 14.5px;
          line-height: 1.5;
          color: var(--session-ink-mid);
          align-self: flex-start;
          max-width: 92%;
          padding-left: 12px;
          border-left: 2px solid var(--session-persona-soft);
          animation: mwVigFadeIn 240ms ease-out both;
        }
        .mw-vignette-history {
          /* Older turns pre-exist; they don't re-animate. The top
             mask handles the "fading out of view" feel. */
          animation: none;
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

        /* ── Proposal card ──────────────────────────────────────
           Jove's checkpoint. The card is the real mechanic — an
           explicit proposal the user either confirms or refines.
           The persona-tinted border + kicker treatment sets it
           apart from Jove's prose turns without looking like a
           different product. */
        .mw-vignette-card {
          align-self: stretch;
          margin-top: 4px;
          padding: 14px 16px;
          background: rgba(250, 248, 244, 0.75);
          border: 1px solid var(--session-persona-border);
          border-radius: 4px;
          animation: mwVigCardIn 420ms cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
          transform-origin: 50% 20%;
          /* During the dissolve we also collapse height so the chat
             doesn't leave a blank rectangle in its place — the
             remaining turns settle downward as the card leaves. */
          overflow: hidden;
          max-height: 400px;
        }
        .mw-vignette-phase-7 .mw-vignette-card,
        .mw-vignette-phase-8 .mw-vignette-card {
          /* Keyframe animation for the dissolve — more reliable than
             a transition when the surrounding <style> block is being
             re-emitted by React on each render. */
          animation: mwVigCardOut 540ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
          pointer-events: none;
        }
        .mw-vignette-card-kicker {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 400;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--session-persona);
          margin-bottom: 10px;
        }
        .mw-vignette-card-body {
          font-family: var(--font-display), serif;
          font-style: normal;
          font-size: 14px;
          line-height: 1.55;
          color: var(--session-ink);
          margin: 0 0 14px;
          min-height: 44px;
        }
        .mw-vignette-card-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          animation: mwVigFadeIn 280ms ease-out both;
        }
        .mw-vignette-card-primary {
          font-family: var(--font-sans), -apple-system, system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: var(--session-cream);
          background: var(--session-persona);
          border: 1px solid var(--session-persona);
          padding: 8px 14px;
          border-radius: 3px;
          cursor: default;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: background 260ms ease, box-shadow 260ms ease,
                      padding 260ms ease;
        }
        .mw-vignette-card-primary.is-pressed {
          background: #45583b;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.22);
        }
        .mw-vignette-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          font-size: 9px;
          line-height: 1;
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 240ms ease, transform 240ms cubic-bezier(0.2, 1, 0.4, 1);
        }
        .mw-vignette-card-primary.is-pressed .mw-vignette-check {
          opacity: 1;
          transform: scale(1);
        }
        .mw-vignette-card-secondary {
          font-family: var(--font-sans), -apple-system, system-ui, sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: var(--session-ink-mid);
          background: transparent;
          border: 1px solid rgba(26, 22, 20, 0.2);
          padding: 8px 14px;
          border-radius: 3px;
          cursor: default;
          transition: opacity 280ms ease;
        }
        .mw-vignette-phase-6 .mw-vignette-card-secondary,
        .mw-vignette-phase-7 .mw-vignette-card-secondary,
        .mw-vignette-phase-8 .mw-vignette-card-secondary {
          opacity: 0.35;
        }

        /* ── Divider + Manual ──────────────────────────────────── */
        .mw-vignette-divider {
          position: relative;
          margin: 22px 0 16px;
          height: 1px;
          background: rgba(26, 22, 20, 0.08);
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
          transition: color 520ms ease;
        }
        .mw-vignette-layer.is-target {
          color: var(--session-ink);
        }
        .mw-vignette-layer.is-target::before {
          content: "";
          position: absolute;
          left: -14px;
          top: 13px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--session-persona);
          opacity: 0;
          transform: scale(0.4);
        }
        .mw-vignette-phase-7 .mw-vignette-layer.is-target::before,
        .mw-vignette-phase-8 .mw-vignette-layer.is-target::before {
          /* Keyframe animation (not transition) so the reveal plays
             cleanly even when React re-renders the surrounding
             <style> block. forwards keeps the "to" state. */
          animation: mwVigDotIn 420ms cubic-bezier(0.2, 1, 0.4, 1) 120ms forwards;
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
          transform: translateY(6px);
        }
        .mw-vignette-phase-7 .mw-vignette-entry,
        .mw-vignette-phase-8 .mw-vignette-entry {
          animation: mwVigEntryIn 560ms cubic-bezier(0.2, 1, 0.4, 1) 160ms forwards;
        }

        @keyframes mwVigFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mwVigCardIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mwVigCardOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
            max-height: 400px;
            margin-top: 4px;
            padding-top: 14px;
            padding-bottom: 14px;
            border-top-width: 1px;
            border-bottom-width: 1px;
          }
          50% {
            opacity: 0;
            transform: translateY(14px) scale(0.94);
            max-height: 400px;
            margin-top: 4px;
            padding-top: 14px;
            padding-bottom: 14px;
            border-top-width: 1px;
            border-bottom-width: 1px;
          }
          to {
            opacity: 0;
            transform: translateY(14px) scale(0.94);
            max-height: 0;
            margin-top: 0;
            padding-top: 0;
            padding-bottom: 0;
            border-top-width: 0;
            border-bottom-width: 0;
          }
        }
        @keyframes mwVigDotIn {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mwVigEntryIn {
          from { opacity: 0; max-height: 0; transform: translateY(6px); }
          to { opacity: 1; max-height: 36px; transform: translateY(0); }
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
          .mw-vignette-card {
            opacity: 1 !important;
            transform: none !important;
          }
          .mw-vignette-layer.is-target::before {
            opacity: 1 !important;
            transform: scale(1) !important;
          }
          .mw-vignette-entry {
            opacity: 1 !important;
            max-height: 36px !important;
            transform: none !important;
          }
        }

        @media (min-width: 1024px) {
          .mw-vignette { padding: 28px 30px 32px; }
          .mw-vignette-chat-frame { height: 420px; margin-top: 18px; }
          .mw-vignette-user { font-size: 14px; }
          .mw-vignette-jove { font-size: 15.5px; }
          .mw-vignette-card { padding: 16px 18px; }
          .mw-vignette-card-body { font-size: 14.5px; min-height: 48px; }
          .mw-vignette-layer { font-size: 14px; padding: 7px 0; }
          .mw-vignette-entry { font-size: 14px; }
          .mw-vignette-divider { margin: 26px 0 18px; }
        }
      `,
    []
  );

  return (
    <div
      className={`mw-vignette mw-vignette-phase-${phase}`}
      aria-label="A short demo of a conversation producing a Manual entry"
    >
      <style>{styles}</style>

      <div className="mw-vignette-section-label">From a conversation</div>

      <div className="mw-vignette-chat-frame">
        <div className="mw-vignette-chat">
          {HISTORY.map((msg, i) => (
            <div
              key={`h-${i}`}
              className={
                "mw-vignette-history " +
                (msg.from === "user" ? "mw-vignette-user" : "mw-vignette-jove")
              }
            >
              {msg.text}
            </div>
          ))}

          {phase === 1 && (
            <div className="mw-vignette-typing" aria-label="Jove is typing">
              <span />
              <span />
              <span />
            </div>
          )}
          {phase >= 2 && (
            <div
              className={
                "mw-vignette-jove" +
                (phase === 2 ? " mw-vignette-cursor" : "")
              }
            >
              {setupTyped}
            </div>
          )}

          {phase >= 3 && (
            <div className="mw-vignette-card">
              <div className="mw-vignette-card-kicker">For your Manual</div>
              <div
                className={
                  "mw-vignette-card-body" +
                  (phase === 4 ? " mw-vignette-cursor" : "")
                }
              >
                {proposalTyped}
              </div>
              {phase >= 5 && (
                <div className="mw-vignette-card-actions">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={
                      "mw-vignette-card-primary" +
                      (phase >= 6 ? " is-pressed" : "")
                    }
                  >
                    <span className="mw-vignette-check">✓</span>
                    Put it in my Manual
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="mw-vignette-card-secondary"
                  >
                    Close but not quite
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mw-vignette-divider" aria-hidden="true" />

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
