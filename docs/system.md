# system.md — How the System Works

> **Authority level**: Technical reference. Changes when architecture changes.  
> **Audience**: You (to understand the machine) and Claude Code agents (to avoid breaking it).  
> **What belongs here**: Architecture that spans multiple files, non-obvious coupling, invariants, gotchas. Not schema dumps or route tables — the agent reads those from code.

---

## The Pipeline (What Happens Every Turn)

When a user sends a message, three AI stages run. Two of them (extraction and Jove) run at the same time to avoid slowing down the response.

```
User message
  → Save to DB + parallel reads (history, manual, previous extraction state)
  → Two calls fire simultaneously:
      → EXTRACTION (Sonnet): analyzes the message, updates research brief, saves for NEXT turn
      → JOVE (Sonnet): uses PREVIOUS turn's extraction brief, streams response to user
  → After Jove finishes:
      → CLASSIFIER (Haiku) decides if the response is a checkpoint
      → If checkpoint: composeManualEntry (Sonnet) writes the polished entry server-side
  → message_complete event sent to frontend
```

**Why extraction runs in parallel**: Separating "analyze what the user said" from "respond to the user" produces better results than one prompt doing both. Running them in parallel means this separation adds zero wait time for the user.

**The one-turn lag**: Because extraction and Jove run simultaneously, Jove always uses the extraction brief from the *previous* turn, not the current one. This lag is negligible because extraction state is cumulative — the brief from turns 1-6 is nearly identical to the brief from turns 1-7 for the purpose of orienting Jove's response. Turn 1 has no extraction state at all.

**Extraction is fire-and-forget**: `runExtraction()` fires as a background Promise, never awaited. It writes to `conversations.extraction_state` (JSONB column) asynchronously. It never blocks Jove's stream.

## Multi-Channel Architecture (Web + Text)

Jove runs on two channels: web (streaming SSE) and text (non-streaming). The text channel uses two providers: Sendblue for 1:1 SMS/iMessage and Linq for group facilitator — routed through the unified `src/lib/messaging/send.ts`. See ADR-035. Both channels share a single pipeline — **do not duplicate pipeline logic per channel.**

### Shared pipeline (`persona-pipeline.ts`)

All Jove decision logic lives here and is imported by both paths:

- `loadConversationContext()` — parallel DB reads, message mapping, derived flags
- `buildPromptOptionsFromContext()` — canonical context → prompt options mapping
- `fireBackgroundExtraction()` — async extraction (background, non-blocking)
- `handleCrisisDetection()` — crisis phrase detection + 988 resource append
- `applyCheckpointGates()` — layer guards + turn-count suppression
- `buildCheckpointMeta()` — checkpoint metadata shape
- `insertCheckpointActionMessage()` — canonical system messages for confirm/reject/refine

Pure functions shared from `call-persona.ts`: `mapSystemMessages()`, `applySlidingWindow()`, `detectCrisisInUserMessage()`.

Checkpoint detection runs on both channels via the same flow: Haiku classifier on every Jove response, then `composeManualEntry()` (Sonnet) when a checkpoint is detected.

### What differs by channel (intentional)

| Concern | Web | Text |
|---------|-----|------|
| Delivery | Streaming SSE (`anthropicStream`) | Blocking (`anthropicFetch`) |
| Auth | Supabase session | Phone number lookup |
| URL/transcript detection | Yes (`detectUrls`, `detectTranscript`) | No (SMS limitation) |
| Exploration mode | Yes (`explorationContext`) | No |
| Guest prompt auth | Yes (`promptAuth` flag) | No |
| Checkpoint confirmation | UI buttons → POST `/api/checkpoint/confirm` | Keyword interception (YES/NO/NOT QUITE) |
| Post-checkpoint | `callPersona({ message: null })` streaming | `processTextMessage(null)` non-streaming |

### Rules for adding features

1. **Check `persona-pipeline.ts` first.** If logic could apply to both channels, it belongs there. Not in `call-persona.ts` or `persona-bridge.ts`.
2. **Channel-specific code stays in the channel.** Streaming, delimiter buffers, keyword detection — these are delivery concerns, not pipeline logic.
3. **New prompt fields go through `buildPromptOptionsFromContext()`.** Web can layer on channel-specific fields (exploration, transcript, URL) via spread. Text gets the base automatically.
4. **New checkpoint actions go through `insertCheckpointActionMessage()`.** Never hardcode system message strings — they must stay in sync with `mapSystemMessages()`.
5. **Test both paths after pipeline changes.** A change to `persona-pipeline.ts` affects web and text simultaneously.

