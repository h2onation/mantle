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
    expect(gates).toEqual({ extractionBrief: true });
  });

  it("fails open to all-ON when data is null", async () => {
    // default mock response is { data: null, error: null }
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual(DEFAULT_FEATURE_GATES);
  });

  it("defaults missing rows to ON and applies present rows", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      { data: [{ key: "extraction_brief", enabled: false }], error: null },
    );
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual({ extractionBrief: false });
  });

  it("ignores unknown keys (incl. the removed door + persona_deltas gates)", async () => {
    (mock as { _setResponse: (t: string, r: unknown) => void })._setResponse(
      "feature_gates",
      {
        data: [
          // The three door gates were deleted in the modules cutover — a
          // straggler row must read as unknown, not resurrect a gate.
          { key: "situation", enabled: false },
          { key: "guided_intake", enabled: false },
          { key: "upload", enabled: false },
          { key: "persona_deltas", enabled: false },
          { key: "some_orphan_flag", enabled: false },
        ],
        error: null,
      },
    );
    const gates = await getFeatureGates(mock as never);
    expect(gates).toEqual({ extractionBrief: true });
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
  it("accepts the one live key and rejects the retired door gates", () => {
    expect(isFeatureGateKey("extraction_brief")).toBe(true);
    // Door gates deleted 2026-07-15 (modules cutover).
    expect(isFeatureGateKey("situation")).toBe(false);
    expect(isFeatureGateKey("guided_intake")).toBe(false);
    expect(isFeatureGateKey("upload")).toBe(false);
    expect(isFeatureGateKey("checkpoints")).toBe(false);
    expect(isFeatureGateKey("reflection_meter")).toBe(false);
  });

  it("rejects unknown keys and non-strings", () => {
    // persona_deltas was removed 2026-07-08 — it must read as unknown now.
    expect(isFeatureGateKey("persona_deltas")).toBe(false);
    expect(isFeatureGateKey("personaDeltas")).toBe(false);
    expect(isFeatureGateKey("orphan")).toBe(false);
    expect(isFeatureGateKey(null)).toBe(false);
    expect(isFeatureGateKey(42)).toBe(false);
    expect(isFeatureGateKey(undefined)).toBe(false);
  });
});
