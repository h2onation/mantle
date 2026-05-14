// Parser for Anthropic's upstream Server-Sent Events streaming protocol —
// the body returned from anthropicStream() in @/lib/anthropic. Upstream
// sibling to parseSSEStream in @/lib/utils/sse-parser.ts, which parses
// OUR downstream protocol consumed by the client. Different event
// vocabularies (content_block_delta / message_delta / message_stop vs.
// text_delta / message_complete / error), so they cannot share a parser.
//
// Surfaces two signals: text_delta content (the streamed model output)
// and usage tokens (input/output/cache fields from message_start +
// message_delta — needed for prompt-cache telemetry). All other event
// types (content_block_start/stop, message_stop, ping, error) are
// intentionally skipped.

import { parseStreamUsage, type AnthropicUsage } from "@/lib/anthropic";

export interface AnthropicStreamCallbacks {
  onTextDelta: (text: string) => void;
  /** Fires zero-to-many times during the stream: once for `message_start`
   *  (input + cache token counts), once for `message_delta` (final
   *  output_tokens). Callers that don't need usage telemetry can omit. */
  onUsage?: (usage: AnthropicUsage) => void;
}

export async function parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
  callbacks: AnthropicStreamCallbacks
): Promise<void> {
  const reader = body.getReader();
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
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const event = JSON.parse(data);
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          callbacks.onTextDelta(event.delta.text);
          continue;
        }
        if (callbacks.onUsage) {
          const usage = parseStreamUsage(event);
          if (usage) callbacks.onUsage(usage);
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }
}
