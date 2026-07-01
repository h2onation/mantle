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
    emerging_pattern_snippet: null,
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
        "force_character_shaping",
        "force_flag_dont_grab",
        "force_gate",
        "force_mechanics_deepening",
        "force_seam_rule",
        "force_tier3_blocks",
      ].sort(),
    );
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
