import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockGetProvider = vi.fn();
vi.mock("./provider", () => ({
  getActiveProvider: () => mockGetProvider(),
}));

const mockSendblue = vi.fn();
vi.mock("./sendblue", () => ({
  sendMessageViaSendblue: () => mockSendblue(),
}));

const mockLinq = vi.fn();
vi.mock("./linq", () => ({
  sendMessageViaLinq: () => mockLinq(),
}));

// Audit-insert behavior is switched per test. "throw" reproduces the bug
// scenario: the provider delivered the message, but the bookkeeping insert
// blows up afterward.
let auditBehavior: "ok" | "error" | "throw";
const insertSpy = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insertSpy(row);
        if (auditBehavior === "throw") throw new Error("audit db down");
        if (auditBehavior === "error") {
          return Promise.resolve({ error: { message: "audit error" } });
        }
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { sendMessage } from "./send";

beforeEach(() => {
  mockGetProvider.mockReturnValue("sendblue");
  mockSendblue.mockReset();
  mockSendblue.mockResolvedValue({
    message_handle: "h1",
    from_number: "+1999",
    number: "+1555",
    status: "SENT",
    error_code: null,
    error_message: null,
  });
  mockLinq.mockReset();
  insertSpy.mockClear();
  auditBehavior = "ok";
});

// --- Tests ---------------------------------------------------------------

describe("sendMessage — audit write isolated from the send result", () => {
  it("returns the provider's SENT status even when the audit insert THROWS (the false-FAILED bug)", async () => {
    auditBehavior = "throw";
    const res = await sendMessage({
      to: "+1555",
      content: "123456",
      contentKind: "otp",
    });
    // Delivered — must never be reported FAILED because bookkeeping failed.
    expect(res.status).toBe("SENT");
    expect(res.providerMessageId).toBe("h1");
    expect(insertSpy).toHaveBeenCalledTimes(1); // the audit WAS attempted
  });

  it("returns SENT even when the audit insert resolves with a Supabase { error }", async () => {
    auditBehavior = "error";
    const res = await sendMessage({ to: "+1555", content: "hi" });
    expect(res.status).toBe("SENT");
  });

  it("happy path: returns SENT and writes exactly one audit row", async () => {
    const res = await sendMessage({ to: "+1555", content: "hi", contentKind: "jove" });
    expect(res.status).toBe("SENT");
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it("returns FAILED when the provider send itself throws (a real failure)", async () => {
    mockSendblue.mockRejectedValueOnce(new Error("provider down"));
    const res = await sendMessage({ to: "+1555", content: "hi" });
    expect(res.status).toBe("FAILED");
    expect(res.errorMessage).toMatch(/provider down/);
  });
});
