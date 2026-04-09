import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockSignUp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { signUp: mockSignUp } }),
}));

let allowlistResponse: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let lastSelectEqArgs: { col: string; val: string } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.eq = (col: string, val: string) => {
      lastSelectEqArgs = { col, val };
      return chain;
    };
    chain.maybeSingle = () => Promise.resolve(allowlistResponse);
    return chain;
  },
}));

import { POST } from "@/app/api/auth/signup/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSignUp.mockReset();
  mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  allowlistResponse = { data: null, error: null };
  lastSelectEqArgs = null;
});

describe("POST /api/auth/signup", () => {
  it("returns 400 on invalid body", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when fields are missing", async () => {
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(400);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("returns 400 when email is empty after trim", async () => {
    const res = await POST(makeRequest({ email: "   ", password: "pw123456" }));
    expect(res.status).toBe(400);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("blocks signup when email is not on allowlist", async () => {
    allowlistResponse = { data: null, error: null };
    const res = await POST(
      makeRequest({ email: "Nope@Example.com", password: "pw123456" })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("not_allowlisted");
    expect(mockSignUp).not.toHaveBeenCalled();
    // Confirms we look up the lowercased + trimmed form
    expect(lastSelectEqArgs).toEqual({ col: "email", val: "nope@example.com" });
  });

  it("blocks signup when allowlist lookup errors (fail closed)", async () => {
    allowlistResponse = { data: null, error: { message: "db down" } };
    const res = await POST(
      makeRequest({ email: "yes@example.com", password: "pw123456" })
    );
    expect(res.status).toBe(403);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("proceeds with signUp when email is on allowlist", async () => {
    allowlistResponse = { data: { id: "row-1" }, error: null };
    const res = await POST(
      makeRequest({ email: "  Yes@Example.com  ", password: "pw123456" })
    );
    expect(res.status).toBe(200);
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    const args = mockSignUp.mock.calls[0][0];
    expect(args.email).toBe("yes@example.com");
    expect(args.password).toBe("pw123456");
    expect(args.options.emailRedirectTo).toBe(
      "http://localhost/auth/callback"
    );
  });

  it("surfaces Supabase signUp errors as 400", async () => {
    allowlistResponse = { data: { id: "row-1" }, error: null };
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: "Password should be at least 6 characters" },
    });
    const res = await POST(
      makeRequest({ email: "yes@example.com", password: "short" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Password should be at least 6 characters");
  });
});
