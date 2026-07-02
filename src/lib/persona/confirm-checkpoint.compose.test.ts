import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the user-content string composeManualEntry sends to Opus so we can
// assert how the prompt is framed for the pushed vs. user-pulled paths.
let lastUserContent = "";
let lastSystem = "";

vi.mock("@/lib/anthropic", () => ({
  anthropicFetch: vi.fn(
    async (opts: {
      system?: string;
      messages: { role: string; content: string }[];
    }) => {
      lastUserContent = opts.messages[0]?.content ?? "";
      lastSystem = opts.system ?? "";
      return {};
    }
  ),
  // Return a valid composed-entry JSON so composeManualEntry parses, passes
  // the headline validator (I-subject + "when" trigger), and returns non-null.
  extractResponseText: () =>
    JSON.stringify({
      content:
        "I go still when input piles up faster than I can clear it, and the stillness reads as checking out.",
      name: "I go still when the room moves faster than I can clear it.",
      layer: 3,
      acknowledgment: "",
      changelog: "Created entry.",
      summary:
        "Goes still when input outpaces processing; the stillness is misread as checking out.",
      key_words: ["still", "input", "clear"],
    }),
}));

import {
  composeManualEntry,
  COMPOSER_ENTRY_BAR,
} from "@/lib/persona/confirm-checkpoint";

const baseOpts = {
  conversationHistory: [
    { role: "user" as const, content: "I went quiet in the standup again." },
    { role: "assistant" as const, content: "Quiet how?" },
    {
      role: "user" as const,
      content: "Behind my eyes. A pressure, like static building up.",
    },
  ],
  languageBank: [
    { phrase: "static building up", context: "meetings", charge: "high" },
  ],
  manualComponents: [],
};

describe("composeManualEntry — user-pulled framing", () => {
  beforeEach(() => {
    lastUserContent = "";
  });

  it("uses the user-pull framing (no Jove reflection block) when checkpointText is absent", async () => {
    const result = await composeManualEntry(baseOpts);

    expect(result).not.toBeNull();
    expect(lastUserContent).not.toContain("CHECKPOINT REFLECTION");
    expect(lastUserContent).toContain(
      "The user chose to capture a reflection"
    );
  });

  it("uses the Jove reflection block when checkpointText is provided", async () => {
    await composeManualEntry({
      ...baseOpts,
      checkpointText: "A specific Jove-drafted reflection paragraph.",
    });

    expect(lastUserContent).toContain("CHECKPOINT REFLECTION");
    expect(lastUserContent).toContain(
      "A specific Jove-drafted reflection paragraph."
    );
  });

  // Conductor pull path (pull-model Step 3): the conversation built the entry
  // in the open, so the body must REPRODUCE the most-recent user-approved
  // working version — not re-author it (the purpose-run card re-wrote the
  // approved draft back into a register the user rejected).
  it("uses the verbatim-anchor framing when anchorApprovedVersion is set", async () => {
    await composeManualEntry({ ...baseOpts, anchorApprovedVersion: true });

    expect(lastUserContent).toContain("THE BODY IS THAT APPROVED VERSION");
    expect(lastUserContent).toContain("the user's latest corrections always beat earlier drafts");
    expect(lastUserContent).not.toContain("there is no pre-drafted reflection to polish");
  });

  it("anchor framing is OFF by default for the normal pull path", async () => {
    await composeManualEntry(baseOpts);
    expect(lastUserContent).not.toContain("THE BODY IS THAT APPROVED VERSION");
  });
});

describe("composeManualEntry — editable entry-voice (THE BAR)", () => {
  beforeEach(() => {
    lastSystem = "";
  });

  it("uses the shipped COMPOSER_ENTRY_BAR by default", async () => {
    await composeManualEntry(baseOpts);
    expect(lastSystem).toContain("THE BAR — what makes an entry land");
    expect(lastSystem).toContain(COMPOSER_ENTRY_BAR);
  });

  it("substitutes an admin override and drops the default standard", async () => {
    await composeManualEntry({
      ...baseOpts,
      entryBarOverride: "THE BAR — custom standard: make every line sing.",
    });
    expect(lastSystem).toContain("custom standard: make every line sing");
    expect(lastSystem).not.toContain(
      "how did it see that. I never put it together that way"
    );
  });

  it("falls back to the default when the override is blank", async () => {
    await composeManualEntry({ ...baseOpts, entryBarOverride: "   " });
    expect(lastSystem).toContain(COMPOSER_ENTRY_BAR);
  });

  it("keeps the locked structure + safety rules regardless of the override", async () => {
    await composeManualEntry({
      ...baseOpts,
      entryBarOverride: "THE BAR — custom.",
    });
    // Output schema, section assignment, and the no-clinical-names safety rule
    // stay in code — an override can't reach them.
    expect(lastSystem).toContain("Respond with ONLY valid JSON");
    expect(lastSystem).toContain("No clinical framework names");
    expect(lastSystem).toContain('SECTION (field: "section")');
  });
});
