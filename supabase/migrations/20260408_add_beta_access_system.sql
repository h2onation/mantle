-- Beta access system: allowlist, waitlist, and feedback tables.

-- TABLE 1: beta_allowlist
create table public.beta_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  constraint beta_allowlist_email_lowercase_trimmed
    check (email = lower(btrim(email)))
);

alter table public.beta_allowlist enable row level security;

-- No user-facing policies. Server-side service role access only.

-- TABLE 2: waitlist
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  constraint waitlist_email_lowercase_trimmed
    check (email = lower(btrim(email))),
  constraint waitlist_status_allowed
    check (status in ('waiting', 'invited', 'declined'))
);

alter table public.waitlist enable row level security;

-- Public form: anonymous users may insert their own row, nothing else.
create policy "waitlist_anon_insert"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- TABLE 3: beta_feedback
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_context text,
  feedback_text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

-- Authenticated users may insert feedback as themselves.
create policy "beta_feedback_owner_insert"
  on public.beta_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authenticated users may read their own feedback.
create policy "beta_feedback_owner_select"
  on public.beta_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No update or delete policies — feedback is append-only from the user's side.
