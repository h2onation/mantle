-- Migration: Drop the stale `type` column from manual_entries + manual_changelog.
--
-- 20260407_drop_pattern_type.sql (targeting manual_components) was never
-- applied in production. The table was later renamed to manual_entries via
-- 20260415_rename_manual_components_to_entries.sql, so the abandoned NOT NULL
-- `type` column rode along under the new name. It rejected every insert from
-- confirm-checkpoint.ts with "null value in column \"type\" ... violates
-- not-null constraint" — which surfaced to the user as "Something went wrong
-- saving that. Try again."
--
-- This migration retries the drop against the current table names. Idempotent.

-- ── manual_entries ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.unique_component_per_layer;
DROP INDEX IF EXISTS public.unique_pattern_name_per_layer;

ALTER TABLE public.manual_entries
  DROP CONSTRAINT IF EXISTS manual_components_type_check;

ALTER TABLE public.manual_entries
  DROP CONSTRAINT IF EXISTS manual_entries_type_check;

ALTER TABLE public.manual_entries
  DROP COLUMN IF EXISTS type;

-- ── manual_changelog ────────────────────────────────────────────────────────
ALTER TABLE public.manual_changelog
  DROP CONSTRAINT IF EXISTS manual_changelog_type_check;

ALTER TABLE public.manual_changelog
  DROP COLUMN IF EXISTS type;
