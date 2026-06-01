import { describe, it, expect, vi } from "vitest";
import { parseStreamUsage, withIdleTimeout } from "@/lib/anthropic";

// parseStreamUsage extracts cache+token counts from individual SSE events
// during a streaming response. Callers (call-persona.ts) accumulate the
// result across the stream so the post-stream cache_performance log line
// has both input/cache counts (from message_start) and output_tokens
// (from message_delta).

describe("parseStreamUsage", () => {
  it("extracts usage from message_start events", () => {
    const event = {
      type: "message_start",
      message: {
        id: "msg_1",
        usage: {
          input_tokens: 42,
          output_tokens: 1,
          cache_creation_input_tokens: 4096,
          cache_read_input_tokens: 0,
        },
      },
    };
    expect(parseStreamUsage(event)).toEqual({
      input_tokens: 42,
      output_tokens: 1,
      cache_creation_input_tokens: 4096,
      cache_read_input_tokens: 0,
    });
  });

  it("extracts usage from message_delta events", () => {
    const event = {
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 248 },
    };
    expect(parseStreamUsage(event)).toEqual({ output_tokens: 248 });
  });

  it("returns null for content_block_delta events", () => {
    const event = {
      type: "content_block_delta",
      delta: { type: "text_delta", text: "hello" },
    };
    expect(parseStreamUsage(event)).toBeNull();
  });

  it("returns null for unrelated event types", () => {
    expect(parseStreamUsage({ type: "ping" })).toBeNull();
    expect(parseStreamUsage({ type: "content_block_start" })).toBeNull();
    expect(parseStreamUsage({ type: "message_stop" })).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseStreamUsage(null)).toBeNull();
    expect(parseStreamUsage(undefined)).toBeNull();
    expect(parseStreamUsage("not an object")).toBeNull();
    expect(parseStreamUsage(42)).toBeNull();
  });

  it("surfaces a cache hit (cache_read > 0, cache_creation = 0)", () => {
    // Shape of a typical second-turn streaming response after a hit.
    const event = {
      type: "message_start",
      message: {
        usage: {
          input_tokens: 12,
          output_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 4096,
        },
      },
    };
    const usage = parseStreamUsage(event);
    expect(usage?.cache_read_input_tokens).toBeGreaterThan(0);
    expect(usage?.cache_creation_input_tokens).toBe(0);
  });

  it("handles message_start with no usage field gracefully", () => {
    const event = { type: "message_start", message: { id: "msg_1" } };
    expect(parseStreamUsage(event)).toBeNull();
  });
});

// withIdleTimeout is the fix for the mid-stream Anthropic stall (flow-review F):
// the previous anthropicStream cleared its only timeout the moment headers
// arrived, so a 200-then-stall (a truncated SSE stream that never sends
// message_stop) hung the downstream reader.read() loop until Vercel's
// wall-clock kill. This wrapper re-arms a per-chunk idle timer so a stall
// errors the stream instead of hanging.
describe("withIdleTimeout", () => {
  it("passes chunks through and closes when the source completes (no false idle)", async () => {
    const enc = new TextEncoder();
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode("a"));
        c.enqueue(enc.encode("b"));
        c.close();
      },
    });
    const reader = withIdleTimeout(source, 10_000).getReader();
    const dec = new TextDecoder();
    const r1 = await reader.read();
    const r2 = await reader.read();
    const r3 = await reader.read();
    expect(dec.decode(r1.value)).toBe("a");
    expect(dec.decode(r2.value)).toBe("b");
    expect(r3.done).toBe(true);
  });

  it("errors the stream and fires onIdle when the source stalls past the idle window", async () => {
    vi.useFakeTimers();
    try {
      const onIdle = vi.fn();
      // A source that never enqueues and never closes → read() hangs forever.
      const stalling = new ReadableStream<Uint8Array>({ start() {} });
      const reader = withIdleTimeout(stalling, 1000, onIdle).getReader();
      // Attach the rejection handler immediately (convert it to a value) so the
      // read promise is never momentarily unhandled while we advance the timer
      // — vitest treats a transient unhandled rejection as an error.
      const settled = reader.read().then(
        () => null,
        (e: unknown) => e
      );
      await vi.advanceTimersByTimeAsync(1000);
      const err = await settled;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/idle/i);
      // Named AbortError so the consumer treats a stall like its connect timeout.
      expect((err as Error).name).toBe("AbortError");
      expect(onIdle).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
