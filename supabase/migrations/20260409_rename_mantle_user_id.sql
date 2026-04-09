-- Migration: Rename mantle_user_id → owner_user_id on linq_group_chats.
-- Part of the Mantle → mywalnut brand migration.
--
-- This is a column rename only — no data changes, no type changes.
-- The index is dropped and recreated with the new column name.

ALTER TABLE public.linq_group_chats
  RENAME COLUMN mantle_user_id TO owner_user_id;

DROP INDEX IF EXISTS idx_linq_group_chats_user;
CREATE INDEX idx_linq_group_chats_owner
  ON public.linq_group_chats (owner_user_id);
