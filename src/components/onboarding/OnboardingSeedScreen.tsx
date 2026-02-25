"use client";

import { useState, useRef } from "react";

interface OnboardingSeedScreenProps {
  onSubmit: (text: string) => void;
  contentVisible: boolean;
}

function staggerStyle(visible: boolean, delayMs: number): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 300ms ease, transform 300ms ease",
    transitionDelay: visible ? `${delayMs}ms` : "0ms",
  };
}

export default function OnboardingSeedScreen({
  onSubmit,
  contentVisible,
}: OnboardingSeedScreenProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && hasText) {
      e.preventDefault();
      onSubmit(value.trim());
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: "160px",
        left: "28px",
        right: "28px",
      }}
    >
      {/* Prompt text */}
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: 1.7,
          color: "var(--color-text-dim)",
          margin: "0 0 24px 0",
          ...staggerStyle(contentVisible, 0),
        }}
      >
        Let&apos;s discuss a situation that&apos;s on your mind right now. It could be a
        conversation that went sideways, a decision you&apos;re stuck on, a dynamic
        with someone that keeps playing out the same way. There&apos;s no wrong
        place to start.
      </p>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind..."
        rows={4}
        style={{
          width: "100%",
          minHeight: "110px",
          backgroundColor: "transparent",
          border: "1px solid var(--color-accent-dim)",
          borderRadius: "12px",
          padding: "16px",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: "24px",
          color: "var(--color-text)",
          resize: "none",
          outline: "none",
          boxSizing: "border-box",
          ...staggerStyle(contentVisible, 150),
        }}
      />

      {/* Let's go button */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "20px",
          ...staggerStyle(contentVisible, 300),
        }}
      >
        <button
          onClick={() => hasText && onSubmit(value.trim())}
          disabled={!hasText}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 500,
            color: hasText ? "#1C1917" : "var(--color-text-ghost)",
            backgroundColor: hasText ? "var(--color-accent)" : "transparent",
            border: hasText ? "1px solid var(--color-accent)" : "1px solid var(--color-divider)",
            borderRadius: "10px",
            padding: "12px 24px",
            cursor: hasText ? "pointer" : "default",
            transition: "all 0.3s ease",
          }}
        >
          Let&apos;s go &rarr;
        </button>
      </div>
    </div>
  );
}
