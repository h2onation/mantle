import { describe, it, expect, beforeEach } from "vitest";
import {
  getFeatureGates,
  isFeatureGateKey,
  DEFAULT_FEATURE_GATES,
} from "./feature-gates";
import { createMockSupabase } from "@/lib/__test-helpers__/mock-supabase";

type Admin = ReturnType<typeof createMockSupabase>;

describe("getFeatureGates", () => {
  let mock: Admin;

  beforeEach(() => {
    mock = createMockSupabase();
    (mock as { _reset: () => void })._reset();
  });

  // The whole point of fail-open: production must behave exactly as today
  // when the table is missing, errored, or empty.
  it("fails open to all-ON when the query errors", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      { data: null, error: { message: "relation does not exist" } },
    );
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual(DEFAULT_FEATURE_GATES);
    expect(gates).toEqual({
      personaDeltas: true,
      guidedIntake: true,
      upload: true,
      checkpoints: true,
      extractionBrief: true,
      // Forward feature flag — fails CLOSED to OFF, unlike the debug gates.
      reflectionMeter: false,
    });
  });

  it("fails open to all-ON when data is null", async () => {
    // default mock response is { data: null, error: null }
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual(DEFAULT_FEATURE_GATES);
  });

  it("defaults missing rows to ON and applies present rows", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      { data: [{ key: "checkpoints", enabled: false }], error: null },
    );
    const gates = await getFeatureGates(mock as never);
    // checkpoints row present and false; the others have no row → stay at
    // their defaults (debug gates ON, reflectionMeter OFF).
    expect(gates).toEqual({
      personaDeltas: true,
      guidedIntake: true,
      upload: true,
      checkpoints: false,
      extractionBrief: true,
      reflectionMeter: false,
    });
  });

  it("maps all six keys when all are present", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      {
        data: [
          { key: "persona_deltas", enabled: false },
          { key: "guided_intake", enabled: false },
          { key: "upload", enabled: false },
          { key: "checkpoints", enabled: false },
          { key: "extraction_brief", enabled: false },
          { key: "reflection_meter", enabled: true },
        ],
        error: null,
      },
    );
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual({
      personaDeltas: false,
      guidedIntake: false,
      upload: false,
      checkpoints: false,
      extractionBrief: false,
      reflectionMeter: true,
    });
  });

  it("ignores unknown keys", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      {
        data: [
          { key: "persona_deltas", enabled: false },
          { key: "some_orphan_flag", enabled: false },
        ],
        error: null,
      },
    );
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual({
      personaDeltas: false,
      guidedIntake: true,
      upload: true,
      checkpoints: true,
      extractionBrief: true,
      reflectionMeter: false,
    });
  });

  it("fails open when the client throws", async () => {
    const throwingAdmin = {
      from() {
        throw new Error("network down");
      },
    };
    const gates = await getFeatureGates(throwingAdmin as never);
    expect(gates).toEqual(DEFAULT_FEATURE_GATES);
  });
});

describe("isFeatureGateKey", () => {
  it("accepts the six known keys", () => {
    expect(isFeatureGateKey("persona_deltas")).toBe(true);
    expect(isFeatureGateKey("guided_intake")).toBe(true);
    expect(isFeatureGateKey("upload")).toBe(true);
    expect(isFeatureGateKey("checkpoints")).toBe(true);
    expect(isFeatureGateKey("extraction_brief")).toBe(true);
    expect(isFeatureGateKey("reflection_meter")).toBe(true);
  });

  it("rejects unknown keys and non-strings", () => {
    expect(isFeatureGateKey("personaDeltas")).toBe(false);
    expect(isFeatureGateKey("orphan")).toBe(false);
    expect(isFeatureGateKey(null)).toBe(false);
    expect(isFeatureGateKey(42)).toBe(false);
    expect(isFeatureGateKey(undefined)).toBe(false);
  });
});
