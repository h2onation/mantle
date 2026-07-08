-- Conversation scores: admin-run quality evaluations of 1:1 Jove sessions
-- against the conductor scoring rubric (docs/reference/conductor-scoring.md).
--
-- Purpose: the rubric was only applied by hand (the /evaluate skill, run from
-- a terminal). This table stores in-app scoring runs so the Tuning page can
-- chart dimension scores over time against conductor-prompt edits. Rows are
-- written only by /api/admin/score-conversation (admin-triggered, one Opus
-- call per run); nothing in the product reads them — scoring is observational
-- and must never feed back into Jove's behavior.
--
-- `result` holds the full scorer output (six dimension scores with turn
-- citations, mechanical signals, ruptures, verdict). Citations quote user
-- phrasing, so this table is user data: RLS enabled with no policies
-- (deny-all to anon/auth clients; service-role access only), same convention
-- as persona_voice_overrides. `rubric_sha` fingerprints the exact rubric text
-- the run used — scores are only comparable within one rubric version.
--
-- Deletion condition: if conductor tuning closes and scores stop being
-- consulted, drop this table and the scoring route together.

create table if not exists public.conversation_scores (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  rubric_sha text not null,
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_scores_conv_idx
  on public.conversation_scores (conversation_id, created_at desc);
create index if not exists conversation_scores_created_idx
  on public.conversation_scores (created_at desc);

alter table public.conversation_scores enable row level security;
-- No policies: deny-all to anon/auth clients. Server access is service-role
-- only (bypasses RLS) via the admin scoring route.
