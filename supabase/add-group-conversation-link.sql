-- Migration: Add linq_group_chat_id to conversations table
-- Links group conversations to their linq_group_chats record.
-- This column is NULL for 1:1 conversations.
-- Depends on the linq_group_chats table being present (see baseline schema).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS linq_group_chat_id uuid REFERENCES public.linq_group_chats(id) ON DELETE SET NULL;

-- Index for looking up a group's conversation
CREATE INDEX IF NOT EXISTS idx_conversations_linq_group_chat_id
  ON public.conversations (linq_group_chat_id)
  WHERE linq_group_chat_id IS NOT NULL;
