-- phone_numbers is one-row-per-user. The OTP code has always assumed this —
-- it reads and writes the row by user_id, and GET + /verify use maybeSingle().
-- But nothing enforced it, so two concurrent "send code" requests could each
-- insert a row and leave the user with duplicate phone_numbers rows (which then
-- break GET/verify's maybeSingle()).
--
-- Add UNIQUE(user_id). The send route does insert-then-fallback-to-update on a
-- 23505, so a concurrent insert now loses the race cleanly instead of
-- duplicating. (The route does NOT break without this constraint — the fallback
-- simply never triggers until it exists — so applying this migration is safe to
-- do alongside or shortly after the code ships.)
--
-- Assumes no existing duplicates (true in beta). If this fails with a
-- unique_violation, dedup phone_numbers by user_id first — keep the verified row
-- if any, else the most recently updated — then re-run.
--
-- Idempotent: only adds the constraint if it isn't already present (the live DB
-- already had phone_numbers_user_id_key, so a plain ADD CONSTRAINT errors with
-- 42P07). Postgres has no ADD CONSTRAINT IF NOT EXISTS, hence the DO block.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_numbers_user_id_key'
      AND conrelid = 'public.phone_numbers'::regclass
  ) THEN
    ALTER TABLE public.phone_numbers
      ADD CONSTRAINT phone_numbers_user_id_key UNIQUE (user_id);
  END IF;
END $$;
