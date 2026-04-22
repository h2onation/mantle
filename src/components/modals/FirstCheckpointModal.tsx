"use client";

import { useEffect, useRef } from "react";
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-checkpoint-modal-heading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        backgroundColor: "var(--session-backdrop-heavy)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          backgroundColor: "var(--session-cream)",
          borderRadius: 12,
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        <h2
          id="first-checkpoint-modal-heading"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            fontWeight: 400,
            color: "var(--session-ink)",
            margin: "0 0 18px 0",
            lineHeight: 1.2,
          }}
        >
          A pattern is ready for your Manual
        </h2>

        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            color: "var(--session-ink-mid)",
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: "0 0 14px 0" }}>
            I have a pattern to put in front of you. You will see a card. Read it. If it fits, confirm and it becomes an entry in your Manual. If it is off, tell me where and we keep going.
          </p>
          <p style={{ margin: "0 0 24px 0" }}>
            Your Manual builds one entry at a time. This is the first, and it will evolve as you add more &mdash; entries sharpen, connect to each other, sometimes get revisited. The Manual is a living document, not a finished one.
          </p>
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            void handleDismiss();
          }}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--session-cream)",
            backgroundColor: "var(--session-persona)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Show me
        </button>
      </div>
    </div>
  );
}
