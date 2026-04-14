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
    chain.update = () => chain;
    chain.single = () => Promise.resolve({ data: null, error: null });
    return chain;
  },
}));

vi.mock("@/lib/persona/call-persona", () => ({
  callSage: () => new ReadableStream({ start(c) { c.close(); } }),
}));

vi.mock("@/lib/persona/confirm-checkpoint", () => ({
  confirmCheckpoint: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/persona/persona-pipeline", () => ({
  insertCheckpointActionMessage: vi.fn().mockResolvedValue(undefined),
}));

const mockCheckLimit = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
  };
});

import { POST } from "@/app/api/checkpoint/confirm/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/checkpoint/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: "m1",
      action: "confirmed",
      conversationId: "c1",
    }),
  });
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockCheckLimit.mockReset();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u1", is_anonymous: false } },
  });
});

describe("/api/checkpoint/confirm rate limit", () => {
  it("returns 429 when rate limited (before any DB read)", async () => {
    mockCheckLimit.mockResolvedValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 30_000,
      retryAfterSeconds: 30,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 401 when no user (rate limit not consulted)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockCheckLimit).not.toHaveBeenCalled();
  });
});
