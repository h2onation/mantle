-- Baseline schema migration
--
-- This is a DOCUMENTATION migration. Every table here already exists
-- in production (created historically via the Supabase dashboard or
-- one-off .sql files outside the migrations directory). The purpose
-- of this file is to give the repo a single committed source of truth
-- for the existing schema so future migrations have something to
-- build on.
--
-- Every statement uses IF NOT EXISTS / IF EXISTS so this file is
-- safe to run against the existing production database without
-- changing anything.
--
-- If a column or constraint here disagrees with production, treat
-- production as authoritative and fix this file.
--
-- Tables included:
--   conversations, messages, profiles, manual_components,
--   manual_changelog, safety_events, linq_group_chats, feedback,
--   admin_access_logs
--
-- NOT included (already have committed migrations):
--   phone_numbers (20260407_add_phone_numbers.sql)
--   phone_numbers OTP columns (20260407_add_phone_otp.sql)
--
-- ⚠️  admin_access_logs does NOT exist in production. See its
-- section below — that block must be run manually in the Supabase
-- SQL editor to create the table.

-- ── profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  sage_mode text CHECK (sage_mode IN ('autistic')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── conversations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  summary text,
  calibration_ratings text, -- dead column, see system.md
  extraction_state jsonb,
  -- linq_group_chat_id added later (see add-group-conversation-link.sql);
  -- FK declared after linq_group_chats below.
  linq_group_chat_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ── messages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  is_checkpoint boolean NOT NULL DEFAULT false,
  checkpoint_meta jsonb,
  processing_text text,
  extraction_snapshot jsonb,
  -- channel added later; distinguishes web vs SMS messages.
  channel text NULL DEFAULT 'web'::text CHECK (channel IN ('text', 'web')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ── manual_components ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  layer integer NOT NULL CHECK (layer BETWEEN 1 AND 5),
  type text NOT NULL CHECK (type IN ('component', 'pattern')),
  name text,
  content text NOT NULL,
  source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes (one component per layer per user, named patterns
-- unique per layer per user). VERIFY index names match production.
CREATE UNIQUE INDEX IF NOT EXISTS unique_component_per_layer
  ON public.manual_components (user_id, layer)
  WHERE type = 'component';

CREATE UNIQUE INDEX IF NOT EXISTS unique_pattern_name_per_layer
  ON public.manual_components (user_id, layer, name)
  WHERE type = 'pattern';

ALTER TABLE public.manual_components ENABLE ROW LEVEL SECURITY;

-- ── manual_changelog ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- component_id has no FK to manual_components in production.
  -- Indexed on (component_id, created_at desc).
  component_id uuid NOT NULL,
  layer integer NOT NULL CHECK (layer BETWEEN 1 AND 5),
  type text NOT NULL CHECK (type IN ('component', 'pattern')),
  name text,
  previous_content text NOT NULL,
  new_content text NOT NULL,
  change_description text NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_changelog ENABLE ROW LEVEL SECURITY;

-- ── safety_events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  crisis_detected boolean NOT NULL DEFAULT true,
  sage_included_988 boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

-- ── linq_group_chats ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.linq_group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linq_chat_id text NOT NULL UNIQUE,
  mantle_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  intro_sent boolean NOT NULL DEFAULT false,
  intro_sent_at timestamptz,
  non_sage_participant_count integer NOT NULL DEFAULT 0,
  messages_since_sage_spoke integer NOT NULL DEFAULT 0,
  last_sage_spoke_at timestamptz,
  last_inactive_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linq_group_chats_chat_id
  ON public.linq_group_chats (linq_chat_id);

ALTER TABLE public.linq_group_chats ENABLE ROW LEVEL SECURITY;

-- Now that linq_group_chats exists, add the FK on conversations.linq_group_chat_id
-- if it isn't already present. Safe-guarded so re-runs don't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_linq_group_chat_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_linq_group_chat_id_fkey
      FOREIGN KEY (linq_group_chat_id)
      REFERENCES public.linq_group_chats(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ── feedback ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Note: feedback references auth.users directly, not profiles.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  -- session_id has no FK target — it's a contextual reference only.
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ── admin_access_logs ────────────────────────────────────────────
--
-- ⚠️  ACTION REQUIRED: This table does NOT exist in production.
-- The codebase has been inserting to it (see
-- src/app/api/admin/{conversations,manual,messages}/route.ts) but the
-- table was never created in the dashboard, so those inserts have
-- been silently failing. Run the CREATE TABLE block below in the
-- Supabase SQL editor to create it. The migration file is idempotent
-- and safe to re-run.
--
-- No foreign keys: production has been running without them and the
-- existing audit pattern doesn't depend on cascade behavior.
--
-- Columns are derived from the actual insert sites:
--   admin_id, target_user_id, conversation_id (optional),
--   action ∈ {'view_conversation', 'view_manual', 'list_conversations'}
CREATE TABLE IF NOT EXISTS public.admin_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  conversation_id uuid,
  action text NOT NULL DEFAULT 'view_conversation',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_target
  ON public.admin_access_logs (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_admin
  ON public.admin_access_logs (admin_id);

ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only select policy. Relies on the public.is_admin() helper
-- (defined in supabase/admin-migration.sql) which checks the JWT
-- app_metadata.role claim. If is_admin() does not exist in your
-- environment, run admin-migration.sql first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_access_logs'
      AND policyname = 'admin_read_logs'
  ) THEN
    CREATE POLICY "admin_read_logs" ON public.admin_access_logs
      FOR SELECT USING (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_access_logs'
      AND policyname = 'admin_insert_log'
  ) THEN
    CREATE POLICY "admin_insert_log" ON public.admin_access_logs
      FOR INSERT WITH CHECK (public.is_admin() AND admin_id = auth.uid());
  END IF;
END $$;

-- ── Notes on RLS policies ────────────────────────────────────────
--
-- This file enables RLS on every table but does NOT define policies.
-- Production policies were created through the dashboard and are
-- enforced there. The app's API routes use the service-role admin
-- client, which bypasses RLS, so these policies primarily exist to
-- protect the public anon-key paths and direct dashboard queries.
--
-- VERIFY against the dashboard before relying on this file as the
-- source of truth for policies. A future migration should capture
-- the policies explicitly.
