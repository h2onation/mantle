import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

let manualComponentCount = 0;
// When set, the conversations.select("mode").eq("id", X).single() chain
// returns { data: { mode: <this value> } } — simulating a follow-up call
// reading mode back from an existing conversation row. Null returns
// { data: null }, which the route treats as "mode unknown, default cap."
let mockConvModeFromDb: string | null = null;
// The user_id returned for an existing-conversation read. Defaults to "u1"
// (the dominant test user) so the ownership guard passes; the IDOR test sets
// it to a different id to exercise the 404 path.
let mockConvOwnerId = "u1";
const insertedConv = { id: "conv-123" };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    let currentTable = "";
    let didInsert = false;
    chain.from = (t: string) => {
      currentTable = t;
      didInsert = false;
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
    chain.insert = () => {
      didInsert = true;
      return chain;
    };
    chain.single = () => {
      // Differentiate the insert.select("id").single() path (returns the
      // inserted conv row) from the select("mode").eq().single() path
      // (returns mode lookup).
      if (currentTable === "conversations" && !didInsert) {
        // Existing-conversation read: the route selects user_id (ownership)
        // and mode (length cap). Return both so the ownership guard runs.
        return Promise.resolve({
          data: { user_id: mockConvOwnerId, mode: mockConvModeFromDb },
          error: null,
        });
      }
      return Promise.resolve({ data: insertedConv, error: null });
    };
    return chain;
  },
}));

const mockCallPersona = vi.fn(() => new ReadableStream({ start(c) { c.close(); } }));
vi.mock("@/lib/persona/call-persona", () => ({
  callPersona: () => mockCallPersona(),
}));

const mockCheckLimits = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkLimits: (...args: unknown[]) => mockCheckLimits(...args),
  };
});

