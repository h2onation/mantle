"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  /** When true, the plate accents shift to oxblood (destructive variant). */
  destructive?: boolean;
  children: React.ReactNode;
  /** Width clamp. Default is the standard centered modal width. */
  maxWidth?: number;
}

// Centered walnut-glass modal. Renders a dark-backdrop overlay with a
// walnut-tinted plate at center. Handles body-scroll lock, focus return,
// Escape to close, and click-outside-to-close. Children are placed
// inside the plate's padding area — callers build their own eyebrow +
// heading + body using the Plate's typography conventions.
export default function Modal({
  open,
  onClose,
  ariaLabelledBy,
  destructive = false,
  children,
  maxWidth = 380,
}: ModalProps) {
  const plateRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Save previously focused element on open, restore on close. Focus
  // moves to the plate so screen readers announce the dialog content.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    plateRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Body-scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape dismisses.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const borderColor = destructive
    ? "rgba(208, 130, 120, 0.35)"
    : "rgba(170, 120, 82, 0.20)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        backgroundColor: "var(--session-backdrop-heavy)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={plateRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          padding: "24px 24px 22px",
          borderRadius: 18,
          background: "var(--session-walnut-surface)",
          border: `1px solid ${borderColor}`,
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.40), inset 0 1px 0 rgba(220,170,120,0.10)",
          boxSizing: "border-box",
          outline: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
