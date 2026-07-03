-- Promote the conductor to the live voice (2026-07-02).
--
-- LIVE_VOICE_VARIANT flips to "conductor" in code (config.ts): every user now
-- gets the pull-model voice on web, and the conductor is selected on all
-- surfaces. The admin-scoped `conductor` feature gate (added in the Wave-2
-- teardown a few hours earlier) is therefore gone from the app — the conductor
-- is no longer an opt-in experiment, so its switch is removed.
--
-- Drop the now-orphaned `conductor` row from feature_gates. The reader ignores
-- unknown keys, so this is cleanup, not correctness. Rollback is code-side
-- (set LIVE_VOICE_VARIANT back to "rebuilt"), not a toggle — this was the
-- founder's explicit "hard-commit, no switch" call.
--
-- Auto-applies on merge to main (supabase db push).

delete from public.feature_gates where key = 'conductor';
