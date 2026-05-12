"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import ChatInput from "./ChatInput";
import ChatWindowModal from "@/components/modals/ChatWindowModal";
import PatternFormingModal from "@/components/modals/PatternFormingModal";
import FirstCheckpointModal from "@/components/modals/FirstCheckpointModal";
import type { ChatMessage, ManualEntry, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";
import { LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME } from "@/lib/persona/config";
import Bubble from "@/components/shared/Bubble";
import Plate from "@/components/shared/Plate";
import TopBar from "@/components/shared/TopBar";
import QuickReplyChips from "./QuickReplyChips";

const WELCOME_CHIPS = [
  "I have a situation I want to work through",
  "I know something about myself I want to capture",
  "I just need to think out loud",
] as const;


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
  sendMessage: (text: string) => void;
  sendChipResponse: (text: string) => void;
  retryLastMessage: () => void;
  confirmCheckpoint: (
    action: "confirmed" | "rejected" | "refined" | "deferred"
  ) => void;
  startGuidedIntake: () => Promise<boolean>;
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
  onOpenDrawer: () => void;
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
  sendMessage,
  sendChipResponse,
  retryLastMessage,
  confirmCheckpoint,
  startGuidedIntake,
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
  onOpenDrawer,
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
          <button
            onClick={() => {
              setChipsVisible(false);
              startGuidedIntake();
            }}
            disabled={isLoading || isStreaming}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 400,
              color: "var(--session-ink-mid)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0 0",
              textAlign: "center",
            }}
          >
            Help me get started
          </button>
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
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <TopBar onMenu={onOpenDrawer} />

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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 24px",
                gap: "16px",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-spectral), var(--font-persona), serif",
                  fontSize: "17px",
                  color: "var(--session-ink-persona)",
                  lineHeight: 1.55,
                  textAlign: "center",
                }}
              >
                What&rsquo;s going on? Or we can pick up where we left off.
              </p>
              <button
                onClick={() => startGuidedIntake()}
                disabled={isLoading || isStreaming}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "var(--session-ink-mid)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Help me get started
              </button>
            </div>
          )}

          {/* Fallback: empty conversation that matches neither State 1 nor State 2
              (e.g. user has entries but localStorage flag unset). Show the
              guided intake link so it's always discoverable. */}
          {!hasMessages && !isLoading && !showWelcomePanel && !(firstSessionCompleted && sessionOrigin === "new") && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 24px",
              }}
            >
              <button
                onClick={() => startGuidedIntake()}
                disabled={isLoading || isStreaming}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "var(--session-ink-mid)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Help me get started
              </button>
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
                      margin: "var(--sp-md) 0 var(--sp-sm)",
                    }}
                  >
                    <Plate
                      eyebrow={checkpointLayer && LAYER_NAMES[checkpointLayer] ? LAYER_NAMES[checkpointLayer] : undefined}
                    >
                      {renderMarkdown(msg.content)}

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
                    </Plate>
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

              if (!isUser) {
                const showChipsForMsg =
                  msg.chips &&
                  msg.chips.length > 0 &&
                  i === messages.length - 1 &&
                  !isStreaming &&
                  !isLoading;

                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{ animation: "checkpointFadeIn 0.8s ease-out both" }}
                  >
                    <Bubble speaker="jove" showLabel={isFirstInPersonaSequence}>
                      {msg.channel === "text" && (
                        <div style={{ marginBottom: "4px" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {React.Children.map(renderMarkdown(msg.content), (child) =>
                          React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
                                style: { ...(child as React.ReactElement<{ style?: React.CSSProperties }>).props.style, margin: 0 },
                              })
                            : child
                        )}
                      </div>
                    </Bubble>
                    {showChipsForMsg && (
                      <QuickReplyChips
                        chips={msg.chips!}
                        onSelect={sendChipResponse}
                        disabled={isLoading || isStreaming}
                      />
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id || `msg-${i}`}
                  style={{ animation: "checkpointFadeIn 0.45s ease-out both" }}
                >
                  <Bubble speaker="user">
                    {msg.channel === "text" && (
                      <div style={{ marginBottom: "4px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)", color: "var(--session-ink-ghost)", letterSpacing: "1px" }}>TEXT</span>
                      </div>
                    )}
                    {msg.content}
                  </Bubble>
                </div>
              );
            })}

            {/* Typing indicator */}
            {(isLoading || isStreaming) &&
              (messages.length === 0 || messages[messages.length - 1].role === "user") && (
                <div style={{ animation: "checkpointFadeIn 0.3s ease-out both" }}>
                  <Bubble
                    speaker="jove"
                    showLabel={
                      messages.length === 0 ||
                      messages[messages.length - 1]?.role !== "assistant" ||
                      messages[messages.length - 1]?.isCheckpoint === true
                    }
                  >
                    <span
                      aria-label="Jove is typing"
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "20px",
                        color: "var(--session-persona)",
                        lineHeight: 1,
                        display: "inline-block",
                        animation: "personaPulse 2.4s ease-in-out infinite",
                      }}
                    >
                      ❦
                    </span>
                  </Bubble>
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
