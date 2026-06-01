import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockRequireUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => mockRequireUser(),
}));

// Per-table delete error (null = success), the conversations read result, the
// auth-user delete error, and an ordered log of which deletes actually ran.
let deleteErrors: Record<string, { message: string } | null>;
let convReadResult: { data: unknown; error: unknown };
let authDeleteError: unknown;
let deleteCalls: string[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => Promise.resolve(convReadResult),
      }),
      delete: () => ({
        eq: () => {
          deleteCalls.push(table);
          return Promise.resolve({ error: deleteErrors[table] ?? null });
        },
        in: () => {
          deleteCalls.push(table);
          return Promise.resolve({ error: deleteErrors[table] ?? null });
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: () => {
          deleteCalls.push("auth.user");
          return Promise.resolve({ error: authDeleteError });
        },
      },
    },
  }),
}));

import { POST } from "@/app/api/account/delete/route";

beforeEach(() => {
  mockRequireUser.mockReset();
  mockRequireUser.mockReturnValue({ user: { id: "u1", email: "a@b.com" } });
  deleteErrors = {};
  convReadResult = { data: [{ id: "c1" }], error: null };
  authDeleteError = null;
  deleteCalls = [];
});

// --- Tests ---------------------------------------------------------------

describe("/api/account/delete", () => {
  it("deletes everything in FK-safe order and returns ok", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // manual_entries MUST come before messages (the RESTRICT FK), and the auth
    // user is deleted last.
    expect(deleteCalls.indexOf("manual_entries")).toBeLessThan(
      deleteCalls.indexOf("messages")
    );
    expect(deleteCalls[deleteCalls.length - 1]).toBe("auth.user");
    expect(deleteCalls).toEqual([
      "manual_entries",
      "messages",
      "conversations",
      "linq_group_chats",
      "profiles",
      "auth.user",
    ]);
  });

  // Fail-closed: a failed data delete must NOT reach the auth-user delete —
  // otherwise the login is gone while data is stranded behind it.
  it("aborts with 500 and never deletes the auth user when manual_entries delete fails", async () => {
    deleteErrors = { manual_entries: { message: "boom" } };
    const res = await POST();
    expect(res.status).toBe(500);
    expect(deleteCalls).toEqual(["manual_entries"]); // stopped immediately
    expect(deleteCalls).not.toContain("auth.user");
  });

  it("aborts with 500 and never deletes the auth user when messages delete fails", async () => {
    deleteErrors = { messages: { message: "fk violation" } };
    const res = await POST();
    expect(res.status).toBe(500);
    expect(deleteCalls).not.toContain("auth.user");
    expect(deleteCalls).not.toContain("profiles");
  });

  it("returns 500 if the auth-user delete itself fails (after all data is gone)", async () => {
    authDeleteError = { message: "auth down" };
    const res = await POST();
    expect(res.status).toBe(500);
    // It still attempted every data delete first.
    expect(deleteCalls).toContain("profiles");
    expect(deleteCalls[deleteCalls.length - 1]).toBe("auth.user");
  });

  it("returns the auth response (401) and deletes nothing when unauthenticated", async () => {
    mockRequireUser.mockReturnValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    );
    const res = await POST();
    expect(res.status).toBe(401);
    expect(deleteCalls).toHaveLength(0);
  });
});
