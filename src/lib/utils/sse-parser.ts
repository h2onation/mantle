export interface MessageCompleteEvent {
  messageId: string;
  conversationId: string;
  checkpoint: {
    isCheckpoint: boolean;
    layer: number;
    type: string;
    name: string | null;
  } | null;
  processingText: string;
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
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
}