## Extraction Layer Detail

The extraction layer is a Sonnet call that runs per turn and produces a structured research brief. It tracks:

- **Language bank**: The user's exact charged phrases, not paraphrased. What makes checkpoints feel personal.
- **Layer signals**: Per-layer progress from `none` → `emerging` → `explored` → `checkpoint_ready`. Only advances forward. Resets on a layer only after a checkpoint is confirmed on that layer.
- **Depth tracking**: Where the conversation currently sits — surface, behavior, feeling, mechanism, origin.
- **Checkpoint gate**: Quality assessment of whether enough material exists for a meaningful checkpoint. Based on material quality (concrete examples, mechanism, charged language), NOT turn count.
- **Mode recommendation**: situation_led (default), direct_exploration (2+ layers confirmed), synthesis (all 5 confirmed). See rules.md "Conversation Modes" for what Jove does in each mode.
- **Jove brief**: 3-5 sentence field note orienting Jove for its next response.
- **Next prompt**: 3-6 word placeholder hint for the text input field.

**Input**: Last 6 messages only (3 exchanges) plus previous extraction state. The cumulative state carries all earlier signals forward.

**First-checkpoint exception**: A lighter quality bar applies when the user has never had a checkpoint confirmed. Requires 1 concrete example (vs 2), mechanism OR behavior-driver link (vs both). This exists because the first checkpoint is a teaching moment that needs to land early while still being substantive.

## Extraction State Shape

The extraction output is stored as JSONB in `conversations.extraction_state`. Canonical type is `ExtractionState` in `extraction.ts` — this summary is for quick reference so you know what fields exist before modifying.

```
{
  layers: {                          // one per layer (1-5)
    [layerId]: {
      signal: "none" | "emerging" | "explored" | "checkpoint_ready",
      material: string[],
      examples: string[],
      dimensions: string[]
    }
  },
  language_bank: [                   // cumulative across session
    { phrase: string, context: string, charge: "low" | "medium" | "high", layers: number[] }
  ],
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin",
  current_thread: string,            // one-sentence summary of what's underneath
  mode: "situation_led" | "direct_exploration" | "synthesis",
  checkpoint_gate: {
    concrete_examples: number,
    has_mechanism: boolean,
    has_charged_language: boolean,
    has_behavior_driver_link: boolean,
    strongest_layer: number | null
  },
  sage_brief: string,                // 3-5 sentence field note
  next_prompt: string,               // 3-6 word input placeholder
  clinical_flag: { level: "none" | "caution" | "crisis" }
}
```

Do not add fields without checking this structure first. The extraction prompt must be updated in sync with any schema changes.

## Checkpoint Lifecycle

Checkpoints are the core mechanic: Jove reflects something the user has shown, the user confirms, and it writes to the manual. The Haiku classifier runs post-stream on every Jove response. If it flags the response as a checkpoint, `composeManualEntry()` (a separate Sonnet call) composes a polished manual entry from the conversational text plus the language bank. `composed_content` is always populated before confirmation.

**On confirmation:**
1. `confirmCheckpoint()` reads `composed_content` from `checkpoint_meta`
2. Inserts a new row in `manual_entries` (no upsert — layers can hold many entries)
3. Updates the source message's `checkpoint_meta.status` to "confirmed"
4. Inserts system message "[User confirmed the checkpoint]"
5. No API call to Anthropic. Confirmation is instant.

**System messages in history**: System messages like "[User confirmed the checkpoint]" are mapped to synthetic user messages in conversation history so Jove sees them naturally. For example, the confirm message becomes "I confirmed that checkpoint. That resonates."

## Critical Invariants

These are the rules that prevent the highest-severity bugs. Every one represents a bug that either already happened or would be catastrophic.

- `composed_content` must NEVER be null on confirmed checkpoints. `composeManualEntry()` always runs server-side after the classifier flags a checkpoint, so `checkpoint_meta.composed_content` is populated before the confirmation card is shown. `confirmCheckpoint()` falls back to raw message content as a safety net.
- Crisis text must never appear in manual entries.
- `clinical_flag.level === "crisis"` blocks the checkpoint gate entirely (in `formatExtractionForSage` and the server-side `validateMaterialQuality` gate).
- Checkpoint gate is quality-based (concrete examples + mechanism + charged language), never turn-based.
- First-checkpoint gate is intentionally lighter to enable the teaching moment.

