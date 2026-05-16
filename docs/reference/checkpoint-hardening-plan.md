# Checkpoint System Hardening Plan

> **Status**: Draft, 2026-04-16
> **Owner**: Jeff
> **Related**: `docs/system.md` (architecture), `docs/state.md` (current state), `docs/decisions.md` (decision log), `src/lib/persona/confirm-checkpoint.ts`, `src/app/api/checkpoint/confirm/route.ts`

---

## Why this exists

On 2026-04-16 we spent a full session chasing a single user-visible symptom — "Something went wrong saving that. Try again." — that turned out to be **three schema-drift bugs** and **one testing-harness bug** stacked on top of each other. We patched each one as we hit it, which worked, but the root problem is structural: we have no system that prevents the next drift from happening, no idempotency on the confirm path, no observability when confirms fail in production, and no integration test that actually exercises the real API contract.

Checkpoint confirm is the single most important user interaction in the product. It's the moment trust is built or lost. Every confirm that fails silently, double-writes, or surfaces a generic error is a data-integrity breach from the user's perspective — their manual is the product. We cannot ship to real beta users (targeted 2026-04-28, ~12 days out) until this system is engineered for the failure modes we'll actually see: flaky mobile networks, concurrent clicks, cold starts, and the silent schema drift we just lived through.

This plan is the "do it right" path. Not a hack, not a patch — the system we should have shipped the first time.

---

## Goals

1. **Zero silent data loss** on checkpoint confirm. Either the entry is in the manual with every auxiliary row (system message, message status), or nothing persisted and the user gets an actionable error.
2. **Idempotent by default.** A retry on a flaky network must never produce a duplicate entry, a 500, or a "already confirmed" error to the user.
3. **Schema drift is impossible.** The repo and the DB cannot get out of sync without CI catching it.
4. **Every production failure is visible.** If a real beta user hits a 500, we see it in logs and metrics, not from a support email.
5. **The test harness tests the real path.** dev-simulate must stop short of actions that only the user should perform through the real UI.

---

## Non-negotiables

These are the principles every track below must respect:

- **No hacks.** Every fix is a real fix — transactional semantics, unique constraints, idempotency keys, real observability. If a fix papers over a symptom without addressing the cause, it doesn't ship.
- **Existing user data is sacred.** No dev tool, migration, or background job may destructively overwrite `manual_entries`, `messages`, `manual_changelog`, or `conversations` for a non-devtest user. Destructive operations go through `/api/dev-reset` explicitly, or require per-row filters the caller constructs intentionally.
- **Every new table gets RLS enabled before it ships.** No exceptions, even for service-role-only tables (defense in depth).
- **Migrations are idempotent.** Every new migration uses `IF EXISTS` / `IF NOT EXISTS` / `DO $$ ... $$` guards so re-running is safe. No more rename-without-retry patterns.
- **Security rules from `CLAUDE.md` still apply.** Admin grants, RLS, no PII in logs, all hold.

---

## Tracks

Six tracks, ordered by dependency. Each has current-state, target-state, steps, and effort estimate.

---

### Track 1 — Migration management (unblocks everything else)

**Problem.** Migrations in `supabase/migrations/` are run manually via copy-paste into the Supabase dashboard SQL editor. There's no tracking of what's been applied, no CI verification, and no single source of truth. Today we discovered three migrations that were never run (`20260414_rename_sage_to_persona.sql`, `20260407_drop_pattern_type.sql`, and the `safety_events` CREATE TABLE in the baseline), plus a fourth file (`supabase/schema.sql`) that's a schema snapshot outside the migrations chain and will drift again. Loose SQL files in `supabase/` root (`add-extraction-snapshot.sql`, `add-feedback-table.sql`, `add-group-conversation-link.sql`, `admin-migration.sql`) are invisible to any tooling. The code also carries defensive fallbacks — e.g. `call-persona.ts:343` explicitly guards against a missing `extraction_snapshot` column — implying we already know there's more drift we haven't fixed.

**Target.** Exactly one schema-change path: `supabase db push` applies any unapplied files in `supabase/migrations/`. CI runs `supabase migration list` and fails the build if local and remote disagree. The Supabase CLI's `supabase_migrations.schema_migrations` table is the single source of truth for what's applied. Every table has RLS enabled. No orphan rows. No silent column fallbacks in code.

**Pre-flight audit (must run before any squash).** These SQL queries are read-only and tell us the actual state of prod. Run each in the Supabase SQL editor and save output:

1. **Every table's RLS status.** Any row with `rls_enabled = false` needs RLS enabled before we ship to beta.
   ```sql
   SELECT schemaname, tablename, rowsecurity AS rls_enabled
   FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
   ```
2. **Every column referenced by the code must exist.** Drift canary in SQL form — run this, and investigate any column the code expects that isn't listed:
   ```sql
   SELECT table_name, column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
   ```
   Cross-reference with every `.select(…)` / `.insert({…})` / `.update({…})` / `.eq(…)` call in `src/`. Focus columns today: `messages.extraction_snapshot`, `messages.processing_text`, `messages.is_checkpoint`, `messages.checkpoint_meta`, `messages.channel`, `manual_entries.summary`, `manual_entries.key_words`, `manual_entries.source_message_id`, `profiles.persona_mode`, `profiles.display_name`, `profiles.onboarding_completed_at`, `conversations.extraction_state`, `conversations.summary`, `conversations.linq_group_chat_id`.
