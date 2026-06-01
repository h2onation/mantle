import { describe, it, expect } from "vitest";
import {
  TIER_3_BLOCKS,
  deriveTier3Flags,
  type Tier3FlagInput,
  type Tier3Flags,
} from "./system-prompt";

/**
 * Tier-3 prompt-injector guardrails ("smoke detectors").
 *
 * The prompt injector's failures are SILENT: a block whose gate can never be
 * satisfied, or whose copy contradicts the condition it renders under,
 * produces no error — Jove just quietly behaves wrong, invisibly. These guards
 * run over the REAL reachable flag domain — every flag combination the
 * producers can actually emit, run through the single source of truth
 * deriveTier3Flags, NOT hand-built flags. That is what lets them catch a
 * "wired but never produced" flag (the class that hid guidedPostureSoftened).
 *
 * See docs/audits/prompt-injector-2026-06-01.md.
 */

// deriveTier3Flags only reads `manualComponents.length`, so the contents are
// irrelevant. Indexed access avoids importing the internal ManualComponent type.
function fakeEntries(n: number): Tier3FlagInput["manualComponents"] {
  return Array.from({ length: n }, () => ({})) as Tier3FlagInput["manualComponents"];
}

// Reachable flag domain = the cartesian product of the axes the real producers
// (buildPromptOptionsFromContext + the route layer) can emit, each run through
// deriveTier3Flags. A flag no producer can vary is pinned to one value here, so
// the guards below catch it.
// A turn is in exactly one post-action state — the producers never set
// postConfirmMode and postRejection together.
const POST_TURN = [
  { postConfirmMode: null, postRejection: false },
  { postConfirmMode: "first-message-2", postRejection: false },
  { postConfirmMode: "subsequent-single", postRejection: false },
  { postConfirmMode: null, postRejection: true },
] as const;

function reachableFlagDomain(): Tier3Flags[] {
  const out: Tier3Flags[] = [];
  for (const isReturningUser of [true, false]) {
    for (const isFirstCheckpoint of [true, false]) {
      for (const checkpointApproaching of [true, false]) {
        for (const turnCount of [1, 2, 3, 4, 12]) {
          for (const len of [0, 1, 3, 5]) {
            for (const mode of ["situation", "guided-intake", "upload"] as const) {
              for (const pt of POST_TURN) {
                out.push(
                  deriveTier3Flags({
                    manualComponents: fakeEntries(len),
                    isReturningUser,
                    isFirstCheckpoint,
                    checkpointApproaching,
                    turnCount,
                    mode,
                    postConfirmMode: pt.postConfirmMode,
                    postRejection: pt.postRejection,
                  })
                );
              }
            }
          }
        }
      }
    }
  }
  return out;
}

const DOMAIN = reachableFlagDomain();

// Blocks intentionally rendered on every turn.
const ALWAYS_ON = ["adapting-short-answers", "clinical-and-tail"];

describe("G1 — every Tier 3 block is reachable (never-fires / dead-flag guard)", () => {
  for (const block of TIER_3_BLOCKS) {
    it(`"${block.id}" renders for at least one producible flag combination`, () => {
      const reachable = DOMAIN.some((f) => block.shouldRender(f));
      expect(
        reachable,
        `Block "${block.id}" never renders for any flag combination the producers can emit — its gate likely depends on a value no producer sets (a dead flag).`
      ).toBe(true);
    });
  }
});

describe("G5 — always-on blocks are exactly the allowlist (always-on-unintended guard)", () => {
  it("blocks that render under every combination equal the ALWAYS_ON allowlist", () => {
    const alwaysOn = TIER_3_BLOCKS.filter((b) => DOMAIN.every((f) => b.shouldRender(f))).map(
      (b) => b.id
    );
    expect(alwaysOn.sort()).toEqual([...ALWAYS_ON].sort());
  });

  for (const block of TIER_3_BLOCKS) {
    if (ALWAYS_ON.includes(block.id)) continue;
    it(`"${block.id}" is genuinely conditional (off for at least one combination)`, () => {
      expect(DOMAIN.some((f) => !block.shouldRender(f))).toBe(true);
    });
  }
});

describe("G7 — no dead flags: every produced flag value is reachable", () => {
  it("every boolean Tier3Flags field takes both true and false across the domain", () => {
    const seen: Record<string, Set<unknown>> = {};
    for (const flags of DOMAIN) {
      for (const [key, value] of Object.entries(flags)) {
        (seen[key] ??= new Set<unknown>()).add(value);
      }
    }
    const booleanKeys = Object.entries(DOMAIN[0])
      .filter(([, v]) => typeof v === "boolean")
      .map(([k]) => k);
    for (const key of booleanKeys) {
      expect(
        seen[key],
        `Flag "${key}" never varies across producible inputs — it may be a dead flag wired to a constant. Produce it or remove it.`
      ).toEqual(new Set([true, false]));
    }
  });

  it("every mode and postConfirmMode value is reachable", () => {
    expect(new Set(DOMAIN.map((f) => f.mode))).toEqual(
      new Set(["situation", "guided-intake", "upload"])
    );
    expect(new Set(DOMAIN.map((f) => f.postConfirmMode))).toEqual(
      new Set([null, "first-message-2", "subsequent-single"])
    );
  });
});

describe("G2 — copy contracts: no stale references, no overclaiming", () => {
  // Sections deleted/moved out of Tier 3; no block body may still point at them.
  const DELETED_SECTIONS = ["PROGRESS SIGNALS"];

  for (const block of TIER_3_BLOCKS) {
    it(`"${block.id}" cites no deleted section`, () => {
      const fired = DOMAIN.find((f) => block.shouldRender(f));
      expect(fired, `Block "${block.id}" never fires`).toBeDefined();
      const text = block.render(fired!);
      for (const section of DELETED_SECTIONS) {
        expect(text, `Block "${block.id}" references deleted section "${section}".`).not.toContain(
          section
        );
      }
    });
  }

  it("readiness-gate copy does not claim all five layers are populated (gate fires at 3+ entries, any layer)", () => {
    const block = TIER_3_BLOCKS.find((b) => b.id === "readiness-gate");
    expect(block).toBeDefined();
    const fired = DOMAIN.find((f) => block!.shouldRender(f))!;
    const text = block!.render(fired);
    expect(text).not.toMatch(/all 5 layers|Five layers, each/i);
  });
});

describe("G4 — post-action and checkpoint-proposal blocks never co-render (co-render-conflict guard)", () => {
  // A post-action turn (post-confirm follow-up or post-rejection) has a pinned
  // response; the checkpoint-proposal machinery would contradict it.
  const POST_ACTION = [
    "post-confirm-first-message-2",
    "post-confirm-subsequent-single",
    "post-rejection",
  ];
  const PROPOSAL = ["checkpoints", "first-checkpoint"];

  it("no producible flag combination renders a post-action block alongside a proposal block", () => {
    for (const flags of DOMAIN) {
      const rendered = new Set(
        TIER_3_BLOCKS.filter((b) => b.shouldRender(flags)).map((b) => b.id)
      );
      const hasPostAction = POST_ACTION.some((id) => rendered.has(id));
      const hasProposal = PROPOSAL.some((id) => rendered.has(id));
      expect(
        hasPostAction && hasProposal,
        `Post-action and checkpoint-proposal blocks co-render for ${JSON.stringify(
          flags
        )} — contradictory turn instructions.`
      ).toBe(false);
    }
  });
});
