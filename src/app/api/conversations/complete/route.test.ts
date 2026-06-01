import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockRequireUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: () => mockRequireUser(),
}));

const mockCheckLimit = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, checkLimit: (...a: unknown[]) => mockCheckLimit(...a) };
});

const mockGenerateSummary = vi.fn(() => Promise.resolve("a summary"));
vi.mock("@/lib/persona/generate-summary", () => ({
  generateSessionSummary: () => mockGenerateSummary(),
}));

let convRow: { id: string; user_id: string; summary: string | null } | null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: convRow, error: null }) }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

import { POST } from "@/app/api/conversations/complete/route";

function req(body: unknown = { conversationId: "c1" }): Request {
  return new Request("http://localhost/api/conversations/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockRequireUser.mockReset();
  mockRequireUser.mockReturnValue({ user: { id: "u1", email: "a@b.com" } });
  mockCheckLimit.mockReset();
  mockCheckLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 });
  mockGenerateSummary.mockClear();
  convRow = { id: "c1", user_id: "u1", summary: null };
});

// --- Tests ---------------------------------------------------------------

describe("/api/conversations/complete", () => {
  it("returns 429 and never calls the summary (Anthropic) when rate-limited", async () => {
    mockCheckLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: 9999999999999,
      retryAfterSeconds: 3600,
    });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(mockGenerateSummary).not.toHaveBeenCalled();
  });

  it("returns 404 when the conversation belongs to another user", async () => {
    convRow = { id: "c1", user_id: "someone-else", summary: null };
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(mockGenerateSummary).not.toHaveBeenCalled();
  });

  it("generates a summary on completion when none exists", async () => {
    convRow = { id: "c1", user_id: "u1", summary: null };
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — skips summary generation when one already exists", async () => {
    convRow = { id: "c1", user_id: "u1", summary: "already here" };
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockGenerateSummary).not.toHaveBeenCalled();
  });
});
