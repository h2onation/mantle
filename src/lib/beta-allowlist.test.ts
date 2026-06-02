import { describe, it, expect, vi, beforeEach } from "vitest";

// The beta access gate is the single most security-critical function here:
// it decides who may sign up / log in. These tests lock its behavior directly
// (the signup + OAuth route tests only exercise it transitively).

let lookupResponse: { data: unknown; error: unknown } = { data: null, error: null };
const eqCalls: Array<{ col: string; val: string }> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.eq = (col: string, val: string) => {
      eqCalls.push({ col, val });
      return chain;
    };
    chain.maybeSingle = () => Promise.resolve(lookupResponse);
    return chain;
  },
}));

import { isEmailAllowlisted } from "@/lib/beta-allowlist";

beforeEach(() => {
  lookupResponse = { data: null, error: null };
  eqCalls.length = 0;
});

describe("isEmailAllowlisted", () => {
  it("returns true when an invited row exists", async () => {
    lookupResponse = { data: { id: "row-1" }, error: null };
    expect(await isEmailAllowlisted("  Yes@Example.com ")).toBe(true);
    // Looks up the lowercased+trimmed email AND filters to status='invited'.
    expect(eqCalls).toEqual([
      { col: "email", val: "yes@example.com" },
      { col: "status", val: "invited" },
    ]);
  });

  it("returns false when no invited row matches", async () => {
    lookupResponse = { data: null, error: null };
    expect(await isEmailAllowlisted("waiting@example.com")).toBe(false);
  });

  it("fails CLOSED on a lookup error", async () => {
    lookupResponse = { data: null, error: { message: "db down" } };
    expect(await isEmailAllowlisted("yes@example.com")).toBe(false);
  });

  it("returns false on an empty email without hitting the DB", async () => {
    expect(await isEmailAllowlisted("   ")).toBe(false);
    expect(eqCalls).toHaveLength(0);
  });
});