3. **Orphan manual_entries.** Rows pointing to deleted messages:
   ```sql
   SELECT me.id, me.user_id, me.layer, me.source_message_id, me.created_at
   FROM public.manual_entries me
   LEFT JOIN public.messages m ON m.id = me.source_message_id
   WHERE me.source_message_id IS NOT NULL AND m.id IS NULL;
   ```
4. **Orphan checkpoint messages.** Messages marked as checkpoints with status `"confirmed"` but no corresponding `manual_entries` row:
   ```sql
   SELECT m.id, m.conversation_id, m.checkpoint_meta->>'status' AS status,
          m.checkpoint_meta->>'name' AS cp_name, m.created_at
   FROM public.messages m
   LEFT JOIN public.manual_entries me ON me.source_message_id = m.id
   WHERE m.is_checkpoint = true
     AND m.checkpoint_meta->>'status' = 'confirmed'
     AND me.id IS NULL;
   ```
5. **Pending-but-abandoned checkpoints** (for housekeeping, not blocking):
   ```sql
   SELECT m.id, m.conversation_id, m.created_at,
          now() - m.created_at AS age
   FROM public.messages m
   WHERE m.is_checkpoint = true
     AND m.checkpoint_meta->>'status' = 'pending'
     AND m.created_at < now() - interval '7 days';
   ```
6. **All triggers** (so we know what exists):
   ```sql
   SELECT trigger_name, event_object_table, event_manipulation, action_timing
   FROM information_schema.triggers
   WHERE event_object_schema = 'public';
   ```
7. **All unique/check constraints** on data-bearing tables:
   ```sql
   SELECT conrelid::regclass AS table, conname, contype,
          pg_get_constraintdef(oid) AS definition
   FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace
     AND conrelid::regclass::text IN ('manual_entries','manual_changelog','messages','conversations','profiles','safety_events')
   ORDER BY conrelid, conname;
   ```
8. **Foreign keys with ON DELETE behavior**:
   ```sql
   SELECT conrelid::regclass AS table, conname,
          confrelid::regclass AS references,
          confdeltype AS on_delete
   FROM pg_constraint WHERE contype = 'f'
     AND connamespace = 'public'::regnamespace;
   ```

Resolve everything 1–4 surfaces before squashing. Orphans get deleted manually (with a logged reason). Missing columns get migrations written. Missing RLS gets enabled.

**Steps (in order).**
1. **Run the pre-flight audit above.** Resolve every finding. This is the gate.
2. **Link the project:** `supabase login` then `supabase link --project-ref <prod-ref>`. Creates `supabase/config.toml`. Verify by running `supabase migration list` — it should show remote state (possibly empty if never used).
3. **Generate the squash:** `supabase db dump --schema public -f supabase/migrations/20260417_squash_baseline.sql`. This captures *actual prod state* at the moment of capture.
4. **Verification before deletion.** Create a fresh local Supabase instance: `supabase start`. Apply only the squash: `supabase db reset --linked=false` (or equivalent fresh-apply). Then `pg_dump --schema-only` both the local and prod, normalize whitespace/ordering, and `diff`. They must be identical (modulo timestamps). If not, the squash is incomplete — investigate and regenerate. **Do not proceed to step 5 until the diff is empty.**
5. **Delete the pre-squash files** from `supabase/migrations/`:
   - `20260407_add_phone_numbers.sql`
   - `20260407_add_phone_otp.sql`
   - `20260407_baseline_schema.sql`
   - `20260407_drop_pattern_type.sql`
   - `20260408_add_beta_access_system.sql`
   - `20260408_add_onboarding_completed_at.sql`
   - `20260409_rename_mantle_user_id.sql`
   - `20260414_rename_sage_to_persona.sql`
   - `20260415_add_manual_entry_compression_fields.sql`
   - `20260415_rename_manual_components_to_entries.sql`
   - `20260416_create_safety_events.sql`
   - `20260416_drop_manual_entries_type.sql`
6. **Delete the loose / snapshot files** from `supabase/`:
   - `supabase/schema.sql`
   - `supabase/add-extraction-snapshot.sql`
   - `supabase/add-feedback-table.sql`
   - `supabase/add-group-conversation-link.sql`
   - `supabase/admin-migration.sql`
   Grep the repo for `schema.sql` and each loose filename first — nothing in `src/` or `scripts/` should import these.
7. **Mark the squash as applied:** `supabase migration repair --status applied 20260417_squash_baseline`. Verify with `supabase migration list` — the squash should show as applied on both local and remote.
8. **CI integration (GitHub Action).** On PR: `supabase migration list` must show no new migrations without explicit reviewer approval (use a label or required reviewer check). On merge to main: `supabase db push` runs before `vercel deploy`. Store `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` as GitHub repo secrets.
9. **Delete defensive code fallbacks** that exist because we didn't trust the schema. In particular `call-persona.ts:343` (`if (error && !error.message.includes("extraction_snapshot"))`) — if the column is verified present in step 1, the fallback becomes dead code. Remove it.
10. **Admin page "Schema Health" panel** at `/admin?section=health`. Two queries:
    - `SELECT name, statements FROM supabase_migrations.schema_migrations` → applied list
    - Compare against files on disk via a new `/api/admin/migration-status` route
    - Flag any file not applied or any applied migration not in the repo
