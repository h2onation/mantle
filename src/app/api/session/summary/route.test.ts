import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.single = () =>
      Promise.resolve({ data: { id: "c1", user_id: "u1" }, error: null });
    return chain;
  },
}));

vi.mock("@/lib/persona/generate-summary", () => ({
  generateSessionSummary: vi.fn().mockResolvedValue("summary text"),
}));

const mockCheckLimit = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
  };
});

import { POST } from "@/app/api/session/summary/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/session/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId: "c1" }),
  });
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockCheckLimit.mockReset();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u1", is_anonymous: false } },
  });
});

describe("/api/session/summary rate limit", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("proceeds when allowed", async () => {
    mockCheckLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 0,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });
});
