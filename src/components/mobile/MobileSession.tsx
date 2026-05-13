"use client";

import React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
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
import ConnectionErrorPlate from "@/components/shared/ConnectionErrorPlate";
import QuickReplyChips from "./QuickReplyChips";

const RETURNING_GREETINGS: ((name?: string | null) => string)[] = [
  (name) => name ? `Welcome back, ${name}.` : "Welcome back.",
  (name) => name ? `Good to see you, ${name}.` : "Good to see you.",
  () => "What's been with you?",
  (name) => name ? `Hey, ${name}.` : "Hey.",
  () => "Ready when you are.",
  () => "What brings you here today?",
];

const LAYER_ORDINAL: Record<number, string> = {
  1: "One",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
};

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
    action: "confirmed" | "rejected" | "refined" | "deferred"
  ) => void;
  startGuidedIntake: () => Promise<boolean>;
  startUpload: () => Promise<boolean>;
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
  firstName?: string | null;
  onOpenDrawer: () => void;
  /** Snapshot of the entry the user is exploring further. Drives the
      walnut context chip at the top of chat. */
  currentExploration?: import("@/lib/types").ExplorationContext | null;
  onDismissExploration?: () => void;
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
  startUpload,
  isGuest,
  onSignInPrompt,
  modalProgress = null,
  signupAtMs = null,
  isAnonymous = false,
  emergingPatternSnippet = null,
  hasLayerEmergingOrBeyond = false,
  concreteExamples = 0,
  firstName = null,
  onOpenDrawer,
  currentExploration = null,
  onDismissExploration,
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
  useEffect(() => { setChipsVisible(true); }, [conversationId]);
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
  const isReturning = confirmedEntries.length > 0;
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
    : "Hello,\nI’m Jove.";

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
        padding: "0 4px 24px",
      }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "1.8px",
          color: "var(--session-ink-ghost)",
          marginBottom: "16px",
        }}>
          {formatWelcomeDate()}
        </div>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "44px",
          fontWeight: 400,
          color: "var(--session-ink)",
          lineHeight: 1.1,
          margin: 0,
          letterSpacing: "-0.8px",
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
          fontSize: "18px",
          color: "var(--session-ink-persona)",
          margin: "12px 0 0",
          lineHeight: 1.4,
        }}>
          What&apos;s on your mind today?
        </p>
      </div>
      <button
        onClick={() => { setChipsVisible(false); sendMessage("I have a situation I want to work through"); }}
        disabled={isLoading || isStreaming}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 16px",
          backgroundColor: "var(--session-cream)",
          border: "1px solid var(--session-hair)",
          borderRadius: "12px",
          cursor: "pointer",
          textAlign: "left" as const,
          width: "100%",
        }}
      >
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          backgroundColor: "var(--session-persona-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 3.5h12a.5.5 0 01.5.5v8a.5.5 0 01-.5.5h-5l-3.5 3V12.5H3a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z" stroke="var(--session-persona)" strokeWidth="1.2" fill="none" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            color: "var(--session-ink)",
            lineHeight: 1.3,
          }}>Navigate a situation</div>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-ink-mid)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}>Something on your mind right now</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 4l4 4-4 4" stroke="var(--session-ink-ghost)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        onClick={() => {
          setChipsVisible(false);
          startGuidedIntake();
        }}
        disabled={isLoading || isStreaming}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 16px",
          backgroundColor: "var(--session-cream)",
          border: "1px solid var(--session-hair)",
          borderRadius: "12px",
          cursor: "pointer",
          textAlign: "left" as const,
          width: "100%",
        }}
      >
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          backgroundColor: "var(--session-persona-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="4" cy="4.5" r="1.5" fill="var(--session-persona)" />
            <line x1="8" y1="4.5" x2="15" y2="4.5" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="4" cy="9" r="1.5" fill="var(--session-persona)" />
            <line x1="8" y1="9" x2="15" y2="9" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="4" cy="13.5" r="1.5" fill="var(--session-persona)" />
            <line x1="8" y1="13.5" x2="15" y2="13.5" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            color: "var(--session-ink)",
            lineHeight: 1.3,
          }}>Guided intake</div>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-ink-mid)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}>Let Jove lead with questions</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 4l4 4-4 4" stroke="var(--session-ink-ghost)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        onClick={() => {
          setChipsVisible(false);
          startUpload();
        }}
        disabled={isLoading || isStreaming}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 16px",
          backgroundColor: "var(--session-cream)",
          border: "1px solid var(--session-hair)",
          borderRadius: "12px",
          cursor: "pointer",
          textAlign: "left" as const,
          width: "100%",
        }}
      >
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          backgroundColor: "var(--session-persona-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 11.5v3a1 1 0 001 1h10a1 1 0 001-1v-3" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M9 3v8M5.5 6.5L9 3l3.5 3.5" stroke="var(--session-persona)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            color: "var(--session-ink)",
            lineHeight: 1.3,
          }}>Upload</div>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-ink-mid)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}>Share something that&apos;s been with you</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 4l4 4-4 4" stroke="var(--session-ink-ghost)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
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
      <TopBar onMenu={onOpenDrawer} />

      {/* Explore-further context chip — surfaces the entry being
          explored at the top of chat. Small walnut chip; layer eyebrow
          + entry name (or layer name if no entry). Dismissable. */}
      {currentExploration && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            margin: "10px 18px 0",
            padding: "8px 14px",
            borderRadius: 999,
            background: "var(--session-walnut-surface)",
            border: "1px solid var(--session-walnut-border)",
            backdropFilter: "blur(20px) saturate(140%)",
            WebkitBackdropFilter: "blur(20px) saturate(140%)",
            animation: "checkpointFadeIn 0.3s ease-out both",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "var(--session-walnut-meta)",
                lineHeight: 1,
              }}
            >
              Layer {LAYER_ORDINAL[currentExploration.layerId] ?? currentExploration.layerId} · {currentExploration.layerName}
            </span>
            <span
              style={{
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 13,
                color: "var(--session-ink)",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentExploration.name || currentExploration.layerName}
            </span>
          </div>
          {onDismissExploration && (
            <button
              onClick={onDismissExploration}
              aria-label="Dismiss exploration context"
              style={{
                all: "unset",
                cursor: "pointer",
                width: 44,
                height: 44,
                marginRight: -10,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--session-ink)",
                fontSize: 14,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

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

                    {/* Action state feedback. For "confirmed" this is
                        the composing state — Sonnet writes the polished
                        entry server-side (5-15s); show a pulsing fleuron
                        and italic "Putting it on the page…". For all
                        other action states show the mono-caps receipt. */}
                    {isPendingCheckpoint && checkpointActionState && (
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--session-hair-soft)",
                          animation: "checkpointFadeIn 0.4s ease-out both",
                        }}
                      >
                        {checkpointActionState === "confirmed" ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "baseline",
                              gap: 10,
                            }}
                          >
                            <span
                              aria-label="Putting it on the page"
                              style={{
                                fontFamily: "var(--font-serif)",
                                fontSize: 18,
                                color: "var(--session-persona)",
                                lineHeight: 1,
                                display: "inline-block",
                                animation: "personaPulse 2.4s ease-in-out infinite",
                              }}
                            >
                              ❦
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                                fontSize: 15,
                                fontStyle: "italic",
                                color: "var(--session-ink-soft)",
                                lineHeight: 1.5,
                              }}
                            >
                              Putting it on the page…
                            </span>
                          </div>
                        ) : (
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
                        )}
                      </div>
                    )}

                    {/* Already-resolved checkpoints (loaded from DB) —
                        confirmed entries render "Saved to Layer N"
                        with walnut accent (the entry is now part of
                        the Manual); other statuses keep the mono-caps
                        receipt in ink-ghost. */}
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
                              ? "var(--session-walnut)"
                              : "var(--session-ink-ghost)",
                          }}
                        >
                          {msg.checkpointMeta.status === "confirmed" && checkpointLayer
                            ? `Saved to Layer ${LAYER_ORDINAL[checkpointLayer] ?? checkpointLayer}`
                            : msg.checkpointMeta.status === "confirmed"
                              ? "Saved to your Manual"
                              : null}
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
