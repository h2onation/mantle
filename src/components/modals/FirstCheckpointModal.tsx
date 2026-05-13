"use client";

import { useEffect, useRef } from "react";
import Modal from "@/components/shared/Modal";
import {
  trackModal3Shown,
  trackModalFlowCompleted,
} from "@/lib/analytics/events";

interface FirstCheckpointModalProps {
  open: boolean;
  onDismiss: () => void;
  signupAtMs: number | null;
}

export default function FirstCheckpointModal({
  open,
  onDismiss,
  signupAtMs,
}: FirstCheckpointModalProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Save previously focused element, focus the dismiss button on open,
  // restore focus on close. Same pattern as the other two modals.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Lock body scroll while the modal is open. Save the previous
  // value so nested or sibling overlays compose correctly.
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
    trackModal3Shown({ time_since_signup_ms: timeSinceSignupMs });
  }, [open, signupAtMs]);

  // Escape dismisses; Tab traps inside the modal (single button).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleDismiss() {
    let postSucceeded = false;
    try {
      const res = await fetch("/api/modal-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: 3 }),
      });
      if (res.ok) {
        postSucceeded = true;
      } else {
        console.error(
          "[FirstCheckpointModal] modal-progress POST returned",
          res.status
        );
      }
    } catch (err) {
      console.error("[FirstCheckpointModal] modal-progress POST error:", err);
    }

    // modal_flow_completed represents server-confirmed state transition
    // to modal_progress = 3. Fire only on POST success — firing
    // optimistically would skew downstream funnel metrics for users
    // whose POST actually failed. Dismissal itself still proceeds
    // (fail-open) regardless.
    if (postSucceeded) {
      const timeSinceSignupMs = signupAtMs ? Date.now() - signupAtMs : 0;
      trackModalFlowCompleted({ time_since_signup_ms: timeSinceSignupMs });
    }

    onDismiss();
  }

  return (
    <Modal
      open={open}
      onClose={() => void handleDismiss()}
      ariaLabelledBy="first-checkpoint-modal-heading"
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
        Your first entry
      </p>
      <h2
        id="first-checkpoint-modal-heading"
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
        A suggested entry is ready
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
          I have something to put in front of you. Tap to review it. If it fits, add it to your Manual. If it&rsquo;s off, we can rework it together.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          Your Manual builds one entry at a time. This is the first, and it will evolve as you add more &mdash; entries sharpen, connect to each other, sometimes get revisited. The Manual is a living document, not a finished one.
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
          Show me ›
        </button>
      </div>
    </Modal>
  );
}
