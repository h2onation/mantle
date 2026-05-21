import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the anthropic module BEFORE importing monitor so the spy is
// installed before runMonitor binds the dependency. Mirrors the
// pattern in extraction-parser.test.ts.
vi.mock("@/lib/anthropic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/anthropic")>();
  return { ...actual, anthropicFetch: vi.fn() };
});

import { anthropicFetch } from "@/lib/anthropic";
import {
  parseMonitorRead,
  runMonitor,
  type MonitorRead,
} from "@/lib/persona/monitor";

function makeRead(overrides: Partial<MonitorRead> = {}): MonitorRead {
  return {
    bond_holding: true,
    task_agreed: true,
    scope: "in_scope",
    rupture: "none",
    direction: "steadying",
    reason: "user is engaging with content.",
    ...overrides,
  };
}

function mockLLMReturns(payload: unknown, usage?: Record<string, unknown>) {
  vi.mocked(anthropicFetch).mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(payload) }],
    ...(usage ? { usage } : {}),
  } as Awaited<ReturnType<typeof anthropicFetch>>);
}

const dummyHistory = [
  { role: "user" as const, content: "I keep doing this thing where I freeze." },
  { role: "assistant" as const, content: "Walk me through the last time." },
  { role: "user" as const, content: "It was yesterday at the meeting." },
];

beforeEach(() => {
  vi.mocked(anthropicFetch).mockReset();
});

describe("parseMonitorRead", () => {
  it("parses a valid happy-path payload", () => {
    const json = JSON.stringify(makeRead());
    const result = parseMonitorRead(json);
    expect(result).toEqual(makeRead());
  });

  it("returns null on malformed JSON", () => {
    expect(parseMonitorRead("not json at all")).toBeNull();
    expect(parseMonitorRead("{partial")).toBeNull();
    expect(parseMonitorRead("")).toBeNull();
  });

  it("returns null when bond_holding is not a boolean", () => {
    const json = JSON.stringify({ ...makeRead(), bond_holding: "yes" });
    expect(parseMonitorRead(json)).toBeNull();
  });

  it("returns null when task_agreed is missing", () => {
    const { task_agreed: _omit, ...rest } = makeRead();
    void _omit;
    expect(parseMonitorRead(JSON.stringify(rest))).toBeNull();
  });

  it("returns null when scope is outside the enum", () => {
    const json = JSON.stringify({ ...makeRead(), scope: "elsewhere" });
    expect(parseMonitorRead(json)).toBeNull();
  });

  it("returns null when rupture is outside the enum", () => {
    const json = JSON.stringify({ ...makeRead(), rupture: "weird-thing" });
    expect(parseMonitorRead(json)).toBeNull();
  });

  it("returns null when direction is outside the enum", () => {
    const json = JSON.stringify({ ...makeRead(), direction: "rising" });
    expect(parseMonitorRead(json)).toBeNull();
  });

  it("treats missing reason as empty string (not a parse failure)", () => {
    const { reason: _omit, ...rest } = makeRead();
    void _omit;
    const result = parseMonitorRead(JSON.stringify(rest));
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("");
  });

  it("trims whitespace from reason", () => {
    const json = JSON.stringify({ ...makeRead(), reason: "  with edges  " });
    expect(parseMonitorRead(json)?.reason).toBe("with edges");
  });

  it("accepts all valid enum combinations", () => {
    const scopes = ["in_scope", "drifting", "out_of_scope"] as const;
    const ruptures = ["none", "withdrawal", "confrontation"] as const;
    const directions = ["steadying", "drifting", "sinking"] as const;
    for (const scope of scopes) {
      for (const rupture of ruptures) {
        for (const direction of directions) {
          const read = makeRead({ scope, rupture, direction });
          expect(parseMonitorRead(JSON.stringify(read))).toEqual(read);
        }
      }
    }
  });

  it("rejects non-object payloads", () => {
    expect(parseMonitorRead(JSON.stringify(null))).toBeNull();
    expect(parseMonitorRead(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(parseMonitorRead(JSON.stringify("string"))).toBeNull();
    expect(parseMonitorRead(JSON.stringify(42))).toBeNull();
  });
});

describe("runMonitor", () => {
  it("returns the parsed read plus telemetry on a happy path", async () => {
    mockLLMReturns(makeRead({ direction: "sinking" }), {
      input_tokens: 420,
      output_tokens: 38,
    });
    const result = await runMonitor({ conversationHistory: dummyHistory });
    expect(result.read.direction).toBe("sinking");
    expect(result.usage.input_tokens).toBe(420);
    expect(result.usage.output_tokens).toBe(38);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("strips markdown code fences before parsing", async () => {
    const raw = "```json\n" + JSON.stringify(makeRead()) + "\n```";
    vi.mocked(anthropicFetch).mockResolvedValueOnce({
      content: [{ type: "text", text: raw }],
    } as Awaited<ReturnType<typeof anthropicFetch>>);
    const result = await runMonitor({ conversationHistory: dummyHistory });
    expect(result.read.scope).toBe("in_scope");
  });

  it("throws when the model returns unparseable output", async () => {
    vi.mocked(anthropicFetch).mockResolvedValueOnce({
      content: [{ type: "text", text: "{ not json" }],
    } as Awaited<ReturnType<typeof anthropicFetch>>);
    await expect(
      runMonitor({ conversationHistory: dummyHistory })
    ).rejects.toThrow(/unparseable/);
  });

  it("trims the message window to the last 8 entries", async () => {
    mockLLMReturns(makeRead());
    const longHistory = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn ${i + 1}`,
    }));
    await runMonitor({ conversationHistory: longHistory });
    const call = vi.mocked(anthropicFetch).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const userContent = call!.messages[0].content;
    // The earliest included turn should be turn 13 (last 8 of 20).
    expect(userContent).toContain("turn 13");
    expect(userContent).toContain("turn 20");
    expect(userContent).not.toContain("turn 12");
    expect(userContent).not.toContain("turn 1\n");
  });

  it("uses the Haiku monitor model and a cached system prompt", async () => {
    mockLLMReturns(makeRead());
    await runMonitor({ conversationHistory: dummyHistory });
    const call = vi.mocked(anthropicFetch).mock.calls[0]?.[0];
    expect(call?.model).toBe("claude-haiku-4-5-20251001");
    expect(Array.isArray(call?.system)).toBe(true);
    const systemBlock = (call?.system as Array<Record<string, unknown>>)[0];
    expect(systemBlock.type).toBe("text");
    expect(systemBlock.cache_control).toEqual({ type: "ephemeral" });
  });
});
