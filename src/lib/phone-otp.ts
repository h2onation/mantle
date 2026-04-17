// Phone OTP helpers. Kept tiny and Node-only — both the send and verify
// routes run on the Node runtime because bcrypt-style primitives don't live
// on the Edge, and we use Node's `crypto` module for deterministic hashing
// and RNG.
//
// SECURITY: We store only the SHA-256 hex digest of the raw 6-digit code.
// A hash of a 6-digit code is brute-forceable offline (only ~10^6 inputs),
// but combined with (a) a 10-minute expiry and (b) phone-keyed Upstash rate
// limiting on the verify endpoint, an attacker who reads the database cannot
// meaningfully convert hashes back into live codes before they expire. The
// hash exists so that a leaked DB snapshot does not immediately yield valid
// OTPs for codes still in flight.
//
// The per-row attempts counter was removed with the schema alignment in
// migration 20260417000009. See ADR-038 for the removal rationale and the
// Upstash env-var gap that must be closed before beta.

import { randomInt, createHash } from "crypto";

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
