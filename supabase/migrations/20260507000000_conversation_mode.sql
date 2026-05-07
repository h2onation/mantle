-- Add conversation mode: controls which Tier 3 prompt block renders.
-- 'situation' is the default open-ended exploration; 'guided-intake'
-- runs a more directed path toward the first checkpoint.
--
-- Instant on Postgres 11+: DEFAULT is stored in catalog, not written
-- to each existing row. No table lock beyond a brief AccessExclusive
-- for the ALTER.

ALTER TABLE public.conversations
  ADD COLUMN mode text NOT NULL DEFAULT 'situation';

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_mode_check
  CHECK (mode = ANY (ARRAY['situation'::text, 'guided-intake'::text]));
