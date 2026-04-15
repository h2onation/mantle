-- Add extraction_snapshot column to messages table.
-- Stores the extraction state that Jove saw when generating this response
-- (the PREVIOUS turn's extraction, reflecting the 1-turn lag).
-- Nullable — older messages won't have it.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS extraction_snapshot jsonb DEFAULT null;
