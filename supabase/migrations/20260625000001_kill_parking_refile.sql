-- Structure migration — KILL PARKING (refile the four parked self-patterns).
--
-- Decision (2026-06-25, Jeff): the deferred 'inner-world' sixth section is
-- abandoned. Every Manual entry now homes on one of the five life-area
-- sections — there is no "held/parked" group anymore. The composition prompt
-- (src/lib/persona/confirm-checkpoint.ts) no longer parks; the held-group UI
-- (Home index, "of 5" counter, Manual tile, PDF export) is removed. This
-- migration is the DATA half: it homes the four rows the Step-2 backfill
-- deliberately left at section = NULL so they don't orphan when the held UI
-- goes away.
--
-- Destinations (read from the entries' content, confirmed by Jeff):
--   relationships · romantic — two rows that are entirely about a partner
--     (the "another person is required" test → relationships, not self-to-self).
--   work-money — an inner critic about capability and self-trust at work.
--   sensory-burnout — a body freeze/shutdown when attention lands ("the body
--     wins" spine rule).
--
-- `layer` stays frozen (untouched) — provenance / audit oracle. Idempotent:
-- UPDATEs are scoped to explicit ids (no-ops on a fresh/CI DB where those rows
-- do not exist; the real refile only happens on prod). Reversible (rollback
-- block below restores section = NULL on exactly these four rows).

-- Relationships · romantic — partner-dynamic patterns (mis-parked: another
-- person is load-bearing for the pattern to exist).
UPDATE public.manual_entries SET section = 'relationships', tags = ARRAY['romantic']::text[]
WHERE section IS NULL AND id IN (
  'aa2c9438-a1e7-4eac-8d2d-b8e57028c156',  -- the caregiver trap (suppressing own needs with partner)
  '11cfe411-26a0-4fa2-9606-e8e30e3ab479'   -- the permission loop (revoking own permission around loved ones)
);

-- Work and career — inner critic about capability / self-trust at work.
UPDATE public.manual_entries SET section = 'work-money', tags = '{}'::text[]
WHERE section IS NULL AND id = '64be5d81-8c22-483c-affa-c8506f81382e';  -- The Room Inside You

-- Sensory and burnout — body freeze/shutdown when attention lands (body wins).
UPDATE public.manual_entries SET section = 'sensory-burnout', tags = '{}'::text[]
WHERE section IS NULL AND id = 'c9905ab3-5740-4a39-a65e-485d829b51aa';  -- Exposure Freeze with a Running Verdict

-- ── Rollback (run by hand to restore the parked state) ──────────────────────
-- Re-nulls only these four rows; `layer` was frozen throughout.
-- UPDATE public.manual_entries SET section = NULL, tags = '{}'::text[]
--   WHERE id IN (
--     'aa2c9438-a1e7-4eac-8d2d-b8e57028c156','11cfe411-26a0-4fa2-9606-e8e30e3ab479',
--     '64be5d81-8c22-483c-affa-c8506f81382e','c9905ab3-5740-4a39-a65e-485d829b51aa'
--   );
