-- Enforce strict E.164 on phone_numbers.phone.
--
-- Sendblue rejects non-E.164 numbers at the wire. The normalizePhone()
-- helper and the POST /api/user/phone regex already produce E.164 at every
-- write path, so this constraint is defense-in-depth, not a migration from
-- a loose state. Run the phone-format audit SQL in the dashboard before
-- applying — if any rows violate, run scripts/normalize-phone-numbers.ts
-- first (see docs/decisions.md ADR-035 and the migration guide).
--
-- Idempotent: wraps ADD CONSTRAINT in a pg_constraint existence guard so
-- re-running the migration is safe.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'phone_numbers_phone_e164'
  ) then
    alter table public.phone_numbers
      add constraint phone_numbers_phone_e164
      check (phone ~ '^\+[1-9][0-9]{1,14}$');
  end if;
end $$;
