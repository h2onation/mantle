-- Drop the vestigial `reflection_meter` feature gate.
--
-- The reflection meter (the pull-model capture surface) is now unconditional on
-- web — persona-pipeline resolves reflectionMeterEnabled = (surface === "web"),
-- no longer keyed on this gate. After the Jove-pushed checkpoint path was
-- removed (Wave 3 ships 2-3, 2026-07-03), nothing read the gate except one
-- fail-closed check in /api/checkpoint/compose, which is itself removed in this
-- change. The gate is gone from FeatureGates, FEATURE_GATE_KEYS, the compose
-- route, and the admin Feature Gates panel — so its row is orphaned config.
--
-- A missing row already reads as absent (unknown keys are ignored by
-- getFeatureGates), so this DELETE only cleans up the row an admin flipped on by
-- hand in prod; it changes no behavior. Auto-applies on merge to main
-- (supabase db push).

delete from public.feature_gates where key = 'reflection_meter';
