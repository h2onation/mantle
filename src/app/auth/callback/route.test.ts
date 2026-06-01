import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockExchange = vi.fn();
const mockIsAllowlisted = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [] }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { exchangeCodeForSession: (...a: unknown[]) => mockExchange(...a) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: (...a: unknown[]) => mockDeleteUser(...a) } },
  }),
}));

vi.mock("@/lib/beta-allowlist", () => ({
  isEmailAllowlisted: (...a: unknown[]) => mockIsAllowlisted(...a),
}));

import { GET } from "@/app/auth/callback/route";

function callbackRequest(params = "code=abc") {
  return new Request(`http://localhost/auth/callback?${params}`);
}

const NOW_ISO = new Date().toISOString();
const OLD_ISO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago

beforeEach(() => {
  mockExchange.mockReset();
  mockIsAllowlisted.mockReset();
  mockDeleteUser.mockClear();
});

// --- Tests ---------------------------------------------------------------

describe("/auth/callback — OAuth beta allowlist gate", () => {
  it("redirects an allowlisted new user to /app and never deletes them", async () => {
    mockExchange.mockResolvedValue({
      data: { user: { id: "new1", email: "ok@b.com", created_at: NOW_ISO } },
      error: null,
    });
    mockIsAllowlisted.mockResolvedValue(true);
    const res = await GET(callbackRequest());
    expect(res.headers.get("location")).toBe("http://localhost/app");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("blocks a non-allowlisted NEW user and deletes the just-created row", async () => {
    mockExchange.mockResolvedValue({
      data: { user: { id: "new2", email: "no@b.com", created_at: NOW_ISO } },
      error: null,
    });
    mockIsAllowlisted.mockResolvedValue(false);
    const res = await GET(callbackRequest());
    expect(res.headers.get("location")).toBe(
      "http://localhost/waitlist?reason=not_allowlisted"
    );
    expect(mockDeleteUser).toHaveBeenCalledWith("new2");
  });

  // THE FIX: a non-allowlisted user whose account is older than the 60s window
  // used to skip the check entirely and land in /app. Now they're blocked.
  it("blocks a non-allowlisted RETURNING user (older than the window) instead of admitting them", async () => {
    mockExchange.mockResolvedValue({
      data: { user: { id: "old1", email: "sneaky@b.com", created_at: OLD_ISO } },
      error: null,
    });
    mockIsAllowlisted.mockResolvedValue(false);
    const res = await GET(callbackRequest());
    expect(res.headers.get("location")).toBe(
      "http://localhost/waitlist?reason=not_allowlisted"
    );
    // We block but do NOT delete an established account.
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("lets an allowlisted returning user into /app", async () => {
    mockExchange.mockResolvedValue({
      data: { user: { id: "old2", email: "member@b.com", created_at: OLD_ISO } },
      error: null,
    });
    mockIsAllowlisted.mockResolvedValue(true);
    const res = await GET(callbackRequest());
    expect(res.headers.get("location")).toBe("http://localhost/app");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("still blocks (signs out) when not allowlisted even if deleteUser throws", async () => {
    mockExchange.mockResolvedValue({
      data: { user: { id: "new3", email: "no2@b.com", created_at: NOW_ISO } },
      error: null,
    });
    mockIsAllowlisted.mockResolvedValue(false);
    mockDeleteUser.mockRejectedValueOnce(new Error("delete failed"));
    const res = await GET(callbackRequest());
    expect(res.headers.get("location")).toBe(
      "http://localhost/waitlist?reason=not_allowlisted"
    );
  });

  it("redirects to /login on an exchange error and never checks the allowlist", async () => {
    mockExchange.mockResolvedValue({
      data: null,
      error: { message: "bad code" },
    });
    const res = await GET(callbackRequest());
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=reset_link_expired"
    );
    expect(mockIsAllowlisted).not.toHaveBeenCalled();
  });
});
