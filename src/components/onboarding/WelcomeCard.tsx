"use client";

import { useState, useRef, useEffect } from "react";

interface WelcomeCardProps {
  onReady: () => void;
  onDismiss: () => void;
}

export default function WelcomeCard({ onReady, onDismiss }: WelcomeCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissFading, setDismissFading] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  function handleDismiss() {
    setDismissed(true);
    const t1 = setTimeout(() => {
      setDismissFading(true);
      const t2 = setTimeout(() => onDismiss(), 300);
      timersRef.current.push(t2);
    }, 2500);
    timersRef.current.push(t1);
  }

  if (dismissed) {
    return (
      <div
        style={{
          maxWidth: "calc(100vw - 48px)",
          width: "100%",
          backgroundColor: "var(--color-surface)",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
          opacity: dismissFading ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            lineHeight: 1.75,
            color: "var(--color-text)",
            margin: 0,
            textAlign: "center",
          }}
        >
          I&apos;ll be here when you are.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "calc(100vw - 48px)",
        width: "100%",
        backgroundColor: "var(--color-surface)",
        borderRadius: "16px",
        padding: "32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            lineHeight: 1.75,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Mantle builds a working model of how you operate — what drives you,
          how you react, and how you relate to others.
        </p>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            lineHeight: 1.75,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Your manual builds as you go. You validate every piece. Nothing writes
          without your say.
        </p>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            lineHeight: 1.75,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          This takes about 20 minutes. Can you invest that now in a focused
          setting?
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px",
          marginTop: "32px",
        }}
      >
        <button
          onClick={handleDismiss}
          style={{
            padding: "12px 28px",
            backgroundColor: "transparent",
            color: "var(--color-text-ghost)",
            border: "1px solid var(--color-divider)",
            borderRadius: "8px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Not right now
        </button>
        <button
          onClick={onReady}
          style={{
            padding: "12px 28px",
            backgroundColor: "transparent",
            color: "var(--color-text)",
            border: "1px solid var(--color-divider)",
            borderRadius: "8px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          I&apos;m ready
        </button>
      </div>
    </div>
  );
}
