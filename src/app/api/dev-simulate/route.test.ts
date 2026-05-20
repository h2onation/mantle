import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyAdmin = vi.fn();
vi.mock("@/lib/admin/verify-admin", () => ({
  verifyAdmin: () => mockVerifyAdmin(),
  requireAdmin: async () => {
    const r = await mockVerifyAdmin();
    if (!r.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    return { userId: r.userId, admin: createAdminClient() };
  },
}));

const insertCalls: Array<Record<string, unknown>> = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => chain;
    chain.insert = (row: Record<string, unknown>) => {
      insertCalls.push(row);
      return chain;
    };
    chain.eq = () => chain;
    chain.order = () => Promise.resolve({ data: [], error: null });
    chain.single = () =>
      Promise.resolve({ data: { id: "conv-test" }, error: null });
    return chain;
  },
}));

vi.mock("@/lib/persona/simulate-user", () => ({
  generateSimulatedUserMessage: vi.fn(async () => "[END]"),
}));

const callPersonaSpy = vi.fn();
vi.mock("@/lib/persona/call-persona", () => ({
  callPersona: (opts: Record<string, unknown>) => {
    callPersonaSpy(opts);
    return new ReadableStream({ start(c) { c.close(); } });
  },
  mapSystemMessages: (xs: unknown[]) => xs,
}));

import { POST } from "@/app/api/dev-simulate/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/dev-simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function consume(res: Response): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

beforeEach(() => {
  mockVerifyAdmin.mockReset();
  mockVerifyAdmin.mockResolvedValue({ userId: "admin-1", isAdmin: true });
  insertCalls.length = 0;
  callPersonaSpy.mockReset();
});

describe("/api/dev-simulate — input validation", () => {
  it("returns 400 when simulatedUserDescription is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when personaModes contains an invalid value", async () => {
    const res = await POST(
      makeRequest({
        simulatedUserDescription: "a user",
        personaModes: ["autistic", "audhd"],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/personaModes/);
  });

  it("returns 400 when mode is not a known value", async () => {
    const res = await POST(
      makeRequest({
        simulatedUserDescription: "a user",
        mode: "freeform",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/mode/);
  });

  it("returns 403 when caller is not admin", async () => {
    mockVerifyAdmin.mockResolvedValueOnce({ userId: "u1", isAdmin: false });
    const res = await POST(
      makeRequest({ simulatedUserDescription: "a user" })
    );
    expect(res.status).toBe(403);
  });
});

describe("/api/dev-simulate — happy path forwarding", () => {
  it("forwards mode to conversation insert", async () => {
    const res = await POST(
      makeRequest({
        simulatedUserDescription: "a user",
        mode: "guided-intake",
      })
    );
    expect(res.status).toBe(200);
    await consume(res);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      user_id: "admin-1",
      mode: "guided-intake",
    });
  });

  it("omits mode from insert when not provided (uses DB default)", async () => {
    const res = await POST(
      makeRequest({ simulatedUserDescription: "a user" })
    );
    expect(res.status).toBe(200);
    await consume(res);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toEqual({ user_id: "admin-1" });
  });
});
