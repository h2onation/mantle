"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseSSEStream, type MessageCompleteEvent } from "@/lib/utils/sse-parser";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  isCheckpoint?: boolean;
  checkpointMeta?: {
    layer: number;
    type: string;
    name: string | null;
    status: string;
  } | null;
}

interface ManualComponent {
  id: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
  created_at?: string;
}

interface ActiveCheckpoint {
  messageId: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

export interface ConversationSummaryItem {
  id: string;
  status: string;
  summary: string | null;
  preview: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] =
    useState<ActiveCheckpoint | null>(null);
  const [confirmedComponents, setConfirmedComponents] = useState<
    ManualComponent[]
  >([]);
  const [initialized, setInitialized] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [processingText, setProcessingText] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummaryItem[]>([]);

  const initStarted = useRef(false);
  const lastUserMessage = useRef<string | null>(null);
  const placeholderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadManual = useCallback(async () => {
    try {
      const res = await fetch("/api/manual");
      if (res.ok) {
        const data = await res.json();
        setConfirmedComponents(data.components || []);
      }
    } catch {
      // Silent fail
    }
  }, []);

  async function streamFromResponse(response: Response): Promise<{
    fullText: string;
    completeEvent: MessageCompleteEvent | null;
    placeholderIdx: number;
  }> {
    let fullText = "";
    let completeEvent: MessageCompleteEvent | null = null;
    let sseError: string | null = null;

    // Add placeholder assistant message — capture index atomically via setState callback
    const placeholderIdx = { current: -1 };
    setMessages((prev) => {
      placeholderIdx.current = prev.length;
      return [...prev, { role: "assistant" as const, content: "" }];
    });
    setIsStreaming(true);

    try {
      await parseSSEStream(response, {
        onTextDelta: (text) => {
          fullText += text;
          setMessages((prev) => {
            const updated = [...prev];
            const idx = placeholderIdx.current;
            if (idx >= 0 && updated[idx]) {
              updated[idx] = {
                ...updated[idx],
                content: updated[idx].content + text,
              };
            }
            return updated;
          });
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

    // If SSE emitted an error, remove the placeholder and surface it
    if (sseError) {
      setMessages((prev) => {
        const updated = [...prev];
        const idx = placeholderIdx.current;
        if (idx >= 0 && updated[idx] && !updated[idx].content) {
          updated.splice(idx, 1);
        }
        return updated;
      });
      setErrorMessage(sseError);
    }

    return { fullText, completeEvent, placeholderIdx: placeholderIdx.current };
  }

  function finalizeMessage(
    fullText: string,
    completeEvent: MessageCompleteEvent | null,
    placeholderOffset: number
  ) {
    if (!completeEvent) return;

    const idx = placeholderOffset;

    if (completeEvent.checkpoint) {
      // Set active checkpoint with full text
      setActiveCheckpoint({
        messageId: completeEvent.messageId,
        layer: completeEvent.checkpoint.layer,
        type: completeEvent.checkpoint.type,
        name: completeEvent.checkpoint.name,
        content: fullText,
      });

      // Keep full checkpoint text inline with checkpoint metadata
      setMessages((prev) => {
        const updated = [...prev];
        if (idx >= 0 && updated[idx]) {
          updated[idx] = {
            ...updated[idx],
            id: completeEvent!.messageId,
            content: fullText,
            isCheckpoint: true,
            checkpointMeta: {
              layer: completeEvent!.checkpoint!.layer,
              type: completeEvent!.checkpoint!.type,
              name: completeEvent!.checkpoint!.name,
              status: "pending",
            },
          };
        }
        return updated;
      });
    } else {
      // Finalize normally
      setMessages((prev) => {
        const updated = [...prev];
        if (idx >= 0 && updated[idx]) {
          updated[idx] = {
            ...updated[idx],
            id: completeEvent!.messageId,
            content: fullText,
          };
        }
        return updated;
      });
    }

    if (completeEvent.processingText) {
      setProcessingText(completeEvent.processingText);
    }

    // Set placeholder with delay so user has a beat to read the response
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current);
    }
    if (completeEvent.placeholder) {
      placeholderTimeoutRef.current = setTimeout(() => {
        setPlaceholder(completeEvent!.placeholder || null);
      }, 400);
    }

    if (completeEvent.conversationId && !conversationId) {
      setConversationId(completeEvent.conversationId);
    }
  }

  const initializeConversation = useCallback(async () => {
    if (initStarted.current) return;
    initStarted.current = true;

    async function triggerSageOpener(existingConversationId: string | null) {
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
          const { fullText, completeEvent, placeholderIdx } = await streamFromResponse(res);

          if (completeEvent) {
            setMessages((prev) => {
              const updated = [...prev];
              if (placeholderIdx >= 0 && updated[placeholderIdx]) {
                updated[placeholderIdx] = {
                  ...updated[placeholderIdx],
                  id: completeEvent!.messageId,
                  content: fullText,
                };
              }
              return updated;
            });
            setConversationId(completeEvent.conversationId);

            // Set placeholder with delay
            if (completeEvent.placeholder) {
              if (placeholderTimeoutRef.current) {
                clearTimeout(placeholderTimeoutRef.current);
              }
              placeholderTimeoutRef.current = setTimeout(() => {
                setPlaceholder(completeEvent!.placeholder || null);
              }, 400);
            }
          }
        }
      } catch {
        // Initialization failed
      } finally {
        setIsLoading(false);
      }
    }

    // Wait for auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    setUserEmail(session.user.email || "");

    // Load all conversations via API
    let allConversations: ConversationSummaryItem[] = [];
    try {
      const convRes = await fetch("/api/conversations");
      if (convRes.ok) {
        const convData = await convRes.json();
        allConversations = convData.conversations || [];
        setConversations(allConversations);
      }
    } catch {
      // Fall back to empty
    }

    if (allConversations.length > 0) {
      const latest = allConversations[0];
      setConversationId(latest.id);
      setSessionSummary(latest.summary || null);
      setLastSessionDate(latest.updated_at || null);
      const convId = latest.id;

      // Load messages
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("id, role, content, is_checkpoint, checkpoint_meta, created_at")
        .eq("conversation_id", convId)
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
      }

      // Load manual components (determines returning user status)
      await loadManual();

      // If conversation exists but has no messages, trigger Sage's opener
      const nonSystemMessages = dbMessages?.filter((m) => m.role !== "system") || [];
      if (nonSystemMessages.length === 0) {
        // Show the chat UI immediately, let opener stream in live
        setInitialized(true);
        await triggerSageOpener(convId);
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
          }).catch(() => {});
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

    // Clear previous error and track for retry
    setErrorMessage(null);
    lastUserMessage.current = text;

    // Clear any pending placeholder timeout
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current);
    }

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

      if (!res.ok) {
        setErrorMessage("Something went wrong. Try again.");
        return;
      }

      const { fullText, completeEvent, placeholderIdx } = await streamFromResponse(res);
      finalizeMessage(fullText, completeEvent, placeholderIdx);

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
    // Remove trailing partial assistant message (no id = not finalized) and the user message
    setMessages((prev) => {
      const updated = [...prev];
      while (
        updated.length > 0 &&
        updated[updated.length - 1].role === "assistant" &&
        !updated[updated.length - 1].id
      ) {
        updated.pop();
      }
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

    try {
      const res = await fetch("/api/checkpoint/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: activeCheckpoint.messageId,
          action,
          conversationId,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        setCheckpointError("Something went wrong saving that. Try again.");
        return;
      }

      if (action === "confirmed") {
        // Add to confirmed components locally (optimistic update)
        setConfirmedComponents((prev) => [
          ...prev,
          {
            id: activeCheckpoint.messageId,
            layer: activeCheckpoint.layer,
            type: activeCheckpoint.type,
            name: activeCheckpoint.name,
            content: activeCheckpoint.content,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // Clear active checkpoint
      setActiveCheckpoint(null);

      // Stream Sage's follow-up response
      const { fullText, completeEvent, placeholderIdx } = await streamFromResponse(res);
      finalizeMessage(fullText, completeEvent, placeholderIdx);

      // Refresh manual from server
      await loadManual();
    } catch {
      setCheckpointError("Something went wrong saving that. Try again.");
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
    setMessages([]);
    setActiveCheckpoint(null);
    setErrorMessage(null);
    setCheckpointError(null);
    setPlaceholder(null);
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current);
    }

    // Load messages for target conversation
    const { data: dbMessages } = await supabase
      .from("messages")
      .select("id, role, content, is_checkpoint, checkpoint_meta, created_at")
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
      .select("id, role, content, is_checkpoint, checkpoint_meta, created_at")
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
          type: lastMsg.checkpoint_meta.type,
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
    setConversationId(null);
    setMessages([]);
    setSessionSummary(null);
    setLastSessionDate(null);
    setActiveCheckpoint(null);
    setErrorMessage(null);
    setCheckpointError(null);
    setPlaceholder(null);
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current);
    }

    // Refresh conversation list
    await refreshConversations();
  }

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    activeCheckpoint,
    confirmedComponents,
    initialized,
    isNewUser,
    userEmail,
    sessionSummary,
    lastSessionDate,
    errorMessage,
    checkpointError,
    processingText,
    placeholder,
    conversations,
    sendMessage,
    retryLastMessage,
    confirmCheckpoint,
    switchConversation,
    loadConversation,
    startNewSession,
    refreshConversations,
  };
}
