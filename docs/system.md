# system.md — How the System Works

> **Authority level**: Technical reference. Changes when architecture changes.  
> **Audience**: You (to understand the machine) and Claude Code agents (to avoid breaking it).  
> **What belongs here**: Architecture that spans multiple files, non-obvious coupling, invariants, gotchas. Not schema dumps or route tables — the agent reads those from code.
> **Rewritten 2026-07-06** for the conductor pull model. The push-model description this replaced is in git history.

---

## The Big Picture

One sentence: **Jove talks; the user saves.**

Jove's entire personality is one document — the conductor prompt (`src/lib/persona/conductor-prompt.ts`, live-editable at `/admin/prompt-architecture`). Jove's only job is the conversation. It never proposes a save, never writes to the Manual, and controls exactly one signal: when it judges an insight has landed, it ends that message with a hidden `---reflection-ready---` marker. That marker lights the reflection bar. Everything after that is the user's: they tap the bar, an Opus call composes a draft entry in their words, they edit it in an overlay, they confirm. Only then does a row land in `manual_entries`.

This replaced the earlier push model (Jove decided when to propose; a detector regex + gates fired a card at the user), deleted in July 2026.

## Vendor Inventory

The canonical list of third-party vendors — what's live, what's deprecated, what's a future candidate — is `src/lib/vendors/registry.ts`, rendered at `/admin/vendors`. Each vendor entry carries its category, status, env vars, integration paths, webhook, feature flag, and ADR references. Edit the registry (not this doc) to add or change a vendor; rationale for each choice lives in `decisions.md`.

---

## The Pipeline (What Happens Every Turn)

A normal turn runs two AI calls in parallel. A third fires only when the user pulls a reflection.

```
User message
  → Save to DB + parallel reads (history, manual entries, previous extraction state,
    feature gates, voice overrides, checkpoint tuning — one Promise.all)
  → Two calls fire simultaneously:
      → EXTRACTION (Sonnet): analyzes the message, updates working memory,
        saves for NEXT turn (fire-and-forget)
      → JOVE (Opus): conductor prompt + Manual context + session context,
        streams the response to the user
  → message_complete event closes the turn. It carries the reflection-meter
    state ({ fill, ready } — or null to hide it on crisis).

Capture (only when the user acts):
  User taps the ready reflection bar
  → POST /api/checkpoint/compose — COMPOSER (Opus) drafts the entry from the
    whole conversation, anchored to the user-approved working version,
    briefed by extraction's language bank
  → Editable overlay: the user changes anything, or discards
  → POST /api/checkpoint/confirm — plain DB write, no model. Entry lands in
    manual_entries; the meter recharges.
```

**Why extraction runs in parallel**: Separating "analyze what the user said" from "respond to the user" produces better results than one prompt doing both. Running them in parallel means this separation adds zero wait time.

