// Phone OTP helpers. Kept tiny and Node-only — both the send and verify
// routes run on the Node runtime because bcrypt-style primitives don't live
// on the Edge, and we use Node's `crypto` module for deterministic hashing
// and RNG.
//
// SECURITY: We store only the SHA-256 hex digest of the raw 6-digit code.
// A hash of a 6-digit code is brute-forceable offline (only ~10^6 inputs),
// but combined with (a) a 10-minute expiry, (b) the per-row attempts
// counter capped at OTP_MAX_ATTEMPTS, and (c) phone-keyed Upstash rate
// limiting on the verify endpoint when provisioned, an attacker who reads
// the database cannot meaningfully convert hashes back into live codes
// before they expire. The hash exists so that a leaked DB snapshot does
// not immediately yield valid OTPs for codes still in flight.
//
// The per-row attempts counter was removed in migration 20260417000009
// per ADR-038 on the assumption that Upstash would carry per-phone abuse
// protection. Upstash was never provisioned in production, leaving OTP
// brute force effectively unlimited. Migration 20260519000000 restored
// the otp_attempts column on phone_numbers; the verify route reads it,
// increments on wrong code, and rejects once attempts >= OTP_MAX_ATTEMPTS.
// The send route and successful verify both reset the counter to 0.

import { randomInt, createHash } from "crypto";

/** Maximum failed OTP verify attempts allowed per fresh code issuance.
 *  Once exceeded, the verify route returns 429 until a new OTP is sent
 *  (which resets the counter). 5 gives a real user room for typos while
 *  bounding brute force at ~5-in-10^6 odds per OTP lifetime. */
export const OTP_MAX_ATTEMPTS = 5;

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOtp(): string {
  return String(randomInt(100000, 1000000)); // 100000..999999 inclusive
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function otpExpiryFromNow(now: number = Date.now()): string {
  return new Date(now + OTP_TTL_MS).toISOString();
}

export function isExpired(expiresAt: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now;
}
