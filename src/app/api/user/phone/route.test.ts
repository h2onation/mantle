import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

// Supabase admin mock: a chain builder that resolves to configurable
// responses per-table and captures mutations for inspection.
type AdminResp = { data: unknown; error: unknown };
let selectResponses: Record<string, AdminResp> = {};
let insertedRows: Array<{ table: string; row: Record<string, unknown> }> = [];
let updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
let insertError: unknown = null;
let updateError: unknown = null;

function resetAdminMock() {
  selectResponses = {};
  insertedRows = [];
  updates = [];
  insertError = null;
  updateError = null;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    let currentTable = "";
    // Track which kind of read is happening so we can return different
    // responses when a single route does two selects on the same table.
    let selectKey = "";
    const chain: Record<string, unknown> = {};
    chain.from = (t: string) => {
      currentTable = t;
      selectKey = t;
      return chain;
    };
    chain.select = () => {
      selectKey = currentTable;
      return chain;
    };
    chain.eq = (col: string) => {
      selectKey = `${selectKey}:${col}`;
      return chain;
    };
    chain.maybeSingle = () => {
      // Prefer a specific keyed response, else fall back to table-level.
      const r =
        selectResponses[selectKey] ??
        selectResponses[currentTable] ??
        { data: null, error: null };
      return Promise.resolve(r);
    };
    chain.single = () =>
      Promise.resolve(
        selectResponses[currentTable] ?? { data: null, error: null }
      );
    chain.insert = (row: Record<string, unknown>) => {
      insertedRows.push({ table: currentTable, row });
      // insert().select().single() chain for conversations — return a fake id
      const followup: Record<string, unknown> = {};
      followup.select = () => followup;
      followup.single = () =>
        Promise.resolve({ data: { id: "conv-new" }, error: insertError });
      // Make bare insert thenable too
      (followup as { then?: unknown }).then = (
        resolve: (v: AdminResp) => void
      ) => Promise.resolve({ data: null, error: insertError }).then(resolve);
      return followup;
    };
    chain.update = (patch: Record<string, unknown>) => {
      updates.push({ table: currentTable, patch });
      const followup: Record<string, unknown> = {};
      followup.eq = () => followup;
      (followup as { then?: unknown }).then = (
        resolve: (v: AdminResp) => void
      ) => Promise.resolve({ data: null, error: updateError }).then(resolve);
      return followup;
    };
    chain.order = () => chain;
    chain.limit = () => chain;
    return chain;
  },
}));

const mockSendMessage = vi.fn();
vi.mock("@/lib/messaging/send", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const mockCheckLimit = vi.fn();
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit"
  );
  return {
    ...actual,
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
  };
});

import { POST as phonePOST } from "@/app/api/user/phone/route";
import { POST as verifyPOST } from "@/app/api/user/phone/verify/route";
import { hashOtp } from "@/lib/phone-otp";

