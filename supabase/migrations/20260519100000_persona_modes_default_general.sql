-- Change persona_modes column default from {autistic} to {general}.
--
-- The original default was set in migration 20260513150000 when we expanded
-- from single text to text[]. At that point autistic was the canonical voice
-- for the ND-first beta. The Situation polish (May 19) introduced a true
-- base+delta voice architecture where each persona is a trait delta on top
-- of a shared neutral base, which means "general" is the right neutral
-- starting point: no neurotype-specific framing, full base voice.
--
-- Effect: new profile rows that don't specify persona_modes will get
-- {general} instead of {autistic}. Existing rows are unchanged — onboarding
-- writes an explicit value per the user's selection, and any one-off
-- backfills target specific users by email (per CLAUDE.md admin-safety
-- rule). App-side fallbacks in `composeTier2`, `buildSystemPrompt*`, and
-- `loadConversationContext` were also flipped to {general} for alignment.
--
-- Idempotent: re-running this migration sets the default to the same value.
-- The CHECK constraint (profiles_persona_modes_check) already allows
-- 'general' as a valid element, so no constraint change is needed.

alter table public.profiles
  alter column persona_modes set default '{general}';

comment on column public.profiles.persona_modes is
  'AI persona voice modes (multi-select). Null and unset default to {general} as of 2026-05-19. Valid elements: autistic, audhd, dyslexic, general. "general" is exclusive — it cannot combine with any neurotype mode.';
