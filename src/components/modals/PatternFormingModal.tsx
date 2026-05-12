"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/shared/Modal";
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

  // Defensive fallback: if the snapshot effect hasn't run yet (single
  // render frame between open=true and the effect's commit), use the
  // current prop. The snapshot will overwrite on the next render.
  const displayedSnippet = snapshotSnippet ?? patternSnippet;

  return (
    <Modal
      open={open}
      onClose={() => void handleDismiss()}
      ariaLabelledBy="pattern-forming-modal-heading"
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
        Halfway there
      </p>
      <h2
        id="pattern-forming-modal-heading"
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
        Something is taking shape
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
          I am seeing a pattern around {displayedSnippet}. Let&rsquo;s keep going so I can get it right.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          You are roughly halfway to your first entry. A few more turns and I will propose a piece for your Manual. You will see it on a card and decide whether it fits.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          Honest expression produces sharper reflections than careful writing. Typos, tangents, going long &mdash; none of it matters. You can dictate if typing is slowing you down.
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
          Keep going ›
        </button>
      </div>
    </Modal>
  );
}
