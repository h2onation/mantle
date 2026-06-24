-- Split the single `conversation_modes` feature gate into two per-mode gates:
-- `guided_intake` and `upload`. Situation stays the always-on floor and has no
-- gate (with both of these OFF, every conversation runs "situation" — the old
-- single-gate behavior).
--
-- Why: the admin panel now exposes an independent switch per optional entry
-- mode, and the Home entry doors render disabled ("Coming soon") when their
-- mode's gate is off. See src/lib/persona/feature-gates.ts (FEATURE_GATE_KEYS)
-- and src/app/app/page.tsx (reads gates → enabledModes prop).
--
-- Append-only follow-up to 20260604000002 (which created the table). Both new
-- gates seed ON, so production behavior is unchanged until an admin flips one.
-- The read fails open to ON for any missing row, so this seed is for tidiness
-- and explicitness, not correctness. Same deletion condition as the table.

-- Seed the two new gates ON. on conflict do nothing never clobbers an admin's
-- chosen state on re-run.
insert into public.feature_gates (key, enabled) values
  ('guided_intake', true),
  ('upload', true)
on conflict (key) do nothing;

-- Remove the now-orphaned single gate. The app no longer maps `conversation_modes`
-- (FEATURE_GATE_KEYS dropped it), so a lingering row would just be dead config.
delete from public.feature_gates where key = 'conversation_modes';
