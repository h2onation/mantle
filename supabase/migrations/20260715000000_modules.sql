-- Modules — the unified door + Manual-section abstraction (2026-07-15).
--
-- A module is simultaneously (1) an entry door on the Home screen and (2) a
-- section of the Manual: conversations start inside a module, and confirmed
-- entries file under it. This table replaces BOTH hardcoded registries the
-- app carried — the door arrays (WaysToBegin / door-intros DOORS) and the
-- five fixed life-area sections (src/lib/manual/layers.ts) — so the founder
-- can create, rename, disable, and reorder modules live in admin.
--
-- Consumers (wired across the cutover phases on this branch):
--   * Home screen — renders enabled modules as the single "ways to begin"
--     + Manual-index list (replaces the door trio + five-section index).
--   * /api/chat — validates the requested module slug at conversation
--     creation; conversations.mode stores the slug.
--   * System prompt — custom_prompt (when set) replaces the conductor for
--     this module's conversations; empty = the live shared conductor
--     (override ?? code). Saves are guarded by the same required-fragment
--     validator as the conductor (crisis lines + reflection markers).
--   * Save path — confirmed entries write manual_entries.section = slug.
--   * Admin "Modules" page — CRUD; replaces the Intake Doors panel and the
--     door section of App Copy.
--
-- Cost label: one small service-role read on Home bootstrap and conversation
-- create (replacing the feature-gate + door-copy reads it retires); no new
-- model calls. Deletion condition: if module experimentation closes and the
-- set stabilizes, fold the surviving rows back into code constants and drop
-- the table.
--
-- Not user data — this is founder-authored product config, identical across
-- users — so it follows the feature_gates / persona_voice_overrides
-- convention: RLS on, no policies (deny-all to anon/auth clients,
-- service-role access only). All user-facing reads go through server routes.

create table if not exists public.modules (
  -- Slug doubles as conversations.mode and manual_entries.section for
  -- conversations/entries born in this module. Locked format so it is safe
  -- in analytics labels, override keys, and URLs.
  slug          text primary key
                constraint modules_slug_format
                check (slug ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),

  -- Home card + Manual section header.
  name          text not null,
  description   text not null default '',
  cue           text not null default 'Begin',   -- card button label
  icon          text not null default 'chat',    -- key into the small code-side icon set

  -- One-time "before you begin" modal. Null = skip the modal for this module.
  intro_title   text,
  intro_body    text,

  -- Fixed first message, server-emitted with no model call (the
  -- situation/upload-opener pattern). Null = Jove opens from the prompt.
  opener_text   text,

  -- Full replacement Jove prompt for this module's conversations. Null = the
  -- module runs the live shared conductor (admin override ?? code default).
  -- Admin saves are validated against CONDUCTOR_REQUIRED_FRAGMENTS — the
  -- crisis lines and reflection markers can never be edited away.
  custom_prompt text,

  -- Disabled modules disappear as doors but their Manual section + entries
  -- stay visible. Modules are disabled, never deleted, once conversations or
  -- entries reference them.
  enabled       boolean not null default true,
  sort_order    integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

alter table public.modules enable row level security;
