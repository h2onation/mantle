import { describe, it, expect } from "vitest";
import {
  getVoiceOverrides,
  isVoiceOverrideKey,
  VOICE_OVERRIDE_FIELDS,
} from "./voice-overrides";

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
        data: [{ key: "conductor_prompt", text_override: "NEW PROMPT", enabled: true }],
      }),
    );
    expect(out.conductorPrompt).toBe("NEW PROMPT");
  });

  it("ignores a disabled row (falls back to the code default at the call site)", async () => {
    const out = await getVoiceOverrides(
      adminStub({
        data: [{ key: "conductor_prompt", text_override: "NEW PROMPT", enabled: false }],
      }),
    );
    expect(out.conductorPrompt).toBeUndefined();
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
          { key: "conductor_prompt", text_override: "C", enabled: true },
          { key: "situation_opener", text_override: "S", enabled: true },
          { key: "post_confirm_first_entry", text_override: "P", enabled: true },
        ],
      }),
    );
    expect(out).toEqual({
      conductorPrompt: "C",
      situationOpener: "S",
      postConfirmFirstEntry: "P",
    });
  });
});

describe("isVoiceOverrideKey", () => {
  it("accepts known keys, rejects everything else", () => {
    expect(isVoiceOverrideKey("conductor_prompt")).toBe(true);
    expect(isVoiceOverrideKey("rebuilt_character")).toBe(false); // retired 2026-07-06
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

// The conductor_prompt override replaces the whole tier1 block — the one
// resolution site that matters. Pinned here so the admin edit path can never
// silently stop applying.
describe("conductor prompt override at the tier1 resolution site", () => {
  it("tier1 is the override when set, CONDUCTOR_PROMPT when absent", async () => {
    const { buildSystemPromptBlocks } = await import(
      "@/lib/persona/system-prompt"
    );
    const { CONDUCTOR_PROMPT } = await import(
      "@/lib/persona/conductor-prompt"
    );
    const base = {
      kind: "oneOnOne" as const,
      manualComponents: [],
      currentConversationId: null,
      isReturningUser: false,
      sessionSummary: null,
      isFirstCheckpoint: false,
      turnCount: 1,
    };
    const withoutOverride = buildSystemPromptBlocks(base);
    expect(withoutOverride.tier1).toBe(CONDUCTOR_PROMPT);

    const withOverride = buildSystemPromptBlocks({
      ...base,
      voiceOverrides: { conductorPrompt: "EDITED PROMPT" },
    });
    expect(withOverride.tier1).toBe("EDITED PROMPT");
  });
});
