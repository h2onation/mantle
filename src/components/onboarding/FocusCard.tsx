"use client";

import { useState, useRef } from "react";

interface FocusCardProps {
  onSubmit: (text: string) => void;
}

export default function FocusCard({ onSubmit }: FocusCardProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasText) {
        onSubmit(value.trim());
      }
    }
  }

  function handleSend() {
    if (hasText) {
      onSubmit(value.trim());
    }
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
        border: "1px solid var(--color-divider)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        What&apos;s at the front of your mind right now?
      </p>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "16px",
          lineHeight: 1.65,
          color: "var(--color-text-dim)",
          margin: "8px 0 0 0",
        }}
      >
        A relationship, something at work, a pattern you keep running into —
        whatever&apos;s taking up space.
      </p>

      <div
        style={{
          marginTop: "24px",
          paddingTop: "12px",
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Begin anywhere. You don't need to have it fully formed."
          rows={1}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            resize: "none",
            backgroundColor: "transparent",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: "24px",
            color: "var(--color-text)",
            padding: "4px 0",
            minHeight: "48px",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!hasText}
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: `1px solid ${
              hasText ? "var(--color-accent)" : "var(--color-text-ghost)"
            }`,
            backgroundColor: "transparent",
            cursor: hasText ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginBottom: "2px",
          }}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 10 10"
            fill={hasText ? "var(--color-accent)" : "var(--color-text-ghost)"}
          >
            <polygon points="5,1 9,8 1,8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
