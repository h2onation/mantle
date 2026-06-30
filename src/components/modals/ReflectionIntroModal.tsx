"use client";

import { useEffect, useRef } from "react";
import Modal from "@/components/shared/Modal";

interface ReflectionIntroModalProps {
  open: boolean;
  onDismiss: () => void;
}

// One-time explainer for the reflection meter. Fires the first time the
// "ready" strip appears for a signed-in user, so the quiet bar + pull strip
// don't arrive unexplained. Seen-state is held by the caller (localStorage,
// per-device) — this component is presentational. The pushed-checkpoint
// onboarding (PatternFormingModal) is suppressed while the meter is on, so
// this is the single capture explainer in the meter model.
export default function ReflectionIntroModal({
  open,
  onDismiss,
}: ReflectionIntroModalProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Focus the dismiss button on open. Modal handles focus save/restore on
  // close — override its default plate-focus with the actionable button.
  useEffect(() => {
    if (!open) return;
    buttonRef.current?.focus();
  }, [open]);

  // Tab trap — single-button modal keeps focus on the button. Modal handles
  // Escape dismissal and body-scroll lock.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      ariaLabelledBy="reflection-intro-modal-heading"
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-walnut-meta)",
        }}
      >
        How this works
      </p>
      <h2
        id="reflection-intro-modal-heading"
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--session-ink)",
          lineHeight: 1.25,
          letterSpacing: "-0.3px",
        }}
      >
        You decide what&rsquo;s worth keeping
        <span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
      </h2>

      <div
        style={{
          marginTop: 14,
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 15.5,
          color: "var(--session-ink-soft)",
          lineHeight: 1.62,
          letterSpacing: "-0.05px",
        }}
      >
        <p style={{ margin: 0 }}>
          As you and Jove go deep, the line up top fills. When there&rsquo;s
          enough for a reflection worth keeping, a handle appears there.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          Tap it when you&rsquo;ve reached a natural conclusion and want to
          reflect on what you&rsquo;ve uncovered &mdash; or just keep talking.
          Nothing enters your Manual unless you build it.
        </p>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <button
          ref={buttonRef}
          type="button"
          onClick={onDismiss}
          style={{
            all: "unset",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: "var(--session-ink)",
            borderBottom: "1px solid var(--session-ink)",
            padding: "4px 0",
            cursor: "pointer",
          }}
        >
          Got it ›
        </button>
      </div>
    </Modal>
  );
}
