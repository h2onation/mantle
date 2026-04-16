-- Migration: Create safety_events table.
--
-- The table was defined in the baseline schema (20260407_baseline_schema.sql)
-- but was never applied to the production database — discovered when the
-- crisis-detection write path in src/lib/persona/persona-pipeline.ts silently
-- failed against a non-existent table.
--
-- This creates it with the already-renamed column name (persona_included_988)
-- so no further rename is needed after 20260414_rename_sage_to_persona.sql.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  crisis_detected boolean NOT NULL DEFAULT true,
  persona_included_988 boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Writes go through the service role. No user-facing reads. Enabling RLS
-- without a policy locks the table to anon/authenticated clients by default.
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_safety_events_user_id
  ON public.safety_events (user_id);

CREATE INDEX IF NOT EXISTS idx_safety_events_created_at
  ON public.safety_events (created_at DESC);
