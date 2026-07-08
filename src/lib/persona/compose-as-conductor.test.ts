import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture what composeEntryAsConductor sends to Opus so we can assert it runs
// AS the conductor (its own system prompt) with the full conversation + a final
// write-the-entry instruction.
let lastSystem: unknown = null;
let lastMessages: { role: string; content: string }[] = [];

vi.mock("@/lib/anthropic", () => ({
  anthropicFetch: vi.fn(
    async (opts: {
      system?: unknown;
      messages: { role: string; content: string }[];
    }) => {
      lastSystem = opts.system;
      lastMessages = opts.messages;
      return {};
    }
  ),
  extractResponseText: () =>
    JSON.stringify({
      content:
        "I go quiet when the room moves faster than I can clear it, and the quiet reads as checking out.",
      name: "I go quiet when the room moves faster than I can clear it.",
      section: "sensory-burnout",
      changelog: "Created entry.",
      summary:
        "Goes quiet when input outpaces processing; the quiet is misread as checking out.",
      key_words: ["quiet", "input", "clear"],
    }),
}));

import { composeEntryAsConductor } from "@/lib/persona/compose-as-conductor";
import type { ConversationContext } from "@/lib/persona/persona-pipeline";

function makeCtx(
  overrides: Partial<ConversationContext> = {}
): ConversationContext {
  return {
    messages: [
      { role: "user", content: "I went quiet in the standup again." },
      { role: "assistant", content: "Quiet how?" },
      { role: "user", content: "Behind my eyes. Static building up." },
    ],
    manualComponents: [],
    previousExtraction: null,
    sessionSummary: null,
    isReturningUser: false,
    isFirstCheckpoint: true,
    sessionCount: 1,
    turnsSinceCheckpoint: 0,
    conversationId: "conv-1",
    turnCount: 3,
    personaModes: [],
    mode: "situation",
    reflectionMeterEnabled: true,
    extractionEnabled: true,
    voiceOverrides: {},
    reflectionLanded: true,
    ...overrides,
  };
}

const systemText = (system: unknown): string =>
  Array.isArray(system)
    ? (system as { text: string }[]).map((b) => b.text).join("\n")
    : String(system);

describe("composeEntryAsConductor", () => {
  beforeEach(() => {
    lastSystem = null;
    lastMessages = [];
  });

  it("runs as the conductor — its own voice is the system prompt", async () => {
    await composeEntryAsConductor(makeCtx());
    // The conductor prompt (conductor-prompt.ts) opens with "You are Jove."
    expect(systemText(lastSystem)).toContain("You are Jove.");
  });

  it("replays the full conversation and appends the write instruction last", async () => {
    await composeEntryAsConductor(makeCtx());
    // Conversation turns are all present, in order, before the instruction.
    expect(lastMessages.length).toBe(4);
    expect(lastMessages[0]).toEqual({
      role: "user",
      content: "I went quiet in the standup again.",
    });
    const final = lastMessages[lastMessages.length - 1];
    expect(final.role).toBe("user");
    expect(final.content).toContain("write it down as their Manual entry");
    expect(final.content).toContain("Output ONLY the JSON");
    // The shared entry spec rides in the instruction (one source of truth).
    expect(final.content).toContain("name (the TITLE)");
  });

  it("returns the finalized entry, guards applied", async () => {
    const result = await composeEntryAsConductor(makeCtx());
    expect(result).not.toBeNull();
    expect(result?.section).toBe("sensory-burnout");
    expect(result?.name).toContain("I go quiet");
  });

  it("honors an entry-bar override in the instruction", async () => {
    await composeEntryAsConductor(makeCtx(), {
      entryBarOverride: "THE BAR — custom: make every line sing.",
    });
    const final = lastMessages[lastMessages.length - 1];
    expect(final.content).toContain("custom: make every line sing");
  });
});
