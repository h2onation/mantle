-- Migration: Rename sage_* columns to persona_* as part of the internal
-- Sage → persona rename. This frees up the "Sage" name for the user-facing
-- display layer (wired through PERSONA_NAME in src/lib/persona/config.ts)
-- while the technical identifier becomes the generic "persona".
--
-- This is a column-rename-only migration — no data changes, no type changes.
-- Check constraints are dropped and recreated with the new column name.
-- No indexes exist on the renamed columns (verified 2026-04-14).
--
-- Must deploy atomically with the application code that reads these columns.

-- ── profiles.sage_mode → profiles.persona_mode ───────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sage_mode_check;

ALTER TABLE public.profiles
  RENAME COLUMN sage_mode TO persona_mode;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_persona_mode_check
  CHECK (persona_mode IS NULL OR persona_mode IN ('autistic'));

COMMENT ON COLUMN public.profiles.persona_mode IS
  'AI persona voice mode. Currently only ''autistic''. Null defaults to autistic.';

-- ── linq_group_chats: three columns ──────────────────────────────────────────
ALTER TABLE public.linq_group_chats
  RENAME COLUMN last_sage_spoke_at TO last_persona_spoke_at;

ALTER TABLE public.linq_group_chats
  RENAME COLUMN non_sage_participant_count TO non_persona_participant_count;

ALTER TABLE public.linq_group_chats
  RENAME COLUMN messages_since_sage_spoke TO messages_since_persona_spoke;

-- ── safety_events.sage_included_988 → persona_included_988 ──────────────────
ALTER TABLE public.safety_events
  RENAME COLUMN sage_included_988 TO persona_included_988;
