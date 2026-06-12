"use client";

import React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import ChatInput from "./ChatInput";
import ChatWindowModal from "@/components/modals/ChatWindowModal";
import PatternFormingModal from "@/components/modals/PatternFormingModal";
import type { ChatMessage, ManualEntry, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown, stripCheckpointFooter } from "@/lib/utils/format";
import { LAYER_NAMES, LAYER_ORDINAL, formatLayerEyebrow } from "@/lib/manual/layers";
import { PERSONA_NAME, type CheckpointAction, type ConversationMode } from "@/lib/persona/config";
import Bubble from "@/components/shared/Bubble";
import Plate from "@/components/shared/Plate";
import CheckpointOverlay from "@/components/checkpoint/CheckpointOverlay";
import TopBar from "@/components/shared/TopBar";
import ConnectionErrorPlate from "@/components/shared/ConnectionErrorPlate";
import QuickReplyChips from "./QuickReplyChips";
import EntryCard from "./EntryCard";

const RETURNING_GREETINGS: ((name?: string | null) => string)[] = [
  (name) => name ? `Welcome back, ${name}.` : "Welcome back.",
  (name) => name ? `Good to see you, ${name}.` : "Good to see you.",
  () => "What's been with you?",
  (name) => name ? `Hey, ${name}.` : "Hey.",
  () => "Ready when you are.",
  () => "What brings you here today?",
];


function formatWelcomeDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

