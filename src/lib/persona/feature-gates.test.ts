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
      conversationModes: true,
      checkpoints: true,
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
    // checkpoints row present and false; the other two have no row → stay ON
    expect(gates).toEqual({
      personaDeltas: true,
      conversationModes: true,
      checkpoints: false,
    });
  });

  it("maps all three keys when all are present", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      {
        data: [
          { key: "persona_deltas", enabled: false },
          { key: "conversation_modes", enabled: false },
          { key: "checkpoints", enabled: false },
        ],
        error: null,
      },
    );
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual({
      personaDeltas: false,
      conversationModes: false,
      checkpoints: false,
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
      conversationModes: true,
      checkpoints: true,
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
  it("accepts the three known keys", () => {
    expect(isFeatureGateKey("persona_deltas")).toBe(true);
    expect(isFeatureGateKey("conversation_modes")).toBe(true);
    expect(isFeatureGateKey("checkpoints")).toBe(true);
  });

  it("rejects unknown keys and non-strings", () => {
    expect(isFeatureGateKey("personaDeltas")).toBe(false);
    expect(isFeatureGateKey("orphan")).toBe(false);
    expect(isFeatureGateKey(null)).toBe(false);
    expect(isFeatureGateKey(42)).toBe(false);
    expect(isFeatureGateKey(undefined)).toBe(false);
  });
});
