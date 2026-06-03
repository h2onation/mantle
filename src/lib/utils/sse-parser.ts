import type { ConversationMode } from "@/lib/persona/config";

export interface MessageCompleteEvent {
  messageId: string;
  conversationId: string;
  checkpoint: {
    isCheckpoint: boolean;
    layer: number;
    name: string | null;
    // Track A Phase 7-Mid: refinement_count is set when the new
    // checkpoint inherits from a prior refined checkpoint in the
    // chain. Optional for backward compatibility with older server
    // builds; client treats undefined as 0.
    refinement_count?: number;
    // Polished entry text composed at proposal time. Shown in the
    // review overlay so the user sees the exact text that will land
    // in their Manual on confirm. Optional for backward compatibility.
    composed_content?: string | null;
  } | null;
  processingText: string;
  cleanContent?: string;
  promptAuth?: boolean;
  // Modal 2 (Pattern-Forming) trigger inputs, derived from the
  // previous-turn extraction state (one-turn lag).
  // Optional so older clients ignore them gracefully.
  emergingPatternSnippet?: string | null;
  hasLayerEmergingOrBeyond?: boolean;
  concreteExamples?: number;
  // Conversation mode at the time this message was emitted. Carried for
  // analytics so the client can attach mode to checkpoint and session-end
  // events without a separate fetch. Optional for backward compatibility
  // (treated as "situation" when missing).
  mode?: ConversationMode;
  chips?: string[];
}

interface SSECallbacks {
  onTextDelta: (text: string) => void;
  onMessageComplete: (data: MessageCompleteEvent) => void;
  onError?: (error: string) => void;
}

export async function parseSSEStream(
  response: Response,
  callbacks: SSECallbacks
): Promise<void> {
  if (!response.body) {
    callbacks.onError?.("No response body");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "text_delta") {
            callbacks.onTextDelta(event.text);
          } else if (event.type === "message_complete") {
            callbacks.onMessageComplete(event);
          } else if (event.type === "error") {
            callbacks.onError?.(event.message || event.error || "Something went wrong.");
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } catch {
    callbacks.onError?.("Connection lost. Try again.");
  }
}
