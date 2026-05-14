import { describe, it, expect } from "vitest";
import { parseStreamUsage } from "@/lib/anthropic";

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
