-- ---------------------------------------------------------------------------
-- Add OTP fields to phone_numbers for verified phone linking.
--
-- The previous flow set verified=true on first POST /api/user/phone, which
-- meant any user could hijack another user's number by submitting it. The new
-- flow stores a hashed OTP, sends it to the phone via Linq, and only flips
-- verified=true after the user POSTs the matching code to /api/user/phone/verify.
--
-- otp_code is the SHA-256 hex digest of the raw 6-digit code — never the raw
-- code itself. If the database is compromised the hashes are not directly
-- usable to verify against the API (the API hashes the user-submitted code
-- before comparison).
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.phone_numbers
  ADD COLUMN IF NOT EXISTS otp_code text;

ALTER TABLE IF EXISTS public.phone_numbers
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;

ALTER TABLE IF EXISTS public.phone_numbers
  ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0;
