// Rate limiting via Upstash Redis (sliding window).
//
// IMPORTANT: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set
// in Vercel environment variables (production) for these limiters to engage.
// If either is missing, every limiter FAILS OPEN — the request is allowed
// and a warning is logged. We never block real users because our limiter is
// down; the trade-off is intentional.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix ms when the window resets
  retryAfterSeconds?: number;
};

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  console.warn(
    "[rate-limit] Upstash env vars missing — all rate limiters will fail open"
  );
}

function makeLimiter(
  limit: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
  prefix: string
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    prefix,
  });
}

// /api/chat — authenticated users
export const chatAuthMinute = makeLimiter(15, "1 m", "rl:chat:auth:min");
export const chatAuthDay = makeLimiter(100, "1 d", "rl:chat:auth:day");

// /api/chat — anonymous users (Gate A)
export const chatAnonMinute = makeLimiter(5, "1 m", "rl:chat:anon:min");
export const chatAnonDay = makeLimiter(30, "1 d", "rl:chat:anon:day");

// Secondary routes
export const sessionSummaryHour = makeLimiter(10, "1 h", "rl:session-summary");
export const checkpointConfirmHour = makeLimiter(20, "1 h", "rl:checkpoint-confirm");

// Phone OTP — keyed by phone number (not user id) so an attacker cannot bypass
// by spamming a victim's number from many accounts.
//   - phoneOtpSendHour:    cap on OTP sends per phone (5/hour)
//   - phoneOtpVerifyTenMin: cap on verify attempts per phone (5/10min) — this
//                           is a defense in depth on top of otp_attempts in DB
export const phoneOtpSendHour = makeLimiter(5, "1 h", "rl:phone-otp-send");
export const phoneOtpVerifyTenMin = makeLimiter(5, "10 m", "rl:phone-otp-verify");

// Public, unauthenticated waitlist submissions — keyed by IP since there is
// no user. 3/hour is generous enough for legitimate retries (typo + resubmit)
// while making spam expensive.
export const waitlistSubmitHour = makeLimiter(3, "1 h", "rl:waitlist");

const ALLOW_OPEN: RateLimitResult = {
  success: true,
  limit: 0,
  remaining: 0,
  reset: 0,
};

/**
 * Check a single limiter. Fails open on any error or if the limiter is null
 * (env vars missing). Always returns a result — never throws.
 */
export async function checkLimit(
  limiter: Ratelimit | null,
  key: string
): Promise<RateLimitResult> {
  if (!limiter) return ALLOW_OPEN;
  try {
    const res = await limiter.limit(key);
    const retryAfterSeconds = res.success
      ? undefined
      : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
      retryAfterSeconds,
    };
  } catch (err) {
    console.warn(
      "[rate-limit] limiter error, failing open:",
      err instanceof Error ? err.message : "unknown"
    );
    return ALLOW_OPEN;
  }
}

/**
 * Check multiple limiters with the same key. Returns the first failing result,
 * or a success result if all pass. Used for /api/chat where two windows
 * (per-minute + per-day) must both pass.
 */
export async function checkLimits(
  limiters: Array<Ratelimit | null>,
  key: string
): Promise<RateLimitResult> {
  for (const l of limiters) {
    const r = await checkLimit(l, key);
    if (!r.success) return r;
  }
  return ALLOW_OPEN;
}

/**
 * Build a 429 Response with the standard rate-limit body and Retry-After header.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (result.retryAfterSeconds) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return new Response(
    JSON.stringify({
      error: "You're sending messages too quickly. Please wait a moment.",
    }),
    { status: 429, headers }
  );
}
