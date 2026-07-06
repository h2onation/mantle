import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildSystemPromptBlocks,
  type OneOnOnePromptOptions,
} from "@/lib/persona/system-prompt";
import { CONDUCTOR_PROMPT } from "@/lib/persona/conductor-prompt";

// The rebuilt/legacy three-tier voice this suite used to exercise (Tier 1
// constitutional rules, composeTier2 voice assembly, the Tier 3 conversation-
// mechanics ladder, and the per-persona voice content) was retired 2026-07-06.
// The live 1:1 voice is the conductor prompt (conductor-prompt.ts), which is
// self-contained. What survives from the old builder — and what this suite now
// pins — is the wrapper behavior around that prompt: the conductor lands in
// tier1, Manual entries split into recent (full, dynamic) vs older (compressed,
// staticContext), the static block stays byte-identical for the prompt cache,
// and returning-user session context renders. Voice-content coverage lives in
// conductor-prompt.test.ts.

const defaults: OneOnOnePromptOptions = {
  kind: "oneOnOne",
  manualComponents: [],
  currentConversationId: "test-conversation-id",
  isReturningUser: false,
  sessionSummary: null,
  isFirstCheckpoint: false,
  turnCount: 5,
};

function build(overrides: Partial<OneOnOnePromptOptions> = {}) {
  return buildSystemPrompt({ ...defaults, ...overrides });
}

function buildBlocks(overrides: Partial<OneOnOnePromptOptions> = {}) {
  return buildSystemPromptBlocks({ ...defaults, ...overrides });
}

describe("buildSystemPrompt (1:1 conductor path)", () => {
  describe("conductor prompt is the voice", () => {
    it("opens with the conductor's 'You are Jove' line", () => {
      expect(build()).toContain("You are Jove");
    });

    it("tier1 is exactly CONDUCTOR_PROMPT", () => {
      expect(buildBlocks().tier1).toBe(CONDUCTOR_PROMPT);
    });

    it("carries no retired three-tier voice markers", () => {
      const result = build();
      expect(result).not.toContain("TIER 1: CONSTITUTIONAL RULES");
      expect(result).not.toContain("TIER 2: VOICE AND BEHAVIOR");
      expect(result).not.toContain("TIER 3: CONVERSATION MECHANICS");
    });

    it("the flat builder equals tier1 + staticContext + dynamic joined", () => {
      const opts = {
        ...defaults,
        isReturningUser: true,
        sessionCount: 2,
        sessionSummary: "Explored X.",
        currentConversationId: "conv-current",
        manualComponents: [
          {
            layer: 1,
            name: "Fresh",
            content: "Fresh content.",
            source_conversation_id: "conv-current",
            created_at: "2026-04-15T12:00:00Z",
          },
        ],
      };
      const blocks = buildSystemPromptBlocks(opts);
      expect(buildSystemPrompt(opts)).toBe(
        blocks.tier1 + blocks.staticContext + blocks.dynamic,
      );
    });
  });

  // ─── Manual entries ────────────────────────────────────────────────────────
  describe("manual entries", () => {
    it("renders no CONFIRMED MANUAL block when there are no entries", () => {
      const result = build({ manualComponents: [] });
      expect(result).not.toContain("CONFIRMED MANUAL");
    });

    it("renders CONFIRMED MANUAL with the entry content when entries exist", () => {
      const result = build({
        manualComponents: [
          {
            section: "relationships",
            name: "Autonomy Drive",
            content: "You need control over your own direction.",
          },
        ],
      });
      expect(result).toContain("CONFIRMED MANUAL");
      expect(result).toContain("You need control over your own direction.");
    });

    it("includes the entry name in quotes when present", () => {
      const result = build({
        manualComponents: [
          { section: "work-money", name: "The Fixer", content: "Some content" },
        ],
      });
      expect(result).toContain('"The Fixer"');
    });

    it("does not emit stray quotes or 'null' when the entry name is null", () => {
      const result = build({
        manualComponents: [
          { section: "routines-structure", name: null, content: "Pattern content" },
        ],
      });
      expect(result).not.toContain('"null"');
    });
  });

  // ─── Session context (returning users) ──────────────────────────────────────
  describe("session context", () => {
    it("renders SESSION CONTEXT / Returning user when isReturningUser is true", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("SESSION CONTEXT");
      expect(result).toContain("Returning user");
    });

    it("omits SESSION CONTEXT when isReturningUser is false", () => {
      expect(build({ isReturningUser: false })).not.toContain("SESSION CONTEXT");
    });

    it("names the session number when sessionCount > 1", () => {
      const result = build({ isReturningUser: true, sessionCount: 4 });
      expect(result).toContain("This is session 4");
    });

    it("threads the session summary when provided", () => {
      const result = build({
        isReturningUser: true,
        sessionSummary: "Explored conflict avoidance patterns.",
      });
      expect(result).toContain("Earlier in this conversation:");
      expect(result).toContain("Explored conflict avoidance patterns.");
    });
  });
});

