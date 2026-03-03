"use client";

import { useState, useRef, useEffect } from "react";
import SessionDrawer from "./SessionDrawer";
import ChatInput from "./ChatInput";
import MeadowZone from "./MeadowZone";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ChatMessage, ManualComponent, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";

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
}

export default function MobileSession({
  messages,
  conversationId,
  isLoading,
  isStreaming,
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
}: MobileSessionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkpointActionState, setCheckpointActionState] = useState<"confirmed" | "refined" | "rejected" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCheckpointRef = useRef<ActiveCheckpoint | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  // Reset checkpoint action state when a new checkpoint arrives
  useEffect(() => {
    if (activeCheckpoint && !prevCheckpointRef.current) {
      setCheckpointActionState(null);
    }
    prevCheckpointRef.current = activeCheckpoint;
  }, [activeCheckpoint]);

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

        {/* Right spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />
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

              // Hide the seed message (first user message in conversation).
              // Sage references the seed naturally in its opening, so the user
              // sees their topic reflected without their own message displayed.
              if (msg.role === "user" && i === 0) return null;

              const isUser = msg.role === "user";
              const isCheckpoint = msg.isCheckpoint === true;
              const isPendingCheckpoint =
                isCheckpoint &&
                activeCheckpoint &&
                activeCheckpoint.messageId === msg.id;

              // Checkpoint rendering — clearing with feathered gradient edges
              if (isCheckpoint) {
                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{ animation: "checkpointFadeIn 2s ease-out both" }}
                  >
                    <MeadowZone>
                      <div style={{ padding: "20px 0" }}>
                        {/* Sage label */}
                        <div style={{ paddingBottom: "8px" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "8px",
                              fontWeight: 500,
                              letterSpacing: "2.5px",
                              textTransform: "uppercase",
                              color: "var(--cp-text-accent)",
                            }}
                          >
                            Sage
                          </span>
                        </div>
                        {/* Body text */}
                        <div
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: "15px",
                            fontWeight: 400,
                            lineHeight: 1.75,
                            letterSpacing: "-0.2px",
                            color: "var(--cp-text)",
                          }}
                        >
                          {renderMarkdown(msg.content)}
                        </div>

                        {/* "Does this feel right?" prompt */}
                        {isPendingCheckpoint && !checkpointActionState && (
                          <p
                            style={{
                              fontFamily: "var(--font-serif)",
                              fontSize: "13px",
                              fontStyle: "italic",
                              color: "var(--cp-text-dim)",
                              margin: "20px 0 0 0",
                            }}
                          >
                            Does this feel right?
                          </p>
                        )}

                        {/* Action buttons */}
                        {isPendingCheckpoint && !checkpointActionState ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "16px",
                              paddingBottom: "4px",
                            }}
                          >
                            <button
                              onClick={() => {
                                setCheckpointActionState("confirmed");
                                confirmCheckpoint("confirmed");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "var(--cp-text-accent)",
                                background: "transparent",
                                border: "1px solid var(--cp-border)",
                                borderRadius: "20px",
                                padding: "6px 16px",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                              }}
                            >
                              Yes, save this
                            </button>
                            <button
                              onClick={() => {
                                setCheckpointActionState("refined");
                                confirmCheckpoint("refined");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "var(--cp-text-dim)",
                                background: "transparent",
                                border: "1px solid var(--cp-border-dim)",
                                borderRadius: "20px",
                                padding: "6px 16px",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                              }}
                            >
                              Refine it
                            </button>
                            <button
                              onClick={() => {
                                setCheckpointActionState("rejected");
                                confirmCheckpoint("rejected");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "var(--cp-text-dim)",
                                background: "transparent",
                                border: "1px solid var(--cp-border-dim)",
                                borderRadius: "20px",
                                padding: "6px 16px",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                              }}
                            >
                              Skip
                            </button>
                          </div>
                        ) : isPendingCheckpoint && checkpointActionState ? (
                          <div
                            style={{
                              marginTop: "20px",
                              paddingBottom: "4px",
                              animation: "checkpointFadeIn 0.4s ease-out both",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                letterSpacing: "0.08em",
                                color: checkpointActionState === "confirmed"
                                  ? "var(--cp-text-accent)"
                                  : "var(--cp-text-dim)",
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
                              paddingBottom: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                letterSpacing: "0.08em",
                                color: msg.checkpointMeta.status === "confirmed"
                                  ? "var(--cp-text-accent)"
                                  : "var(--cp-text-dim)",
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
                              color: "var(--cp-text-dim)",
                              marginTop: "12px",
                              display: "block",
                            }}
                          >
                            {checkpointError}
                          </span>
                        )}
                      </div>
                    </MeadowZone>
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
                // First-session orientation box: show above Sage's first message
                const isFirstAssistant = !messages.slice(0, i).some(m => m.role === "assistant");
                const showOrientationBox = isFirstAssistant && confirmedComponents.length === 0;

                const sagePanel = (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      position: isFirstInSageSequence ? "relative" as const : undefined,
                      backgroundColor: "var(--color-surface-sage)",
                    }}
                  >
                    {/* Top dissolve overlay */}
                    {isFirstInSageSequence && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12px", zIndex: 1, pointerEvents: "none" as const, background: "linear-gradient(to bottom, var(--color-void), transparent)" }} />
                    )}
                    {/* Sage label */}
                    {isFirstInSageSequence && (
                      <div
                        style={{
                          paddingLeft: "28px",
                          paddingRight: "28px",
                          paddingBottom: "8px",
                          paddingTop: i === 0 ? "12px" : "20px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            fontWeight: 500,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase" as const,
                            color: "var(--color-accent-muted)",
                          }}
                        >
                          Sage
                        </span>
                      </div>
                    )}
                    {/* Message — text fades in within the persistent panel */}
                    <div
                      style={{
                        paddingLeft: "28px",
                        paddingRight: "28px",
                        paddingTop: isFirstInSageSequence ? "0" : "14px",
                        paddingBottom: isLastInSageSequence ? "12px" : "0",
                        animation: "checkpointFadeIn 0.8s ease-out both",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "15px",
                          lineHeight: 1.7,
                          fontWeight: 430,
                          color: "var(--color-sage-text)",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {renderMarkdown(msg.content)}
                      </div>
                    </div>
                    {/* Bottom dissolve overlay */}
                    {isLastInSageSequence && (
                      <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "12px", zIndex: 1, pointerEvents: "none" as const, background: "linear-gradient(to top, var(--color-void), transparent)" }} />
                        <div style={{ height: "12px" }} />
                      </div>
                    )}
                  </div>
                );

                if (showOrientationBox) {
                  return (
                    <>
                      <div
                        key="orientation-box"
                        style={{
                          margin: "16px 0 0 0",
                          padding: "24px 28px 24px 20px",
                          borderLeft: "2px solid var(--color-accent-dim)",
                          backgroundColor: "var(--color-surface)",
                          animation: "mantleFadeIn 0.6s ease-out",
                        }}
                      >
                        <p style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "14px",
                          lineHeight: 1.75,
                          color: "var(--color-text-dim)",
                          margin: "0 0 16px 0",
                        }}>
                          Welcome to our session. This is where we explore what&#39;s top of mind and start building a manual of how you operate. You should see me as a tool to name the things you already know, recognize patterns, and reflect them back for you to confirm. Push back anytime I&#39;m off. I&#39;ll be asking questions and going deeper. You don&#39;t have to go anywhere you don&#39;t want to, but the more you share, the more useful your manual becomes.
                        </p>
                        <p style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "14px",
                          lineHeight: 1.75,
                          color: "var(--color-text-dim)",
                          margin: 0,
                        }}>
                          People are great for processing, but they have their own stakes in your story. I don&#39;t. I have a framework and a lens, but no ego in the outcome.
                        </p>
                      </div>
                      {sagePanel}
                    </>
                  );
                }

                return sagePanel;
              }

              // User message
              return (
                <div
                  key={msg.id || `msg-${i}`}
                  style={{
                    paddingRight: "28px",
                    paddingLeft: "48px",
                    paddingTop: "10px",
                    paddingBottom: "10px",
                    animation: "checkpointFadeIn 0.45s ease-out both",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      lineHeight: 1.7,
                      fontWeight: 400,
                      color: "var(--color-user-text)",
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
            {(isLoading || isStreaming) &&
              (messages.length === 0 || messages[messages.length - 1].role === "user") && (
                <div
                  style={{
                    position: "relative",
                    backgroundColor: "var(--color-surface-sage)",
                    paddingLeft: "28px",
                    paddingRight: "28px",
                    paddingTop: "20px",
                    paddingBottom: "20px",
                    animation: "checkpointFadeIn 0.3s ease-out both",
                  }}
                >
                  {/* Top dissolve overlay */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12px", zIndex: 1, pointerEvents: "none" as const, background: "linear-gradient(to bottom, var(--color-void), transparent)" }} />
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
                          textTransform: "uppercase" as const,
                          color: "var(--color-accent-muted)",
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
                          backgroundColor: "var(--color-accent-muted)",
                          opacity: 0.5,
                          animation: "sagePulse 2.4s ease-in-out infinite",
                          animationDelay: `${dotIdx * 0.35}s`,
                        }}
                      />
                    ))}
                  </div>
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

      <ChatInput
        onSend={sendMessage}
        disabled={isLoading || isStreaming}
      />

      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectSession={switchConversation}
        onNewSession={startNewSession}
      />
    </div>
  );
}
