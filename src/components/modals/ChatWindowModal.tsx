"use client";

import { useEffect, useRef } from "react";
import Modal from "@/components/shared/Modal";
import { trackModal1Shown } from "@/lib/analytics/events";
import { PERSONA_NAME } from "@/lib/persona/config";

interface ChatWindowModalProps {
  open: boolean;
  onDismiss: () => void;
  // Unix milliseconds at which the user signed up; used for the
  // time_since_signup_ms analytics attribution. Null if the parent
  // could not determine signup time — analytics still fires with 0.
  signupAtMs: number | null;
}

export default function ChatWindowModal({
  open,
  onDismiss,
  signupAtMs,
}: ChatWindowModalProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Save previously focused element, focus the dismiss button on open,
  // restore focus on close. Spec: "Focus returns to the chat input on
  // close" — relies on the chat input being the focused element when
  // the modal triggers, which is the typical mount order in MobileSession.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Lock body scroll while the modal is open so the user cannot
  // scroll the chat behind the backdrop. Save the previous value so
  // nested or sibling overlays compose correctly (each restores to
  // whatever the state was when IT opened, not unconditionally to "").
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Analytics: fire once per open transition.
  useEffect(() => {
    if (!open) return;
    const timeSinceSignupMs = signupAtMs ? Date.now() - signupAtMs : 0;
    trackModal1Shown({ time_since_signup_ms: timeSinceSignupMs });
  }, [open, signupAtMs]);

  // Escape dismisses; Tab traps inside the modal (single button = focus
  // stays on it).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleDismiss();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // handleDismiss is stable in this component (defined inline); no need
    // to include it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleDismiss() {
    // Fire-and-forget POST. If it fails, the user is still dismissed —
    // they'll see the modal again next session, which is acceptable.
    try {
      const res = await fetch("/api/modal-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: 1 }),
      });
      if (!res.ok) {
        console.error(
          "[ChatWindowModal] modal-progress POST returned",
          res.status
        );
      }
    } catch (err) {
      console.error("[ChatWindowModal] modal-progress POST error:", err);
    }
    onDismiss();
  }

  return (
    <Modal
      open={open}
      onClose={() => void handleDismiss()}
      ariaLabelledBy="chat-window-modal-heading"
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
        Before you begin
      </p>
      <h2
        id="chat-window-modal-heading"
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
        How this works
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
          This is where you talk to {PERSONA_NAME}. Bring a situation you want help processing or working through. Something specific &mdash; a conflict you are still chewing on, a reaction that surprised you, a pattern you keep noticing.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          While we talk, {PERSONA_NAME} is pulling out insights you might not see from inside and reflecting them back. What you confirm gets written to your Manual &mdash; a document about how you operate, authored by you, that builds over time.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          This takes time, and it is an investment. Start with at least 15 minutes. If now is not that, come back when it is.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          Nothing gets written without your yes.
        </p>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            void handleDismiss();
          }}
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
