-- Migration: Add summary and key_words to manual_entries so older entries can
-- be compressed in the Jove system prompt without an LLM call at prompt-build
-- time.
--
-- Why: Returning users accumulate entries across many sessions. Shipping the
-- full content of every entry in every turn's system prompt burns context and
-- degrades the model's attention on the current conversation. The compression
-- scheme is:
--
--   Recent (this session's entries) → full content.
--   Older (everything else)         → "[Layer N] \"Name\" — Summary. Key words: w1, w2, w3."
--
-- The summary and key_words are produced at checkpoint-confirm time (in
-- src/lib/persona/confirm-checkpoint.ts) by the same Sonnet call that composes
-- the entry, and stored here so the prompt builder can read them cheaply.
-- Nullable columns: pre-existing rows and any fallback path fall back to
-- deriving a summary from the first sentence of content.

ALTER TABLE public.manual_entries
  ADD COLUMN IF NOT EXISTS summary text;

ALTER TABLE public.manual_entries
  ADD COLUMN IF NOT EXISTS key_words text[];
