import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildTranscript,
  generateSessionSummary,
} from "@/lib/persona/generate-summary";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockAnthropicFetch = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  anthropicFetch: (...a: unknown[]) => mockAnthropicFetch(...a),
  extractResponseText: (resp: { content?: { type: string; text: string }[] }) =>
    resp?.content?.[0]?.type === "text" ? resp.content[0].text : "",
}));

// Minimal admin double: the messages read resolves to `messagesData`; the
// conversations update records its patch via updateSpy.
function makeAdmin(
  messagesData: unknown,
  updateSpy: (patch: unknown) => void
): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: messagesData }) }),
      }),
      update: (patch: unknown) => ({
        eq: () => {
          updateSpy(patch);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("buildTranscript", () => {
  it("labels user messages as 'User'", () => {
    const result = buildTranscript([{ role: "user", content: "Hello" }]);
    expect(result).toBe("User: Hello");
  });

  it("labels assistant messages as 'Jove'", () => {
    const result = buildTranscript([{ role: "assistant", content: "Hi there" }]);
    expect(result).toBe("Jove: Hi there");
  });

  it("labels system messages as 'System'", () => {
    const result = buildTranscript([{ role: "system", content: "[User confirmed the checkpoint]" }]);
    expect(result).toBe("System: [User confirmed the checkpoint]");
  });

  it("joins messages with double newlines", () => {
    const result = buildTranscript([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "How are you" },
    ]);
    expect(result).toBe("User: Hello\n\nJove: Hi\n\nUser: How are you");
  });

  it("returns empty string for empty array", () => {
    const result = buildTranscript([]);
    expect(result).toBe("");
  });
});

describe("generateSessionSummary — never overwrite with a blank/malformed summary", () => {
  beforeEach(() => {
    mockAnthropicFetch.mockReset();
  });

  it("persists and returns a TITLE-bearing summary", async () => {
    const good = "TITLE: Conflict at work\n\nThey explored avoidance under pressure.";
    mockAnthropicFetch.mockResolvedValue({
      content: [{ type: "text", text: good }],
    });
    const updateSpy = vi.fn();
    const result = await generateSessionSummary(
      "conv-1",
      makeAdmin([{ role: "user", content: "hi" }], updateSpy)
    );
    expect(result).toBe(good);
    expect(updateSpy).toHaveBeenCalledWith({ summary: good });
  });

  it("returns null and does NOT update on an empty completion", async () => {
    mockAnthropicFetch.mockResolvedValue({ content: [{ type: "text", text: "" }] });
    const updateSpy = vi.fn();
    const result = await generateSessionSummary(
      "conv-1",
      makeAdmin([{ role: "user", content: "hi" }], updateSpy)
    );
    expect(result).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns null and does NOT update when the summary lacks a TITLE line", async () => {
    mockAnthropicFetch.mockResolvedValue({
      content: [{ type: "text", text: "A summary with no title prefix at all." }],
    });
    const updateSpy = vi.fn();
    const result = await generateSessionSummary(
      "conv-1",
      makeAdmin([{ role: "user", content: "hi" }], updateSpy)
    );
    expect(result).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns null without calling Anthropic when there are no messages", async () => {
    const updateSpy = vi.fn();
    const result = await generateSessionSummary(
      "conv-1",
      makeAdmin([], updateSpy)
    );
    expect(result).toBeNull();
    expect(mockAnthropicFetch).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
