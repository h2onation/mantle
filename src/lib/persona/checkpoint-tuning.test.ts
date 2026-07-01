import { describe, it, expect } from "vitest";
import {
  getCheckpointTuning,
  CHECKPOINT_TUNING_DEFAULTS,
  CHECKPOINT_TUNING_FIELDS,
  isCheckpointTuningField,
  isDepthLevel,
} from "./checkpoint-tuning";
import {
  validateMaterialQuality,
  applyCheckpointGates,
} from "./persona-pipeline";
import type { ExtractionState } from "./extraction";

// Minimal stub of the admin client's `.from().select().eq().maybeSingle()`
// chain that getCheckpointTuning uses.
function adminStub(result: {
  row?: unknown;
  error?: unknown;
  throws?: boolean;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (result.throws) throw new Error("db down");
            return Promise.resolve({
              data: result.row ?? null,
              error: result.error ?? null,
            });
          },
        }),
      }),
    }),
  } as unknown as Parameters<typeof getCheckpointTuning>[0];
}

describe("getCheckpointTuning — resolver contract (fails open to code floor)", () => {
  it("returns the code defaults when no row exists", async () => {
    const out = await getCheckpointTuning(adminStub({ row: null }));
    expect(out).toEqual(CHECKPOINT_TUNING_DEFAULTS);
  });

  it("returns defaults on a DB error", async () => {
    const out = await getCheckpointTuning(adminStub({ error: { message: "boom" } }));
    expect(out).toEqual(CHECKPOINT_TUNING_DEFAULTS);
  });

  it("returns defaults when the read throws", async () => {
    const out = await getCheckpointTuning(adminStub({ throws: true }));
    expect(out).toEqual(CHECKPOINT_TUNING_DEFAULTS);
  });

  it("maps a fully-populated, in-range row", async () => {
    const out = await getCheckpointTuning(
      adminStub({
        row: {
          min_scenes: 1,
          cooldown_turns: 0,
          failsafe_turn: 20,
          depth_floor: "feeling",
        },
      }),
    );
    expect(out).toEqual({
      minScenes: 1,
      cooldownTurns: 0,
      failsafeTurn: 20,
      depthFloor: "feeling",
    });
  });

  it("falls back per-field on a null column", async () => {
    const out = await getCheckpointTuning(
      adminStub({
        row: {
          min_scenes: null,
          cooldown_turns: 3,
          failsafe_turn: null,
          depth_floor: null,
        },
      }),
    );
    expect(out.minScenes).toBe(CHECKPOINT_TUNING_DEFAULTS.minScenes);
    expect(out.cooldownTurns).toBe(3);
    expect(out.failsafeTurn).toBe(CHECKPOINT_TUNING_DEFAULTS.failsafeTurn);
    expect(out.depthFloor).toBe(CHECKPOINT_TUNING_DEFAULTS.depthFloor);
  });

  it("falls back per-field on an out-of-range int (fail-safe)", async () => {
    const out = await getCheckpointTuning(
      adminStub({
        row: {
          min_scenes: 99, // above max 5
          cooldown_turns: -1, // below min 0
          failsafe_turn: 12,
          depth_floor: "not-a-level", // invalid enum
        },
      }),
    );
    expect(out.minScenes).toBe(CHECKPOINT_TUNING_DEFAULTS.minScenes);
    expect(out.cooldownTurns).toBe(CHECKPOINT_TUNING_DEFAULTS.cooldownTurns);
    expect(out.failsafeTurn).toBe(12);
    expect(out.depthFloor).toBe(CHECKPOINT_TUNING_DEFAULTS.depthFloor);
  });
});

describe("checkpoint tuning — defaults match the historical code literals", () => {
  it("did not drift the shipped floor", () => {
    expect(CHECKPOINT_TUNING_DEFAULTS).toEqual({
      minScenes: 2,
      cooldownTurns: 5,
      failsafeTurn: 12,
      depthFloor: "mechanism",
    });
  });

  it("field map column names match the migration", () => {
    expect(CHECKPOINT_TUNING_FIELDS.minScenes.column).toBe("min_scenes");
    expect(CHECKPOINT_TUNING_FIELDS.cooldownTurns.column).toBe("cooldown_turns");
    expect(CHECKPOINT_TUNING_FIELDS.failsafeTurn.column).toBe("failsafe_turn");
    expect(CHECKPOINT_TUNING_FIELDS.depthFloor.column).toBe("depth_floor");
  });
});

