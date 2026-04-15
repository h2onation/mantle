-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  -- AI persona voice mode. Currently only 'autistic'. Null defaults to autistic.
  -- Renamed from sage_mode in
  -- supabase/migrations/20260414_rename_sage_to_persona.sql.
  persona_mode text check (persona_mode is null or persona_mode in ('autistic')),
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Conversations
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'active' check (status in ('active', 'completed')),
  summary text,
  calibration_ratings text,
  extraction_state jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.conversations enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select using (auth.uid() = user_id);
create policy "Users can create own conversations"
  on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations"
  on public.conversations for update using (auth.uid() = user_id);

-- Messages
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  is_checkpoint boolean default false,
  checkpoint_meta jsonb,
  processing_text text,
  extraction_snapshot jsonb,
  created_at timestamptz default now() not null
);

alter table public.messages enable row level security;

create policy "Users can view own messages"
  on public.messages for select
  using (conversation_id in (select id from public.conversations where user_id = auth.uid()));
create policy "Users can create own messages"
  on public.messages for insert
  with check (conversation_id in (select id from public.conversations where user_id = auth.uid()));
create policy "Users can update own messages"
  on public.messages for update
  using (conversation_id in (select id from public.conversations where user_id = auth.uid()));

-- Manual entries (USER-level, not conversation-level).
-- A user can have many entries per layer. Jove decides when an entry is worth
-- writing; the classifier decides which of the five layers it belongs in.
create table public.manual_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  layer integer not null check (layer in (1, 2, 3, 4, 5)),
  name text,
  content text not null,
  source_message_id uuid references public.messages(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.manual_entries enable row level security;

create policy "Users can view own manual"
  on public.manual_entries for select using (auth.uid() = user_id);
create policy "Users can create own manual entries"
  on public.manual_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own manual entries"
  on public.manual_entries for update using (auth.uid() = user_id);

-- Auto-update timestamps
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_conversations_updated_at
  before update on public.conversations
  for each row execute procedure public.update_updated_at();

create trigger update_manual_components_updated_at
  before update on public.manual_entries
  for each row execute procedure public.update_updated_at();

-- Manual changelog: tracks how components evolve over time
-- Every time a component is updated (deepened, expanded, or revised due to contradiction),
-- the old version gets archived here before the update writes.
create table public.manual_changelog (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  component_id uuid not null,
  layer integer not null check (layer in (1, 2, 3, 4, 5)),
  name text,
  previous_content text not null,
  new_content text not null,
  change_description text not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz default now() not null
);

create index idx_manual_changelog_component
  on public.manual_changelog(component_id, created_at desc);

create index idx_manual_changelog_user
  on public.manual_changelog(user_id, created_at desc);

alter table public.manual_changelog enable row level security;

create policy "Users can view their own changelog"
  on public.manual_changelog for select
  using (auth.uid() = user_id);

-- Safety events: logged when crisis content is detected in user messages.
-- Access via service role only — no user-facing policies.
create table public.safety_events (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  crisis_detected boolean default true,
  persona_included_988 boolean,
  created_at timestamptz default now() not null
);

create index idx_safety_events_user_id on public.safety_events(user_id);
create index idx_safety_events_conversation_id on public.safety_events(conversation_id);
create index idx_safety_events_created_at on public.safety_events(created_at desc);

alter table public.safety_events enable row level security;
-- RLS enabled but no policies = blocked for all authenticated users.
