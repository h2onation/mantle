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
  isNewUser?: boolean;
  sessionSummary?: string | null;
  lastSessionDate?: string | null;
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
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [focused, setFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const wordCount = text.split(/\s+/).length;
    const isLongMessage = wordCount >= 100;

    setInput("");
    setFocused(false);

    if (isLongMessage) {
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
    el.style.height = "120px";
    const maxHeight = window.innerHeight * 0.4;
    el.style.height = Math.max(120, Math.min(el.scrollHeight, maxHeight)) + "px";
  }

  function handleFocus() {
    setFocused(true);
    onInputFocus();
    if (textareaRef.current) {
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
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 24px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Empty state placeholder */}
        {!hasMessages && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
                padding: "0 24px",
              }}
            >
              Ready when you are.
            </p>
          </div>
        )}

        {/* Messages list */}
        {hasMessages && (
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

            {/* Typing indicator */}
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
        )}
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
            placeholder={hasMessages ? "_" : "Begin anywhere_"}
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
            disabled={!input.trim() || isLoading || isStreaming}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: `1px solid ${input.trim() ? "var(--color-accent)" : "var(--color-text-ghost)"}`,
              backgroundColor: "transparent",
              cursor: !input.trim() || isLoading || isStreaming ? "default" : "pointer",
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
