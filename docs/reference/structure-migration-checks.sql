-- ===========================================================================
-- CHECK-constraint verification harness for the structure migration (Step 1).
--
-- SAFE TO RUN ANYWHERE, INCLUDING YOUR REAL SUPABASE: it builds session-local
-- TEMP tables inside a single DO block (invisible to other sessions, dropped at
-- the end) and writes ZERO real data. It never touches manual_entries, so RLS
-- is irrelevant to it.
--
-- It is ONE statement on purpose: the Supabase SQL editor runs each top-level
-- statement on a pooled connection, so temp tables created in one statement do
-- NOT survive into the next (that causes "relation ... does not exist"). Keeping
-- everything in a single DO block runs it all on one backend.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL editor, execute, and
-- read the NOTICE output. You want the final line:   OVERALL: PASS
--
-- It tests TWO versions of the cross-column constraint in one run:
--   • Block A = NAIVE (`… OR section = 'relationships'`) — the buggy form. It
--     MUST report exactly ONE -> FAIL, on "THE HOLE" (relationship tag + NULL
--     section). That expected failure is the harness PROVING it can catch the
--     bug. If Block A shows 0 failures, the test is a rubber stamp — don't trust it.
--   • Block B = HARDENED (`… OR COALESCE(section,'') = 'relationships'`) — what
--     the migration ships. It MUST report 0 failures.
-- Gate is closed only when Block A = 1 failure (the hole) AND Block B = 0.
-- See docs/reference/structure-migration-plan.md §10.
-- ===========================================================================

DO $$
DECLARE
  r record;
  accepted boolean;
  fails_naive int := 0;
  fails_hardened int := 0;
BEGIN
  DROP TABLE IF EXISTS _probe_naive;
  DROP TABLE IF EXISTS _probe_hardened;

  -- Two temp tables, identical except the cross-column rule (naive vs hardened).
  CREATE TEMP TABLE _probe_naive (
    section text,
    tags    text[] NOT NULL DEFAULT '{}'::text[],
    CONSTRAINT _n_section_closed CHECK (section IS NULL OR section IN
      ('relationships','work-money','routines-structure','sensory-burnout','interests-flow')),
    CONSTRAINT _n_tags_closed CHECK (tags <@ ARRAY['strength','romantic','family','friends']::text[]),
    CONSTRAINT _n_rel_home CHECK (                                   -- NAIVE (buggy)
      NOT (tags && ARRAY['romantic','family','friends']::text[]) OR section = 'relationships')
  );
  CREATE TEMP TABLE _probe_hardened (
    section text,
    tags    text[] NOT NULL DEFAULT '{}'::text[],
    CONSTRAINT _h_section_closed CHECK (section IS NULL OR section IN
      ('relationships','work-money','routines-structure','sensory-burnout','interests-flow')),
    CONSTRAINT _h_tags_closed CHECK (tags <@ ARRAY['strength','romantic','family','friends']::text[]),
    CONSTRAINT _h_rel_home CHECK (                                   -- HARDENED (ships)
      NOT (tags && ARRAY['romantic','family','friends']::text[]) OR COALESCE(section,'') = 'relationships')
  );

  FOR r IN
    SELECT * FROM (VALUES
      ('relationships'::text, ARRAY[]::text[],               true,  'empty tags / relationships'),
      ('work-money',          ARRAY['strength'],             true,  'strength tag outside relationships (global)'),
      ('relationships',       ARRAY['romantic','strength'],  true,  'romantic + strength inside relationships'),
      (NULL,                  ARRAY[]::text[],               true,  'null section, no tags (rollout window)'),
      (NULL,                  ARRAY['strength'],             true,  'null section, strength only'),
      ('work-money',          ARRAY['romantic'],             false, 'romantic tag outside relationships'),
      ('sensory-burnout',     ARRAY['family'],               false, 'family tag outside relationships'),
      (NULL,                  ARRAY['friends'],              false, 'THE HOLE: relationship tag + null section'),
      ('relationships',       ARRAY['spicy'],                false, 'tag outside the closed set'),
      ('made-up',             ARRAY[]::text[],               false, 'section outside the closed set')
    ) AS t(section, tags, expect_accept, label)
  LOOP
    -- Block A: naive
    BEGIN
      EXECUTE 'INSERT INTO _probe_naive (section, tags) VALUES ($1, $2)' USING r.section, r.tags;
      accepted := true;
    EXCEPTION WHEN check_violation THEN accepted := false;
    END;
    IF accepted IS DISTINCT FROM r.expect_accept THEN
      fails_naive := fails_naive + 1;
      RAISE NOTICE 'naive    -> FAIL | got %, expected % | %',
        CASE WHEN accepted THEN 'accepted' ELSE 'rejected' END,
        CASE WHEN r.expect_accept THEN 'accept' ELSE 'reject' END, r.label;
    END IF;

    -- Block B: hardened
    BEGIN
      EXECUTE 'INSERT INTO _probe_hardened (section, tags) VALUES ($1, $2)' USING r.section, r.tags;
      accepted := true;
    EXCEPTION WHEN check_violation THEN accepted := false;
    END;
    IF accepted IS DISTINCT FROM r.expect_accept THEN
      fails_hardened := fails_hardened + 1;
      RAISE NOTICE 'hardened -> FAIL | got %, expected % | %',
        CASE WHEN accepted THEN 'accepted' ELSE 'rejected' END,
        CASE WHEN r.expect_accept THEN 'accept' ELSE 'reject' END, r.label;
    END IF;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Block A (naive)    failures: %  (EXPECT exactly 1 — THE HOLE)', fails_naive;
  RAISE NOTICE 'Block B (hardened) failures: %  (EXPECT 0)', fails_hardened;

  -- The Supabase SQL editor does NOT surface RAISE NOTICE in the results pane,
  -- so make the editor's own Success/Error signal carry the verdict: RAISE on
  -- any deviation. After this, "Success. No rows returned" == gate closed, and
  -- any failure shows as a red ERROR with the reason.
  IF fails_naive <> 1 THEN
    RAISE EXCEPTION 'GATE FAIL: naive block had % failure(s), expected exactly 1 (THE HOLE). The harness is not discriminating — do not trust a pass.', fails_naive;
  END IF;
  IF fails_hardened <> 0 THEN
    RAISE EXCEPTION 'GATE FAIL: hardened constraint had % failure(s), expected 0 — the COALESCE constraint is wrong. DO NOT ship Step 1.', fails_hardened;
  END IF;

  DROP TABLE IF EXISTS _probe_naive;
  DROP TABLE IF EXISTS _probe_hardened;
  RAISE NOTICE 'OVERALL: PASS — gate closed. Ship Step 1 with the COALESCE constraint.';
END $$;
