-- Modules cutover, server side (2026-07-15). Two changes:
--
-- 1. conversations.mode becomes an open module slug. The three-value CHECK
--    constraint and the 'situation' default are dropped: a NEW conversation
--    must name an enabled module (validated app-side in /api/chat — there is
--    no default module), and legacy rows keep their retired door values
--    ("situation" / "guided-intake" / "upload") as frozen history. A
--    slug-format CHECK replaces the closed enum so the column can never
--    carry arbitrary junk.
--
-- 2. The three per-mode door gates are deleted from feature_gates. Their
--    only remaining job was hiding home-screen doors; a module's own
--    `enabled` flag (modules table, /admin/modules) is that switch now.
--    `extraction_brief` stays — it gates a subsystem, not a door.

alter table public.conversations
  drop constraint if exists conversations_mode_check;

alter table public.conversations
  alter column mode drop default;

-- Same shape as modules.slug (modules_slug_format), plus the one legacy
-- value that doesn't match it ("guided-intake" is fine; all three legacy
-- values are lowercase/hyphenated and pass).
alter table public.conversations
  add constraint conversations_mode_format
  check (mode ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

delete from public.feature_gates
  where key in ('situation', 'guided_intake', 'upload');
