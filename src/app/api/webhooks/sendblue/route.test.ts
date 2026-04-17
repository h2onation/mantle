import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

interface InsertRecord {
  table: string;
  row: Record<string, unknown>;
}

const mockInserts: InsertRecord[] = [];
const insertErrorQueue: Array<{ code?: string; message?: string } | null> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        mockInserts.push({ table, row });
        const err = insertErrorQueue.shift() ?? null;
        return Promise.resolve({ data: null, error: err });
      },
    }),
  }),
}));

const mockRouter = vi.fn();
vi.mock("@/lib/linq/message-router", () => ({
  routeInboundMessage: (data: unknown) => mockRouter(data),
}));

import { POST } from "@/app/api/webhooks/sendblue/route";

// --- Fixtures ------------------------------------------------------------

const TEST_SECRET = "test-webhook-secret-abc123";
const ORIGINAL_SECRET = process.env.SENDBLUE_WEBHOOK_SECRET;

interface SendbluePayload {
  accountEmail: string;
  content: string;
  is_outbound: false;
  status: string;
  error_code: number | null;
  error_message: string | null;
  message_handle: string;
  date_sent: string;
  date_updated: string;
  from_number: string;
  number: string;
  to_number: string;
  was_downgraded: boolean | null;
  media_url: string;
  message_type: string;
  group_id: string;
  participants: string[];
  send_style: string;
  opted_out: boolean;
  sendblue_number: string;
  service: string;
}

function basePayload(overrides: Partial<SendbluePayload> = {}): SendbluePayload {
  return {
    accountEmail: "test@example.com",
    content: "hello walnut",
    is_outbound: false,
    status: "RECEIVED",
    error_code: null,
    error_message: null,
    message_handle: "msg-" + Math.random().toString(36).slice(2, 10),
    date_sent: "2026-04-17T00:00:00Z",
    date_updated: "2026-04-17T00:00:00Z",
    from_number: "+13105550101",
    number: "+13105550101",
    to_number: "+16292925296",
    was_downgraded: null,
    media_url: "",
    message_type: "message",
    group_id: "",
    participants: ["+13105550101", "+16292925296"],
    send_style: "",
    opted_out: false,
    sendblue_number: "+16292925296",
    service: "iMessage",
    ...overrides,
  };
}

/**
 * Build a NextRequest-shaped Request.
 *   signingSecret: undefined → attach the valid TEST_SECRET header (default)
 *   signingSecret: null      → omit the sb-signing-secret header entirely
 *   signingSecret: string    → attach that exact string as the header value
 */
function makeRequest(
  body: SendbluePayload | null,
  opts: {
    rawBody?: string;
    signingSecret?: string | null;
  } = {}
): import("next/server").NextRequest {
  const rawBody = opts.rawBody ?? JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret =
    opts.signingSecret === null
      ? null
      : (opts.signingSecret ?? TEST_SECRET);
  if (secret !== null) {
    headers["sb-signing-secret"] = secret;
  }
  return new Request("http://localhost/api/webhooks/sendblue", {
    method: "POST",
    headers,
    body: rawBody,
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  mockInserts.length = 0;
  insertErrorQueue.length = 0;
  mockRouter.mockReset();
  mockRouter.mockResolvedValue(undefined);
  process.env.SENDBLUE_WEBHOOK_SECRET = TEST_SECRET;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.SENDBLUE_WEBHOOK_SECRET;
  } else {
    process.env.SENDBLUE_WEBHOOK_SECRET = ORIGINAL_SECRET;
  }
});

// --- Tests ---------------------------------------------------------------

