-- Drop the legacy onboarding-modal step counter.
-- The modal_progress ladder (0-3) sequenced three onboarding popups. The last
-- of those, the "halfway there" Pattern-Forming modal, was removed 2026-07-01
-- along with the POST /api/modal-progress endpoint and every ladder advance.
-- No code reads or writes this column anymore (GET /api/modal-progress selects
-- only created_at; door-intro gating moved to door_intros_seen). Safe to drop.

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS modal_progress;