11. **Document the flow** in `docs/system.md` under a new "Schema changes" section: `supabase migration new <name>` → write migration → `supabase db push` locally → commit → PR → merge → CI applies to prod. Dashboard SQL editor is banned for DDL going forward; fine for read-only exploration.

**Rollback.** If the squash verification in step 4 fails, abort — do not delete anything. The old files remain intact. If CI breaks after step 8, revert the CI change; migrations still apply via `supabase db push` from a local terminal. If the defensive code removal in step 9 breaks something, re-add the fallback and investigate the missing column.

**Risks.**
- **Squash asymmetry.** If prod has state not captured by `db dump` (e.g., enum types, extensions, custom functions not in the `public` schema), the squash is incomplete. The step-4 diff catches this.
- **Lost migration history.** Deleting the old files loses the historical intent. Mitigation: the git history preserves them, and the squash's header comment links to the last commit SHA where they existed.
- **CI credentials leak.** `SUPABASE_ACCESS_TOKEN` has full admin rights on the project. Store as repo secret, rotate quarterly, never log it.

**Effort.** 1 full day, most of it verification. Blocks Tracks 2, 4, 5.

---

### Track 2 — Idempotent confirm + unique constraint

**Problem.** `confirm-checkpoint.ts` treats "already confirmed" as an error and returns 500. This is wrong: idempotency is a *feature* for APIs that do writes over flaky networks. A retry after a network blip shouldn't error. The code also does three separate DB writes (insert `manual_entries`, update `messages.checkpoint_meta`, insert system `messages` row) with no transaction, so a partial failure leaves the system in an inconsistent state (entry written but meta still "pending" → next retry 500s on "already resolved" because the `manual_entries` row exists but the meta never flipped).

There's also no unique constraint on `(user_id, source_message_id)` in `manual_entries`. Two concurrent confirms for the same checkpoint would both succeed and insert duplicate rows.

**Target.** `POST /api/checkpoint/confirm` is safe to call any number of times with the same `messageId`. First call persists and returns the new entry's id + the follow-up stream. Subsequent calls recognize the checkpoint is already confirmed and return success with the existing entry's id (no re-stream needed — the client already has the response from the first call). No duplicate writes under concurrency. All three writes commit atomically or none do.

**Schema change (new migration `20260418_confirm_idempotency.sql`):**

```sql
-- Partial unique index: prevents duplicate manual_entries for the same
-- source checkpoint. Partial so dev-populate rows (null source_message_id)
-- are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS manual_entries_user_source_msg_uniq
  ON public.manual_entries (user_id, source_message_id)
  WHERE source_message_id IS NOT NULL;

-- Transactional write function. Returns the entry id and a flag indicating
-- whether this call did the insert or found it already present.
CREATE OR REPLACE FUNCTION public.confirm_checkpoint_write(
  p_message_id uuid,
  p_user_id uuid,
  p_layer integer,
  p_name text,
  p_content text,
  p_summary text,
  p_key_words text[]
) RETURNS TABLE (entry_id uuid, was_already_confirmed boolean)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_meta jsonb;
  v_existing_entry uuid;
  v_new_entry uuid;
BEGIN
  -- Load and lock the message row for the duration of the tx
  SELECT checkpoint_meta INTO v_meta
  FROM public.messages
  WHERE id = p_message_id AND is_checkpoint = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkpoint_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Already confirmed — idempotent return
  IF v_meta->>'status' = 'confirmed' THEN
    SELECT id INTO v_existing_entry
    FROM public.manual_entries
    WHERE user_id = p_user_id AND source_message_id = p_message_id
    LIMIT 1;
    RETURN QUERY SELECT v_existing_entry, true;
    RETURN;
  END IF;

  -- Guard against rejected/refined
  IF v_meta->>'status' <> 'pending' THEN
    RAISE EXCEPTION 'checkpoint_not_pending' USING ERRCODE = 'P0001';
  END IF;

  -- Insert entry; the unique index protects us under concurrency
  INSERT INTO public.manual_entries
    (user_id, layer, name, content, source_message_id, summary, key_words)
  VALUES
    (p_user_id, p_layer, p_name, p_content, p_message_id, p_summary, p_key_words)
  ON CONFLICT (user_id, source_message_id) WHERE source_message_id IS NOT NULL
  DO UPDATE SET source_message_id = EXCLUDED.source_message_id
  RETURNING id INTO v_new_entry;

  -- Flip the meta status
  UPDATE public.messages
  SET checkpoint_meta = jsonb_set(checkpoint_meta, '{status}', '"confirmed"')
  WHERE id = p_message_id;

  -- Insert the system message so Jove's next turn sees the confirmation
  INSERT INTO public.messages (conversation_id, role, content)
  SELECT conversation_id, 'system', '[User confirmed the checkpoint]'
  FROM public.messages WHERE id = p_message_id;

  RETURN QUERY SELECT v_new_entry, false;
END;
$$;

-- Allow the service role to call it (RLS still applies to the underlying tables)
GRANT EXECUTE ON FUNCTION public.confirm_checkpoint_write TO service_role;
```

The `ON CONFLICT ... DO UPDATE SET source_message_id = EXCLUDED.source_message_id` is a "touch" that makes the RETURNING id work even when the insert is a no-op due to conflict. This gives us the existing entry's id without a second SELECT.