describe("POST /api/webhooks/sendblue", () => {
  it("1:1 happy path: verified=true, audits inbound, calls router with chatId undefined + text part", async () => {
    const payload = basePayload({ content: "hi" });
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);

    const audit = auditRows[0].row;
    expect(audit.direction).toBe("inbound");
    expect(audit.provider).toBe("sendblue");
    expect(audit.provider_message_id).toBe(payload.message_handle);
    expect(audit.from_number).toBe("+13105550101");
    expect(audit.to_number).toBe("+16292925296");
    expect(audit.content).toBe("[USER_MSG len=2]");

    const rawPayload = audit.raw_payload as Record<string, unknown>;
    expect(rawPayload.content_length).toBe(2);
    expect(rawPayload.has_media).toBe(false);
    expect(rawPayload.verified).toBe(true);

    expect(mockRouter).toHaveBeenCalledOnce();
    const routerArgs = mockRouter.mock.calls[0][0] as {
      chatId?: string;
      senderPhone: string;
      parts: Array<{ type: string; value: string }>;
    };
    expect(routerArgs.chatId).toBeUndefined();
    expect(routerArgs.senderPhone).toBe("+13105550101");
    expect(routerArgs.parts).toEqual([{ type: "text", value: "hi" }]);
  });

  it("media synthesis: media_url populated → parts contains text and image", async () => {
    const payload = basePayload({
      content: "",
      media_url: "https://cdn.example.com/photo.jpg",
    });
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockRouter).toHaveBeenCalledOnce();

    const routerArgs = mockRouter.mock.calls[0][0] as {
      parts: Array<{ type: string; value: string }>;
    };
    expect(routerArgs.parts).toEqual([
      { type: "text", value: "" },
      { type: "image", value: "https://cdn.example.com/photo.jpg" },
    ]);

    const audit = mockInserts[0].row;
    const rawPayload = audit.raw_payload as Record<string, unknown>;
    expect(rawPayload.has_media).toBe(true);
  });

  it("group short-circuit: group_id non-empty → audits, does NOT route", async () => {
    const payload = basePayload({ group_id: "group-abc123" });
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);
    const rawPayload = auditRows[0].row.raw_payload as Record<string, unknown>;
    expect(rawPayload.group_id).toBe("group-abc123");

    expect(mockRouter).not.toHaveBeenCalled();
  });

  it("invalid JSON: returns {ok:false, reason:'invalid_json'}, no audit, no routing", async () => {
    const res = await POST(makeRequest(null, { rawBody: "{not json" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "invalid_json" });
    expect(mockInserts).toHaveLength(0);
    expect(mockRouter).not.toHaveBeenCalled();
  });

  it("dedupe (23505): primary insert fails, routing skipped", async () => {
    insertErrorQueue.push({ code: "23505", message: "duplicate key" });
    const payload = basePayload();
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    // Insert was attempted (mock captured it even though the DB rejected it)
    expect(mockInserts).toHaveLength(1);
    // Router was NOT called — dedupe means the message was already processed
    expect(mockRouter).not.toHaveBeenCalled();
  });

  it("non-dedupe DB error: routing still proceeds so the user is not dropped", async () => {
    insertErrorQueue.push({ code: "XX001", message: "transient backend error" });
    const payload = basePayload();
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockRouter).toHaveBeenCalledOnce();
  });

  it("router throws: secondary audit row written, returns 200", async () => {
    mockRouter.mockRejectedValue(new Error("router bug"));
    const payload = basePayload();
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(2);

    const primary = auditRows[0].row;
    expect(primary.direction).toBe("inbound");
    expect(primary.provider_message_id).toBe(payload.message_handle);
    expect(primary.status).toBe("RECEIVED");

    const secondary = auditRows[1].row;
    expect(secondary.direction).toBe("inbound");
    expect(secondary.provider_message_id).toBeNull();
    expect(secondary.status).toBe("ROUTING_FAILED");
    expect(secondary.content).toBe("[ROUTING_FAILED]");
    expect(secondary.error_message).toBe("router bug");

    const secondaryRaw = secondary.raw_payload as Record<string, unknown>;
    expect(secondaryRaw.kind).toBe("routing_failure");
    expect(secondaryRaw.parent_message_handle).toBe(payload.message_handle);
  });

  // --- Signature verification (ADR-039) ---------------------------------

  it("sig: missing sb-signing-secret header → verified=false, router not called", async () => {
    const payload = basePayload();
    const res = await POST(
      makeRequest(payload, { signingSecret: null })
    );

    expect(res.status).toBe(200);

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);
    const rawPayload = auditRows[0].row.raw_payload as Record<string, unknown>;
    expect(rawPayload.verified).toBe(false);

    expect(mockRouter).not.toHaveBeenCalled();
  });

  it("sig: wrong sb-signing-secret value → verified=false, router not called", async () => {
    const payload = basePayload();
    const res = await POST(
      makeRequest(payload, { signingSecret: "totally-wrong-value" })
    );

    expect(res.status).toBe(200);

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);
    const rawPayload = auditRows[0].row.raw_payload as Record<string, unknown>;
    expect(rawPayload.verified).toBe(false);

    expect(mockRouter).not.toHaveBeenCalled();
  });

  it("sig: correct sb-signing-secret value → verified=true, router called", async () => {
    const payload = basePayload();
    const res = await POST(
      makeRequest(payload, { signingSecret: TEST_SECRET })
    );

    expect(res.status).toBe(200);

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);
    const rawPayload = auditRows[0].row.raw_payload as Record<string, unknown>;
    expect(rawPayload.verified).toBe(true);

    expect(mockRouter).toHaveBeenCalledOnce();
  });

  it("sig: missing SENDBLUE_WEBHOOK_SECRET env var → verified=false, router not called (fail closed)", async () => {
    delete process.env.SENDBLUE_WEBHOOK_SECRET;
    const payload = basePayload();
    const res = await POST(
      makeRequest(payload, { signingSecret: TEST_SECRET })
    );

    expect(res.status).toBe(200);

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);
    const rawPayload = auditRows[0].row.raw_payload as Record<string, unknown>;
    expect(rawPayload.verified).toBe(false);

    expect(mockRouter).not.toHaveBeenCalled();
  });
});
