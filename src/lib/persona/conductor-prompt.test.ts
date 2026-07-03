import { describe, it, expect } from "vitest";
import { buildSystemPromptBlocks } from "@/lib/persona/system-prompt";

// Guard tests for the conductor variant (the pull-model prompt, admin-scoped via
// the `conductor` feature gate). These pin the safety layer, the no-Jove-saves
// contract, the landed markers, and the deliberate ABSENCE of cross-domain
// MECHANICS / Tier-3 blocks the conductor's "don't leave a live moment" rule
// would fight. (Extracted from the retired baseline-experiment.test.ts,
// 2026-07-02, when the strip-to-baseline experiment was torn down.)
describe("conductor variant — guard tests", () => {
  const renderConductor = () => {
    const b = buildSystemPromptBlocks({
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "c",
      isReturningUser: false,
      sessionSummary: null,
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnCount: 1,
      checkpointApproaching: false,
      personaModes: ["general"],
      mode: "situation",
      priorCheckpointSuppressed: false,
      voiceVariant: "conductor",
      voiceOverrides: {},
    });
    return b.tier1 + b.staticContext + b.dynamic;
  };

  it("carries the 988 crisis clause verbatim (the prompt-side safety layer)", () => {
    const full = renderConductor();
    expect(full).toContain("The one exception — crisis. This never bends.");
    expect(full).toContain("988");
    expect(full).toContain("741741");
    // The non-negotiable-trigger examples from REBUILT_LIMITS #2, verbatim.
    expect(full).toContain("I don't see the point anymore");
    expect(full).toContain("everyone would be better off without me");
  });

  it("v0.6: Jove never triggers saves — no save phrase, no push contract", () => {
    const full = renderConductor();
    // The pull-model redesign: the detector's trigger phrase must be ABSENT
    // from the prompt (the user saves from the reflection bar; Jove-triggered
    // saves were the whack-a-mole failure). If this reappears, the v0.5.1
    // revert block leaked back into the live template.
    expect(full).not.toContain("I want to put something in your Manual");
    expect(full).not.toContain("followed by the entry exactly as you built it together");
    // The one-time landed acknowledgment replaces the save offer.
    expect(full).toContain("That's yours now, in your words — whenever you want it");
    // Never-announce discipline survives inside "When it's landed".
    expect(full).toContain("never say you're saving, writing, or putting anything down");
  });

  it("carries the v0.5 landed markers, after-save rule, and v0.6 cadence/opener guards", () => {
    const full = renderConductor();
    expect(full).toContain("How you know there's more — and when it's landed");
    expect(full).toContain('"Ok" is not landed');
    expect(full).toContain("## After a save");
    expect(full).toContain("Never say nothing was saved");
    // v0.6 additions
    expect(full).toContain("Check in only when something CHANGED");
    expect(full).toContain("Never start two turns in a row the same way");
  });

  it("landed line publishes the ---reflection-ready--- marker (the meter's ONLY ready source)", () => {
    const full = renderConductor();
    // The marker instruction must live in "When it's landed" and be scoped to
    // the landed message only. If this clause disappears, the strip can never
    // appear under the conductor — miss direction is late/never, by design.
    expect(full).toContain("---reflection-ready---");
    expect(full).toContain(
      "Use it only on the message where you say it's theirs, never earlier"
    );
  });

  it("Step 4: the post-save turn offers the three paths via the chips marker", () => {
    const full = renderConductor();
    expect(full).toContain("---chips---");
    expect(full).toContain("Start somewhere new");
    expect(full).toContain("Keep this thread going");
    expect(full).toContain("Take a break");
    // Keep-going must be specific; break must not fake a reminder.
    expect(full).toContain("a real loose end from the conversation");
    expect(full).toContain("Don't promise a reminder");
    // 2-for-2 live miss (2026-07-02): the model resumed its open question
    // instead of offering the chips. The clause makes them compatible — the
    // open question IS the keep-going path.
    expect(full).toContain("Offer the chips even when you left a question open");
  });

  it("contains NO cross-domain / second-instance instruction and no MECHANICS", () => {
    const full = renderConductor();
    // The REBUILT_MECHANICS lines the conductor's "don't leave a live moment"
    // rule would fight — none may appear.
    expect(full).not.toContain("holds anywhere else");
    expect(full).not.toContain("across more than this one moment");
    expect(full).not.toContain("different person or part of life");
    expect(full).not.toContain("MECHANICS — how Manual entries get made");
    // And no Tier-3 blocks (situation opener, guided spine, etc.).
    expect(full).not.toContain("---sections---");
  });
});