**Steps (in order).**
1. Write the migration above and run the pre-flight: confirm no existing `manual_entries` rows would violate the partial unique index. Query:
   ```sql
   SELECT user_id, source_message_id, COUNT(*)
   FROM public.manual_entries
   WHERE source_message_id IS NOT NULL
   GROUP BY user_id, source_message_id HAVING COUNT(*) > 1;
   ```
   Should return zero rows. If not, resolve duplicates by hand (delete the later copy, logged) before applying the migration.
2. `supabase db push` the migration.
3. **Rewrite `confirmCheckpoint()` in TypeScript** to a single RPC call:
   ```ts
   const { data, error } = await admin.rpc('confirm_checkpoint_write', {
     p_message_id: messageId,
     p_user_id: userId,
     p_layer: meta.layer,
     p_name: nameToWrite,
     p_content: contentToWrite,
     p_summary: summaryToWrite,
     p_key_words: keyWordsToWrite,
   });

   if (error) {
     if (error.message?.includes('checkpoint_not_found')) {
       return { success: false, error: 'Checkpoint not found.' };
     }
     if (error.message?.includes('checkpoint_not_pending')) {
       return { success: false, error: 'Checkpoint was rejected or refined.' };
     }
     console.error('[confirmCheckpoint] RPC failed:', error);
     return { success: false, error: 'Something went wrong.' };
   }

   const { entry_id, was_already_confirmed } = data[0];
   return { success: true, componentId: entry_id, wasIdempotent: was_already_confirmed };
   ```
4. **Update `/api/checkpoint/confirm/route.ts`** to handle `wasIdempotent: true` by skipping the `callPersona()` stream (no follow-up needed — the first call already sent one) and returning a short JSON response instead of SSE. Client treats that as "already done, just refresh state".
5. **Client-side idempotency key.** `useChat.ts:confirmCheckpoint` generates a uuid at mount time for the current activeCheckpoint, sends it as `X-Idempotency-Key` header. Route stores seen keys in a short-lived in-memory or Upstash-backed Set (60s TTL); if seen, returns the same response as before without re-calling the DB. Belt and suspenders on top of the Postgres-level idempotency.
6. **Test coverage.** Four new tests:
   - `confirm-checkpoint.test.ts`: double-invoke returns same entry id, `wasIdempotent: true` on second call.
   - `confirm-checkpoint.test.ts`: concurrent `Promise.all` invocations → one insert, one `was_already_confirmed`, same entry id.
   - `confirm-checkpoint.test.ts`: already-rejected checkpoint → `error: 'Checkpoint was rejected or refined.'` (not 500, just a clear 4xx).
   - `route.test.ts`: second POST to `/api/checkpoint/confirm` with same message id returns 200 JSON (not SSE) with the existing entry id.
7. **Remove the old three-statement body** from `confirmCheckpoint` after the RPC version is green.

