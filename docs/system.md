# system.md — How the System Works

> **Authority level**: Technical reference. Changes when architecture changes.  
> **Audience**: You (to understand the machine) and Claude Code agents (to avoid breaking it).  
> **What belongs here**: Architecture that spans multiple files, non-obvious coupling, invariants, gotchas. Not schema dumps or route tables — the agent reads those from code.

---

## The Pipeline (What Happens Every Turn)

When a user sends a message, three AI stages run. Two of them (extraction and Sage) run at the same time to avoid slowing down the response.

```
User message
  → Save to DB + parallel reads (history, manual, previous extraction state)
  → Two calls fire simultaneously:
      → EXTRACTION (Sonnet): analyzes the message, updates research brief, saves for NEXT turn
      → SAGE (Sonnet): uses PREVIOUS turn's extraction brief, streams response to user
  → After Sage finishes:
      → If Sage included a |||MANUAL_ENTRY||| block → skip classifier (Path A)
      → If not → run CLASSIFIER (Haiku) to check if response was a checkpoint (Path B)
  → message_complete event sent to frontend
```

**Why extraction runs in parallel**: Separating "analyze what the user said" from "respond to the user" produces better results than one prompt doing both. Running them in parallel means this separation adds zero wait time for the user.

**The one-turn lag**: Because extraction and Sage run simultaneously, Sage always uses the extraction brief from the *previous* turn, not the current one. This lag is negligible because extraction state is cumulative — the brief from turns 1-6 is nearly identical to the brief from turns 1-7 for the purpose of orienting Sage's response. Turn 1 has no extraction state at all.

**Extraction is fire-and-forget**: `runExtraction()` fires as a background Promise, never awaited. It writes to `conversations.extraction_state` (JSONB column) asynchronously. It never blocks Sage's stream.

## Multi-Channel Architecture (Web + Text)

Sage runs on two channels: web (streaming SSE) and text (Linq SMS, non-streaming). Both channels share a single pipeline — **do not duplicate pipeline logic per channel.**

### Shared pipeline (`sage-pipeline.ts`)

All Sage decision logic lives here and is imported by both paths:

- `loadConversationContext()` — parallel DB reads, message mapping, derived flags
- `buildPromptOptionsFromContext()` — canonical context → prompt options mapping
- `fireBackgroundExtraction()` — async extraction (background, non-blocking)
- `handleCrisisDetection()` — crisis phrase detection + 988 resource append
- `applyCheckpointGates()` — layer guards + turn-count suppression
- `buildCheckpointMeta()` — checkpoint metadata shape
- `insertCheckpointActionMessage()` — canonical system messages for confirm/reject/refine

Pure functions shared from `call-sage.ts`: `mapSystemMessages()`, `applySlidingWindow()`, `parseManualEntryBlock()`, `detectCrisisInUserMessage()`.

Checkpoint detection uses the same two paths on both channels: Path A (Sage outputs `|||MANUAL_ENTRY|||` block) and Path B (classifier fallback + Sonnet composition via `composeManualEntry()`).

### What differs by channel (intentional)

| Concern | Web | Text |
|---------|-----|------|
| Delivery | Streaming SSE (`anthropicStream`) | Blocking (`anthropicFetch`) |
| Auth | Supabase session | Phone number lookup |
| URL/transcript detection | Yes (`detectUrls`, `detectTranscript`) | No (SMS limitation) |
| Exploration mode | Yes (`explorationContext`) | No |
| Guest prompt auth | Yes (`promptAuth` flag) | No |
| Checkpoint confirmation | UI buttons → POST `/api/checkpoint/confirm` | Keyword interception (YES/NO/NOT QUITE) |
| Post-checkpoint | `callSage({ message: null })` streaming | `processTextMessage(null)` non-streaming |

### Rules for adding features

1. **Check `sage-pipeline.ts` first.** If logic could apply to both channels, it belongs there. Not in `call-sage.ts` or `sage-bridge.ts`.
2. **Channel-specific code stays in the channel.** Streaming, delimiter buffers, keyword detection — these are delivery concerns, not pipeline logic.
3. **New prompt fields go through `buildPromptOptionsFromContext()`.** Web can layer on channel-specific fields (exploration, transcript, URL) via spread. Text gets the base automatically.
4. **New checkpoint actions go through `insertCheckpointActionMessage()`.** Never hardcode system message strings — they must stay in sync with `mapSystemMessages()`.
5. **Test both paths after pipeline changes.** A change to `sage-pipeline.ts` affects web and text simultaneously.

## Extraction Layer Detail

