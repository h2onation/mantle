import { describe, it, expect } from "vitest";
import {
  validateMaterialQuality,
  validateComposedEntry,
  applyCheckpointGates,
  reflectionMeterFill,
  deriveProposalFlags,
  deriveCheckpointApproaching,
  computeInheritedRefinementCount,
  buildEntriesSummary,
  buildPromptOptionsFromContext,
  resolveConversationMode,
  type ConversationContext,
} from "@/lib/persona/persona-pipeline";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { CHECKPOINT_TUNING_DEFAULTS } from "@/lib/persona/checkpoint-tuning";
import type { ExtractionState, LanguageEntry } from "@/lib/persona/extraction";

function makeExtractionState(
  overrides?: Partial<ExtractionState>
): ExtractionState {
  return {
    layers: {
      1: { signal: "none", material: [], examples: [] },
      2: { signal: "none", material: [], examples: [] },
      3: { signal: "none", material: [], examples: [] },
      4: { signal: "none", material: [], examples: [] },
      5: { signal: "none", material: [], examples: [] },
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
    sage_brief: "",
    emerging_pattern_snippet: null,
    pattern_engaged: false,
    user_named_cost: false,
    user_named_stance: false,
    ...overrides,
  };
}

// Lock 1 (ADR-043): the charged-material gate reads the real language_bank
// (>=1 high/medium phrase tagged to the candidate layer), not the
// has_charged_language boolean. Tests that need to pass that gate populate a
// real charged phrase tagged to the layer they set as strongest_layer.
function chargedBank(layer: number): LanguageEntry[] {
  return [
    {
      phrase: "my chest goes tight",
      context: "the moment it fires",
      charge: "high",
      layers: [layer],
    },
  ];
}

describe("validateMaterialQuality", () => {
  it("returns not ok when state is null (fail closed on missing material)", () => {
    // Lock 1 (ADR-043): missing extraction state can verify nothing, charged
    // material included, so it must read as not ripe. This assertion passes on
    // the fail-closed code and would fail against the old fail-open return —
    // the durable regression guard.
    const result = validateMaterialQuality(null, false);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/no extraction state/);
  });

  it("blocks during crisis regardless of other criteria", () => {
    const state = makeExtractionState({
      clinical_flag: { active: true, level: "crisis", note: "self-harm" },
      checkpoint_gate: {
        concrete_examples: 5,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toMatch(/crisis/i);
  });

  it("requires 2 scenes for the standard gate", () => {
    // Isolated to scene count: depth, engagement, and charged material all
    // satisfied so concrete_examples is the only failing variable.
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 1,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/concrete scenes/);
  });

  it("passes the charged-phrase gate when strongest_layer is a string '1' (2026-06-03 incident guard)", () => {
    // The extraction model emitted strongest_layer as the string "1" while
    // language_bank layers were numeric [1]. [1].includes("1") === false, so
    // the Lock-1 charged-phrase-on-layer check found nothing and suppressed
    // every otherwise-ready checkpoint — the doom loop. The consumer now
    // Number-coerces both sides. Reproduce the incident state exactly.
    const state = makeExtractionState({
      language_bank: chargedBank(1), // numeric layers [1]
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 5,
        distinct_contexts: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        // String layer id, exactly as the model emitted it in the incident.
        strongest_layer: "1" as unknown as number,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(true);
    expect(result.reasons.join(" ")).not.toMatch(/charged phrase/);
  });

  // The first-checkpoint lighter bar was retired 2026-06-12: one bar for
  // every checkpoint. These pins keep the flag from silently regaining
  // meaning — a first checkpoint must fail and pass exactly like any other.
  it("first checkpoint requires 2 scenes — 1 is not enough (lighter bar retired)", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 1,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, true);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/concrete scenes 1\/2/);
  });

  it("first checkpoint requires mechanism AND behavior-driver link, like every other", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: false,
        has_charged_language: true,
        has_behavior_driver_link: false,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, true);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/no mechanism/);
    expect(result.reasons.join(" ")).toMatch(/no behavior-driver link/);
  });

  it("standard gate passes when all four criteria are met", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(true);
  });

  // ADR-043 Decision 3 (reaffirmed ADR-045): distinct_contexts is a
  // STRENGTHENING signal, never a blocking gate. A single vivid scene in the
  // user's own charged language must be saveable. The code had drifted back to
  // a hard >=2 block (and iter 12 removed the first-checkpoint =1 escape);
  // realigned 2026-06-15. This pins it so the wall can't silently return.
  it("does NOT block on a single distinct context (ADR-043 Decision 3)", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 2,
        distinct_contexts: 1, // one deep scene
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(true);
    expect(result.reasons.join(" ")).not.toMatch(/distinct context/i);
  });

  // Regression: the CP2-shape failure. Even with full checklist (2+
  // examples, distinct contexts, mechanism flag, charged language, driver
  // link), the gate must block when conversation depth has not reached
  // the mechanism layer. The depth signal is a structural backstop in
  // case extraction's per-flag has_mechanism check is generous about
  // what counts as a user-articulated mechanism.
  it("blocks the standard gate when depth has not reached mechanism", () => {
    // Isolated to depth: scene count, contexts, mechanism, link, and charged
    // material all satisfied so depth is the only failing variable. Note the
    // charged phrase is tagged to layer 5 to match strongest_layer here.
    const state = makeExtractionState({
      language_bank: chargedBank(5),
      pattern_engaged: true,
      depth: "feeling",
      checkpoint_gate: {
        concrete_examples: 5,
        distinct_contexts: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 5,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/depth at feeling/);
    expect(result.reasons.join(" ")).toMatch(/need mechanism/);
  });

  // The first-checkpoint depth carve-out ("feeling is enough for a
  // teaching-moment entry") was retired 2026-06-12. First checkpoints
  // require mechanism depth like every other.
  it("first-checkpoint depth gate blocks at feeling and passes at mechanism", () => {
    const baseGate = {
      concrete_examples: 2,
      has_mechanism: true,
      has_charged_language: true,
      has_behavior_driver_link: true,
      strongest_layer: 1,
    };

    const atFeeling = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "feeling",
      checkpoint_gate: baseGate,
    });
    expect(validateMaterialQuality(atFeeling, true).ok).toBe(false);

    const atMechanism = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: baseGate,
    });
    expect(validateMaterialQuality(atMechanism, true).ok).toBe(true);
  });
});

