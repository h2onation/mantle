"use client";

import { useState, useRef, useLayoutEffect } from "react";
import React from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hasMessages: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea after every content change (type, paste, clear)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxLines = 6;
    const maxHeight = lineHeight * maxLines;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const wordCount = text.split(/\s+/).length;
    const isLongMessage = wordCount >= 100;

    setInput("");

    if (isLongMessage) {
      setTimeout(() => {
        onSend(text);
      }, 1500);
    } else {
      onSend(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
  }

  function handleFocus() {
    setInputFocused(true);
  }

  function handleBlur() {
    setInputFocused(false);
  }

  return (
    <div
      className="shrink-0 px-[16px] pt-[8px] mb-[10px]"
    >
      <div
        className="relative rounded-[12px] transition-all duration-[400ms] ease-in-out"
        style={{
          backgroundColor: inputFocused ? "#151311" : "transparent",
          border: `1px solid ${inputFocused ? "rgba(122, 139, 114, 0.2)" : "rgba(212, 203, 192, 0.12)"}`,
        }}
      >
        {/* Whisper placeholder */}
        {!input && !inputFocused && (
          <span
            style={{
              position: "absolute",
              left: "16px",
              top: "13px",
              color: "rgba(212, 203, 192, 0.28)",
              fontSize: "14.5px",
              fontFamily: "var(--font-sans)",
              fontWeight: 400,
              pointerEvents: "none",
            }}
          >
            say what comes to mind...
          </span>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder=""
          rows={1}
          className="w-full bg-transparent border-none outline-none resize-none text-[#C8BFB4] text-[14.5px] font-normal leading-[1.6] caret-[#7A8B72]"
          style={{
            fontFamily: "var(--font-sans)",
            padding: "12px 40px 12px 16px",
          }}
        />
        <div
          onClick={!input.trim() || disabled ? undefined : handleSend}
          style={{
            position: "absolute",
            right: "10px",
            bottom: "10px",
            opacity: input.trim() ? 1 : 0,
            transition: "opacity 0.3s ease",
            cursor: input.trim() ? "pointer" : "default",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7A8B72"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </div>
      </div>
    </div>
  );
}
