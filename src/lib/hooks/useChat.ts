"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseSSEStream, type MessageCompleteEvent } from "@/lib/utils/sse-parser";
import { firstNameFrom } from "@/lib/utils/name";
import { LAYERS } from "@/lib/manual/layers";
import type { CheckpointAction } from "@/lib/persona/config";
import type { ChatMessage, ManualEntry, ActiveCheckpoint, ExplorationContext } from "@/lib/types";
import {
  trackConversationStarted,
  trackMessageSent,
  trackConversationEnded,
  trackCheckpointProposed,
  trackCheckpointConfirmed,
  trackCheckpointRejected,
  trackCheckpointDeferred,
  trackCheckpointRefined,
  type ConversationMode,
} from "@/lib/analytics/events";

export interface ConversationSummaryItem {
  id: string;
  status: string;
  summary: string | null;
  title: string | null;
  preview: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  is_text_channel?: boolean;
}

/**
 * Maps a failed /api/checkpoint/confirm response (or network failure) to
 * a user-facing message. See docs/reference/checkpoint-hardening-plan.md Track 3
 * for the taxonomy. Exported for testing.
 *
 * `status` is null when the fetch itself rejected (network error, abort,
 * DNS, etc.). `networkFailed` is true in the same case.
 */
export function confirmErrorMessage(
  status: number | null,
  networkFailed: boolean
): string {
  if (networkFailed || status === null) {
    return "Couldn't reach the server. Please try again.";
  }
  if (status === 429) {
    return "You've confirmed a lot recently. Give it a minute.";
  }
  if (status === 404) {
    return "That checkpoint is gone. Refresh and try again.";
  }
  if (status === 400) {
    return "This checkpoint was already rejected or refined — can't confirm it.";
  }
  if (status >= 500) {
    return "Server hiccup. Please try again.";
  }
  if (status >= 400) {
    return "Something's off on my end. Refresh and try again.";
  }
  return "Something went wrong saving that. Please try again.";
}

/**
 * Synchronous in-flight guard for the conversation-start paths.
 *
 * The start functions also check `isLoading || isStreaming`, but that reads
 * React STATE — and state updates aren't visible within the same render tick.
 * Two calls fired in the same tick (a sub-frame double-tap on a start control)
 * both read a stale `false` and both proceed, creating two conversations / two
 * POST /api/chat. A ref flips synchronously, so the second same-tick caller
 * sees the lock and bails. This generalizes the door-path `preStartRef` guard
 * in MainApp.tsx (commit f96ecf0) to the start paths that aren't behind the
 * intro modal.
 *
 * Exported so the same-tick race can be unit-tested directly — this repo's
 * vitest runs in node env without jsdom, so rendering the hook isn't an option.
 */
export interface StartGuard {
  /** Locks and returns true if free; returns false if a start is in flight. */
  tryAcquire(): boolean;
  /** Releases the lock so a later, legitimate start can proceed. */
  release(): void;
}

export function createStartGuard(): StartGuard {
  let inFlight = false;
  return {
    tryAcquire() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release() {
      inFlight = false;
    },
  };
}

/**
 * Convert a streaming `message_complete` SSE event into the optimistic
 * in-memory ChatMessage we append to `messages`.
 *
 * The critical bit: when the event carries a checkpoint payload, the
 * returned message MUST have `isCheckpoint: true` plus `checkpointMeta`
 * populated. MobileSession's render logic gates the trigger card on
 * `msg.isCheckpoint === true`. Without these fields, a pending
 * checkpoint message falls through to plain-bubble rendering — the
 * model's structured proposal text (Layer name, headline, validation
 * CTA) renders inline as raw chat content and the user has no card
 * to tap into the action overlay. Exported for testing.
 */
export function buildChatMessageFromEvent(
  event: MessageCompleteEvent,
  displayContent: string
): ChatMessage {
  const checkpoint = event.checkpoint;
  if (checkpoint) {
    return {
      role: "assistant",
      content: displayContent,
      id: event.messageId,
      isCheckpoint: true,
      checkpointMeta: {
        section: checkpoint.section ?? null,
        tags: checkpoint.tags ?? [],
        name: checkpoint.name,
        status: "pending",
        refinement_count: checkpoint.refinement_count ?? 0,
      },
    };
  }
  return {
    role: "assistant",
    content: displayContent,
    id: event.messageId,
  };
}

/**
 * Derive an active checkpoint from a freshly-loaded message list. Returns the
 * checkpoint to re-activate when the last message is a still-pending proposal,
 * else null — so a user who closed the app mid-proposal can still act on it.
 * Shared by every conversation-load path (resume + reload + drawer switch).
 * Exported for testing.
 */
