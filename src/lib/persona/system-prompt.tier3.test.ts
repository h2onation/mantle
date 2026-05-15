import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import type { OneOnOnePromptOptions } from "@/lib/persona/system-prompt";

// Byte-level snapshot coverage for Tier 3 block assembly. These pin the
// exact text the prompt produces for each block-firing combination so a
// data-driven Tier 3 refactor can prove it preserves output exactly.
//
// Each test isolates a target block (or block group) by picking the
// smallest input combo that fires it. The snapshot captures only the
// Tier 3 region (between the Tier 3 header and the start of the dynamic
// CONFIRMED MANUAL block) so unrelated changes to Tier 1/Tier 2/dynamic
// context blocks don't perturb these snapshots.

const TIER_3_START = "TIER 3: CONVERSATION MECHANICS";
const DYNAMIC_START = "\nCONFIRMED MANUAL\n";

function extractTier3(prompt: string): string {
  const start = prompt.indexOf(TIER_3_START);
  if (start < 0) throw new Error("Tier 3 header not found in prompt");
  const tail = prompt.slice(start);
  const dynamicIdx = tail.indexOf(DYNAMIC_START);
  if (dynamicIdx < 0) return tail;
  return tail.slice(0, dynamicIdx);
}

const defaults: OneOnOnePromptOptions = {
  kind: "oneOnOne",
  manualComponents: [],
  currentConversationId: "test-conversation-id",
  isReturningUser: false,
  sessionSummary: null,
  extractionContext: "",
  isFirstCheckpoint: false,
  turnCount: 5,
  checkpointApproaching: false,
};

function buildTier3Region(
  overrides: Partial<OneOnOnePromptOptions> = {}
): string {
  return extractTier3(buildSystemPrompt({ ...defaults, ...overrides }));
}

describe("buildTier3 — block-firing snapshots", () => {
  it("baseline (new user, mid-session, situation mode): only always-on blocks fire", () => {
    // Fires: header + adapting/short-answers + clinical-tail (with FIRST SESSION content branch)
    expect(buildTier3Region()).toMatchSnapshot();
  });

  it("first-message block fires when turnCount=0, new user, situation mode", () => {
    expect(buildTier3Region({ turnCount: 0 })).toMatchSnapshot();
  });

  it("guided-intake block fires when mode='guided-intake' (new user)", () => {
    expect(buildTier3Region({ mode: "guided-intake" })).toMatchSnapshot();
  });

  it("guided-intake block fires when mode='guided-intake' (returning user)", () => {
    expect(
      buildTier3Region({
        mode: "guided-intake",
        isReturningUser: true,
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
      }),
    ).toMatchSnapshot();
  });

  it("upload block fires when mode='upload' (new user)", () => {
    expect(buildTier3Region({ mode: "upload" })).toMatchSnapshot();
  });

  it("upload block fires when mode='upload' (returning user)", () => {
    expect(
      buildTier3Region({
        mode: "upload",
        isReturningUser: true,
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
      }),
    ).toMatchSnapshot();
  });

  it("returning-user main + first-turn-situation fire when isReturningUser=true, mode='situation' (checkpoints stay gated on checkpointApproaching)", () => {
    // Returning-user status alone no longer auto-loads the CHECKPOINTS
    // and POST-REJECTION blocks — those gate on checkpointApproaching
    // so Jove isn't primed to fire the transition line on a fresh
    // session before any material has surfaced.
    expect(
      buildTier3Region({
        isReturningUser: true,
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
      }),
    ).toMatchSnapshot();
  });

  it("returning-user main fires without first-turn-situation when mode='guided-intake' (checkpoints stay gated on checkpointApproaching)", () => {
    // The nested situation-only block must NOT fire under guided-intake.
    // CHECKPOINTS / POST-REJECTION also do not fire here because
    // checkpointApproaching defaults to false — see the situation-mode
    // sibling test above for the same gating rationale.
    expect(
      buildTier3Region({
        isReturningUser: true,
        mode: "guided-intake",
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
      }),
    ).toMatchSnapshot();
  });

  it("checkpoints + post-rejection fire for returning users only when checkpointApproaching=true", () => {
    // Regression guard for the gating-on-checkpointApproaching change:
    // a returning user WITH checkpointApproaching set should load the
    // checkpoint instruction blocks (combination of returning-user
    // first-turn-situation + checkpoints + post-rejection).
    expect(
      buildTier3Region({
        isReturningUser: true,
        checkpointApproaching: true,
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
      }),
    ).toMatchSnapshot();
  });

  it("checkpoints + post-rejection fire when checkpointApproaching=true (new user)", () => {
    expect(buildTier3Region({ checkpointApproaching: true })).toMatchSnapshot();
  });

  it("first-checkpoint fires when isFirstCheckpoint=true AND checkpointApproaching=true", () => {
    expect(
      buildTier3Region({
        isFirstCheckpoint: true,
        checkpointApproaching: true,
      }),
    ).toMatchSnapshot();
  });

  it("post-confirm first-message-2 fires when postConfirmMode='first-message-2'", () => {
    expect(
      buildTier3Region({ postConfirmMode: "first-message-2" }),
    ).toMatchSnapshot();
  });

  it("post-confirm subsequent-single fires when postConfirmMode='subsequent-single'", () => {
    expect(
      buildTier3Region({
        postConfirmMode: "subsequent-single",
        manualComponents: [{ layer: 1, name: "Existing", content: "Existing entry" }],
        isReturningUser: true,
      }),
    ).toMatchSnapshot();
  });

  it("readiness-gate fires when manualComponentCount >= 3 (with returning user)", () => {
    expect(
      buildTier3Region({
        isReturningUser: true,
        manualComponents: [
          { layer: 1, name: "A", content: "alpha" },
          { layer: 2, name: "B", content: "beta" },
          { layer: 3, name: "C", content: "gamma" },
        ],
      }),
    ).toMatchSnapshot();
  });

  it("'Not a first session' branch fires when user has confirmed entries", () => {
    expect(
      buildTier3Region({
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
      }),
    ).toMatchSnapshot();
  });

  it("all conditional blocks together: returning + checkpoint approaching + first checkpoint + readiness + situation mode", () => {
    // Fires the maximum set of blocks: returning-user main + returning-user
    // first-turn-situation + checkpoints + first-checkpoint + post-rejection
    // + readiness-gate + always-on + 'Not a first session' branch.
    expect(
      buildTier3Region({
        isReturningUser: true,
        isFirstCheckpoint: true,
        checkpointApproaching: true,
        manualComponents: [
          { layer: 1, name: "A", content: "alpha" },
          { layer: 2, name: "B", content: "beta" },
          { layer: 3, name: "C", content: "gamma" },
        ],
      }),
    ).toMatchSnapshot();
  });
});
