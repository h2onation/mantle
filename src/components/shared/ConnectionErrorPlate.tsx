"use client";

interface ConnectionErrorPlateProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

// Quiet plate over the chat surface — same plate pattern as the
// checkpoint proposal, with an oxblood eyebrow and a retry/dismiss
// decision row. The error is treated as a moment in the conversation,
// not a takeover screen.
export default function ConnectionErrorPlate({
  message,
  onRetry,
  onDismiss,
}: ConnectionErrorPlateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        margin: "var(--sp-sm) 0",
        padding: "18px 20px 18px",
        borderRadius: 16,
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-error-border)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "var(--session-bubble-shadow)",
        animation: "checkpointFadeIn 0.3s ease-out both",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-error-text)",
        }}
      >
        Connection lost
      </p>
      <p
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 15.5,
          lineHeight: 1.6,
          color: "var(--session-ink)",
          letterSpacing: "-0.05px",
        }}
      >
        {message}
      </p>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {onRetry && (
          <button
            onClick={onRetry}
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
            Retry ›
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              all: "unset",
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 14,
              fontStyle: "italic",
              color: "var(--session-ink-mid)",
              cursor: "pointer",
            }}
          >
            dismiss
          </button>
        )}
      </div>
    </div>
  );
}
