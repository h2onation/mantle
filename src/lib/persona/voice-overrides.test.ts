import { describe, it, expect } from "vitest";
import {
  getVoiceOverrides,
  isVoiceOverrideKey,
  VOICE_OVERRIDE_FIELDS,
} from "./voice-overrides";
import { REBUILT_CHARACTER } from "./voice-scaffold";
import { buildSystemPromptBlocks, type OneOnOnePromptOptions } from "./system-prompt";

// A minimal stub of the admin client's `.from(...).select(...)` shape.
function adminStub(result: {
  data?: unknown;
  error?: unknown;
  throws?: boolean;
}) {
  return {
    from: () => ({
      select: () => {
        if (result.throws) throw new Error("db down");
        return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
      },
    }),
  } as unknown as Parameters<typeof getVoiceOverrides>[0];
}

describe("getVoiceOverrides — resolver contract", () => {
  it("returns {} (all code defaults) when the table is empty", async () => {
    const out = await getVoiceOverrides(adminStub({ data: [] }));
    expect(out).toEqual({});
  });

  it("returns {} on a DB error (fail-open to code defaults)", async () => {
    const out = await getVoiceOverrides(adminStub({ error: { message: "boom" } }));
    expect(out).toEqual({});
  });

  it("returns {} when the read throws (fail-open)", async () => {
    const out = await getVoiceOverrides(adminStub({ throws: true }));
    expect(out).toEqual({});
  });

  it("maps an enabled row to its field", async () => {
    const out = await getVoiceOverrides(
      adminStub({
        data: [{ key: "rebuilt_character", text_override: "NEW VOICE", enabled: true }],
      }),
    );
    expect(out.character).toBe("NEW VOICE");
  });

  it("ignores a disabled row (falls back to the code default at the call site)", async () => {
    const out = await getVoiceOverrides(
      adminStub({
        data: [{ key: "rebuilt_character", text_override: "NEW VOICE", enabled: false }],
      }),
    );
    expect(out.character).toBeUndefined();
  });

  it("ignores an enabled-but-empty override (whitespace only)", async () => {
    const out = await getVoiceOverrides(
      adminStub({
        data: [{ key: "situation_opener", text_override: "   ", enabled: true }],
      }),
    );
    expect(out.situationOpener).toBeUndefined();
  });

  it("ignores an unknown key", async () => {
    const out = await getVoiceOverrides(
      adminStub({
        data: [{ key: "not_a_real_key", text_override: "x", enabled: true }],
      }),
    );
    expect(out).toEqual({});
  });

  it("maps all three known keys to their fields", async () => {
    const out = await getVoiceOverrides(
      adminStub({
        data: [
          { key: "rebuilt_character", text_override: "C", enabled: true },
          { key: "situation_opener", text_override: "S", enabled: true },
          { key: "post_confirm_first_entry", text_override: "P", enabled: true },
        ],
      }),
    );
    expect(out).toEqual({
      character: "C",
      situationOpener: "S",
      postConfirmFirstEntry: "P",
    });
  });
});

describe("isVoiceOverrideKey", () => {
  it("accepts known keys, rejects everything else", () => {
    expect(isVoiceOverrideKey("rebuilt_character")).toBe(true);
    expect(isVoiceOverrideKey("post_confirm_first_entry")).toBe(true);
    expect(isVoiceOverrideKey("nope")).toBe(false);
    expect(isVoiceOverrideKey(42)).toBe(false);
    expect(isVoiceOverrideKey(undefined)).toBe(false);
  });

  it("every field spec resolves a non-empty code default", () => {
    for (const spec of Object.values(VOICE_OVERRIDE_FIELDS)) {
      expect(spec.getDefault().trim().length).toBeGreaterThan(0);
    }
  });
});

describe("system prompt applies voice overrides at resolution sites", () => {
  const base: OneOnOnePromptOptions = {
    kind: "oneOnOne",
    manualComponents: [],
    currentConversationId: null,
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: true,
    turnCount: 1,
    checkpointApproaching: false,
    mode: "situation",
    voiceVariant: "rebuilt",
  };

  it("uses REBUILT_CHARACTER when no override is present", () => {
    const blocks = buildSystemPromptBlocks(base);
    expect(blocks.tier1).toBe(REBUILT_CHARACTER);
  });

  it("substitutes the CHARACTER override into tier1", () => {
    const blocks = buildSystemPromptBlocks({
      ...base,
      voiceOverrides: { character: "OVERRIDDEN CHARACTER BLOCK" },
    });
    expect(blocks.tier1).toBe("OVERRIDDEN CHARACTER BLOCK");
  });

  it("substitutes the situation-opener override into the first-message block", () => {
    const blocks = buildSystemPromptBlocks({
      ...base,
      voiceOverrides: { situationOpener: "BRING ME A THING, OVERRIDDEN." },
    });
    expect(blocks.dynamic).toContain("BRING ME A THING, OVERRIDDEN.");
  });
});
