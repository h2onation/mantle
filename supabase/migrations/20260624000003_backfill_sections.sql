-- Structure migration — STEP 2 (reviewed data backfill into the FIVE sections).
--
-- Homes 17 of the 21 existing manual_entries into the five life-area sections
-- shipped in Step 1, after a propose -> human-review-every-row -> apply pass
-- (mapping: docs/reference/structure-migration-plan.md). Notes:
--
-- 1. FIVE sections — NO schema change here. The section CHECK stays at the five
--    slugs from Step 1 (20260624000002). There is NO 'inner-world' slug. A sixth
--    section is DEFERRED pending beta evidence (see the parked block below and
--    plan §2 Rule C).
--
-- 2. `layer` stays frozen (untouched) — the audit oracle for verifying the
--    backfill. `section`/`tags` are still read by no code (that is Step 3), so
--    this changes zero behaviour. Reversible (rollback block below).
--
-- Idempotent: UPDATEs are scoped to explicit ids (no-ops on a fresh/CI DB where
-- those rows do not exist; the real backfill only happens on prod).

-- ── Backfill — one statement per (section, tags) group ──────────────────────
-- Relationships · family
UPDATE public.manual_entries SET section = 'relationships', tags = ARRAY['family']::text[]
WHERE id IN (
  '1cc9acc2-1caa-41eb-ab64-3998b43d092c',  -- Identity Role Attacked and Family Choosing Peace
  '04beaf61-43da-4daf-97d0-8e5a7071d87a',  -- I Swallow It When Mom Pivots Away
  '68b05f30-aaa7-4120-95da-c99d9933a639'   -- Specific Hunger for Total Dependency (child-hunger)
);

-- Relationships · romantic
UPDATE public.manual_entries SET section = 'relationships', tags = ARRAY['romantic']::text[]
WHERE id IN (
  'd34d7385-0516-469d-9362-3a07b6bb3355',  -- Validation Gap (boyfriend)
  '760d9084-c7a7-4a66-b99a-214caddc609c',  -- the wanting you can't say out loud
  '23db08df-bb4a-45f1-87a9-6d946701c1d4',  -- Choice Made Real
  '219e0b7b-9a01-48f7-8c02-9dd3e3434ea5',  -- I Scan Him When I Can't Feel Him Leaning
  '0a1d913a-d095-44a2-811b-9ef5c4869522'   -- Needing People More (strength dropped per C3 override)
);

-- Relationships · no sub-tag (sphere not named, or masking cluster)
UPDATE public.manual_entries SET section = 'relationships', tags = '{}'::text[]
WHERE id IN (
  '1aadc1ab-9564-4f9d-b64a-997b301990e7',  -- Silence That Protects (sphere unnamed)
  '8da782dc-8261-489d-ad83-0cf8819916e6',  -- masking / closeness-as-compliance
  'de7b8559-0e4e-4ddc-9c29-8f8bc13585ff',  -- the hidden cost of being easy
  '43f5f531-aae9-4e9f-8ab7-56155ad2a46c',  -- freeze / retreat / underground
  'd1b7b25f-c9a9-4535-9468-63cfc1c75536'   -- processing-lag-under-pressure (subject = withdrawal's relational cost)
);

-- Work & money
UPDATE public.manual_entries SET section = 'work-money', tags = '{}'::text[]
WHERE id = '1e60f5d7-68cd-43fc-8bf1-b92794ffdb30';  -- Narrative Protection / Integrity Line

-- Sensory & burnout
UPDATE public.manual_entries SET section = 'sensory-burnout', tags = '{}'::text[]
WHERE id = 'ea96c955-06ad-4833-926e-c133cf6ef848';  -- Already Full Before the Last Thing Lands

-- Routines & structure
UPDATE public.manual_entries SET section = 'routines-structure', tags = '{}'::text[]
WHERE id = 'f094cf9b-e3ac-40a7-b925-538607c30d0f';  -- When Plans Change I Go Still

-- Interests & flow · strength (the one un-forced strength in the corpus)
UPDATE public.manual_entries SET section = 'interests-flow', tags = ARRAY['strength']::text[]
WHERE id = 'dcc59e65-5dbc-4397-8152-49a6b2ac0a7d';  -- systems-thinking / scenario-builder

-- ── DELIBERATELY PARKED — DO NOT BACKFILL (load-bearing; null ≠ missed) ──────
-- The four entries below are INTENTIONALLY left with section = NULL. They are
-- self-to-self patterns that passed the survives-solitude test (they run with
-- nobody in the room): inner critic, self-verdict, two self-permission patterns.
-- They are HELD pending beta evidence on whether a sixth 'inner-world' section
-- recurs across real users. A NULL section on these rows is intentional, not a
-- backfill miss. Do not assign them a section without the deferred-section
-- decision (plan §2 Rule C). Their frozen `layer` is preserved.
--   64be5d81-8c22-483c-affa-c8506f81382e  -- The Room Inside You (inner critic)
--   c9905ab3-5740-4a39-a65e-485d829b51aa  -- Exposure Freeze with a Running Verdict (self-verdict)
--   aa2c9438-a1e7-4eac-8d2d-b8e57028c156  -- the caregiver trap (self-betrayal)
--   11cfe411-26a0-4fa2-9606-e8e30e3ab479  -- the permission loop (self-governance)

-- ── Rollback (run by hand to revert Step 2) ─────────────────────────────────
-- Clears only the 17 backfilled rows; the 4 parked were never touched, and
-- `layer` is frozen throughout, so this fully restores the pre-Step-2 state.
-- UPDATE public.manual_entries SET section = NULL, tags = '{}'::text[]
--   WHERE id IN (
--     '1cc9acc2-1caa-41eb-ab64-3998b43d092c','04beaf61-43da-4daf-97d0-8e5a7071d87a',
--     '68b05f30-aaa7-4120-95da-c99d9933a639','d34d7385-0516-469d-9362-3a07b6bb3355',
--     '760d9084-c7a7-4a66-b99a-214caddc609c','23db08df-bb4a-45f1-87a9-6d946701c1d4',
--     '219e0b7b-9a01-48f7-8c02-9dd3e3434ea5','0a1d913a-d095-44a2-811b-9ef5c4869522',
--     '1aadc1ab-9564-4f9d-b64a-997b301990e7','8da782dc-8261-489d-ad83-0cf8819916e6',
--     'de7b8559-0e4e-4ddc-9c29-8f8bc13585ff','43f5f531-aae9-4e9f-8ab7-56155ad2a46c',
--     'd1b7b25f-c9a9-4535-9468-63cfc1c75536','1e60f5d7-68cd-43fc-8bf1-b92794ffdb30',
--     'ea96c955-06ad-4833-926e-c133cf6ef848','f094cf9b-e3ac-40a7-b925-538607c30d0f',
--     'dcc59e65-5dbc-4397-8152-49a6b2ac0a7d'
--   );
