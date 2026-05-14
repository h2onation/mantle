// Parser for Anthropic's upstream Server-Sent Events streaming protocol —
// the body returned from anthropicStream() in @/lib/anthropic. Upstream
// sibling to parseSSEStream in @/lib/utils/sse-parser.ts, which parses
// OUR downstream protocol consumed by the client. Different event
// vocabularies (content_block_delta / message_delta / message_stop vs.
// text_delta / message_complete / error), so they cannot share a parser.
//
// Only text_delta content blocks are surfaced — that's the sole signal
// the current consumer (callPersona) extracts. Other event types
// (message_start, content_block_start/stop, message_delta, message_stop,
// ping, error) are intentionally skipped to match prior behavior.

export interface AnthropicStreamCallbacks {
  onTextDelta: (text: string) => void;
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
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }
}
