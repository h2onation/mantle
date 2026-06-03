-- Reorder the Manual layers so the strengths layer ("My Strengths") leads as
-- Layer 1. The canonical definition in src/lib/manual/layers.ts now numbers the
-- layers:
--   1 = My Strengths            (was 5, slug "where-strong")
--   2 = Some of My Patterns     (was 1, slug "patterns")
--   3 = How I Process Things    (was 2, slug "processing")
--   4 = What Helps              (was 3, slug "what-helps")
--   5 = How I Show Up with People (was 4, slug "with-people")
--
-- Existing rows store the OLD numbering in `layer`, so remap them to the new
-- scheme. Both data tables carry a CHECK (layer IN (1..5)); every branch of the
-- CASE produces a value in 1..5, so the single statement never violates the
-- constraint and needs no temporary widening. Each UPDATE is atomic.
--
-- On a fresh database (CI / new env) both tables are empty and these statements
-- are no-ops, so this migration is safe to run anywhere.

UPDATE public.manual_entries
SET layer = CASE layer
  WHEN 5 THEN 1
  WHEN 1 THEN 2
  WHEN 2 THEN 3
  WHEN 3 THEN 4
  WHEN 4 THEN 5
  ELSE layer
END;

UPDATE public.manual_changelog
SET layer = CASE layer
  WHEN 5 THEN 1
  WHEN 1 THEN 2
  WHEN 2 THEN 3
  WHEN 3 THEN 4
  WHEN 4 THEN 5
  ELSE layer
END;

-- ── Rollback (run by hand to revert) ────────────────────────────────────────
-- UPDATE public.manual_entries
-- SET layer = CASE layer
--   WHEN 1 THEN 5
--   WHEN 2 THEN 1
--   WHEN 3 THEN 2
--   WHEN 4 THEN 3
--   WHEN 5 THEN 4
--   ELSE layer
-- END;
-- UPDATE public.manual_changelog
-- SET layer = CASE layer
--   WHEN 1 THEN 5
--   WHEN 2 THEN 1
--   WHEN 3 THEN 2
--   WHEN 4 THEN 3
--   WHEN 5 THEN 4
--   ELSE layer
-- END;
