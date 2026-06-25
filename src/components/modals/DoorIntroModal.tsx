"use client";

import { useEffect, useRef } from "react";
import Modal from "@/components/shared/Modal";

interface DoorIntroModalProps {
  open: boolean;
  // Per-door copy, resolved by the caller (admin override or code default).
  eyebrow: string;
  title: string;
  body: string;
  onDismiss: () => void;
}

// One-time "how this works" intro shown the first time a user opens an intake
// door. Presentational: the caller supplies the door-specific copy and owns
// the seen-marking + analytics. (Formerly the single global ChatWindowModal;
// now driven per-door from the Intake doors admin panel.)
export default function DoorIntroModal({
  open,
  eyebrow,
  title,
  body,
  onDismiss,
}: DoorIntroModalProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Focus the dismiss button on open. Modal handles focus save/restore on
  // close — we override its default plate-focus with the actionable button.
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

  // Trailing period is rendered as a walnut accent (matches the welcome
  // header), so strip one from the title before re-adding it styled.
  const cleanTitle = title.replace(/\.\s*$/, "");
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      ariaLabelledBy="door-intro-modal-heading"
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
        {eyebrow}
      </p>
      <h2
        id="door-intro-modal-heading"
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
        {cleanTitle}
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
        {paragraphs.map((para, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : "12px 0 0" }}>
            {para}
          </p>
        ))}
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
