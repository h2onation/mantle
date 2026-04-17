-- Align phone_numbers column names with code:
--   verification_code → otp_code
--   code_expires_at   → otp_expires_at
--
-- Code at /api/user/phone, /api/user/phone/verify, and the matching test
-- file has always used otp_code / otp_expires_at. The schema used a
-- different convention, which caused PGRST204 on every OTP write. Renaming
-- the schema to match the code is the cheapest reconciliation.
--
-- Idempotent: guarded by information_schema so re-running is a no-op.
--
-- Related: otp_attempts is intentionally NOT added. The in-code attempts
-- counter is removed in the same change; per-phone abuse protection lives
-- in the Upstash rate limiter on the OTP routes. See ADR-038 for the
-- Upstash env-var gap and follow-up work.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'phone_numbers'
      and column_name = 'verification_code'
  ) then
    alter table public.phone_numbers rename column verification_code to otp_code;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'phone_numbers'
      and column_name = 'code_expires_at'
  ) then
    alter table public.phone_numbers rename column code_expires_at to otp_expires_at;
  end if;
end $$;
