-- Drop the vestigial `checkpoints` feature gate.
--
-- It gated Jove's auto-propose (the pushed-checkpoint pipeline). After that
-- pipeline was deleted (Wave 3 ship 2, 2026-07-03), nothing in live code reads
-- `gates.checkpoints` — capture is the user-pulled meter, which has no such
-- gate. The gate is removed from FeatureGates, FEATURE_GATE_KEYS, and the admin
-- Feature Gates panel, so its row is orphaned config.
--
-- Unknown keys are ignored by getFeatureGates, so a missing row already reads
-- as absent; this DELETE only cleans up the row if one was ever written.
-- Auto-applies on merge to main (supabase db push).

delete from public.feature_gates where key = 'checkpoints';
