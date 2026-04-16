-- messaging_events: audit trail of every outbound send and inbound webhook.
--
-- Purpose:
--   - Debugging send/receive issues across both providers.
--   - Inbound idempotency: the partial unique index on (provider,
--     provider_message_id) catches Sendblue's retry storms (3x, 45s timeout)
--     without requiring an in-memory seenEvents Map.
--   - Cutover monitoring: compare Linq vs Sendblue volumes and failure rates
--     during the transition.
--
-- Follows the existing mywalnut pattern:
--   - FK references public.profiles(id) (not auth.users), matching phone_numbers,
--     conversations, manual_entries, etc.
--   - RLS enabled; no public policies. Service role bypasses RLS — writes go
--     through the admin client. This matches the safety_events pattern.
--   - Idempotent guards (IF NOT EXISTS) so re-running the migration is safe.

create table if not exists public.messaging_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  direction text not null check (direction in ('outbound', 'inbound')),
  provider text not null check (provider in ('linq', 'sendblue')),
  provider_message_id text,
  from_number text,
  to_number text,
  content text,
  status text,
  error_code text,
  error_message text,
  was_downgraded boolean,
  raw_payload jsonb,
  owner_user_id uuid references public.profiles(id) on delete set null
);

-- Inbound idempotency: same provider_message_id cannot be stored twice.
-- Partial so outbound rows (provider_message_id sometimes null on failure)
-- don't trip the constraint.
create unique index if not exists messaging_events_provider_msg_id_idx
  on public.messaging_events (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists messaging_events_created_at_idx
  on public.messaging_events (created_at desc);

create index if not exists messaging_events_owner_idx
  on public.messaging_events (owner_user_id, created_at desc);

alter table public.messaging_events enable row level security;

-- No public policies: service role bypasses RLS, all writes go through the
-- admin client. Matches the existing safety_events pattern.

grant all on table public.messaging_events to service_role;
