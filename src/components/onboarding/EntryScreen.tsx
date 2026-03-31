"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const ROTATING_EXAMPLES = [
  ". . a conversation you keep replaying.",
  ". . a dynamic at work you can\u2019t quite name.",
  ". . a relationship shifted and you\u2019re not sure why.",
  ". . the pattern you can see but can\u2019t stop.",
  ". . a decision you keep circling but won\u2019t make.",
  ". . the advice you give everyone else doesn\u2019t work on you.",
  ". . the person you are at home isn\u2019t the person you are at work.",
  ". . you know exactly how to make people like you and it exhausts you.",
];

interface EntryScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
  onSignup: () => void;
}

export default function EntryScreen({ onGetStarted, onLogin, onSignup }: EntryScreenProps) {
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
    const interval = setInterval(advance, 4000);
    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [advance]);

  return (
    <div
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
          letterSpacing: "15px",
          color: "var(--session-ink-faded)",
          paddingLeft: 15,
        }}
      >
        MANTLE
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
          You understand yourself in fragments.
        </h1>

        {/* Subhead with rotating completions */}
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.4,
            color: "var(--session-ink-mid)",
            margin: "0 0 44px 0",
            minHeight: "76px",
          }}
        >
          <span>That&apos;s why </span>
          <span
            style={{
              opacity: visible ? 1 : 0,
              transition: "opacity 400ms ease",
            }}
          >
            {ROTATING_EXAMPLES[activeIndex]}
          </span>
        </div>

        {/* Get started button */}
        <button
          onClick={onGetStarted}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--session-cream)",
            backgroundColor: "var(--session-sage)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Get started
        </button>

        {/* Log in button */}
        <button
          onClick={onLogin}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--session-ink-mid)",
            backgroundColor: "transparent",
            border: "1px solid var(--session-ink-whisper)",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Log in
        </button>

        {/* Create account link */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--session-ink-ghost)",
            textAlign: "center",
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          No account?{" "}
          <button
            onClick={onSignup}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--session-sage)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Create account
          </button>
        </p>

        {/* Legal links */}
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "var(--session-ink-ghost)",
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
    </div>
  );
}
