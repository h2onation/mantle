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
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "320px",
          width: "100%",
        }}
      >
        <p
          id="confirm-modal-message"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--session-ink)",
            lineHeight: 1.6,
            margin: "0 0 20px 0",
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px 0",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--session-ink)",
              backgroundColor: "transparent",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "10px 0",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: isDestructive ? "var(--session-error)" : "var(--session-ink)",
              backgroundColor: "transparent",
              border: isDestructive
                ? "1px solid var(--session-error)"
                : "1px solid var(--session-ink-hairline)",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
