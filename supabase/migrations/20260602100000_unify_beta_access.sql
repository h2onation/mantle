-- Unify beta access into the waitlist table. The waitlist row's `status` is now
-- the single source of truth for access: status = 'invited' means the email is
-- allowed to sign up / log in. This retires the separate beta_allowlist table
-- (which is left in place here and dropped in a later migration once prod login
-- is verified on the new gate — see docs/state.md).
--
-- Before: access = "email exists in beta_allowlist". Inviting copied the email
-- into beta_allowlist and deleted the waitlist row (a non-atomic two-table move
-- that could drift). After: invite is a single status flip; access reads
-- waitlist WHERE status = 'invited'.

-- 1. notes absorbs beta_allowlist.notes (used for manually-granted access).
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS notes text;

-- 2. Backfill: every currently-allowlisted email becomes an 'invited' signup.
--    Merge by email (waitlist has UNIQUE(email)) — existing rows are promoted to
--    invited; allowlist-only emails are inserted. seen = true so backfilled
--    grants never surface in the "new signups" badge. Idempotent.
INSERT INTO public.waitlist (email, source, status, notes, seen, created_at)
SELECT ba.email, NULL, 'invited', ba.notes, true, ba.created_at
FROM public.beta_allowlist ba
ON CONFLICT (email) DO UPDATE
  SET status = 'invited',
      notes  = COALESCE(waitlist.notes, EXCLUDED.notes);
