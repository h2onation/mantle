import { describe, it, expect, vi } from "vitest";
import { cleanAndParseClassification } from "@/lib/persona/classifier";

describe("cleanAndParseClassification", () => {
  it("parses clean JSON correctly", () => {
    const raw = '{"is_checkpoint":true,"layer":2,"name":"The Fixer","processing_text":"identity patterns forming..."}';
    const result = cleanAndParseClassification(raw);
    expect(result).toEqual({
      isCheckpoint: true,
      layer: 2,
      name: "The Fixer",
      processingText: "identity patterns forming...",
    });
  });

  it("strips ```json prefix and ``` suffix", () => {
    const raw = '```json\n{"is_checkpoint":false,"layer":null,"name":null,"processing_text":"listening to themes..."}\n```';
    const result = cleanAndParseClassification(raw);
    expect(result.isCheckpoint).toBe(false);
    expect(result.processingText).toBe("listening to themes...");
  });

  it("strips ``` without json label", () => {
    const raw = '```\n{"is_checkpoint":true,"layer":3,"name":"The Shutdown","processing_text":"protective response..."}\n```';
    const result = cleanAndParseClassification(raw);
    expect(result.isCheckpoint).toBe(true);
    expect(result.layer).toBe(3);
    expect(result.name).toBe("The Shutdown");
  });

  it("coerces is_checkpoint to boolean", () => {
    const raw = '{"is_checkpoint":1,"layer":1,"name":"Test","processing_text":"x"}';
    const result = cleanAndParseClassification(raw);
    expect(result.isCheckpoint).toBe(true);
  });

  it("defaults processingText to 'listening...' when missing", () => {
    const raw = '{"is_checkpoint":false,"layer":null,"name":null}';
    const result = cleanAndParseClassification(raw);
    expect(result.processingText).toBe("listening...");
  });

  it("defaults processingText to 'listening...' when empty string", () => {
    const raw = '{"is_checkpoint":false,"layer":null,"name":null,"processing_text":""}';
    const result = cleanAndParseClassification(raw);
    expect(result.processingText).toBe("listening...");
  });

  it("invalidates checkpoint when layer is null", () => {
    const raw = '{"is_checkpoint":true,"layer":null,"name":"Test","processing_text":"x"}';
    const result = cleanAndParseClassification(raw);
    expect(result.isCheckpoint).toBe(false);
  });

  it("preserves null values for name", () => {
    const raw = '{"is_checkpoint":false,"processing_text":"tracking..."}';
    const result = cleanAndParseClassification(raw);
    expect(result.name).toBeNull();
    expect(result.layer).toBeNull();
  });

  it("throws on completely invalid JSON", () => {
    expect(() => cleanAndParseClassification("not json at all")).toThrow();
  });
});

describe("classifyResponse (mocked API)", () => {
  it("returns FALLBACK on API failure", async () => {
    vi.mock("@/lib/anthropic", () => ({
      anthropicFetch: vi.fn().mockRejectedValue(new Error("Network error")),
    }));

    // Dynamic import after mock is set up
    const { classifyResponse } = await import("@/lib/persona/classifier");
    const result = await classifyResponse("sage text", "recent text");
    expect(result).toEqual({
      isCheckpoint: false,
      layer: null,
      name: null,
      processingText: "listening...",
    });

    vi.restoreAllMocks();
  });
});