// ─── buildSystemPromptBlocks (prompt-cache split) ─────────────────────────────
describe("buildSystemPromptBlocks — cache-aware split", () => {
  it("returns three string blocks; a fresh user's static + dynamic are empty", () => {
    const blocks = buildBlocks();
    expect(typeof blocks.tier1).toBe("string");
    expect(typeof blocks.staticContext).toBe("string");
    expect(typeof blocks.dynamic).toBe("string");
    expect(blocks.tier1.length).toBeGreaterThan(0);
    // No Manual entries and a non-returning user ⇒ nothing to append.
    expect(blocks.staticContext).toBe("");
    expect(blocks.dynamic).toBe("");
  });

  it("recent Manual entries land in dynamic, not staticContext", () => {
    const blocks = buildBlocks({
      currentConversationId: "conv-current",
      manualComponents: [
        {
          layer: 1,
          name: "Fresh Pattern",
          content: "Current session content here.",
          source_conversation_id: "conv-current",
          created_at: "2026-04-15T12:00:00Z",
        },
      ],
    });
    expect(blocks.dynamic).toContain("Current session content here.");
    expect(blocks.dynamic).toContain('"Fresh Pattern"');
    expect(blocks.staticContext).not.toContain("Current session content here.");
    expect(blocks.staticContext).not.toContain('"Fresh Pattern"');
  });

  it("older (compressed) Manual entries land in staticContext, not dynamic", () => {
    const blocks = buildBlocks({
      currentConversationId: "conv-current",
      manualComponents: Array.from({ length: 6 }, (_, i) => ({
        layer: 1,
        name: `Old Entry ${i}`,
        content: `Old content ${i}`,
        summary: `Summary for entry ${i}.`,
        key_words: [`kw${i}a`, `kw${i}b`],
        source_conversation_id: "conv-old",
        created_at: `2026-01-${(i + 1).toString().padStart(2, "0")}T00:00:00Z`,
      })),
    });
    expect(blocks.staticContext).toContain("EARLIER ENTRIES (compressed");
    expect(blocks.dynamic).not.toContain("EARLIER ENTRIES (compressed");
    expect(blocks.staticContext).toContain("Summary for entry 0.");
    expect(blocks.dynamic).not.toContain("Summary for entry 0.");
  });

  it("staticContext is byte-identical across calls with the same inputs (cache pre-req)", () => {
    // Anthropic caches by prefix-byte identity. If the static block differs
    // even by a character, the cache miss-rate is 100%.
    const opts: OneOnOnePromptOptions = {
      ...defaults,
      currentConversationId: "conv-cache-stability",
      isReturningUser: true,
      manualComponents: [
        {
          layer: 1,
          name: "Persistent",
          content: "Persistent content",
          summary: "Persistent summary.",
          key_words: ["a", "b"],
          source_conversation_id: "conv-old",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          layer: 2,
          name: "Persistent 2",
          content: "Persistent content 2",
          summary: "Persistent 2 summary.",
          key_words: ["c", "d"],
          source_conversation_id: "conv-old",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      turnCount: 7,
      sessionCount: 4,
    };
    const a = buildSystemPromptBlocks(opts);
    const b = buildSystemPromptBlocks(opts);
    expect(a.tier1).toBe(b.tier1);
    expect(a.staticContext).toBe(b.staticContext);
  });

  it("staticContext is identical across turnCount changes (per-turn state does not affect the cache prefix)", () => {
    const turn1 = buildBlocks({ turnCount: 1, isReturningUser: false });
    const turn7 = buildBlocks({ turnCount: 7, isReturningUser: false });
    expect(turn1.staticContext).toBe(turn7.staticContext);
  });
});
