import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The 1:1 text/SMS conductor path is gated OFF by default (TEXT_MESSAGING_ENABLED
// != "true") pending a text rebuild. These pin the gate: when off, a normal
// inbound is dropped SILENTLY — no user lookup, no Jove turn, no outbound — while
// CTIA keywords (STOP/START/HELP) stay live above the gate.

const mockProcessTextMessage = vi.fn();
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockCreateAdminClient = vi.fn();

// A chainable admin stub whose phone lookup resolves to "no verified row", so a
// gate-ON inbound proceeds past the gate into the unknown-number path without
// needing a full DB. Its mere invocation proves the gate let the turn through.
function makeAdminStub() {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.update = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: null });
  chain.then = (r: (v: { error: null }) => void) => r({ error: null });
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));
vi.mock("./persona-bridge", () => ({
  processTextMessage: (...args: unknown[]) => mockProcessTextMessage(...args),
}));
vi.mock("@/lib/messaging/send", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));
vi.mock("./sender", () => ({
  sendTypingIndicator: vi.fn(),
  markAsRead: vi.fn(),
}));
vi.mock("@/lib/usage", () => ({ checkDailyMessageLimit: vi.fn() }));
vi.mock("@/lib/persona/confirm-checkpoint", () => ({ confirmCheckpoint: vi.fn() }));
vi.mock("@/lib/persona/persona-pipeline", () => ({
  insertCheckpointActionMessage: vi.fn(),
}));

import { routeInboundMessage } from "./message-router";

const inbound = {
  chatId: undefined,
  senderPhone: "+13105550101",
  parts: [{ type: "text" as const, value: "hey jove, something happened today" }],
};

describe("routeInboundMessage — text/SMS feature gate", () => {
  beforeEach(() => {
    mockProcessTextMessage.mockClear();
    mockSendMessage.mockClear();
    mockCreateAdminClient.mockClear().mockImplementation(() => makeAdminStub());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("drops the inbound SILENTLY when the gate is OFF (env unset)", async () => {
    vi.stubEnv("TEXT_MESSAGING_ENABLED", "");
    await routeInboundMessage(inbound);
    // Gate returns before any of these — no user lookup, no Jove turn, no send.
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockProcessTextMessage).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("proceeds past the gate (into user lookup) when TEXT_MESSAGING_ENABLED=true", async () => {
    vi.stubEnv("TEXT_MESSAGING_ENABLED", "true");
    // The turn proceeds past the gate into the user lookup; downstream deps
    // (provider selection, etc.) are intentionally under-mocked here, so the
    // flow may throw AFTER the lookup — fine, we only assert the gate let it
    // through (createAdminClient ran, which is the first step past the gate).
    await routeInboundMessage(inbound).catch(() => {});
    expect(mockCreateAdminClient).toHaveBeenCalled();
  });

  it("still honors STOP (CTIA compliance) even with the gate OFF", async () => {
    vi.stubEnv("TEXT_MESSAGING_ENABLED", "");
    await routeInboundMessage({
      ...inbound,
      parts: [{ type: "text" as const, value: "STOP" }],
    });
    // STOP is handled above the gate — the opt-out reply is always sent.
    expect(mockSendMessage).toHaveBeenCalledOnce();
  });
});
