-- Waitlist: remove direct anonymous (browser) write access.
--
-- The anon key ships in every browser. The waitlist_anon_insert policy
-- (FOR INSERT TO anon WITH CHECK (true)) lets any visitor insert arbitrary
-- rows straight into public.waitlist — bypassing /api/waitlist's IP rate
-- limit, email validation, and 500-char source cap, and letting the table be
-- used as unbounded free storage.
--
-- Legit signups are unaffected: /api/waitlist writes with the service-role
-- (admin) client, which bypasses RLS entirely. After this migration the
-- waitlist is service-role-write-only.
--
-- See docs/audits/flow-review-2026-05-29.md (worklist #3, "Waitlist DB rule").

-- 1. Remove the permissive anon INSERT policy. This is the actual hole: with
--    RLS enabled and no INSERT policy for anon, anonymous inserts are denied.
DROP POLICY IF EXISTS waitlist_anon_insert ON public.waitlist;

-- 2. Defense in depth: revoke the table-level INSERT grant from anon too, so
--    the privilege is gone even if RLS were ever disabled on this table.
REVOKE INSERT ON TABLE public.waitlist FROM anon;