function phoneRequest(body: unknown): import("next/server").NextRequest {
  return new Request("http://localhost/api/user/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function verifyRequest(body: unknown): import("next/server").NextRequest {
  return new Request("http://localhost/api/user/phone/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  resetAdminMock();
  mockGetUser.mockReset();
  mockSendMessage.mockReset();
  mockCheckLimit.mockReset();
  mockCheckLimit.mockResolvedValue({
    success: true,
    limit: 0,
    remaining: 0,
    reset: 0,
  });
  mockSendMessage.mockResolvedValue({
    providerMessageId: "msg-1",
    provider: "sendblue",
    status: "SENT",
    errorMessage: null,
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-A" } } });
});

// --- POST /api/user/phone — OTP send ------------------------------------

describe("POST /api/user/phone (send OTP)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing phone", async () => {
    const res = await phonePOST(phoneRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed phone", async () => {
    const res = await phonePOST(phoneRequest({ phone_number: "not-a-phone" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 and does NOT reassign when phone belongs to another verified user", async () => {
    selectResponses["phone_numbers"] = {
      data: { user_id: "user-B", verified: true },
      error: null,
    };
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(409);
    // No inserts, no verified mutations
    expect(insertedRows).toHaveLength(0);
    const verifiedWrites = updates.filter(
      (u) => (u.patch as { verified?: unknown }).verified === true
    );
    expect(verifiedWrites).toHaveLength(0);
    // Messaging must NOT have been called — no OTP sent to victim's phone
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("returns 200 verified when same user already has phone verified", async () => {
    selectResponses["phone_numbers"] = {
      data: { user_id: "user-A", verified: true },
      error: null,
    };
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean };
    expect(body.verified).toBe(true);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("returns 429 when phone OTP send is rate limited", async () => {
    mockCheckLimit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(429);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("generates hashed OTP, stores it with verified=false, sends via messaging layer", async () => {
    // No existing row — triggers the insert path
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean; message: string };
    expect(body.verified).toBe(false);
    expect(body.message).toMatch(/code sent/i);

    // Inserted row should be verified=false with a hashed otp_code
    const otpInsert = insertedRows.find((r) => r.table === "phone_numbers");
    expect(otpInsert).toBeDefined();
    const row = otpInsert!.row as Record<string, unknown>;
    expect(row.verified).toBe(false);
    expect(typeof row.otp_code).toBe("string");
    expect((row.otp_code as string).length).toBe(64); // sha-256 hex
    // Critically: the raw 6-digit code in the message body must NOT match the
    // hashed DB value.
    expect(mockSendMessage).toHaveBeenCalledOnce();
    const sendArgs = mockSendMessage.mock.calls[0];
    const sendBody = (sendArgs[0] as { content: string }).content;
    const match = sendBody.match(/(\d{6})/);
    expect(match).not.toBeNull();
    const rawCode = match![1];
    expect(row.otp_code).not.toBe(rawCode);
    expect(row.otp_code).toBe(hashOtp(rawCode));
  });

  // D2: the row must not be written until the send succeeds — otherwise
  // switching to a new number and hitting a send failure would downgrade a
  // prior verified link to verified=false with a code that never arrived.
  it("does NOT touch the row when the send fails (preserves a prior verified link)", async () => {
    mockSendMessage.mockResolvedValue({
      providerMessageId: null,
      provider: "sendblue",
      status: "FAILED",
      errorMessage: "carrier rejected",
    });
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(502);
    // Nothing persisted, so an existing verified link is left intact.
    expect(
      insertedRows.filter((r) => r.table === "phone_numbers")
    ).toHaveLength(0);
    expect(updates.filter((u) => u.table === "phone_numbers")).toHaveLength(0);
  });

  // D1: with UNIQUE(user_id), a concurrent send loses the insert race with a
  // 23505; the route must fall back to an update rather than 500 or duplicate.
  it("falls back to update when the insert races a concurrent send (23505)", async () => {
    selectResponses["phone_numbers"] = { data: null, error: null };
    insertError = { code: "23505", message: "duplicate key value" };
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(200);
    // Insert was attempted, then it fell back to an update (no 500, no dup).
    expect(
      insertedRows.filter((r) => r.table === "phone_numbers")
    ).toHaveLength(1);
    const fallback = updates.find((u) => u.table === "phone_numbers");
    expect(fallback).toBeDefined();
    expect((fallback!.patch as { verified?: unknown }).verified).toBe(false);
  });
});

// --- POST /api/user/phone/verify ----------------------------------------

describe("POST /api/user/phone/verify", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "123456" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when no code request exists for this user+phone", async () => {
    selectResponses["phone_numbers"] = { data: null, error: null };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "123456" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 410 when code has expired", async () => {
    selectResponses["phone_numbers"] = {
      data: {
        id: "row-1",
        otp_code: hashOtp("123456"),
        otp_expires_at: new Date(Date.now() - 1000).toISOString(),
        verified: false,
      },
      error: null,
    };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "123456" })
    );
    expect(res.status).toBe(410);
  });

  it("returns 400 on wrong code without promoting verified=true", async () => {
    selectResponses["phone_numbers"] = {
      data: {
        id: "row-1",
        otp_code: hashOtp("111111"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        verified: false,
      },
      error: null,
    };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "999999" })
    );
    expect(res.status).toBe(400);
    // Must NOT have promoted verified=true
    const promoted = updates.find(
      (u) => (u.patch as { verified?: unknown }).verified === true
    );
    expect(promoted).toBeUndefined();
  });

  it("returns 429 when phone verify is rate limited (before DB read)", async () => {
    mockCheckLimit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "123456" })
    );
    expect(res.status).toBe(429);
  });

  it("happy path: correct code promotes verified=true, clears OTP fields", async () => {
    selectResponses["phone_numbers"] = {
      data: {
        id: "row-1",
        otp_code: hashOtp("246810"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        verified: false,
      },
      error: null,
    };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "246810" })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean };
    expect(body.verified).toBe(true);

    // verified=true must have been written, and OTP fields cleared
    const promotion = updates.find(
      (u) => (u.patch as { verified?: unknown }).verified === true
    );
    expect(promotion).toBeDefined();
    const patch = promotion!.patch as Record<string, unknown>;
    expect(patch.verified).toBe(true);
    expect(patch.otp_code).toBeNull();
    expect(patch.otp_expires_at).toBeNull();
    expect(patch.linked_at).toBeTypeOf("string");
    // Successful verify also resets the attempts counter so a future
    // re-link cycle starts from zero (otp_attempts column restored
    // 2026-05-19 via migration 20260519000000, reversing ADR-038).
    expect(patch.otp_attempts).toBe(0);
  });
});

