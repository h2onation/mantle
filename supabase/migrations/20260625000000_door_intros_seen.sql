-- Per-door intro tracking.
--
-- Each intake door (situation / guided-intake / upload) shows a one-time
-- "how this works" intro the first time a user opens it. This column records
-- which doors a given user has already seen the intro for, so each door's
-- intro fires exactly once per user. Replaces the single global modal_progress
-- gate for the old shared "How this works" modal (modal_progress is retained
-- for the later pattern-forming / first-checkpoint modals; the door-intro
-- POST advances it to >= 1 on the user's first door intro so that chain still
-- fires).
--
-- Read/write path: GET /api/door-intros returns this array alongside the
-- per-door copy; POST /api/door-intros appends a mode after the user dismisses
-- that door's intro. Both run server-side via the service-role admin client
-- scoped to the authenticated user id (same pattern as modal_progress) — no
-- new RLS policy needed; profiles RLS already denies direct client writes.
--
-- Deletion condition: drop with the per-door intro feature if it is ever
-- removed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS door_intros_seen text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.door_intros_seen IS
  'Intake-door slugs whose one-time intro this user has already dismissed (situation / guided-intake / upload). Appended by POST /api/door-intros.';
