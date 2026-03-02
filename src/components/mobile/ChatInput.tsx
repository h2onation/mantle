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
    <div className="shrink-0 px-[16px] pt-[8px] mb-[10px]">
      {/* Voice error toast */}
      {voice.error && (
        <div
          style={{
            padding: "6px 12px",
            marginBottom: "6px",
            borderRadius: "8px",
            backgroundColor: "rgba(181, 86, 77, 0.12)",
            animation: "checkpointFadeIn 0.3s ease-out both",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "rgba(181, 86, 77, 0.7)",
            }}
          >
            {voice.error}
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
        {/* Input container */}
        <div
          className="relative rounded-[12px] transition-all duration-[400ms] ease-in-out"
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor:
              inputFocused || isRecording ? "#151311" : "transparent",
            border: `1px solid ${
              isRecording
                ? "rgba(122, 139, 114, 0.35)"
                : inputFocused
                  ? "rgba(122, 139, 114, 0.2)"
                  : "rgba(212, 203, 192, 0.12)"
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
            className="w-full bg-transparent border-none outline-none resize-none text-[14.5px] font-normal leading-[1.6]"
            style={{
              fontFamily: "var(--font-sans)",
              padding: "12px 16px",
              color:
                isRecording && voice.isInterim
                  ? "rgba(200, 191, 180, 0.5)"
                  : "#C8BFB4",
              caretColor: isRecording ? "transparent" : "#7A8B72",
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
              stroke="#7A8B72"
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
                  : "#7A8B72"
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
