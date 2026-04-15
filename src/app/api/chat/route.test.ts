import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

let manualComponentCount = 0;
const insertedConv = { id: "conv-123" };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    let currentTable = "";
    chain.from = (t: string) => {
      currentTable = t;
      return chain;
    };
    chain.select = () => chain;
    chain.eq = () => {
      if (currentTable === "manual_entries") {
        return Promise.resolve({ count: manualComponentCount, data: null, error: null });
      }
      return chain;
    };
    chain.upsert = () => Promise.resolve({ data: null, error: null });
    chain.insert = () => chain;
    chain.single = () => Promise.resolve({ data: insertedConv, error: null });
    return chain;
  },
}));

vi.mock("@/lib/persona/call-persona", () => ({
  callPersona: () => new ReadableStream({ start(c) { c.close(); } }),
}));

const mockCheckLimits = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkLimits: (...args: unknown[]) => mockCheckLimits(...args),
  };
});

import { POST } from "@/app/api/chat/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockCheckLimits.mockReset();
  mockCheckLimits.mockResolvedValue({
    success: true,
    limit: 0,
    remaining: 0,
    reset: 0,
  });
  manualComponentCount = 0;
});

// --- Tests ---------------------------------------------------------------

describe("/api/chat — auth", () => {
  it("returns 401 when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(401);
  });
});

describe("/api/chat — message length", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
  });

  it("rejects messages over 4000 characters with 400", async () => {
    const long = "a".repeat(4001);
    const res = await POST(makeRequest({ message: long, conversationId: null }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/too long/i);
  });

  it("allows messages exactly at 4000 characters", async () => {
    const ok = "a".repeat(4000);
    const res = await POST(makeRequest({ message: ok, conversationId: null }));
    expect(res.status).toBe(200);
  });
});

describe("/api/chat — authenticated rate limits", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-auth", email: "a@b.com", is_anonymous: false } },
    });
  });

  it("uses authenticated limiters (15/min + 100/day) keyed by user id", async () => {
    await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(mockCheckLimits).toHaveBeenCalledTimes(1);
    const [limiters, key] = mockCheckLimits.mock.calls[0];
    expect(key).toBe("user-auth");
    // Two windows passed: per-minute and per-day
    expect((limiters as unknown[]).length).toBe(2);
  });

  it("returns 429 when authenticated user is rate limited", async () => {
    mockCheckLimits.mockResolvedValue({
      success: false,
      limit: 15,
      remaining: 0,
      reset: Date.now() + 30_000,
      retryAfterSeconds: 30,
    });
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/too quickly/i);
  });
});

describe("/api/chat — anonymous user gates", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-anon", email: "", is_anonymous: true } },
    });
  });

  it("blocks anonymous user with 2+ confirmed components (signup_required, NOT 429)", async () => {
    manualComponentCount = 2;
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      blocked: boolean;
      reason: string;
      message: string;
    };
    expect(body.blocked).toBe(true);
    expect(body.reason).toBe("signup_required");
    expect(body.message).toMatch(/account/i);
    // Critically: rate limiter must NOT have been called
    expect(mockCheckLimits).not.toHaveBeenCalled();
  });

  it("allows anonymous user with 0 components through to rate limiter", async () => {
    manualComponentCount = 0;
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(200);
    expect(mockCheckLimits).toHaveBeenCalledTimes(1);
  });

  it("allows anonymous user with 1 component through to rate limiter", async () => {
    manualComponentCount = 1;
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(200);
    expect(mockCheckLimits).toHaveBeenCalledTimes(1);
  });

  it("uses anonymous limiters keyed by user id", async () => {
    manualComponentCount = 0;
    await POST(makeRequest({ message: "hi", conversationId: null }));
    const [limiters, key] = mockCheckLimits.mock.calls[0];
    expect(key).toBe("user-anon");
    expect((limiters as unknown[]).length).toBe(2);
  });

  it("returns 429 when anonymous user exceeds rate limit (gate B passed)", async () => {
    manualComponentCount = 0;
    mockCheckLimits.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 10_000,
      retryAfterSeconds: 10,
    });
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(429);
  });
});

describe("/api/chat — fail open when Upstash unavailable", () => {
  it("proceeds normally when limiters return success (null/missing env)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
    // Simulate the fail-open default (what checkLimit returns on null limiter)
    mockCheckLimits.mockResolvedValue({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(200);
  });
});
