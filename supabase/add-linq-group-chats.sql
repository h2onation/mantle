-- Migration: Add linq_group_chats table for group chat state tracking.
--
-- STORAGE DECISION: Separate table (Option B) chosen over extending conversations.
-- The conversations table is tightly coupled to 1:1 Sage sessions — it carries
-- extraction_state, summary, and status fields that assume a single user. Adding
-- group state there would require filtering every existing query by type and risk
-- leaking group context into 1:1 sessions. A separate table keeps group state
-- isolated and queryable by linq_chat_id without touching the 1:1 pipeline.

CREATE TABLE IF NOT EXISTS linq_group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linq_chat_id text NOT NULL,
  owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  intro_sent boolean NOT NULL DEFAULT false,
  non_sage_participant_count integer NOT NULL DEFAULT 0,
  messages_since_sage_spoke integer NOT NULL DEFAULT 0,
  last_inactive_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint prevents duplicate records from race conditions
-- (multiple webhooks arriving simultaneously when a group forms).
CREATE UNIQUE INDEX IF NOT EXISTS idx_linq_group_chats_chat_id
  ON linq_group_chats (linq_chat_id);

-- Fast lookup by owner user for admin/debugging.
CREATE INDEX IF NOT EXISTS idx_linq_group_chats_owner
  ON linq_group_chats (owner_user_id);

-- RLS: admin-only for now. No user-facing queries on this table.
ALTER TABLE linq_group_chats ENABLE ROW LEVEL SECURITY;
