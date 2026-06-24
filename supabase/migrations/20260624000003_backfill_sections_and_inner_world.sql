-- Structure migration — STEP 2 (reviewed data backfill + reopen sixth section).
--
-- Homes all 21 existing manual_entries to the new life-area sections, after a
-- propose → human-review → apply pass (every row reviewed; mapping in
-- docs/reference/structure-migration-plan.md). Two structural notes:
--
-- 1. SIXTH SECTION — 'inner-world'. The backfill surfaced a recurring, durable
--    self-to-self territory (self-judgment / self-governance / self-perception)
--    with a drawable boundary: the SURVIVES-SOLITUDE test. A pattern homes to
--    Inner world when it runs with nobody else in the room; if removing every
--    other person dissolves it, it is Relationships (self-to-others) instead.
--    Four entries cleared that test (the inner critic, the exposure-freeze
--    self-verdict, and two self-permission patterns). This widens the section
--    CHECK from five slugs to six. This is the LAST structural change before
--    beta — the structure now holds; single future anomalies do not add a
--    seventh section (see plan §2 Rule C + the lock-six note).
--
-- 2. `layer` stays frozen (untouched). `section`/`tags` are still read by no
--    code yet (that is Step 3), so this changes zero behaviour. Reversible
--    (rollback block below); `layer` is the audit oracle for every row.
--
-- Idempotent: the CHECK amendment drops-then-adds; the UPDATEs are scoped to
-- explicit ids (no-ops on a fresh/CI DB where those rows do not exist).

-- ── 1. Widen the section closed-set to include 'inner-world' ─────────────────
ALTER TABLE public.manual_entries DROP CONSTRAINT IF EXISTS manual_entries_section_closed;
ALTER TABLE public.manual_entries
  ADD CONSTRAINT manual_entries_section_closed
  CHECK (section IS NULL OR section IN
    ('relationships','work-money','routines-structure','sensory-burnout','interests-flow','inner-world'));

-- ── 2. Backfill — one statement per (section, tags) group ───────────────────
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

-- Inner world · self-to-self (survives solitude)
UPDATE public.manual_entries SET section = 'inner-world', tags = '{}'::text[]
WHERE id IN (
  '64be5d81-8c22-483c-affa-c8506f81382e',  -- The Room Inside You (inner critic)
  'c9905ab3-5740-4a39-a65e-485d829b51aa',  -- Exposure Freeze with a Running Verdict (self-verdict)
  'aa2c9438-a1e7-4eac-8d2d-b8e57028c156',  -- the caregiver trap (self-betrayal)
  '11cfe411-26a0-4fa2-9606-e8e30e3ab479'   -- the permission loop (self-governance)
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

-- ── Rollback (run by hand to revert Step 2) ─────────────────────────────────
-- Order matters: clear the data FIRST (so no 'inner-world' values remain),
-- THEN narrow the CHECK back to five slugs, else the re-add fails validation.
-- UPDATE public.manual_entries SET section = NULL, tags = '{}'::text[]
--   WHERE id IN ( <the 21 ids above> );
-- ALTER TABLE public.manual_entries DROP CONSTRAINT IF EXISTS manual_entries_section_closed;
-- ALTER TABLE public.manual_entries ADD CONSTRAINT manual_entries_section_closed
--   CHECK (section IS NULL OR section IN
--     ('relationships','work-money','routines-structure','sensory-burnout','interests-flow'));
