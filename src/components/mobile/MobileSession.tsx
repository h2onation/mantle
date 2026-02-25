"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
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
  const [checkpointJustArrived, setCheckpointJustArrived] = useState(false);
  const [checkpointActionState, setCheckpointActionState] = useState<"confirmed" | "refined" | "rejected" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCheckpointRef = useRef<ActiveCheckpoint | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Checkpoint transition: fade in first, then start warm pulse
  useEffect(() => {
    if (activeCheckpoint && !prevCheckpointRef.current) {
      setCheckpointJustArrived(true);
      setCheckpointActionState(null);
      const timer = setTimeout(() => setCheckpointJustArrived(false), 1500);
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
    // no-op, kept for onFocus binding
  }

  function handleBlur() {
    // no-op, kept for onBlur binding
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
          padding: "0 16px 16px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
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
              gap: "28px",
              alignItems: "flex-start",
            }}
          >
            {/* Session label */}
            {conversations.length > 0 && conversationId && (() => {
              const currentConv = conversations.find(c => c.id === conversationId);
              const dateStr = currentConv?.created_at
                ? formatShortDate(currentConv.created_at)
                : formatShortDate(new Date().toISOString());
              return (
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "9px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: "rgba(226, 224, 219, 0.15)",
                    textAlign: "center",
                    paddingBottom: "36px",
                  }}
                >
                  Session · {dateStr}
                </div>
              );
            })()}

            {(() => {
              // Group consecutive checkpoint messages into shared panels
              type MsgGroup = { type: "checkpoint"; msgs: { msg: ChatMessage; idx: number }[] }
                | { type: "single"; msg: ChatMessage; idx: number };
              const groups: MsgGroup[] = [];
              const visible = messages.map((msg, idx) => ({ msg, idx })).filter(m => m.msg.role !== "system");

              for (const item of visible) {
                if (item.msg.isCheckpoint === true) {
                  const last = groups[groups.length - 1];
                  if (last && last.type === "checkpoint") {
                    last.msgs.push(item);
                  } else {
                    groups.push({ type: "checkpoint", msgs: [item] });
                  }
                } else {
                  groups.push({ type: "single", msg: item.msg, idx: item.idx });
                }
              }

              return groups.map((group, gi) => {
                if (group.type === "checkpoint") {
                  return (
                    <div
                      key={`cpgroup-${gi}`}
                      style={{
                        backgroundColor: "#302820",
                        borderRadius: "6px",
                        margin: "16px",
                        padding: "20px 20px 24px",
                        animation: checkpointJustArrived
                          ? "checkpointFadeIn 2s ease-out"
                          : "checkpointFadeIn 2s ease-out, warmPulse 7s ease-in-out infinite",
                      }}
                    >
                      {group.msgs.map(({ msg, idx: i }, mi) => {
                        const isPending =
                          activeCheckpoint &&
                          activeCheckpoint.messageId === msg.id;
                        const isLast = mi === group.msgs.length - 1;

                        return (
                          <div key={msg.id || `msg-${i}`} style={{ marginTop: mi > 0 ? "24px" : 0 }}>
                            {/* Header */}
                            <div
                              style={{
                                fontFamily: "var(--font-serif)",
                                fontSize: "13px",
                                fontStyle: "italic",
                                color: "rgba(180, 145, 75, 0.45)",
                                marginBottom: "18px",
                              }}
                            >
                              What I&apos;m noticing —
                            </div>

                            {/* Body */}
                            <div
                              style={{
                                fontFamily: "var(--font-serif)",
                                fontSize: "15px",
                                fontStyle: "normal",
                                lineHeight: "1.9",
                                letterSpacing: "0.2px",
                                color: "rgba(226, 224, 219, 0.82)",
                              }}
                            >
                              {renderMarkdown(msg.content)}
                            </div>

                            {/* Action buttons — only on pending checkpoint */}
                            {isPending && !checkpointActionState && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  marginTop: "28px",
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setCheckpointActionState("confirmed");
                                    confirmCheckpoint("confirmed");
                                  }}
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "11px",
                                    letterSpacing: "1.5px",
                                    textTransform: "uppercase",
                                    color: "var(--color-accent)",
                                    background: "none",
                                    border: "none",
                                    borderBottom: "1px solid var(--color-accent-dim)",
                                    padding: "8px 14px 8px 0",
                                    cursor: "pointer",
                                  }}
                                >
                                  Yes, this resonates
                                </button>
                                <span style={{ color: "rgba(226, 224, 219, 0.08)", padding: "0 6px" }}>·</span>
                                <button
                                  onClick={() => {
                                    setCheckpointActionState("refined");
                                    confirmCheckpoint("refined");
                                  }}
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "11px",
                                    letterSpacing: "1.5px",
                                    textTransform: "uppercase",
                                    color: "rgba(226, 224, 219, 0.3)",
                                    background: "none",
                                    border: "none",
                                    padding: "8px 14px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Refine
                                </button>
                                <span style={{ color: "rgba(226, 224, 219, 0.08)", padding: "0 6px" }}>·</span>
                                <button
                                  onClick={() => {
                                    setCheckpointActionState("rejected");
                                    confirmCheckpoint("rejected");
                                  }}
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "11px",
                                    letterSpacing: "1.5px",
                                    textTransform: "uppercase",
                                    color: "rgba(226, 224, 219, 0.18)",
                                    background: "none",
                                    border: "none",
                                    padding: "8px 14px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Not quite
                                </button>
                              </div>
                            )}

                            {/* Post-action states */}
                            {isPending && checkpointActionState === "confirmed" && (
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "10px",
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: "var(--color-accent-dim)",
                                  marginTop: "28px",
                                }}
                              >
                                Added to your manual
                              </div>
                            )}
                            {isPending && checkpointActionState === "refined" && (
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "10px",
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: "rgba(226, 224, 219, 0.35)",
                                  marginTop: "28px",
                                }}
                              >
                                Tell Sage what to adjust ↓
                              </div>
                            )}
                            {isPending && checkpointActionState === "rejected" && (
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "10px",
                                  letterSpacing: "2px",
                                  textTransform: "uppercase",
                                  color: "rgba(226, 224, 219, 0.25)",
                                  marginTop: "28px",
                                }}
                              >
                                Noted — Sage will keep listening
                              </div>
                            )}

                            {isPending && checkpointError && (
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "10px",
                                  color: "var(--color-text-ghost)",
                                  marginTop: "12px",
                                  display: "block",
                                }}
                              >
                                {checkpointError}
                              </span>
                            )}

                            {/* Divider between consecutive checkpoints */}
                            {!isLast && (
                              <div style={{
                                height: "1px",
                                background: "linear-gradient(90deg, rgba(180,145,75,0.15), transparent)",
                                marginTop: "24px",
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Regular message
                const { msg, idx: i } = group;
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={isUser ? {
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      fontSize: "14px",
                      lineHeight: "1.65",
                      letterSpacing: "0.1px",
                      color: "rgba(226, 224, 219, 0.38)",
                      textAlign: "right",
                      alignSelf: "flex-end",
                    } : {
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      fontSize: "15px",
                      lineHeight: "1.7",
                      letterSpacing: "0.1px",
                      color: "rgba(226, 224, 219, 0.78)",
                      textAlign: "left",
                    }}
                  >
                    {isUser ? msg.content : renderMarkdown(msg.content)}
                  </div>
                );
              });
            })()}

            {/* Typing indicator with processing text — on a dark panel */}
            {isLoading &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                <div
                  style={{
                    backgroundColor: "#211F1B",
                    borderRadius: "6px",
                    margin: "16px",
                    padding: "16px 20px",
                    transition: "background-color 0.6s ease, box-shadow 0.6s ease",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "var(--color-accent-glow)",
                        animation: "sagePulse 2.5s ease-in-out infinite",
                      }}
                    />
                    {processingText && processingText !== "listening..." && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          letterSpacing: "1.5px",
                          textTransform: "lowercase",
                          color: "var(--color-text-ghost)",
                          opacity: 0.5,
                          animation: "processingTextFadeIn 0.8s ease-out",
                        }}
                      >
                        {processingText}
                      </div>
                    )}
                  </div>
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

            <div ref={messagesEndRef} style={{ height: "40px" }} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px 16px",
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
            placeholder="Say something_"
            rows={1}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              backgroundColor: "transparent",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "16px",
              lineHeight: "24px",
              color: "#E2E0DB",
              padding: "10px 0",
              overflow: "hidden",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isStreaming}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              border: `1px solid ${input.trim() ? "rgba(139, 168, 136, 0.45)" : "rgba(226, 224, 219, 0.08)"}`,
              backgroundColor: "transparent",
              cursor: !input.trim() || isLoading || isStreaming ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginBottom: "2px",
              transition: "border-color 0.2s ease",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                lineHeight: 1,
                color: input.trim() ? "rgba(139, 168, 136, 0.75)" : "rgba(226, 224, 219, 0.15)",
                transition: "color 0.2s ease",
              }}
            >
              ↑
            </span>
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
