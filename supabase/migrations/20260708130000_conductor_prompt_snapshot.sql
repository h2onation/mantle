-- Conductor-prompt fingerprint per conversation, + the prompt text store.
--
-- Purpose: conversation_scores (20260708120000) charts session quality over
-- time, but a score knew its *rubric* version (rubric_sha) and not the *prompt*
-- version that drove the session. The Tuning trend only marked prompt changes
-- by timestamp — approximate, and blind to code-deploy prompt changes. This
-- records the exact conductor prompt each conversation ran on, so scores can be
-- banded by prompt version and any past prompt can be recovered for revert.
--
-- What we fingerprint: the CONDUCTOR PROMPT only (buildSystemPromptBlocks' tier1
-- = override ?? CONDUCTOR_PROMPT), NOT the full assembled system prompt. The
-- Manual/session-context blocks are per-user and per-turn (and are user data);
-- the conductor prompt is the thing we tune and it is identical across users
-- until edited, so it dedups to a few hundred rows lifetime, not one per row.
--
-- Where it's written: call-persona stamps the sha on the conversation on the
-- first Jove turn (self-heals on later turns if the first write is cut off).
-- prompt_snapshots is upserted at the same moment, on-conflict-do-nothing.
--
-- Deletion condition: same as conversation_scores — if conductor tuning closes
-- and scores stop being consulted, drop this column and table with it.

-- 1. Fingerprint of the conductor prompt that drove this conversation.
--    Null for pre-migration rows and until the first Jove turn stamps it.
alter table public.conversations
  add column if not exists conductor_prompt_sha text;

-- 2. The prompt text itself, one row per unique version, for revert/inspection.
--    Not user data — this is the system prompt, identical across users — so it
--    follows the persona_voice_overrides convention: RLS on, no policies
--    (deny-all to anon/auth clients, service-role access only).
create table if not exists public.prompt_snapshots (
  sha           text primary key,
  text          text not null,
  first_seen_at timestamptz not null default now()
);

alter table public.prompt_snapshots enable row level security;
