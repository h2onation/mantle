import { vi } from "vitest";

/**
 * Returns a canned anthropicFetch response shape.
 */
export function mockAnthropicFetchResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

/**
 * Creates a ReadableStream that emits Anthropic SSE events for the given text chunks.
 * Useful for testing code that consumes anthropicStream() output.
 */
export function mockAnthropicSSEStream(
  chunks: string[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const sseEvent = `data: ${JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: chunk },
        })}\n\n`;
        controller.enqueue(encoder.encode(sseEvent));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/**
 * Helper to create a vi.fn() that returns a canned anthropicFetch response.
 */
export function createMockAnthropicFetch(defaultText: string) {
  return vi.fn().mockResolvedValue(mockAnthropicFetchResponse(defaultText));
}
