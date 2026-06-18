import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the user-content string composeManualEntry sends to Opus so we can
// assert how the prompt is framed for the pushed vs. user-pulled paths.
let lastUserContent = "";

vi.mock("@/lib/anthropic", () => ({
  anthropicFetch: vi.fn(
    async (opts: { messages: { role: string; content: string }[] }) => {
      lastUserContent = opts.messages[0]?.content ?? "";
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

import { composeManualEntry } from "@/lib/persona/confirm-checkpoint";

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
});
