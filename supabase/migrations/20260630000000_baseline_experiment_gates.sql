-- ⚠ TEMPORARY EXPERIMENT — strip-to-baseline (Part A). DELETE WHEN CONCLUDED.
--
-- These switches strip safety-shaping/timing FORCES out of Jove to measure how
-- close the bare model's save-timing lands to a real seam, then add forces back
-- one rung at a time. A stripped Jove must NEVER reach a real user, so unlike
-- feature_gates (which are global), these are ADMIN-SCOPED at the application
-- layer: the baseline variant is applied ONLY when the conversation's user is an
-- admin (src/lib/persona/persona-pipeline.ts → loadConversationContext), on top
-- of admin-only writes (requireAdmin). Reads fail CLOSED to all-off.
--
-- Same key/enabled shape + deny-all RLS as feature_gates. Keys (all default off,
-- i.e. absent row = off):
--   enabled                   master: put Jove into the baseline variant at all
--   force_gate                re-enable the server material-quality gate
--   force_flag_dont_grab      rung 1 — pre-proposal restraint (MECH_FLAG)
--   force_seam_rule           rung 2 — propose only at a seam (MECH_SEAM)
--   force_mechanics_deepening rung 3 — the rest of REBUILT_MECHANICS
--   force_character_shaping   rung 4 — REBUILT_CHARACTER instead of neutral id
--   force_tier3_blocks        final arm — the mode's Tier-3 guidance (intake)
--
-- ── TEARDOWN (when the strip-down experiment concludes) ──────────────────────
-- Delete ALL of it: drop this table; remove getBaselineExperiment + the route
-- /api/admin/baseline-experiment; delete BaselineExperimentPanel and its mount
-- in src/app/admin/page.tsx; remove the baselineForces / baselineGateOpen /
-- isAdmin threading in persona-pipeline.ts + call-persona.ts + chat/route.ts;
-- delete src/lib/persona/baseline-experiment.ts and the REBUILT_MECHANICS carve
-- if no longer needed. Crisis/988 safety is NOT behind any of these switches.

create table if not exists public.baseline_experiment_gates (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.baseline_experiment_gates enable row level security;
-- No policies: deny-all to anon/auth clients. Server access is service-role
-- only (bypasses RLS), and the chat path additionally applies the result only
-- for admin users. No row is seeded — absence of a key means "off".
