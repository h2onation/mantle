"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import React from "react";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

type ButtonMode = "mic" | "mic-denied" | "stop" | "send";

export default function ChatInput({
  onSend,
  disabled,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput();

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
    const lineHeight = 26; // 17px * 1.5 line-height ≈ 25.5, round up
    const maxHeight = lineHeight * 3.5; // ~91px — 3.5 lines, partial cutoff signals more text
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    // Auto-scroll to bottom so latest transcription text is always visible
    el.scrollTop = el.scrollHeight;
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

      if (currentTranscript) {
        setInput(currentTranscript);
      }
    } else {
      setInput("");
      await voice.startRecording();
    }
  }

  const hasText = input.trim().length > 0;

  // Single button swaps between states
  function getButtonMode(): ButtonMode {
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
    }
  }

  return (
    <div style={{ flexShrink: 0, padding: "8px 20px 4px" }}>
      {/* Voice error toast */}
      {voice.error && (
        <div
          style={{
            padding: "6px 12px",
            marginBottom: "6px",
            borderRadius: "8px",
            backgroundColor: "var(--session-error-ghost)",
            animation: "checkpointFadeIn 0.3s ease-out both",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--session-error-text)",
            }}
          >
            {voice.error}
          </span>
        </div>
      )}

      {/* Input container — underline style */}
      <div
        style={{
          position: "relative" as const,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "12px",
          borderBottom: `1px solid ${
            isRecording
              ? "var(--session-persona-soft)"
              : inputFocused
                ? "var(--session-persona-border)"
                : "var(--session-ink-whisper)"
          }`,
          paddingBottom: "8px",
          transition: "border-color 400ms ease-in-out",
        }}
      >
        {/* Visible placeholder — hides on focus or when text present */}
        {!input && !inputFocused && !isRecording && (
          <span
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: "var(--font-serif)",
              fontSize: "16px",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--session-ink-faded)",
              pointerEvents: "none",
            }}
          >
            tell me . . .
          </span>
        )}

        {/* Waveform bars — visible during recording before transcript arrives */}
        {isRecording && !voice.transcript && (
          <div
            style={{
              position: "absolute" as const,
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              height: "20px",
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: "2px",
                  height: "100%",
                  borderRadius: "1px",
                  backgroundColor: "var(--session-persona-soft)",
                  opacity: 0.6,
                  animation: "waveformBar 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
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
          name="chat-message"
          aria-label="Message"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck={true}
          inputMode="text"
          enterKeyHint="send"
          data-lpignore="true"
          data-1p-ignore
          style={{
            flex: 1,
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            resize: "none" as const,
            fontSize: "17px",
            fontWeight: 400,
            lineHeight: 1.5,
            fontFamily: "var(--font-sans)",
            padding: 0,
            boxSizing: "border-box",
            color:
              isRecording && voice.isInterim
                ? "rgba(200, 191, 180, 0.5)"
                : "var(--session-ink-soft)",
            caretColor: isRecording ? "transparent" : "var(--session-persona-soft)",
          }}
        />

        {/* Action button — 44px tap target (Apple minimum) */}
        <button
          onClick={handleButtonClick}
          disabled={disabled && buttonMode !== "stop"}
          aria-label={
            buttonMode === "send"
              ? "Send message"
              : buttonMode === "stop"
                ? "Stop recording"
                : buttonMode === "mic-denied"
                  ? "Microphone access denied"
                  : "Start voice recording"
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: "44px",
            height: "44px",
            background: "none",
            border: "none",
            cursor:
              disabled && buttonMode === "mic" ? "default" : "pointer",
            padding: 0,
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
          {/* Stop icon — filled circle with inner square */}
          {buttonMode === "stop" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "mwFadeIn 0.15s ease-out both",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "var(--session-persona-soft)",
                  opacity: 0.8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "voicePulse 2s ease-in-out infinite",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    backgroundColor: "#FFFFFF",
                  }}
                />
              </div>
            </div>
          )}

          {/* Send arrow — active state */}
          {buttonMode === "send" && (
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--session-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "mwFadeIn 0.15s ease-out both",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
          )}

          {/* Mic icon — inactive/ghosted */}
          {(buttonMode === "mic" || buttonMode === "mic-denied") && (
            <div style={{ animation: "mwFadeIn 0.15s ease-out both" }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={
                  buttonMode === "mic-denied"
                    ? "rgba(181, 86, 77, 0.5)"
                    : "var(--session-ink-ghost)"
                }
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="1" width="6" height="12" rx="3" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="18" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