## Manual Entries

There is one entry shape. Layers can hold many entries — there is no per-layer cap, no type discriminator, no pattern/entry split. The classifier picks the strongest layer; composition writes the entry; the user confirms. See rules.md "Checkpoint and Manual Entry Voice" for composition quality rules and word count range (80–300).

## Jove Prompt Assembly

The system prompt is built dynamically by `buildSystemPrompt()`. Different sections load based on conversation state. This table is the map:

| Prompt section | Loads when |
|---------------|-----------|
| Voice, Legal, Conversation Approach, Deepening, Adapting | Always |
| How to use extraction context | turnCount > 1 |
| Progress Signals | turnCount > 2 |
| First Message (3-path routing: questions / help starting / specific situation) | turnCount ≤ 1 AND new user |
| First Session | New user (no manual entries, not returning) |
| Checkpoints, Composition Voice, Post-Checkpoint | checkpointApproaching OR returning user |
| First Checkpoint teaching moment | isFirstCheckpoint AND checkpointApproaching |
| Building Toward Signal | checkpointApproaching |
| Returning User | isReturningUser (has manual entries) |
| Readiness Gate | 3+ manual entries confirmed |
| Confirmed Manual contents | Any manual entries exist |
| Session Context (session count, previous summary) | Returning user |
| Exploration Focus | explorationContext provided (user clicked "Explore with Jove") |

**Key detail**: `isReturningUser` is determined by having `manual_entries`, not by conversation count. `checkpointApproaching` fires when any layer signal is `emerging`, `explored`, or `checkpoint_ready` in the previous extraction state (1-turn lag applies).

**Planned: smsMode flag**: When MMS is built, a `smsMode: true` option in `buildSystemPrompt` will strip checkpoint and manual entry sections. Same Jove voice and depth, no manual building via text. If you see this flag in the code, do not remove it.

## Three Supabase Clients

The codebase uses three Supabase clients with distinct roles. Using the wrong one causes either auth failures or RLS violations.

- **Server client** (`lib/supabase/server.ts`): Auth verification only. Calls `getUser()`. Never does data operations.
- **Admin client** (`lib/supabase/admin.ts`): All DB writes in API routes. Uses service role key, bypasses RLS.
- **Browser client** (`lib/supabase/client.ts`): Client-side auth and initial data reads through RLS.

Pattern: server client authenticates the user, admin client does all database work.

## SSE Streaming Protocol

All streaming responses (chat and checkpoint confirm) use three event types:

