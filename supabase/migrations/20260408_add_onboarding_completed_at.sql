-- Add onboarding completion tracking to profiles.
--
-- For closed beta: every authenticated user must pass through the
-- InfoScreens + SeedScreen disclaimers once before reaching the app.
-- The check lives in MainApp; null = needs onboarding.
--
-- The backfill below sets every existing profile to now() so existing
-- real users (and any pre-existing anonymous accounts) are NOT forced
-- through onboarding on next login. Only fresh signups with no profile
-- row, or signups whose profile gets created after this migration runs,
-- will see the onboarding flow.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz default null;

update public.profiles
  set onboarding_completed_at = now()
  where onboarding_completed_at is null;
