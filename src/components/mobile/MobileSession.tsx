"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import React from "react";
import MobileSoundSelector, { SoundIndicator } from "./MobileSoundSelector";
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
  isNewUser: boolean;
  sessionSummary: string | null;
  lastSessionDate: string | null;
  confirmedComponents: ManualComponent[];
  activeCheckpoint: ActiveCheckpoint | null;
  checkpointError: string | null;
  errorMessage: string | null;
  conversations: ConversationSummaryItem[];
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  confirmCheckpoint: (action: "confirmed" | "rejected" | "refined") => void;
  switchConversation: (id: string) => Promise<void>;
  startNewSession: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  onInputFocus: () => void;
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

function formatDaysSince(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "TODAY";
  if (days === 1) return "1 DAY SINCE LAST SESSION";
  return `${days} DAYS SINCE LAST SESSION`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export default function MobileSession({
  messages,
  isLoading,
  isStreaming,
  isNewUser,
  sessionSummary,
  lastSessionDate,
  confirmedComponents,
  activeCheckpoint,
  checkpointError,
  errorMessage,
  conversations,
  sendMessage,
  retryLastMessage,
  confirmCheckpoint,
  switchConversation,
  startNewSession,
  refreshConversations,
  onInputFocus,
}: MobileSessionProps) {
  const [sessionActive, setSessionActive] = useState(false);
  const [input, setInput] = useState("");
  const [newSessionInput, setNewSessionInput] = useState("");
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [focused, setFocused] = useState(false);
  const [newSessionFocused, setNewSessionFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newSessionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-activate when streaming starts
  useEffect(() => {
    if (isStreaming) setSessionActive(true);
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (sessionActive) scrollToBottom();
  }, [messages, sessionActive, scrollToBottom]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const wordCount = text.split(/\s+/).length;
    const isLongMessage = wordCount >= 100;

    setSessionActive(true);
    setInput("");
    setFocused(false);

    if (isLongMessage) {
      // Hold the expanded input for 1.5s before collapsing
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "44px";
        }
        sendMessage(text);
      }, 1500);
    } else {
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }
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
    const el = e.target;
    // Auto-grow: reset to minimum expanded height, then grow to content
    el.style.height = "120px";
    const maxHeight = window.innerHeight * 0.4;
    el.style.height = Math.max(120, Math.min(el.scrollHeight, maxHeight)) + "px";
  }

  function handleFocus() {
    setFocused(true);
    onInputFocus();
    if (textareaRef.current) {
      // Expand to ~4-5 visible lines (120px)
      textareaRef.current.style.height = "120px";
    }
  }

  function handleBlur() {
    if (!input.trim()) {
      setFocused(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }
    }
  }

  const handleCloseSoundMenu = useCallback(() => {
    setShowSoundMenu(false);
  }, []);

  // Compute stats
  const componentCount = confirmedComponents.length;
  const activeLayer = confirmedComponents.length > 0
    ? Math.max(...confirmedComponents.map((c) => c.layer))
    : 1;

  // Older sessions (exclude the current/most recent conversation)
  const olderSessions = conversations.slice(1);
  const hasConversations = conversations.length > 0;
  const hasHistory = !isNewUser && messages.length > 0;

  async function handleNewSessionSend() {
    const text = newSessionInput.trim();
    if (!text) return;
    setNewSessionInput("");
    setNewSessionFocused(false);
    if (newSessionTextareaRef.current) {
      newSessionTextareaRef.current.style.height = "44px";
    }
    await startNewSession();
    setSessionActive(true);
    sendMessage(text);
  }

  function handleNewSessionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNewSessionSend();
    }
  }

  async function handleSessionTap(convId: string) {
    await switchConversation(convId);
    setSessionActive(true);
  }

  async function handleReturnToIdle() {
    setSessionActive(false);
    await refreshConversations();
  }

  // ─── IDLE STATE ───
  if (!sessionActive) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Faint particles */}
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: "30%",
            width: "3px",
            height: "3px",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent-glow)",
            opacity: 0.5,
            animation: "sagePulse 4s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "14%",
            right: "25%",
            width: "2px",
            height: "2px",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent-glow)",
            opacity: 0.3,
            animation: "sagePulse 5s ease-in-out infinite 1s",
            pointerEvents: "none",
          }}
        />

        {/* Sound indicator */}
        <div style={{ position: "absolute", top: "16px", right: "24px", zIndex: 10 }}>
          <SoundIndicator onTap={() => setShowSoundMenu(!showSoundMenu)} />
          <MobileSoundSelector open={showSoundMenu} onClose={handleCloseSoundMenu} />
        </div>

        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: hasConversations ? "flex-end" : "flex-end",
            padding: "48px 24px 0",
          }}
        >
          {/* Hero card: most recent session */}
          {hasHistory && (
            <div style={{ marginBottom: "12px" }}>
              {lastSessionDate && (
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    color: "var(--color-text-ghost)",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    margin: "0 0 24px 0",
                  }}
                >
                  {formatDaysSince(lastSessionDate)}
                </p>
              )}

              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "22px",
                  color: "var(--color-text)",
                  lineHeight: 1.5,
                  letterSpacing: "-0.3px",
                  margin: "0 0 24px 0",
                }}
              >
                {sessionSummary || "Ready when you are."}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--color-accent-ghost)",
                  margin: "0 0 8px 0",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    color: "var(--color-accent-dim)",
                    letterSpacing: "1px",
                    margin: 0,
                  }}
                >
                  {componentCount} component{componentCount !== 1 ? "s" : ""} confirmed
                  {" · "}Layer {activeLayer} active
                </p>
                <button
                  onClick={() => setSessionActive(true)}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    color: "var(--color-accent)",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  CONTINUE
                </button>
              </div>
            </div>
          )}

          {/* Empty state for brand new users */}
          {!hasHistory && !hasConversations && (
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "22px",
                color: "var(--color-text)",
                lineHeight: 1.5,
                letterSpacing: "-0.3px",
                margin: "0 0 24px 0",
              }}
            >
              Ready when you are.
            </p>
          )}

          {/* Older sessions */}
          {olderSessions.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--color-text-ghost)",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  margin: "0 0 12px 0",
                }}
              >
                PREVIOUS SESSIONS
              </p>
              {olderSessions.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSessionTap(conv.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid var(--color-divider)",
                    padding: "14px 0",
                    cursor: "pointer",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "14px",
                      color: "var(--color-text-dim)",
                      lineHeight: 1.4,
                      margin: "0 0 6px 0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.summary || "Untitled session"}
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
                      {conv.message_count} MESSAGE{conv.message_count !== 1 ? "S" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New session input — pinned at bottom */}
        <div
          style={{
            padding: "12px 24px 16px",
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          {hasConversations && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "var(--color-text-ghost)",
                letterSpacing: "2px",
                textTransform: "uppercase",
                margin: "0 0 8px 0",
              }}
            >
              NEW SESSION
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
            }}
          >
            <textarea
              ref={hasConversations ? newSessionTextareaRef : textareaRef}
              value={hasConversations ? newSessionInput : input}
              onChange={hasConversations ? (e) => {
                setNewSessionInput(e.target.value);
                const el = e.target;
                el.style.height = "120px";
                const maxHeight = window.innerHeight * 0.4;
                el.style.height = Math.max(120, Math.min(el.scrollHeight, maxHeight)) + "px";
              } : handleInput}
              onKeyDown={hasConversations ? handleNewSessionKeyDown : handleKeyDown}
              onFocus={hasConversations ? () => {
                setNewSessionFocused(true);
                onInputFocus();
                if (newSessionTextareaRef.current) {
                  newSessionTextareaRef.current.style.height = "120px";
                }
              } : handleFocus}
              onBlur={hasConversations ? () => {
                if (!newSessionInput.trim()) {
                  setNewSessionFocused(false);
                  if (newSessionTextareaRef.current) {
                    newSessionTextareaRef.current.style.height = "44px";
                  }
                }
              } : handleBlur}
              placeholder={hasConversations ? "Begin a new session_" : "Begin anywhere_"}
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
                padding: "10px 0",
                height: "44px",
                maxHeight: (hasConversations ? newSessionFocused : focused) ? "40vh" : "44px",
                transition: "height 0.3s ease",
                overflow: (hasConversations ? newSessionFocused : focused) ? "auto" : "hidden",
              }}
            />
            <button
              onClick={hasConversations ? handleNewSessionSend : handleSend}
              disabled={hasConversations ? !newSessionInput.trim() || isLoading : !input.trim() || isLoading}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: `1px solid ${(hasConversations ? newSessionInput.trim() : input.trim()) ? "var(--color-accent)" : "var(--color-text-ghost)"}`,
                backgroundColor: "transparent",
                cursor: (hasConversations ? !newSessionInput.trim() : !input.trim()) || isLoading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginBottom: "2px",
              }}
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill={(hasConversations ? newSessionInput.trim() : input.trim()) ? "var(--color-accent)" : "var(--color-text-ghost)"}>
                <polygon points="5,1 9,8 1,8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ACTIVE STATE ───
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Back to sessions */}
      <button
        onClick={handleReturnToIdle}
        style={{
          position: "absolute",
          top: "12px",
          left: "16px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--color-text-ghost)" strokeWidth="1.5">
          <polyline points="7,2 3,6 7,10" />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            color: "var(--color-text-ghost)",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          SESSIONS
        </span>
      </button>

      {/* Sound indicator */}
      <div style={{ position: "absolute", top: "12px", right: "16px", zIndex: 10 }}>
        <SoundIndicator compact onTap={() => setShowSoundMenu(!showSoundMenu)} />
        <MobileSoundSelector open={showSoundMenu} onClose={handleCloseSoundMenu} />
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {messages.map((msg, i) => {
            if (msg.role === "system") return null;

            const isUser = msg.role === "user";
            const isCheckpoint = msg.isCheckpoint === true;
            const isPendingCheckpoint =
              isCheckpoint &&
              activeCheckpoint &&
              activeCheckpoint.messageId === msg.id;

            // Checkpoint rendering
            if (isCheckpoint) {
              return (
                <div
                  key={msg.id || `msg-${i}`}
                  style={{
                    margin: "40px 0",
                    padding: "0 28px",
                    textAlign: "center",
                    animation: "checkpointFadeIn 2s ease-out",
                  }}
                >
                  <div style={{ position: "relative", padding: "32px 0" }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(ellipse at center, var(--color-accent-glow) 0%, transparent 70%)",
                        borderRadius: "50%",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        fontFamily: "var(--font-serif)",
                        fontSize: "19px",
                        lineHeight: "1.75",
                        letterSpacing: "-0.2px",
                        color: "var(--color-text)",
                      }}
                    >
                      {renderMarkdown(msg.content)}
                    </div>
                  </div>

                  {isPendingCheckpoint && (
                    <div
                      style={{
                        marginTop: "20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontStyle: "italic",
                          fontSize: "14px",
                          color: "var(--color-text-ghost)",
                        }}
                      >
                        Does this feel right?
                      </span>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          onClick={() => confirmCheckpoint("confirmed")}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "var(--color-accent)",
                            background: "none",
                            border: "1px solid var(--color-accent-dim)",
                            borderRadius: "20px",
                            padding: "6px 16px",
                            cursor: "pointer",
                          }}
                        >
                          Yes, save this
                        </button>
                        <button
                          onClick={() => confirmCheckpoint("refined")}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "var(--color-text-ghost)",
                            background: "none",
                            border: "1px solid var(--color-divider)",
                            borderRadius: "20px",
                            padding: "6px 16px",
                            cursor: "pointer",
                          }}
                        >
                          Refine it
                        </button>
                        <button
                          onClick={() => confirmCheckpoint("rejected")}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "var(--color-text-ghost)",
                            background: "none",
                            border: "1px solid var(--color-divider)",
                            borderRadius: "20px",
                            padding: "6px 16px",
                            cursor: "pointer",
                          }}
                        >
                          Skip
                        </button>
                      </div>
                      {checkpointError && (
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            color: "var(--color-text-ghost)",
                          }}
                        >
                          {checkpointError}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // User message opacity
            let userOpacity = 1;
            if (isUser) {
              const userMsgIndices = messages
                .map((m, idx) => (m.role === "user" ? idx : -1))
                .filter((idx) => idx !== -1);
              const lastUserIdx = userMsgIndices[userMsgIndices.length - 1];
              userOpacity = i === lastUserIdx ? 0.75 : 0.5;
            }

            return (
              <div
                key={msg.id || `msg-${i}`}
                style={{
                  paddingRight: "32px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 400,
                  lineHeight: "1.65",
                  color: isUser ? "var(--color-text)" : "var(--color-text-dim)",
                  opacity: isUser ? userOpacity : 1,
                }}
              >
                {isUser ? msg.content : renderMarkdown(msg.content)}
              </div>
            );
          })}

          {/* Pulsing typing indicator */}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-accent-glow)",
                    animation: "sagePulse 2.5s ease-in-out infinite",
                  }}
                />
              </div>
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

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 24px 16px",
          borderTop: "1px solid var(--color-divider)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="_"
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
              padding: "10px 0",
              height: "44px",
              maxHeight: focused ? "40vh" : "44px",
              transition: "height 0.3s ease",
              overflow: focused ? "auto" : "hidden",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: `1px solid ${input.trim() ? "var(--color-accent)" : "var(--color-text-ghost)"}`,
              backgroundColor: "transparent",
              cursor: !input.trim() || isLoading ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginBottom: "2px",
            }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill={input.trim() ? "var(--color-accent)" : "var(--color-text-ghost)"}>
              <polygon points="5,1 9,8 1,8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
