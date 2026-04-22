"use client";

import { useEffect, useRef, useState } from "react";
import { trackModal2Shown } from "@/lib/analytics/events";

interface PatternFormingModalProps {
  open: boolean;
  onDismiss: () => void;
  // Current pattern snippet from the latest extraction. The modal
  // SNAPSHOTS this on first open into local state and never re-renders
  // it during the same open lifecycle, even if the underlying snippet
  // shifts in subsequent extraction cycles. This prevents the displayed
  // text from changing under the user's eyes while they read.
  patternSnippet: string;
  signupAtMs: number | null;
}

export default function PatternFormingModal({
  open,
  onDismiss,
  patternSnippet,
  signupAtMs,
}: PatternFormingModalProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Snippet snapshot — captured on the first open transition, displayed
  // for the lifetime of this modal even if patternSnippet prop changes.
  const [snapshotSnippet, setSnapshotSnippet] = useState<string | null>(null);

  // Capture the snippet the first time the modal opens, then leave it
  // alone. Subsequent prop changes during open=true do not update the
  // displayed text — by design.
  useEffect(() => {
    if (open && snapshotSnippet === null) {
      setSnapshotSnippet(patternSnippet);
    }
  }, [open, patternSnippet, snapshotSnippet]);

  // Save previously focused element, focus the dismiss button on open,
  // restore focus on close. Same pattern as ChatWindowModal.
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
    trackModal2Shown({ time_since_signup_ms: timeSinceSignupMs });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleDismiss() {
    try {
      const res = await fetch("/api/modal-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: 2 }),
      });
      if (!res.ok) {
        console.error(
          "[PatternFormingModal] modal-progress POST returned",
          res.status
        );
      }
    } catch (err) {
      console.error("[PatternFormingModal] modal-progress POST error:", err);
    }
    onDismiss();
  }

  if (!open) return null;

  // Defensive fallback: if the snapshot effect hasn't run yet (single
  // render frame between open=true and the effect's commit), use the
  // current prop. The snapshot will overwrite on the next render.
  const displayedSnippet = snapshotSnippet ?? patternSnippet;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pattern-forming-modal-heading"
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
          id="pattern-forming-modal-heading"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            fontWeight: 400,
            color: "var(--session-ink)",
            margin: "0 0 18px 0",
            lineHeight: 1.2,
          }}
        >
          Something is taking shape
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
            I am seeing a pattern around {displayedSnippet}. Let&rsquo;s keep going so I can get it right.
          </p>
          <p style={{ margin: "0 0 14px 0" }}>
            You are roughly halfway to your first entry. A few more turns and I will propose a piece for your Manual. You will see it on a card and decide whether it fits.
          </p>
          <p style={{ margin: "0 0 24px 0" }}>
            Honest expression produces sharper reflections than careful writing. Typos, tangents, going long &mdash; none of it matters. You can dictate if typing is slowing you down.
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
          Keep going
        </button>
      </div>
    </div>
  );
}
