-- Add 'upload' to the conversations.mode CHECK constraint.
-- The upload entry point lets users paste text (chat logs, emails,
-- journal entries) for Jove to analyze against their Manual.

ALTER TABLE public.conversations
  DROP CONSTRAINT conversations_mode_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_mode_check
  CHECK (mode = ANY (ARRAY['situation'::text, 'guided-intake'::text, 'upload'::text]));
