"use client";

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
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-message"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--session-backdrop-heavy)",
        padding: "32px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--session-cream)",
          border: "1px solid var(--session-hair)",
          padding: "var(--sp-lg)",
          maxWidth: "320px",
          width: "100%",
        }}
      >
        <p
          id="confirm-modal-message"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            color: "var(--session-ink)",
            lineHeight: 1.6,
            margin: "0 0 var(--sp-md) 0",
          }}
        >
          {message}
        </p>
        <div style={{ borderTop: "1px solid var(--session-hair-soft)", paddingTop: "var(--sp-sm)", display: "flex", gap: "var(--sp-lg)" }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "15px",
              fontStyle: "italic",
              color: "var(--session-ink-mid)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "2.2px",
              textTransform: "uppercase",
              color: isDestructive ? "var(--session-error)" : "var(--session-ink)",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: `1px solid ${isDestructive ? "var(--session-error)" : "var(--session-ink)"}`,
              cursor: "pointer",
              padding: "0 0 2px",
            }}
          >
            {confirmLabel} &nbsp;›
          </button>
        </div>
      </div>
    </div>
  );
}
