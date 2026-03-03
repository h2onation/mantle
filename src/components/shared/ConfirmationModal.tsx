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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-backdrop-heavy)",
        padding: "32px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "320px",
          width: "100%",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--color-text)",
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
              color: "var(--color-text)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-divider)",
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
              color: isDestructive ? "var(--color-error)" : "var(--color-text)",
              backgroundColor: "transparent",
              border: isDestructive
                ? "1px solid var(--color-error)"
                : "1px solid var(--color-divider)",
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
