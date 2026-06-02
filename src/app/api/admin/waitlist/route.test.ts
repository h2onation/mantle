import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyAdmin = vi.fn();
vi.mock("@/lib/admin/verify-admin", () => ({
  verifyAdmin: () => mockVerifyAdmin(),
  requireAdmin: async () => {
    const r = await mockVerifyAdmin();
    if (!r.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    return { userId: r.userId, admin: createAdminClient() };
  },
}));

// Configurable per-operation responses.
let listResponse: { data: unknown; error: unknown } = { data: [], error: null };
let lookupResponse: { data: unknown; error: unknown } = { data: null, error: null };
let updateError: unknown = null;
let insertError: unknown = null;

const updateCalls: Array<{ patch: Record<string, unknown>; eq: { col: string; val: string } }> = [];
const insertCalls: Array<Record<string, unknown>> = [];
let lastOrderArgs: { col: string; opts: unknown } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  // Each .from() returns a fresh builder so per-query mode is isolated.
  createAdminClient: () => ({
    from: () => {
      let mode: "select" | "update" | "insert" | null = null;
      let patch: Record<string, unknown> | null = null;
      const b: Record<string, unknown> = {};
      b.select = () => {
        mode = "select";
        return b;
      };
      b.update = (p: Record<string, unknown>) => {
        mode = "update";
        patch = p;
        return b;
      };
      b.insert = (vals: Record<string, unknown>) => {
        insertCalls.push(vals);
        return Promise.resolve({ error: insertError });
      };
      b.order = (col: string, opts: unknown) => {
        lastOrderArgs = { col, opts };
        return Promise.resolve(listResponse);
      };
      b.eq = (col: string, val: string) => {
        if (mode === "update") {
          updateCalls.push({ patch: patch!, eq: { col, val } });
          return Promise.resolve({ data: null, error: updateError });
        }
        return b; // select mode — chainable
      };
      b.maybeSingle = () => Promise.resolve(lookupResponse);
      return b;
    },
  }),
}));

// auth.users join for invited-row login enrichment.
let authUsers: Array<{ email: string; last_sign_in_at: string | null; created_at: string }> = [];
vi.mock("@/lib/admin/list-auth-users", () => ({
  listAllAuthUsers: async () => ({ users: authUsers, emailMap: {} }),
}));

import { GET, PATCH, POST } from "@/app/api/admin/waitlist/route";

beforeEach(() => {
  mockVerifyAdmin.mockReset();
  mockVerifyAdmin.mockResolvedValue({ userId: "u1", isAdmin: true });
  listResponse = { data: [], error: null };
  lookupResponse = { data: null, error: null };
  updateError = null;
  insertError = null;
  updateCalls.length = 0;
  insertCalls.length = 0;
  lastOrderArgs = null;
  authUsers = [];
});

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/waitlist", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/waitlist", {
    method: "POST",
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
      { id: "a", email: "x@y.com", source: null, status: "waiting", seen: false, notes: null, created_at: "2026-04-08T00:00:00Z" },
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

  it("enriches invited rows with auth login activity", async () => {
    listResponse = {
      data: [
        { id: "a", email: "in@y.com", source: null, status: "invited", seen: true, notes: null, invited_at: "2026-05-01T00:00:00Z", created_at: "2026-04-08T00:00:00Z" },
        { id: "b", email: "wait@y.com", source: null, status: "waiting", seen: false, notes: null, invited_at: null, created_at: "2026-04-09T00:00:00Z" },
      ],
      error: null,
    };
    authUsers = [
      { email: "In@Y.com", last_sign_in_at: "2026-05-20T00:00:00Z", created_at: "2026-05-02T00:00:00Z" },
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    const { items } = await res.json();
    // invited row gets login fields (matched case-insensitively)
    expect(items[0]).toMatchObject({
      id: "a",
      last_sign_in_at: "2026-05-20T00:00:00Z",
      first_sign_in_at: "2026-05-02T00:00:00Z",
    });
    // waiting row has no auth account → no login fields added
    expect(items[1].last_sign_in_at).toBeUndefined();
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

  it("stamps invited_at when inviting", async () => {
    const res = await PATCH(patchReq({ id: "row-1", status: "invited" }));
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].eq).toEqual({ col: "id", val: "row-1" });
    expect(updateCalls[0].patch.status).toBe("invited");
    expect(typeof updateCalls[0].patch.invited_at).toBe("string");
  });

  it("does not stamp invited_at for a non-invite status change", async () => {
    const res = await PATCH(patchReq({ id: "row-1", status: "declined" }));
    expect(res.status).toBe(200);
    expect(updateCalls).toEqual([
      { patch: { status: "declined" }, eq: { col: "id", val: "row-1" } },
    ]);
  });

  it("returns 500 on update error", async () => {
    updateError = { message: "db down" };
    const res = await PATCH(patchReq({ id: "row-1", status: "declined" }));
    expect(res.status).toBe(500);
  });

  it("marks a row seen", async () => {
    const res = await PATCH(patchReq({ id: "row-1", seen: true }));
    expect(res.status).toBe(200);
    expect(updateCalls).toEqual([
      { patch: { seen: true }, eq: { col: "id", val: "row-1" } },
    ]);
  });

  it("prefers seen over status when both are present", async () => {
    const res = await PATCH(patchReq({ id: "row-1", seen: false, status: "invited" }));
    expect(res.status).toBe(200);
    expect(updateCalls).toEqual([
      { patch: { seen: false }, eq: { col: "id", val: "row-1" } },
    ]);
  });
});

describe("POST /api/admin/waitlist (manual invite)", () => {
  it("returns 403 when not admin", async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: "", isAdmin: false });
    const res = await POST(postReq({ email: "a@b.com" }));
    expect(res.status).toBe(403);
    expect(insertCalls).toHaveLength(0);
  });

  it("rejects a missing/blank email", async () => {
    const res = await POST(postReq({ email: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_email");
  });

  it("rejects a malformed email", async () => {
    const res = await POST(postReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("inserts a new invited (seen) row when the email is new", async () => {
    lookupResponse = { data: null, error: null };
    const res = await POST(postReq({ email: "  New@Example.com " }));
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("added");
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      email: "new@example.com",
      status: "invited",
      seen: true,
    });
  });

  it("promotes an existing non-invited row to invited", async () => {
    lookupResponse = { data: { id: "row-9", status: "waiting" }, error: null };
    const res = await POST(postReq({ email: "wait@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("added");
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].eq).toEqual({ col: "id", val: "row-9" });
    expect(updateCalls[0].patch.status).toBe("invited");
    expect(typeof updateCalls[0].patch.invited_at).toBe("string");
  });

  it("returns already_exists when the email is already invited", async () => {
    lookupResponse = { data: { id: "row-9", status: "invited" }, error: null };
    const res = await POST(postReq({ email: "yes@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("already_exists");
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
  });

  it("returns 500 on insert error", async () => {
    lookupResponse = { data: null, error: null };
    insertError = { message: "db down" };
    const res = await POST(postReq({ email: "new@example.com" }));
    expect(res.status).toBe(500);
  });
});
