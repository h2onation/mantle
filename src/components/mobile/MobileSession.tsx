"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import React from "react";
import MobileSoundSelector, { SoundIndicator } from "./MobileSoundSelector";
import SessionParticles from "./SessionParticles";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  isCheckpoint?: boolean;
  checkpointMeta?: {
    layer: number;
    type: string;
    name: string | null;
    status: string;
  } | null;
}

interface ManualComponent {
  id: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
  created_at?: string;
}

interface ActiveCheckpoint {
  messageId: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

interface MobileSessionProps {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isNewUser?: boolean;
  sessionSummary?: string | null;
  lastSessionDate?: string | null;
  confirmedComponents: ManualComponent[];
  activeCheckpoint: ActiveCheckpoint | null;
  checkpointError: string | null;
  processingText: string | null;
  errorMessage: string | null;
  conversations: ConversationSummaryItem[];
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  confirmCheckpoint: (action: "confirmed" | "rejected" | "refined") => void;
  switchConversation: (id: string) => Promise<void>;
  startNewSession: () => Promise<void>;
  refreshConversations: () => Promise<void>;
}

function renderMarkdown(text: string) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const parts: (string | React.ReactElement)[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let keyIdx = 0;
    while ((match = regex.exec(para)) !== null) {
      if (match.index > lastIndex) {
        parts.push(para.slice(lastIndex, match.index));
      }
      parts.push(<strong key={keyIdx++}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < para.length) {
      parts.push(para.slice(lastIndex));
    }
    const withBreaks: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part === "string") {
        const lines = part.split("\n");
        lines.forEach((line, j) => {
          if (j > 0) withBreaks.push(<br key={`br-${keyIdx++}`} />);
          withBreaks.push(line);
        });
      } else {
        withBreaks.push(part);
      }
    }
    return (
      <p key={i} style={{ margin: i === 0 ? 0 : "12px 0 0 0" }}>
        {withBreaks}
      </p>
    );
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export default function MobileSession({
  messages,
  conversationId,
  isLoading,
  isStreaming,
  activeCheckpoint,
  checkpointError,
  processingText,
  errorMessage,
  conversations,
  sendMessage,
  retryLastMessage,
  confirmCheckpoint,
  switchConversation,
  startNewSession,
  refreshConversations,
}: MobileSessionProps) {
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [isConverging, setIsConverging] = useState(false);
  const [checkpointActionState, setCheckpointActionState] = useState<"confirmed" | "refined" | "rejected" | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCheckpointRef = useRef<ActiveCheckpoint | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  // Trigger particle convergence when a checkpoint arrives
  useEffect(() => {
    if (activeCheckpoint && !prevCheckpointRef.current) {
      setIsConverging(true);
      setCheckpointActionState(null);
      const timer = setTimeout(() => setIsConverging(false), 1500);
      return () => clearTimeout(timer);
    }
    prevCheckpointRef.current = activeCheckpoint;
  }, [activeCheckpoint]);

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
        sendMessage(text);
      }, 1500);
    } else {
      sendMessage(text);
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

  const handleCloseSoundMenu = useCallback(() => {
    setShowSoundMenu(false);
  }, []);

  async function handleDrawerNewSession() {
    setDrawerOpen(false);
    await startNewSession();
  }

  async function handleDrawerSelectSession(convId: string) {
    setDrawerOpen(false);
    await switchConversation(convId);
  }

  async function handleOpenDrawer() {
    setDrawerOpen(true);
    await refreshConversations();
  }

  const hasMessages = messages.length > 0;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        {/* Menu button — left */}
        <button
          onClick={handleOpenDrawer}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 4px",
            minWidth: "44px",
            minHeight: "44px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "16px",
                height: "1px",
                backgroundColor: "var(--color-text-ghost)",
              }}
            />
          ))}
        </button>

        {/* Logo — center */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          MANTLE
        </span>

        {/* Sound indicator — right */}
        <div
          style={{
            minWidth: "44px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <SoundIndicator compact onTap={() => setShowSoundMenu(!showSoundMenu)} />
          <MobileSoundSelector open={showSoundMenu} onClose={handleCloseSoundMenu} />
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 3%, rgba(0,0,0,0.4) 6%, rgba(0,0,0,0.7) 10%, rgba(0,0,0,0.9) 14%, black 18%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 3%, rgba(0,0,0,0.4) 6%, rgba(0,0,0,0.7) 10%, rgba(0,0,0,0.9) 14%, black 18%)",
        }}
      >
        <SessionParticles messageCount={messages.length} converge={isConverging} />
        {/* Spacer pushes messages to bottom of viewport */}
        <div style={{ flexGrow: 1, minHeight: "24px" }} />

        {/* Empty state placeholder */}
        {!hasMessages && !isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "22px",
                color: "var(--color-text-ghost)",
                lineHeight: 1.5,
                letterSpacing: "-0.3px",
                textAlign: "center",
              }}
            >
              Ready when you are.
            </p>
          </div>
        )}

            {messages.map((msg, i) => {
              if (msg.role === "system") return null;

              const isUser = msg.role === "user";
              const isCheckpoint = msg.isCheckpoint === true;
              const isPendingCheckpoint =
                isCheckpoint &&
                activeCheckpoint &&
                activeCheckpoint.messageId === msg.id;

              // Checkpoint rendering — warm glow card
              if (isCheckpoint) {
                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 0.45s ease-out both",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#302820",
                        borderRadius: "6px",
                        margin: "16px",
                        padding: "20px 20px 24px",
                        animation: "warmPulse 7s ease-in-out infinite",
                      }}
                    >
                      {/* Sage label */}
                      <div style={{ paddingBottom: "12px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            fontWeight: 500,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: "#7A8B72",
                          }}
                        >
                          Sage
                        </span>
                      </div>
                      {/* Body */}
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "15px",
                          lineHeight: 1.7,
                          fontWeight: 430,
                          color: "#D4CBC0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {renderMarkdown(msg.content)}
                      </div>

                      {/* Action buttons */}
                      {isPendingCheckpoint && !checkpointActionState ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "20px",
                            paddingTop: "16px",
                            borderTop: "1px solid rgba(212, 203, 192, 0.08)",
                          }}
                        >
                          <button
                            onClick={() => {
                              setCheckpointActionState("confirmed");
                              confirmCheckpoint("confirmed");
                            }}
                            style={{
                              background: "rgba(122, 139, 114, 0.15)",
                              border: "1px solid rgba(122, 139, 114, 0.25)",
                              borderRadius: "6px",
                              padding: "8px 14px",
                              color: "#A8B89F",
                              fontFamily: "var(--font-sans)",
                              fontSize: "12.5px",
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 0.25s ease",
                              letterSpacing: "0.01em",
                            }}
                          >
                            Write to manual
                          </button>
                          <button
                            onClick={() => {
                              setCheckpointActionState("refined");
                              confirmCheckpoint("refined");
                            }}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(212, 203, 192, 0.1)",
                              borderRadius: "6px",
                              padding: "8px 14px",
                              color: "rgba(212, 203, 192, 0.5)",
                              fontFamily: "var(--font-sans)",
                              fontSize: "12.5px",
                              fontWeight: 450,
                              cursor: "pointer",
                              transition: "all 0.25s ease",
                              letterSpacing: "0.01em",
                            }}
                          >
                            Not quite
                          </button>
                          <button
                            onClick={() => {
                              setCheckpointActionState("rejected");
                              confirmCheckpoint("rejected");
                            }}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(212, 203, 192, 0.1)",
                              borderRadius: "6px",
                              padding: "8px 14px",
                              color: "rgba(212, 203, 192, 0.35)",
                              fontFamily: "var(--font-sans)",
                              fontSize: "12.5px",
                              fontWeight: 450,
                              cursor: "pointer",
                              transition: "all 0.25s ease",
                              letterSpacing: "0.01em",
                            }}
                          >
                            Not at all
                          </button>
                        </div>
                      ) : isPendingCheckpoint && checkpointActionState ? (
                        <div
                          style={{
                            marginTop: "20px",
                            paddingTop: "16px",
                            borderTop: "1px solid rgba(212, 203, 192, 0.08)",
                            animation: "checkpointFadeIn 0.4s ease-out both",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 500,
                              letterSpacing: "0.08em",
                              color: checkpointActionState === "confirmed"
                                ? "rgba(122, 139, 114, 0.7)"
                                : "rgba(212, 203, 192, 0.4)",
                            }}
                          >
                            {checkpointActionState === "confirmed" && "Written to manual"}
                            {checkpointActionState === "refined" && "Sage will revisit this"}
                            {checkpointActionState === "rejected" && "Discarded"}
                          </span>
                        </div>
                      ) : null}

                      {/* Already-resolved checkpoints (loaded from DB) */}
                      {isCheckpoint && !isPendingCheckpoint && msg.checkpointMeta?.status && msg.checkpointMeta.status !== "pending" && (
                        <div
                          style={{
                            marginTop: "20px",
                            paddingTop: "16px",
                            borderTop: "1px solid rgba(212, 203, 192, 0.08)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 500,
                              letterSpacing: "0.08em",
                              color: msg.checkpointMeta.status === "confirmed"
                                ? "rgba(122, 139, 114, 0.7)"
                                : "rgba(212, 203, 192, 0.4)",
                            }}
                          >
                            {msg.checkpointMeta.status === "confirmed" && "Written to manual"}
                            {msg.checkpointMeta.status === "refined" && "Sage will revisit this"}
                            {msg.checkpointMeta.status === "rejected" && "Discarded"}
                          </span>
                        </div>
                      )}

                      {checkpointError && isPendingCheckpoint && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            color: "var(--color-text-ghost)",
                            marginTop: "12px",
                            display: "block",
                          }}
                        >
                          {checkpointError}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Sequence detection: checkpoints break Sage sequences
              const isFirstInSageSequence = (() => {
                if (msg.role !== "assistant") return false;
                if (i === 0) return true;
                const prev = messages[i - 1];
                if (!prev || prev.role === "system") return true;
                return prev.role !== "assistant" || prev.isCheckpoint === true;
              })();

              const isLastInSageSequence = (() => {
                if (msg.role !== "assistant") return false;
                if (i === messages.length - 1) {
                  if (isLoading) return false;
                  return true;
                }
                const next = messages[i + 1];
                if (!next || next.role === "system") return true;
                return next.role !== "assistant" || next.isCheckpoint === true;
              })();

              // Normal message rendering with Sage panel
              if (!isUser) {
                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 0.45s ease-out both",
                    }}
                  >
                    {/* Sage label */}
                    {isFirstInSageSequence && (
                      <div
                        style={{
                          padding: "0 28px",
                          paddingTop: i === 0 ? "0" : "8px",
                          paddingBottom: "10px",
                          backgroundColor: "#262220",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            fontWeight: 500,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: "#7A8B72",
                          }}
                        >
                          Sage
                        </span>
                      </div>
                    )}
                    {/* Message */}
                    <div
                      style={{
                        padding: "0 28px",
                        paddingTop: isFirstInSageSequence ? "0" : "14px",
                        paddingBottom: isLastInSageSequence ? "22px" : "0",
                        backgroundColor: "#262220",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "15px",
                          lineHeight: 1.7,
                          fontWeight: 430,
                          color: "#D4CBC0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {renderMarkdown(msg.content)}
                      </div>
                    </div>
                  </div>
                );
              }

              // User message
              return (
                <div
                  key={msg.id || `msg-${i}`}
                  style={{
                    padding: "0 28px 0 48px",
                    paddingTop: "22px",
                    paddingBottom: "22px",
                    animation: "checkpointFadeIn 0.45s ease-out both",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      lineHeight: 1.7,
                      fontWeight: 400,
                      color: "#C0B8AD",
                      letterSpacing: "0.01em",
                      margin: 0,
                    }}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            })}

            {/* Processing dots */}
            {isLoading &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                <div
                  style={{
                    padding: "16px 28px 20px",
                    backgroundColor: "#262220",
                    animation: "checkpointFadeIn 0.3s ease-out both",
                  }}
                >
                  {/* Show Sage label when prev message was user or checkpoint */}
                  {messages.length === 0 ||
                  messages[messages.length - 1]?.role !== "assistant" ||
                  messages[messages.length - 1]?.isCheckpoint === true ? (
                    <div style={{ paddingBottom: "8px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          fontWeight: 500,
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: "#7A8B72",
                        }}
                      >
                        Sage
                      </span>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "8px 0" }}>
                    {[0, 1, 2].map((dotIdx) => (
                      <div
                        key={dotIdx}
                        style={{
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          backgroundColor: "#7A8B72",
                          opacity: 0.5,
                          animation: "sagePulse 2.4s ease-in-out infinite",
                          animationDelay: `${dotIdx * 0.35}s`,
                        }}
                      />
                    ))}
                  </div>
                  {processingText && processingText !== "listening..." && (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        letterSpacing: "1.5px",
                        textTransform: "lowercase",
                        color: "var(--color-text-ghost)",
                        opacity: 0.5,
                        paddingTop: "4px",
                        animation: "processingTextFadeIn 0.8s ease-out",
                      }}
                    >
                      {processingText}
                    </div>
                  )}
                </div>
              )}

            {/* Bottom spacer for checkpoint glow breathing room */}
            {messages.length > 0 &&
             messages[messages.length - 1]?.isCheckpoint === true &&
             !isLoading && (
              <div style={{ height: "40px", flexShrink: 0 }} />
            )}

            {/* Error */}
            {errorMessage && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "12px 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--color-text-ghost)",
                    }}
                  >
                    {errorMessage}
                  </span>
                  <button
                    onClick={retryLastMessage}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--color-accent)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
      </div>

      {/* Input */}
      <div
        style={{
          flexShrink: 0,
          padding: "8px 16px 0",
        }}
      >
        <div
          style={{
            position: "relative",
            backgroundColor: "#242120",
            borderRadius: "14px",
            border: `1px solid ${inputFocused ? "rgba(122, 139, 114, 0.4)" : "rgba(122, 139, 114, 0.15)"}`,
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder=""
            rows={2}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: "#C8BFB4",
              fontFamily: "'Outfit', sans-serif",
              fontSize: "14.5px",
              fontWeight: 400,
              lineHeight: 1.6,
              padding: "12px 44px 12px 16px",
              caretColor: "#7A8B72",
            }}
          />
          <div
            onClick={!input.trim() || isLoading || isStreaming ? undefined : handleSend}
            style={{
              position: "absolute",
              right: "10px",
              bottom: "10px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: input.trim()
                ? "rgba(122, 139, 114, 0.2)"
                : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.3s ease",
              cursor: input.trim() ? "pointer" : "default",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={input.trim() ? "#7A8B72" : "rgba(212, 203, 192, 0.15)"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: "stroke 0.3s ease" }}
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── DRAWER OVERLAY ─── */}
      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 200,
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "80vw",
          maxWidth: "320px",
          backgroundColor: "var(--color-surface)",
          zIndex: 201,
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 48px)",
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px 16px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-text-ghost)",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            SESSIONS
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text-ghost)" strokeWidth="1.5">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* New session button */}
        <div style={{ padding: "0 20px 16px" }}>
          <button
            onClick={handleDrawerNewSession}
            style={{
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-accent)",
              background: "none",
              border: "1px solid var(--color-accent-ghost)",
              borderRadius: "8px",
              padding: "12px 16px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            New session
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--color-divider)", margin: "0 20px" }} />

        {/* Session list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {conversations.map((conv) => {
            const isActive = conv.id === conversationId;
            return (
              <button
                key={conv.id}
                onClick={() => handleDrawerSelectSession(conv.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderLeft: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                  borderBottom: "1px solid var(--color-divider)",
                  padding: "14px 20px 14px 18px",
                  cursor: "pointer",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: isActive ? "var(--color-text)" : "var(--color-text-dim)",
                    lineHeight: 1.4,
                    margin: "0 0 6px 0",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {conv.summary || conv.preview || "Untitled session"}
                </p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-text-ghost)",
                      letterSpacing: "1px",
                    }}
                  >
                    {formatShortDate(conv.updated_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-text-ghost)",
                      letterSpacing: "1px",
                    }}
                  >
                    {conv.message_count} message{conv.message_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            );
          })}

          {conversations.length === 0 && (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-text-ghost)",
                padding: "20px",
                textAlign: "center",
              }}
            >
              No sessions yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
