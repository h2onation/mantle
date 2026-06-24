-- Structure migration — STEP 1 (additive, non-destructive).
--
-- Adds the new organizing structure (life-area `section` + closed `tags[]`)
-- ALONGSIDE the existing pattern-type `layer` integer. Nothing is overwritten:
-- `layer` and its CHECK (`manual_components_layer_check`) are left frozen as
-- internal provenance / audit oracle / rollback key. No code reads `section`
-- or `tags` yet (that is Step 3), so this migration changes zero behaviour.
--
-- Plan: docs/reference/structure-migration-plan.md (§4 Step 1).
-- Constraint logic verified by docs/reference/structure-migration-checks.sql
-- (the cross-column rule is the COALESCE-hardened form — the naive form has a
-- null-section hole where a relationship tag on a NULL-section row is wrongly
-- accepted, because Postgres CHECKs pass on a NULL predicate).
--
-- Existing rows (section = NULL, tags = '{}') satisfy all three constraints, so
-- adding them validates cleanly. Idempotent: safe to re-run.
--
-- RLS: manual_entries' policies are row-level (auth.uid() = user_id) and are
-- not column-scoped, so they cover the new columns automatically. No policy
-- change is needed or made here.

-- ── Columns ────────────────────────────────────────────────────────────────
-- section: nullable during rollout (backfilled in Step 2; optionally SET NOT
--   NULL much later once every row is populated).
ALTER TABLE public.manual_entries
  ADD COLUMN IF NOT EXISTS section text;

-- tags: NOT NULL DEFAULT '{}' — a non-volatile default, so adding it is a fast
--   metadata-only change and existing rows backfill to the empty array.
ALTER TABLE public.manual_entries
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

-- ── Constraints (idempotent; ADD CONSTRAINT has no IF NOT EXISTS) ────────────
DO $$
BEGIN
  -- section is a closed set (or NULL during rollout).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manual_entries_section_closed') THEN
    ALTER TABLE public.manual_entries
      ADD CONSTRAINT manual_entries_section_closed
      CHECK (section IS NULL OR section IN
        ('relationships','work-money','routines-structure','sensory-burnout','interests-flow'));
  END IF;

  -- tags is a closed set (every element ∈ the four). Empty array passes.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manual_entries_tags_closed') THEN
    ALTER TABLE public.manual_entries
      ADD CONSTRAINT manual_entries_tags_closed
      CHECK (tags <@ ARRAY['strength','romantic','family','friends']::text[]);
  END IF;

  -- Relationship sub-tags (romantic/family/friends) are valid ONLY when the
  -- entry's section is 'relationships'. COALESCE forces a definite boolean so a
  -- relationship tag on a NULL-section row is rejected (the naive
  -- `OR section = 'relationships'` would let it through — NULL predicate passes).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manual_entries_rel_tag_home') THEN
    ALTER TABLE public.manual_entries
      ADD CONSTRAINT manual_entries_rel_tag_home
      CHECK (NOT (tags && ARRAY['romantic','family','friends']::text[])
             OR COALESCE(section, '') = 'relationships');
  END IF;
END $$;

-- ── Documentation ────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.manual_entries.section IS
  'Life-area home (closed slug set). The stable structural key going forward. Backfilled in Step 2.';
COMMENT ON COLUMN public.manual_entries.tags IS
  'Closed cross-cutting tag set: strength (any section) + romantic/family/friends (Relationships only).';
COMMENT ON COLUMN public.manual_entries.layer IS
  'FROZEN legacy pattern-type id (1-5). No longer the structural key — kept as provenance / audit oracle / rollback. Do not write.';

-- ── Rollback (run by hand to revert Step 1) ─────────────────────────────────
-- Safe at any point before Step 3 code reads these columns. `layer` is never
-- touched, so this fully restores the pre-Step-1 state with no data loss.
-- ALTER TABLE public.manual_entries DROP CONSTRAINT IF EXISTS manual_entries_rel_tag_home;
-- ALTER TABLE public.manual_entries DROP CONSTRAINT IF EXISTS manual_entries_tags_closed;
-- ALTER TABLE public.manual_entries DROP CONSTRAINT IF EXISTS manual_entries_section_closed;
-- ALTER TABLE public.manual_entries DROP COLUMN IF EXISTS tags;
-- ALTER TABLE public.manual_entries DROP COLUMN IF EXISTS section;
