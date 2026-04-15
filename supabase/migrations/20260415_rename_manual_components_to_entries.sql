-- Migration: Rename the manual_components table to manual_entries to align
-- with the canonical vocabulary (Manual / Layer / Entry / Checkpoint).
--
-- Table rename only — no schema changes, no data changes. Postgres carries
-- existing indexes, foreign keys, and RLS policies through ALTER TABLE RENAME
-- automatically. The two RLS policy names that contained "components" are
-- renamed for consistency; the third ("Users can view own manual") already
-- omits the word and is left alone.
--
-- The DB rename was applied by hand in the Supabase dashboard SQL editor on
-- 2026-04-15. This file codifies the same change so fresh environments and CI
-- arrive at the same state. It is safe to re-run on an already-renamed
-- database because of the IF EXISTS guards.
--
-- Must deploy atomically with the application code that reads/writes this
-- table (every .from('manual_components') call updates to manual_entries).

ALTER TABLE IF EXISTS public.manual_components RENAME TO manual_entries;

-- ALTER POLICY does not support IF EXISTS, so guard with a lookup.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_entries'
      AND policyname = 'Users can create own manual components'
  ) THEN
    ALTER POLICY "Users can create own manual components"
      ON public.manual_entries
      RENAME TO "Users can create own manual entries";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_entries'
      AND policyname = 'Users can update own manual components'
  ) THEN
    ALTER POLICY "Users can update own manual components"
      ON public.manual_entries
      RENAME TO "Users can update own manual entries";
  END IF;
END $$;
