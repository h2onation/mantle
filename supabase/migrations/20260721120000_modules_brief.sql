-- Module brief replaces the per-module full-prompt fork (ADR-054, 2026-07-21).
--
-- ONE voice for every module: the shared conductor (admin Tuning override →
-- code constant). A module now carries a BRIEF — a few founder-written
-- sentences of steering appended to the system prompt as a labeled section
-- that COMPOSES with the voice instead of replacing it. Tuning edits reach
-- every module; the crisis/marker machinery always arrives with the voice and
-- cannot be edited away per module.
--
-- custom_prompt shipped 2026-07-15 (ADR-053), was never referenced by a prod
-- row (the module set is still empty), and was only half-wired: the chat path
-- read it but the entry-compose path never did, so a forked module would talk
-- in one voice and write its entries in another. Dropping unconsumed schema
-- per the removal-first rule; `if exists` guards make this safe to re-run.

alter table public.modules drop column if exists custom_prompt;

alter table public.modules add column if not exists brief text;

comment on column public.modules.brief is
  'Founder-authored steering that composes with the shared conductor voice (appended as a labeled system-prompt section, chat path only). Never a replacement prompt — ADR-054.';
