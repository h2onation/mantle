import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

interface InsertRecord {
  table: string;
  row: Record<string, unknown>;
}

interface UpdateRecord {
  table: string;
  patch: Record<string, unknown>;
  whereClauses: Array<[string, unknown]>;
}

const mockInserts: InsertRecord[] = [];
const mockUpdates: UpdateRecord[] = [];
const insertErrorQueue: Array<{ code?: string; message?: string } | null> = [];
const selectResponsesByTable: Record<
  string,
  { data: unknown; error: { code?: string; message?: string } | null }
> = {};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    let currentTable = "";

    const chain: Record<string, unknown> = {};
    chain.from = (t: string) => {
      currentTable = t;
      return chain;
    };
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () => {
      const resp = selectResponsesByTable[currentTable] ?? {
        data: null,
        error: null,
      };
      return Promise.resolve(resp);
    };
    chain.insert = (row: Record<string, unknown>) => {
      mockInserts.push({ table: currentTable, row });
      const err = insertErrorQueue.shift() ?? null;
      return Promise.resolve({ data: null, error: err });
    };
    chain.update = (patch: Record<string, unknown>) => {
      const table = currentTable;
      const whereCapture: Array<[string, unknown]> = [];
      const followup: Record<string, unknown> = {};
      followup.eq = (col: string, val: unknown) => {
        whereCapture.push([col, val]);
        mockUpdates.push({ table, patch, whereClauses: [...whereCapture] });
        return followup;
      };
      (followup as { then?: unknown }).then = (
        resolve: (v: { data: unknown; error: unknown }) => void
      ) => Promise.resolve({ data: null, error: null }).then(resolve);
      return followup;
    };

    return chain;
  },
}));

const mockRouter = vi.fn();
vi.mock("@/lib/linq/message-router", () => ({
  routeInboundMessage: (data: unknown) => mockRouter(data),
}));

const mockTyping = vi.fn();
vi.mock("@/lib/messaging/sendblue", () => ({
  sendTypingIndicatorViaSendblue: (params: unknown) => mockTyping(params),
}));

import { POST } from "@/app/api/webhooks/sendblue/route";

// --- Fixtures ------------------------------------------------------------

const TEST_SECRET = "test-webhook-secret-abc123";
const ORIGINAL_SECRET = process.env.SENDBLUE_WEBHOOK_SECRET;

interface SendbluePayload {
  accountEmail: string;
  content: string;
  is_outbound: boolean;
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
  mockUpdates.length = 0;
  insertErrorQueue.length = 0;
  for (const k of Object.keys(selectResponsesByTable)) {
    delete selectResponsesByTable[k];
  }
  mockRouter.mockReset();
  mockRouter.mockResolvedValue(undefined);
  mockTyping.mockReset();
  mockTyping.mockResolvedValue(undefined);
  process.env.SENDBLUE_WEBHOOK_SECRET = TEST_SECRET;
});

