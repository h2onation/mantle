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
        maxWidth: "520px",
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        padding: "48px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          color: "var(--color-text-primary)",
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
          color: "var(--color-text-secondary)",
          margin: "8px 0 0 0",
        }}
      >
        A relationship, something at work, a pattern you keep running into —
        whatever&apos;s taking up space.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          backgroundColor: "var(--color-bg-input)",
          borderRadius: "12px",
          border: "1px solid var(--color-border)",
          padding: "8px 12px",
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
            fontSize: "15px",
            lineHeight: "24px",
            color: "var(--color-text-primary)",
            padding: "4px 0",
            minHeight: "48px",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!hasText}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "transparent",
            cursor: hasText ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={hasText ? "var(--color-accent)" : "var(--color-text-muted)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
