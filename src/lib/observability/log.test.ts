import { describe, it, expect, vi } from "vitest";
import { hashUserId, logEvent } from "@/lib/observability/log";

describe("hashUserId", () => {
  it("returns null for null/undefined/empty input", async () => {
    expect(await hashUserId(null)).toBeNull();
    expect(await hashUserId(undefined)).toBeNull();
    expect(await hashUserId("")).toBeNull();
  });

  it("returns a 16-char lowercase hex string for a real id", async () => {
    const hash = await hashUserId("0132bbda-c126-4cb3-8aa7-7100cb943b47");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic — same input → same output", async () => {
    const id = "0132bbda-c126-4cb3-8aa7-7100cb943b47";
    const a = await hashUserId(id);
    const b = await hashUserId(id);
    expect(a).toBe(b);
  });

  it("distinguishes different user ids", async () => {
    const a = await hashUserId("user-aaa-1234");
    const b = await hashUserId("user-bbb-1234");
    expect(a).not.toBe(b);
  });

  it("doesn't leak the raw id in the hash", async () => {
    const id = "secret-id-12345";
    const hash = await hashUserId(id);
    expect(hash).not.toContain("secret");
    expect(hash).not.toContain("12345");
  });
});

describe("logEvent — cache_performance", () => {
  it("emits the cache token counts in dev output", () => {
    // Dev output is human-readable; production is single-line JSON.
    // Confirm cache counts surface in both shapes.
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      logEvent({
        event: "cache_performance",
        surface: "chat",
        model: "claude-sonnet-4-6",
        input_tokens: 12,
        output_tokens: 248,
        cache_creation_input_tokens: 4096,
        cache_read_input_tokens: 0,
      });
      const joined = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(joined).toContain("cache_performance");
      expect(joined).toContain("surface=chat");
      expect(joined).toContain("cache_read=0");
      expect(joined).toContain("cache_create=4096");
      expect(joined).toContain("uncached_input=12");
    } finally {
      spy.mockRestore();
    }
  });
});