const mockCheckDailyMessageLimit = vi.fn();
vi.mock("@/lib/usage", () => ({
  checkDailyMessageLimit: (...args: unknown[]) => mockCheckDailyMessageLimit(...args),
}));

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
  mockCheckDailyMessageLimit.mockReset();
  mockCheckDailyMessageLimit.mockResolvedValue({
    allowed: true,
    count: 0,
    limit: 200,
  });
  manualComponentCount = 0;
  mockConvModeFromDb = null;
  mockConvOwnerId = "u1";
  mockCallPersona.mockClear();
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

  // Upload mode bumps the cap to MAX_UPLOAD_LENGTH (16000) so users can
  // paste an email thread or chat history. The audit S3 finding was that
  // none of this was tested — bumping/lowering either cap would have been
  // a silent regression. See pre-beta audit S3.
  it("allows upload-mode messages up to 16000 characters", async () => {
    const ok = "a".repeat(16000);
    const res = await POST(
      makeRequest({ message: ok, conversationId: null, mode: "upload" })
    );
    expect(res.status).toBe(200);
  });

  it("rejects upload-mode messages over 16000 characters with 400", async () => {
    const long = "a".repeat(16001);
    const res = await POST(
      makeRequest({ message: long, conversationId: null, mode: "upload" })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/upload is too long/i);
  });

  it("allows upload-mode messages over the 4000 normal cap (e.g. 8000 chars)", async () => {
    const longish = "a".repeat(8000);
    const res = await POST(
      makeRequest({ message: longish, conversationId: null, mode: "upload" })
    );
    expect(res.status).toBe(200);
  });

  it("non-upload modes still reject at 4001 (no leak of upload cap into other modes)", async () => {
    const long = "a".repeat(4001);
    const res = await POST(
      makeRequest({ message: long, conversationId: null, mode: "situation" })
    );
    expect(res.status).toBe(400);
  });

  // Follow-up messages don't carry `mode` in the request body — the
  // server reads it back from the DB so upload conversations get the
  // larger cap on subsequent turns too. This was uncovered before the
  // audit and is the path that breaks if someone "simplifies" the
  // route by trusting the request-body mode only.
  it("applies upload cap on a follow-up turn by reading mode from DB", async () => {
    mockConvModeFromDb = "upload";
    const longish = "a".repeat(8000);
    const res = await POST(
      makeRequest({ message: longish, conversationId: "conv-123" })
    );
    expect(res.status).toBe(200);
  });

  it("applies the normal 4k cap on a follow-up turn when DB mode is not upload", async () => {
    mockConvModeFromDb = "situation";
    const long = "a".repeat(4001);
    const res = await POST(
      makeRequest({ message: long, conversationId: "conv-123" })
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/chat — X-Conversation-Id header (Fix A)", () => {
  // The server returns the conversation id in a response header BEFORE
  // the SSE stream starts so the client can capture it even when the
  // upstream Anthropic call fails. Without this header, a first-time
  // failure prevented the client from learning the conversation id, and
  // retries created new ghost conversations. See the 2026-05-25
  // retry-storm incident.
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
  });

  it("sets X-Conversation-Id on the response when a new conversation is created", async () => {
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Conversation-Id")).toBe("conv-123");
  });

  it("sets X-Conversation-Id to the existing id when conversationId is provided", async () => {
    mockConvModeFromDb = "situation";
    const res = await POST(
      makeRequest({ message: "hi", conversationId: "conv-existing-xyz" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Conversation-Id")).toBe("conv-existing-xyz");
  });
});

describe("/api/chat — conversation ownership (IDOR guard)", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
  });

  // The route used to trust the client-supplied conversationId without
  // checking ownership. An authenticated user could pass another user's
  // conversation id and read their transcript into Jove's context or write
  // into their conversation (admin client bypasses RLS). Guard: reject with
  // 404 before callPersona runs. See flow-review-2026-05-29 finding #1.
  it("returns 404 and never calls callPersona when the conversation belongs to another user", async () => {
    mockConvOwnerId = "someone-else";
    mockConvModeFromDb = "situation";
    const res = await POST(
      makeRequest({ message: "hi", conversationId: "victim-conv-id" })
    );
    expect(res.status).toBe(404);
    expect(mockCallPersona).not.toHaveBeenCalled();
    // No stream started → no conversation-id header leaked.
    expect(res.headers.get("X-Conversation-Id")).toBeNull();
  });

  it("lets the owner through to the stream", async () => {
    mockConvOwnerId = "u1";
    mockConvModeFromDb = "situation";
    const res = await POST(
      makeRequest({ message: "hi", conversationId: "my-conv-id" })
    );
    expect(res.status).toBe(200);
    expect(mockCallPersona).toHaveBeenCalledTimes(1);
    expect(res.headers.get("X-Conversation-Id")).toBe("my-conv-id");
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

  it("blocks anonymous user with 2+ confirmed entries (signup_required, NOT 429)", async () => {
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

describe("/api/chat — conversation mode validation", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
  });

  it("accepts mode 'guided-intake' and returns 200", async () => {
    const res = await POST(
      makeRequest({ message: "hi", conversationId: null, mode: "guided-intake" })
    );
    expect(res.status).toBe(200);
  });

  it("accepts mode 'situation' and returns 200", async () => {
    const res = await POST(
      makeRequest({ message: "hi", conversationId: null, mode: "situation" })
    );
    expect(res.status).toBe(200);
  });

  it("defaults to 'situation' when mode is omitted", async () => {
    const res = await POST(
      makeRequest({ message: "hi", conversationId: null })
    );
    expect(res.status).toBe(200);
  });

  it("rejects invalid mode with 400", async () => {
    const res = await POST(
      makeRequest({ message: "hi", conversationId: null, mode: "turbo" })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid mode/i);
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

describe("/api/chat — daily message limit (Postgres-backed)", () => {
  it("returns 429 with error 'daily_limit_reached' when limit is hit", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
    mockCheckDailyMessageLimit.mockResolvedValueOnce({
      allowed: false,
      count: 200,
      limit: 200,
    });
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      error: string;
      message: string;
      count: number;
      limit: number;
    };
    expect(body.error).toBe("daily_limit_reached");
    expect(body.limit).toBe(200);
    expect(body.count).toBe(200);
    expect(body.message).toMatch(/today's message limit/i);
    expect(body.message).toMatch(/midnight utc/i);
  });

  it("skips the daily-limit check when message is null (server-triggered opener)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
    // Even if the cap is hit, message:null bypasses the check
    mockCheckDailyMessageLimit.mockResolvedValue({
      allowed: false,
      count: 999,
      limit: 200,
    });
    const res = await POST(
      makeRequest({ message: null, conversationId: null, mode: "guided-intake" })
    );
    expect(res.status).toBe(200);
    // Confirm the helper wasn't consulted in the message:null path
    expect(mockCheckDailyMessageLimit).not.toHaveBeenCalled();
  });

  it("allows the request when allowed=true", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com", is_anonymous: false } },
    });
    mockCheckDailyMessageLimit.mockResolvedValueOnce({
      allowed: true,
      count: 50,
      limit: 200,
    });
    const res = await POST(makeRequest({ message: "hi", conversationId: null }));
    expect(res.status).toBe(200);
  });
});
