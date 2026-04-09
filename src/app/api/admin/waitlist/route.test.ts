import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyAdmin = vi.fn();
vi.mock("@/lib/admin/verify-admin", () => ({
  verifyAdmin: () => mockVerifyAdmin(),
}));

let listResponse: { data: unknown; error: unknown } = { data: [], error: null };
let updateError: unknown = null;
const updateCalls: Array<{ patch: Record<string, unknown>; eq: { col: string; val: string } | null }> = [];
let lastOrderArgs: { col: string; opts: unknown } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    let pendingPatch: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.order = (col: string, opts: unknown) => {
      lastOrderArgs = { col, opts };
      return Promise.resolve(listResponse);
    };
    chain.update = (patch: Record<string, unknown>) => {
      pendingPatch = patch;
      return chain;
    };
    chain.eq = (col: string, val: string) => {
      updateCalls.push({ patch: pendingPatch!, eq: { col, val } });
      pendingPatch = null;
      return Promise.resolve({ data: null, error: updateError });
    };
    return chain;
  },
}));

import { GET, PATCH } from "@/app/api/admin/waitlist/route";

beforeEach(() => {
  mockVerifyAdmin.mockReset();
  mockVerifyAdmin.mockResolvedValue({ userId: "u1", isAdmin: true });
  listResponse = { data: [], error: null };
  updateError = null;
  updateCalls.length = 0;
  lastOrderArgs = null;
});

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/waitlist", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/admin/waitlist", () => {
  it("returns 403 when not admin", async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: "", isAdmin: false });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns items ordered by created_at desc", async () => {
    const rows = [
      { id: "a", email: "x@y.com", source: null, status: "waiting", created_at: "2026-04-08T00:00:00Z" },
    ];
    listResponse = { data: rows, error: null };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: rows });
    expect(lastOrderArgs).toEqual({ col: "created_at", opts: { ascending: false } });
  });

  it("returns 500 on db error", async () => {
    listResponse = { data: null, error: { message: "db down" } };
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/waitlist", () => {
  it("returns 403 when not admin", async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: "", isAdmin: false });
    const res = await PATCH(patchReq({ id: "a", status: "invited" }));
    expect(res.status).toBe(403);
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects invalid status", async () => {
    const res = await PATCH(patchReq({ id: "a", status: "approved" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_status");
  });

  it("rejects missing id", async () => {
    const res = await PATCH(patchReq({ status: "invited" }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed json", async () => {
    const res = await PATCH(patchReq("not json"));
    expect(res.status).toBe(400);
  });

  it("updates status when valid", async () => {
    const res = await PATCH(patchReq({ id: "row-1", status: "invited" }));
    expect(res.status).toBe(200);
    expect(updateCalls).toEqual([
      { patch: { status: "invited" }, eq: { col: "id", val: "row-1" } },
    ]);
  });

  it("returns 500 on update error", async () => {
    updateError = { message: "db down" };
    const res = await PATCH(patchReq({ id: "row-1", status: "declined" }));
    expect(res.status).toBe(500);
  });
});