The extraction layer is a Sonnet call that runs per turn and produces a structured research brief. It tracks:

- **Language bank**: The user's exact charged phrases, not paraphrased. What makes checkpoints feel personal.
- **Layer signals**: Per-layer progress from `none` → `emerging` → `explored` → `checkpoint_ready`. Only advances forward. Resets on a layer only after a checkpoint is confirmed on that layer.
- **Depth tracking**: Where the conversation currently sits — surface, behavior, feeling, mechanism, origin.
- **Checkpoint gate**: Quality assessment of whether enough material exists for a meaningful checkpoint. Based on material quality (concrete examples, mechanism, charged language), NOT turn count.
- **Pattern tracking**: When a layer's component is confirmed and the layer flips to pattern mode, extraction tracks chain elements (trigger, response, payoff, cost, internal experience) and a recurrence count.
- **Mode recommendation**: situation_led (default), direct_exploration (2+ layers confirmed), synthesis (all 5 confirmed). See rules.md "Conversation Modes" for what Sage does in each mode.
- **Sage brief**: 3-5 sentence field note orienting Sage for its next response.
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
      dimensions: string[],
      discovery_mode: "component" | "pattern"
    }
  },
  language_bank: [                   // cumulative across session
    { phrase: string, context: string, charge: "low" | "medium" | "high", layers: number[] }
  ],
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin",
  current_thread: string,            // one-sentence summary of what's underneath
  mode: "situation_led" | "direct_exploration" | "synthesis",
  checkpoint_gate: {
    ready: boolean,
    strongest_layer: number | null,
    target_type: "component" | "pattern",
    // ... criteria booleans (has_concrete_examples, has_mechanism, etc.)
  },
  pattern_tracking: {
    active: boolean,
    layer: number | null,
    label: string,
    chain_elements: string[],        // populated elements
    recurrence_count: number
  },
  confirmed_patterns: [              // archived after pattern confirmation
    { layer: number, name: string, chain_elements: string[] }
  ],
  sage_brief: string,                // 3-5 sentence field note
  next_prompt: string,               // 3-6 word input placeholder
  clinical_flag: { level: "none" | "caution" | "crisis" }
}
```

Do not add fields without checking this structure first. The extraction prompt must be updated in sync with any schema changes.

## Checkpoint Lifecycle

Checkpoints are the core mechanic: Sage reflects a pattern, the user confirms, and it writes to the manual. Two detection paths, both ending at the same confirmation flow.

**Path A (preferred) — Sage includes the manual entry inline:**
Sage appends a `|||MANUAL_ENTRY|||` block at the end of its response containing the polished manual text, layer, type, name, and changelog. A streaming delimiter buffer in `call-sage.ts` catches this block and prevents it from reaching the user. Classifier is skipped entirely. All metadata comes from Sage directly. See rules.md "Checkpoint and Manual Entry Voice" for the quality rules governing what goes in the entry.

**Path B (fallback) — Haiku classifier detects the checkpoint:**
When Sage doesn't produce a manual entry block, the Haiku classifier runs post-stream on every response. If it detects a checkpoint, `composeManualEntry()` (a separate Sonnet call) composes a polished manual entry from the conversational text plus the language bank. This ensures `composed_content` is populated at creation time.

**On confirmation:**
1. `confirmCheckpoint()` reads `composed_content` from `checkpoint_meta` (always populated by Path A or B)
2. Archives existing layer content to `manual_changelog` if updating
3. Writes composed narrative to `manual_components`
4. Inserts system message "[User confirmed the checkpoint]"
5. If component confirmed: flips layer `discovery_mode` from "component" to "pattern"
6. If pattern confirmed: archives chain_elements to `confirmed_patterns`, resets `pattern_tracking`
7. No API call to Anthropic. Confirmation is instant.

**System messages in history**: System messages like "[User confirmed the checkpoint]" are mapped to synthetic user messages in conversation history so Sage sees them naturally. For example, the confirm message becomes "I confirmed that checkpoint. That resonates."

## Critical Invariants

These are the rules that prevent the highest-severity bugs. Every one represents a bug that either already happened or would be catastrophic.

- `composed_content` must NEVER be null on confirmed checkpoints. Three defenses: (1) Sage produces `|||MANUAL_ENTRY|||` block at turnCount > 1 (Path A), (2) `call-sage.ts` calls `composeManualEntry()` when classifier detects checkpoint without block (Path B), (3) `confirmCheckpoint()` falls back to raw message content as safety net.
- Crisis text must never appear in manual entries. Stripped in `confirmCheckpoint()` fallback path.
- `clinical_flag.level === "crisis"` blocks the checkpoint gate entirely (in `formatExtractionForSage`).
- Checkpoint gate is quality-based (concrete examples + mechanism + charged language), never turn-based.
- First-checkpoint gate is intentionally lighter to enable the teaching moment.
- First checkpoint on any layer is ALWAYS type "component". The TYPE RULE is enforced four ways: system prompt instruction → extraction `target_type` → hard guard in `call-sage.ts` → safety net in `confirmCheckpoint()`.

## Layer Discovery Rules

Each of the five manual layers goes through two phases:

1. **Component mode** (default): Extraction looks for broad material across the dimension. First checkpoint on the layer produces a component — an integrated portrait of how the person operates on that dimension.

2. **Pattern mode** (after component confirmation): `discovery_mode` flips to "pattern". Extraction now tracks chain elements for specific behavioral loops. Patterns require a parent component to exist. Max 2 patterns per layer, 10 total across the manual.

See rules.md "Checkpoint and Manual Entry Voice" for composition quality rules and word count requirements for both types.

**Pattern quality gate**: `has_trigger AND has_response AND (has_payoff OR has_cost)`. This is extraction's job (boolean classification). Recurrence confirmation (at least 2 distinct examples of the same loop) is Sage's job — it's a judgment call that a boolean classifier would get wrong regularly.

## Sage Prompt Assembly

The system prompt is built dynamically by `buildSystemPrompt()`. Different sections load based on conversation state. This table is the map:

| Prompt section | Loads when |
|---------------|-----------|
| Voice, Legal, Conversation Approach, Deepening, Adapting | Always |
| How to use extraction context | turnCount > 1 |
| Manual Entry Format (|||MANUAL_ENTRY||| instructions) | turnCount > 1 |
| Progress Signals | turnCount > 2 |
| First Message (3-path routing: questions / help starting / specific situation) | turnCount ≤ 1 AND new user |
| First Session | New user (no manual components, not returning) |
| Checkpoints, Composition Voice, Post-Checkpoint | checkpointApproaching OR returning user |
| First Checkpoint teaching moment | isFirstCheckpoint AND checkpointApproaching |
| Building Toward Signal | checkpointApproaching |
| Patterns (chain walk, recurrence, delivery, saturation) | Any layer has confirmed component (pattern-eligible) |
| Returning User | isReturningUser (has manual_components) |
| Readiness Gate | 3+ manual components confirmed |
| Confirmed Manual contents | Any manual components exist |
| Session Context (session count, previous summary) | Returning user |
| Exploration Focus | explorationContext provided (user clicked "Explore with Sage") |

**Key detail**: `isReturningUser` is determined by having `manual_components`, not by conversation count. `checkpointApproaching` fires when any layer signal is `emerging`, `explored`, or `checkpoint_ready` in the previous extraction state (1-turn lag applies).

**Planned: smsMode flag**: When MMS is built, a `smsMode: true` option in `buildSystemPrompt` will strip checkpoint and manual entry sections. Same Sage voice and depth, no manual building via text. If you see this flag in the code, do not remove it.

## Three Supabase Clients

The codebase uses three Supabase clients with distinct roles. Using the wrong one causes either auth failures or RLS violations.

- **Server client** (`lib/supabase/server.ts`): Auth verification only. Calls `getUser()`. Never does data operations.
- **Admin client** (`lib/supabase/admin.ts`): All DB writes in API routes. Uses service role key, bypasses RLS.
- **Browser client** (`lib/supabase/client.ts`): Client-side auth and initial data reads through RLS.

Pattern: server client authenticates the user, admin client does all database work.

## SSE Streaming Protocol

All streaming responses (chat and checkpoint confirm) use three event types:

- `text_delta`: Streamed token by token. The delimiter buffer suppresses `|||MANUAL_ENTRY|||` content from reaching the client.
- `message_complete`: Final event. Carries checkpoint data, `cleanContent` (text with manual entry block stripped), `nextPrompt` (extraction's suggested input placeholder), and `processingText`.
- `error`: Emitted on failure, stream closes.

Client parses via `parseSSEStream` in `src/lib/utils/sse-parser.ts`. Text is NOT streamed incrementally to the UI — it's buffered and shown in one shot after parsing completes.

## Error Handling Pattern

API routes follow a consistent pattern:
- Auth failures return 401. The client treats any 401 as a redirect to `/login`.
- Streaming routes (chat, checkpoint confirm) must emit an `error` SSE event and close the stream cleanly on failure. Never leave a stream hanging.
- All DB operations use the admin client. Errors from the admin client bypass RLS, so they're typically connection or query issues, not permission issues.
- Non-streaming routes return JSON with `{ error: "human-readable message" }` and an appropriate status code.

## Checkpoint Meta Shape

Not defined in schema.sql, only in code. Stored as JSONB on the `messages` table. Canonical definition is in the TypeScript types in `confirm-checkpoint.ts` — this is a convenience summary for quick reference.

```json
{
  "layer": 1-5,
  "type": "component" | "pattern",
  "name": "The Proposed Name" | null,
  "status": "pending" | "confirmed" | "rejected" | "refined",
  "composed_content": "polished manual entry text" | null,
  "composed_name": "headline name" | null,
  "changelog": "what changed from previous version" | null
}
```

## Manual Component Accumulation

- **Components**: Exactly 1 per layer per user (max 5 total). Upsert replaces existing. Enforced by partial unique index `unique_component_per_layer`.
- **Patterns**: Max 2 per layer per user. Same name replaces. 3rd pattern archives oldest to `manual_changelog`. Enforced by partial unique index `unique_pattern_name_per_layer`.
- Upsert uses select-then-insert/update (not `ON CONFLICT`) because partial unique indexes make standard upsert unreliable.

## Migration Protocols

There are no migration files in this repo. All schema changes are executed directly in the Supabase SQL Editor.

When changing the schema:
- Always add new columns as nullable or with a default value. Non-nullable columns without defaults will break existing rows.
- Test RLS policy implications before deploying. A new column may need to be included in existing SELECT policies, or a new table needs its own policies.
- If adding a new table, add RLS policies and enable RLS in the same migration. A table without RLS is open to any authenticated user.
- After deploying a schema change, update `docs/state.md` and verify the change in the Supabase dashboard.
- If the change affects the extraction state shape, update `extraction.ts` types AND the extraction prompt in sync. These must always match.

## Versioning

Two version constants in `src/lib/version.ts`: `APP_VERSION` (all `src/` except Sage prompts) and `SAGE_VERSION` (`system-prompt.ts` + `extraction.ts` only). Bump minor for features, patch for fixes. Once per branch, first commit that touches relevant files. On merge conflicts, take the higher value for each version independently. Do not bump unless asked.

## Onboarding Flow

Pre-auth flow on `/login`. Four views: entry → login → onboarding → seed.

New users go through info screens then a seed screen where they type their opening thought. The app calls `signInAnonymously()`, stores the seed text in `sessionStorage` (key: `mantle_seed_text`), and redirects to `/`. MainApp reads and removes the seed, sending it as the first message.

Guest-to-real conversion: After first checkpoint confirm, backend detects `user.is_anonymous` and returns `promptAuth: true` in SSE. AuthPromptModal handles email (`updateUser`) or Google (`linkIdentity` with `mantle_pending_conversion` localStorage flag).

## Storage Keys

Do not create keys that conflict with these. They control onboarding and auth flow.

localStorage: `mantle_onboarding_completed` (prevents re-showing onboarding), `mantle_age_confirmed` (legal age gate), `mantle_pending_conversion` (flags Google OAuth redirect in progress).  
sessionStorage: `mantle_seed_text` (seed text handoff from onboarding to MainApp, consumed and removed on use).

## Admin Access

Admin role is set via JWT custom claims (`app_metadata.role = "admin"`), managed only through direct SQL in the Supabase dashboard. The `is_admin()` Postgres function checks the JWT and powers all admin RLS policies. Admin routes are read-only. Every conversation and message view is logged to `admin_access_logs`. After granting/revoking admin, the user must log out and back in (existing sessions retain old claims for ~1 hour).

## Edge Runtime Gotchas

- Vercel Edge Runtime cannot use all Node.js APIs. SMS routes (`/api/sms/incoming`) must use Node.js Runtime, not Edge.
- `ANTHROPIC_API_KEY` sometimes unavailable in Edge Runtime via `.env.local` alone during local dev. Workaround: `source <(grep ANTHROPIC_API_KEY .env.local) && ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx next dev`
- Vercel free tier kills functions at 10 seconds. Sage takes 5-8 seconds. Vercel Pro required for any real usage.

## UI Preview Limitation

The preview browser cannot establish authenticated sessions. Auth-gated pages (session view, manual tab, settings, checkpoint cards) cannot be reached in preview. For auth-gated UI changes, tests + type check + build is sufficient — verify manually in the browser. Always use mobile preset for preview (430px max-width, the primary interface).

## Dead Column

`conversations.calibration_ratings` exists in the schema but is never read or written. Ignore it.
