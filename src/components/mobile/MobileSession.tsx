"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import SessionDrawer from "./SessionDrawer";
import ChatInput from "./ChatInput";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ChatMessage, ManualEntry, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";
import { LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME } from "@/lib/persona/config";

const WELCOME_CHIPS = [
  "I have a situation I want to work through",
  "I know something about myself I want to capture",
  "I just need to think out loud",
] as const;

const personaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  fontWeight: 400,
  letterSpacing: "1.5px",
  textTransform: "lowercase" as const,
  color: "var(--session-persona-soft)",
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
  confirmedEntries: ManualEntry[];
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
  isGuest?: boolean;
  onSignInPrompt?: () => void;
}

export default function MobileSession({
  messages,
  conversationId,
  isLoading,
  isStreaming,
  confirmedEntries,
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
  // The paragraph explanation persists as the first Jove message in the
  // conversation; only the transition line and chips hide once any message
  // is sent.
  const showWelcomePanel =
    !firstSessionCompleted &&
    sessionOrigin === "new" &&
    confirmedEntries.length === 0;
  const showChips = chipsVisible && !hasMessages;
  const welcomeBlock = (
    <div
      key="welcome-block"
      style={{
        margin: "16px 0 0 0",
        animation: "mwFadeIn 0.6s ease-out",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Jove label — introduces the voice. Welcome has nothing to
          annotate yet; rail is annotation grammar and doesn't belong
          here. The label stays — it's introduction grammar: "this
          voice has a name, it's Jove." Subsequent messages in the
          chat get the rail treatment. */}
      <div style={{ marginBottom: "6px" }}>
        <span style={personaLabelStyle}>{PERSONA_NAME.toUpperCase()}</span>
      </div>
      {/* Prose — no rail, no padding indent. 17px matches --size-prose,
          the Jove body size throughout chat. */}
      <div style={{
        fontFamily: "var(--font-persona)",
        fontSize: "17px",
        lineHeight: 1.55,
        color: "var(--session-ink-persona)",
      }}>
        <p style={{ margin: "0 0 12px 0" }}>
          This is where you talk to {PERSONA_NAME}. There are a few ways to use it.
        </p>
        <p style={{ margin: "0 0 12px 0" }}>
          <strong style={{ fontWeight: 600 }}>Navigate a situation.</strong> Tell {PERSONA_NAME} what&rsquo;s going on and it will help you work through it. Something like &ldquo;I just had a conversation with my partner that went sideways and I don&rsquo;t know why.&rdquo;
        </p>
        <p style={{ margin: "0 0 12px 0" }}>
          <strong style={{ fontWeight: 600 }}>Write to your manual directly.</strong> If you already know something about how you work, you can start there. Something like &ldquo;I spend a lot of energy managing social situations and most people don&rsquo;t realize it.&rdquo;
        </p>
        <p style={{ margin: showChips ? "0 0 12px 0" : 0 }}>
          <strong style={{ fontWeight: 600 }}>Just get it out.</strong> If you need to think out loud, start talking. {PERSONA_NAME} will help organize what you&rsquo;re saying and surface patterns as they come up.
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
                backgroundColor: "var(--session-persona-muted)",
                border: "1px solid var(--session-persona-border)",
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
    <main
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        paddingBottom: "calc(52px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <header
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
          aria-label="Open session menu"
          aria-expanded={drawerOpen}
          aria-controls="session-drawer"
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
              aria-hidden="true"
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
            fontSize: "20px",
            fontWeight: 400,
            color: "var(--session-ink-faded)",
            letterSpacing: "1.5px",
            paddingLeft: "4px",
          }}
        >
          my walnut
        </span>

        {/* Right spacer */}
        <div style={{ width: "40px" }} />
      </header>

      {/* Sign-in nudge for anonymous users — below header */}
      {isGuest && !signInBannerDismissed && messages.length >= 5 && onSignInPrompt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "6px 16px",
            background: "var(--session-persona-tint)",
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
              color: "var(--session-persona)",
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
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Conversation messages"
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

          {/* State 1: First-time user welcome — persists as the first Jove
              message in the conversation. Renders above all messages so it
              never reorders relative to user/Jove turns. */}
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
                  fontFamily: "var(--font-persona)",
                  fontSize: "17px",
                  color: "var(--session-ink-persona)",
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

                const primaryBg = "var(--session-persona-soft)";
                const accentColor = "var(--session-persona)";

                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 0.45s ease both",
                      background: "linear-gradient(170deg, var(--session-cream) 0%, #EFEADF 100%)",
                      border: "1px solid var(--session-persona-border)",
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
                          fontSize: "var(--size-meta)",
                          fontWeight: 400,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          color: "var(--cp-text-accent, var(--session-persona-soft))",
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
                        fontSize: "var(--size-meta)",
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
                                fontSize: "var(--size-meta)",
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
                                  fontSize: "var(--size-meta)",
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
                                  fontSize: "var(--size-meta)",
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
                                  fontSize: "var(--size-meta)",
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
                            fontSize: "var(--size-meta)",
                            fontWeight: 500,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: checkpointActionState === "confirmed"
                              ? accentColor
                              : "var(--session-ink-ghost)",
                          }}
                        >
                          {checkpointActionState === "confirmed" && "Written to manual"}
                          {checkpointActionState === "refined" && `${PERSONA_NAME} will revisit this`}
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
                            fontSize: "var(--size-meta)",
                            fontWeight: 500,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: msg.checkpointMeta.status === "confirmed"
                              ? accentColor
                              : "var(--session-ink-ghost)",
                          }}
                        >
                          {msg.checkpointMeta.status === "confirmed" && "Written to manual"}
                          {msg.checkpointMeta.status === "refined" && `${PERSONA_NAME} will revisit this`}
                          {msg.checkpointMeta.status === "rejected" && "Discarded"}
                        </span>
                      </div>
                    )}

                    {checkpointError && isPendingCheckpoint && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
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

              // Sequence detection: is this the first Jove message in a run?
              const isFirstInPersonaSequence = (() => {
                if (msg.role !== "assistant") return false;
                if (i === 0) return true;
                const prev = messages[i - 1];
                if (!prev || prev.role === "system") return true;
                return prev.role !== "assistant" || prev.isCheckpoint === true;
              })();

              // Jove message — rail treatment. Left sage rail marks the
              // utterance; text indents from the rail. No fill, no radius —
              // Jove is an annotator in the margin of your thinking, not a
              // speaker on the other end of a line.
              if (!isUser) {
                const personaPanel = (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      animation: "checkpointFadeIn 0.8s ease-out both",
                    }}
                  >
                    {/* Jove label — first in sequence only. Aligned to the
                        rail's left edge so label + rail read as a single
                        structural marker. 6px marginBottom keeps the label
                        visually tethered to the rail below. */}
                    {isFirstInPersonaSequence && (
                      <div style={{ marginTop: "-4px", marginBottom: "6px", paddingLeft: "0", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={personaLabelStyle}>{PERSONA_NAME.toUpperCase()}</span>
                        {msg.channel === "text" && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
                        )}
                      </div>
                    )}
                    {/* Rail — 2px sage-soft line, text indented 14px */}
                    <div
                      style={{
                        borderLeft: "2px solid var(--session-persona-soft)",
                        paddingLeft: "14px",
                        paddingTop: "4px",
                        paddingBottom: "4px",
                        fontFamily: "var(--font-persona)",
                        fontSize: "17px",
                        fontWeight: 400,
                        lineHeight: 1.55,
                        color: "var(--session-ink-persona)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-persona)",
                          fontSize: "17px",
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

                return personaPanel;
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
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
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
                  {/* Show Jove label when prev message was user or checkpoint */}
                  {(messages.length === 0 ||
                    messages[messages.length - 1]?.role !== "assistant" ||
                    messages[messages.length - 1]?.isCheckpoint === true) && (
                    <div style={{ marginTop: "-4px", marginBottom: "6px", paddingLeft: "0" }}>
                      <span style={personaLabelStyle}>{PERSONA_NAME.toUpperCase()}</span>
                    </div>
                  )}
                  {/* Typing rail — same 4px vertical padding as a regular
                      Jove utterance. An annotation mark doesn't resize to
                      fit what it's annotating; 8px would make the typing
                      and streaming rails two different heights for the
                      same speaker. */}
                  <div
                    style={{
                      borderLeft: "2px solid var(--session-persona-soft)",
                      paddingLeft: "14px",
                      paddingTop: "4px",
                      paddingBottom: "4px",
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
                            backgroundColor: "var(--session-persona-soft)",
                            opacity: 0.5,
                            animation: "personaPulse 2.4s ease-in-out infinite",
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
                      color: "var(--session-ink-mid)",
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
                      color: "var(--session-persona)",
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

      <ChatInput
        onSend={sendMessage}
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
    </main>
  );
}