**Rollback.** If the RPC misbehaves, revert the TS change — the old three-statement path still works (we're not dropping any columns or indexes on rollback). Leave the unique index in place regardless; it's strictly a safety upgrade.

**Risks.**
- **`SECURITY DEFINER`** means the function runs as its owner, not the caller. We grant EXECUTE only to `service_role`, so only the server-side admin client can call it — users can't invoke it directly. Verify by attempting a call from an anon/authenticated client (should return permission error).
- **Advisory-lock alternative.** If `FOR UPDATE` on `messages` starts showing contention (unlikely at beta scale), switch to `pg_advisory_xact_lock(hashtext(p_message_id::text))` — cheaper locking.
- **Error surface.** `RAISE EXCEPTION` strings are parsed in TS to map to error kinds. This coupling is fine for now but document the contract in the migration file header.

**Effort.** 1.5 days, including writing the function, TS rewrite, tests, and a careful production cutover. Depends on Track 1.

---

### Track 3 — Client-side resilience

**Problem.** `useChat.ts:confirmCheckpoint` has a bare `try/catch` that sets a vague "Something went wrong" banner on any failure — server 500, JS exception, stream parse error, `loadManual` failure, anything. No retry. No distinction between recoverable and fatal. The error is also render-coupled to `activeCheckpoint` being non-null, which produces transient "appears-then-resolves" banners that confuse users. The service worker has at least one logged `net::ERR_` on `sw.js:69` that we never investigated.

**Target.** Confirm button UX is predictable: click once, wait up to 30s (network + streaming), see either success + entry + follow-up, or a specific actionable error. No transient banners. No retries that go through again after a successful write.

**Error taxonomy.** Four categories, four different UX responses:

| Cause | Detection | Auto-retry? | User message |
|---|---|---|---|
| Network failure (fetch reject, timeout) | `fetch` throws or takes >30s | Yes, up to 3 attempts with backoff 500ms / 2s / 5s | "Still trying… (attempt N/3)" |
| 5xx from server | `res.status >= 500` | Yes, same backoff | "Server hiccup. Trying again…" |
| 4xx client error (404/403/400) | `res.status >= 400 && < 500` | No — this is a bug | "Something's off on my end. Refresh and try again." + log to `confirm_failures` |
| 429 rate limited | `res.status === 429` | No — back off hard | "You've confirmed a lot recently. Give it a minute." |
| Stream mid-interruption AFTER success | `res.ok === true` but stream parse fails | No — entry is saved | No error; trigger `loadManual()` to reconcile |

**Service worker audit — concrete deliverable.**
1. Open `public/sw.js`, read every `fetch` handler. Document each in a new `docs/reference/sw-audit.md`:
   - What URL patterns it matches
   - Cache strategy (network-only, cache-first, stale-while-revalidate)
   - What happens on miss/failure
2. Any handler that matches `/api/*`, `/auth/*`, or routes that read user data must use network-only with no fallback. If it doesn't, change it.
3. Run the actual repro: unregister the SW, hard-reload the site, take a Network screenshot. There should be zero `(failed) net::ERR_` rows on page load. If there are, they're from the app itself (not the SW) and need a separate fix.
4. Bump the SW cache version on deploy (the `const CACHE_NAME = 'mywalnut-vN'` pattern) so old clients invalidate cleanly.

**Steps.**
1. **Split error state** in `useChat.ts`. Currently `checkpointError` is a single string. Replace with `{kind: 'network'|'server'|'client'|'rate-limit'|null, message: string | null, attempt: number}`. Render logic looks at `kind` to pick the message template. Clear the error when the user dismisses, retries, or moves to a new conversation — but NOT when `activeCheckpoint` changes (so transient success-flashing stops).
2. **Auto-retry wrapper** around the fetch call. Max 3 attempts. Backoff: 500ms, 2s, 5s. Only retry on network fail or 5xx. Retry is safe because Track 2's idempotency key + Postgres-level idempotency mean repeats produce the same result.
3. **Idempotency key plumbing.** Generate a uuid when `activeCheckpoint` is set. Send as `X-Idempotency-Key` header on every attempt. Client keeps the same uuid across retries; a new checkpoint gets a new uuid.
4. **Service worker audit** as specified above. Deliverable: `docs/reference/sw-audit.md` with the full handler list + any fixes landed.
5. **Stream-interruption recovery.** After the SSE stream ends (success or mid-stream), always call `loadManual()` to reconcile DB state with UI state. If the Manual shows the entry after reconciliation, don't show an error even if the stream was cut off. The data is what matters.
6. **Error messages** wired through a small `confirmErrorMessage({kind, attempt})` helper so there's one source of truth, and adding/changing messages doesn't require hunting through JSX.
7. **Test coverage.** New tests in `useChat.test.ts` (or create if missing) for the retry ladder, error taxonomy mapping, and idempotency key persistence across retries. Mock `fetch` with programmable failure sequences.

**Rollback.** Each step is independent. If auto-retry turns out to cause thundering-herd problems (unlikely at beta scale), revert just the retry wrapper; the error taxonomy and SW audit stay.

**Risks.**
- **Auto-retry without idempotency is dangerous** — Track 2 MUST land first. Never ship retry code that isn't protected by server-side idempotency.
- **SW audit may expose bigger issues** (e.g., a broad `caches.match(event.request)` that catches too much). If it does, treat as a separate branch: document, scope, fix.
- **Stream parse failures** can be hard to distinguish from "user closed the tab mid-stream" — don't log those as errors; they're normal.

**Effort.** 1 day for client changes + tests, half day for SW audit. Depends on Track 2.

---

### Track 4 — Observability

**Problem.** Today's bug surfaced because the user told us "Something went wrong." There are no production metrics, structured logs, or dashboards that would have surfaced this independently. `[persona-debug]` logs exist in dev mode only. Vercel logs have the raw error text but no rollup or alerting.

**Target.** We can answer these questions in under 30 seconds without asking a user:
- How many `/api/checkpoint/confirm` calls in the last hour, grouped by HTTP status?
- What's the p50/p95/p99 latency?
- Of failures, what's the error distribution? (`checkpoint_already_confirmed` vs `rpc_error` vs `network_timeout` vs `anthropic_timeout` etc.)
- Which users have seen a confirm error in the last 7 days?

**Log schema (committed contract).** Every log line from the confirm pipeline is a single-line JSON with exactly this shape:

```json
{
  "ts": "2026-04-16T16:28:46.123Z",
  "event": "confirm_outcome",
  "req_id": "sfo1::qns8p-1776356926251-daa45bafbc6e",
  "user_id_hash": "a1b2c3...",
  "conversation_id": "ba4fb50d-88d3-46bd-9b6c-eaca54ab3d5a",
  "message_id": "f4b2ca7e-3837-488e-8076-9811953c1b46",
  "layer": 2,
  "outcome": "success" | "idempotent" | "network_fail" | "rpc_fail" | "anthropic_fail" | "client_fail",
  "status_code": 200,
  "duration_ms": 1234,
  "retry_count": 0,
  "idempotency_key": "abc-123-...",
  "error_kind": null | "checkpoint_not_found" | "checkpoint_not_pending" | "stream_timeout" | "...",
  "error_detail": null | "<short string, never content>"
}
```

**Rules:**
- `user_id_hash` = `crypto.subtle.digest('SHA-256', user_id).slice(0, 16)` — stable per-user for correlation, opaque for privacy.
- `req_id` = Vercel's `x-vercel-id` for joining with Vercel logs.
- Never log: message content, entry name, summary, key_words, composed_content, user email, phone, any text the user typed.
- Always log: outcome, status code, duration, retry count.

**Event types (one per line as they happen):**
- `confirm_attempt` — when the route is hit
- `confirm_rpc_ok` / `confirm_rpc_fail` — after Postgres function returns
- `confirm_stream_started` / `confirm_stream_ended` — around the `callPersona` stream
- `confirm_outcome` — the rollup line (one per request)

**Steps.**
1. **Ship the `log()` helper** in `src/lib/observability/log.ts`. Single function, takes the event object, emits `JSON.stringify(event)` via `console.log` (Vercel picks it up automatically). In dev mode, pretty-prints instead.
2. **Instrument `/api/checkpoint/confirm/route.ts`** with the six event types above. Time the phases. Always emit `confirm_outcome` even on exception (in a `finally` block).
3. **Persist failure events** to a new table (migration `20260419_confirm_failures.sql`):
   ```sql
   CREATE TABLE IF NOT EXISTS public.confirm_failures (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
     message_id uuid,
     conversation_id uuid,
     error_kind text NOT NULL,
     error_detail text,
     status_code integer,
     retry_count integer DEFAULT 0,
     duration_ms integer,
     created_at timestamptz NOT NULL DEFAULT now()
   );

   ALTER TABLE public.confirm_failures ENABLE ROW LEVEL SECURITY;

   CREATE INDEX idx_confirm_failures_created_at
     ON public.confirm_failures (created_at DESC);
   CREATE INDEX idx_confirm_failures_user_id
     ON public.confirm_failures (user_id);
   ```
   Writes are fire-and-forget from the route (don't block the client on observability).
4. **Admin dashboard panel** `/admin?section=health`. Four widgets:
   - Confirm success rate, last 1h / 24h / 7d (three numbers, color-coded)
   - Error kind histogram, last 24h (bar chart, top 5)
   - Recent failure feed, last 20 rows from `confirm_failures`
   - Schema drift indicator from Track 1 step 10
   - p50 / p95 latency from the last 1000 `confirm_outcome` events (derived from `duration_ms` — either query from structured logs via Vercel Logs API, or add a rolling counter table and populate from the `log()` helper)
5. **Retention job.** Scheduled delete (once daily) removes `confirm_failures` rows older than 30 days. Implement as a Supabase Edge Function on a cron, or a row-level policy + `pg_cron` if you enable that extension.
6. **Alerting (post-beta, nice to have).** Write a daily digest to an admin-only table `confirm_daily_health` with aggregate stats. Check every morning for the first week of beta.

**Rollback.** Each piece is additive. If the admin dashboard is slow due to the aggregate queries, add a 5-minute materialized-view cache.

**Risks.**
- **Double-logging** if both the `log()` helper and a `console.error` fire. Grep the codebase for `console.error` in the confirm path after instrumenting and remove the duplicates.
- **`confirm_failures` write failures** during an actual incident (DB down). That's fine — the structured log via `console.log` still goes to Vercel, so we don't lose the event entirely.
- **`user_id_hash` stability.** Use a fixed-salt (stored in env) hash, not `bcrypt`, so the same user always maps to the same hash across deploys. Document in `rules.md` that this hash is opaque-to-humans observability, not authentication.

**Effort.** 1.5 days total. 0.5d log helper + instrumentation, 0.5d table + migration + dashboard queries, 0.5d admin UI. Depends on Track 1.

---

### Track 5 — Integration testing that exercises the real path

**Problem.** We have 405 unit tests with all Anthropic and Supabase calls mocked. Zero tests actually hit a real DB with a real confirm flow. Today's bug would not have been caught by any of them — the `confirm-checkpoint.test.ts` tests pass because they mock the DB, but prod has a schema that doesn't match the code's assumptions. Mocked tests verify the code against the code, not against reality.

**Target.** One end-to-end test that runs against a local Supabase instance in CI. It: creates a test user, seeds a pending checkpoint, confirms via `/api/checkpoint/confirm`, and asserts the row lands in `manual_entries` with correct shape and the message status flips to `confirmed`. A separate "drift canary" applies all migrations to an empty DB and verifies every table the code writes to accepts writes with the shape the code produces.

**CI infrastructure choice.** `supabase start` locally (via Docker) is the cleanest path — it runs a full Postgres + auth + realtime stack, applies migrations, and tears down per run. No cloud account required, free, and matches prod closely. GitHub Actions' Docker support handles this without pain. Cost: ~30s added to CI runtime.

**Steps.**
1. **Add `supabase start` to local dev docs.** Update `README.md` or `docs/system.md` with "run `supabase start` before E2E tests locally" instructions. This ensures anyone can run the suite without Docker knowledge.
2. **Write `src/app/api/checkpoint/confirm/e2e.test.ts`.** Uses `@supabase/supabase-js` against `http://localhost:54321` (the default Supabase local endpoint). Skipped when `SUPABASE_URL` env var starts with `http://localhost` is missing (so `npm run test` doesn't fail on machines without Docker). Mocks `anthropicStream` only — all DB operations are real. Suite includes:
   - **Happy path:** insert a pending-checkpoint message, POST to confirm, assert manual_entries row + message status + system message.
   - **Idempotency:** same POST twice, assert one manual_entries row and second response is 200 with the same entry id.
   - **Concurrency:** `Promise.all` two POSTs, assert one manual_entries row (the unique index holds).
   - **Already-resolved:** POST on a pre-confirmed message, assert idempotent success (not 500).
3. **Drift canary** in `src/db-contract.test.ts`. Runs against the same local instance. For each table the code writes to (`messages`, `manual_entries`, `manual_changelog`, `safety_events`, `conversations`, `profiles`, `beta_feedback`, etc.), issue a sample INSERT with the same shape the code produces. If a NOT NULL column is missing, a column no longer exists, or a type mismatches, the test fails. This would have caught today's stale `type` column.
4. **New npm script.** Add `"test:e2e": "SUPABASE_URL=http://localhost:54321 vitest run src/**/e2e.test.ts src/db-contract.test.ts"`. Keep unit tests fast — `npm run test` stays <1s, `npm run test:e2e` takes 5-30s depending on Docker warmness.
5. **GitHub Action step.** New job `e2e` that runs after `test`. Spins up Supabase via `supabase start` (needs Docker; ubuntu-latest runners have it). Runs `supabase db push` (uses Track 1 migrations). Runs `npm run test:e2e`. Fails the PR if either test suite fails.
6. **Smoke test on deploy.** After Vercel deploy, a GitHub Action hits the deployed `/api/checkpoint/confirm` with a test admin account (`devtest@test.com`) and a pre-seeded pending checkpoint, asserts success. This catches drift between merged code and deployed DB. Keep it behind a feature flag so we can disable during maintenance.

**Rollback.** If the E2E suite is flaky, disable via a commented-out GHA step rather than deleting — keeps the test code alive, just pauses CI enforcement until flakiness is fixed.

**Risks.**
- **Flakiness.** E2E tests on shared CI runners can be slow or flaky. Counter: run locally in a deterministic Docker environment, use `supabase stop && supabase start` before each run if needed, and keep the suite tiny (5 tests max, not 50).
- **Test-user pollution.** E2E tests write real rows. Use randomized user IDs and clean up at end of each test (`afterAll` block).
- **CI secret leakage.** The test DB runs in CI, no Supabase cloud secrets needed, so no secret surface. Prod smoke test (step 6) needs a service-role key; store as repo secret, use only the subset needed.

**Effort.** 1.5 days. 0.5d CI plumbing, 0.5d E2E + canary tests, 0.5d deploy smoke test. Depends on Track 1.

---

### Track 6 — Rate limiting + abuse posture

**Problem.** `/api/checkpoint/confirm` has a rate limiter wired up (`checkpointConfirmHour`) but Upstash env vars aren't set in production, so it fails open — infinite requests are allowed. In practice this hasn't mattered because we have zero users. At beta scale with flaky mobile, auto-retry, and potential bad actors, we need rate limiting for real. Same problem applies to `/api/chat`, `/api/session/summary`, `/api/waitlist`, and `/api/user/phone` (all log `fail-open` on startup).

**Target.** All rate limiters enforce. 429 responses are surfaced with a specific user-facing message. Limits are generous enough that no legitimate user hits them in normal use.

**Concrete limits (proposed, measure and adjust during beta):**

| Endpoint | Limit | Window | Rationale |
|---|---|---|---|
| `POST /api/chat` | 30 | 1 minute | Normal conversation is 1-2 msgs/minute; 30 gives headroom |
| `POST /api/checkpoint/confirm` | 20 | 1 hour | Heaviest users do 3-5 checkpoints per session, 20 is 4x |
| `POST /api/session/summary` | 10 | 1 hour | Fire-and-forget, rare |
| `POST /api/waitlist` | 3 | 1 hour (per IP) | Already has this |
| `POST /api/user/phone` | 5 | 1 hour | OTP verification, 5 is more than a human needs |
| `POST /api/user/phone/verify` | 10 | 1 hour | Typos happen |

All per-user (by authenticated user ID) except waitlist (per-IP since users aren't authenticated yet).

**Steps.**
1. **Provision Upstash Redis.** Free tier is fine for beta (10k requests/day). Create a database, grab REST URL + token.
2. **Add env vars to Vercel.** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Add to `.env.example` as documentation.
3. **Verify fail-open warnings disappear.** `npm run build` should no longer log `[rate-limit] Upstash env vars missing`.
4. **Audit limit numbers** in `src/lib/rate-limit.ts` — update to the table above.
5. **429 handling in `useChat.ts`.** When a 429 comes back, show "You've confirmed a lot recently. Give it a minute." Don't auto-retry (Track 3's retry ladder explicitly excludes 429).
6. **Test limits locally** with a script: fire N+1 requests in a second, assert last one is 429.
7. **Log rate-limit hits** via the Track 4 structured log helper so we can see if a real user is getting blocked legitimately and needs their limit raised.

**Rollback.** If Upstash goes down, the code fails open (current behavior) — no action needed.

**Risks.**
- **Legitimate users hitting limits.** Monitor during beta via Track 4 logs; if more than 1% of users hit a limit on a given endpoint, the number is too tight.
- **Upstash free-tier exhaustion** at scale. 10k requests/day is plenty for 10 beta users; re-evaluate at 100+ users.
- **Environment drift.** If Upstash env vars aren't set on a preview deployment, that environment fails open. Could be fine for preview deploys but document it.

**Effort.** Half a day. Independent of other tracks.

---

---

### Track 7 — Explicit decisions we're making

Calling these out in the plan so they don't get relitigated mid-execution.

| Decision | What we chose | Alternative we rejected | Why |
|---|---|---|---|
| Migration strategy | Squash baseline + delete old files | Keep all files, `migration repair --status applied` each one | Drift proved the old files are unreliable historical intent, not reliable truth. Squash makes current = baseline. |
| Transaction boundary | Postgres function (`SECURITY DEFINER`) | Two-phase commit in TS with explicit `BEGIN/COMMIT` via `.rpc('begin')` | Supabase JS client can't do explicit transactions cleanly. Function is the idiomatic path. |
| Unique index shape | Partial (`WHERE source_message_id IS NOT NULL`) | Full unique | Partial keeps dev-populate (null source) insertable without workarounds; real confirms always have a source. |
| Idempotency mechanism | Both Postgres-level (unique + RPC) and client-side idempotency key (60s TTL) | Just one | Defense in depth. Postgres stops concurrency within one request; idempotency key stops spurious retries after a connection drops mid-response. |
| Observability substrate | Structured `console.log` → Vercel logs + dedicated `confirm_failures` table for failures | External APM (Datadog, Honeycomb) | Zero added cost; Vercel logs are already captured; `confirm_failures` lets admin dashboard query without log API dependency. |
| Test infrastructure | Local Supabase in CI (Docker) | Dedicated cloud test project | Free, deterministic, no credential surface. |
| Rate limit storage | Upstash Redis | In-memory (Vercel edge) | Edge functions are stateless across regions; in-memory wouldn't work. |
| Error UX | Explicit taxonomy with kind-specific messages + auto-retry for transient | Single "retry" button + generic message | Today's bug shows the generic message misleads users when the actual failure varies by cause. |
| PII in logs | SHA-256-of-user-id with fixed salt; no content ever | Plain user id / plain content | Mirrors the `rules.md` rule (no PII in logs) while preserving correlation for debugging. |
| Test coverage for drift | Canary test that inserts sample data into every table the code writes to | TypeScript-only schema generation | Schema lives in Postgres, not in TS types. Only way to catch real drift is to actually write to the DB. |

---

## Sequencing

```
Track 1 (migrations)  ──┬──→ Track 2 (idempotency RPC) ──→ Track 3 (client resilience)
                        │
                        ├──→ Track 4 (observability)
                        │
                        └──→ Track 5 (integration test)

Track 6 (rate limiting)       ——  parallel, independent, land whenever
Track 7 (decisions recorded)  ——  done; revisit only with cause
```

Track 1 unblocks everything else. Do it first, then fan out. Tracks 2-5 can run in parallel after Track 1 lands. Track 6 is independent — do it whenever Upstash is provisioned.

---

## Pre-beta cut (ship by 2026-04-28)

Must land:
- **Track 1** — migrations under CLI control, drift impossible going forward (1 day)
- **Track 2** — idempotent confirm, unique constraint, transactional writes (1.5 days)
- **Track 3** — at minimum: SW audit + error taxonomy + 429 handling (1 day; auto-retry can be a fast follow)
- **Track 6** — Upstash Redis provisioned, rate limits enforced (0.5 day)

Should land but can slip:
- **Track 4** — structured logs + confirm_failures table (dashboard can follow post-beta) (1 day for logs alone)
- **Track 5** — E2E test + drift canary (1.5 days)

Total for must-lands: ~4 days of focused work within the 12-day runway.  
Total if everything lands: ~7 days.

Buffer for scope growth, unknown unknowns, and actual beta prep: ~5 days remaining. That's tight but workable.

---

## Definition of done

This plan is complete when:

- [ ] `supabase db push` is the only path to apply migrations; dashboard SQL editor is only used for emergency reads
- [ ] `supabase/schema.sql` and the loose SQL files are deleted
- [ ] Every migration in `supabase/migrations/` is idempotent and accounted for in `supabase_migrations.schema_migrations`
- [ ] `/api/checkpoint/confirm` returns success on a repeat call with the same `messageId` (tested)
- [ ] `manual_entries` has a partial unique index on `(user_id, source_message_id)`
- [ ] Confirm's three writes happen in one transaction (tested with a forced-failure case)
- [ ] No `console.log` in the confirm pipeline; all observability events go through the structured `log()` helper
- [ ] `confirm_failures` table exists and receives writes on every 4xx/5xx
- [ ] `/admin?section=health` shows confirm success rate, error distribution, and schema drift status
- [ ] E2E test runs in CI, exercises the real DB path, catches drift
- [ ] Upstash Redis is provisioned; `[rate-limit] Upstash env vars missing` no longer appears in build logs
- [ ] Service worker audit is done; no `(failed)` rows for API requests on page load

---

## Out of scope (for this plan)

- Refactoring `callPersona` itself — the streaming follow-up is not the primary source of today's pain
- Anthropic retry / fallback strategy (Haiku → Sonnet, model downgrade) — separate concern
- Full disaster recovery / backup strategy — separate concern, takes its own plan
- Mobile offline support (queued-for-sync confirms when offline) — nice to have, post-MVP
- Multi-region replication — not needed at beta scale
- End-user feature for editing a confirmed entry — separate product decision

---

## Appendix — what today taught us

1. **Migrations run manually drift silently.** The only defense is tooling + CI.
2. **Testing harnesses that bypass production paths hide production bugs.** If your "simulate" tool auto-confirms, you'll never discover the confirm path is broken.
3. **"Clean slate" defaults in dev tools are footguns.** Make them additive by default, explicit when destructive.
4. **Idempotency is not optional for mobile APIs.** Users on bad networks retry constantly. Every write endpoint needs to tolerate it.
5. **Generic error messages hide root causes.** "Something went wrong" is a symptom of missing observability.
6. **The DB schema is a hard constraint.** TypeScript types don't help when the column doesn't exist. Contract tests against the real schema are the only way to catch this.