// --- otp_attempts (per-row OTP brute-force cap) -------------------------
//
// Migration 20260519000000 restored the otp_attempts column on
// phone_numbers. Verify route increments on wrong code, rejects once
// attempts >= OTP_MAX_ATTEMPTS (5), and resets to 0 on success. Send
// route resets to 0 on every fresh issuance (legitimate recovery path).
// Reverses the open half of ADR-038.

describe("POST /api/user/phone/verify — otp_attempts cap", () => {
  it("increments otp_attempts on wrong code", async () => {
    selectResponses["phone_numbers"] = {
      data: {
        id: "row-1",
        otp_code: hashOtp("111111"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_attempts: 2,
        verified: false,
      },
      error: null,
    };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "999999" })
    );
    expect(res.status).toBe(400);
    // Should have written otp_attempts: 3 (was 2 + 1)
    const incPatch = updates.find(
      (u) => (u.patch as { otp_attempts?: unknown }).otp_attempts === 3
    );
    expect(incPatch).toBeDefined();
  });

  it("returns 429 with too_many_attempts once otp_attempts >= 5", async () => {
    selectResponses["phone_numbers"] = {
      data: {
        id: "row-1",
        otp_code: hashOtp("111111"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_attempts: 5,
        verified: false,
      },
      error: null,
    };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "999999" })
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("too_many_attempts");
    expect(body.message).toMatch(/too many.*request a new code/i);
    // Must NOT increment past the cap (no update at all on this path).
    const incPatch = updates.find(
      (u) => "otp_attempts" in (u.patch as Record<string, unknown>)
    );
    expect(incPatch).toBeUndefined();
  });

  it("treats missing otp_attempts as 0 (legacy row safety)", async () => {
    // Row from before the 20260519000000 migration — otp_attempts is null.
    // Should be coerced to 0 and the request should proceed normally
    // (here: 400 for wrong code, not 429 for too-many).
    selectResponses["phone_numbers"] = {
      data: {
        id: "row-1",
        otp_code: hashOtp("111111"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_attempts: null,
        verified: false,
      },
      error: null,
    };
    const res = await verifyPOST(
      verifyRequest({ phone: "+15555551234", code: "999999" })
    );
    expect(res.status).toBe(400);
    // Increment should write otp_attempts: 1 (null + 1 coerced via the
    // fallback in the route).
    const incPatch = updates.find(
      (u) => (u.patch as { otp_attempts?: unknown }).otp_attempts === 1
    );
    expect(incPatch).toBeDefined();
  });
});

describe("POST /api/user/phone — otp_attempts reset on send", () => {
  it("resets otp_attempts to 0 in the update branch (existing row)", async () => {
    selectResponses["phone_numbers"] = {
      data: { id: "row-1" },
      error: null,
    };
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(200);
    const otpPatch = updates.find((u) => u.table === "phone_numbers");
    expect(otpPatch).toBeDefined();
    const patch = otpPatch!.patch as Record<string, unknown>;
    expect(patch.otp_attempts).toBe(0);
    expect(patch.verified).toBe(false);
    expect(patch.otp_code).toBeTypeOf("string");
  });

  it("sets otp_attempts to 0 in the insert branch (new row)", async () => {
    selectResponses["phone_numbers"] = { data: null, error: null };
    const res = await phonePOST(phoneRequest({ phone_number: "+15555551234" }));
    expect(res.status).toBe(200);
    const phoneInsert = insertedRows.find((r) => r.table === "phone_numbers");
    expect(phoneInsert).toBeDefined();
    expect(phoneInsert!.row.otp_attempts).toBe(0);
  });
});
