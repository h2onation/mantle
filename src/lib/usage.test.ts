import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getDailyMessageLimit,
  getUserDailyMessageCount,
  checkDailyMessageLimit,
} from "./usage";

// ──────────────────────────────────────────────────────────────────────
// getDailyMessageLimit — env-var parsing
// ──────────────────────────────────────────────────────────────────────

describe("getDailyMessageLimit", () => {
  const original = process.env.DAILY_MESSAGE_LIMIT;

  beforeEach(() => {
    delete process.env.DAILY_MESSAGE_LIMIT;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DAILY_MESSAGE_LIMIT;
    } else {
      process.env.DAILY_MESSAGE_LIMIT = original;
    }
  });

  it("returns the default (200) when env var is unset", () => {
    expect(getDailyMessageLimit()).toBe(200);
  });

  it("returns the parsed env-var value when valid", () => {
    process.env.DAILY_MESSAGE_LIMIT = "350";
    expect(getDailyMessageLimit()).toBe(350);
  });

  it("falls back to default when env-var is non-numeric", () => {
    process.env.DAILY_MESSAGE_LIMIT = "abc";
    expect(getDailyMessageLimit()).toBe(200);
  });

  it("falls back to default when env-var is zero or negative", () => {
    process.env.DAILY_MESSAGE_LIMIT = "0";
    expect(getDailyMessageLimit()).toBe(200);
    process.env.DAILY_MESSAGE_LIMIT = "-50";
    expect(getDailyMessageLimit()).toBe(200);
  });

  it("falls back to default on empty string", () => {
    process.env.DAILY_MESSAGE_LIMIT = "";
    expect(getDailyMessageLimit()).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Mocked Supabase admin client — minimal surface for the count query
// ──────────────────────────────────────────────────────────────────────

interface QueryResult {
  count: number | null;
  error: { message: string } | null;
}

function makeAdmin(result: QueryResult, capture?: (state: Record<string, unknown>) => void) {
  const state: Record<string, unknown> = {};
  const builder = {
    select: (cols: string, opts?: unknown) => {
      state.select = { cols, opts };
      return builder;
    },
    eq: (col: string, val: unknown) => {
      state.eq = state.eq ?? [];
      (state.eq as Array<{ col: string; val: unknown }>).push({ col, val });
      return builder;
    },
    gte: (col: string, val: unknown) => {
      state.gte = { col, val };
      capture?.(state);
      return Promise.resolve(result);
    },
  };
  return {
    from: (table: string) => {
      state.from = table;
      return builder;
    },
  } as unknown as Parameters<typeof getUserDailyMessageCount>[0];
}

// ──────────────────────────────────────────────────────────────────────
// getUserDailyMessageCount
// ──────────────────────────────────────────────────────────────────────

describe("getUserDailyMessageCount", () => {
  it("returns the count from a successful query", async () => {
    const admin = makeAdmin({ count: 17, error: null });
    const count = await getUserDailyMessageCount(admin, "user-1");
    expect(count).toBe(17);
  });

  it("returns 0 when the query reports null count", async () => {
    const admin = makeAdmin({ count: null, error: null });
    const count = await getUserDailyMessageCount(admin, "user-1");
    expect(count).toBe(0);
  });

  it("fails open (returns 0) when the query errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = makeAdmin({ count: null, error: { message: "supabase down" } });
    const count = await getUserDailyMessageCount(admin, "user-1");
    expect(count).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[usage] daily count query failed:",
      "supabase down",
    );
    consoleSpy.mockRestore();
  });

  it("filters by user_id, role=user, and start-of-UTC-day", async () => {
    let captured: Record<string, unknown> = {};
    const admin = makeAdmin({ count: 0, error: null }, (s) => {
      captured = s;
    });
    await getUserDailyMessageCount(admin, "user-42");

    expect(captured.from).toBe("messages");
    expect((captured.select as { cols: string }).cols).toContain("conversations!inner(user_id)");

    const eqCalls = captured.eq as Array<{ col: string; val: unknown }>;
    expect(eqCalls).toContainEqual({ col: "conversations.user_id", val: "user-42" });
    expect(eqCalls).toContainEqual({ col: "role", val: "user" });

    const gte = captured.gte as { col: string; val: string };
    expect(gte.col).toBe("created_at");
    // Start-of-UTC-day in ISO form: ends in T00:00:00.000Z
    expect(gte.val).toMatch(/T00:00:00\.000Z$/);
  });
});

// ──────────────────────────────────────────────────────────────────────
// checkDailyMessageLimit
// ──────────────────────────────────────────────────────────────────────

describe("checkDailyMessageLimit", () => {
  const original = process.env.DAILY_MESSAGE_LIMIT;

  beforeEach(() => {
    delete process.env.DAILY_MESSAGE_LIMIT;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DAILY_MESSAGE_LIMIT;
    } else {
      process.env.DAILY_MESSAGE_LIMIT = original;
    }
  });

  it("allows when count is below the limit", async () => {
    const admin = makeAdmin({ count: 50, error: null });
    const result = await checkDailyMessageLimit(admin, "user-1");
    expect(result).toEqual({ allowed: true, count: 50, limit: 200 });
  });

  it("blocks when count equals the limit", async () => {
    const admin = makeAdmin({ count: 200, error: null });
    const result = await checkDailyMessageLimit(admin, "user-1");
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(200);
    expect(result.limit).toBe(200);
  });

  it("blocks when count exceeds the limit", async () => {
    const admin = makeAdmin({ count: 999, error: null });
    const result = await checkDailyMessageLimit(admin, "user-1");
    expect(result.allowed).toBe(false);
  });

  it("respects DAILY_MESSAGE_LIMIT env var override", async () => {
    process.env.DAILY_MESSAGE_LIMIT = "50";
    const admin = makeAdmin({ count: 49, error: null });
    const result = await checkDailyMessageLimit(admin, "user-1");
    expect(result).toEqual({ allowed: true, count: 49, limit: 50 });

    const admin2 = makeAdmin({ count: 50, error: null });
    const result2 = await checkDailyMessageLimit(admin2, "user-1");
    expect(result2.allowed).toBe(false);
  });

  it("fails open (allowed=true with count=0) on query error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = makeAdmin({ count: null, error: { message: "down" } });
    const result = await checkDailyMessageLimit(admin, "user-1");
    expect(result).toEqual({ allowed: true, count: 0, limit: 200 });
    consoleSpy.mockRestore();
  });
});
