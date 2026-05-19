"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseSSEStream, type MessageCompleteEvent } from "@/lib/utils/sse-parser";
import { firstNameFrom } from "@/lib/utils/name";
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
  trackGuidedIntakeOpenerFired,
  type ConversationMode,
} from "@/lib/analytics/events";
import { detectGuidedIntakeOpenerVariant } from "@/lib/persona/guided-intake-copy";

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
        layer: checkpoint.layer,
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

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
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

  const initStarted = useRef(false);
  const lastUserMessage = useRef<string | null>(null);
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
  const router = useRouter();
  const supabase = createClient();

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

    // Track the conversation's mode locally so checkpoint and
    // conversation_ended events can attach it. Server is authoritative;
    // client mirrors what the SSE event reports.
    const eventMode: ConversationMode = completeEvent.mode ?? "situation";
    conversationMode.current = eventMode;

    // Use clean content (without manual entry block) when available
    const displayContent = completeEvent.cleanContent || fullText;

    // Guided-intake opener-flow detection. Fires per assistant turn that
    // matches one of the four canonical phrases. Multiple events per
    // session are expected (e.g. default on turn 1, widen_scope later).
    // The dashboard derives "deepest variant per conversation" downstream.
    if (eventMode === "guided-intake" && displayContent) {
      const variant = detectGuidedIntakeOpenerVariant(displayContent);
      const convIdForOpener = completeEvent.conversationId || conversationId;
      if (variant && convIdForOpener) {
        trackGuidedIntakeOpenerFired({
          conversation_id: convIdForOpener,
          variant,
        });
      }
    }

    if (completeEvent.checkpoint) {
      // Set active checkpoint with clean text
      setActiveCheckpoint({
        messageId: completeEvent.messageId,
        layer: completeEvent.checkpoint.layer,
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
          layer: completeEvent.checkpoint.layer,
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
              layer: completeEvent!.checkpoint!.layer,
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

    if (allConversations.length > 0 && !pendingNewSession) {
      setSessionOrigin("existing");
      const latest = allConversations[0];
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
      }

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
    } else if (pendingNewSession) {
      // Returning user who clicked "New session" before this refresh.
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

  async function sendMessage(text: string, options?: { isChipResponse?: boolean }) {
    if (!text.trim() || isLoading || isStreaming) return;

    // Clear chips from all messages whenever a new user message is sent
    setMessages((prev) =>
      prev.some((m) => m.chips)
        ? prev.map((m) => (m.chips ? { ...m, chips: undefined } : m))
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
            layer: activeCheckpoint.layer,
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
      }

      // Report time to decision for the checkpoint event.
      const proposedAt = checkpointProposedAt.current;
      const timeToDecisionMs = proposedAt ? Date.now() - proposedAt : 0;
      const cpProps = {
        conversation_id: conversationId || "",
        checkpoint_id: activeCheckpoint.messageId,
        layer: activeCheckpoint.layer,
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

      // First-time confirm — stream Jove's follow-up and finalize.
      // If the stream fails mid-flight, the server-side write has
      // already succeeded (atomic RPC, Track 2), so we reconcile via
      // loadManual() instead of surfacing an error to the user.
      try {
        // Phase 7-High: per-event finalize happens inside
        // streamFromResponse. Return value is unused here — the
        // follow-up stream's side effects (appending messages,
        // activating checkpoint state) are what matter.
        await streamFromResponse(res);
      } catch (err) {
        // Server wrote the entry; the follow-up stream just didn't land
        // cleanly. Next message from the user will re-load context.
        console.warn("[useChat] Confirm follow-up stream interrupted:", err);
      }

      // Refresh manual from server (runs regardless of stream outcome).
      await loadManual();
    } finally {
      setIsLoading(false);
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
    }

    setConversationId(targetConversationId);

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

    // Reset checkpoint before reloading
    setActiveCheckpoint(null);

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

      // Detect pending checkpoint in the last message
      const lastMsg = dbMessages[dbMessages.length - 1];
      if (
        lastMsg?.is_checkpoint &&
        lastMsg.checkpoint_meta?.status === "pending"
      ) {
        setActiveCheckpoint({
          messageId: lastMsg.id,
          layer: lastMsg.checkpoint_meta.layer,
          name: lastMsg.checkpoint_meta.composed_name || lastMsg.checkpoint_meta.name,
          content: lastMsg.content,
          composedContent: lastMsg.checkpoint_meta.composed_content ?? null,
        });
      }
    }
  }

  async function startNewSession() {
    if (isLoading || isStreaming) return;

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
    setSessionOrigin("new");
    setConversationId(null);
    setMessages([]);
    setSessionSummary(null);
    setLastSessionDate(null);
    setActiveCheckpoint(null);
    setErrorMessage(null);
    setCheckpointError(null);

    // Persist intent so a page refresh stays on the new-session screen
    // instead of reloading the most recent conversation.
    try { sessionStorage.setItem("mw_new_session", "1"); } catch {}

    // Refresh conversation list in background
    refreshConversations();
  }

  async function startExploration(context: ExplorationContext): Promise<boolean> {
    if (isLoading || isStreaming) return false;

    // Complete current conversation fire-and-forget (don't block on it)
    if (conversationId) {
      fetch("/api/conversations/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {});
    }

    // Reset state for new session
    setSessionOrigin("explore");
    setConversationId(null);
    setMessages([]);
    setSessionSummary(null);
    setLastSessionDate(null);
    setActiveCheckpoint(null);
    setErrorMessage(null);
    setCheckpointError(null);

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
              entry_point: "situation",
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
    if (messages.length > 0) return false;

    if (!firstSessionCompleted) {
      setFirstSessionCompleted(true);
      localStorage.setItem("mw_first_session_completed", "true");
    }

    setIsLoading(true);
    setErrorMessage(null);

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
    }
  }

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
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
    refreshConversations,
    loadManual,
    updateEntry,
    displayName,
    // Modal 2 trigger inputs — refreshed on every message_complete.
    emergingPatternSnippet,
    hasLayerEmergingOrBeyond,
    concreteExamples,
  };
}
