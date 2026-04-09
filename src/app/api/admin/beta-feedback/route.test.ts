import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyAdmin = vi.fn();
vi.mock("@/lib/admin/verify-admin", () => ({
  verifyAdmin: () => mockVerifyAdmin(),
}));

let listUsersResponse: { data: { users: Array<{ id: string; email: string }> }; error: unknown } = {
  data: { users: [] },
  error: null,
};
let feedbackResponse: { data: unknown; error: unknown } = { data: [], error: null };
let updateError: unknown = null;
const updateCalls: Array<{ patch: Record<string, unknown>; eq: { col: string; val: string } }> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    let pendingPatch: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.order = () => Promise.resolve(feedbackResponse);
    chain.update = (patch: Record<string, unknown>) => {
      pendingPatch = patch;
      return chain;
    };
    chain.eq = (col: string, val: string) => {
      updateCalls.push({ patch: pendingPatch!, eq: { col, val } });
      pendingPatch = null;
      return Promise.resolve({ data: null, error: updateError });
    };
    chain.auth = {
      admin: {
        listUsers: () => Promise.resolve(listUsersResponse),
      },
    };
    return chain;
  },
}));

import { GET, PATCH } from "@/app/api/admin/beta-feedback/route";

beforeEach(() => {
  mockVerifyAdmin.mockReset();
  mockVerifyAdmin.mockResolvedValue({ userId: "u1", isAdmin: true });
  listUsersResponse = { data: { users: [] }, error: null };
  feedbackResponse = { data: [], error: null };
  updateError = null;
  updateCalls.length = 0;
});

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/beta-feedback", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/admin/beta-feedback", () => {
  it("returns 403 when not admin", async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: "", isAdmin: false });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("joins user_id to email and computes unread count", async () => {
    listUsersResponse = {
      data: {
        users: [
          { id: "u-a", email: "a@example.com" },
          { id: "u-b", email: "b@example.com" },
        ],
      },
      error: null,
    };
    feedbackResponse = {
      data: [
        { id: "f1", user_id: "u-a", page_context: "/", feedback_text: "hi", is_read: false, created_at: "2026-04-08T01:00:00Z" },
        { id: "f2", user_id: "u-b", page_context: null, feedback_text: "ok", is_read: true, created_at: "2026-04-08T00:00:00Z" },
        { id: "f3", user_id: "u-missing", page_context: "/x", feedback_text: "?", is_read: false, created_at: "2026-04-07T00:00:00Z" },
      ],
      error: null,
    };

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unread_count).toBe(2);
    expect(body.items[0]).toMatchObject({ id: "f1", user_email: "a@example.com" });
    expect(body.items[1]).toMatchObject({ id: "f2", user_email: "b@example.com" });
    expect(body.items[2]).toMatchObject({ id: "f3", user_email: "Unknown" });
  });

  it("returns 500 on auth list error", async () => {
    listUsersResponse = { data: { users: [] }, error: { message: "auth down" } as unknown as null };
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 on feedback fetch error", async () => {
    feedbackResponse = { data: null, error: { message: "db down" } };
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/beta-feedback", () => {
  it("returns 403 when not admin", async () => {
    mockVerifyAdmin.mockResolvedValue({ userId: "", isAdmin: false });
    const res = await PATCH(patchReq({ id: "f1" }));
    expect(res.status).toBe(403);
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects missing id", async () => {
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects malformed json", async () => {
    const res = await PATCH(patchReq("not json"));
    expect(res.status).toBe(400);
  });

  it("marks the row as read", async () => {
    const res = await PATCH(patchReq({ id: "f1" }));
    expect(res.status).toBe(200);
    expect(updateCalls).toEqual([
      { patch: { is_read: true }, eq: { col: "id", val: "f1" } },
    ]);
  });

  it("returns 500 on update error", async () => {
    updateError = { message: "db down" };
    const res = await PATCH(patchReq({ id: "f1" }));
    expect(res.status).toBe(500);
  });
});
