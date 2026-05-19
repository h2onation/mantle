-- Restore otp_attempts column to phone_numbers for per-row OTP brute-force
-- protection. Reverses the open half of ADR-038 (which removed the in-code
-- attempts counter on the assumption that Upstash rate limiting would
-- carry the load; Upstash env vars were never provisioned in production
-- so per-phone OTP attempts have been effectively unlimited until the
-- 10-minute code expiry).
--
-- The verify route (`src/app/api/user/phone/verify/route.ts`) reads this
-- column, rejects with 429 once attempts >= OTP_MAX_ATTEMPTS (5), and
-- increments it on every wrong code submission. The send route
-- (`src/app/api/user/phone/route.ts`) resets it to 0 whenever a fresh OTP
-- is issued so a legitimate user who fat-fingers and re-requests is not
-- locked out. Successful verify also resets it to 0 as part of the row
-- promotion.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-applying is a no-op. Default
-- 0 means existing rows (if any predate this migration) are treated as
-- "no attempts yet" rather than locked.

alter table public.phone_numbers
  add column if not exists otp_attempts integer not null default 0;

comment on column public.phone_numbers.otp_attempts is
  'Failed OTP verify attempts since the last fresh code issuance. Capped at OTP_MAX_ATTEMPTS in app code; resets to 0 on every send and on successful verify. Restored 2026-05-19 reversing the open half of ADR-038.';
