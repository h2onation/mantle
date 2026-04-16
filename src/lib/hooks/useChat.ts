"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseSSEStream, type MessageCompleteEvent } from "@/lib/utils/sse-parser";
import type { ChatMessage, ManualEntry, ActiveCheckpoint, ExplorationContext } from "@/lib/types";
import {
  trackConversationStarted,
  trackMessageSent,
  trackConversationEnded,
  trackCheckpointProposed,
  trackCheckpointConfirmed,
  trackCheckpointRejected,
  trackCheckpointRefined,
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
 * a user-facing message. See docs/checkpoint-hardening-plan.md Track 3
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
  const [displayName, setDisplayName] = useState("");
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

  const initStarted = useRef(false);
  const lastUserMessage = useRef<string | null>(null);
  // Set when a checkpoint becomes active in finalizeMessage; read when the
  // user acts so checkpoint_{confirmed,rejected,refined} can report the
  // wall-clock time the user took to decide.
  const checkpointProposedAt = useRef<number | null>(null);
  // Set when a conversation is created so conversation_ended can report
  // a duration without querying the DB.
  const conversationStartedAt = useRef<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadManual = useCallback(async () => {
    try {
      const res = await fetch("/api/manual");
      if (res.ok) {
        const data = await res.json();
        setConfirmedEntries(data.components || []);
        if (data.displayName) setDisplayName(data.displayName);
      }
    } catch (err) {
      console.error("[useChat] Failed to load manual:", err);
    }
  }, []);

  async function streamFromResponse(response: Response): Promise<{
    fullText: string;
    completeEvent: MessageCompleteEvent | null;
  }> {
    let fullText = "";
    let completeEvent: MessageCompleteEvent | null = null;
    let sseError: string | null = null;

    // Buffer text silently — no placeholder message during streaming
    setIsStreaming(true);

    try {
      await parseSSEStream(response, {
        onTextDelta: (text) => {
          fullText += text;
        },
        onMessageComplete: (data) => {
          completeEvent = data;
        },
        onError: (error) => {
          sseError = error;
        },
      });
    } finally {
      setIsStreaming(false);
    }

    // If SSE emitted an error, surface it
    if (sseError) {
      setErrorMessage(sseError);
    }

    // On success, add the complete message in one shot (fade-in via CSS)
    // Use cleanContent (stripped of manual entry block) when available
    if (!sseError && fullText) {
      const evt = completeEvent as MessageCompleteEvent | null;
      const displayContent = evt?.cleanContent || fullText;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: displayContent,
          id: evt?.messageId,
        },
      ]);
    }

    return { fullText, completeEvent };
  }

  function finalizeMessage(
    fullText: string,
    completeEvent: MessageCompleteEvent | null
  ) {
    if (!completeEvent) return;

    // Use clean content (without manual entry block) when available
    const displayContent = completeEvent.cleanContent || fullText;

    if (completeEvent.checkpoint) {
      // Set active checkpoint with clean text
      setActiveCheckpoint({
        messageId: completeEvent.messageId,
        layer: completeEvent.checkpoint.layer,
        name: completeEvent.checkpoint.name,
        content: displayContent,
      });

      // Capture the moment the proposal became visible so checkpoint
      // decision events can report time_to_decision_ms.
      checkpointProposedAt.current = Date.now();

      const convIdForCp = completeEvent.conversationId || conversationId;
      if (convIdForCp && completeEvent.messageId) {
        trackCheckpointProposed({
          conversation_id: convIdForCp,
          checkpoint_id: completeEvent.messageId,
          layer: completeEvent.checkpoint.layer,
          message_number: messages.length + 1,
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
            },
          };
        }
        return updated;
      });
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

    if (allConversations.length > 0) {
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

      // If conversation exists but has no messages, trigger Sage's opener
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

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isStreaming) return;

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
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      // Anonymous checkpoint conversion gate: server returns 200 JSON
      // ({ blocked: true, reason: "signup_required" }) instead of an SSE
      // stream. Show the conversion prompt and drop the optimistic user
      // message — do NOT render an error or a Sage reply.
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
        setErrorMessage("Something went wrong. Try again.");
        return;
      }

      const { fullText, completeEvent } = await streamFromResponse(res);
      finalizeMessage(fullText, completeEvent);

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

  async function confirmCheckpoint(action: "confirmed" | "rejected" | "refined") {
    if (!activeCheckpoint) return;

    setIsLoading(true);
    setCheckpointError(null);

    const body = JSON.stringify({
      messageId: activeCheckpoint.messageId,
      action,
      conversationId,
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
        // Add to confirmed entries locally (optimistic update)
        setConfirmedEntries((prev) => [
          ...prev,
          {
            id: activeCheckpoint.messageId,
            layer: activeCheckpoint.layer,
            name: null,
            content: activeCheckpoint.content,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // Report time to decision for the checkpoint event.
      const proposedAt = checkpointProposedAt.current;
      const timeToDecisionMs = proposedAt ? Date.now() - proposedAt : 0;
      const cpProps = {
        conversation_id: conversationId || "",
        checkpoint_id: activeCheckpoint.messageId,
        layer: activeCheckpoint.layer,
        time_to_decision_ms: timeToDecisionMs,
      };
      if (cpProps.conversation_id) {
        if (action === "confirmed") trackCheckpointConfirmed(cpProps);
        else if (action === "rejected") trackCheckpointRejected(cpProps);
        else if (action === "refined") trackCheckpointRefined(cpProps);
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
        const { fullText, completeEvent } = await streamFromResponse(res);
        finalizeMessage(fullText, completeEvent);
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
          name: lastMsg.checkpoint_meta.name,
          content: lastMsg.content,
        });
      }
    }
  }

  async function startNewSession() {
    if (isLoading || isStreaming) return;

    // Complete current conversation if one exists
    if (conversationId) {
      const durationSeconds = conversationStartedAt.current
        ? Math.round((Date.now() - conversationStartedAt.current) / 1000)
        : 0;
      trackConversationEnded({
        conversation_id: conversationId,
        end_type: "natural",
        message_count: messages.length,
        duration_seconds: durationSeconds,
      });
      conversationStartedAt.current = null;

      try {
        await fetch("/api/conversations/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        });
      } catch {
        // Continue anyway
      }
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

    // Refresh conversation list
    await refreshConversations();
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

    // Send chat request with exploration context (message=null triggers Sage opener)
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

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    activeCheckpoint,
    confirmedEntries,
    displayName,
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
    retryLastMessage,
    confirmCheckpoint,
    switchConversation,
    loadConversation,
    startNewSession,
    startExploration,
    refreshConversations,
    loadManual,
  };
}
