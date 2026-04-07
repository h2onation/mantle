import { describe, it, expect, vi } from "vitest";
import {
  checkLimit,
  checkLimits,
  rateLimitedResponse,
  type RateLimitResult,
} from "@/lib/rate-limit";

describe("checkLimit", () => {
  it("fails open (success=true) when limiter is null", async () => {
    const result = await checkLimit(null, "user-1");
    expect(result.success).toBe(true);
  });

  it("fails open when limiter throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = {
      limit: vi.fn().mockRejectedValue(new Error("redis down")),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkLimit(broken as any, "user-1");
    expect(result.success).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns success result when limiter allows", async () => {
    const limiter = {
      limit: vi
        .fn()
        .mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkLimit(limiter as any, "user-1");
    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it("returns failure with retryAfterSeconds when limiter blocks", async () => {
    const limiter = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 30_000,
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkLimit(limiter as any, "user-1");
    expect(result.success).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});

describe("checkLimits", () => {
  it("returns first failing limiter's result", async () => {
    const passing = {
      limit: vi
        .fn()
        .mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }),
    };
    const failing = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60_000,
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkLimits([passing as any, failing as any], "user-1");
    expect(result.success).toBe(false);
    expect(result.limit).toBe(100);
  });

  it("returns success when all limiters pass", async () => {
    const a = {
      limit: vi
        .fn()
        .mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }),
    };
    const b = {
      limit: vi
        .fn()
        .mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkLimits([a as any, b as any], "user-1");
    expect(result.success).toBe(true);
  });

  it("treats null limiters in the list as fail-open", async () => {
    const result = await checkLimits([null, null], "user-1");
    expect(result.success).toBe(true);
  });
});

describe("rateLimitedResponse", () => {
  it("returns 429 with error body and Retry-After header", async () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 10_000,
      retryAfterSeconds: 10,
    };
    const res = rateLimitedResponse(result);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("10");
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/too quickly/i);
  });

  it("omits Retry-After when retryAfterSeconds missing", () => {
    const res = rateLimitedResponse({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 0,
    });
    expect(res.headers.get("Retry-After")).toBeNull();
  });
});
