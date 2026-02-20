-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
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

-- Manual components (USER-level, not conversation-level)
create table public.manual_components (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  layer integer not null check (layer in (1, 2, 3)),
  type text not null check (type in ('component', 'pattern')),
  name text,
  content text not null,
  source_message_id uuid references public.messages(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- One component per layer per user
create unique index unique_component_per_layer
  on public.manual_components (user_id, layer) where type = 'component';

-- One pattern per name per layer per user (names normalized to lowercase)
create unique index unique_pattern_name_per_layer
  on public.manual_components (user_id, layer, name) where type = 'pattern';

alter table public.manual_components enable row level security;

create policy "Users can view own manual"
  on public.manual_components for select using (auth.uid() = user_id);
create policy "Users can create own manual components"
  on public.manual_components for insert with check (auth.uid() = user_id);
create policy "Users can update own manual components"
  on public.manual_components for update using (auth.uid() = user_id);

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
  before update on public.manual_components
  for each row execute procedure public.update_updated_at();
