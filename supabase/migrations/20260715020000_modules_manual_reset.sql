-- Modules cutover, Manual side (2026-07-15). Founder-approved DESTRUCTIVE
-- reset: the Manual's structure moves from the five fixed life-area sections
-- to the founder-authored modules (an entry's `section` = the module slug of
-- the conversation it came from, code-assigned at compose time).
--
-- 1. DELETE ALL EXISTING MANUAL ENTRIES. Explicit founder call ("delete
--    existing entries", 2026-07-15): everyone — including beta users —
--    starts blank in the module world. Conversation history stays; only the
--    confirmed Manual content resets. There is no refile path by design.
--
-- 2. Drop the fixed-section constraints:
--      manual_entries_section_closed  (section ∈ five slugs) — sections are
--        module slugs now; enforce format, not membership (modules can be
--        created live in admin; a FK would also block module deletion order,
--        and the app validates the module at conversation start).
--      manual_entries_rel_tag_home    (romantic/family/friends only inside
--        relationships) — the sub-tags die with the fixed sections.
--      manual_entries_tags_closed     → recreated as strength-only.
--
-- The frozen legacy `layer` column and its CHECK stay untouched (ADR-050
-- keystone: never dropped, historical provenance only).

delete from public.manual_entries;

alter table public.manual_entries
  drop constraint if exists manual_entries_section_closed;

alter table public.manual_entries
  drop constraint if exists manual_entries_rel_tag_home;

alter table public.manual_entries
  drop constraint if exists manual_entries_tags_closed;

-- Section: module-slug format (matches modules_slug_format). Nullable stays
-- (legacy provenance semantics unchanged); new rows always carry a slug.
alter table public.manual_entries
  add constraint manual_entries_section_format
  check (section is null or section ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

-- Tags: the closed set is now {strength} only.
alter table public.manual_entries
  add constraint manual_entries_tags_closed
  check (tags <@ array['strength']::text[]);
