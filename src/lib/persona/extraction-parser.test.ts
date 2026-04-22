import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the anthropic module BEFORE importing extraction so the spy is
// installed before runExtraction binds the dependency.
vi.mock("@/lib/anthropic", () => ({
  anthropicFetch: vi.fn(),
}));

import { anthropicFetch } from "@/lib/anthropic";
import { runExtraction } from "@/lib/persona/extraction";

// Minimal valid extraction JSON the LLM might return. Tests override
// `emerging_pattern_snippet` per case to validate parser resilience.
const baseJson = {
  layers: {
    "1": { signal: "none", material: [], examples: [], dimensions: [] },
    "2": { signal: "none", material: [], examples: [], dimensions: [] },
    "3": { signal: "none", material: [], examples: [], dimensions: [] },
    "4": { signal: "none", material: [], examples: [], dimensions: [] },
    "5": { signal: "none", material: [], examples: [], dimensions: [] },
  },
  language_bank: [],
  depth: "surface",
  current_thread: "",
  mode: "situation_led",
  checkpoint_gate: {
    concrete_examples: 0,
    has_mechanism: false,
    has_charged_language: false,
    has_behavior_driver_link: false,
    strongest_layer: null,
  },
  clinical_flag: { active: false, level: "none", note: "" },
  observation_miss_count: 0,
  early_frame_delivered: false,
  depth_signal_delivered: false,
  approaching_signal_delivered: false,
  next_prompt: "",
  sage_brief: "",
};

function mockLLMReturns(payload: Record<string, unknown>) {
  vi.mocked(anthropicFetch).mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(payload) }],
  });
}

const dummyHistory = [{ role: "user" as const, content: "hi" }];

describe("runExtraction — emerging_pattern_snippet parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves a normal string snippet", async () => {
    mockLLMReturns({
      ...baseJson,
      emerging_pattern_snippet: "how control and trust show up together",
    });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBe(
      "how control and trust show up together"
    );
  });

  it("returns null when the LLM emits null", async () => {
    mockLLMReturns({ ...baseJson, emerging_pattern_snippet: null });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
  });

  it("returns null when the LLM omits the field entirely", async () => {
    mockLLMReturns({ ...baseJson });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
  });

  it("returns null on empty string", async () => {
    mockLLMReturns({ ...baseJson, emerging_pattern_snippet: "" });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
  });

  it("returns null on whitespace-only string", async () => {
    mockLLMReturns({
      ...baseJson,
      emerging_pattern_snippet: "   \n\t  ",
    });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
  });

  it("returns null on non-string number", async () => {
    mockLLMReturns({ ...baseJson, emerging_pattern_snippet: 42 });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
  });

  it("returns null on non-string nested object", async () => {
    mockLLMReturns({
      ...baseJson,
      emerging_pattern_snippet: { nested: "object" },
    });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
  });

  it("trims surrounding whitespace from a valid snippet", async () => {
    mockLLMReturns({
      ...baseJson,
      emerging_pattern_snippet: "  the way you brace before people speak  ",
    });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBe(
      "the way you brace before people speak"
    );
  });

  it("preserves a snippet at the 40-word boundary", async () => {
    const fortyWords = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    mockLLMReturns({
      ...baseJson,
      emerging_pattern_snippet: fortyWords,
    });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBe(fortyWords);
  });

  it("rejects (returns null) and logs when snippet exceeds 40 words", async () => {
    const fortyOneWords = Array.from(
      { length: 41 },
      (_, i) => `w${i}`
    ).join(" ");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockLLMReturns({
      ...baseJson,
      emerging_pattern_snippet: fortyOneWords,
    });
    const result = await runExtraction(dummyHistory, null, [], false);
    expect(result.emerging_pattern_snippet).toBeNull();
    // Verify the rejection is logged so we can spot frequency in
    // production. Assert on the prefix only — exact format is not the
    // contract here, just that something is logged.
    expect(errSpy).toHaveBeenCalled();
    const logged = errSpy.mock.calls[0]?.join(" ") ?? "";
    expect(logged).toContain("emerging_pattern_snippet");
    expect(logged).toContain("40");
    errSpy.mockRestore();
  });
});
