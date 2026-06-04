-- Feature gates: global on/off switches for ancillary Jove subsystems.
--
-- Purpose: let an admin disable persona-delta routing, conversation-mode
-- branching, and the checkpoint pipeline at runtime so the core voice +
-- extraction loop can be tested in isolation. Read once per turn inside
-- loadConversationContext (folded into its existing parallel DB batch, so
-- no extra round-trip), and written only via /api/admin/feature-gates.
--
-- This table holds NO user data — it is global app config, three rows.
-- RLS is enabled with no policies, which denies all client (anon/auth)
-- access by default. The server reads and writes it exclusively through
-- the service-role admin client, which bypasses RLS.
--
-- Default for every gate is ON (enabled = true). With all three rows true,
-- the system behaves exactly as it does today — these are debug scaffolding,
-- not a permanent fork. Deletion condition: once the core loop is validated
-- in isolation, drop this table and the three read sites.

create table if not exists public.feature_gates (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed the three known gates ON. on conflict do nothing keeps re-runs idempotent
-- and never clobbers an admin's chosen state.
insert into public.feature_gates (key, enabled) values
  ('persona_deltas', true),
  ('conversation_modes', true),
  ('checkpoints', true)
on conflict (key) do nothing;

alter table public.feature_gates enable row level security;
-- No policies: deny-all to anon/auth clients. Server access is service-role only.
