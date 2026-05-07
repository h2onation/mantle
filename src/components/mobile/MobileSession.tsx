"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import SessionDrawer from "./SessionDrawer";
import ChatInput from "./ChatInput";
import ChatWindowModal from "@/components/modals/ChatWindowModal";
import PatternFormingModal from "@/components/modals/PatternFormingModal";
import FirstCheckpointModal from "@/components/modals/FirstCheckpointModal";
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
  confirmCheckpoint: (
    action: "confirmed" | "rejected" | "refined" | "deferred"
  ) => void;
  switchConversation: (id: string) => Promise<void>;
  startNewSession: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  isGuest?: boolean;
  onSignInPrompt?: () => void;
  // Onboarding modal state. modalProgress=null means MainApp hasn't
  // finished loading it yet — modals are suppressed until known so we
  // never flash a modal that immediately disappears. Anonymous-auth
  // users are excluded (they convert at first checkpoint and the modal
  // flow starts then).
  modalProgress?: number | null;
  signupAtMs?: number | null;
  isAnonymous?: boolean;
  // Modal 2 (Pattern-Forming) trigger inputs from the latest
  // message_complete event (one-turn lag, server-side).
  emergingPatternSnippet?: string | null;
  hasLayerEmergingOrBeyond?: boolean;
  concreteExamples?: number;
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
  modalProgress = null,
  signupAtMs = null,
  isAnonymous = false,
  emergingPatternSnippet = null,
  hasLayerEmergingOrBeyond = false,
  concreteExamples = 0,
}: MobileSessionProps) {
  const [modal1Dismissed, setModal1Dismissed] = useState(false);
  const [modal2Dismissed, setModal2Dismissed] = useState(false);
  const [modal3Dismissed, setModal3Dismissed] = useState(false);

  // Modal 3 is open iff we have loaded a valid modal_progress of 2, the
  // user is not anonymous, a checkpoint is actively pending, and the
  // user hasn't dismissed it yet in this session. When open, we
  // suppress the pending checkpoint card below so the modal reads
  // first; dismissal makes the card render in the same cycle.
  const modal3Open =
    typeof modalProgress === "number" &&
    modalProgress === 2 &&
    !isAnonymous &&
    activeCheckpoint !== null &&
    !modal3Dismissed;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chipsVisible, setChipsVisible] = useState(true);
  const [checkpointActionState, setCheckpointActionState] = useState<"confirmed" | "refined" | "rejected" | "deferred" | null>(null);
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
  // Phase 7-High / Gate 8: the three-paragraph Jove intro prose that
  // used to render here is gone. Modal 1 (ChatWindowModal) now carries
  // that content on the first chat-window entry. The three welcome
  // chips remain as the empty-state affordance.
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
                fontFamily: "var(--font-serif)",
                fontSize: "16px",
                fontStyle: "italic",
                fontWeight: 400,
                lineHeight: 1.5,
                color: "var(--session-ink-soft)",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: "1px solid var(--session-hair)",
                borderRadius: 0,
                padding: "var(--sp-sm) 0 var(--sp-sm)",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
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
          padding: "12px 20px",
          flexShrink: 0,
          borderBottom: "1px solid var(--session-hair-soft)",
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

        {/* Wordmark — sage period */}
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "20px",
            fontWeight: 400,
            color: "var(--session-ink)",
            letterSpacing: "-0.5px",
          }}
        >
          mywalnut<span style={{ color: "var(--session-persona)" }}>.</span>
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
            background: "linear-gradient(to bottom, var(--session-glow-scroll) 0%, var(--session-persona-tint) 40%, transparent 100%)",
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
                // Track A Gate 6: suppress the pending card while the
                // first-checkpoint modal is open so the user reads the
                // modal before the card appears. Dismissal unsets
                // modal3Open in the same render cycle — the card
                // appears exactly when the modal disappears.
                // Historical (non-pending) checkpoints still render.
                if (isPendingCheckpoint && modal3Open) return null;
                const checkpointLayer = isPendingCheckpoint
                  ? activeCheckpoint?.layer
                  : msg.checkpointMeta?.layer;

                const accentColor = "var(--session-persona)";

                // Track A Phase 7-Mid: refinement-ceiling. After two
                // refinements on the same chain, the third proposed
                // entry shows a different action surface — the user
                // chooses between accepting the entry as-is or
                // letting it go (a defer, not a flat reject).
                const refinementCeilingActive =
                  isPendingCheckpoint &&
                  (msg.checkpointMeta?.refinement_count ?? 0) >= 2;

                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 0.45s ease both",
                      background: "var(--session-cream)",
                      border: `1px solid var(--session-hair)`,
                      borderTop: `2px solid var(--session-persona)`,
                      boxShadow: "var(--lift)",
                      padding: "var(--sp-xl) var(--sp-lg) var(--sp-lg)",
                      margin: "var(--sp-md) 0 var(--sp-sm)",
                      position: "relative",
                    }}
                  >
                    {/* Opening quote — oversized sage, the only ornament */}
                    <span aria-hidden="true" style={{
                      position: "absolute",
                      top: 6,
                      left: 14,
                      fontFamily: "var(--font-serif)",
                      fontStyle: "italic",
                      fontSize: "72px",
                      lineHeight: 1,
                      color: "var(--session-persona)",
                      opacity: 0.45,
                      fontWeight: 400,
                      userSelect: "none",
                    }}>&ldquo;</span>

                    {/* Layer name header */}
                    {checkpointLayer && LAYER_NAMES[checkpointLayer] && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
                          fontWeight: 400,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          color: "var(--session-ink-mid)",
                          marginBottom: "var(--sp-sm)",
                          lineHeight: 1,
                        }}
                      >
                        {LAYER_NAMES[checkpointLayer]}
                      </div>
                    )}

                    {/* Body text */}
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "17px",
                        fontWeight: 400,
                        lineHeight: 1.5,
                        color: "var(--session-ink)",
                        letterSpacing: "-0.2px",
                        position: "relative",
                      }}
                    >
                      {renderMarkdown(msg.content)}
                    </div>

                    {/* Divider + prompt + buttons (pending only).
                        Two action surfaces: normal three-button row,
                        and the refinement-ceiling fork (two buttons
                        with a different inline message). */}
                    {isPendingCheckpoint && !checkpointActionState && (
                      <div
                        style={{
                          marginTop: "var(--sp-md)",
                          paddingTop: "var(--sp-sm)",
                          borderTop: "1px solid var(--session-hair-soft)",
                        }}
                      >
                        {refinementCeilingActive ? (
                          <>
                            <p
                              style={{
                                fontFamily: "var(--font-serif)",
                                fontSize: "14px",
                                fontStyle: "italic",
                                color: "var(--session-ink-mid)",
                                lineHeight: 1.5,
                                margin: "0 0 var(--sp-sm) 0",
                              }}
                            >
                              Close but not quite is fine. Want me to put it in as it is, or let it go and we come back to it?
                            </p>

                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-xs)" }}>
                              <button
                                onClick={() => {
                                  setCheckpointActionState("confirmed");
                                  confirmCheckpoint("confirmed");
                                }}
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "11px",
                                  letterSpacing: "2.2px",
                                  textTransform: "uppercase",
                                  color: "var(--session-ink)",
                                  background: "none",
                                  border: "none",
                                  borderBottom: "1px solid var(--session-ink)",
                                  cursor: "pointer",
                                  padding: "var(--sp-xs) 0 var(--sp-tight)",
                                  width: "100%",
                                  textAlign: "left",
                                }}
                              >
                                Put it in as it is &nbsp;›
                              </button>
                              <button
                                onClick={() => {
                                  setCheckpointActionState("deferred");
                                  confirmCheckpoint("deferred");
                                }}
                                style={{
                                  fontFamily: "var(--font-serif)",
                                  fontSize: "15px",
                                  fontStyle: "italic",
                                  color: "var(--session-ink-mid)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "var(--sp-xs) 0",
                                  width: "100%",
                                  textAlign: "left",
                                }}
                              >
                                let it go
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p
                              style={{
                                fontFamily: "var(--font-serif)",
                                fontSize: "14px",
                                fontStyle: "italic",
                                color: "var(--session-ink-faded)",
                                margin: "0 0 var(--sp-sm) 0",
                              }}
                            >
                              Does this feel right?
                            </p>

                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-tight)" }}>
                              {/* Primary — text button with rule beneath */}
                              <button
                                onClick={() => {
                                  setCheckpointActionState("confirmed");
                                  confirmCheckpoint("confirmed");
                                }}
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "11px",
                                  letterSpacing: "2.2px",
                                  textTransform: "uppercase",
                                  color: "var(--session-ink)",
                                  background: "none",
                                  border: "none",
                                  borderBottom: "1px solid var(--session-ink)",
                                  cursor: "pointer",
                                  padding: "var(--sp-xs) 0 var(--sp-tight)",
                                  width: "100%",
                                  textAlign: "left",
                                }}
                              >
                                Put it in my Manual &nbsp;›
                              </button>

                              {/* Secondary — italic text links */}
                              <div style={{ display: "flex", gap: "var(--sp-lg)", paddingTop: "var(--sp-xs)" }}>
                                <button
                                  onClick={() => {
                                    setCheckpointActionState("refined");
                                    confirmCheckpoint("refined");
                                  }}
                                  style={{
                                    fontFamily: "var(--font-serif)",
                                    fontSize: "15px",
                                    fontStyle: "italic",
                                    color: "var(--session-ink-mid)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  close but not quite
                                </button>
                                <button
                                  onClick={() => {
                                    setCheckpointActionState("rejected");
                                    confirmCheckpoint("rejected");
                                  }}
                                  style={{
                                    fontFamily: "var(--font-serif)",
                                    fontSize: "15px",
                                    fontStyle: "italic",
                                    color: "var(--session-ink-faded)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  this is not me
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Action state feedback */}
                    {isPendingCheckpoint && checkpointActionState && (
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--session-hair-soft)",
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
                          {checkpointActionState === "deferred" && "Set aside"}
                        </span>
                      </div>
                    )}

                    {/* Already-resolved checkpoints (loaded from DB) */}
                    {isCheckpoint && !isPendingCheckpoint && msg.checkpointMeta?.status && msg.checkpointMeta.status !== "pending" && (
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--session-hair-soft)",
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
                    {/* Rail — 2px persona line, text indented. Text uses
                        --ink-persona (the role-based "Jove voice" color)
                        rather than --ink so dark-mode Jove doesn't shout
                        in pure cream while quieter text on the page sits
                        at a softer brightness. */}
                    <div
                      style={{
                        borderLeft: "2px solid var(--session-persona)",
                        paddingLeft: "var(--sp-sm)",
                        paddingTop: "var(--sp-tight)",
                        paddingBottom: "var(--sp-tight)",
                        fontFamily: "var(--font-persona)",
                        fontSize: "18px",
                        fontWeight: 400,
                        lineHeight: 1.65,
                        color: "var(--session-ink-persona)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-persona)",
                          fontSize: "18px",
                          fontWeight: 400,
                          lineHeight: 1.65,
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

              // User message — italic serif, sage left rule, indented from
              // a deeper margin than Jove so the reader's interjections sit
              // visually "to the right" of Jove's annotations. The left
              // margin pulls the rail in past Jove's column; the rule and
              // text both shift together. Marginalia, not a competing
              // speaker, but clearly the reader's hand.
              return (
                <div
                  key={msg.id || `msg-${i}`}
                  style={{
                    marginLeft: "var(--sp-xl)",
                    paddingLeft: "var(--sp-sm)",
                    borderLeft: `2px solid var(--session-persona-muted)`,
                    animation: "checkpointFadeIn 0.45s ease-out both",
                  }}
                >
                  {msg.channel === "text" && (
                    <div style={{ marginBottom: "2px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
                    </div>
                  )}
                  <p
                    style={{
                      fontFamily: "var(--font-persona)",
                      fontSize: "17.5px",
                      fontWeight: 400,
                      fontStyle: "italic",
                      lineHeight: 1.6,
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

            {/* Error — oxblood top-rule, plain text, a way forward */}
            {errorMessage && (
              <div
                style={{
                  borderTop: "2px solid var(--session-error)",
                  padding: "var(--sp-sm) 0",
                  margin: "var(--sp-sm) 0",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "15px",
                    fontStyle: "italic",
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.5,
                  }}
                >
                  {errorMessage}
                </span>
                <div style={{ marginTop: "var(--sp-xs)" }}>
                  <button
                    onClick={retryLastMessage}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "2.2px",
                      textTransform: "uppercase",
                      color: "var(--session-persona)",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--session-persona)",
                      cursor: "pointer",
                      padding: "0 0 2px",
                    }}
                  >
                    try again &nbsp;›
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

      <ChatWindowModal
        open={
          typeof modalProgress === "number" &&
          modalProgress < 1 &&
          !isAnonymous &&
          !modal1Dismissed
        }
        onDismiss={() => setModal1Dismissed(true)}
        signupAtMs={signupAtMs}
      />

      <PatternFormingModal
        open={
          typeof modalProgress === "number" &&
          modalProgress === 1 &&
          !isAnonymous &&
          hasLayerEmergingOrBeyond &&
          concreteExamples >= 1 &&
          typeof emergingPatternSnippet === "string" &&
          emergingPatternSnippet.length > 0 &&
          !modal2Dismissed
        }
        onDismiss={() => setModal2Dismissed(true)}
        patternSnippet={emergingPatternSnippet ?? ""}
        signupAtMs={signupAtMs}
      />

      <FirstCheckpointModal
        open={modal3Open}
        onDismiss={() => setModal3Dismissed(true)}
        signupAtMs={signupAtMs}
      />
    </main>
  );
}
