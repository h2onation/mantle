"use client";

import { useState } from "react";

interface CheckpointCardProps {
  content: string;
  name: string | null;
  onConfirm: () => void;
  onRefine: () => void;
  onReject: () => void;
  error?: string | null;
}

export default function CheckpointCard({
  content,
  name,
  onConfirm,
  onRefine,
  onReject,
  error,
}: CheckpointCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [fading, setFading] = useState(false);

  function handleConfirm() {
    setConfirmed(true);
    onConfirm();
  }

  function handleRefine() {
    setFading(true);
    setTimeout(() => onRefine(), 300);
  }

  function handleReject() {
    setFading(true);
    setTimeout(() => onReject(), 300);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--color-checkpoint-bg)",
        borderRadius: "12px",
        padding: "24px",
        margin: "16px 0",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {name && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            margin: "0 0 12px 0",
          }}
        >
          {name}
        </p>
      )}

      <div
        style={
          confirmed
            ? {
                borderLeft: "3px solid rgba(92, 107, 94, 0.4)",
                paddingLeft: "16px",
              }
            : {}
        }
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: "16px",
            lineHeight: 1.65,
            color: "var(--color-text-primary)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </p>
      </div>

      {!confirmed && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "20px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleConfirm}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--color-accent)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
            }}
          >
            Yes, that&apos;s me
          </button>
          <button
            onClick={handleRefine}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
            }}
          >
            Close, but...
          </button>
          <button
            onClick={handleReject}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "var(--color-text-secondary)",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
            }}
          >
            That&apos;s off
          </button>
        </div>
      )}

      {error && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--color-text-muted)",
            margin: "12px 0 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
