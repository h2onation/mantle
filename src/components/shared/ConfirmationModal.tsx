"use client";

import Modal from "./Modal";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  confirmLabel: string;
  isDestructive?: boolean;
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  message,
  confirmLabel,
  isDestructive,
}: ConfirmationModalProps) {
  const accent = isDestructive
    ? "var(--session-error)"
    : "var(--session-ink)";

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabelledBy="confirm-modal-message"
      destructive={isDestructive}
      maxWidth={340}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: isDestructive
            ? "var(--session-error-text)"
            : "var(--session-walnut-meta)",
        }}
      >
        {isDestructive ? "Confirm" : "Confirm"}
      </p>
      <p
        id="confirm-modal-message"
        style={{
          margin: "10px 0 22px",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 16,
          color: "var(--session-ink)",
          lineHeight: 1.55,
          letterSpacing: "-0.05px",
        }}
      >
        {message}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <button
          onClick={onClose}
          style={{
            all: "unset",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 15,
            fontStyle: "italic",
            color: "var(--session-ink-mid)",
            cursor: "pointer",
          }}
        >
          cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            all: "unset",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: accent,
            borderBottom: `1px solid ${accent}`,
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          {confirmLabel} ›
        </button>
      </div>
    </Modal>
  );
}