export function pendingCheckpointFromMessages(
  dbMessages: Array<{
    id: string;
    content: string;
    is_checkpoint?: boolean | null;
    checkpoint_meta?: {
      section?: string | null;
      tags?: string[];
      name?: string | null;
      composed_name?: string | null;
      composed_content?: string | null;
      status?: string | null;
    } | null;
    // Tolerate extra columns (e.g. `channel`) on drawer-switch rows; the
    // helper reads only the fields above and ignores the rest.
    [key: string]: unknown;
  }>
): ActiveCheckpoint | null {
  const lastMsg = dbMessages[dbMessages.length - 1];
  if (lastMsg?.is_checkpoint && lastMsg.checkpoint_meta?.status === "pending") {
    return {
      messageId: lastMsg.id,
      section: lastMsg.checkpoint_meta.section ?? null,
      tags: lastMsg.checkpoint_meta.tags ?? [],
      name:
        lastMsg.checkpoint_meta.composed_name ||
        lastMsg.checkpoint_meta.name ||
        null,
      content: lastMsg.content,
      composedContent: lastMsg.checkpoint_meta.composed_content ?? null,
    };
  }
  return null;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // Split delivery: true between the checkpoint lead-in event and the
  // acknowledgment/card events that follow on the same stream. Keeps the
  // typing indicator visible while the entry composes server-side —
  // without it, the lead-in bubble landing would hide the indicator and
  // the user would stare at a silent chat for the compose duration.
  const [composingCheckpoint, setComposingCheckpoint] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] =
    useState<ActiveCheckpoint | null>(null);
  const [confirmedEntries, setConfirmedEntries] = useState<
    ManualEntry[]
  >([]);
  // First name only — see firstNameFrom() docstring. The DB may carry a
  // full "First Last" but every UI surface that addresses the user
  // (PDF export header/title, future greetings) reads from here.
  const [firstName, setFirstName] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // When the server rejects a message with a 400 (e.g. an upload over
  // MAX_UPLOAD_LENGTH), we surface the server's error string AND echo the
  // rejected text back so ChatInput can rehydrate the textarea. Without
  // this the user types/pastes a long message, sees "Something went
  // wrong," and the content evaporates. Consumers should consume this
  // via the exposed `draftToRestore` + `clearDraftToRestore` pair.
  const [draftToRestore, setDraftToRestore] = useState<string | null>(null);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [processingText, setProcessingText] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummaryItem[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [promptAuth, setPromptAuth] = useState(false);
  const [sessionOrigin, setSessionOrigin] = useState<"new" | "explore" | "existing">("new");
  const [firstSessionCompleted, setFirstSessionCompleted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mw_first_session_completed") === "true";
  });
  // Modal 2 (Pattern-Forming) trigger inputs, refreshed on every
  // message_complete event. The values reflect the previous-turn
  // extraction state (one-turn lag, server-side). MobileSession reads
  // these to decide whether to fire Modal 2.
  const [emergingPatternSnippet, setEmergingPatternSnippet] = useState<
    string | null
  >(null);
  const [hasLayerEmergingOrBeyond, setHasLayerEmergingOrBeyond] =
    useState(false);
  const [concreteExamples, setConcreteExamples] = useState(0);
  // Reflection meter (user-pulled model, `reflection_meter` gate). depth
  // drives the meter fill; reflectionReady is a LATCH — once the server
  // reports the conversation is ripe it stays true (the option persists, even
  // if the user keeps talking) until a confirmed save clears it. Both are
  // refreshed on every message_complete; null/false when the gate is off.
  // Reflection meter. fill (0–100) is the server-computed capture-progress
  // value (resets after a save, rebuilds, capped by depth); null = no signal /
  // gate off / crisis. reflectionReady is a LATCH — once ready it persists
  // until a confirmed save clears it.
  const [reflectionFill, setReflectionFill] = useState<number | null>(null);
  const [reflectionReady, setReflectionReady] = useState(false);

  // Monotonic fill: within a thread the bar only ever climbs, so a later turn
  // that scores shallower (depth is re-read every turn) never drags it
  // backward. The bar only goes DOWN on an explicit reset — a confirmed save
  // (→ 0) or crisis/new-conversation (→ null) — which call setReflectionFill
  // directly. A null prev means the meter was reset/hidden, so the incoming
  // value starts the new climb. This mirrors the readiness LATCH so the bar
  // and the bloom can't disagree.
  const bumpReflectionFill = useCallback((next: number) => {
    setReflectionFill((prev) => (prev === null ? next : Math.max(prev, next)));
  }, []);

  const initStarted = useRef(false);
  const lastUserMessage = useRef<string | null>(null);
  // Conversations we've already fired the early title pass for — one
  // Haiku call per conversation, never re-fired on later turns.
  const earlyTitleRequested = useRef<Set<string>>(new Set());
  // Set when a checkpoint becomes active in finalizeMessage; read when the
  // user acts so checkpoint_{confirmed,rejected,refined} can report the
  // wall-clock time the user took to decide.
  const checkpointProposedAt = useRef<number | null>(null);
  // Set when a conversation is created so conversation_ended can report
  // a duration without querying the DB.
  const conversationStartedAt = useRef<number | null>(null);
  // Mirrors the active conversation's mode so checkpoint and
  // conversation_ended events can attach it without a DB read. Updated
  // on every message_complete (server is authoritative). Defaults to
  // "situation" for any conversation that hasn't reported a mode yet.
  const conversationMode = useRef<ConversationMode>("situation");
  // Synchronous re-entry guard shared by the three start paths. Closes the
  // same-tick double-start window the isLoading/isStreaming state checks can't
  // (state isn't visible in-tick). Lazily initialized so the same guard
  // instance survives every re-render. See createStartGuard.
  const startGuardRef = useRef<StartGuard | null>(null);
  startGuardRef.current ??= createStartGuard();
  const startGuard = startGuardRef.current;
  const router = useRouter();
  const supabase = createClient();

  // Live (client-driven) simulator state. A fake user drives the REAL app —
  // startConversation + sendMessage/sendChipResponse, the same paths a person
  // hits — so the section picker, focus chips, and taps all render live. The
  // turn loop runs as an effect-driven state machine (below) reading fresh
  // render state, not refs, so there are no stale-closure races between turns.
  // See runLiveSimulation. Admin dev tooling only.
  const [simActive, setSimActive] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const simDescRef = useRef<string | null>(null);
  const simTurnRef = useRef(0);
  const SIM_MAX_TURNS = 40;

  const loadManual = useCallback(async () => {
    try {
      const res = await fetch("/api/manual");
      if (res.ok) {
        const data = await res.json();
        setConfirmedEntries(data.components || []);
        if (data.displayName) {
          setDisplayName(data.displayName);
          setFirstName(firstNameFrom(data.displayName));
        }
      }
    } catch (err) {
      console.error("[useChat] Failed to load manual:", err);
    }
  }, []);

  /**
   * Edit an existing Manual entry. Sends PATCH to /api/manual/[id] and
   * patches the local `confirmedEntries` cache with the returned row so
   * the UI reflects the new state without a full refetch. Returns the
   * updated entry on success or an error string on failure.
   */
  const updateEntry = useCallback(
    async (
      entryId: string,
      edits: { name?: string | null; content?: string }
    ): Promise<{ ok: true; entry: ManualEntry } | { ok: false; error: string }> => {
      try {
        const res = await fetch(`/api/manual/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(edits),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          return {
            ok: false,
            error: payload?.error || "Could not save changes.",
          };
        }
        const { entry } = (await res.json()) as { entry: ManualEntry };
        setConfirmedEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, ...entry } : e))
        );
        return { ok: true, entry };
      } catch (err) {
        console.error("[useChat] updateEntry failed:", err);
        return { ok: false, error: "Network error. Try again." };
      }
    },
    []
  );

  async function streamFromResponse(response: Response): Promise<{
    fullText: string;
    completeEvent: MessageCompleteEvent | null;
  }> {
    // Phase 7-High: the stream may carry MULTIPLE message_complete
    // events (7e first-lifetime two-message, 7f transition+card). On
    // each message_complete, we append the message immediately, reset
    // the text buffer for the next message in the same stream, and
    // fire finalize logic for that event. cleanContent is expected on
    // every message_complete (server sets it) because fullText is
    // empty for events that didn't have preceding text_delta (e.g.
    // server-templated prepends).
    let fullText = "";
    let lastCompleteEvent: MessageCompleteEvent | null = null;
    let lastMessageFullText = "";
    let sseError: string | null = null;

    setIsStreaming(true);

    try {
      await parseSSEStream(response, {
        onTextDelta: (text) => {
          fullText += text;
        },
        onMessageComplete: (data) => {
          // Split delivery: the lead-in event carries composing: true —
          // the entry is still composing server-side, keep the typing
          // indicator up. Any subsequent event (acknowledgment, card)
          // clears it; the finally block below is the safety net for
          // streams that die mid-compose.
          setComposingCheckpoint(data.composing === true);

          // Snapshot the text accumulated since the previous
          // message_complete (or since stream start). This is THIS
          // message's streamed content, if any.
          const thisMessageStreamedText = fullText;
          fullText = "";

          const displayContent = data.cleanContent || thisMessageStreamedText;
          // Guard against empty messages — a server bug or protocol
          // drift could emit a cleanContent-less event with no
          // preceding text_delta. Skip appending in that case.
          if (displayContent) {
            setMessages((prev) => [...prev, buildChatMessageFromEvent(data, displayContent)]);
            // Run the per-event finalize (modal-2 trigger refresh,
            // checkpoint metadata if this event carried one, etc.).
            finalizeMessage(displayContent, data);
          }

          lastCompleteEvent = data;
          lastMessageFullText = displayContent;
        },
        onError: (error) => {
          sseError = error;
        },
      });
    } finally {
      setIsStreaming(false);
      setComposingCheckpoint(false);
    }

    if (sseError) {
      setErrorMessage(sseError);
    }

    // Return value surfaces info about the LAST event for any caller
    // that wants to make decisions downstream (e.g. seed-message
    // handoff). Per-event finalize already ran inside the loop.
    return { fullText: lastMessageFullText, completeEvent: lastCompleteEvent };
  }

  function finalizeMessage(
    fullText: string,
    completeEvent: MessageCompleteEvent | null
  ) {
    if (!completeEvent) return;

    // Refresh Modal 2 trigger inputs from the latest message_complete.
    // These are optional fields; nullish-coalesce to safe defaults so an
    // older server (or a missing field) leaves the modal in its
    // pre-trigger state rather than firing on garbage.
    setEmergingPatternSnippet(completeEvent.emergingPatternSnippet ?? null);
    setHasLayerEmergingOrBeyond(
      completeEvent.hasLayerEmergingOrBeyond ?? false
    );
    setConcreteExamples(completeEvent.concreteExamples ?? 0);

    // Reflection meter signals. The server sends one nullable field:
    //   undefined → gate off; leave state untouched.
    //   null      → crisis: hide the meter AND clear the readiness latch.
    //   { depth, ready } → depth tracks the latest reading; ready latches UP
    //     only (never down from the server), so the pulled-reflection option
    //     persists once earned — a confirmed save is the only thing that
    //     clears it (see confirmCheckpoint).
    if (completeEvent.reflectionMeter === null) {
      setReflectionFill(null);
      setReflectionReady(false);
    } else if (completeEvent.reflectionMeter) {
      bumpReflectionFill(completeEvent.reflectionMeter.fill);
      if (completeEvent.reflectionMeter.ready) setReflectionReady(true);
    }

    // Track the conversation's mode locally so checkpoint and
    // conversation_ended events can attach it. Server is authoritative;
    // client mirrors what the SSE event reports.
    const eventMode: ConversationMode = completeEvent.mode ?? "situation";
    conversationMode.current = eventMode;

    // Use clean content (without manual entry block) when available
    const displayContent = completeEvent.cleanContent || fullText;

    if (completeEvent.checkpoint) {
      // Set active checkpoint with clean text
      setActiveCheckpoint({
        messageId: completeEvent.messageId,
        section: completeEvent.checkpoint.section ?? null,
        tags: completeEvent.checkpoint.tags ?? [],
        name: completeEvent.checkpoint.name,
        content: displayContent,
        composedContent: completeEvent.checkpoint.composed_content ?? null,
      });

      // Capture the moment the proposal became visible so checkpoint
      // decision events can report time_to_decision_ms.
      checkpointProposedAt.current = Date.now();

      const convIdForCp = completeEvent.conversationId || conversationId;
      if (convIdForCp && completeEvent.messageId) {
        const userTurnCount = messages.filter((m) => m.role === "user").length;
        trackCheckpointProposed({
          conversation_id: convIdForCp,
          checkpoint_id: completeEvent.messageId,
          section: completeEvent.checkpoint.section ?? null,
          message_number: messages.length + 1,
          user_turn_count: userTurnCount,
          mode: eventMode,
        });
      }

      // Update last assistant message with checkpoint metadata
      setMessages((prev) => {
        const updated = [...prev];
        const idx = updated.length - 1;
        if (idx >= 0 && updated[idx]?.role === "assistant") {
          updated[idx] = {
            ...updated[idx],
            isCheckpoint: true,
            checkpointMeta: {
              section: completeEvent!.checkpoint!.section ?? null,
              tags: completeEvent!.checkpoint!.tags ?? [],
              name: completeEvent!.checkpoint!.name,
              status: "pending",
              refinement_count:
                completeEvent!.checkpoint!.refinement_count ?? 0,
            },
          };
        }
        return updated;
      });
    }

    // Attach chips to the message if the server included them.
    if (completeEvent.chips && completeEvent.chips.length > 0) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === completeEvent!.messageId
            ? { ...m, chips: completeEvent!.chips }
            : m
        )
      );
    }

    // Attach guided-intake UI flags (section picker / situation-handoff action).
    if (completeEvent.sections || completeEvent.startSituationOffer) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === completeEvent!.messageId
            ? {
                ...m,
                showSections: completeEvent!.sections,
                offerStartSituation: completeEvent!.startSituationOffer,
              }
            : m
        )
      );
    }

    if (completeEvent.processingText) {
      setProcessingText(completeEvent.processingText);
    }

    if (completeEvent.promptAuth) {
      setPromptAuth(true);
    }

    if (completeEvent.conversationId && !conversationId) {
      setConversationId(completeEvent.conversationId);
      conversationStartedAt.current = Date.now();
      trackConversationStarted({
        conversation_id: completeEvent.conversationId,
        entry_point: "situation",
        channel: "web",
      });
    }
  }

  const initializeConversation = useCallback(async () => {
    if (initStarted.current) return;
    initStarted.current = true;

    async function triggerPersonaOpener(existingConversationId: string | null) {
      setIsLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: null,
            conversationId: existingConversationId,
          }),
        });

        if (res.ok) {
          const { completeEvent } = await streamFromResponse(res);

          if (completeEvent) {
            setConversationId(completeEvent.conversationId);
            if (completeEvent.conversationId) {
              trackMessageSent({
                conversation_id: completeEvent.conversationId,
                role: "assistant",
                message_number: 1,
                channel: "web",
              });
            }
          }
        }
      } catch {
        // Initialization failed
      } finally {
        setIsLoading(false);
      }
    }

    // Middleware is the primary auth gate, but production has shown
    // that Vercel can serve `/` without running middleware in some
    // cases (statically prerendered + edge cache). If we ever land
    // here without an auth user, bounce to /login ourselves instead
    // of silently leaving `initialized=false`, which wedges MainApp
    // on the linen splash forever (see 2026-04-08 blank-page bug).
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
      return;
    }

    setUserEmail(authUser.email || "");
    setIsGuest(authUser.is_anonymous === true);

    // Load all conversations via API
    let allConversations: ConversationSummaryItem[] = [];
    try {
      const convRes = await fetch("/api/conversations");
      if (convRes.ok) {
        const convData = await convRes.json();
        allConversations = convData.conversations || [];
        setConversations(allConversations);
      }
    } catch (err) {
      console.error("[useChat] Failed to load conversations:", err);
    }

    // If the user clicked "New session" before this refresh, honour
    // that intent instead of restoring the most-recent conversation.
    let pendingNewSession = false;
    try {
      if (sessionStorage.getItem("mw_new_session")) {
        pendingNewSession = true;
        sessionStorage.removeItem("mw_new_session");
      }
    } catch {}

    // Don't treat the synthetic "text-channel" pseudo-conversation as a
    // restorable session — its id isn't a uuid, so loading messages by it
    // fails and lands the user on a broken/empty screen. switchConversation
    // already excludes it; the resume path must too.
    const restorable = allConversations.filter((c) => !c.is_text_channel);

    if (restorable.length > 0 && !pendingNewSession) {
      setSessionOrigin("existing");
      // Refresh-stays-put: prefer the conversation the user was actually in
      // (persisted on every switch) over the most-recent-by-timestamp one, so
      // a refresh reloads the SAME conversation even if they were viewing an
      // older one. Falls back to most-recent when nothing is persisted.
      let savedConvId: string | null = null;
      try {
        savedConvId = sessionStorage.getItem("mw_active_conversation");
      } catch {}
      const latest =
        (savedConvId && restorable.find((c) => c.id === savedConvId)) ||
        restorable[0];
      setConversationId(latest.id);
      setSessionSummary(latest.summary || null);
      setLastSessionDate(latest.updated_at || null);
      const convId = latest.id;

      // Load messages
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("id, role, content, is_checkpoint, checkpoint_meta, channel, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (dbMessages) {
        const chatMessages: ChatMessage[] = dbMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            channel: m.channel || null,
            isCheckpoint: m.is_checkpoint || false,
            checkpointMeta: m.checkpoint_meta || null,
          }));
        setMessages(chatMessages);

        // Re-activate a pending checkpoint so a user who closed the app
        // mid-proposal can still act on it (confirm/reject/refine).
        // loadConversation already does this; the resume path didn't.
        const pendingCheckpoint = pendingCheckpointFromMessages(dbMessages);
        if (pendingCheckpoint) setActiveCheckpoint(pendingCheckpoint);
      }

      // Restore the reflection meter from this conversation's saved state.
      restoreReflectionMeter(convId);

      // Load manual components (determines returning user status)
      await loadManual();

      // If conversation exists but has no messages, trigger Jove's opener
      const nonSystemMessages = dbMessages?.filter((m) => m.role !== "system") || [];
      if (nonSystemMessages.length === 0) {
        // Show the chat UI immediately, let opener stream in live
        setInitialized(true);
        await triggerPersonaOpener(convId);
      } else {
        // Check if last message is older than 30 minutes — refresh summary if so
        const lastMsg = dbMessages![dbMessages!.length - 1];
        const lastMsgTime = new Date(lastMsg.created_at).getTime();
        const thirtyMinutes = 30 * 60 * 1000;

        if (Date.now() - lastMsgTime > thirtyMinutes) {
          // Fire and forget — don't block initialization
          fetch("/api/session/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: convId }),
          }).catch((err) => console.error("[useChat] Summary generation failed:", err));
        }
        setInitialized(true);
      }
    } else if (pendingNewSession || allConversations.length > 0) {
      // Either the user clicked "New session" before this refresh, OR their
      // only history is the text channel (no restorable in-app conversation).
      // Load manual so the greeting knows they're returning, but don't
      // restore any conversation.
      setSessionOrigin("new");
      await loadManual();
      setInitialized(true);
    } else {
      // Brand new user — let MainApp decide whether to show onboarding
      setIsNewUser(true);
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initializeConversation();
  }, [initializeConversation]);

  // Persist the active conversation so a refresh reloads the SAME one
  // (initializeConversation prefers it over most-recent). Skip the synthetic
  // text-channel pseudo-id, which isn't a restorable uuid.
  useEffect(() => {
    try {
      if (conversationId && conversationId !== "text-channel") {
        sessionStorage.setItem("mw_active_conversation", conversationId);
      }
    } catch {}
  }, [conversationId]);

  async function sendMessage(text: string, options?: { isChipResponse?: boolean }) {
    if (!text.trim() || isLoading || isStreaming) return;

    // Clear chips + guided-intake UI flags from all messages whenever a new
    // user message is sent — the picker/action belong to a single turn.
    setMessages((prev) =>
      prev.some((m) => m.chips || m.showSections || m.offerStartSituation)
        ? prev.map((m) =>
            m.chips || m.showSections || m.offerStartSituation
              ? {
                  ...m,
                  chips: undefined,
                  showSections: undefined,
                  offerStartSituation: undefined,
                }
              : m
          )
        : prev
    );

    // Mark first session as started (persists across sessions)
    if (!firstSessionCompleted) {
      setFirstSessionCompleted(true);
      localStorage.setItem("mw_first_session_completed", "true");
    }

    // Clear previous error and track for retry
    setErrorMessage(null);
    lastUserMessage.current = text;

    // Snapshot the message position at send time so analytics ordering
    // is deterministic; relying on messages.length after optimistic
    // append races the next render.
    const userMessageNumber = messages.length + 1;
    const userMessageCountAtSend =
      messages.filter((m) => m.role === "user").length + 1;

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          ...(options?.isChipResponse ? { isChipResponse: true } : {}),
        }),
      });

      // Fix A: capture conversationId from response header before any
      // failure-mode branching. The server sets X-Conversation-Id when
      // it creates or uses a conversation, BEFORE the Anthropic call.
      // This ensures the client knows the conversation_id even if the
      // upstream API errors after the conversation row was already
      // created — without this, retries on a first-time failure would
      // post conversationId: null and create new ghost conversations.
      // See the 2026-05-25 retry-storm incident for context.
      const headerConvId = res.headers.get("X-Conversation-Id");
      if (headerConvId && headerConvId !== conversationId) {
        setConversationId(headerConvId);
      }

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      // Anonymous checkpoint conversion gate: server returns 200 JSON
      // ({ blocked: true, reason: "signup_required" }) instead of an SSE
      // stream. Show the conversion prompt and drop the optimistic user
      // message — do NOT render an error or a Jove reply.
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const body = await res.json().catch(() => null);
        if (body?.blocked && body?.reason === "signup_required") {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.role === "user") updated.pop();
            return updated;
          });
          setPromptAuth(true);
          return;
        }
      }

      if (!res.ok) {
        // Daily message cap (Postgres-backed, ADR-038 follow-up).
        // 429 with JSON body { error: "daily_limit_reached", message }
        // → drop the optimistic user bubble (server didn't process it)
        // and show the limit message. Falls through to the generic
        // failure message on any other 429 or non-ok status.
        if (res.status === 429 && contentType.includes("application/json")) {
          const body = await res.json().catch(() => null);
          if (body?.error === "daily_limit_reached") {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[updated.length - 1]?.role === "user") updated.pop();
              return updated;
            });
            setErrorMessage(
              typeof body.message === "string"
                ? body.message
                : "You've reached today's message limit. It resets at midnight UTC.",
            );
            return;
          }
        }
        // 400 with a server-provided `error` string (e.g. message-length
        // caps from /api/chat) — surface the actual message and restore
        // the paste to the input so the user can edit it down. Without
        // this, a 16k+ upload paste returned "Something went wrong" with
        // no way to recover the typed content.
        if (res.status === 400 && contentType.includes("application/json")) {
          const body = await res.json().catch(() => null);
          if (body?.error && typeof body.error === "string") {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[updated.length - 1]?.role === "user") updated.pop();
              return updated;
            });
            setErrorMessage(body.error);
            setDraftToRestore(text);
            return;
          }
        }
        setErrorMessage("Something went wrong. Try again.");
        return;
      }

      // Phase 7-High: streamFromResponse now runs finalizeMessage
      // per-event internally (to support multi-message_complete
      // streams). No external finalize call needed here; the return
      // value surfaces the LAST event for callers that need it.
      const { completeEvent } = await streamFromResponse(res);

      // Track user + assistant message_sent after the server confirmed
      // both persisted. finalizeMessage already fired conversation_started
      // if this was the first message of a new conversation.
      const finalConvId = completeEvent?.conversationId ?? conversationId;
      if (finalConvId) {
        trackMessageSent({
          conversation_id: finalConvId,
          role: "user",
          message_number: userMessageNumber,
          channel: "web",
        });
        trackMessageSent({
          conversation_id: finalConvId,
          role: "assistant",
          message_number: userMessageNumber + 1,
          channel: "web",
        });
      }

      // If a new conversation was created, refresh the list
      if (completeEvent?.conversationId && !conversationId) {
        refreshConversations();
      }

      // Early title: once the user has sent their 3rd message, fire the
      // session summary once so the sidebar/header name the session by
      // what the user brought — instead of waiting for the stale-session
      // pass (>30 min away). That later pass still regenerates the title
      // as the conversation evolves, so an early read self-corrects.
      const convIdForTitle = completeEvent?.conversationId ?? conversationId;
      if (
        userMessageCountAtSend === 3 &&
        convIdForTitle &&
        !earlyTitleRequested.current.has(convIdForTitle) &&
        !conversations.find((c) => c.id === convIdForTitle)?.title
      ) {
        earlyTitleRequested.current.add(convIdForTitle);
        fetch("/api/session/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convIdForTitle }),
        })
          .then(() => refreshConversations())
          .catch((err) =>
            console.error("[useChat] Early title generation failed:", err)
          );
      }
    } catch {
      setErrorMessage("Connection lost. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function retryLastMessage() {
    if (!lastUserMessage.current) return;
    // Remove the last user message (on error, no assistant message was added)
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === "user") {
        updated.pop();
      }
      return updated;
    });
    setErrorMessage(null);
    sendMessage(lastUserMessage.current);
  }

  async function confirmCheckpoint(
    action: CheckpointAction,
    edits?: { editedContent?: string | null; editedName?: string | null }
  ) {
    if (!activeCheckpoint) return;

    setIsLoading(true);
    setCheckpointError(null);

    // For non-confirmed actions (rejected/refined/deferred), close the
    // visible "pending" state immediately. Without this, the trigger
    // card stays in its compact "Tap to review" form while the network
    // call runs, then snaps to the historical Plate when activeCheckpoint
    // clears — a flickery interstitial. We optimistically: (1) clear
    // activeCheckpoint so the message stops rendering as pending, and
    // (2) write the terminal status onto checkpointMeta so the Plate
    // renders with the right status badge ("Discarded", etc.) on first
    // paint. Server route returns the same end state on success; on
    // failure the error banner surfaces and the user can retry. Mirror
    // of the server's status mapping in /api/checkpoint/confirm route.
    if (action !== "confirmed") {
      const optimisticStatus =
        action === "refined" ? "refined" : "rejected";
      const checkpointMessageId = activeCheckpoint.messageId;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === checkpointMessageId && m.checkpointMeta
            ? {
                ...m,
                checkpointMeta: {
                  ...m.checkpointMeta,
                  status: optimisticStatus,
                },
              }
            : m
        )
      );
      setActiveCheckpoint(null);
    }

    const body = JSON.stringify({
      messageId: activeCheckpoint.messageId,
      action,
      conversationId,
      ...(action === "confirmed" && edits?.editedContent
        ? { editedContent: edits.editedContent }
        : {}),
      ...(action === "confirmed" && edits?.editedName
        ? { editedName: edits.editedName }
        : {}),
    });

    // Retry transient failures (network error or 5xx) with short backoff.
    // 4xx bubbles up immediately — it's a "you did something wrong" or
    // "the checkpoint isn't in the expected state" and retrying won't help.
    // Server-side writes are atomic + idempotent (Track 2) so retries
    // never produce duplicates.
    const RETRY_BACKOFFS_MS = [500, 2000]; // between attempt 1→2 and 2→3
    const MAX_ATTEMPTS = 3;
    const FETCH_TIMEOUT_MS = 30_000;

    let res: Response | null = null;
    let networkFailed = false;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        networkFailed = false;
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
          const r = await fetch("/api/checkpoint/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: ctrl.signal,
          });
          clearTimeout(timer);

          // Auth expired — redirect immediately, no retry.
          if (r.status === 401) {
            router.push("/login");
            return;
          }

          // 2xx → success path. 4xx → don't retry, surface specific message.
          // 5xx → retry (if attempts remain).
          if (r.ok || (r.status >= 400 && r.status < 500)) {
            res = r;
            break;
          }
          res = r;
        } catch {
          // fetch rejection (network error, abort, DNS, etc.)
          networkFailed = true;
          res = null;
        }

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_BACKOFFS_MS[attempt - 1])
          );
        }
      }

      // All attempts exhausted or final response is an error.
      if (!res || !res.ok) {
        setCheckpointError(
          confirmErrorMessage(res?.status ?? null, networkFailed)
        );
        return;
      }

      if (action === "confirmed") {
        const finalContent =
          edits?.editedContent?.trim() ||
          activeCheckpoint.composedContent ||
          activeCheckpoint.content;
        const finalName =
          edits?.editedName?.trim() || activeCheckpoint.name || null;

        // Add to confirmed entries locally (optimistic update). Prefer edited
        // text so the Manual reflects the user's words immediately;
        // loadManual reconciles with the server-stored version on the next
        // tick.
        setConfirmedEntries((prev) => [
          ...prev,
          {
            id: activeCheckpoint.messageId,
            section: activeCheckpoint.section,
            tags: activeCheckpoint.tags,
            name: finalName,
            content: finalContent,
            created_at: new Date().toISOString(),
          },
        ]);

        // Reflect the final content + name on the checkpoint message so the
        // historical Plate in the chat history shows what actually landed in
        // the Manual rather than the unedited proposal.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === activeCheckpoint.messageId
              ? {
                  ...m,
                  content: finalContent,
                  checkpointMeta: m.checkpointMeta
                    ? {
                        ...m.checkpointMeta,
                        name: finalName,
                        status: "confirmed",
                      }
                    : m.checkpointMeta,
                }
              : m
          )
        );

        // Reflection meter "starts over" on a confirmed save: empty the fill
        // immediately (snappy) and clear the readiness latch. The server then
        // keeps it reset — turnsSinceCheckpoint is 0 after a save → fill 0 —
        // and ramps it back up over the cooldown as the next thread builds.
        setReflectionFill(0);
        setReflectionReady(false);
      }

      // Report time to decision for the checkpoint event.
      const proposedAt = checkpointProposedAt.current;
      const timeToDecisionMs = proposedAt ? Date.now() - proposedAt : 0;
      const cpProps = {
        conversation_id: conversationId || "",
        checkpoint_id: activeCheckpoint.messageId,
        section: activeCheckpoint.section ?? null,
        time_to_decision_ms: timeToDecisionMs,
        mode: conversationMode.current,
      };
      if (cpProps.conversation_id) {
        if (action === "confirmed") trackCheckpointConfirmed(cpProps);
        else if (action === "rejected") trackCheckpointRejected(cpProps);
        else if (action === "refined") trackCheckpointRefined(cpProps);
        else if (action === "deferred") trackCheckpointDeferred(cpProps);
      }
      checkpointProposedAt.current = null;

      // Clear active checkpoint — the card transitions to the confirmed
      // entry in the Manual tab.
      setActiveCheckpoint(null);

      // Idempotent repeat — server responded with JSON (not SSE), the
      // entry was already written on an earlier call, and Jove's
      // follow-up was already streamed then. Just re-sync manual state.
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        await loadManual();
        return;
      }

      // First-time confirm. Reconcile the Manual from the server BEFORE
      // streaming Jove's follow-up: the optimistic entry above carries the
      // checkpoint message id, not the real manual_entries.id, so editing it
      // during the multi-second follow-up stream would PATCH a non-existent
      // row (404). loadManual swaps in the server rows (with real ids) first,
      // and runs regardless of the stream outcome below.
      await loadManual();

      // Stream Jove's follow-up. If the stream fails mid-flight, the
      // server-side write already succeeded (atomic RPC, Track 2) and the
      // Manual is already reconciled above, so we just log.
      try {
        // Phase 7-High: per-event finalize happens inside streamFromResponse.
        // Return value is unused here — the follow-up stream's side effects
        // (appending messages, activating checkpoint state) are what matter.
        await streamFromResponse(res);
      } catch (err) {
        console.warn("[useChat] Confirm follow-up stream interrupted:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * User-pulled Reflection. Composes the entry on demand via
   * /api/checkpoint/compose, then sets it as the active checkpoint so the
   * existing review overlay opens on it — there is no in-chat trigger card in
   * this path (the overlay is the only pending surface). Confirm/discard go
   * through the existing confirmCheckpoint flow unchanged. Returns a status
   * the caller (MobileSession) uses to open the overlay / surface an error.
   */
  async function composeReflection(): Promise<
    | { status: "ok"; checkpoint: ActiveCheckpoint }
    | { status: "blocked" }
    | { status: "error" }
  > {
    if (!conversationId) return { status: "error" };
    setCheckpointError(null);
    try {
      const res = await fetch("/api/checkpoint/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return { status: "error" };
      }
      const body = await res.json().catch(() => null);
      // Anonymous conversion gate — same shape as /api/chat.
      if (body?.blocked && body?.reason === "signup_required") {
        setPromptAuth(true);
        return { status: "blocked" };
      }
      if (!res.ok || !body?.checkpoint || !body?.messageId) {
        setCheckpointError("Couldn't build that reflection. Try again.");
        return { status: "error" };
      }
      const checkpoint: ActiveCheckpoint = {
        messageId: body.messageId,
        section: body.checkpoint.section ?? null,
        tags: body.checkpoint.tags ?? [],
        name: body.checkpoint.name,
        content: body.checkpoint.composed_content,
        composedContent: body.checkpoint.composed_content,
      };
      // Also set it as the active checkpoint so the overlay's confirm-status
      // wiring and reload-resume see it; the caller uses the returned value to
      // open the overlay immediately without waiting for state to propagate.
      setActiveCheckpoint(checkpoint);
      checkpointProposedAt.current = Date.now();
      return { status: "ok", checkpoint };
    } catch {
      setCheckpointError("Couldn't reach the server. Try again.");
      return { status: "error" };
    }
  }

  /**
   * Rehydrate the reflection meter from a conversation's persisted state when
   * it opens. The meter is otherwise live-turn-only, so it starts blank on a
   * refresh, a drawer switch, or a simulator-generated conversation (those
   * land via DB reload, not a live stream). The server derives the same
   * { depth, ready } the live path emits. Best-effort and fire-and-forget —
   * the next live turn repopulates it regardless.
   */
  async function restoreReflectionMeter(targetConversationId: string) {
    try {
      const res = await fetch(
        `/api/checkpoint/meter?conversationId=${encodeURIComponent(targetConversationId)}`
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        reflectionMeter?: {
          fill: number;
          ready: boolean;
        } | null;
      };
      // undefined → gate off; leave state as-is (the caller already reset it).
      if (body.reflectionMeter === undefined) return;
      if (body.reflectionMeter === null) {
        setReflectionFill(null);
        setReflectionReady(false);
        return;
      }
      // Restore SETS ready to the server's current value (true or false) —
      // unlike the live path's latch-up-only — so a post-save "starts over"
      // state restores correctly on reload. The reset paths (new conversation /
      // reload) null the fill first, so bumpReflectionFill climbs from there.
      bumpReflectionFill(body.reflectionMeter.fill);
      setReflectionReady(body.reflectionMeter.ready === true);
    } catch {
      // Best-effort; the next live message_complete will populate it.
    }
  }

  async function refreshConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // Silent fail
    }
  }

  async function switchConversation(targetConversationId: string) {
    if (targetConversationId === conversationId) return;
    if (isLoading || isStreaming) return;

    // Reset current state
    setSessionOrigin("existing");
    setMessages([]);
    setActiveCheckpoint(null);
    setErrorMessage(null);
    setCheckpointError(null);
    setReflectionReady(false);
    setReflectionFill(null);

    if (targetConversationId === "text-channel") {
      // Load all text channel messages across all 1:1 conversations.
      // First get all conversation IDs for this user (excluding groups).
      const convRes = await fetch("/api/conversations");
      let convIds: string[] = [];
      if (convRes.ok) {
        const data = await convRes.json();
        convIds = (data.conversations || [])
          .filter((c: ConversationSummaryItem) => !c.is_text_channel)
          .map((c: ConversationSummaryItem) => c.id);
      }

      if (convIds.length > 0) {
        const { data: dbMessages } = await supabase
          .from("messages")
          .select("id, role, content, is_checkpoint, checkpoint_meta, channel, created_at")
          .in("conversation_id", convIds)
          .eq("channel", "text")
          .order("created_at", { ascending: true });

        if (dbMessages) {
          const chatMessages: ChatMessage[] = dbMessages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              channel: m.channel || null,
              isCheckpoint: m.is_checkpoint || false,
              checkpointMeta: m.checkpoint_meta || null,
            }));
          setMessages(chatMessages);
        }
      }

      setConversationId(targetConversationId);
      setSessionSummary(null);
      setLastSessionDate(null);
      return;
    }

    // Load messages for target conversation
    const { data: dbMessages } = await supabase
      .from("messages")
      .select("id, role, content, is_checkpoint, checkpoint_meta, channel, created_at")
      .eq("conversation_id", targetConversationId)
      .order("created_at", { ascending: true });

    if (dbMessages) {
      const chatMessages: ChatMessage[] = dbMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          channel: m.channel || null,
          isCheckpoint: m.is_checkpoint || false,
          checkpointMeta: m.checkpoint_meta || null,
        }));
      setMessages(chatMessages);

      // Detect + re-activate a pending checkpoint in the last message, same
      // as loadConversation — otherwise switching to this conversation from
      // the drawer renders the proposal as an inert historical card.
      const pendingCheckpoint = pendingCheckpointFromMessages(dbMessages);
      if (pendingCheckpoint) setActiveCheckpoint(pendingCheckpoint);
    }

    setConversationId(targetConversationId);

    // Restore the reflection meter from this conversation's saved state.
    restoreReflectionMeter(targetConversationId);

    // Update summary context from conversations list
    const targetConv = conversations.find((c) => c.id === targetConversationId);
    if (targetConv) {
      setSessionSummary(targetConv.summary);
      setLastSessionDate(targetConv.updated_at);
    }
  }

  /**
   * Load (or reload) a conversation's messages from DB.
   * No guards — always fetches. Detects pending checkpoints.
   */
  async function loadConversation(targetConversationId: string) {
    if (targetConversationId !== conversationId) {
      setConversationId(targetConversationId);
      setErrorMessage(null);
      setCheckpointError(null);
    }

    // Reset checkpoint + reflection meter before reloading
    setActiveCheckpoint(null);
    setReflectionReady(false);
    setReflectionFill(null);

    const { data: dbMessages } = await supabase
      .from("messages")
      .select("id, role, content, is_checkpoint, checkpoint_meta, channel, created_at")
      .eq("conversation_id", targetConversationId)
      .order("created_at", { ascending: true });

    if (dbMessages) {
      const chatMessages: ChatMessage[] = dbMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          isCheckpoint: m.is_checkpoint || false,
          checkpointMeta: m.checkpoint_meta || null,
        }));
      setMessages(chatMessages);

      // Detect + re-activate a pending checkpoint in the last message.
      const pendingCheckpoint = pendingCheckpointFromMessages(dbMessages);
      if (pendingCheckpoint) setActiveCheckpoint(pendingCheckpoint);
    }

    // Restore the reflection meter from saved state on (re)load — this is the
    // path the dev simulator triggers per turn, so the meter tracks it there.
    restoreReflectionMeter(targetConversationId);
  }

  // Clears the active conversation's client state so a fresh start — a new
  // session, a layer exploration, or a mode bootstrap — doesn't surface (or
  // get blocked by) the previously loaded thread. `origin` tags how the next
  // conversation began, for the scoped-label and analytics paths. Single
  // source of truth for the reset that startNewSession / startExploration /
  // startConversation all share.
  function resetConversationState(origin: "new" | "explore") {
    setSessionOrigin(origin);
    setConversationId(null);
    setMessages([]);
    setSessionSummary(null);
    setLastSessionDate(null);
    setActiveCheckpoint(null);
    setErrorMessage(null);
    setCheckpointError(null);
    setReflectionReady(false);
    setReflectionFill(null);
  }

  async function startNewSession() {
    if (isLoading || isStreaming) return;
    if (!startGuard.tryAcquire()) return;

    try {
      // Complete current conversation fire-and-forget (don't block UI)
      if (conversationId) {
        const durationSeconds = conversationStartedAt.current
          ? Math.round((Date.now() - conversationStartedAt.current) / 1000)
          : 0;
        trackConversationEnded({
          conversation_id: conversationId,
          end_type: "natural",
          message_count: messages.length,
          duration_seconds: durationSeconds,
          mode: conversationMode.current,
        });
        conversationStartedAt.current = null;
        conversationMode.current = "situation";

        fetch("/api/conversations/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        }).catch(() => {});
      }

      // Reset state for new session
      resetConversationState("new");

      // Persist intent so a page refresh stays on the new-session screen
      // instead of reloading the most recent conversation.
      try { sessionStorage.setItem("mw_new_session", "1"); } catch {}

      // Refresh conversation list in background
      refreshConversations();
    } finally {
      // Defer the release past the synchronous flush. Unlike the other two
      // start paths, this body has no network await — a synchronous release
      // would clear the lock before a same-tick second call runs, defeating
      // the guard. A microtask hold covers the same-tick window; a double-fire
      // here is benign anyway (no conversation created — just a redundant
      // reset and a fire-and-forget complete).
      void Promise.resolve().then(() => startGuard.release());
    }
  }

  async function startExploration(context: ExplorationContext): Promise<boolean> {
    if (isLoading || isStreaming) return false;
    if (!startGuard.tryAcquire()) return false;

    // Complete current conversation fire-and-forget (don't block on it)
    if (conversationId) {
      fetch("/api/conversations/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {});
    }

    // Reset state for the fresh exploration
    resetConversationState("explore");

    // Send chat request with exploration context (message=null triggers Jove opener)
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: null,
          conversationId: null,
          explorationContext: context,
        }),
      });

      if (res.status === 401) {
        setIsLoading(false);
        router.push("/login");
        return false;
      }

      if (!res.ok) {
        setErrorMessage("Something went wrong. Try again.");
        setIsLoading(false);
        return false;
      }

      // Stream in the background — don't block the caller
      streamFromResponse(res).then(({ completeEvent }) => {
        if (completeEvent) {
          setConversationId(completeEvent.conversationId);
          if (completeEvent.conversationId) {
            conversationStartedAt.current = Date.now();
            trackConversationStarted({
              conversation_id: completeEvent.conversationId,
              entry_point: "explore",
              channel: "web",
            });
            trackMessageSent({
              conversation_id: completeEvent.conversationId,
              role: "assistant",
              message_number: 1,
              channel: "web",
            });
          }
        }
        refreshConversations();
      }).catch(() => {
        setErrorMessage("Connection lost. Try again.");
      }).finally(() => {
        setIsLoading(false);
      });

      return true;
    } catch {
      setErrorMessage("Connection lost. Try again.");
      setIsLoading(false);
      return false;
    } finally {
      // Releases after the awaited fetch settles (well past the same-tick
      // window); the background stream's own setIsLoading(false) runs later.
      startGuard.release();
    }
  }

  /**
   * Shared start-handler for "Jove speaks first" entry modes. Sends
   * `message: null` to the chat route — the server creates the
   * conversation, sets the mode column, and streams Jove's locked opener
   * back. Entry point fires into analytics derived from the mode. See
   * ADR-042 §1.
   *
   * All three modes (situation, guided-intake, upload) bootstrap through
   * this single path. Situation joined the bootstrap pattern after Phase 1;
   * before that it routed through sendMessage with a canned user string,
   * which forced the model to inverse-engineer intent on turn 1.
   */
  async function startConversation(mode: ConversationMode): Promise<boolean> {
    if (isLoading || isStreaming) return false;
    if (!startGuard.tryAcquire()) return false;

    // Complete the current conversation fire-and-forget (don't block on it),
    // then reset — the same reset-then-start shape startExploration uses.
    // This lets a returning user begin a fresh situation / guided-intake /
    // upload conversation straight from Home, over an auto-resumed thread.
    // The old `messages.length > 0` early-return made every Home start a
    // silent no-op for anyone with a loaded conversation; the in-flight
    // guard above already covers double-taps on the empty entry-cards screen.
    if (conversationId) {
      fetch("/api/conversations/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {});
    }

    resetConversationState("new");

    if (!firstSessionCompleted) {
      setFirstSessionCompleted(true);
      localStorage.setItem("mw_first_session_completed", "true");
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: null,
          conversationId: null,
          mode,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return false;
      }

      if (!res.ok) {
        setErrorMessage("Something went wrong. Try again.");
        return false;
      }

      const { completeEvent } = await streamFromResponse(res);

      if (completeEvent?.conversationId) {
        setConversationId(completeEvent.conversationId);
        conversationStartedAt.current = Date.now();
        // entry_point = mode for now. Diverge if a future entry point ever
        // needs to distinguish "user tapped the welcome card for situation"
        // from "deep link routed to situation" etc.
        trackConversationStarted({
          conversation_id: completeEvent.conversationId,
          entry_point: mode,
          channel: "web",
        });
        trackMessageSent({
          conversation_id: completeEvent.conversationId,
          role: "assistant",
          message_number: 1,
          channel: "web",
        });
        refreshConversations();
      }

      return true;
    } catch {
      setErrorMessage("Connection lost. Try again.");
      return false;
    } finally {
      setIsLoading(false);
      startGuard.release();
    }
  }

  /**
   * Start a live, client-driven simulation: open a real conversation in `mode`
   * (the genuine door path, so the opener + section picker render live), then
   * let the effect-driven loop below play the simulated user turn by turn.
   * Persona comes from the signed-in account (the real path), not an override.
   */
  async function runLiveSimulation(description: string, mode: ConversationMode) {
    if (simActive || simBusy) return;
    const trimmed = description.trim();
    if (!trimmed || isLoading || isStreaming) return;
    simDescRef.current = trimmed;
    simTurnRef.current = 0;
    setSimActive(true);
    const ok = await startConversation(mode);
    if (!ok) {
      simDescRef.current = null;
      setSimActive(false);
    }
  }

  // Live-simulation turn loop. Fires whenever Jove has just gone idle during an
  // active sim: reads what's on screen, asks the turn endpoint for the next
  // user line, and sends it through the real send path — tapping a section/chip
  // when options are present, typing otherwise. Stops at the first checkpoint
  // (left pending for the user to confirm), on [END], or at the turn cap.
  // `simBusy` is STATE, not a ref, so clearing it re-fires this effect to
  // advance the next turn; a ref wouldn't re-trigger and the loop would stall.
  const stopSim = useCallback(() => {
    simDescRef.current = null;
    setSimActive(false);
  }, []);

  useEffect(() => {
    if (!simActive || simBusy) return;
    if (isLoading || isStreaming) return;
    if (!conversationId) return;
    // Reached the "entry is ready" moment — hand off to the user. Covers both
    // models: an auto-proposed checkpoint (activeCheckpoint), or, under the
    // user-pulled reflection meter (where Jove never proposes), the latched
    // ready state. Without the reflectionReady stop the loop runs past the
    // natural end and pushes Jove into repeat-question drift.
    if (activeCheckpoint || reflectionReady) {
      stopSim();
      return;
    }
    if (simTurnRef.current >= SIM_MAX_TURNS) {
      stopSim();
      return;
    }
    const description = simDescRef.current;
    if (!description) return;
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return; // wait for Jove's opener/turn before replying

    const options =
      lastAssistant.chips && lastAssistant.chips.length > 0
        ? lastAssistant.chips
        : lastAssistant.showSections
          ? LAYERS.map((l) => l.name)
          : undefined;
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    setSimBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/dev-simulate/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulatedUserDescription: description,
            history,
            ...(options ? { availableOptions: options } : {}),
          }),
        });
        if (!res.ok) throw new Error(`turn endpoint ${res.status}`);
        const { message } = (await res.json()) as { message: string };
        simTurnRef.current += 1;
        if (!message || message.includes("[END]")) {
          stopSim();
          return;
        }
        await sendMessage(message, options ? { isChipResponse: true } : undefined);
      } catch (err) {
        console.error("[useChat] live simulation turn failed:", err);
        stopSim();
      } finally {
        setSimBusy(false);
      }
    })();
    // sendMessage/sendChipResponse are stable closures; messages drives re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simActive, simBusy, isLoading, isStreaming, conversationId, activeCheckpoint, reflectionReady, messages, stopSim]);

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    composingCheckpoint,
    activeCheckpoint,
    confirmedEntries,
    firstName,
    initialized,
    isNewUser,
    firstSessionCompleted,
    sessionOrigin,
    userEmail,
    sessionSummary,
    lastSessionDate,
    errorMessage,
    draftToRestore,
    clearDraftToRestore: () => setDraftToRestore(null),
    checkpointError,
    processingText,
    conversations,
    isGuest,
    promptAuth,
    resetPromptAuth: () => setPromptAuth(false),
    sendMessage,
    sendChipResponse: (text: string) =>
      sendMessage(text, { isChipResponse: true }),
    retryLastMessage,
    confirmCheckpoint,
    switchConversation,
    loadConversation,
    startNewSession,
    startExploration,
    startConversation,
    runLiveSimulation,
    simActive,
    refreshConversations,
    loadManual,
    updateEntry,
    displayName,
    // Modal 2 trigger inputs — refreshed on every message_complete.
    emergingPatternSnippet,
    hasLayerEmergingOrBeyond,
    concreteExamples,
    // Reflection meter (user-pulled model). reflectionFill (0–100) is the
    // capture-progress bar; reflectionReady is the latched completion;
    // composeReflection builds the entry on demand and opens the review overlay.
    reflectionFill,
    reflectionReady,
    composeReflection,
  };
}