describe("isCheckpointTuningField / isDepthLevel", () => {
  it("accepts known field names, rejects others", () => {
    expect(isCheckpointTuningField("minScenes")).toBe(true);
    expect(isCheckpointTuningField("depthFloor")).toBe(true);
    expect(isCheckpointTuningField("nope")).toBe(false);
    expect(isCheckpointTuningField(7)).toBe(false);
  });

  it("accepts the five depth levels, rejects others", () => {
    expect(isDepthLevel("mechanism")).toBe(true);
    expect(isDepthLevel("origin")).toBe(true);
    expect(isDepthLevel("deep")).toBe(false);
    expect(isDepthLevel(null)).toBe(false);
  });
});

// A material state that PASSES every gate at the default thresholds, so each
// test below can isolate the one dial it overrides.
function passingState(overrides?: Partial<ExtractionState>): ExtractionState {
  return {
    layers: {
      1: { signal: "none", material: [], examples: [] },
      2: { signal: "none", material: [], examples: [] },
      3: { signal: "none", material: [], examples: [] },
      4: { signal: "none", material: [], examples: [] },
      5: { signal: "none", material: [], examples: [] },
    },
    language_bank: [
      { phrase: "my chest goes tight", context: "when it fires", charge: "high", layers: [1] },
    ],
    depth: "mechanism",
    current_thread: "",
    mode: "situation_led",
    checkpoint_gate: {
      concrete_examples: 2,
      has_mechanism: true,
      has_charged_language: true,
      has_behavior_driver_link: true,
      strongest_layer: 1,
    },
    clinical_flag: { active: false, level: "none", note: "" },
    observation_miss_count: 0,
    sage_brief: "",
    pattern_engaged: true,
    user_named_cost: false,
    user_named_stance: false,
    ...overrides,
  };
}

describe("validateMaterialQuality honors tuning", () => {
  it("minScenes: a 1-scene state is blocked at default 2 but passes when lowered to 1", () => {
    const state = passingState({
      checkpoint_gate: {
        concrete_examples: 1,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    expect(validateMaterialQuality(state, false).ok).toBe(false);
    expect(
      validateMaterialQuality(state, false, undefined, {
        ...CHECKPOINT_TUNING_DEFAULTS,
        minScenes: 1,
      }).ok,
    ).toBe(true);
  });

  it("depthFloor: a 'feeling' state is blocked at default 'mechanism' but passes when the floor is lowered", () => {
    const state = passingState({ depth: "feeling" });
    expect(validateMaterialQuality(state, false).ok).toBe(false);
    expect(
      validateMaterialQuality(state, false, undefined, {
        ...CHECKPOINT_TUNING_DEFAULTS,
        depthFloor: "feeling",
      }).ok,
    ).toBe(true);
  });

  it("failsafeTurn: an un-engaged-but-strong state fires only past the failsafe turn", () => {
    const state = passingState({ pattern_engaged: false });
    // default failsafe 12: blocked at turn 10, allowed at 12
    expect(validateMaterialQuality(state, false, 10).ok).toBe(false);
    expect(validateMaterialQuality(state, false, 12).ok).toBe(true);
    // lowered failsafe 8: allowed at turn 8
    expect(
      validateMaterialQuality(state, false, 8, {
        ...CHECKPOINT_TUNING_DEFAULTS,
        failsafeTurn: 8,
      }).ok,
    ).toBe(true);
  });
});

describe("applyCheckpointGates honors the cooldown dial", () => {
  it("blocks at 3 turns under default cooldown 5, passes when cooldown lowered to 2", () => {
    const state = passingState();
    expect(applyCheckpointGates(3, state, false, 20).passed).toBe(false);
    expect(
      applyCheckpointGates(3, state, false, 20, {
        ...CHECKPOINT_TUNING_DEFAULTS,
        cooldownTurns: 2,
      }).passed,
    ).toBe(true);
  });
});
