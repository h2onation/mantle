-- Add a `situation` feature gate, making all three conversation modes
-- toggleable. Until now Situation was the always-on floor with no switch; this
-- adds one so the app can run a guided-solo (or upload-solo) configuration —
-- turn `situation` off and its Home door renders "Coming soon" while new /
-- fallback conversations resolve to the next enabled mode.
--
-- Situation REMAINS the engine's ultimate hard floor in code: if every mode
-- gate is off, resolveConversationMode (src/lib/persona/persona-pipeline.ts)
-- still returns "situation", so a conversation is never left mode-less. This
-- gate only governs the Home door + the default/fallback target.
--
-- Append-only follow-up to 20260624000000 (per-mode split) and 20260604000002
-- (table). Seeds ON, so production behavior is unchanged until an admin flips
-- it. The read fails open to ON for any missing row, so this seed is for
-- tidiness and explicitness, not correctness. Same deletion condition as the
-- table. Run by hand via the Supabase dashboard (ADR-036).

insert into public.feature_gates (key, enabled) values
  ('situation', true)
on conflict (key) do nothing;