- `text_delta`: Streamed token by token directly to the client.
- `message_complete`: Final event. Carries checkpoint data, `nextPrompt` (extraction's suggested input placeholder), and `processingText`.
- `error`: Emitted on failure, stream closes.

Client parses via `parseSSEStream` in `src/lib/utils/sse-parser.ts`. Text is NOT streamed incrementally to the UI — it's buffered and shown in one shot after parsing completes.

## Error Handling Pattern

API routes follow a consistent pattern:
- Auth failures return 401. The client treats any 401 as a redirect to `/login`.
- Streaming routes (chat, checkpoint confirm) must emit an `error` SSE event and close the stream cleanly on failure. Never leave a stream hanging.
- All DB operations use the admin client. Errors from the admin client bypass RLS, so they're typically connection or query issues, not permission issues.
- Non-streaming routes return JSON with `{ error: "human-readable message" }` and an appropriate status code.

## Checkpoint Meta Shape

Not enforced at the DB layer (stored as untyped JSONB on the `messages` table). Canonical definition is in the TypeScript types in `confirm-checkpoint.ts` — this is a convenience summary for quick reference.

```json
{
  "layer": 1-5,
  "name": "The Proposed Name" | null,
  "status": "pending" | "confirmed" | "rejected" | "refined",
  "composed_content": "polished manual entry text" | null,
  "composed_name": "headline name" | null,
  "changelog": "what changed from previous version" | null
}
```

## Manual Component Accumulation

Layers can hold many entries. Confirmation is always an insert — there is no upsert, no per-layer cap, no replacement rule. The `manual_changelog` table is reserved for explicit edits to existing entries (current write paths do not exercise it).

## Migration Protocols

Schema changes go through the Supabase CLI with migrations committed to `supabase/migrations/`. The dashboard SQL editor is for **read-only exploration only** — never for DDL. This was changed on 2026-04-17 after silent drift caused a production checkpoint-confirm bug; see `docs/checkpoint-hardening-plan.md` Track 1.

The flow:

1. Create a new timestamped migration file: `supabase migration new <short_name>` (generates `supabase/migrations/<timestamp>_<short_name>.sql`).
2. Write the DDL in that file. Make it idempotent (`IF NOT EXISTS`, `IF EXISTS`, `DO $$ … $$` guards) so re-running is safe.
3. Preview what would change: `supabase db diff`.
4. Apply locally (if you have `supabase start` running): `supabase db reset` to wipe and reapply all migrations, or `supabase db push` to apply just the unapplied ones.
5. Commit the migration file, open a PR.
6. On merge to main, CI runs `supabase db push` to apply to prod (see Track 1 CI step for the GH Action).

Rules:
- **Always add new columns as nullable or with a default value.** Non-nullable columns without defaults will break existing rows.
- **Test RLS policy implications before deploying.** A new column may need to be included in existing SELECT policies; a new table needs its own policies.
- **If adding a new table, add RLS policies and enable RLS in the same migration.** A table without RLS is open to any authenticated user.
- **If the change affects the extraction state shape, update `extraction.ts` types AND the extraction prompt in sync.** These must always match.
- **After a migration merges, update `docs/state.md`** with what changed, same as any feature.
- **Never edit the 20260417000000 baseline squash after it's merged.** It's a point-in-time snapshot. Drift corrections go in new migrations.
- **Never grant admin privileges in a migration.** Admin status is set by hand in the dashboard against a single email. See `CLAUDE.md` admin safety rule.

## Versioning

Two version constants in `src/lib/version.ts`: `APP_VERSION` (all `src/` except persona prompts) and `PERSONA_VERSION` (`system-prompt.ts` + `extraction.ts` only). Bump minor for features, patch for fixes. Once per branch, first commit that touches relevant files. On merge conflicts, take the higher value for each version independently. Do not bump unless asked.

## Onboarding Flow

Pre-auth flow on `/login`. Four views: entry → login → onboarding → seed.

New users go through info screens then a seed screen where they type their opening thought. The app calls `signInAnonymously()`, stores the seed text in `sessionStorage` (key: `mywalnut_seed_text`), and redirects to `/`. MainApp reads and removes the seed, sending it as the first message.

Guest-to-real conversion: After first checkpoint confirm, backend detects `user.is_anonymous` and returns `promptAuth: true` in SSE. AuthPromptModal handles email (`updateUser`) or Google (`linkIdentity` with `mywalnut_pending_conversion` localStorage flag).

## Storage Keys

Do not create keys that conflict with these. They control onboarding and auth flow.

localStorage: `mywalnut_onboarding_completed` (prevents re-showing onboarding), `mywalnut_age_confirmed` (legal age gate), `mywalnut_pending_conversion` (flags Google OAuth redirect in progress).  
sessionStorage: `mywalnut_seed_text` (seed text handoff from onboarding to MainApp, consumed and removed on use).

## Admin Access

Admin role is set via JWT custom claims (`app_metadata.role = "admin"`), managed only through direct SQL in the Supabase dashboard. The `is_admin()` Postgres function checks the JWT and powers all admin RLS policies. Admin routes are read-only. Every conversation and message view is logged to `admin_access_logs`. After granting/revoking admin, the user must log out and back in (existing sessions retain old claims for ~1 hour).

## Edge Runtime Gotchas

- Vercel Edge Runtime cannot use all Node.js APIs. SMS routes (`/api/sms/incoming`) must use Node.js Runtime, not Edge.
- `ANTHROPIC_API_KEY` sometimes unavailable in Edge Runtime via `.env.local` alone during local dev. Workaround: `source <(grep ANTHROPIC_API_KEY .env.local) && ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx next dev`
- Vercel free tier kills functions at 10 seconds. Jove takes 5-8 seconds. Vercel Pro required for any real usage.

## UI Preview Limitation

The preview browser cannot establish authenticated sessions. Auth-gated pages (session view, manual tab, settings, checkpoint cards) cannot be reached in preview. For auth-gated UI changes, tests + type check + build is sufficient — verify manually in the browser. Always use mobile preset for preview (430px max-width, the primary interface).

## Dead Column

`conversations.calibration_ratings` exists in the schema but is never read or written. Ignore it.