**The one-turn lag**: Because extraction and Jove run simultaneously, anything derived from extraction (the meter fill, the composer's brief) reflects the *previous* turn's analysis. Extraction state is cumulative, so the lag is negligible. Turn 1 has no extraction state at all.

**Extraction is fire-and-forget**: `fireBackgroundExtraction()` runs as a background Promise, never awaited. It writes to `conversations.extraction_state` (JSONB). It never blocks Jove's stream, and its output is never read by Jove's own reply — only by the meter and the save-time composer.

**The reflection meter** (`resolveReflectionMeter` in `persona-pipeline.ts`): fill comes from extraction's depth reading (recharges over `cooldownTurns` after each save); `ready` comes ONLY from Jove's `---reflection-ready---` marker (persisted per-message as `metadata.reflection_landed`). Crisis hides the meter entirely (returns null). One resolution function is shared by the live stream and the reload/restore endpoint (`/api/checkpoint/meter`) so they can't drift. Web-only surface.

## Multi-Channel Architecture (Web + Text)

Jove was built to run on two channels: web (streaming SSE) and text (non-streaming, Sendblue for 1:1, Linq for group — routed through `src/lib/messaging/send.ts`, ADR-035).

**1:1 text is currently DARK.** The conductor is a pull-model voice and text has no reflection bar, so the channel was a broken half-experience (conversation, no capture). `routeInboundMessage` drops normal inbounds silently unless `TEXT_MESSAGING_ENABLED=true` (env var in Vercel). STOP/START/HELP keyword handling stays live above the gate (CTIA compliance is never gated). Re-enable only after the text capture rebuild. The group facilitator (Linq) is separate and unaffected.

### Shared pipeline (`persona-pipeline.ts`)

Decision logic shared by both channels lives here:

- `loadConversationContext()` — parallel DB reads, message mapping, derived flags, meter state
- `buildPromptOptionsFromContext()` — canonical context → prompt options mapping
- `fireBackgroundExtraction()` — async extraction (background, non-blocking)
- `handleCrisisDetection()` — crisis phrase detection + 988 resource append + safety logging
- `buildCheckpointMeta()` — checkpoint metadata shape (used by the compose route)
- `insertCheckpointActionMessage()` — canonical system messages for confirm/reject/refine
- `resolveConversationMode()` — parse-only mode resolution (situation / guided-intake / upload)
- `resolveReflectionMeter()` / `reflectionMeterFill()` — the one meter resolution

Pure functions shared from `call-persona.ts`: `mapSystemMessages()`, `applySlidingWindow()`, `detectCrisisInUserMessage()`.

### What differs by channel (intentional)

| Concern | Web | Text (dark, pending rebuild) |
|---------|-----|------|
| Delivery | Streaming SSE (`anthropicStream`) | Blocking (`anthropicFetch`) |
| Auth | Supabase session | Phone number lookup |
| Capture | Reflection meter → compose → confirm | None (the gap that got it gated off) |
| Guest prompt auth | Yes (`promptAuth` flag) | No |

### Rules for adding features

1. **Check `persona-pipeline.ts` first.** If logic could apply to both channels, it belongs there. Not in `call-persona.ts` or `persona-bridge.ts`.
2. **Channel-specific code stays in the channel.** Streaming, delimiter buffers — delivery concerns, not pipeline logic.
3. **New prompt fields go through `buildPromptOptionsFromContext()`.**
4. **New checkpoint actions go through `insertCheckpointActionMessage()`.** Never hardcode system message strings — they must stay in sync with `mapSystemMessages()`.
5. **Test both paths after pipeline changes.** Text is dark but its code still compiles and will come back.

## Extraction Layer Detail

The extraction layer is a Sonnet call that runs per turn and maintains Jove's working memory. After the July 2026 schema trim it tracks only what the pull model actually reads:

- **Language bank**: The user's exact charged phrases, not paraphrased. Feeds the composer so entries sound like the user.
- **Depth**: Where the conversation currently sits — surface, behavior, feeling, mechanism, origin. Drives the meter's fill.
- **Current thread**: One-sentence summary of what's underneath the surface topic. Briefs the composer.
- **Distinct contexts** (the one surviving `checkpoint_gate` field): how many separate life contexts the pattern has shown up in. The composer reads it to soften over-claiming headlines.
- **Clinical flag**: none / caution / crisis. Crisis hides the meter.
- **Sage brief**: 3–5 sentence field note. Briefs the composer.

**Input**: last `EXTRACTION_MESSAGE_WINDOW` (12) messages plus previous extraction state. The cumulative state carries earlier signals forward.

**Two consumers, neither on the live turn**: the reflection meter (depth → fill) and the save-time composer (`composeManualEntry` reads language bank, depth, thread, distinct contexts, sage brief). Jove's own reply never sees extraction output.

## Extraction State Shape

Stored as JSONB in `conversations.extraction_state`. Canonical type is `ExtractionState` in `extraction.ts` — this summary is for orientation before modifying.

```
{
  language_bank: [                   // cumulative; low-charge entries evicted at a cap
    { phrase: string, context: string, charge: "low" | "medium" | "high",
      layers: number[] }             // layers: legacy numbering, carried not read
  ],
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin",
  current_thread: string,            // one-sentence summary of what's underneath
  checkpoint_gate: {
    distinct_contexts: number        // the only surviving gate field — composer input, not a gate
  },
  clinical_flag: { active: boolean, level: "none" | "caution" | "crisis", note: string },
  sage_brief: string                 // 3-5 sentence field note for the composer
}
```

Do not add fields without checking this structure first. The extraction prompt must be updated in sync with any shape change — the extractor generates exactly these fields, and stale prompt sections make it burn output tokens on dead data.

## Capture Lifecycle (the pull model)

1. **Jove signals landed.** When Jove judges the insight has genuinely landed, its message ends with `---reflection-ready---` (stripped before display, persisted as `metadata.reflection_landed` on the message row). This is the meter's ONLY readiness source — Jove's in-conversation judgment, not a score.
2. **The bar lights.** `resolveReflectionMeter` returns `ready: true`; the header colours. Readiness latches on the client — it survives until a confirmed save clears it. Nothing else happens. If the user keeps talking, the conversation just continues.
3. **The user taps** → `POST /api/checkpoint/compose`. If a still-pending composed entry already exists, it returns that one (idempotent re-tap). Otherwise `composeManualEntry()` (Opus) drafts the entry: user's own words (language bank), anchored near-verbatim to the working version the user already approved in the open (`anchorApprovedVersion: true`), section + tags chosen by composition, plus the compressed `summary`/`key_words` used later for Manual-context compression. Composer failure → retryable 502; the meter stays full and the user can re-tap.
4. **The overlay opens** with the draft. The user edits anything, confirms, or discards.
5. **Confirm** → `POST /api/checkpoint/confirm` — a plain DB write, no model call, instant. Inserts the `manual_entries` row, marks the source message's `checkpoint_meta.status = "confirmed"`, inserts the system message, recharges the meter. "Close but not quite" refinement re-composes and increments `refinement_count`.

**System messages in history**: rows like "[User confirmed the checkpoint]" are mapped to synthetic user messages so Jove sees the outcome naturally.

**After a save**: Jove acknowledges in one line and offers three chips (Start somewhere new / Keep this thread going / Take a break) via the `---chips---` marker. The save is real — the conductor prompt forbids Jove from denying or re-rendering it.

## Critical Invariants

Every one represents a bug that either already happened or would be catastrophic.

- **Jove never saves.** No code path lets the model trigger a Manual write. The compose route runs only from a user tap; confirm only from a user action. If you find yourself adding a model-triggered save, stop — that's the push model, deleted deliberately.
- The `---reflection-ready---` marker is the meter's only readiness source, and the conductor prompt's instruction to emit it is save-guarded in the admin editor (an edit that deletes it is rejected — `CONDUCTOR_REQUIRED_FRAGMENTS`). Same for the 988/741741 crisis lines and `---chips---`.
- `composed_content` must never be null on confirmed entries. The compose route populates it before the overlay ever shows; `confirmCheckpoint()` falls back to raw message content as a safety net.
- Crisis text must never appear in manual entries.
- Crisis (`clinical_flag.level === "crisis"`) hides the reflection meter entirely (`resolveReflectionMeter` returns null) — no capture affordance during a crisis turn. Three crisis layers overall: the hard-coded phrase detector (`detectCrisisInUserMessage` + `handleCrisisDetection`, appends 988 resources), the prompt-side crisis section (catches softened signals the phrase list misses), and the meter hide.

## Manual Entries

There is one entry shape. Sections can hold many entries — no per-section cap, no type discriminator. Composition (Opus) picks the section — always one of the five (an off-spec/missing pick defaults to `relationships`, logged); composition writes the draft; the user edits and confirms. Entries carry `section` (one of the five slugs — the structural key) plus `tags`, with `layer` a frozen nullable legacy column. No held group, no sixth section (parking killed, ADR-051). See rules.md "Checkpoint and Manual Entry Voice" for composition quality rules and word count range (80–300).

## Jove Prompt Assembly

The 1:1 system prompt is three blocks, built by `buildSystemPromptBlocks()` (`system-prompt.ts`), in this order:

1. **`tier1` — the conductor prompt.** The whole personality, one document. Resolution: the admin override when one is enabled, else the `CONDUCTOR_PROMPT` code constant (`options.voiceOverrides?.conductorPrompt ?? CONDUCTOR_PROMPT`). Stable across turns → sits at the front of the cached prefix.
2. **`staticContext` — the Manual so far.** Older confirmed entries compressed to one line each (headline + summary + key words, generated at compose time). Stable within a session; the Anthropic `cache_control` marker sits here. See "Manual Context Compression" in CLAUDE.md — never compress the current session's entries.
3. **`dynamic` — this session.** Current-conversation entries in full text + session context (returning user, session count, running summary). Changes every turn; never cached.

That's the whole prompt. There is no tier system, no per-persona voice assembly, no conditional block ladder — all deleted with the rebuilt/legacy voice worlds (2026-07-06). The four ND persona-delta files exist but are dormant (settled keep — do not delete, do not re-wire without a decision).

**Editing the voice**: `/admin/prompt-architecture` ("Jove's Prompt") edits the conductor prompt live via the `conductor_prompt` key in `persona_voice_overrides` — no deploy, next-turn effect, Reset returns to code. Saves that drop a protected line (crisis resources, the two hidden markers) are rejected at the API (`validateConductorPromptEdit`). The small operational strings (openers, post-confirm line, composer entry bar) are separate override keys edited in the admin Voice panel.

**Group chat is separate**: `buildGroupPrompt()` (facilitator voice, Linq) is self-contained and shares nothing with the 1:1 prompt except the Manual entries it references. Group flows never compress Manual context.

**Prompt caching**: content-addressed (`cache_control: { type: "ephemeral" }`). Editing the conductor prompt (admin or code) invalidates the cache once; it re-primes on the following turn. No version constant involved.

## Three Supabase Clients

The codebase uses three Supabase clients with distinct roles. Using the wrong one causes either auth failures or RLS violations.

- **Server client** (`lib/supabase/server.ts`): Auth verification only. Calls `getUser()`. Never does data operations.
- **Admin client** (`lib/supabase/admin.ts`): All DB writes in API routes. Uses service role key, bypasses RLS.
- **Browser client** (`lib/supabase/client.ts`): Client-side auth and initial data reads through RLS.

Pattern: server client authenticates the user, admin client does all database work.

## SSE Streaming Protocol

Chat streaming uses three event types:

- `text_delta`: streamed token by token; the client accumulates into a buffer.
- `message_complete`: closes each message. Carries `messageId`, `conversationId`, `cleanContent`, `mode`, optional `chips` / `sections` / `startSituationOffer` (guided-intake UI flags), and `reflectionMeter` (`{ fill, ready }`, `null` = hide on crisis, absent = meter off for this surface). There is no `checkpoint` field — capture never rides the stream (removed 2026-07-06).
- `error`: emitted on failure, stream closes.

Client parses via `parseSSEStream` (`src/lib/utils/sse-parser.ts`). Text is buffered and the bubble appears at `message_complete`, not incrementally.

## Error Handling Pattern

API routes follow a consistent pattern:
- Auth failures return 401. The client treats any 401 as a redirect to `/login`.
- Streaming routes must emit an `error` SSE event and close the stream cleanly on failure. Never leave a stream hanging.
- The compose route returns a retryable 502 on composer failure (the client keeps the meter full so the user can re-tap).
- All DB operations use the admin client. Errors from it are connection/query issues, not permission issues.
- Non-streaming routes return JSON with `{ error: "human-readable message" }` and an appropriate status code.

## Checkpoint Meta Shape

Not enforced at the DB layer (untyped JSONB on `messages`). Canonical write-side shape is `CheckpointMeta` in `persona-pipeline.ts` (built by `buildCheckpointMeta()`, written by the compose route).

```json
{
  "section": "<slug>" | null,
  "tags": ["..."],
  "name": "The Proposed Name" | null,
  "status": "pending" | "confirmed" | "rejected" | "refined",
  "composed_content": "polished manual entry text" | null,
  "composed_name": "headline name" | null,
  "changelog": "what changed from previous version" | null,
  "composed_summary": "one-sentence summary" | null,
  "composed_key_words": ["..."] | null,
  "refinement_count": <number>
}
```

## Manual Entry Accumulation

Sections can hold many entries. Confirmation is always an insert — no upsert, no per-section cap, no replacement rule. (No edit/version flow; the unused `manual_changelog` table was dropped 2026-06-04 — ADR-045 sibling cleanup.)

## Feature Gates & Live Tuning

Two runtime-config tables, both read once per turn inside `loadConversationContext`'s parallel batch, both failing open to code defaults:

- **`feature_gates`** — global on/off switches (admin Health section). Live keys: `persona_deltas`, `situation`, `guided_intake`, `upload`, `extraction_brief`. The three mode gates' job is hiding entry doors on the home screen (`/api/onboarding-status`) — they no longer clamp the server-side conversation mode. `extraction_brief` OFF skips the extraction call entirely (debug only). TEMPORARY scaffolding with a documented deletion condition.
- **`persona_voice_overrides`** — admin-editable voice text (see Prompt Assembly above). `checkpoint_tuning` (same pattern) carries the one live dial: `cooldownTurns`, the meter's post-save recharge.

## Migration Protocols

Schema changes go through the Supabase CLI with migrations committed to `supabase/migrations/`. The dashboard SQL editor is for **read-only exploration only** — never for DDL. This was changed on 2026-04-17 after silent drift caused a production checkpoint-confirm bug; see `docs/reference/checkpoint-hardening-plan.md` Track 1.

The flow:

1. Create a new timestamped migration file: `supabase migration new <short_name>` (generates `supabase/migrations/<timestamp>_<short_name>.sql`).
2. Write the DDL in that file. Make it idempotent (`IF NOT EXISTS`, `IF EXISTS`, `DO $$ … $$` guards) so re-running is safe.
3. Preview what would change: `supabase db diff`.
4. Apply locally (if you have `supabase start` running): `supabase db reset` to wipe and reapply all migrations, or `supabase db push` to apply just the unapplied ones.
5. Commit the migration file.
6. On merge to main, CI runs `supabase db push` to apply to prod — the merge applies immediately, so check for timestamp collisions with parallel branches first.

Rules:
- **Always add new columns as nullable or with a default value.** Non-nullable columns without defaults will break existing rows.
- **Test RLS policy implications before deploying.** A new column may need to be included in existing SELECT policies; a new table needs its own policies.
- **If adding a new table, add RLS policies and enable RLS in the same migration.** A table without RLS is open to any authenticated user.
- **If the change affects the extraction state shape, update `extraction.ts` types AND the extraction prompt in sync.** These must always match.
- **After a migration merges, update `docs/state.md`** with what changed, same as any feature.
- **Never edit the 20260417000000 baseline squash after it's merged.** It's a point-in-time snapshot. Drift corrections go in new migrations.
- **Never grant admin privileges in a migration.** Admin status is set by hand in the dashboard against a single email. See `CLAUDE.md` admin safety rule.

## Versioning

One version constant in `src/lib/version.ts`: `APP_VERSION`, surfaced in the desktop footer badge. Bump minor for features, patch for fixes — once per branch, on the first commit that touches `src/`. On merge conflicts, take the higher value. Do not bump unless asked.

There is no persona-prompt version constant — prompt caching is content-addressed (see Prompt Assembly).

## Onboarding Flow

`/login` renders the login form directly (`LoginScreen`) — no entry/splash step. The marketing landing at `/` is the brand moment; middleware redirects authenticated users from `/login` to `/app`.

First-time onboarding is a single consent screen, `SeedScreen`: the "what this is, and isn't" prose, an 18+ age checkbox, and a "Begin" button. Two paths through it:
- **Guest:** on Begin, calls `signInAnonymously()` and `router.push("/app")`.
- **Post-login** (already authenticated, via `PostLoginOnboarding`): writes `profiles.onboarding_completed_at` and calls `onComplete()`.

Onboarding completion lives in the DB column `profiles.onboarding_completed_at` (not localStorage); `/api/onboarding-status` reads it — and also serves the per-door gate flags for the home screen.

Guest-to-real conversion: after the first confirmed entry, the backend detects `user.is_anonymous` and returns `promptAuth: true`. AuthPromptModal handles email (`updateUser`) or Google (`linkIdentity` with the `mw_pending_conversion` localStorage flag).

## Storage Keys

Do not create keys that conflict with these. All live keys use the `mw_` prefix (the former `mantle_*` keys are dead — migrated once via `mw_keys_migrated`).

localStorage: `mw_pending_conversion` (flags Google OAuth redirect in progress), `mw_first_session_completed` (first-session marker), `mw_signin_banner_dismissed`, `mw_manual_intro_seen`, `mw_sidebar_collapsed`.  
sessionStorage: `mw_active_view`, `mw_active_conversation`, `mw_new_session` (in-app view/session state).

Onboarding completion and the age gate are no longer localStorage keys — completion is the DB column, and the age check is in-component state.

## Admin Access

Admin role is set via JWT custom claims (`app_metadata.role = "admin"`), managed only through direct SQL in the Supabase dashboard. The `is_admin()` Postgres function checks the JWT and powers all admin RLS policies. Admin *data* views (conversations, messages) are read-only and logged to `admin_access_logs`; admin *config* surfaces (feature gates, voice overrides, tuning, intake doors) write through their own validated PATCH routes. After granting/revoking admin, the user must log out and back in (existing sessions retain old claims for ~1 hour).

## Edge Runtime Gotchas

- Vercel Edge Runtime cannot use all Node.js APIs. Inbound text webhooks (`/api/webhooks/sendblue`, `/api/linq/webhook`) must use Node.js Runtime, not Edge.
- `ANTHROPIC_API_KEY` sometimes unavailable in Edge Runtime via `.env.local` alone during local dev. Workaround: `source <(grep ANTHROPIC_API_KEY .env.local) && ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx next dev`
- Vercel free tier kills functions at 10 seconds. Jove takes 5-8 seconds. Vercel Pro required for any real usage.

## Browser Verification in Agent Sessions

Agent sessions CAN verify auth-gated UI: log in as `devtest@test.com` / `testtest` via `/login` (admin-granted test account — see CLAUDE.md). Prefer this over asking the founder to verify manually. Caution: the shared Supabase backs dev too — never test writes that change live behavior for real users (e.g. saving a `conductor_prompt` override); test rejection paths instead. Use the mobile preset for user-facing UI (430px, the primary interface); note the desktop shell (≥1030px) may not render in the preview env.

## Dead Column

`conversations.calibration_ratings` exists in the schema but is never read or written. Ignore it.
