"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import SessionDrawer from "./SessionDrawer";
import ChatInput from "./ChatInput";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ChatMessage, ManualComponent, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";
import { LAYER_NAMES } from "@/lib/manual/layers";

const WELCOME_CHIPS = [
  "I have a situation I want to work through",
  "I know something about myself I want to capture",
  "I just need to think out loud",
] as const;

const sageLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "8px",
  fontWeight: 400,
  letterSpacing: "1.5px",
  textTransform: "lowercase" as const,
  color: "var(--session-sage-soft)",
} as const;

interface MobileSessionProps {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isNewUser?: boolean;
  firstSessionCompleted?: boolean;
  sessionOrigin?: "new" | "explore" | "existing";
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
  showFeedbackModal?: boolean;
  dismissFeedbackModal?: () => void;
  feedbackHint?: string | null;
  clearFeedbackHint?: () => void;
  isGuest?: boolean;
  onSignInPrompt?: () => void;
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
  showFeedbackModal,
  dismissFeedbackModal,
  feedbackHint,
  clearFeedbackHint,
  isGuest,
  onSignInPrompt,
  firstSessionCompleted,
  sessionOrigin,
}: MobileSessionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chipsVisible, setChipsVisible] = useState(true);
  const [checkpointActionState, setCheckpointActionState] = useState<"confirmed" | "refined" | "rejected" | null>(null);
  const [signInBannerDismissed, setSignInBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const dismissed = localStorage.getItem("mw_signin_banner_dismissed");
    if (!dismissed) return false;
    return Date.now() - parseInt(dismissed, 10) < 24 * 60 * 60 * 1000;
  });
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

  // Scroll to bottom when keyboard opens (visualViewport resize)
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

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

  // Welcome block — shown to new users (no confirmed manual entries).
  // The paragraph explanation persists as the first Sage message in the
  // conversation; only the transition line and chips hide once any message
  // is sent.
  const showWelcomePanel =
    !firstSessionCompleted &&
    sessionOrigin === "new" &&
    confirmedComponents.length === 0;
  const showChips = chipsVisible && !hasMessages;
  const welcomeBlock = (
    <div
      key="welcome-block"
      style={{
        margin: "16px 0 0 0",
        padding: "16px 18px 14px",
        background: "var(--session-sage-tint)",
        borderRadius: "12px",
        animation: "mwFadeIn 0.6s ease-out",
      }}
    >
      {/* Sage label */}
      <div style={{ marginBottom: "2px" }}>
        <span style={sageLabelStyle}>SAGE</span>
      </div>
      <div style={{
        fontFamily: "var(--font-sage)",
        fontSize: "16px",
        lineHeight: 1.55,
        color: "var(--session-ink-sage)",
      }}>
        <p style={{ margin: "0 0 12px 0" }}>
          This is where you talk to Sage. There are a few ways to use it.
        </p>
        <p style={{ margin: "0 0 12px 0" }}>
          <strong style={{ fontWeight: 600 }}>Navigate a situation.</strong> Tell Sage what&rsquo;s going on and it will help you work through it. Something like &ldquo;I just had a conversation with my partner that went sideways and I don&rsquo;t know why.&rdquo;
        </p>
        <p style={{ margin: "0 0 12px 0" }}>
          <strong style={{ fontWeight: 600 }}>Write to your manual directly.</strong> If you already know something about how you work, you can start there. Something like &ldquo;I spend a lot of energy managing social situations and most people don&rsquo;t realize it.&rdquo;
        </p>
        <p style={{ margin: showChips ? "0 0 12px 0" : 0 }}>
          <strong style={{ fontWeight: 600 }}>Just get it out.</strong> If you need to think out loud, start talking. Sage will help organize what you&rsquo;re saying and surface patterns as they come up.
        </p>
        {showChips && (
          <p style={{ margin: 0 }}>
            There is no wrong place to start. Start typing or select one of the following.
          </p>
        )}
      </div>
      {showChips && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "16px",
        }}>
          {WELCOME_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setChipsVisible(false);
                sendMessage(chip);
              }}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 400,
                lineHeight: 1.4,
                color: "var(--session-ink-soft)",
                backgroundColor: "var(--session-sage-muted)",
                border: "1px solid var(--session-sage-border)",
                borderRadius: "20px",
                padding: "10px 16px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "background-color 0.2s ease",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          flexShrink: 0,
        }}
      >
        {/* Menu button — left */}
        <button
          onClick={handleOpenDrawer}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            width: "40px",
            height: "40px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: i === 2 ? "13px" : "18px",
                height: "1.5px",
                backgroundColor: "var(--session-ink-ghost)",
                borderRadius: "1px",
              }}
            />
          ))}
        </button>

        {/* Logo — center */}
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--session-ink-faded)",
            letterSpacing: "15px",
            textTransform: "uppercase",
            paddingLeft: "15px",
          }}
        >
          MYWALNUT
        </span>

        {/* Right spacer */}
        <div style={{ width: "40px" }} />
      </div>

      {/* Sign-in nudge for anonymous users — below header */}
      {isGuest && !signInBannerDismissed && messages.length >= 5 && onSignInPrompt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "6px 16px",
            background: "var(--session-sage-tint)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--session-ink-mid)",
            }}
          >
            Create an account to keep your manual
          </span>
          <button
            onClick={onSignInPrompt}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--session-sage)",
              padding: 0,
            }}
          >
            Create account
          </button>
          <button
            onClick={() => {
              setSignInBannerDismissed(true);
              localStorage.setItem("mw_signin_banner_dismissed", String(Date.now()));
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--session-ink-ghost)",
              padding: 0,
            }}
          >
            Later
          </button>
        </div>
      )}

      {/* Messages area wrapper */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Scroll fade overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "48px",
            zIndex: 1,
            pointerEvents: "none",
            background: "linear-gradient(to bottom, var(--session-glow-scroll) 0%, rgba(200,185,140,0.08) 40%, transparent 100%)",
          }}
        />

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          style={{
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            willChange: "transform",
            display: "flex",
            flexDirection: "column",
            padding: "20px 16px 4px",
            gap: "14px",
          }}
        >
          {/* Spacer pushes messages to bottom of viewport */}
          <div style={{ flexGrow: 1, minHeight: "24px" }} />

          {/* State 1: First-time user welcome — persists as the first Sage
              message in the conversation. Renders above all messages so it
              never reorders relative to user/Sage turns. */}
          {showWelcomePanel && welcomeBlock}

          {/* State 2: Returning user, new session */}
          {firstSessionCompleted && sessionOrigin === "new" && !hasMessages && !isLoading && (
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
                  fontFamily: "var(--font-sage)",
                  fontSize: "16px",
                  color: "var(--session-ink-sage)",
                  lineHeight: 1.55,
                  textAlign: "center",
                }}
              >
                What&rsquo;s going on? Or we can pick up where we left off.
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

              // Checkpoint card rendering
              if (isCheckpoint) {
                const checkpointLayer = isPendingCheckpoint
                  ? activeCheckpoint?.layer
                  : msg.checkpointMeta?.layer;

                const primaryBg = "var(--session-sage-soft)";
                const accentColor = "var(--session-sage)";

                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 0.45s ease both",
                      background: "linear-gradient(170deg, var(--session-cream) 0%, #EFEADF 100%)",
                      border: "1px solid var(--session-sage-border)",
                      borderRadius: "8px",
                      boxShadow: "0 8px 44px var(--session-glow-cp), 0 2px 8px rgba(26,22,20,0.05)",
                      padding: "16px 16px 14px",
                      margin: "20px 0 12px",
                    }}
                  >
                    {/* Layer name header */}
                    {checkpointLayer && LAYER_NAMES[checkpointLayer] && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          fontWeight: 400,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          color: "var(--cp-text-accent, var(--session-sage-soft))",
                          marginBottom: "12px",
                          lineHeight: 1,
                        }}
                      >
                        {LAYER_NAMES[checkpointLayer]}
                      </div>
                    )}

                    {/* Header */}
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "7px",
                        fontWeight: 500,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: accentColor,
                        marginBottom: "14px",
                      }}
                    >
                      CHECKPOINT
                    </div>

                    {/* Body text */}
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "16px",
                        fontWeight: 400,
                        lineHeight: 1.5,
                        color: "var(--session-ink-soft)",
                      }}
                    >
                      {renderMarkdown(msg.content)}
                    </div>

                    {/* Divider + prompt + buttons (pending only) */}
                    {isPendingCheckpoint && !checkpointActionState && (
                      <>
                        <div
                          style={{
                            marginTop: "18px",
                            paddingTop: "12px",
                            borderTop: "1px solid rgba(94, 112, 84, 0.1)",
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "var(--font-serif)",
                              fontSize: "13px",
                              fontStyle: "italic",
                              color: "var(--session-ink-faded)",
                              margin: "0 0 12px 0",
                            }}
                          >
                            Does this feel right?
                          </p>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {/* Primary button */}
                            <button
                              onClick={() => {
                                setCheckpointActionState("confirmed");
                                confirmCheckpoint("confirmed");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "11px",
                                fontWeight: 500,
                                letterSpacing: "0.5px",
                                color: "#FFFFFF",
                                background: primaryBg,
                                border: "none",
                                borderRadius: "6px",
                                padding: "9px 0",
                                cursor: "pointer",
                                width: "100%",
                                transition: "opacity 0.25s ease",
                              }}
                            >
                              Yes, write to manual
                            </button>

                            {/* Secondary row */}
                            <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center" }}>
                              <button
                                onClick={() => {
                                  setCheckpointActionState("refined");
                                  confirmCheckpoint("refined");
                                }}
                                style={{
                                  fontFamily: "var(--font-sans)",
                                  fontSize: "10px",
                                  fontWeight: 500,
                                  color: "var(--session-ink-mid)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                Not quite
                              </button>
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "var(--session-ink-whisper)",
                                }}
                              >
                                &middot;
                              </span>
                              <button
                                onClick={() => {
                                  setCheckpointActionState("rejected");
                                  confirmCheckpoint("rejected");
                                }}
                                style={{
                                  fontFamily: "var(--font-sans)",
                                  fontSize: "10px",
                                  fontWeight: 500,
                                  color: "var(--session-ink-ghost)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                Not at all
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Action state feedback */}
                    {isPendingCheckpoint && checkpointActionState && (
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "12px",
                          borderTop: "1px solid rgba(94, 112, 84, 0.1)",
                          animation: "checkpointFadeIn 0.4s ease-out both",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "7px",
                            fontWeight: 500,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: checkpointActionState === "confirmed"
                              ? accentColor
                              : "var(--session-ink-ghost)",
                          }}
                        >
                          {checkpointActionState === "confirmed" && "Written to manual"}
                          {checkpointActionState === "refined" && "Sage will revisit this"}
                          {checkpointActionState === "rejected" && "Discarded"}
                        </span>
                      </div>
                    )}

                    {/* Already-resolved checkpoints (loaded from DB) */}
                    {isCheckpoint && !isPendingCheckpoint && msg.checkpointMeta?.status && msg.checkpointMeta.status !== "pending" && (
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "12px",
                          borderTop: "1px solid rgba(94, 112, 84, 0.1)",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "7px",
                            fontWeight: 500,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: msg.checkpointMeta.status === "confirmed"
                              ? accentColor
                              : "var(--session-ink-ghost)",
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
                          color: "var(--session-ink-ghost)",
                          marginTop: "12px",
                          display: "block",
                        }}
                      >
                        {checkpointError}
                      </span>
                    )}
                  </div>
                );
              }

              // Sequence detection: is this the first sage message in a run?
              const isFirstInSageSequence = (() => {
                if (msg.role !== "assistant") return false;
                if (i === 0) return true;
                const prev = messages[i - 1];
                if (!prev || prev.role === "system") return true;
                return prev.role !== "assistant" || prev.isCheckpoint === true;
              })();

              // Sage message — tinted bubble with serif text
              if (!isUser) {
                const sagePanel = (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      animation: "checkpointFadeIn 0.8s ease-out both",
                    }}
                  >
                    {/* Sage label — first in sequence only */}
                    {isFirstInSageSequence && (
                      <div style={{ marginTop: "-4px", marginBottom: "2px", paddingLeft: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={sageLabelStyle}>SAGE</span>
                        {msg.channel === "text" && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
                        )}
                      </div>
                    )}
                    {/* Bubble */}
                    <div
                      style={{
                        background: "var(--session-sage-tint)",
                        borderRadius: "12px",
                        padding: "16px 18px",
                        fontFamily: "var(--font-sage)",
                        fontSize: "16px",
                        fontWeight: 400,
                        lineHeight: 1.55,
                        color: "var(--session-ink-sage)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-sage)",
                          fontSize: "16px",
                          fontWeight: 400,
                          lineHeight: 1.55,
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {React.Children.map(renderMarkdown(msg.content), (child) =>
                          React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
                                style: { ...(child as React.ReactElement<{ style?: React.CSSProperties }>).props.style, margin: 0 },
                              })
                            : child
                        )}
                      </div>
                    </div>
                  </div>
                );

                return sagePanel;
              }

              // User message — right-positioned, left-justified text
              return (
                <div
                  key={msg.id || `msg-${i}`}
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "88%",
                    padding: "0 2px 0 0",
                    animation: "checkpointFadeIn 0.45s ease-out both",
                  }}
                >
                  {msg.channel === "text" && (
                    <div style={{ textAlign: "right", marginBottom: "2px", paddingRight: "2px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
                    </div>
                  )}
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15.5px",
                      fontWeight: 400,
                      lineHeight: 1.5,
                      color: "var(--session-ink-user)",
                      textAlign: "left",
                      margin: 0,
                    }}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            })}

            {/* Typing indicator */}
            {(isLoading || isStreaming) &&
              (messages.length === 0 || messages[messages.length - 1].role === "user") && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    animation: "checkpointFadeIn 0.3s ease-out both",
                  }}
                >
                  {/* Show Sage label when prev message was user or checkpoint */}
                  {(messages.length === 0 ||
                    messages[messages.length - 1]?.role !== "assistant" ||
                    messages[messages.length - 1]?.isCheckpoint === true) && (
                    <div style={{ marginTop: "-4px", marginBottom: "2px", paddingLeft: "4px" }}>
                      <span style={sageLabelStyle}>SAGE</span>
                    </div>
                  )}
                  <div
                    style={{
                      background: "var(--session-sage-tint)",
                      borderRadius: "12px",
                      padding: "16px 18px",
                      alignSelf: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {[0, 1, 2].map((dotIdx) => (
                        <div
                          key={dotIdx}
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            backgroundColor: "var(--session-sage-soft)",
                            opacity: 0.5,
                            animation: "sagePulse 2.4s ease-in-out infinite",
                            animationDelay: `${dotIdx * 0.35}s`,
                          }}
                        />
                      ))}
                    </div>
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
                      color: "var(--session-ink-ghost)",
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
                      color: "var(--session-sage)",
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
      </div>

      {/* Feedback hint (inline, above input) */}
      {feedbackHint && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.5px",
            textAlign: "center",
            padding: "6px 16px",
          }}
        >
          {feedbackHint}
        </div>
      )}

      <ChatInput
        onSend={(text) => {
          if (clearFeedbackHint) clearFeedbackHint();
          sendMessage(text);
        }}
        disabled={isLoading || isStreaming || conversationId === "text-channel"}
      />

      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectSession={switchConversation}
        onNewSession={startNewSession}
      />

      {/* Feedback confirmation modal */}
      {showFeedbackModal && dismissFeedbackModal && (
        <FeedbackModal onClose={dismissFeedbackModal} />
      )}
    </div>
  );
}

// ── Feedback modal ──────────────────────────────────────────────────

function FeedbackModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--session-backdrop-heavy)",
        padding: "32px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--session-cream)",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "320px",
          width: "100%",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--session-ink)",
            lineHeight: 1.6,
            margin: "0 0 20px 0",
          }}
        >
          Thanks for the feedback and working through the rough edges. It means a lot.
        </p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--session-ink)",
            lineHeight: 1.6,
            margin: "0 0 20px 0",
          }}
        >
          This message went directly to Jeff and won&apos;t affect your conversation with Sage.
        </p>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 0",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--session-ink)",
            backgroundColor: "transparent",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          Back to Sage
        </button>
      </div>
    </div>
  );
}
