-- Voice overrides: admin-editable replacements for a fixed set of VOICE-text
-- prompt fields, so the founder can tune Jove's voice live without a deploy.
--
-- Purpose: the rebuilt voice (CHARACTER + the two openers + the post-confirm
-- line) is iterated on constantly during soak. Every tweak today is a code
-- edit + build + ship cycle. This table lets an admin edit those four fields
-- from /admin and have the change take effect on the next turn. The code
-- constants remain the permanent floor — a field is overridden ONLY when its
-- row exists AND is enabled, so an empty/unreachable table = today's behavior.
--
-- Read once per turn inside loadConversationContext (folded into its existing
-- parallel DB batch — no extra round-trip), written only via
-- /api/admin/persona-voice.
--
-- This table holds NO user data — it is global app config, at most four rows.
-- RLS is enabled with no policies, which denies all client (anon/auth) access
-- by default. The server reads/writes it exclusively through the service-role
-- admin client, which bypasses RLS. Same convention as feature_gates.
--
-- NOT editable here (stays code-only, shown read-only in the admin viewer):
-- REBUILT_LIMITS (crisis 988 protocol / no-clinical-names / no-prescribing),
-- the CRISIS_PHRASES list, the "in your Manual" checkpoint contract + its
-- detector regex, REBUILT_MECHANICS (carries that contract), OTP caps.
--
-- No rows are seeded: absence of a row means "use the code default." A row is
-- created the first time an admin saves an edit. "Reset to default" sets
-- enabled = false (non-destructive — the prior text stays for history, but the
-- code constant resolves again on the next turn).

create table if not exists public.persona_voice_overrides (
  key text primary key,
  text_override text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Append-only audit of edits, for "who changed what when" and rollback by eye.
-- old_text is null on the first edit of a key. No FK on updated_by (we store
-- the admin user id only; per the security rules we log ids, not content, to
-- application logs — the text lives here in the row, not in logs).
create table if not exists public.persona_voice_override_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_text text,
  new_text text not null,
  updated_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists persona_voice_override_history_key_idx
  on public.persona_voice_override_history (key, created_at desc);

alter table public.persona_voice_overrides enable row level security;
alter table public.persona_voice_override_history enable row level security;
-- No policies on either table: deny-all to anon/auth clients. Server access is
-- service-role only (bypasses RLS).
