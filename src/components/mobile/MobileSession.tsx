"use client";

import React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import ChatInput from "./ChatInput";
import ReflectionIntroModal from "@/components/modals/ReflectionIntroModal";
import type { ChatMessage, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown, stripCheckpointFooter } from "@/lib/utils/format";
import { formatLayerEyebrow, sectionName } from "@/lib/manual/layers";
import { PERSONA_NAME, type CheckpointAction } from "@/lib/persona/config";
import Bubble from "@/components/shared/Bubble";
import Plate from "@/components/shared/Plate";
import CheckpointOverlay from "@/components/checkpoint/CheckpointOverlay";
import TopBar from "@/components/shared/TopBar";
import ConnectionErrorPlate from "@/components/shared/ConnectionErrorPlate";
import QuickReplyChips from "./QuickReplyChips";
import SectionPicker from "./SectionPicker";
import { useIsDesktop } from "@/lib/hooks/useIsDesktop";

/** First sentence of a checkpoint's entry, for the inline-preview teaser.
 *  Prefers the composed entry; falls back to the chat-stream content. Strips
 *  light markdown and caps length so the tee-up stays a glance — the full
 *  entry lives in the review popup. */
function checkpointTeaser(cp: ActiveCheckpoint | null): string {
  if (!cp) return "";
  const source = (
    cp.composedContent?.trim() || stripCheckpointFooter(cp.content ?? "")
  ).trim();
  if (!source) return "";
  const plain = source.replace(/[#>*_`~]/g, "").replace(/\s+/g, " ").trim();
  const match = plain.match(/^.*?[.!?](?=\s|$)/);
  let sentence = match ? match[0] : plain;
  if (sentence.length > 150) sentence = `${sentence.slice(0, 149).trimEnd()}…`;
  return sentence;
}

interface MobileSessionProps {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  // Split delivery: true while a checkpoint entry composes server-side
  // after its lead-in bubble has already landed. Keeps the typing
  // indicator visible even though the last message is a fresh assistant
  // bubble. Optional so older callers default to today's behavior.
  composingCheckpoint?: boolean;
  activeCheckpoint: ActiveCheckpoint | null;
  checkpointError: string | null;
  errorMessage: string | null;
  sendMessage: (text: string) => void;
  sendChipResponse: (text: string) => void;
  // Guided-intake live-situation handoff: start a fresh situation conversation.
  // Wired to startConversation("situation") in MainApp.
  onStartSituation: () => void;
  retryLastMessage: () => void;
  confirmCheckpoint: (
    action: CheckpointAction,
    edits?: { editedContent?: string | null; editedName?: string | null }
  ) => void;
  isGuest?: boolean;
  onSignInPrompt?: () => void;
  // Anonymous-auth users are excluded from one-time onboarding modals
  // (they convert at first checkpoint).
  isAnonymous?: boolean;
  // Reflection meter (user-pulled model, `reflection_meter` gate).
  // reflectionFill (0–100) is the server-computed capture-progress bar (null =
  // hide); reflectionReady is the latched completion; composeReflection builds
  // the entry on demand and returns it so the review overlay can open
  // immediately. All absent/no-op when the gate is off.
  reflectionFill?: number | null;
  reflectionReady?: boolean;
  composeReflection?: () => Promise<
    | { status: "ok"; checkpoint: ActiveCheckpoint }
    | { status: "blocked" }
    | { status: "error" }
  >;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
  // When this conversation was opened via "go deeper" on a Manual layer,
  // the layer name — shown as a context line under the header.
  scopedLabel?: string | null;
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
  composingCheckpoint = false,
  activeCheckpoint,
  checkpointError,
  errorMessage,
  sendMessage,
  sendChipResponse,
  onStartSituation,
  retryLastMessage,
  confirmCheckpoint,
  isGuest,
  onSignInPrompt,
  isAnonymous = false,
  reflectionFill = null,
  reflectionReady = false,
  composeReflection,
  showTopBar = true,
  scopedLabel = null,
  draftToRestore = null,
  onDraftRestored,
}: MobileSessionProps) {
  const [checkpointActionState, setCheckpointActionState] = useState<CheckpointAction | null>(null);
  const [checkpointOverlayOpen, setCheckpointOverlayOpen] = useState(false);
  const overlayCheckpointRef = useRef<ActiveCheckpoint | null>(null);

  // Reflection meter (user-pulled model). `composing` = a compose request is
  // in flight after the user taps the ready strip. There is no "defer" state:
  // the meter never interrupts the conversation, so the top strip IS the
  // proposal — it appears the moment readiness latches and waits until the
  // user pulls it (or a save clears it). The old bloom card (a composer-locking
  // takeover with a "Not yet" defer) was removed 2026-06-30.
  const [reflectionComposing, setReflectionComposing] = useState(false);

  // The server computes the capture-progress fill (resets on save, rebuilds).
  // A latched-ready state always shows full, so the bar and the strip can't
  // disagree (ready ⟺ full) even if a later turn's live fill dips.
  const reflectionMeterVisible = reflectionFill !== null;
  const displayFill = reflectionReady ? 100 : reflectionFill ?? 0;

  // Shared handler for the bloom button AND the deferred strip — both go
  // STRAIGHT to the composed output (compose on demand, then open the existing
  // review overlay). There is no path back to the bloom from the strip.
  const handleBuildReflection = async () => {
    if (!composeReflection || reflectionComposing || isLoading || isStreaming) {
      return;
    }
    // Open the popup NOW in its building state — the compose round-trip then
    // fills in the entry in place. Clear any stale checkpoint so the loaded
    // entry never flashes the previous one.
    overlayCheckpointRef.current = null;
    setCheckpointActionState(null);
    setReflectionComposing(true);
    setCheckpointOverlayOpen(true);
    const result = await composeReflection();
    if (result.status === "ok") {
      // Set the ref BEFORE clearing the loading flag so the re-render that
      // flips `loading` false reads the composed entry.
      overlayCheckpointRef.current = result.checkpoint;
      setReflectionComposing(false);
    } else {
      // "blocked" → the hook set promptAuth (the conversion modal handles it).
      // "error"   → the hook set checkpointError, surfaced under the affordance.
      setReflectionComposing(false);
      setCheckpointOverlayOpen(false);
    }
  };

  const [signInBannerDismissed, setSignInBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const dismissed = localStorage.getItem("mw_signin_banner_dismissed");
    if (!dismissed) return false;
    return Date.now() - parseInt(dismissed, 10) < 24 * 60 * 60 * 1000;
  });

  // One-time reflection-meter explainer. Per-device (localStorage), mirroring
  // the sign-in banner — deliberately not on the modal_progress ladder, which
  // is the pushed-model onboarding sequence. Shown the first time the ready
  // strip appears for a signed-in user (see the ReflectionIntroModal render).
  const [reflectionIntroSeen, setReflectionIntroSeen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mw_reflection_intro_seen") === "1";
  });
  const dismissReflectionIntro = () => {
    try {
      localStorage.setItem("mw_reflection_intro_seen", "1");
    } catch {
      // Private-mode / storage-disabled: the modal simply re-shows next ready.
    }
    setReflectionIntroSeen(true);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCheckpointRef = useRef<ActiveCheckpoint | null>(null);

  const isDesktop = useIsDesktop();
  // Quick-reply chips or the section picker are on screen for the latest Jove
  // turn. Drives the input's "Or type something else…" invitation so it's
  // clear the options are optional and free text is always available.
  const lastMessage = messages[messages.length - 1];
  const optionsShowing =
    !!lastMessage &&
    lastMessage.role === "assistant" &&
    !isStreaming &&
    !isLoading &&
    (((lastMessage.chips?.length ?? 0) > 0) || lastMessage.showSections === true);

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
      {showTopBar && <TopBar />}

      {/* In-body scoped context. On desktop (showTopBar=false) the RoomHeader
          carries the "Going deeper · {layer}" context instead, so suppress
          this bar there to avoid a doubled header. */}
      {scopedLabel && showTopBar && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "7px 16px",
            borderBottom: "1px solid var(--session-hair-soft)",
            background: "var(--session-walnut-tint)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              color: "var(--session-walnut-meta)",
            }}
          >
            Going deeper
          </span>
          <span aria-hidden="true" style={{ color: "var(--session-ink-faded)" }}>
            ·
          </span>
          <span
            style={{
              fontFamily: "var(--font-serif), serif",
              fontStyle: "italic",
              fontSize: 14,
              color: "var(--session-ink)",
            }}
          >
            {scopedLabel}
          </span>
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

      {/* Reflection meter (Tide — a hairline under the header). Fills as the
          conversation deepens; at full it blooms above the composer. Hidden
          entirely (reflectionFill null) when the gate is off or in crisis. */}
      {reflectionMeterVisible && (
        <div
          role="progressbar"
          aria-label="Understanding depth"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayFill)}
          style={{
            position: "relative",
            height: 3,
            background: "var(--session-walnut-surface-soft)",
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${displayFill}%`,
              borderRadius: displayFill >= 100 ? 0 : "0 3px 3px 0",
              background:
                "linear-gradient(90deg, var(--session-walnut-light), var(--session-walnut))",
              // Glow grows with the fill so the bar reads as alive while it
              // climbs, not just at the finish line; strongest when ready.
              boxShadow: `0 0 ${
                reflectionReady ? 9 : 3 + (displayFill / 100) * 5
              }px var(--session-walnut-light)`,
              transition:
                "width 0.9s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.6s ease",
            }}
          />
        </div>
      )}

      {/* Ready strip — the persistent "a reflection's ready" handle. Appears
          the moment readiness latches and waits under the header; it never
          locks the composer. Tapping it composes on demand and opens the
          review overlay. This is the entire proposal surface now that the
          bloom card is gone. */}
      {reflectionReady && (
        <>
        <button
          type="button"
          onClick={handleBuildReflection}
          disabled={reflectionComposing}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            width: "100%",
            padding: "10px 16px",
            flexShrink: 0,
            cursor: reflectionComposing ? "default" : "pointer",
            background: "var(--session-walnut-surface-soft)",
            border: "none",
            borderBottom: "1px solid var(--session-walnut-border)",
            animation: "checkpointFadeIn 0.4s ease both",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 15,
              color: "var(--session-walnut)",
              lineHeight: 1,
            }}
          >
            ❦
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--session-ink-soft)",
            }}
          >
            {reflectionComposing
              ? "Building your reflection…"
              : "A reflection's ready"}
          </span>
          {!reflectionComposing && (
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--session-walnut-meta-strong)",
              }}
            >
              Tap to build it &rarr;
            </span>
          )}
        </button>
        {checkpointError && (
          <p
            style={{
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              textAlign: "center",
              margin: 0,
              padding: "6px 16px 8px",
              background: "var(--session-walnut-surface-soft)",
              borderBottom: "1px solid var(--session-walnut-border)",
            }}
          >
            {checkpointError}
          </p>
        )}
        </>
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
                const checkpointSection = isPendingCheckpoint
                  ? activeCheckpoint?.section
                  : msg.checkpointMeta?.section;

                // ── Pending checkpoint: inline preview tee-up ──
                // A calm Plate that sits in the conversation flow (not a
                // spotlight): section eyebrow, headline, and a one-sentence
                // teaser of the entry. Tapping opens the review popup with
                // the full entry + actions. The full text lives in the
                // popup, so the inline card stays a glance.
                if (isPendingCheckpoint) {
                  const cpSection = activeCheckpoint?.section;
                  const teaser = checkpointTeaser(activeCheckpoint);
                  return (
                    <div
                      key={msg.id || `msg-${i}`}
                      style={{
                        margin: "var(--sp-md) 0 var(--sp-sm)",
                        animation: "checkpointFadeIn 0.5s ease forwards",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          overlayCheckpointRef.current = activeCheckpoint;
                          setCheckpointOverlayOpen(true);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: "none",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        <Plate
                          eyebrow={cpSection ? formatLayerEyebrow(cpSection) : undefined}
                          heading={activeCheckpoint?.name ?? undefined}
                        >
                          {teaser && <span style={{ display: "block" }}>{teaser}</span>}
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              marginTop: 16,
                              paddingTop: 12,
                              borderTop: "1px solid var(--session-walnut-border-soft)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              letterSpacing: "0.18em",
                              textTransform: "uppercase",
                              color: "var(--session-walnut-meta)",
                            }}
                          >
                            Tap to review
                            <span aria-hidden="true">&rarr;</span>
                          </span>
                        </Plate>
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
                      eyebrow={checkpointSection ? formatLayerEyebrow(checkpointSection) : undefined}
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
                            {msg.checkpointMeta.status === "confirmed" && checkpointSection
                              ? `Saved to ${sectionName(checkpointSection)}`
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
                    {msg.showSections &&
                      i === messages.length - 1 &&
                      !isStreaming &&
                      !isLoading && (
                        <SectionPicker
                          onSelect={sendChipResponse}
                          disabled={isLoading || isStreaming}
                        />
                      )}
                    {msg.offerStartSituation &&
                      i === messages.length - 1 &&
                      !isStreaming &&
                      !isLoading && (
                        <button
                          onClick={onStartSituation}
                          disabled={isLoading || isStreaming}
                          style={{
                            marginTop: "12px",
                            fontFamily: "var(--font-serif)",
                            fontSize: "15px",
                            fontStyle: "italic",
                            color: "var(--session-cream-bright)",
                            backgroundColor: "var(--session-persona)",
                            border: "none",
                            borderRadius: "8px",
                            padding: "10px 16px",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          Take this to its own conversation
                        </button>
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
                we don't already have a chat bubble for it. Four cases
                where the last message is NOT a fresh user message but the
                indicator should still fire:
                  - First-turn boot (messages.length === 0)
                  - Post-user-message wait (default case)
                  - Post-confirm wait (last message is a checkpoint card;
                    Jove is composing the continue-or-pivot follow-up)
                  - Split delivery (last message is the checkpoint lead-in
                    bubble; the entry is still composing server-side) */}
            {(isLoading || isStreaming) &&
              (messages.length === 0 ||
               messages[messages.length - 1].role === "user" ||
               messages[messages.length - 1].isCheckpoint === true ||
               composingCheckpoint) && (
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
        // The meter never locks the composer — the ready strip waits at the
        // top while the user keeps talking. The only disable cases are the
        // generic in-flight ones (load/stream) and the read-only text channel.
        disabled={
          isLoading ||
          isStreaming ||
          conversationId === "text-channel"
        }
        // While a turn streams, typing stays open but SEND is held — Enter
        // keeps the draft in the box instead of clearing it into a send that
        // useChat silently drops (the vanished-draft bug).
        sendLocked={isLoading || isStreaming}
        draftToRestore={draftToRestore}
        onDraftRestored={onDraftRestored}
        placeholder={optionsShowing ? "Or type something else…" : undefined}
        focusOnEnable={isDesktop === true}
      />

      {/* First-time meter explainer. reflectionReady can only be true when the
          meter is on (server-gated), so this never fires in the pushed model. */}
      <ReflectionIntroModal
        open={reflectionReady && !isAnonymous && !reflectionIntroSeen}
        onDismiss={dismissReflectionIntro}
      />

      {(checkpointOverlayOpen || overlayCheckpointRef.current) && (
        <CheckpointOverlay
          open={checkpointOverlayOpen}
          checkpoint={overlayCheckpointRef.current}
          loading={reflectionComposing}
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
            // Reflection model: if the close was a discard/rework/tap-away
            // (not a confirmed save), reflectionReady is still true, so the
            // persistent top strip stays visible — nothing to restore here.
            // A confirmed save clears reflectionReady and the strip hides.
          }}
        />
      )}
    </main>
  );
}
