-- Checkpoint tuning: admin-editable thresholds that decide WHEN a checkpoint
-- fires, so the founder can dial Jove's eagerness live without a code deploy.
--
-- Four dials, all currently inline literals in persona-pipeline.ts
-- (validateMaterialQuality + applyCheckpointGates):
--   min_scenes      how many concrete narrated scenes before a proposal (code 2)
--   cooldown_turns  minimum user turns between checkpoints              (code 5)
--   failsafe_turn   fire even if the engagement signal never trips, past
--                   this turn                                          (code 12)
--   depth_floor     how deep the conversation must go: one of
--                   surface|behavior|feeling|mechanism|origin     (code mechanism)
--
-- These move EAGERNESS only. The quality gates (has_mechanism, charged
-- language, pattern_engaged, crisis) stay locked in code — no admin value can
-- lower the quality floor or open the door to junk entries.
--
-- The code constants (CHECKPOINT_TUNING_DEFAULTS in checkpoint-tuning.ts) are
-- the permanent floor. A column is honored ONLY when it holds a non-null,
-- in-range value; any null / out-of-range / unreachable-table case resolves to
-- the code default, so an empty or missing row = today's behavior exactly.
--
-- Single typed row (typed columns beat stringifying numbers into a key/value
-- text store). The id boolean singleton guarantees at most one row. Read once
-- per turn inside loadConversationContext (folded into its existing parallel DB
-- batch — no extra round-trip), written only via /api/admin/checkpoint-tuning.
--
-- This table holds NO user data — it is global app config, exactly one row.
-- RLS is enabled with no policies, which denies all client (anon/auth) access
-- by default. The server reads/writes it exclusively through the service-role
-- admin client, which bypasses RLS. Same convention as feature_gates and
-- persona_voice_overrides.
--
-- No row is seeded: absence of the row (or a null column) means "use the code
-- default." The row is created the first time an admin saves a dial. "Reset to
-- default" sets that column back to null (non-destructive — the history table
-- keeps the prior value, and the code constant resolves again next turn).

create table if not exists public.checkpoint_tuning (
  id boolean primary key default true,
  min_scenes integer,
  cooldown_turns integer,
  failsafe_turn integer,
  depth_floor text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint checkpoint_tuning_singleton check (id = true)
);

-- Append-only audit of edits, for "who changed what when" and rollback by eye.
-- old_value is null on the first edit of a field. Values are stored as text so
-- one history shape covers both the numeric dials and the depth_floor enum. No
-- FK on updated_by (we store the admin user id only).
create table if not exists public.checkpoint_tuning_history (
  id uuid primary key default gen_random_uuid(),
  field text not null,
  old_value text,
  new_value text not null,
  updated_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists checkpoint_tuning_history_field_idx
  on public.checkpoint_tuning_history (field, created_at desc);

alter table public.checkpoint_tuning enable row level security;
alter table public.checkpoint_tuning_history enable row level security;
-- No policies on either table: deny-all to anon/auth clients. Server access is
-- service-role only (bypasses RLS).