// Give microtasks a chance to flush — typing is fire-and-forget, so its
// .catch() handler runs as a microtask after the POST promise resolves. A
// setImmediate tick guarantees that handler has run before assertions.
const flushMicrotasks = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

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

    // Typing indicator fires on the routed path, addressed at the sender.
    expect(mockTyping).toHaveBeenCalledOnce();
    expect(mockTyping).toHaveBeenCalledWith({ to: "+13105550101" });
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

  it("group short-circuit: group_id non-empty → audits, does NOT route, does NOT type", async () => {
    const payload = basePayload({ group_id: "group-abc123" });
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const auditRows = mockInserts.filter((r) => r.table === "messaging_events");
    expect(auditRows).toHaveLength(1);
    const rawPayload = auditRows[0].row.raw_payload as Record<string, unknown>;
    expect(rawPayload.group_id).toBe("group-abc123");

    expect(mockRouter).not.toHaveBeenCalled();
    expect(mockTyping).not.toHaveBeenCalled();
  });

  it("invalid JSON: returns {ok:false, reason:'invalid_json'}, no audit, no routing, no typing", async () => {
    const res = await POST(makeRequest(null, { rawBody: "{not json" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "invalid_json" });
    expect(mockInserts).toHaveLength(0);
    expect(mockRouter).not.toHaveBeenCalled();
    expect(mockTyping).not.toHaveBeenCalled();
  });

  it("dedupe (23505): primary insert fails, routing skipped, typing skipped", async () => {
    insertErrorQueue.push({ code: "23505", message: "duplicate key" });
    const payload = basePayload();
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    // Insert was attempted (mock captured it even though the DB rejected it)
    expect(mockInserts).toHaveLength(1);
    // Router was NOT called — dedupe means the message was already processed
    expect(mockRouter).not.toHaveBeenCalled();
    // Typing also skipped — the first delivery already fired one
    expect(mockTyping).not.toHaveBeenCalled();
  });

  it("non-dedupe DB error: routing still proceeds so the user is not dropped", async () => {
    insertErrorQueue.push({ code: "XX001", message: "transient backend error" });
    const payload = basePayload();
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockRouter).toHaveBeenCalledOnce();
  });

  it("router throws: secondary audit row written, typing still fired, returns 200", async () => {
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

    // Typing was fired before the router throw — the user saw dots even
    // though the reply never came through.
    expect(mockTyping).toHaveBeenCalledOnce();
  });

  // --- Signature verification (ADR-039) ---------------------------------

  it("sig: missing sb-signing-secret header → verified=false, router not called, typing not called", async () => {
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
    expect(mockTyping).not.toHaveBeenCalled();
  });

  it("sig: wrong sb-signing-secret value → verified=false, router not called, typing not called", async () => {
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
    expect(mockTyping).not.toHaveBeenCalled();
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

  it("sig: missing SENDBLUE_WEBHOOK_SECRET env var → verified=false, router not called, typing not called (fail closed)", async () => {
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
    expect(mockTyping).not.toHaveBeenCalled();
  });

  // --- Typing indicator ordering + resilience ---------------------------

  it("typing: fires before routing (ordering)", async () => {
    const payload = basePayload();
    await POST(makeRequest(payload));

    expect(mockTyping).toHaveBeenCalledOnce();
    expect(mockRouter).toHaveBeenCalledOnce();

    const typingOrder = mockTyping.mock.invocationCallOrder[0];
    const routerOrder = mockRouter.mock.invocationCallOrder[0];
    expect(typingOrder).toBeLessThan(routerOrder);
  });

  it("typing: rejection does not block routing (fire-and-forget)", async () => {
    mockTyping.mockRejectedValue(new Error("sendblue typing API timeout"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const payload = basePayload();
      const res = await POST(makeRequest(payload));
      // Flush the microtask holding the rejected typing promise's .catch
      // so the warn-spy assertion below sees the log line.
      await flushMicrotasks();

      expect(res.status).toBe(200);
      expect(mockTyping).toHaveBeenCalledOnce();
      // Router still ran despite typing rejection
      expect(mockRouter).toHaveBeenCalledOnce();
      // And the typing failure was logged as a warning
      const warnedTypingFailure = warnSpy.mock.calls.some(
        (c) =>
          typeof c[0] === "string" &&
          (c[0] as string).includes("typing_indicator_failed")
      );
      expect(warnedTypingFailure).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  // --- Latency instrumentation -----------------------------------------

  it("latency: emits one structured log line on the routed path with expected shape", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const payload = basePayload({ message_handle: "msg-latency-test" });
      const res = await POST(makeRequest(payload));
      expect(res.status).toBe(200);

      const latencyCalls = logSpy.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          (c[0] as string).startsWith("[latency] sendblue_roundtrip")
      );
      expect(latencyCalls).toHaveLength(1);

      const line = latencyCalls[0][0] as string;
      // Shape check — no number assertions; each bucket can be a positive
      // integer or -1 (router-internal marks don't fire when router is
      // mocked, which is expected in this suite).
      expect(line).toMatch(
        /^\[latency\] sendblue_roundtrip handle=msg-latency-test total=-?\d+ms verify=-?\d+ms audit_in=-?\d+ms phone_lookup=-?\d+ms context_load=-?\d+ms anthropic=-?\d+ms persist=-?\d+ms send=-?\d+ms$/
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  // --- Outbound status callbacks ----------------------------------------

  it("outbound: SENT updates status, no inbound side-effects", async () => {
    selectResponsesByTable["messaging_events"] = {
      data: { id: "row-sent-1", status: "QUEUED" },
      error: null,
    };
    const payload = basePayload({
      is_outbound: true,
      status: "SENT",
      message_handle: "handle-sent-1",
      date_updated: "2026-04-17T12:00:01Z",
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);

    expect(mockUpdates).toHaveLength(1);
    const update = mockUpdates[0];
    expect(update.table).toBe("messaging_events");
    expect(update.patch).toEqual({ status: "SENT" });
    expect(update.whereClauses).toEqual([["id", "row-sent-1"]]);

    // Outbound path does not insert, route, or type.
    expect(mockInserts).toHaveLength(0);
    expect(mockRouter).not.toHaveBeenCalled();
    expect(mockTyping).not.toHaveBeenCalled();
  });

  it("outbound: DELIVERED sets status + delivered_at from date_updated", async () => {
    selectResponsesByTable["messaging_events"] = {
      data: { id: "row-del-1", status: "SENT" },
      error: null,
    };
    const payload = basePayload({
      is_outbound: true,
      status: "DELIVERED",
      message_handle: "handle-del-1",
      date_updated: "2026-04-17T12:00:05.321Z",
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);

    expect(mockUpdates).toHaveLength(1);
    expect(mockUpdates[0].patch).toEqual({
      status: "DELIVERED",
      delivered_at: "2026-04-17T12:00:05.321Z",
    });
  });

  it("outbound: FAILED captures error_code (stringified) and error_message", async () => {
    selectResponsesByTable["messaging_events"] = {
      data: { id: "row-fail-1", status: "SENT" },
      error: null,
    };
    const payload = basePayload({
      is_outbound: true,
      status: "FAILED",
      error_code: 22,
      error_message: "Delivery failed after retries",
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);

    expect(mockUpdates).toHaveLength(1);
    expect(mockUpdates[0].patch).toEqual({
      status: "FAILED",
      error_code: "22",
      error_message: "Delivery failed after retries",
    });
  });

  it("outbound: unknown message_handle → 200, warn, no update", async () => {
    selectResponsesByTable["messaging_events"] = { data: null, error: null };
    const payload = basePayload({
      is_outbound: true,
      status: "SENT",
      message_handle: "unknown-handle-abc",
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const res = await POST(makeRequest(payload));
      expect(res.status).toBe(200);
      expect(mockUpdates).toHaveLength(0);

      const warnedUnknown = warnSpy.mock.calls.some(
        (c) =>
          typeof c[0] === "string" &&
          (c[0] as string).includes("outbound_status_unknown_handle")
      );
      expect(warnedUnknown).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("outbound: out-of-order — SENT arriving after DELIVERED is a no-op", async () => {
    selectResponsesByTable["messaging_events"] = {
      data: { id: "row-ooo-1", status: "DELIVERED" },
      error: null,
    };
    const payload = basePayload({
      is_outbound: true,
      status: "SENT",
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(mockUpdates).toHaveLength(0);
  });

  it("outbound: idempotent — DELIVERED arriving after DELIVERED is a no-op", async () => {
    selectResponsesByTable["messaging_events"] = {
      data: { id: "row-idem-1", status: "DELIVERED" },
      error: null,
    };
    const payload = basePayload({
      is_outbound: true,
      status: "DELIVERED",
    });
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(mockUpdates).toHaveLength(0);
  });

  it("outbound: unverified signature → 200, no lookup or update", async () => {
    // Even if a valid-looking row exists, we don't touch it when the
    // signature check fails.
    selectResponsesByTable["messaging_events"] = {
      data: { id: "row-unv-1", status: "QUEUED" },
      error: null,
    };
    const payload = basePayload({
      is_outbound: true,
      status: "SENT",
    });
    const res = await POST(
      makeRequest(payload, { signingSecret: null })
    );
    expect(res.status).toBe(200);
    expect(mockUpdates).toHaveLength(0);
  });
});
