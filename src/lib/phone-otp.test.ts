import { describe, it, expect } from "vitest";
import {
  generateOtp,
  hashOtp,
  isExpired,
  otpExpiryFromNow,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
} from "@/lib/phone-otp";

describe("generateOtp", () => {
  it("returns a 6-digit string", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      const n = Number(code);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});

describe("hashOtp", () => {
  it("produces a SHA-256 hex digest (64 chars, deterministic)", () => {
    const a = hashOtp("123456");
    const b = hashOtp("123456");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different codes hash to different values", () => {
    expect(hashOtp("123456")).not.toBe(hashOtp("123457"));
  });

  it("never echoes the raw code", () => {
    const raw = "654321";
    expect(hashOtp(raw)).not.toContain(raw);
  });
});

describe("otpExpiryFromNow / isExpired", () => {
  it("expiry is 10 minutes in the future", () => {
    const now = 1_700_000_000_000;
    const exp = otpExpiryFromNow(now);
    expect(new Date(exp).getTime()).toBe(now + OTP_TTL_MS);
  });

  it("isExpired is false before expiry and true after", () => {
    const now = Date.now();
    const future = new Date(now + 1000).toISOString();
    const past = new Date(now - 1000).toISOString();
    expect(isExpired(future, now)).toBe(false);
    expect(isExpired(past, now)).toBe(true);
  });

  it("treats null expiry as expired", () => {
    expect(isExpired(null)).toBe(true);
  });
});

describe("constants", () => {
  it("OTP_MAX_ATTEMPTS is 5", () => {
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });
});
