-- Add the fourth feature gate: extraction_brief.
--
-- OFF puts Jove in voice-only mode — the background Sonnet extraction call is
-- skipped and no analysis brief is rendered into the prompt, so nothing steers
-- the conversation but the base voice and the live transcript. (Checkpoints
-- depend on extraction state, so with this OFF the checkpoint gate fails closed
-- even if the `checkpoints` gate is ON.)
--
-- Append-only follow-up to 20260604000002 (which created the table and seeded
-- the first three gates). Run after 0002. Defaults ON, so production behavior
-- is unchanged until an admin flips it. Same deletion condition as the table.

insert into public.feature_gates (key, enabled) values
  ('extraction_brief', true)
on conflict (key) do nothing;
