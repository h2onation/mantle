-- Track onboarding modal progression (0-3).
-- Increments on dismissal via /api/modal-progress (idempotent server-side).
-- 0 = none seen, 1 = chat-window modal dismissed, 2 = pattern-forming
-- modal dismissed, 3 = first-checkpoint modal dismissed (terminal).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS modal_progress integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.modal_progress IS
  'Sequential onboarding modal progression (0-3). Increments on dismissal only. Terminal at 3.';
