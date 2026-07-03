import { describe, it, expect } from "vitest";
import {
  getCheckpointTuning,
  CHECKPOINT_TUNING_DEFAULTS,
  CHECKPOINT_TUNING_FIELDS,
  isCheckpointTuningField,
} from "./checkpoint-tuning";

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

  it("maps an in-range cooldown row", async () => {
    const out = await getCheckpointTuning(
      adminStub({ row: { cooldown_turns: 0 } }),
    );
    expect(out).toEqual({ cooldownTurns: 0 });
  });

  it("falls back on a null column", async () => {
    const out = await getCheckpointTuning(
      adminStub({ row: { cooldown_turns: null } }),
    );
    expect(out.cooldownTurns).toBe(CHECKPOINT_TUNING_DEFAULTS.cooldownTurns);
  });

  it("falls back on an out-of-range int (fail-safe)", async () => {
    const out = await getCheckpointTuning(
      adminStub({ row: { cooldown_turns: -1 } }), // below min 0
    );
    expect(out.cooldownTurns).toBe(CHECKPOINT_TUNING_DEFAULTS.cooldownTurns);
  });

  it("honors an in-range override", async () => {
    const out = await getCheckpointTuning(
      adminStub({ row: { cooldown_turns: 3 } }),
    );
    expect(out.cooldownTurns).toBe(3);
  });
});

describe("checkpoint tuning — defaults match the historical code literals", () => {
  it("did not drift the shipped floor", () => {
    expect(CHECKPOINT_TUNING_DEFAULTS).toEqual({ cooldownTurns: 5 });
  });

  it("field map column name matches the migration", () => {
    expect(CHECKPOINT_TUNING_FIELDS.cooldownTurns.column).toBe("cooldown_turns");
  });
});

describe("isCheckpointTuningField", () => {
  it("accepts the cooldown field name, rejects others", () => {
    expect(isCheckpointTuningField("cooldownTurns")).toBe(true);
    expect(isCheckpointTuningField("minScenes")).toBe(false);
    expect(isCheckpointTuningField("nope")).toBe(false);
    expect(isCheckpointTuningField(7)).toBe(false);
  });
});
