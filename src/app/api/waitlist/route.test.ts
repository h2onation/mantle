import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Admin client mock ---------------------------------------------------

let lookupResponse: { data: unknown; error: unknown } = { data: null, error: null };
let insertError: unknown = null;
let insertedRows: Array<Record<string, unknown>> = [];
let lastLookupEq: { col: string; val: string } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    let mode: "lookup" | "insert" = "lookup";
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.select = () => {
      mode = "lookup";
      return chain;
    };
    chain.eq = (col: string, val: string) => {
      lastLookupEq = { col, val };
      return chain;
    };
    chain.maybeSingle = () => Promise.resolve(lookupResponse);
    chain.insert = (row: Record<string, unknown>) => {
      mode = "insert";
      insertedRows.push(row);
      return Promise.resolve({ data: null, error: insertError });
    };
    // referenced so TS/lint don't complain about unused mode tracking
    void mode;
    return chain;
  },
}));

// --- Rate limit mock -----------------------------------------------------

const mockCheckLimit = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
  };
});

import { POST } from "@/app/api/waitlist/route";
import type { NextRequest } from "next/server";

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { "x-forwarded-for": "1.2.3.4" }
): NextRequest {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  mockCheckLimit.mockReset();
  mockCheckLimit.mockResolvedValue({
    success: true,
    limit: 3,
    remaining: 2,
    reset: 0,
  });
  lookupResponse = { data: null, error: null };
  insertError = null;
  insertedRows = [];
  lastLookupEq = null;
});

describe("POST /api/waitlist", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckLimit.mockResolvedValue({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(429);
    expect(insertedRows).toHaveLength(0);
  });

  it("rate limit key uses the first x-forwarded-for entry", async () => {
    await POST(
      makeRequest(
        { email: "a@b.com" },
        { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }
      )
    );
    expect(mockCheckLimit.mock.calls[0][1]).toBe("203.0.113.7");
  });

  it("returns 400 on invalid body json", async () => {
    const res = await POST(makeRequest("not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ source: "twitter" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when source is wrong type", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", source: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_email");
  });

  it("returns already_listed when email exists", async () => {
    lookupResponse = { data: { id: "row-1" }, error: null };
    const res = await POST(
      makeRequest({ email: "  Existing@Example.com ", source: "x" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_listed");
    expect(insertedRows).toHaveLength(0);
    expect(lastLookupEq).toEqual({ col: "email", val: "existing@example.com" });
  });

  it("inserts a new normalized row when email is new", async () => {
    const res = await POST(
      makeRequest({
        email: "  New@Example.com  ",
        source: "  saw a tweet  ",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("added");
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toEqual({
      email: "new@example.com",
      source: "saw a tweet",
    });
  });

  it("stores null source when blank or absent", async () => {
    await POST(makeRequest({ email: "a@b.com", source: "   " }));
    expect(insertedRows[0].source).toBeNull();

    insertedRows = [];
    await POST(makeRequest({ email: "c@d.com" }));
    expect(insertedRows[0].source).toBeNull();
  });

  it("treats unique-violation race as already_listed", async () => {
    insertError = { code: "23505", message: "duplicate key" };
    const res = await POST(makeRequest({ email: "race@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_listed");
  });

  it("returns 500 on unexpected insert error", async () => {
    insertError = { code: "42P01", message: "table missing" };
    const res = await POST(makeRequest({ email: "x@y.com" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected lookup error", async () => {
    lookupResponse = { data: null, error: { message: "db down" } };
    const res = await POST(makeRequest({ email: "x@y.com" }));
    expect(res.status).toBe(500);
  });

  it("truncates oversized source field", async () => {
    const longSource = "a".repeat(2000);
    await POST(makeRequest({ email: "long@example.com", source: longSource }));
    expect((insertedRows[0].source as string).length).toBe(500);
  });
});
