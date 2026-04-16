import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

// Admin client returns a checkpoint message by default. Tests that need
// a different shape mutate adminMessageResponse before invoking POST.
let adminMessageResponse: { data: unknown; error: unknown } = {
  data: {
    id: "m1",
    conversation_id: "c1",
    content: "msg content",
    is_checkpoint: true,
    checkpoint_meta: { layer: 1, name: "Test", status: "pending" },
  },
  error: null,
};
let adminConvResponse: { data: unknown; error: unknown } = {
  data: { user_id: "u1" },
  error: null,
};
let adminSelectCallCount = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.update = () => chain;
    chain.single = () => {
      adminSelectCallCount++;
      // Route reads messages first, then conversations.
      if (adminSelectCallCount === 1) {
        return Promise.resolve(adminMessageResponse);
      }
      return Promise.resolve(adminConvResponse);
    };
    return chain;
  },
}));

vi.mock("@/lib/persona/call-persona", () => ({
  callPersona: () => new ReadableStream({ start(c) { c.close(); } }),
}));

const mockConfirmCheckpoint = vi.fn();
vi.mock("@/lib/persona/confirm-checkpoint", () => ({
  confirmCheckpoint: (...args: unknown[]) => mockConfirmCheckpoint(...args),
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
  mockConfirmCheckpoint.mockReset();
  adminSelectCallCount = 0;
  adminMessageResponse = {
    data: {
      id: "m1",
      conversation_id: "c1",
      content: "msg content",
      is_checkpoint: true,
      checkpoint_meta: { layer: 1, name: "Test", status: "pending" },
    },
    error: null,
  };
  adminConvResponse = { data: { user_id: "u1" }, error: null };
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u1", is_anonymous: false } },
  });
  mockCheckLimit.mockResolvedValue({
    success: true,
    limit: 20,
    remaining: 19,
    reset: Date.now() + 3_600_000,
  });
  mockConfirmCheckpoint.mockResolvedValue({
    success: true,
    componentId: "entry-1",
    wasAlreadyConfirmed: false,
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

describe("/api/checkpoint/confirm error mapping", () => {
  it("returns 404 when confirmCheckpoint reports Checkpoint not found", async () => {
    mockConfirmCheckpoint.mockResolvedValue({
      success: false,
      error: "Checkpoint not found.",
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Checkpoint not found.");
  });

  it("returns 400 when confirmCheckpoint reports rejected/refined", async () => {
    mockConfirmCheckpoint.mockResolvedValue({
      success: false,
      error: "Checkpoint was rejected or refined.",
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Checkpoint was rejected or refined.");
  });

  it("returns 500 on other confirmCheckpoint failures", async () => {
    mockConfirmCheckpoint.mockResolvedValue({
      success: false,
      error: "Failed to write entry to manual.",
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

describe("/api/checkpoint/confirm idempotency", () => {
  it("returns JSON ack (not SSE stream) when wasAlreadyConfirmed", async () => {
    mockConfirmCheckpoint.mockResolvedValue({
      success: true,
      componentId: "entry-1",
      wasAlreadyConfirmed: true,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body.alreadyConfirmed).toBe(true);
    expect(body.conversationId).toBe("c1");
    expect(body.messageId).toBe("m1");
  });

  it("returns SSE stream on fresh confirm (not idempotent repeat)", async () => {
    mockConfirmCheckpoint.mockResolvedValue({
      success: true,
      componentId: "entry-1",
      wasAlreadyConfirmed: false,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
