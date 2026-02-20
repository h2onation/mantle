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
}

interface ActiveCheckpoint {
  messageId: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

const CHECKPOINT_REDIRECT = "I want to show you something — take a look at what's forming on the right. →";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState("");
  const [activeCheckpoint, setActiveCheckpoint] =
    useState<ActiveCheckpoint | null>(null);
  const [confirmedComponents, setConfirmedComponents] = useState<
    ManualComponent[]
  >([]);
  const [gateReached, setGateReached] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const initStarted = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  const loadManual = useCallback(async () => {
    try {
      const res = await fetch("/api/manual");
      if (res.ok) {
        const data = await res.json();
        setConfirmedComponents(data.components || []);
        setGateReached(data.gateReached || false);
      }
    } catch {
      // Silent fail
    }
  }, []);

  async function streamFromResponse(response: Response): Promise<{
    fullText: string;
    completeEvent: MessageCompleteEvent | null;
  }> {
    let fullText = "";
    let completeEvent: MessageCompleteEvent | null = null;

    // Add placeholder assistant message
    const placeholderIdx = { current: -1 };
    setMessages((prev) => {
      placeholderIdx.current = prev.length;
      return [...prev, { role: "assistant" as const, content: "" }];
    });
    setIsStreaming(true);
    setCurrentStreamText("");

    await parseSSEStream(response, {
      onTextDelta: (text) => {
        fullText += text;
        setCurrentStreamText((prev) => prev + text);
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
    });

    setIsStreaming(false);
    setCurrentStreamText("");

    return { fullText, completeEvent };
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

      // Replace streamed message with redirect
      setMessages((prev) => {
        const updated = [...prev];
        if (idx >= 0 && updated[idx]) {
          updated[idx] = {
            ...updated[idx],
            id: completeEvent!.messageId,
            content: CHECKPOINT_REDIRECT,
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
          const { fullText, completeEvent } = await streamFromResponse(res);

          if (completeEvent) {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  id: completeEvent!.messageId,
                  content: fullText,
                };
              }
              return updated;
            });
            setConversationId(completeEvent.conversationId);
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

    // Get display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .single();

    setDisplayName(
      profile?.display_name || session.user.email?.split("@")[0] || "User"
    );

    // Check for existing conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (conversations && conversations.length > 0) {
      const convId = conversations[0].id;
      setConversationId(convId);

      // Load messages
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("id, role, content, is_checkpoint, checkpoint_meta")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (dbMessages) {
        const chatMessages: ChatMessage[] = dbMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.is_checkpoint ? CHECKPOINT_REDIRECT : m.content,
            isCheckpoint: m.is_checkpoint || false,
            checkpointMeta: m.checkpoint_meta || null,
          }));
        setMessages(chatMessages);
      }

      // Load manual
      await loadManual();

      // If conversation exists but has no messages, trigger Sage's opener
      if (!dbMessages || dbMessages.filter((m) => m.role !== "system").length === 0) {
        await triggerSageOpener(convId);
      }
    } else {
      // Brand new user — trigger Sage's opener via SSE
      await triggerSageOpener(null);
    }

    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initializeConversation();
  }, [initializeConversation]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isStreaming) return;

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok) return;

      // Track where the placeholder will be inserted
      // (messages length after adding user msg = current + 1, placeholder goes at current + 1)
      const msgCountBeforeStream = messages.length + 1; // +1 for user msg we just added

      const { fullText, completeEvent } = await streamFromResponse(res);
      finalizeMessage(fullText, completeEvent, msgCountBeforeStream);
    } catch {
      // Failed to send
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmCheckpoint(action: "confirmed" | "rejected" | "refined") {
    if (!activeCheckpoint) return;

    setIsLoading(true);

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

      if (!res.ok) return;

      if (action === "confirmed") {
        // Add to confirmed components locally
        setConfirmedComponents((prev) => [
          ...prev,
          {
            id: activeCheckpoint.messageId,
            layer: activeCheckpoint.layer,
            type: activeCheckpoint.type,
            name: activeCheckpoint.name,
            content: activeCheckpoint.content,
          },
        ]);
      }

      // Clear active checkpoint
      setActiveCheckpoint(null);

      // Stream Sage's follow-up response
      const msgCountBeforeStream = messages.length;
      const { fullText, completeEvent } = await streamFromResponse(res);
      finalizeMessage(fullText, completeEvent, msgCountBeforeStream);

      // Refresh manual from server
      await loadManual();
    } catch {
      // Failed to confirm
    } finally {
      setIsLoading(false);
    }
  }

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    currentStreamText,
    activeCheckpoint,
    confirmedComponents,
    gateReached,
    initialized,
    displayName,
    sendMessage,
    confirmCheckpoint,
  };
}
