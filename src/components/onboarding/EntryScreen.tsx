"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const ROTATING_EXAMPLES = [
  "You shut down and people think you\u2019re upset. You\u2019re not. You\u2019re recalibrating.",
  "You see the pattern everyone else is missing.",
  "You know exactly what you need but can\u2019t say it in the moment.",
  "When you lock in, you go deeper than anyone in the room.",
  "Plans changed and your whole system locked up.",
  "You remember what people said three months ago and act on it. That\u2019s how you care.",
  "You mask all day and no one knows what that costs.",
  "You hold the room together and nobody notices because you make it look easy.",
  "You rehearse conversations before you have them.",
  "The people you love get a version of loyalty most people don\u2019t know exists.",
];

interface EntryScreenProps {
  onLogin: () => void;
}

export default function EntryScreen({ onLogin }: EntryScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setVisible(false);
    timeoutRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % ROTATING_EXAMPLES.length);
      setVisible(true);
    }, 400);
  }, []);

  useEffect(() => {
    const interval = setInterval(advance, 4500);
    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [advance]);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Wordmark (top center) */}
      <div
        style={{
          padding: "16px 0",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "4px",
          color: "var(--session-ink-faded)",
          paddingLeft: 4,
        }}
      >
        my walnut
      </div>

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 56px" }}>
        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 34,
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            color: "var(--session-ink)",
            margin: "0 0 14px 0",
          }}
        >
          Map your operating system.
        </h1>

        {/* Static sub */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.4,
            color: "var(--session-ink-mid)",
            margin: "0 0 20px 0",
          }}
        >
          Navigate the world with it. Share it with the people around you.
        </p>

        {/* Rotating standalone sentences */}
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 400,
            fontStyle: "italic",
            lineHeight: 1.45,
            color: "var(--session-ink-mid)",
            margin: "0 0 40px 0",
            minHeight: "92px",
            opacity: visible ? 1 : 0,
            transition: "opacity 400ms ease",
          }}
        >
          {ROTATING_EXAMPLES[activeIndex]}
        </div>

        {/* Log in button (primary) */}
        <button
          onClick={onLogin}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--session-cream)",
            backgroundColor: "var(--session-ink)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          Log in
        </button>

        {/* Waitlist link (secondary) */}
        <div
          style={{
            textAlign: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--session-ink-mid)",
          }}
        >
          <a
            href="/waitlist"
            style={{
              color: "var(--session-ink-mid)",
              textDecoration: "none",
              borderBottom: "1px solid var(--session-ink-whisper)",
              paddingBottom: 1,
            }}
          >
            Join the waitlist
          </a>
        </div>

        {/* Legal links */}
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "var(--session-ink-mid)",
          }}
        >
          <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
            Privacy Policy
          </a>
          <span style={{ margin: "0 6px" }}>&middot;</span>
          <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
            Terms of Service
          </a>
        </div>
      </div>
    </main>
  );
}