// ─── Lock 1: the charged-material gate (ADR-043) ───────────────────────────
//
// Deterministic check over the real language_bank, replacing the
// has_charged_language boolean. A pattern is not ripe unless the bank carries
// a high/medium charged phrase the candidate pattern is built on — linked to
// strongest_layer, with an unlinked fallback when strongest_layer is null.
describe("validateMaterialQuality — charged-material gate (Lock 1)", () => {
  // Passes every standard-gate condition EXCEPT charged material, so each test
  // varies only the language_bank. distinct_contexts: 2 satisfies today's
  // cross-context gate (its removal is a separate ADR-043 Decision 3 build).
  function richExceptBank(
    strongestLayer: number | null,
    bank: LanguageEntry[]
  ): ExtractionState {
    return makeExtractionState({
      pattern_engaged: true,
      depth: "mechanism",
      language_bank: bank,
      checkpoint_gate: {
        concrete_examples: 2,
        distinct_contexts: 2,
        has_mechanism: true,
        has_charged_language: true, // field kept; no longer gated on
        has_behavior_driver_link: true,
        strongest_layer: strongestLayer,
      },
    });
  }

  const phrase = (
    charge: "low" | "medium" | "high",
    layers: number[]
  ): LanguageEntry => ({
    phrase: "my chest goes tight",
    context: "the moment it fires",
    charge,
    layers,
  });

  it("ripe when the bank has a high phrase on the candidate layer", () => {
    const result = validateMaterialQuality(
      richExceptBank(1, [phrase("high", [1])]),
      false
    );
    expect(result.ok).toBe(true);
  });

  it("ripe when the only charged phrase is medium (high|medium, not high-only)", () => {
    const result = validateMaterialQuality(
      richExceptBank(1, [phrase("medium", [1])]),
      false
    );
    expect(result.ok).toBe(true);
  });

  it("not ripe when the bank holds only low-charge phrases", () => {
    const result = validateMaterialQuality(
      richExceptBank(1, [phrase("low", [1])]),
      false
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/charged phrase/);
  });

  it("not ripe when the bank is empty", () => {
    const result = validateMaterialQuality(richExceptBank(1, []), false);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/charged phrase/);
  });

  it("not ripe when the only charged phrase is on a different layer (linked reading)", () => {
    // strongest_layer = 1, but the high phrase is tagged to layer 2.
    const result = validateMaterialQuality(
      richExceptBank(1, [phrase("high", [2])]),
      false
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/candidate layer 1/);
  });

  it("ripe for that same off-layer phrase under the unlinked fallback (strongest_layer null)", () => {
    // Paired with the test above: the unlinked fallback accepts any high/medium
    // phrase when no candidate layer has been resolved. Locks the chosen
    // linked-vs-unlinked behavior.
    const result = validateMaterialQuality(
      richExceptBank(null, [phrase("high", [2])]),
      false
    );
    expect(result.ok).toBe(true);
  });

  it("ripe under the unlinked fallback with any high/medium phrase (strongest_layer null)", () => {
    const result = validateMaterialQuality(
      richExceptBank(null, [phrase("high", [3])]),
      false
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateComposedEntry", () => {
  const goodEntry = `You walk into a room and a second version of you switches on. It watches faces, times the nods, keeps your voice at the right volume, softens the parts of you that would read as too much. You don't decide to do this. It runs. By the end of the day the buzzing starts in your jaw and your thoughts get slower. You lose the evening and you call it being tired. You can't stop running the second version because the real one got flagged as too much a long time ago. The cost is that almost nobody in your life has met the real one, including you on the days when you come home and go straight to the dark room.`;

  it("passes for a well-formed entry with body anchor", () => {
    const result = validateComposedEntry(goodEntry);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("does NOT warn on a lean entry (2026-06-16: the <80-word floor was removed)", () => {
    // The body is now focus-bounded, not length-bounded — a good lean entry can
    // land under 80 words. The old "too short" floor encoded the retired
    // force-it-long doctrine and would false-warn on these.
    const result = validateComposedEntry(
      "You shut down. Your jaw goes tight. That's it."
    );
    expect(result.warnings.join(" ")).not.toMatch(/too short/);
  });

  it("warns when entry exceeds the 150-word upper bound", () => {
    const tooLong = Array(200).fill("Your jaw goes tight").join(". ") + ".";
    const result = validateComposedEntry(tooLong);
    expect(result.ok).toBe(false);
    expect(result.warnings.join(" ")).toMatch(/too long/);
    expect(result.warnings.join(" ")).toMatch(/150/);
  });

  it("warns when entry has no somatic anchor word", () => {
    const cerebral = Array(160).fill("You think about it carefully").join(". ") + ".";
    const result = validateComposedEntry(cerebral);
    expect(result.warnings.join(" ")).toMatch(/no somatic anchor/);
  });

  it("warns when a clinical label leaks through", () => {
    const text = goodEntry + " This is your trauma response.";
    const result = validateComposedEntry(text);
    expect(result.warnings.join(" ")).toMatch(/clinical label/);
  });

  it("warns when a time reference leaks through", () => {
    const text = goodEntry + " Right now this is happening.";
    const result = validateComposedEntry(text);
    expect(result.warnings.join(" ")).toMatch(/time reference/);
  });
});

describe("applyCheckpointGates with material quality", () => {
  it("blocks a checkpoint when extraction state shows insufficient material", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 0,
        has_mechanism: false,
        has_charged_language: false,
        has_behavior_driver_link: false,
        strongest_layer: null,
      },
    });
    const result = applyCheckpointGates(
      10, // plenty of turns since last checkpoint
      state,
      false
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("permits the checkpoint when extraction state confirms quality", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = applyCheckpointGates(10, state, false);
    expect(result.passed).toBe(true);
  });

  it("still applies the turn-count gate after material quality passes", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = applyCheckpointGates(
      2, // too soon since last checkpoint
      state,
      false
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("turns since last");
  });

  it("preserves backward compatibility when extraction state is omitted", () => {
    const result = applyCheckpointGates(10);
    expect(result.passed).toBe(true);
  });
});

// ─── Checkpoint-instructions trigger (gate-mirror, 2026-05-15) ─────────────
//
// Regression: an 18-turn conversation with rich material (concrete scenes,
// body anchors, charged language, mechanism, behavior-driver link) never
// surfaced a checkpoint. Extraction's per-layer "signal" stayed at
// "emerging" while its checklist was full. The old gate only read the
// signal, so Jove never received the CHECKPOINTS instructions and just
// kept deepening. deriveCheckpointApproaching now reads both.
describe("deriveCheckpointApproaching", () => {
  it("returns false when extraction state is null (cold start)", () => {
    expect(deriveCheckpointApproaching(null, true, 0)).toBe(false);
    expect(deriveCheckpointApproaching(undefined, true, 0)).toBe(false);
  });

  // Signal-ready path fires only when charged material is tagged to the
  // signal-ready layer (ADR-043 amendment — signal alone no longer fires).
  // chargedBank(1) backs layer 1, the explored layer here.
  it("returns true when a layer signal is 'explored' and charged material backs it", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      layers: {
        1: { signal: "explored", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(state, true, 5)).toBe(true);
  });

  // Signal-ready path fires only when charged material is tagged to the
  // signal-ready layer (ADR-043 amendment). chargedBank(2) backs layer 2,
  // the checkpoint_ready layer here.
  it("returns true when a layer signal is 'checkpoint_ready' and charged material backs it", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(2),
      layers: {
        1: { signal: "none", material: [], examples: [] },
        2: {
          signal: "checkpoint_ready",
          material: [],
          examples: [],
        },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(state, true, 5)).toBe(true);
  });

  // The reported bug. Layer signal stuck at "emerging" while the checklist
  // is full — old code returned false here. New code consults the gate.
  it("returns true when checklist passes even if no layer signal beyond 'emerging'", () => {
    const state = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: true,
      depth: "mechanism",
      layers: {
        1: { signal: "emerging", material: [], examples: [] },
        2: { signal: "emerging", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    expect(deriveCheckpointApproaching(state, true, 8)).toBe(true);
  });

  // The original concern that motivated the signal-only gate: thin material
  // should NOT load CHECKPOINTS instructions just because the conversation
  // has been running a while. The checklist enforces this.
  it("returns false when both signal is 'emerging' and checklist is empty", () => {
    const state = makeExtractionState({
      pattern_engaged: false,
      layers: {
        1: { signal: "emerging", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
      checkpoint_gate: {
        concrete_examples: 0,
        has_mechanism: false,
        has_charged_language: false,
        has_behavior_driver_link: false,
        strongest_layer: null,
      },
    });
    expect(deriveCheckpointApproaching(state, true, 5)).toBe(false);
  });

  // The crisis path: even with rich material, never load CHECKPOINTS during
  // an active crisis. validateMaterialQuality enforces this; the gate-mirror
  // inherits it for free, which is the point of using the same function.
  it("returns false during an active crisis regardless of checklist", () => {
    const state = makeExtractionState({
      pattern_engaged: true,
      clinical_flag: { active: true, level: "crisis", note: "self-harm" },
      checkpoint_gate: {
        concrete_examples: 5,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    expect(deriveCheckpointApproaching(state, true, 12)).toBe(false);
  });

  // pattern_engaged=false blocks until turn 12. After 12, the override in
  // validateMaterialQuality kicks in if the rest of the checklist is full.
  it("respects the pattern_engaged turn-12 override from validateMaterialQuality", () => {
    const richButNotEngaged = makeExtractionState({
      language_bank: chargedBank(1),
      pattern_engaged: false,
      depth: "mechanism",
      layers: {
        1: { signal: "emerging", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    // Before turn 12: blocked by pattern_engaged=false
    expect(deriveCheckpointApproaching(richButNotEngaged, true, 10)).toBe(false);
    // At/after turn 12: override allows it through
    expect(deriveCheckpointApproaching(richButNotEngaged, true, 12)).toBe(true);
  });

  // Regression guard for the charged-material fix (ADR-043 amendment). A
  // signal-ready layer with no high/medium charge backing it must NOT fire the
  // signal-ready short-circuit — the exact scenario that returned true under
  // the old bypass (e.g. a returning user's bootstrapped "explored" layer with
  // an empty current-session bank).
  it("returns false when a layer is signal-ready but no high/medium charge backs it", () => {
    const emptyBank = makeExtractionState({
      language_bank: [],
      layers: {
        1: { signal: "explored", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(emptyBank, true, 5)).toBe(false);

    // Low-charge-only bank tagged to the signal-ready layer: present on the
    // right layer, but the high|medium filter excludes "low", so it still fails.
    const lowOnlyBank = makeExtractionState({
      language_bank: [
        { phrase: "it was fine", context: "in passing", charge: "low", layers: [1] },
      ],
      layers: {
        1: { signal: "explored", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(lowOnlyBank, true, 5)).toBe(false);
  });

  // Layer-specificity proof. The charge must be tagged to the SAME layer whose
  // signal is ready; a high-charge phrase on a different layer does not back
  // the signal-ready layer.
  it("returns false when charge is high but tagged to a different layer than the signal-ready one", () => {
    // Signal-ready layer is 1; charge tagged to layer 2 → no backing → false.
    const chargeElsewhere = makeExtractionState({
      language_bank: chargedBank(2),
      layers: {
        1: { signal: "explored", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(chargeElsewhere, true, 5)).toBe(false);

    // Same fixture with the charge moved onto the signal-ready layer (1) →
    // fires. The ONLY change is the layer tag, so the flip to true is
    // attributable to layer-specificity alone.
    const chargeOnSignalLayer = makeExtractionState({
      language_bank: chargedBank(1),
      layers: {
        1: { signal: "explored", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(chargeOnSignalLayer, true, 5)).toBe(true);
  });

  // Crisis-guard proof — the first test to exercise signal-ready-during-crisis.
  // A signal-ready layer with charge correctly on it must STILL not fire while
  // a crisis is active: the !crisisActive condition blocks the short-circuit,
  // and the fall-through validateMaterialQuality blocks on crisis too.
  it("returns false when signal-ready and charged but a crisis is active", () => {
    const inCrisis = makeExtractionState({
      language_bank: chargedBank(1),
      clinical_flag: { active: true, level: "crisis", note: "self-harm" },
      layers: {
        1: { signal: "checkpoint_ready", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(inCrisis, true, 5)).toBe(false);

    // Same fixture without the crisis flag → fires. The ONLY change is the
    // clinical_flag, so the flip to true is attributable to the crisis guard.
    const noCrisis = makeExtractionState({
      language_bank: chargedBank(1),
      layers: {
        1: { signal: "checkpoint_ready", material: [], examples: [] },
        2: { signal: "none", material: [], examples: [] },
        3: { signal: "none", material: [], examples: [] },
        4: { signal: "none", material: [], examples: [] },
        5: { signal: "none", material: [], examples: [] },
      },
    });
    expect(deriveCheckpointApproaching(noCrisis, true, 5)).toBe(true);
  });
});

// ─── Refinement-count chain inheritance (Track A Phase 7-Mid) ──────────────
describe("computeInheritedRefinementCount", () => {
  it("returns 0 when there is no previous checkpoint", () => {
    expect(computeInheritedRefinementCount(null)).toBe(0);
  });

  it("returns 0 when previous status is confirmed (chain broken)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "confirmed",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous status is rejected (chain broken)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "rejected",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous status is pending (defensive — not a chain state)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "pending",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous count is undefined (legacy meta rows pre-Phase-7-Mid)", () => {
    expect(
      computeInheritedRefinementCount({ status: "refined" })
    ).toBe(0);
  });

  it("inherits the previous count when previous status is refined", () => {
    expect(
      computeInheritedRefinementCount({
        status: "refined",
        refinement_count: 1,
      })
    ).toBe(1);
  });

  // The case Phase 7-Mid spec called out explicitly to document via
  // a test name. Naming this case "across distinct entries" makes the
  // intent searchable in the codebase: yes, a fresh entry inherits
  // the chain count, and yes, that is intended behavior.
  it("refinement count inherits across distinct entries when chain is unbroken", () => {
    // Setup: the user refined two prior entries about an entirely
    // different topic (call them E1 about topic A, then E2 about topic
    // A again, both refined). Server now composes E3, which happens
    // to be about topic B (a fresh emerging pattern). The chain rule
    // is structural — it looks only at the previous checkpoint's
    // status, not at semantic similarity. Because E2 was refined with
    // count=2, E3 inherits count=2 even though it is about a
    // different topic.
    //
    // Result: the user sees the refinement-ceiling card UI on E3's
    // first attempt. They can accept E3 as-is or let it go.
    //
    // This is intended behavior. Detecting "same pattern" semantically
    // would require fuzzy LLM judgment we do not have. In practice,
    // refinements happen rapidly enough that an unbroken chain is the
    // right proxy for "the user has already pushed back twice and
    // would rather move on than refine a third time." If a user does
    // hit this case across genuinely distinct topics, hitting "Let it
    // go" on E3 breaks the chain (next entry starts fresh at 0).
    const e2RefinedMeta = {
      status: "refined" as const,
      refinement_count: 2,
    };
    expect(computeInheritedRefinementCount(e2RefinedMeta)).toBe(2);
  });
});

// ─── Entries-summary builder (Track A Phase 7-High) ────────────────────────
describe("buildEntriesSummary", () => {
  it("uses singular 'has material' when only one layer is populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 2,
        confirmedLayerName: "Some of My Patterns",
        otherLayersWithMaterial: [],
        remainingEmptyCount: 4,
      })
    ).toBe(
      "2 entries. Some of My Patterns has material. 4 still empty."
    );
  });

  it("uses 'X and Y have material' when exactly two layers are populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 3,
        confirmedLayerName: "How I Process Things",
        otherLayersWithMaterial: ["Some of My Patterns"],
        remainingEmptyCount: 3,
      })
    ).toBe(
      "3 entries. How I Process Things and Some of My Patterns have material. 3 still empty."
    );
  });

  it("uses Oxford-comma joining when three or more layers are populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 4,
        confirmedLayerName: "What Helps",
        otherLayersWithMaterial: [
          "Some of My Patterns",
          "How I Process Things",
        ],
        remainingEmptyCount: 2,
      })
    ).toBe(
      "4 entries. What Helps, Some of My Patterns, and How I Process Things have material. 2 still empty."
    );
  });

  it("puts the just-confirmed layer first, then the other layers in input order", () => {
    // The confirmedLayerName always leads so the user sees "their new
    // entry's layer" highlighted in the recap.
    const result = buildEntriesSummary({
      entryCount: 5,
      confirmedLayerName: "My Strengths",
      otherLayersWithMaterial: [
        "Some of My Patterns",
        "How I Process Things",
      ],
      remainingEmptyCount: 2,
    });
    const idx1 = result.indexOf("My Strengths");
    const idx2 = result.indexOf("Some of My Patterns");
    expect(idx1).toBeLessThan(idx2);
  });

  it("handles all five layers populated — zero remaining", () => {
    // Not a special case in the spec; the downstream prompt treats
    // "0 still empty" as valid copy.
    expect(
      buildEntriesSummary({
        entryCount: 5,
        confirmedLayerName: "My Strengths",
        otherLayersWithMaterial: [
          "Some of My Patterns",
          "How I Process Things",
          "What Helps",
          "How I Show Up with People",
        ],
        remainingEmptyCount: 0,
      })
    ).toContain("0 still empty.");
  });
});

// ── Conversation mode → prompt integration ──────────────────────────────────

describe("buildPromptOptionsFromContext — mode field", () => {
  function makeCtx(mode: "situation" | "guided-intake"): ConversationContext {
    return {
      messages: [{ role: "user", content: "test" }],
      manualComponents: [],
      previousExtraction: null,
      sessionSummary: null,
      isReturningUser: false,
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnsSinceCheckpoint: Infinity,
      conversationId: "test-conv",
      extractionForPersona: "",
      turnCount: 1,
      checkpointApproaching: false,
      personaModes: ["autistic"],
      priorCheckpointSuppressed: false,
      checkpointsEnabled: true,
      reflectionMeterEnabled: false,
      extractionEnabled: true,
      voiceOverrides: {},
      checkpointTuning: CHECKPOINT_TUNING_DEFAULTS,
      baselineActive: false,
      baselineForces: {
        gate: false,
        flagDontGrab: false,
        seamRule: false,
        mechanicsDeepening: false,
        characterShaping: false,
        tier3Blocks: false,
      },
      baselineGateOpen: false,
      mode,
    };
  }

  it("passes mode through to BuildPromptOptions", () => {
    expect(buildPromptOptionsFromContext(makeCtx("guided-intake")).mode).toBe("guided-intake");
    expect(buildPromptOptionsFromContext(makeCtx("situation")).mode).toBe("situation");
  });

  it("guided-intake context produces a prompt with GUIDED INTAKE block", () => {
    const opts = buildPromptOptionsFromContext(makeCtx("guided-intake"));
    const prompt = buildSystemPrompt(opts);
    expect(prompt).toContain("GUIDED INTAKE");
    expect(prompt).toContain("The user opened this mode to be led");
  });

  it("situation context produces a prompt WITHOUT GUIDED INTAKE block", () => {
    const opts = buildPromptOptionsFromContext(makeCtx("situation"));
    const prompt = buildSystemPrompt(opts);
    expect(prompt).not.toContain("GUIDED INTAKE");
  });
});

describe("deriveProposalFlags — reflection meter is web-only", () => {
  it("meter OFF: proposals on, meter off (both surfaces, current prod default)", () => {
    for (const surface of ["web", "text"] as const) {
      expect(
        deriveProposalFlags({ checkpoints: true, reflectionMeter: false }, surface)
      ).toEqual({ reflectionMeterEnabled: false, proposalsEnabled: true });
    }
  });

  it("meter ON + web: meter on, Jove-pushed proposals silenced", () => {
    expect(
      deriveProposalFlags({ checkpoints: true, reflectionMeter: true }, "web")
    ).toEqual({ reflectionMeterEnabled: true, proposalsEnabled: false });
  });

  it("meter ON + text: meter forced off, proposals STAY on (SMS capture invariant)", () => {
    // The blocker the switchover audit caught: a text-only user must keep a
    // capture path. The meter never renders over SMS, so proposals must remain.
    expect(
      deriveProposalFlags({ checkpoints: true, reflectionMeter: true }, "text")
    ).toEqual({ reflectionMeterEnabled: false, proposalsEnabled: true });
  });

  it("checkpoints gate OFF: proposals off regardless of surface or meter", () => {
    expect(
      deriveProposalFlags({ checkpoints: false, reflectionMeter: false }, "web")
    ).toEqual({ reflectionMeterEnabled: false, proposalsEnabled: false });
    expect(
      deriveProposalFlags({ checkpoints: false, reflectionMeter: true }, "text")
    ).toEqual({ reflectionMeterEnabled: false, proposalsEnabled: false });
  });
});

describe("reflectionMeterFill (capture-progress)", () => {
  const COOLDOWN = 5;

  it("is full when the gate has passed (capturable)", () => {
    expect(reflectionMeterFill("mechanism", 10, true, COOLDOWN)).toBe(100);
    // gate passed wins even with 0 turns / shallow depth
    expect(reflectionMeterFill("surface", 0, true, COOLDOWN)).toBe(100);
  });

  it("RESETS to 0 right after a save (turnsSinceCheckpoint 0), even when deep", () => {
    expect(reflectionMeterFill("mechanism", 0, false, COOLDOWN)).toBe(0);
  });

  it("ramps back up over the cooldown, capped by depth", () => {
    // deep thread, mechanism depth = 85; cooldown cap rises 20/40/60/80/100
    expect(reflectionMeterFill("mechanism", 1, false, COOLDOWN)).toBe(20);
    expect(reflectionMeterFill("mechanism", 3, false, COOLDOWN)).toBe(60);
    // once the cooldown has fully elapsed, the depth cap (85) takes over
    expect(reflectionMeterFill("mechanism", 5, false, COOLDOWN)).toBe(85);
    expect(reflectionMeterFill("mechanism", 9, false, COOLDOWN)).toBe(85);
  });

  it("stays low for a new shallow thread regardless of cooldown", () => {
    expect(reflectionMeterFill("surface", 9, false, COOLDOWN)).toBe(6);
  });

  it("has no cooldown cap when there is no prior checkpoint (Infinity)", () => {
    expect(reflectionMeterFill("mechanism", Infinity, false, COOLDOWN)).toBe(85);
    expect(reflectionMeterFill("surface", Infinity, false, COOLDOWN)).toBe(6);
  });

  it("returns 0 for unknown/empty depth when not ready", () => {
    expect(reflectionMeterFill(null, Infinity, false, COOLDOWN)).toBe(0);
    expect(reflectionMeterFill(undefined, Infinity, false, COOLDOWN)).toBe(0);
  });
});

describe("resolveConversationMode", () => {
  const ALL_ON = { situation: true, guidedIntake: true, upload: true };

  it("returns the requested mode when its gate is on", () => {
    expect(resolveConversationMode("guided-intake", ALL_ON)).toBe("guided-intake");
    expect(resolveConversationMode("upload", ALL_ON)).toBe("upload");
    expect(resolveConversationMode("situation", ALL_ON)).toBe("situation");
  });

  it("defaults an absent/unknown raw mode to situation when situation is on", () => {
    expect(resolveConversationMode(undefined, ALL_ON)).toBe("situation");
    expect(resolveConversationMode(null, ALL_ON)).toBe("situation");
    expect(resolveConversationMode("nonsense", ALL_ON)).toBe("situation");
  });

  it("falls a disabled optional mode back to situation while situation is on (legacy behavior)", () => {
    expect(
      resolveConversationMode("guided-intake", { situation: true, guidedIntake: false, upload: true })
    ).toBe("situation");
    expect(
      resolveConversationMode("upload", { situation: true, guidedIntake: true, upload: false })
    ).toBe("situation");
  });

  it("honorRequested honors the requested mode even when its gate is off (baseline experiment)", () => {
    const ALL_OFF = { situation: false, guidedIntake: false, upload: false };
    // Situation with the situation gate off would normally fall back; baseline
    // honors it so the admin can run the pilot in Situation regardless.
    expect(resolveConversationMode("situation", ALL_OFF, true)).toBe("situation");
    expect(resolveConversationMode("guided-intake", ALL_OFF, true)).toBe(
      "guided-intake",
    );
    // Default (honorRequested=false) still falls back — unchanged for real users.
    expect(resolveConversationMode("situation", ALL_OFF)).toBe("situation"); // hard floor
    expect(resolveConversationMode("guided-intake", ALL_OFF)).toBe("situation");
  });

  it("guided-solo: situation off → every request resolves to guided", () => {
    const guidedSolo = { situation: false, guidedIntake: true, upload: false };
    expect(resolveConversationMode("situation", guidedSolo)).toBe("guided-intake");
    expect(resolveConversationMode(undefined, guidedSolo)).toBe("guided-intake");
    expect(resolveConversationMode("guided-intake", guidedSolo)).toBe("guided-intake");
    expect(resolveConversationMode("upload", guidedSolo)).toBe("guided-intake");
  });

  it("upload-solo: situation + guided off → everything resolves to upload", () => {
    const uploadSolo = { situation: false, guidedIntake: false, upload: true };
    expect(resolveConversationMode("situation", uploadSolo)).toBe("upload");
    expect(resolveConversationMode("guided-intake", uploadSolo)).toBe("upload");
    expect(resolveConversationMode("upload", uploadSolo)).toBe("upload");
  });

  it("every gate off → situation is the ultimate hard floor (never mode-less)", () => {
    const allOff = { situation: false, guidedIntake: false, upload: false };
    expect(resolveConversationMode("guided-intake", allOff)).toBe("situation");
    expect(resolveConversationMode("upload", allOff)).toBe("situation");
    expect(resolveConversationMode(undefined, allOff)).toBe("situation");
  });
});
