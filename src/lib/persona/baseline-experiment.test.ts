import { describe, it, expect } from "vitest";
import {
  getBaselineExperiment,
  defaultBaselineExperiment,
  BASELINE_GATE_KEYS,
} from "@/lib/persona/baseline-experiment";
import { validateMaterialQuality } from "@/lib/persona/persona-pipeline";
import { buildSystemPromptBlocks } from "@/lib/persona/system-prompt";
import type { ExtractionState } from "@/lib/persona/extraction";

// Minimal admin-client stub: getBaselineExperiment only calls
// admin.from("baseline_experiment_gates").select("key, enabled").
function fakeAdmin(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({ select: () => Promise.resolve(result) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function crisisState(): ExtractionState {
  return {
    clinical_flag: { active: true, level: "crisis", note: "" },
    // The rest is unread on the crisis path but present for type-completeness.
    layers: {},
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
    observation_miss_count: 0,
    sage_brief: "",
    pattern_engaged: false,
    user_named_cost: false,
    user_named_stance: false,
  };
}

describe("getBaselineExperiment", () => {
  it("fails CLOSED to experiment-off on a DB error", async () => {
    const exp = await getBaselineExperiment(
      fakeAdmin({ data: null, error: { message: "boom" } }),
    );
    expect(exp).toEqual(defaultBaselineExperiment());
    expect(exp.enabled).toBe(false);
  });

  it("fails CLOSED when the table/rows are absent", async () => {
    const exp = await getBaselineExperiment(fakeAdmin({ data: [], error: null }));
    expect(exp.enabled).toBe(false);
    expect(Object.values(exp.forces).every((v) => v === false)).toBe(true);
  });

  it("maps known keys onto enabled + the force fields", async () => {
    const exp = await getBaselineExperiment(
      fakeAdmin({
        data: [
          { key: "enabled", enabled: true },
          { key: "force_flag_dont_grab", enabled: true },
          { key: "force_seam_rule", enabled: false },
          { key: "unknown_key", enabled: true }, // ignored
        ],
        error: null,
      }),
    );
    expect(exp.enabled).toBe(true);
    expect(exp.forces.flagDontGrab).toBe(true);
    expect(exp.forces.seamRule).toBe(false);
    expect(exp.forces.gate).toBe(false);
  });

  it("every documented key maps to a real target", () => {
    expect(Object.keys(BASELINE_GATE_KEYS).sort()).toEqual(
      [
        "enabled",
        "conductor",
        "force_character_shaping",
        "force_flag_dont_grab",
        "force_gate",
        "force_mechanics_deepening",
        "force_seam_rule",
        "force_tier3_blocks",
      ].sort(),
    );
  });

  it("maps the conductor key and fails closed without it", async () => {
    const on = await getBaselineExperiment(
      fakeAdmin({ data: [{ key: "conductor", enabled: true }], error: null }),
    );
    expect(on.conductor).toBe(true);
    expect(on.enabled).toBe(false);
    const off = await getBaselineExperiment(fakeAdmin({ data: [], error: null }));
    expect(off.conductor).toBe(false);
  });
});

describe("crisis safety survives a fully-stripped baseline", () => {
  // The whole point: gate OPEN (baselineGateOpen=true) must still BLOCK on crisis.
  it("blocks the checkpoint on crisis even with the gate open", () => {
    const res = validateMaterialQuality(
      crisisState(),
      false,
      undefined,
      undefined,
      /* baselineGateOpen */ true,
    );
    expect(res.ok).toBe(false);
    expect(res.reasons.join(" ")).toMatch(/crisis/i);
  });

  it("with the gate open and NO crisis, thin material passes (gate is open)", () => {
    const ok = validateMaterialQuality(
      { ...crisisState(), clinical_flag: { active: false, level: "none", note: "" } },
      false,
      undefined,
      undefined,
      /* baselineGateOpen */ true,
    );
    expect(ok.ok).toBe(true);
  });

  it("the baseline prompt always carries the 988 crisis line", () => {
    const blocks = buildSystemPromptBlocks({
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "c",
      isReturningUser: false,
      sessionSummary: null,
      extractionContext: "",
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnCount: 1,
      checkpointApproaching: false,
      personaModes: ["general"],
      mode: "situation",
      priorCheckpointSuppressed: false,
      voiceVariant: "baseline",
      voiceOverrides: {},
      // no baselineForces → thinnest (all off)
    });
    const full = blocks.tier1 + blocks.staticContext + blocks.dynamic;
    expect(full).toContain("988");
    expect(full).toContain("741741");
  });
});

describe("gate is unchanged when the experiment is off (default param)", () => {
  it("null state fails closed when baselineGateOpen defaults to false", () => {
    const res = validateMaterialQuality(null, false);
    expect(res.ok).toBe(false);
    expect(res.reasons.join(" ")).toMatch(/no extraction state/i);
  });
});

describe("conductor variant — guard tests", () => {
  const renderConductor = () => {
    const b = buildSystemPromptBlocks({
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "c",
      isReturningUser: false,
      sessionSummary: null,
      extractionContext: "",
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

describe("baseline plumbing cannot leak into the live (rebuilt) path", () => {
  // The live voice is "rebuilt". Proof that the new baselineForces field can
  // never alter live output: rendering the rebuilt prompt with EVERY force on
  // must be byte-identical to rendering it with no forces at all. The forces are
  // only ever read inside the "baseline" branch.
  const rebuiltOpts = {
    kind: "oneOnOne" as const,
    manualComponents: [],
    currentConversationId: "c",
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: true,
    sessionCount: 1,
    turnCount: 1,
    checkpointApproaching: false,
    personaModes: ["general" as const],
    mode: "situation" as const,
    priorCheckpointSuppressed: false,
    voiceVariant: "rebuilt" as const,
    voiceOverrides: {},
  };
  const render = (b: ReturnType<typeof buildSystemPromptBlocks>) =>
    b.tier1 + b.staticContext + b.dynamic;

  // Anthropic rejects empty system text blocks ("must be non-empty"). A fresh
  // baseline-all-off turn produces an EMPTY dynamic tail, so call-persona must
  // drop empty blocks before sending. This locks both facts.
  it("baseline all-off dynamic is empty; filtering leaves only non-empty blocks", () => {
    const b = buildSystemPromptBlocks({
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "c",
      isReturningUser: false,
      sessionSummary: null,
      extractionContext: "",
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnCount: 1,
      checkpointApproaching: false,
      personaModes: ["general"],
      mode: "situation",
      priorCheckpointSuppressed: false,
      voiceVariant: "baseline",
      voiceOverrides: {},
    });
    expect(b.dynamic.trim()).toBe(""); // the trap the filter exists for
    const sent = [b.tier1, b.staticContext, b.dynamic].filter(
      (t) => t.trim().length > 0,
    );
    expect(sent.length).toBe(2); // tier1 + static; the empty dynamic is dropped
    expect(sent.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("tier3 spine (guided) owns the opener — bare opener dropped, tiles instruction kept", () => {
    const guided = buildSystemPromptBlocks({
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "c",
      isReturningUser: false,
      sessionSummary: null,
      extractionContext: "",
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnCount: 1,
      checkpointApproaching: false,
      personaModes: ["general"],
      mode: "guided-intake",
      priorCheckpointSuppressed: false,
      voiceVariant: "baseline",
      voiceOverrides: {},
      baselineForces: {
        gate: false,
        flagDontGrab: false,
        seamRule: false,
        mechanicsDeepening: false,
        characterShaping: false,
        tier3Blocks: true,
      },
    });
    const full = guided.tier1 + guided.staticContext + guided.dynamic;
    // The guided tee-up's tile instruction must be present…
    expect(full).toContain("---sections---");
    // …and the bare opener, which contradicts it, must be gone.
    expect(full).not.toContain("Open by asking what's on their mind");
  });

  it("rebuilt output is identical with forces all-on vs absent", () => {
    const without = render(buildSystemPromptBlocks(rebuiltOpts));
    const withAllOn = render(
      buildSystemPromptBlocks({
        ...rebuiltOpts,
        baselineForces: {
          gate: true,
          flagDontGrab: true,
          seamRule: true,
          mechanicsDeepening: true,
          characterShaping: true,
          tier3Blocks: true,
        },
      }),
    );
    expect(withAllOn).toBe(without);
  });
});