interface MobileSessionProps {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  confirmedEntries: ManualEntry[];
  activeCheckpoint: ActiveCheckpoint | null;
  checkpointError: string | null;
  errorMessage: string | null;
  sendMessage: (text: string) => void;
  sendChipResponse: (text: string) => void;
  retryLastMessage: () => void;
  confirmCheckpoint: (
    action: CheckpointAction,
    edits?: { editedContent?: string | null; editedName?: string | null }
  ) => void;
  startConversation: (mode: ConversationMode) => Promise<boolean>;
  isGuest?: boolean;
  onSignInPrompt?: () => void;
  // Onboarding modal state. modalProgress=null means MainApp hasn't
  // finished loading it yet — modals are suppressed until known so we
  // never flash a modal that immediately disappears. Anonymous-auth
  // users are excluded (they convert at first checkpoint and the modal
  // flow starts then).
  modalProgress?: number | null;
  /** Lifts a modal-progress advance back into MainApp so the next modal's gate
   *  sees the new value in the same session (not just after a page reload). */
  onModalProgressAdvance?: (target: number) => void;
  signupAtMs?: number | null;
  isAnonymous?: boolean;
  // Modal 2 (Pattern-Forming) trigger inputs from the latest
  // message_complete event (one-turn lag, server-side).
  emergingPatternSnippet?: string | null;
  hasLayerEmergingOrBeyond?: boolean;
  concreteExamples?: number;
  firstName?: string | null;
  onOpenDrawer: () => void;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
  // Server-rejected paste recovery: when /api/chat returns a 400 with an
  // `error` message (e.g. MAX_UPLOAD_LENGTH), useChat surfaces the
  // rejected text here so ChatInput can rehydrate the textarea. Cleared
  // via onDraftRestored once consumed.
  draftToRestore?: string | null;
  onDraftRestored?: () => void;
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
  startConversation,
  isGuest,
  onSignInPrompt,
  modalProgress = null,
  onModalProgressAdvance,
  signupAtMs = null,
  isAnonymous = false,
  emergingPatternSnippet = null,
  hasLayerEmergingOrBeyond = false,
  concreteExamples = 0,
  firstName = null,
  onOpenDrawer,
  showTopBar = true,
  draftToRestore = null,
  onDraftRestored,
}: MobileSessionProps) {
  const [modal1Dismissed, setModal1Dismissed] = useState(false);
  const [modal2Dismissed, setModal2Dismissed] = useState(false);
  // Auto-advance modal_progress past the first-checkpoint gate when a
  // checkpoint arrives. No modal shown — the inline trigger card + overlay
  // handles the experience. Fire-and-forget; ref prevents duplicate POSTs.
  const modal3AdvancedRef = useRef(false);
  useEffect(() => {
    if (
      typeof modalProgress === "number" &&
      modalProgress === 2 &&
      !isAnonymous &&
      activeCheckpoint !== null &&
      !modal3AdvancedRef.current
    ) {
      modal3AdvancedRef.current = true;
      onModalProgressAdvance?.(3);
      fetch("/api/modal-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: 3 }),
      }).catch(() => {});
    }
  }, [modalProgress, isAnonymous, activeCheckpoint, onModalProgressAdvance]);
  const [chipsVisible, setChipsVisible] = useState(true);
  useEffect(() => { setChipsVisible(true); }, [conversationId]);
  const [checkpointActionState, setCheckpointActionState] = useState<CheckpointAction | null>(null);
  const [checkpointOverlayOpen, setCheckpointOverlayOpen] = useState(false);
  const overlayCheckpointRef = useRef<ActiveCheckpoint | null>(null);

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
  const isReturning = confirmedEntries.length > 0;
  const refinementCeilingActive = useMemo(
    () =>
      activeCheckpoint !== null &&
      messages.some(
        (m) =>
          m.id === activeCheckpoint.messageId &&
          (m.checkpointMeta?.refinement_count ?? 0) >= 2
      ),
    [activeCheckpoint, messages]
  );
  const hasRealName =
    !!firstName &&
    firstName !== "User" &&
    firstName !== firstName.toLowerCase();
  const greetingIndex = useMemo(
    () => Math.floor(Math.random() * RETURNING_GREETINGS.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId]
  );
  const greeting = isReturning
    ? RETURNING_GREETINGS[greetingIndex](hasRealName ? firstName : null)
    : `Hello,\nI’m ${PERSONA_NAME}.`;

  const showEntryCards = chipsVisible && !hasMessages && !isLoading;
  const entryCards = showEntryCards ? (
    <div
      key="entry-cards"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        animation: "mwFadeIn 0.6s ease-out",
      }}
    >
      {/* Welcome header */}
      <div style={{
        padding: "0 4px 36px",
      }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "1.8px",
          color: "var(--session-walnut-meta)",
          marginBottom: "16px",
        }}>
          {formatWelcomeDate()}
        </div>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "30px",
          fontWeight: 400,
          color: "var(--session-ink)",
          lineHeight: 1.1,
          margin: 0,
          letterSpacing: "-0.5px",
          whiteSpace: "pre-line",
        }}>
          {greeting.endsWith(".") ? (
            <>
              {greeting.slice(0, -1)}
              <span style={{ color: "var(--session-walnut)" }}>.</span>
            </>
          ) : greeting}
        </h1>
        <p style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: "13.5px",
          color: "var(--session-ink-persona)",
          margin: "10px 0 0",
          lineHeight: 1.4,
        }}>
          What&apos;s on your mind today?
        </p>
      </div>
      <EntryCard
        title="Navigate a situation"
        subtitle="Something on your mind right now"
        disabled={isLoading || isStreaming}
        onClick={() => {
          setChipsVisible(false);
          startConversation("situation");
        }}
        icon={
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 3.5h12a.5.5 0 01.5.5v8a.5.5 0 01-.5.5h-5l-3.5 3V12.5H3a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z"
              stroke="var(--session-persona)"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        }
      />

      <EntryCard
        title="Guided intake"
        subtitle={`Let ${PERSONA_NAME} lead with questions`}
        disabled={isLoading || isStreaming}
        onClick={() => {
          setChipsVisible(false);
          startConversation("guided-intake");
        }}
        icon={
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="4" cy="4.5" r="1.5" fill="var(--session-persona)" />
            <line x1="8" y1="4.5" x2="15" y2="4.5" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="4" cy="9" r="1.5" fill="var(--session-persona)" />
            <line x1="8" y1="9" x2="15" y2="9" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="4" cy="13.5" r="1.5" fill="var(--session-persona)" />
            <line x1="8" y1="13.5" x2="15" y2="13.5" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        }
      />

      <EntryCard
        title="Upload"
        subtitle="Share something that&apos;s been with you"
        disabled={isLoading || isStreaming}
        onClick={() => {
          setChipsVisible(false);
          startConversation("upload");
        }}
        icon={
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 11.5v3a1 1 0 001 1h10a1 1 0 001-1v-3"
              stroke="var(--session-persona)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M9 3v8M5.5 6.5L9 3l3.5 3.5"
              stroke="var(--session-persona)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />
    </div>
  ) : null;

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
      {showTopBar && <TopBar onMenu={onOpenDrawer} />}

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

      {/* Messages area wrapper. The mask on the scroll child below feathers
          both top and bottom edges so content dissolves into the surrounding
          surface — top into header space, bottom into the input zone — rather
          than getting sliced at a hard overflow boundary. */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Scrollable content */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Conversation messages"
          className="mw-scroll"
          style={{
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            willChange: "transform",
            display: "flex",
            flexDirection: "column",
            padding: "20px 16px 14px",
            gap: "14px",
            maskImage:
              "linear-gradient(to bottom, transparent 0, black 12px, black calc(100% - 28px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0, black 12px, black calc(100% - 28px), transparent 100%)",
          }}
        >
          {/* Spacer pushes messages to bottom of viewport */}
          <div style={{ flexGrow: 1, minHeight: "24px" }} />

          {entryCards}

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

                // ── Pending checkpoint: trigger card ──
                // A bright Plate (--session-jove-bg) with a brass layer
                // eyebrow matching the Manual headers + confirm overlay.
                // Body uses --session-jove-bg so the card belongs to
                // Jove's side of the conversation. A soft brass halo
                // around the frame marks this as a moment, not a resting
                // Manual card. See .checkpoint-trigger-frame and
                // .checkpoint-trigger-plate in globals.css for the halo +
                // shadow stack.
                if (isPendingCheckpoint) {
                  const cpLayer = activeCheckpoint?.layer;
                  return (
                    <div
                      key={msg.id || `msg-${i}`}
                      className="checkpoint-trigger-frame"
                    >
                      <button
                        type="button"
                        className="checkpoint-trigger-plate"
                        onClick={() => {
                          overlayCheckpointRef.current = activeCheckpoint;
                          setCheckpointOverlayOpen(true);
                        }}
                      >
                        {/* The trigger reads as the Plate the moment it
                            appears: centered brass eyebrow, a display
                            headline, the brass rule. Tapping opens the
                            confirm overlay for the full entry + actions. */}
                        {cpLayer && (
                          <p
                            style={{
                              margin: "0 0 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              fontWeight: 500,
                              letterSpacing: "0.22em",
                              textTransform: "uppercase",
                              color: "var(--session-walnut-meta-strong)",
                              textAlign: "center",
                            }}
                          >
                            {formatLayerEyebrow(cpLayer)}
                          </p>
                        )}
                        {activeCheckpoint?.name && (
                          <h3
                            style={{
                              margin: "0 auto",
                              maxWidth: "22ch",
                              fontFamily: "var(--font-serif), Georgia, serif",
                              fontSize: 25,
                              fontWeight: 400,
                              lineHeight: 1.14,
                              letterSpacing: "-0.01em",
                              color: "var(--session-ink)",
                              textAlign: "center",
                            }}
                          >
                            {activeCheckpoint.name}
                          </h3>
                        )}
                        <div
                          aria-hidden="true"
                          style={{
                            width: 64,
                            height: 2,
                            margin: "16px auto 0",
                            background: "var(--session-walnut-border)",
                          }}
                        />
                        <div
                          style={{
                            margin: "16px 0 0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 7,
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            color: "var(--session-walnut-meta)",
                          }}
                        >
                          <span>Tap to review</span>
                          <span aria-hidden="true">&rarr;</span>
                        </div>
                      </button>

                      {/* Action state receipt (after overlay closes) */}
                      {checkpointActionState && checkpointActionState !== "confirmed" && (
                        <div
                          style={{
                            marginTop: 12,
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
                              color: "var(--session-ink-ghost)",
                            }}
                          >
                            {checkpointActionState === "refined" && `${PERSONA_NAME} will revisit this`}
                            {checkpointActionState === "rejected" && "Discarded"}
                            {checkpointActionState === "deferred" && "Set aside"}
                          </span>
                        </div>
                      )}

                      {checkpointError && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--size-meta)",
                            color: "var(--session-ink-ghost)",
                            marginTop: 12,
                            display: "block",
                          }}
                        >
                          {checkpointError}
                        </span>
                      )}
                    </div>
                  );
                }

                // ── Historical checkpoint: Plate with status label ──
                // Rejected/discarded checkpoints collapse to title + status
                // only — no full content. Confirmed and refined show the
                // full entry so the user can re-read what landed.
                const isRejected = msg.checkpointMeta?.status === "rejected";

                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 0.45s ease both",
                      margin: "var(--sp-md) 0 var(--sp-sm)",
                    }}
                  >
                    <Plate
                      eyebrow={checkpointLayer ? formatLayerEyebrow(checkpointLayer) : undefined}
                      heading={msg.checkpointMeta?.name || undefined}
                    >
                      {!isRejected && renderMarkdown(stripCheckpointFooter(msg.content))}

                      {msg.checkpointMeta?.status && msg.checkpointMeta.status !== "pending" && (
                        <div
                          style={{
                            marginTop: isRejected ? 0 : 16,
                            paddingTop: isRejected ? 0 : 12,
                            borderTop: isRejected ? "none" : "1px solid var(--session-hair-soft)",
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
                                ? "var(--session-walnut)"
                                : "var(--session-ink-ghost)",
                            }}
                          >
                            {msg.checkpointMeta.status === "confirmed" && checkpointLayer && LAYER_NAMES[checkpointLayer]
                              ? `Saved to ${LAYER_NAMES[checkpointLayer]} — Layer ${LAYER_ORDINAL[checkpointLayer] ?? checkpointLayer}`
                              : msg.checkpointMeta.status === "confirmed" && checkpointLayer
                                ? `Saved to Layer ${LAYER_ORDINAL[checkpointLayer] ?? checkpointLayer}`
                                : msg.checkpointMeta.status === "confirmed"
                                  ? "Saved to your Manual"
                                  : null}
                            {msg.checkpointMeta.status === "refined" && `${PERSONA_NAME} will revisit this`}
                            {msg.checkpointMeta.status === "rejected" && "Discarded"}
                          </span>
                        </div>
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

            {/* Typing indicator. Shows when a Jove turn is in-flight and
                we don't already have a chat bubble for it. Three cases
                where the last message is NOT a fresh user message but the
                indicator should still fire:
                  - First-turn boot (messages.length === 0)
                  - Post-user-message wait (default case)
                  - Post-confirm wait (last message is a checkpoint card;
                    Jove is composing the continue-or-pivot follow-up) */}
            {(isLoading || isStreaming) &&
              (messages.length === 0 ||
               messages[messages.length - 1].role === "user" ||
               messages[messages.length - 1].isCheckpoint === true) && (
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
                      aria-label={`${PERSONA_NAME} is typing`}
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "17px",
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

            {/* Connection / send error — walnut plate with oxblood
                eyebrow. Same plate-on-chat pattern as the checkpoint
                proposal, so the error reads as a moment in the
                conversation rather than a takeover screen. */}
            {errorMessage && (
              <ConnectionErrorPlate
                message={errorMessage}
                onRetry={retryLastMessage}
              />
            )}
        </div>
      </div>

      <ChatInput
        onSend={sendMessage}
        disabled={isLoading || isStreaming || conversationId === "text-channel"}
        draftToRestore={draftToRestore}
        onDraftRestored={onDraftRestored}
      />

      <ChatWindowModal
        open={
          typeof modalProgress === "number" &&
          modalProgress < 1 &&
          !isAnonymous &&
          !modal1Dismissed
        }
        onDismiss={() => {
          setModal1Dismissed(true);
          onModalProgressAdvance?.(1);
        }}
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
        onDismiss={() => {
          setModal2Dismissed(true);
          onModalProgressAdvance?.(2);
        }}
        patternSnippet={emergingPatternSnippet ?? ""}
        signupAtMs={signupAtMs}
      />


      {overlayCheckpointRef.current && (
        <CheckpointOverlay
          open={checkpointOverlayOpen}
          checkpoint={overlayCheckpointRef.current}
          refinementCeilingActive={refinementCeilingActive}
          confirmStatus={
            checkpointActionState !== "confirmed"
              ? "idle"
              : checkpointError
                ? "error"
                : activeCheckpoint === null
                  ? "success"
                  : "pending"
          }
          errorMessage={checkpointError}
          onAction={(action, edits) => {
            setCheckpointActionState(action);
            confirmCheckpoint(action, edits);
          }}
          onClose={() => {
            setCheckpointOverlayOpen(false);
            // Allow the user to try again from the trigger card after an
            // error closes the overlay.
            if (checkpointActionState === "confirmed" && checkpointError) {
              setCheckpointActionState(null);
            }
          }}
        />
      )}
    </main>
  );
}
