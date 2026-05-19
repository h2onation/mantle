import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

let updateError: { message: string } | null = null;
let lastUpdatePatch: Record<string, unknown> | null = null;
let lastUpdateEqColumn: string | null = null;
let lastUpdateEqValue: unknown = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = {
      from: () => chain,
      update: (patch: Record<string, unknown>) => {
        lastUpdatePatch = patch;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        lastUpdateEqColumn = col;
        lastUpdateEqValue = val;
        return Promise.resolve({ data: null, error: updateError });
      },
    };
    return chain;
  },
}));

import { PATCH } from "./route";
import { validatePersonaModes } from "@/lib/persona/persona-modes-validator";

function makeRequest(body: unknown): import("next/server").NextRequest {
  return new Request("http://localhost/api/user/persona-modes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  mockGetUser.mockReset();
  updateError = null;
  lastUpdatePatch = null;
  lastUpdateEqColumn = null;
  lastUpdateEqValue = null;
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-A" } } });
});

// ──────────────────────────────────────────────────────────────────────
// validatePersonaModes — unit-level
// ──────────────────────────────────────────────────────────────────────

describe("validatePersonaModes", () => {
  it("accepts a single neurotype mode", () => {
    expect(validatePersonaModes(["autistic"])).toEqual({
      ok: true,
      value: ["autistic"],
    });
  });

  it("accepts multiple neurotype modes combined", () => {
    expect(validatePersonaModes(["autistic", "audhd"])).toEqual({
      ok: true,
      value: ["autistic", "audhd"],
    });
  });

  it("accepts 'general' alone", () => {
    expect(validatePersonaModes(["general"])).toEqual({
      ok: true,
      value: ["general"],
    });
  });

  it("dedupes repeated elements", () => {
    expect(validatePersonaModes(["autistic", "autistic"])).toEqual({
      ok: true,
      value: ["autistic"],
    });
  });

  it("rejects non-array input", () => {
    expect(validatePersonaModes("autistic")).toEqual({
      ok: false,
      error: "persona_modes must be an array",
    });
    expect(validatePersonaModes(null)).toEqual({
      ok: false,
      error: "persona_modes must be an array",
    });
    expect(validatePersonaModes(undefined)).toEqual({
      ok: false,
      error: "persona_modes must be an array",
    });
  });

  it("rejects empty array", () => {
    expect(validatePersonaModes([])).toEqual({
      ok: false,
      error: "persona_modes must have at least one element",
    });
  });

  it("rejects unknown elements", () => {
    const result = validatePersonaModes(["autistic", "wizard"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/every persona_modes element must be one of/);
    }
  });

  it("rejects 'general' combined with a neurotype mode (exclusivity)", () => {
    expect(validatePersonaModes(["general", "autistic"])).toEqual({
      ok: false,
      error: "\"general\" cannot combine with any other persona mode",
    });
    expect(validatePersonaModes(["autistic", "general"])).toEqual({
      ok: false,
      error: "\"general\" cannot combine with any other persona mode",
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// PATCH /api/user/persona-modes — route-level
// ──────────────────────────────────────────────────────────────────────

describe("PATCH /api/user/persona-modes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(makeRequest({ persona_modes: ["general"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON body shape (e.g. missing persona_modes)", async () => {
    const res = await PATCH(makeRequest({ other_field: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when persona_modes is empty", async () => {
    const res = await PATCH(makeRequest({ persona_modes: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when persona_modes contains unknown element", async () => {
    const res = await PATCH(makeRequest({ persona_modes: ["wizard"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when 'general' is combined with a neurotype mode", async () => {
    const res = await PATCH(
      makeRequest({ persona_modes: ["general", "autistic"] }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/cannot combine/i);
  });

  it("happy path: writes deduped persona_modes scoped by user id and returns the saved array", async () => {
    const res = await PATCH(
      makeRequest({ persona_modes: ["autistic", "audhd", "autistic"] }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { persona_modes: string[] };
    expect(body.persona_modes).toEqual(["autistic", "audhd"]);
    expect(lastUpdatePatch).toEqual({ persona_modes: ["autistic", "audhd"] });
    expect(lastUpdateEqColumn).toBe("id");
    expect(lastUpdateEqValue).toBe("user-A");
  });

  it("returns 500 when the database update errors", async () => {
    updateError = { message: "db down" };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PATCH(makeRequest({ persona_modes: ["general"] }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
