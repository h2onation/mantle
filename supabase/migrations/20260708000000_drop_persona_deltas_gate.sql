-- Drop the vestigial `persona_deltas` feature gate.
--
-- It clamped personaModes to ["general"] when OFF. But nothing downstream reads
-- personaModes under the conductor (audited 2026-07-07): the conductor prompt is
-- persona-blind and extraction never consumed it — so the gate was a dead switch
-- that changed no live behavior. The persona system itself (the ND voice deltas,
-- the profiles.persona_modes column, the settings picker) is kept per the settled
-- ND-personas decision; only the debug gate is removed. It is gone from
-- FeatureGates, FEATURE_GATE_KEYS, and the admin Feature Gates panel, so its row
-- is orphaned config.
--
-- Unknown keys are ignored by getFeatureGates, so a missing row already reads as
-- absent; this DELETE only cleans up the seeded row. Auto-applies on merge to
-- main (supabase db push).

delete from public.feature_gates where key = 'persona_deltas';
