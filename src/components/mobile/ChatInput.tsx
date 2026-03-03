"use client";

import { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import React from "react";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  voiceAutoSend: boolean;
}

type ButtonMode = "mic" | "mic-denied" | "stop" | "send" | "edit";

export default function ChatInput({
  onSend,
  disabled,
  voiceAutoSend,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAutoSubmit = useCallback(
    (text: string) => {
      onSend(text);
    },
    [onSend]
  );

  const voice = useVoiceInput({
    onAutoSubmit: handleAutoSubmit,
    autoSend: voiceAutoSend,
  });

  const isRecording = voice.recordingState !== "idle";

  // Sync voice transcript into the textarea display
  useEffect(() => {
    if (isRecording && voice.transcript) {
      setInput(voice.transcript);
    }
  }, [isRecording, voice.transcript]);

  // Auto-resize textarea after every content change
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

  // Auto-dismiss voice error after 3s
  useEffect(() => {
    if (voice.error) {
      const t = setTimeout(() => {
        // error auto-clears on next startRecording call
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [voice.error]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    // If recording, stop it first
    if (isRecording) {
      voice.stopRecording();
      voice.clearTranscript();
    }

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
    // If user starts typing while recording, stop recording
    if (isRecording) {
      voice.stopRecording();
    }
    setInput(e.target.value);
  }

  function handleFocus() {
    setInputFocused(true);
  }

  function handleBlur() {
    setInputFocused(false);
  }

  async function handleMicToggle() {
    if (isRecording) {
      const currentTranscript = voice.transcript.trim();
      voice.stopRecording();

      if (!voiceAutoSend && currentTranscript) {
        setInput(currentTranscript);
      }
    } else {
      setInput("");
      await voice.startRecording();
    }
  }

  function handleCancelCountdown() {
    voice.cancelCountdown();
  }

  const hasText = input.trim().length > 0;

  // Single button swaps between states
  function getButtonMode(): ButtonMode {
    if (voice.countdownActive) return "edit";
    if (isRecording) return "stop";
    if (hasText) return "send";
    if (voice.micPermission === "denied") return "mic-denied";
    return "mic";
  }

  const buttonMode = getButtonMode();

  function handleButtonClick() {
    switch (buttonMode) {
      case "send":
        handleSend();
        break;
      case "mic":
      case "mic-denied":
      case "stop":
        handleMicToggle();
        break;
      case "edit":
        handleCancelCountdown();
        break;
    }
  }

  return (
    <div style={{ flexShrink: 0, paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", marginBottom: "10px" }}>
      {/* Voice error toast */}
      {voice.error && (
        <div
          style={{
            padding: "6px 12px",
            marginBottom: "6px",
            borderRadius: "8px",
            backgroundColor: "var(--color-error-ghost)",
            animation: "checkpointFadeIn 0.3s ease-out both",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--color-error-text)",
            }}
          >
            {voice.error}
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
        {/* Input container */}
        <div
          style={{
            position: "relative" as const,
            borderRadius: "12px",
            transition: "all 400ms ease-in-out",
            flex: 1,
            minWidth: 0,
            backgroundColor:
              inputFocused || isRecording ? "var(--color-surface-sage)" : "transparent",
            border: `1px solid ${
              isRecording
                ? "var(--color-input-border-active)"
                : inputFocused
                  ? "var(--color-input-border-focus)"
                  : "var(--color-input-border)"
            }`,
          }}
        >
          {/* Whisper placeholder */}
          {!input && !inputFocused && !isRecording && (
            <span
              style={{
                position: "absolute",
                left: "16px",
                top: "13px",
                color: "var(--color-input-placeholder)",
                fontSize: "14.5px",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
                pointerEvents: "none",
              }}
            >
              say what comes to mind...
            </span>
          )}

          {/* Countdown highlight overlay */}
          {voice.countdownActive && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "12px",
                backgroundColor: "var(--color-accent-ghost)",
                pointerEvents: "none",
                animation: "checkpointFadeIn 0.2s ease-out both",
              }}
            />
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
            readOnly={voice.countdownActive}
            style={{
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              resize: "none" as const,
              fontSize: "14.5px",
              fontWeight: 400,
              lineHeight: 1.6,
              fontFamily: "var(--font-sans)",
              padding: "12px 16px",
              color:
                isRecording && voice.isInterim
                  ? "rgba(200, 191, 180, 0.5)"
                  : "var(--color-input-text)",
              caretColor: isRecording ? "transparent" : "var(--color-accent-muted)",
            }}
          />
        </div>

        {/* Single swap button — outside the input */}
        <button
          onClick={handleButtonClick}
          disabled={disabled && buttonMode !== "stop" && buttonMode !== "edit"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor:
              disabled && buttonMode === "mic" ? "default" : "pointer",
            padding: 0,
            marginBottom: "4px",
            WebkitTapHighlightColor: "transparent",
            opacity:
              buttonMode === "mic-denied"
                ? 0.35
                : disabled && buttonMode === "mic"
                  ? 0.3
                  : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          {/* Stop icon with pulse ring */}
          {buttonMode === "stop" && (
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  border: "1px solid var(--color-accent)",
                  opacity: 0.4,
                  animation: "voicePulse 2s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: "var(--color-accent)",
                }}
              />
            </div>
          )}

          {/* Send arrow */}
          {buttonMode === "send" && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}

          {/* Mic icon */}
          {(buttonMode === "mic" || buttonMode === "mic-denied") && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                buttonMode === "mic-denied"
                  ? "rgba(181, 86, 77, 0.5)"
                  : "var(--color-accent-muted)"
              }
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="1" width="6" height="12" rx="3" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="18" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}

          {/* Edit pill during countdown */}
          {buttonMode === "edit" && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "var(--color-accent)",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              EDIT
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
