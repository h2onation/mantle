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
    <div
      style={{
        flexShrink: 0,
        padding: "var(--sp-sm) 16px var(--sp-sm)",
      }}
    >
      {/* Voice error toast — oxblood top-rule */}
      {voice.error && (
        <div
          style={{
            borderTop: "2px solid var(--session-error)",
            padding: "var(--sp-xs) 0",
            marginBottom: "var(--sp-xs)",
            animation: "checkpointFadeIn 0.3s ease-out both",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "14px",
              fontStyle: "italic",
              color: "var(--session-ink-mid)",
            }}
          >
            {voice.error}
          </span>
        </div>
      )}

      <div
        style={{
          position: "relative" as const,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "10px",
          background: "var(--session-bubble-user)",
          border: "1px solid var(--session-bubble-user-border)",
          borderRadius: "999px",
          padding: "10px 14px",
          backdropFilter: "blur(32px) saturate(150%)",
          WebkitBackdropFilter: "blur(32px) saturate(150%)",
          boxShadow: "var(--session-plate-shadow)",
        }}
      >
        {/* Visible placeholder — hides on focus or when text present.
            Positioned to align with the textarea's content edge: pill
            padding-left (14px) so the italic hint sits at the same
            x-coordinate the user's typed text will land at. */}
        {!input && !inputFocused && !isRecording && (
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: "var(--font-spectral), var(--font-persona), serif",
              fontSize: "15px",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--session-ink-faded)",
              pointerEvents: "none",
            }}
          >
            Write back to Jove…
          </span>
        )}

        {/* Waveform bars — visible during recording before transcript arrives */}
        {isRecording && !voice.transcript && (
          <div
            style={{
              position: "absolute" as const,
              left: "14px",
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
            fontStyle: "italic",
            lineHeight: 1.6,
            fontFamily: "var(--font-spectral), var(--font-persona), serif",
            padding: 0,
            boxSizing: "border-box",
            color:
              isRecording && voice.isInterim
                ? "var(--session-ink-faded)"
                : "var(--session-ink-soft)",
            caretColor: isRecording ? "transparent" : "var(--session-persona-soft)",
          }}
        />

        {/* Action button — 44px tap target (Apple minimum) */}
        {/* Send affordance — TextBtn pattern (SG §buttons::TextBtn).
            Mono-caps "send ›" with a thin ink rule beneath. Replaces an
            earlier sage-filled circle which was bubble-app chrome the
            SG explicitly forbids. Appears only when buttonMode is
            "send" — i.e. when there's text. */}
        {buttonMode === "send" && (
          <button
            onClick={handleButtonClick}
            disabled={disabled}
            aria-label="Send message"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "baseline",
              gap: "var(--sp-xs)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "2.6px",
              textTransform: "uppercase",
              color: "var(--session-ink)",
              paddingBottom: "4px",
              borderBottom: "1px solid var(--session-ink)",
              flexShrink: 0,
              animation: "mwFadeIn 0.15s ease-out both",
            }}
          >
            <span>send</span>
            <span aria-hidden="true" style={{ fontSize: 12, opacity: 0.85 }}>
              ›
            </span>
          </button>
        )}

        {/* Stop recording — pulsing sage square inside a 32px circular
            dark surface. Matches the PillComposer mic-slot dimensions
            from the dark-mode demo. */}
        {buttonMode === "stop" && (
          <button
            onClick={handleButtonClick}
            disabled={disabled}
            aria-label="Stop recording"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "var(--session-button-inset-strong)",
              flexShrink: 0,
              animation: "voicePulse 2s ease-in-out infinite, mwFadeIn 0.15s ease-out both",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                backgroundColor: "var(--session-persona)",
              }}
            />
          </button>
        )}

        {/* Mic — 32px circular dark surface containing a 14px stroke
            glyph. Matches the demo PillComposer's mic affordance:
            walnut-pill background, dark circular icon slot inside. */}
        {(buttonMode === "mic" || buttonMode === "mic-denied") && (
          <button
            onClick={handleButtonClick}
            disabled={disabled && buttonMode === "mic"}
            aria-label={
              buttonMode === "mic-denied"
                ? "Microphone access denied"
                : "Start voice recording"
            }
            style={{
              all: "unset",
              cursor:
                disabled && buttonMode === "mic" ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "var(--session-button-inset-strong)",
              flexShrink: 0,
              opacity:
                buttonMode === "mic-denied"
                  ? 0.5
                  : disabled && buttonMode === "mic"
                    ? 0.4
                    : 1,
              transition: "opacity 0.3s ease",
              animation: "mwFadeIn 0.15s ease-out both",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                buttonMode === "mic-denied"
                  ? "var(--session-error-text)"
                  : "var(--session-ink)"
              }
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="1" width="6" height="12" rx="3" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="18" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
