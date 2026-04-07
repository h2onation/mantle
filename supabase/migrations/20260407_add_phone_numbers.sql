-- ---------------------------------------------------------------------------
-- phone_numbers table
--
-- This table was originally created manually in the Supabase dashboard for the
-- Linq SMS integration. This migration captures it as code so the schema can
-- be reproduced from a fresh project. It is written defensively (IF NOT EXISTS
-- everywhere, DROP POLICY IF EXISTS before CREATE POLICY) so it can be applied
-- safely against an environment where the table already exists.
--
-- Columns are derived from every reference to `phone_numbers` in src/:
--   - id                  PK, referenced as `phoneRow.id`
--   - user_id             FK → profiles(id), scoped by RLS
--   - phone               normalized E.164 string, used as the lookup key
--   - verified            boolean — STOP keyword sets this to false
--   - linq_chat_id        Linq's chat identifier, captured on first inbound
--   - service_type        'SMS' | 'iMessage' from Linq capability check
--   - linked_at           when the user linked the phone
--   - verification_code   reserved for legacy verification flow
--   - code_expires_at     reserved for legacy verification flow
--   - created_at          standard audit timestamp
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone              text NOT NULL,
  verified           boolean NOT NULL DEFAULT false,
  linq_chat_id       text,
  service_type       text,
  linked_at          timestamptz,
  verification_code  text,
  code_expires_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Phone is the primary lookup key on inbound webhook routing — must be unique
-- so two users cannot link the same number simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_phone_key
  ON public.phone_numbers (phone);

-- user_id is the lookup key for /api/user/phone GET and the settings panel.
CREATE INDEX IF NOT EXISTS phone_numbers_user_id_idx
  ON public.phone_numbers (user_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Users can read their own phone row.
DROP POLICY IF EXISTS "phone_numbers_select_own" ON public.phone_numbers;
CREATE POLICY "phone_numbers_select_own"
  ON public.phone_numbers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own phone row (e.g., re-linking).
DROP POLICY IF EXISTS "phone_numbers_update_own" ON public.phone_numbers;
CREATE POLICY "phone_numbers_update_own"
  ON public.phone_numbers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own phone row.
DROP POLICY IF EXISTS "phone_numbers_delete_own" ON public.phone_numbers;
CREATE POLICY "phone_numbers_delete_own"
  ON public.phone_numbers
  FOR DELETE
  USING (auth.uid() = user_id);

-- NOTE: there is intentionally no INSERT policy. All inserts go through the
-- service-role admin client in /api/user/phone (createAdminClient), which
-- bypasses RLS. End users must not be able to insert rows directly because
-- the verified flag and linq_chat_id are set by server-side flows only.
