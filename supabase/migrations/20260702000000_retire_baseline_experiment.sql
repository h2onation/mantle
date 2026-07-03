-- Retire the strip-to-baseline experiment (concluded 2026-07-02).
--
-- The conductor voice — which shared the experiment's table via the `conductor`
-- key — moves to the global feature_gates table. It stays admin-scoped in
-- application code (persona-pipeline.ts: conductorActive = isAdmin &&
-- gates.conductor), so it still can never reach a real user. Everything else in
-- baseline_experiment_gates was experiment-only scaffolding and is removed with
-- the module, its route, and its admin panel.
--
-- 1) Seed the `conductor` feature gate OFF (fail-closed, same posture as
--    reflection_meter). A missing row already reads as off, so this is for
--    explicitness; admins re-enable the conductor in the Feature Gates panel.
-- 2) Drop the baseline_experiment_gates table.
--
-- Auto-applies on merge to main (supabase db push). The DROP is intentional and
-- destructive: the experiment is concluded and all its switches are gone from
-- the app. Same key/enabled shape as feature_gates; no data worth preserving.

insert into public.feature_gates (key, enabled) values
  ('conductor', false)
on conflict (key) do nothing;

drop table if exists public.baseline_experiment_gates;
