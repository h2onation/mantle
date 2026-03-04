# Mantle

Mantle is a mobile-first web app where an AI conversationalist called Sage builds a five-layer behavioral model ("User Manual") through deep conversation — nothing enters the manual unless the user confirms it.

- **Repo**: https://github.com/h2onation/mantle.git
- **Live URL**: Not yet deployed (or configured entirely via Vercel dashboard — no project-level config files exist)
- **Supabase project ref**: `nkmperzwcmttdkxwhbiv`
- **Last verified**: 2026-02-27

## Worktree Setup

Every new worktree needs `.env.local`. Always run `ln -s /Users/jeffwaters/mantle/.env.local .env.local` when creating a new worktree. This is the first step before anything else.

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run test` — run all tests (113 tests, <1s, zero API cost)
- `npm run test:watch` — run tests in watch mode during development
- `npm run build` — production build (zero errors as of last verification)
- `npx tsc --noEmit` — type check (zero errors)
- `POST /api/dev-reset` — delete all user data (conversations, messages, manual_components). Does NOT delete profile or auth user. Client calls this then `localStorage.clear()` + `window.location.reload()`.

## Development Workflow

- **Always test and type-check after edits**: Run `npm run test` after any logic changes. Run `npx tsc --noEmit` after any code changes. Run `npm run build` before committing. The pre-commit hook enforces tests + build automatically.
- **Commit incrementally**: Commit working changes after each verified feature or fix — don't batch everything at the end of a session.
- **Anthropic model IDs**: Always verify exact model version strings. Current models: `claude-sonnet-4-6` (Sage), `claude-haiku-4-5-20251001` (classifier/summary). Do not guess date suffixes.
- **Edge Runtime env vars**: `ANTHROPIC_API_KEY` sometimes not available in Edge Runtime via `.env.local` alone. Workaround: `source <(grep ANTHROPIC_API_KEY .env.local) && ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx next dev`
- **Writing .env.local**: This is a local development file — write to it without hesitation when setting up credentials.
- **Non-interactive CLIs**: When using `create-next-app` or similar scaffolding CLIs, always use non-interactive flags (e.g., `--yes`, `--typescript`, `--tailwind`, `--app`, `--no-git`) to prevent commands from hanging.

## Testing

**Vitest** with `vite-tsconfig-paths`. Config at `vitest.config.ts`. 113 tests, runs in <1s, zero API cost (all Anthropic/Supabase calls mocked).

**Convention**: Test files colocated next to source as `*.test.ts`. Test helpers in `src/lib/__test-helpers__/`.

**Test coverage by file**:
| Test file | Tests | What it catches |
|-----------|-------|----------------|
| `src/lib/sage/call-sage.test.ts` | 30 | Delimiter buffer state machine, sliding window, history mapping, manual entry parsing |
| `src/lib/sage/system-prompt.test.ts` | 24 | Prompt conditional blocks (first user, returning, exploration, checkpoints) |
| `src/lib/sage/extraction.test.ts` | 18 | Checkpoint gate thresholds (standard vs first-checkpoint), language bank filtering |
| `src/lib/sage/classifier.test.ts` | 10 | JSON cleaning, layer-null invalidation, fallback behavior |
| `src/lib/utils/sse-parser.test.ts` | 9 | Stream chunking, malformed JSON, null body |
| `src/lib/sage/confirm-checkpoint.test.ts` | 8 | Pattern limits, content priority, system message insertion |
| `src/lib/sage/generate-summary.test.ts` | 5 | Transcript labeling |
| `src/lib/utils/format.test.ts` | 4 | Date formatting |

**Extracted pure functions** (exported from their source files, used internally + in tests):
- `call-sage.ts`: `applySlidingWindow()`, `mapSystemMessages()`, `createDelimiterBuffer()`, `parseManualEntryBlock()`
- `classifier.ts`: `cleanAndParseClassification()`
- `generate-summary.ts`: `buildTranscript()`

**Rules for writing tests going forward**:
- When modifying a file that has a `.test.ts` companion, update or add tests for the changed behavior.
- When extracting new pure functions from I/O-heavy code, write tests for them.
- All Anthropic API calls must be mocked — never consume real tokens in tests.
- Run `npm run test` after logic changes to verify nothing broke.

## Stack

- **Next.js 14.2.15**, App Router
- **Supabase**: Postgres + Auth (magic link + Google OAuth). RLS on all tables. Supabase project ref `nkmperzwcmttdkxwhbiv`.
- **Anthropic API** via raw `fetch` (no SDK, `@anthropic-ai/sdk` was removed). Three model usages:
  - `claude-sonnet-4-6` — Sage conversation (in `call-sage.ts`)
  - `claude-sonnet-4-6` — Extraction pre-pass (in `extraction.ts`, runs in parallel with Sage)
  - `claude-haiku-4-5-20251001` — classifier (in `classifier.ts`) and session summary (in `generate-summary.ts`)
- **Styling**: All inline `style={{}}`. No CSS classes in components. CSS custom properties in `globals.css`. Tailwind is installed but only its `@tailwind base/components/utilities` directives are used.
- **Fonts**: Instrument Serif, DM Sans, JetBrains Mono via `next/font/google`
- **TypeScript** everywhere — all new files must be `.ts`/`.tsx` with proper types.
- **No Vercel config files** in repo — no `vercel.json`, no `.vercel/` directory

## Design Conventions

- **Mobile-only** — no desktop layout exists. Everything renders in a fixed mobile shell.
- **Inline styles only** — never add `className` to components. Use `style={{}}` with CSS custom properties.
- **Font usage**: Mono 7-9px uppercase with letter-spacing for labels/meta. Serif 16-22px for body text, headlines, emotional content. Sans 13px for UI elements, conversational messages, buttons.
- **Color usage**: `--color-text` for primary, `--color-text-dim` for secondary, `--color-text-ghost` for tertiary/labels, `--color-divider` for borders.
- **Animations**: `sagePulse` for typing indicator, `checkpointFadeIn` for checkpoint cards. Both defined in `globals.css`.

## UI Verification

After making UI changes, take a preview screenshot to verify the result visually before reporting completion. When clicking UI elements in preview, prefer using CSS selectors or text content to identify elements rather than guessing pixel positions.

## Database Schema

Five tables defined in `supabase/schema.sql`:

### profiles
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK to auth.users, cascade delete |
| `display_name` | text | |
| `created_at` | timestamptz | |

Auto-created via trigger `on_auth_user_created`.

### conversations
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | to profiles |
| `status` | text | 'active' or 'completed' |
| `summary` | text | Generated by Haiku |
| `extraction_state` | jsonb | Cumulative extraction state (updated each turn by background extraction) |
| `calibration_ratings` | text | **DEAD COLUMN** — never read or written by any code |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated via trigger |

### messages
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `conversation_id` | uuid FK | to conversations |
| `role` | text | 'user', 'assistant', or 'system' |
| `content` | text | |
| `is_checkpoint` | boolean | Default false |
| `checkpoint_meta` | jsonb | See shape below |
| `processing_text` | text | Classifier's tracking phrase |
| `created_at` | timestamptz | |

**`checkpoint_meta` JSON shape:**
```json
{
  "layer": 1 | 2 | 3 | 4 | 5,
  "type": "component" | "pattern",
  "name": "The Proposed Name" | null,
  "status": "pending" | "confirmed" | "rejected" | "refined",
  "composed_content": "polished manual entry text" | null,
  "composed_name": "headline name" | null,
  "changelog": "what changed from previous version" | null
}
```
Created with `"status": "pending"` by call-sage.ts. `composed_content`/`composed_name`/`changelog` populated when Sage includes an inline `|||MANUAL_ENTRY|||` block. Updated to final status by checkpoint/confirm/route.ts via `confirmCheckpoint()` utility.

### manual_components
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | to profiles. **User-level, NOT conversation-level.** |
| `layer` | integer | 1 through 5 |
| `type` | text | 'component' or 'pattern' |
| `name` | text | Nullable. Normalized to lowercase. |
| `content` | text | Full checkpoint text |
| `source_message_id` | uuid FK | to messages |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated via trigger |

**Accumulation rules:**
- **Components**: Exactly 1 per layer per user (max 5 total). Upserting replaces. Enforced by partial unique index `unique_component_per_layer` on `(user_id, layer) WHERE type = 'component'`.
- **Patterns**: Max 2 per layer per user. Same name in same layer = replace. New name = new row. When a 3rd pattern would be added, the oldest is archived to `manual_changelog` and deleted. Enforced by partial unique index `unique_pattern_name_per_layer` on `(user_id, layer, name) WHERE type = 'pattern'`.
- Upsert uses select-then-insert/update (not Postgres `ON CONFLICT`) because partial unique indexes make standard upsert tricky.
- **Changelog archiving**: When updating an existing component/pattern, previous content is archived to `manual_changelog` table before overwrite. Managed by `confirmCheckpoint()` utility.

### manual_changelog
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `component_id` | uuid FK | to manual_components, cascade delete |
| `user_id` | uuid FK | to profiles |
| `previous_content` | text | Content before update |
| `previous_name` | text | Name before update (nullable) |
| `changelog` | text | What changed, from Sage's `|||MANUAL_ENTRY|||` block |
| `created_at` | timestamptz | |

Archives previous versions of manual components when they are updated via checkpoint confirmation. Indexed on `(component_id)` and `(user_id)`. RLS policy: users can only read their own changelog entries.

## API Routes

### POST /api/chat — Edge Runtime
- **Body**: `{ message: string | null, conversationId: string | null, explorationContext?: ExplorationContext }`
- **Returns**: SSE stream
- Creates conversation if `conversationId` is null. Saves user message, parallel DB reads (history + manual components + extraction state), applies sliding window (first 2 + last 48 if >50), fires extraction in background (parallel with Sage stream), builds system prompt with manual context + extraction context + optional exploration focus, streams Sage response via Anthropic with delimiter buffer to suppress `|||MANUAL_ENTRY|||` blocks. When manual entry block present, skips Haiku classifier (Sage already provided all metadata). Otherwise runs classifier post-stream.

### POST /api/checkpoint/confirm — Edge Runtime
- **Body**: `{ messageId: string, action: "confirmed" | "rejected" | "refined", conversationId: string }`
- **Returns**: SSE stream (Sage's follow-up response)
- Verifies message belongs to user's conversation. Updates `checkpoint_meta.status`. On confirm: delegates to `confirmCheckpoint()` utility which uses `composed_content` from `checkpoint_meta` (if present, from Sage's inline `|||MANUAL_ENTRY|||` block) or falls back to message content. Archives previous version to `manual_changelog` on updates. Handles patterns (max 2 per layer, oldest archived when exceeded). Inserts system message. Streams Sage's follow-up.

### GET /api/manual — Node.js Runtime (no Edge declaration)
- **Returns**: `{ components: ManualComponent[] }`
- Returns all `manual_components` for the authenticated user.

### GET /api/conversations — Node.js Runtime
- **Returns**: `{ conversations: Array<{ id, status, summary, title, preview, created_at, updated_at, message_count }> }`
- Lists all conversations for the authenticated user, ordered by `updated_at desc`. Message counts exclude system messages. `title` is extracted from the `TITLE:` prefix in summary. `preview` is the first user message content.

### POST /api/conversations/complete — Edge Runtime
- **Body**: `{ conversationId: string }`
- **Returns**: `{ ok: true }`
- Marks a conversation as `'completed'`. Generates summary via shared `generateSessionSummary()` utility if none exists.

### POST /api/session/summary — Edge Runtime
- **Body**: `{ conversationId: string }`
- Generates summary via shared `generateSessionSummary()` utility, stores on conversation record.

### POST /api/dev-simulate — Edge Runtime
- **Body**: none
- **Returns**: SSE stream
- Runs a simulated conversation with Sage using 10 pre-scripted user messages about conflict avoidance. Creates a conversation, loops through messages calling `callSage()` for each turn. Stops when a checkpoint is detected or all messages are exhausted. Streams progress events to the client.
- **SSE events**: `started` (with conversationId, emitted immediately after conversation creation), `turn` (user message preview), `turn_complete` (with conversationId, processingText, hasCheckpoint, turn number), `checkpoint` (layer, name, conversationId, turn number), `complete` (totalTurns), `error`.

### POST /api/dev-login — Edge Runtime
- **Body**: none
- **Returns**: `{ access_token, refresh_token, email }`
- Development-only (returns 403 in production). Looks up user via `DEV_USER_EMAIL` env var or falls back to first user. Generates magic link token, verifies it server-side, sets session cookies directly. Optional env var: `DEV_USER_EMAIL`.

### POST /api/dev-reset — Edge Runtime
- Development-only (returns 403 in production).
- Deletes messages (FK first), then conversations, then manual_components, then manual_changelog for the user.
- Does NOT delete the profiles row or auth user.
- Returns `{ ok: true }`.

### POST /api/dev-populate — Edge Runtime
- **Body**: `{ layers: number[] }`
- **Returns**: `{ ok: true, count: number }`
- Development-only (returns 403 in production). Populates `manual_components` with realistic Sage-written content for specified layers (1-5). Wipes existing components first. Used for UI development.

### POST /api/account/delete — Edge Runtime
- **Body**: none
- **Returns**: `{ ok: true }`
- Deletes all user data (messages → conversations → manual_components → profiles) then deletes the auth user via `admin.auth.admin.deleteUser()`.

### POST /api/auth/logout — Node.js Runtime
- **Body**: none
- **Returns**: `{ ok: true }`
- Signs out the user via server-side Supabase client (properly clears HttpOnly auth cookies). Called by MobileSettings logout button, which then redirects to `/login`.

### GET /auth/callback — Node.js Runtime (no Edge declaration)
- OAuth callback. Exchanges code for session, redirects to origin.

## Three Supabase Clients

| Client | File | Key | Purpose |
|--------|------|-----|---------|
| **Admin** | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. All DB writes in API routes. `autoRefreshToken: false`, `persistSession: false`. |
| **Server** | `lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies | Auth verification only. Every API route creates this to call `getUser()`. Never does data operations. Also used in middleware for session refresh. |
| **Browser** | `lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side. Auth (login, OAuth) and initial data reads in `useChat.ts` (reads through RLS). |

**Pattern**: Server client authenticates the user, admin client does all database work.

## SSE Event Protocol

All streaming responses (chat + checkpoint confirm) use the same format:

```
data: {"type":"text_delta","text":"chunk of text"}
data: {"type":"message_complete","messageId":"uuid","conversationId":"uuid","checkpoint":null|{"isCheckpoint":true,"layer":1,"type":"component","name":"Name"},"processingText":"tracking phrase","nextPrompt":"hint text...","cleanContent":"stripped text if delimiter was found"}
data: {"type":"error","message":"human-readable error"}
```

- `text_delta`: streamed token by token during generation. The delimiter buffer in `call-sage.ts` suppresses `|||MANUAL_ENTRY|||` and everything after it from reaching the client.
- `message_complete`: final event. `checkpoint` is null for normal messages, object for checkpoints (no `status` field in SSE — status starts as "pending" on the DB side). `cleanContent` is included when the delimiter was found (defense-in-depth: conversational text only). `nextPrompt` is the extraction's suggested input placeholder.
- `error`: emitted on failure, stream closes
- Client parses via `parseSSEStream` in `src/lib/utils/sse-parser.ts`

## Checkpoint Lifecycle

Two detection paths, both ending at the same confirm flow:

**Path A — Inline manual entry (preferred):** Sage includes a `|||MANUAL_ENTRY|||` delimiter block at the end of its response with composed content, layer, type, name, and changelog. The delimiter buffer in `call-sage.ts` suppresses this from the stream. Classifier is skipped — all metadata comes from Sage directly.

**Path B — Haiku classifier (fallback):** When Sage doesn't produce a manual entry block, the Haiku classifier runs post-stream on every response. Returns `{ isCheckpoint, layer, type, name, processingText }`. Checkpoint = sustained reflection (100+ words for returning users, 60+ for first-session).

**Full cycle:**

1. **call-sage.ts**: Sage responds. Stream parsed with delimiter buffer. If `|||MANUAL_ENTRY|||` found → Path A (skip classifier, use Sage's metadata). Otherwise → Path B (run classifier). `is_checkpoint`, `checkpoint_meta` (including `composed_content`, `composed_name`, `changelog` for Path A), and `processing_text` written to message row.
2. **Client (useChat.ts)**: `message_complete` event carries checkpoint data + `cleanContent` (stripped text). Sets `activeCheckpoint` state. MobileSession renders confirm/reject/refine buttons inline.
3. **confirm-checkpoint.ts**: `confirmCheckpoint()` utility reads `composed_content` from `checkpoint_meta` (if present) or falls back to `msg.content`. Archives previous version to `manual_changelog` if updating an existing component. Handles patterns (max 2 per layer). Sets `source_message_id`.
4. **checkpoint/confirm/route.ts**: On confirm, calls `confirmCheckpoint()`. Inserts system message (`[User confirmed the checkpoint]`, etc.). Streams Sage's follow-up.
5. **call-sage.ts** (next call): System messages in DB are mapped to synthetic user messages in conversation history so Sage sees them naturally. E.g. `"[User confirmed the checkpoint]"` becomes `"I confirmed that checkpoint. That resonates."`

## Onboarding Flow (Pre-Auth)

`OnboardingFlow.tsx` orchestrates a pre-auth onboarding flow rendered on `/login`. Four views managed by `currentView` state:

**Views**: `"entry" | "login" | "onboarding" | "seed"`

**Components** (all in `src/components/onboarding/`):
- `OnboardingFlow.tsx` — View orchestrator with crossfade transitions (400ms). Checks `mantle_onboarding_completed` localStorage on mount; if completed + auth session → redirect to `/`. If completed + no session → show login. If not completed → show entry.
- `EntryScreen.tsx` — Landing: headline + "Get started" + "Log in" buttons.
- `LoginScreen.tsx` — Email/password login + Google OAuth for returning users.
- `InfoScreens.tsx` — 2-screen info flow (Build Manual + What to Expect) with swipe navigation, pagination dots, and glow transitions.
- `SeedScreen.tsx` — Seed textarea + age confirmation checkbox + "Begin" button.
- `AuthPromptModal.tsx` — Post-checkpoint auth conversion for guest users (email/password via `updateUser` + Google OAuth via `linkIdentity`).
- `AmbientGlow.tsx` — Animated radial gradient background with configurable position/scale/opacity.

**New user flow**: Entry → Get Started → Info screens → Seed screen → `signInAnonymously()` → sets `mantle_onboarding_completed` + `mantle_age_confirmed` in localStorage → stores seed in `sessionStorage` → `router.push("/")`.

**Returning user flow**: Entry → Log In → email/password or Google OAuth → `router.push("/")`.

**Guest-to-real conversion**: After first checkpoint confirm, backend detects `user.is_anonymous` and returns `promptAuth: true` in SSE. `useChat` surfaces this via `promptAuth` state. `MainApp` shows `AuthPromptModal`. Email: `updateUser({ email, password })`. Google: `linkIdentity({ provider: "google" })` with `mantle_pending_conversion` localStorage flag for redirect handling.

**Seed handoff**: `sessionStorage.setItem("mantle_seed_text", text)` in SeedScreen → `sessionStorage.getItem` + `removeItem` in MainApp → `sendMessage(seed)` (guarded by `seedSent` ref + `initialized` flag).

## Color System

Single theme (Sage). All tokens defined in `:root` in `globals.css`. No `data-theme` attribute, no theme switching.

### Core tokens
```
--color-void:       #0C0B0A                        page background
--color-surface:    #161513                        cards, overlays
--color-text:       #E2E0DB                        primary text
--color-text-dim:   rgba(226, 224, 219, 0.55)      secondary (Sage messages)
--color-text-ghost: rgba(226, 224, 219, 0.25)      tertiary (labels, meta, inactive)
--color-divider:    rgba(226, 224, 219, 0.06)      borders, separators
--color-accent:       #8BA888
--color-accent-dim:   rgba(139, 168, 136, 0.4)
--color-accent-ghost: rgba(139, 168, 136, 0.08)
--color-accent-glow:  rgba(139, 168, 136, 0.12)
```

### Chat surface & text tokens
```
--color-surface-sage: #151311                      Sage message panels, input focused bg
--color-shell:        #252320                      Desktop phone shell bg
--color-sage-text:    #D4CBC0                      Sage message body text
--color-user-text:    #C0B8AD                      User message text
--color-input-text:   #C8BFB4                      Input textarea text
--color-accent-muted: #7A8B72                      Sage labels, caret color, send button
```

### Error tokens
```
--color-error:       #B5564D                       Destructive text (delete buttons)
--color-error-dim:   rgba(181, 86, 77, 0.5)        Error icon strokes
--color-error-ghost: rgba(181, 86, 77, 0.12)       Error background tints
--color-error-text:  rgba(181, 86, 77, 0.7)        Error message text
```

### Overlay tokens
```
--color-backdrop:       rgba(0, 0, 0, 0.5)         Session drawer backdrop
--color-backdrop-heavy: rgba(0, 0, 0, 0.6)         Confirmation modal backdrops
```

### Input state tokens
```
--color-input-border:       rgba(212, 203, 192, 0.12)   Default input border
--color-input-border-focus:  rgba(122, 139, 114, 0.2)   Focused input border
--color-input-border-active: rgba(122, 139, 114, 0.35)  Recording/active input border
--color-input-placeholder:   rgba(212, 203, 192, 0.28)  Placeholder text
```

### Checkpoint / MeadowZone tokens (`--cp-*`)
```
--cp-text:          #2A3326                        Layer labels, body text
--cp-text-accent:   #5E7054                        Accent bars, Sage labels
--cp-text-dim:      #455040                        Secondary checkpoint text
--cp-border:        rgba(94, 112, 84, 0.35)        Checkpoint card borders
--cp-border-dim:    rgba(69, 80, 64, 0.2)          Secondary checkpoint borders
--cp-surface-mid:   #E4EDE0                        MeadowZone fade targets
```

### Pattern card tokens
```
--cp-pattern-bg:            rgba(94, 112, 84, 0.04)   Pattern card background
--cp-pattern-bg-active:     rgba(94, 112, 84, 0.08)   Expanded pattern background
--cp-pattern-border:        rgba(94, 112, 84, 0.08)   Pattern card border
--cp-pattern-border-active: rgba(94, 112, 84, 0.15)   Expanded pattern border
--cp-pattern-name:          rgba(94, 112, 84, 0.5)    Pattern name text
--cp-pattern-content:       rgba(58, 74, 52, 0.7)     Pattern description text
--cp-explore-text:          rgba(94, 112, 84, 0.65)   Explore with Sage button text
--cp-explore-border:        rgba(94, 112, 84, 0.2)    Explore with Sage button border
--cp-link:                  rgba(94, 112, 84, 0.55)   Continue reading link text
```

### Empty layer tokens (dark void context)
```
--color-empty-text: rgba(212, 203, 192, 0.28)      Empty layer name text
--color-empty-bg:   rgba(212, 203, 192, 0.04)      Empty layer info button bg
--color-empty-icon: rgba(212, 203, 192, 0.25)      Empty layer info icon
```

## Typography

| Font | Variable | Weights | Role |
|------|----------|---------|------|
| Instrument Serif | `--font-serif` | 400 | Emotional/reflective content: session summary, checkpoint text, manual passages, headlines |
| DM Sans | `--font-sans` | 400, 500, 600 | Conversational UI: chat messages, buttons, input, form labels |
| JetBrains Mono | `--font-mono` | 400 | Metadata: nav labels, status lines, timestamps, progress indicators. Always uppercase with letter-spacing. |

## Current UI Spec

### Bottom Nav (`MobileNav.tsx`, icons in `NavIcons.tsx`)

Four tabs: session, manual, guidance, settings

| Tab | Icon name | SVG description |
|-----|-----------|-----------------|
| session | Flame | Single flame stroke path, 20x20 viewBox |
| manual | Seed of Life | 7 overlapping circles (1 center + 6 surrounding), 20x20 |
| guidance | Constellation | 6 dots + 6 connecting lines at varying opacities, 20x20 |
| settings | Mortar & Pestle | Bowl curve + rim line + pestle with circle handle, 20x20 |

**Nav container**: Fixed bottom, `var(--color-void)` background, `border-top: 1px solid var(--color-divider)`, gap 20px, `paddingTop: 10px`, `paddingBottom: calc(14px + env(safe-area-inset-bottom, 0px))`, zIndex 100.

**Tab buttons**: `minWidth: 56px`, `minHeight: 44px` (touch target), flex column, gap 4px.

**Labels**: `var(--font-mono)`, 7px, letter-spacing 2.5px, uppercase, line-height 1.

**Active**: `color: var(--color-accent)`. **Inactive**: `color: var(--color-text-ghost)`. **Transition**: `color 0.4s ease`. Both icon and label inherit color.

### Session (`MobileSession.tsx`)

Always-on chat view with a side drawer for session management. No idle/active state toggle — the chat is always visible.

**Header bar**: Flex row, `padding: 12px 16px`, `flexShrink: 0`. Three items justified space-between:
- **Left**: Menu button (hamburger, 3 lines 16px wide, 44x44 touch target, `--color-text-ghost`). Taps open the side drawer and refresh the conversations list.
- **Center**: "MANTLE" wordmark (`--font-mono`, 9px, `--color-text-ghost`, letter-spacing 4px, uppercase).
- **Right**: 44x44 spacer div (keeps wordmark centered).

**Empty state**: When no messages, a centered placeholder below header: "Ready when you are." (`--font-serif`, 22px, `--color-text-ghost`, line-height 1.5, letter-spacing -0.3px).

**Messages**:

| Element | Font | Size | Color | Notes |
|---------|------|------|-------|-------|
| User messages | `--font-sans` | 13px, weight 400 | `--color-text` | opacity 0.75 (latest) or 0.5 (older). Plain text, no markdown. paddingRight 32px |
| Assistant messages | `--font-sans` | 13px, weight 400 | `--color-text-dim` | Rendered via `renderMarkdown()` (bold + paragraphs). paddingRight 32px |
| Checkpoint card | `--font-serif` | 19px | `--color-text` | line-height 1.75, letter-spacing -0.2px. Centered, margin 40px 0, `checkpointFadeIn 2s`. Radial glow background `var(--color-accent-glow)`. |
| "Does this feel right?" | `--font-serif` italic | 14px | `--color-text-ghost` | Below checkpoint text |
| "Yes, save this" button | `--font-sans` | 12px, weight 500 | `--color-accent` | border `1px solid var(--color-accent-dim)`, border-radius 20px, padding 6px 16px |
| "Refine it" / "Skip" buttons | `--font-sans` | 12px, weight 500 | `--color-text-ghost` | border `1px solid var(--color-divider)`, same radius/padding |
| Typing indicator | — | 3 dots 5px | `--color-accent-muted` | `sagePulse 2.4s` staggered. Shows when isLoading and last msg is user. Inside Sage panel with label. |
| Error text | `--font-sans` | 13px | `--color-text-ghost` | Centered with Retry button (`--color-accent`, weight 500) |
| Input textarea | `--font-sans` | 13px | `--color-text` | Placeholder `"_"` when messages exist, `"Begin anywhere_"` when empty. Enter sends, Shift+Enter newline. Height 44px collapsed, 120px min when focused, max 40vh. |

**Side drawer** (session list):

| Element | Style | Notes |
|---------|-------|-------|
| Backdrop | `position: fixed, inset: 0`, `rgba(0,0,0,0.5)`, zIndex 200 | Tap closes drawer. Opacity 0→1 transition 0.3s |
| Panel | `position: fixed, left: 0, top: 0, bottom: 0`, width `80vw` max `320px`, `--color-surface` bg, zIndex 201 | `translateX(-100%)` → `translateX(0)` transition 0.3s |
| "SESSIONS" header | `--font-mono` 8px, `--color-text-ghost`, letter-spacing 3px | Left-aligned with close X button right-aligned |
| "New session" button | `--font-sans` 13px, `--color-accent` | Full width, border `1px solid var(--color-accent-ghost)`, border-radius 8px, padding 12px 16px. Taps: `startNewSession()` + close drawer |
| Session row | `--font-sans` 13px summary (2-line clamp), `--font-mono` 8px date + count | Active: `borderLeft: 2px solid var(--color-accent)`, text `--color-text`. Inactive: transparent border, text `--color-text-dim`. No summary fallback: "Untitled session" |
| Empty list | `--font-sans` 13px, `--color-text-ghost` | "No sessions yet" centered |

### Manual (`MobileManual.tsx`)

Full height, `overflowY: auto`, zero horizontal padding on scroll container (panels go edge-to-edge). Top scroll fade via `mask-image` gradient (same approach as Session). Header bar matches Session layout (MANTLE wordmark center, spacer right).

Page title "Your Manual" (`--font-serif` 22px, `--color-text`) sits on dark void with its own `padding: 24px 24px 0`. Below it, populated layers each wrap in `<MeadowZone>` — full-width feathered green panels with 70px top/bottom feather gradients. Adjacent panels sit directly adjacent (0px gap). Empty layers render below populated ones on the dark void.

**Inside MeadowZone (uses `--cp-*` CSS custom properties):**

| Element | Font | Size | Weight | Color token | Notes |
|---------|------|------|--------|-------------|-------|
| Layer label | `--font-mono` | 9px | 500 | `--cp-text` | letter-spacing 2px, uppercase, line-height 1, margin-bottom 10px |
| Body text | `--font-serif` | 14px | 400 | `--cp-text` | line-height 1.75, letter-spacing -0.1px. Collapsed maxHeight 110px with fade to `--cp-surface-mid` |
| Continue reading | `--font-sans` | 11px | 500 | `--cp-link` | margin-top 6px, chevron rotates on expand |
| Pattern name | `--font-sans` | 14.5px | 480 | `--cp-pattern-name` | Inside expandable card with +/× icon |
| Pattern content | `--font-serif` | 14px | 400 | `--cp-pattern-content` | line-height 1.72 |
| Pattern card bg | — | — | — | `--cp-pattern-bg` | border-radius 10px, 1px border `--cp-pattern-border` |

**Outside MeadowZone (dark void, uses `--color-empty-*` tokens):**

| Element | Font | Size | Color token | Notes |
|---------|------|------|-------------|-------|
| Empty state | `--font-serif` | 15px | hardcoded `rgba(212, 203, 192, 0.32)` | "Sage is learning how you operate..." |
| Empty layer row | `--font-sans` | 13.5px | `--color-empty-text` | Layer name + info tooltip with "Explore with Sage" |

### Guidance (`MobileGuidance.tsx`)

**Locked** (confirmedCount < 1): Centered layout. "Guidance becomes available as your manual develops." (`--font-serif` 20px, `--color-text`). 5 progress bars (24x2px each, gap 4px): filled = `--color-accent` opacity 0.6, empty = `--color-text-ghost` opacity 0.2. Counter "N OF 5" (`--font-mono` 8px, `--color-text-ghost`). Background 200px radial glow.

**Unlocked** (confirmedCount >= 1): Header "GUIDANCE" + placeholder "Guidance is available. This feature is coming soon." (`--font-serif` 16px, `--color-text-dim`).

### Settings (`MobileSettings.tsx`)

Header "SETTINGS" (`--font-mono` 8px, `--color-text-ghost`, letter-spacing 3px). All items: title `--font-sans` 13px `--color-text`, subtitle `--font-mono` 9px `--color-text-ghost`, padding 18px 0, border-bottom `1px solid var(--color-divider)`.

| Item | State | Details |
|------|-------|---------|
| Account | Display-only | Shows email. |
| Log out | Functional | Shows email as subtitle. Calls `POST /api/auth/logout` (server-side cookie clearing) then redirects to `/login`. |
| Session history | Display-only | Shows "N sessions" (correct count from conversations list). |
| Export manual | Display-only | Shows "PDF or text". No handler. |
| Simulate user | Functional | Accent color text. Calls `/api/dev-simulate`, streams SSE. Instantly switches to Session tab via `started` event, reloads messages after each turn. Stops at checkpoint for manual action. |
| Delete data | Functional | Red text `var(--color-error)`. Confirmation modal. Calls `/api/dev-reset` + `localStorage.clear()` + reload. |
| Delete account | Functional | Red text `var(--color-error)`. Confirmation modal. Calls `/api/account/delete` + `localStorage.clear()` + redirect to `/login`. |

## Architecture Rules

### Sliding Window
First 2 + last 48 messages when history exceeds 50. Implemented in `call-sage.ts`. Preserves opening context while keeping recent conversation.

### Extraction Layer (Parallel with Sage)
A Sonnet-powered extraction pre-pass (`extraction.ts`) analyzes each conversation turn and produces structured context: layer signals, language bank (user's exact phrases), depth tracking, checkpoint gate assessment, next prompt hint, and a sage brief. **Runs in parallel with Sage's stream** — never blocks it. Sage uses the PREVIOUS turn's extraction state (already loaded from DB in parallel read). The updated extraction state saves to `conversations.extraction_state` for the next turn.

Key architecture decisions:
- **Zero added latency**: `runExtraction()` fires as a background Promise (not awaited). Sage starts streaming immediately.
- **1-turn lag**: Sage's extraction context is always 1 turn behind. Extraction is cumulative (layer signals, language bank carry forward), so the lag is negligible.
- **First message**: No extraction state exists. Sage gets no extraction context. Normal behavior.
- **Input**: Last 6 messages only (3 exchanges). Previous state carries all earlier signals.
- **Output**: `ExtractionState` object saved to `conversations.extraction_state` JSONB column.

### Inline Manual Entry Composition
When Sage detects a checkpoint, it composes a polished manual entry inline using `|||MANUAL_ENTRY|||` / `|||END_MANUAL_ENTRY|||` delimiter blocks appended after its conversational response. The JSON block contains `{ layer, type, name, content, changelog }`. A streaming delimiter buffer in `call-sage.ts` prefix-matches against the delimiter to prevent any of this from reaching the client. When present, the Haiku classifier is skipped entirely — Sage already provided all metadata.

### Classifier Behavior
Haiku runs post-stream as a fallback when Sage does NOT include a `|||MANUAL_ENTRY|||` block. Returns both checkpoint detection and a `processingText` tracking phrase. If `isCheckpoint` is true but `layer` is null, the checkpoint is invalidated (set to false). Skipped when manual entry block is present (Sage already decided it's a checkpoint).

### Returning User Detection
`isReturningUser` in `call-sage.ts` is determined by having `manual_components` (not by conversation count). Controls whether system prompt includes "RETURN SESSION ENTRY" instructions.

### Session Summary
Generated fire-and-forget when `useChat` initializes and the last message is >30 minutes old. Also generated when a conversation is marked completed via `/api/conversations/complete`. Uses shared `generateSessionSummary()` utility in `src/lib/sage/generate-summary.ts` (Haiku). Stored on conversation `summary` column.

## Sage Prompt Assembly

### buildSystemPrompt Conditional Loading

Sections load based on `BuildPromptOptions` flags. Source of truth for what Sage sees:

| Section | Condition |
|---------|-----------|
| Voice, Legal Boundaries, Conversation Approach, Deepening Moves, Adapting | Always |
| Extraction Context guidance | `turnCount > 1` |
| Manual Entry Format | `turnCount > 1` |
| Progress Signals | `turnCount > 2` |
| First Message | `turnCount <= 1 && isNewUser` |
| First Session content | `isNewUser` |
| Checkpoints, Composition Voice, Post-Checkpoint | `showCheckpointInstructions` (`checkpointApproaching \|\| isReturningUser`) |
| First Checkpoint teaching | `isFirstCheckpoint && checkpointApproaching` |
| Building Toward Signal | `checkpointApproaching` |
| Patterns | `hasPatternEligibleLayer` |
| Returning User | `isReturningUser` |
| Readiness Gate | `manualComponents.length >= 3` |
| Confirmed Manual (dynamic) | `manualComponents.length > 0` |
| Session Context (dynamic) | `isReturningUser` |
| Exploration Focus (dynamic) | `explorationContext` provided |

`isNewUser = manualComponents.length === 0 && !isReturningUser`. `checkpointApproaching` = any layer signal is `emerging`, `explored`, or `checkpoint_ready` in `previousExtraction`. 1-turn lag: Sage sees the PREVIOUS turn's extraction. See "Extraction Layer" in Architecture Rules.

### Layer Discovery Rules

- Every layer starts in `discovery_mode: "component"`
- First checkpoint on any layer MUST be type `"component"`
- After component confirmation, `discovery_mode` flips to `"pattern"` (managed by `confirmCheckpoint()`)
- Max 1 component + 2 patterns per layer (5 components + 10 patterns total)
- Four-layer type enforcement: system prompt TYPE RULE → extraction `target_type` → hard guard in `call-sage.ts` → safety net in `confirm-checkpoint.ts`

### Extraction → Sage Pipeline (per turn)

1. User message arrives at `/api/chat`
2. Parallel reads: history, `manual_components`, `extraction_state` (via `Promise.all`)
3. `buildSystemPrompt()` using previous extraction state (1-turn lag)
4. Sage streams response; `runExtraction()` fires in background (not awaited)
5. Delimiter buffer suppresses `|||MANUAL_ENTRY|||` from client stream
6. If manual entry block found → skip classifier, use Sage's metadata (Path A)
7. If no block → Haiku classifier runs as fallback (Path B)
8. Background extraction saves updated state to `conversations.extraction_state`

See "Checkpoint Lifecycle" for the full confirm flow after step 7.

### Critical Invariants

- `composed_content` must never be null on confirmed checkpoints (fixed by loading Manual Entry Format at `turnCount > 1`)
- Crisis text must never appear in manual entries (stripped in `confirmCheckpoint()` fallback path)
- `clinical_flag.level === "crisis"` blocks checkpoint gate entirely (in `formatExtractionForSage`)
- Checkpoint gate is quality-based (examples + mechanism + charged language), not turn-based
- First-checkpoint gate is lighter: 1 example (vs 2), mechanism OR behavior-driver link (vs both)

## Dead Features — Full Kill List

These features were designed, partially built, or referenced, and have been removed:

| Feature | Status | What replaced it |
|---------|--------|-----------------|
| Desktop layout | Removed | Mobile-only. No desktop code exists. |
| Calibration / calibration_ratings | Removed | `calibration_ratings` column still exists in schema but is dead — never read or written. Nothing replaced it. |
| PromptCards | Removed | Replaced by FocusCard, then by pre-auth onboarding. |
| Old onboarding (OnboardingOverlay, OnboardingInfoScreen, OnboardingSeedScreen, useOnboarding) | Removed | Replaced by pre-auth onboarding flow (OnboardingFlow + EntryScreen + LoginScreen + InfoScreens + SeedScreen + AuthPromptModal). |
| Synthetic first message | Removed | Sage now generates its own opener via `triggerSageOpener()` sending `message: null` to `/api/chat`. |
| Gate (as separate UI) | Removed as UI | Still exists as a conversation transition in system-prompt.ts ("READINESS GATE" section). Sage handles it conversationally, no separate gate UI. |
| Advisor mode | Removed | Completely removed from system-prompt.ts and codebase. Nothing replaced it. |
| SessionTimer | Removed | Nothing replaced it. |
| ENTRY SEQUENCE (as formal flow) | Removed as UI | The system prompt still references "Do NOT run the entry sequence" as instructions to Sage. No UI or code flow by that name exists. |
| Insights page | Removed | Nothing replaced it. |
| Reactive orb | Removed | Nothing replaced it. Typing indicator is now a simple pulsing dot. |
| Session hub idle state | Removed | Replaced by always-on chat + side drawer for session management. No idle/active toggle. |
| Theme toggle | Removed | Sage is the only theme. `[data-theme]` attribute, blocking script, Ember/Depth CSS blocks all removed. |
| Sound / Audio | Removed | `AudioProvider`, `MobileSoundSelector`, `ambient-player.ts`, `public/audio/*.mp3` all deleted. Nothing replaced it. |
| Ambient particles | Removed | `SessionParticles.tsx` deleted. `particleDrift1-4`, `particleConverge` keyframes removed. Nothing replaced it. |

**Dead feature residue grep results (last verified):**
- `calibration` — 1 hit: `schema.sql` line 41 (dead column)
- `gate` — 2 hits in `system-prompt.ts`: active conversation instructions, not dead code
- `ENTRY SEQUENCE` — 2 hits in `system-prompt.ts`: active Sage instructions ("Do NOT run the entry sequence")
- All other terms (advisor, PromptCard, synthetic, SessionTimer, desktop, Desktop, insight, reactive, orb) — 0 hits

**Also present**: `scripts/` directory contains 5 test gate scripts (`test-phase1-gate.sh` through `test-phase5-gate.sh`) — build-phase scaffolding, not application code.

## Conversation Modes (System Prompt)

Sage manages its own mode transitions:
1. **Mode 1 (Situation-Led)**: Start here. Deepen user's topic vertically.
2. **Mode 2 (Direct Exploration)**: After 2+ confirmed checkpoints. Targeted questions referencing user's own language.
3. **Mode 3 (Synthesis)**: When all 5 layers have at least one component. Cross-layer narrative.

**Readiness Gate**: When all 5 layers confirmed, Sage delivers synthesis and offers "see your manual or keep building." No Advisor mode — removed entirely.

## Middleware

`middleware.ts` at project root. Creates Supabase server client, calls `getUser()` (which also refreshes the session token via cookie set/remove handlers). Unauthenticated users redirected to `/login`. Authenticated users on `/login` redirected to `/`. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and `/api` routes. Also handles anonymous (guest) users — `getUser()` returns a valid user for anonymous sessions created via `signInAnonymously()`.

## localStorage Keys

| Key | Set by | Purpose |
|-----|--------|---------|
| `mantle_onboarding_completed` | SeedScreen | Prevents re-showing onboarding |
| `mantle_age_confirmed` | SeedScreen | Legal age confirmation |
| `mantle_pending_conversion` | AuthPromptModal | Flags Google OAuth redirect in progress (cleaned up on return) |

## sessionStorage Keys

| Key | Set by | Purpose |
|-----|--------|---------|
| `mantle_seed_text` | SeedScreen | Seed text handoff to MainApp (consumed + removed on use) |

## File Tree

```
middleware.ts                         Auth redirect + session refresh
supabase/schema.sql                   Database schema (5 tables)
scripts/test-phase{1-5}-gate.sh       Build-phase test scripts (scaffolding)
src/
  app/
    api/
      chat/route.ts                   POST Edge — streams Sage response
      checkpoint/confirm/route.ts     POST Edge — confirm checkpoint + stream follow-up
      conversations/route.ts          GET Node — list conversations with metadata
      conversations/complete/route.ts POST Edge — mark conversation completed + summarize
      account/delete/route.ts         POST Edge — delete user account + auth user
      dev-login/route.ts              POST Edge — dev-only passwordless login
      dev-populate/route.ts           POST Edge — dev-only populate manual with mock content
      dev-reset/route.ts              POST Edge — dev-only delete all user data
      dev-simulate/route.ts           POST Edge — dev-only run simulated conversation until checkpoint
      manual/route.ts                 GET Node — return manual components
      session/summary/route.ts        POST Edge — generate summary via shared utility
      auth/logout/route.ts            POST Node — server-side logout (clears HttpOnly cookies)
    auth/callback/route.ts            GET Node — OAuth callback
    globals.css                       Tokens, scrollbar, keyframes
    layout.tsx                        Root: fonts, {children}
    login/page.tsx                    Renders OnboardingFlow (pre-auth onboarding + login)
    page.tsx                          Server component: auth gate -> MainApp
  components/
    icons/NavIcons.tsx                SVG icons: flame, seed-of-life, constellation, mortar
    layout/
      MobileLayout.tsx                Fixed shell: 4 tab panels + MobileNav (bottom 68px)
      MobileNav.tsx                   Bottom tab bar with icons + labels
    mobile/
      MobileSession.tsx               Chat message rendering, checkpoint cards, typing indicator, error display
      ChatInput.tsx                   Ghost input container, textarea, send button, long-message delay
      SessionDrawer.tsx               Side drawer: session list, new session button, backdrop
      MobileManual.tsx                Manual viewer: card-based layers via buildLayers(components) + dev state switcher
      manual/
        EmptyLayer.tsx                Empty layer row with info tooltip
        PopulatedLayer.tsx            Populated layer card with expand/collapse narrative
        PatternItem.tsx               Expandable pattern card within a layer
        LayerTooltip.tsx              Click-to-open tooltip with auto-flip positioning
        ManualMockData.ts             Layer interfaces + mock data (empty/partial/updated/mature states)
      MobileGuidance.tsx              Locked until 1 confirmed, progress bars
      MobileSettings.tsx              Account, logout, history, export, simulate, delete
    onboarding/
      OnboardingFlow.tsx             Pre-auth flow orchestrator (entry → login → info → seed)
      EntryScreen.tsx                Landing screen with Get Started + Log In buttons
      LoginScreen.tsx                Email/password + Google OAuth login for returning users
      InfoScreens.tsx                2-screen info flow with swipe navigation
      SeedScreen.tsx                 Seed textarea + age confirmation + anonymous auth
      AuthPromptModal.tsx            Post-checkpoint guest-to-real account conversion
      AmbientGlow.tsx                Animated radial gradient background
    shared/
      ConfirmationModal.tsx           Reusable destructive-action confirmation overlay
      SettingsRow.tsx                 Reusable settings row with title/subtitle/divider
      ExploreWithSageButton.tsx       "Explore with Sage" button with chevron (meadow + dark variants)
    MainApp.tsx                       Wires useChat + MobileLayout + seed handoff + auth prompt + exploration
  lib/
    types.ts                          Shared interfaces: ChatMessage, ManualComponent, ActiveCheckpoint, ExplorationContext
    anthropic.ts                      Raw fetch: anthropicFetch (sync), anthropicStream (SSE)
    hooks/
      useChat.ts                      Core state: messages, streaming, checkpoints, conversations, exploration
      useKeyboardOpen.ts              Detects virtual keyboard via focusin/focusout (hides nav)
      useVoiceInput.ts                Voice input via Deepgram
    sage/
      call-sage.ts                    Pipeline: parallel DB reads -> extraction (background) -> prompt -> stream (delimiter buffer) -> classify or skip
      classifier.ts                   Haiku checkpoint detection + processing text (fallback when no manual entry block)
      confirm-checkpoint.ts           Shared confirm utility: composed content, changelog archive, pattern limits
      extraction.ts                   Sonnet extraction pre-pass: layer signals, language bank, checkpoint gate, sage brief
      generate-summary.ts             Shared Haiku summary generation (TITLE: prefix + body)
      system-prompt.ts                Sage system prompt with dynamic context + extraction context + exploration focus
    supabase/
      admin.ts                        Service role client (bypasses RLS)
      client.ts                       Browser client
      server.ts                       Server-side client (cookies)
    utils/
      sse-parser.ts                   Client-side SSE stream parser
      format.tsx                      Shared utils: renderMarkdown, formatShortDate
```

## Component Structure — MobileSession

MobileSession.tsx was decomposed into focused sub-components:

- **ChatInput.tsx**: Ghost input container, textarea with auto-resize, send button, long-message delay logic. Owns its own `input`, `inputFocused` state and `textareaRef`.
- **SessionDrawer.tsx**: Side drawer overlay with backdrop, session list, new session button. Receives `open`/`onClose` props and conversation data.
- **MobileSession.tsx**: Retains all message rendering — checkpoint cards, assistant messages (Sage panels with dissolve overlays), user messages, typing indicator (three-dot pulse), and error display. Owns `drawerOpen`, `checkpointActionState` state.

**Rules:**
- Message rendering stays in MobileSession. Do not extract checkpoint cards, assistant messages, user messages, typing indicator, or error display.
- New chat UI features go in MobileSession unless fully independent of the message list.
- Do not duplicate `renderMarkdown` or type interfaces. Import from `@/lib/utils/format` and `@/lib/types`.

**Shared modules:**
- `src/lib/types.ts` — `ChatMessage`, `ManualComponent`, `ActiveCheckpoint`, `ExplorationContext`. All components import from here.
- `src/lib/utils/format.tsx` — `renderMarkdown`, `formatShortDate`. Used by MobileSession and SessionDrawer.

## What Works End-to-End

- Auth: magic link + Google OAuth, middleware redirect, session refresh via middleware cookie handlers
- Onboarding: 5-screen editorial flow (Brand → Time → How → Honesty → Seed), dissolve transition into chat, skip for returning users
- Logout: Settings → Log out → server-side cookie clear → redirect to login
- Streaming chat with Sage: SSE, optimistic UI, placeholder message with atomic index capture, retry on error
- Sliding window: first 2 + last 48 when >50 messages
- Checkpoint detection (inline manual entry from Sage or Haiku fallback), inline cards, confirm/reject/refine
- Manual building: upsert to manual_components with NULL name handling, manual tab with markdown rendering
- Bottom nav: 4 tabs, SVG icons + labels, accent color active state, 0.4s transition
- Delete everything: dev-reset API + localStorage.clear + reload
- Session summary: Haiku, fire-and-forget on stale sessions (>30 min)
- Session history: side drawer from menu button, browse/switch past sessions, start new session (marks previous as completed + generates summary)
- Dev simulate: Settings → "Simulate user" → auto-switches to Session tab, messages populate in real-time, stops at checkpoint for manual action

## Not Yet Functional

- **Export manual**: Display-only in Settings ("PDF or text" label, no handler)
- **Guidance tab**: Locked until 1 confirmed. Unlocked state is placeholder only.
- **"Still true?"**: Label on manual components has no click handler

## Drift Log

This file was written from a full codebase audit on 2026-02-23. If you modify the codebase, update this file. Key areas that drift:
- API route contracts (new params, changed responses)
- Color tokens or font sizes in components vs what's documented here
- New localStorage keys
- Dead feature cleanup (e.g. removing `calibration_ratings` from schema)

**2026-02-23 — Session History feature**
- Added `GET /api/conversations` and `POST /api/conversations/complete` routes
- Added `src/lib/sage/generate-summary.ts` (shared Haiku summary utility, extracted from `session/summary/route.ts`)
- `useChat.ts` now manages `conversations[]` state, exports `switchConversation`, `startNewSession`, `refreshConversations`
- `call-sage.ts` and `system-prompt.ts` now pass/render `sessionCount` for Sage context

**2026-02-23 — Session drawer redesign**
- `MobileSession.tsx` rewritten: removed idle/active state toggle, replaced with always-on chat + side drawer
- Removed: `sessionActive` state, hero card, older sessions list, new session input, `formatDaysSince`, particles, back button
- Added: `drawerOpen` state, hamburger menu button (top-left), fixed-position side drawer with session list, backdrop overlay
- Drawer pattern: menu button → slide-from-left drawer (80vw, max 320px) → "New session" button + session list with active indicator
- Dead features: session hub idle state (replaced by drawer)
- `MainApp.tsx` passes `conversations.length` to fix session count bug in Settings
- Session history moved from "Not Yet Functional" to "What Works End-to-End"

**2026-02-23 — 5-layer model migration**
- Migrated from legacy 3-layer model to 5-layer model per Product Brief v1.3
- Old layers: 1=What Drives You, 2=How You React, 3=How You Relate
- New layers: 1=What Drives You, 2=Your Self Perception, 3=Your Reaction System, 4=How You Operate, 5=Your Relationship to Others
- Updated: `schema.sql` CHECK constraint, `system-prompt.ts` (layerNames, descriptions, mode triggers, readiness gate), `classifier.ts` (JSON schema, layer guide), `MobileManual.tsx` (LAYER_TYPES, upcoming layers array, empty state check)
- `MobileGuidance.tsx` gate lowered from `>= 5` to `>= 1` (guidance available with any confirmed content)
- DB migration required: `ALTER TABLE manual_components DROP CONSTRAINT ...; ALTER TABLE manual_components ADD CONSTRAINT ... CHECK (layer in (1, 2, 3, 4, 5));`

**2026-02-24 — Checkpoint optimization**
- **First-session acceleration**: `system-prompt.ts` injects conditional FIRST-SESSION ACCELERATION block when `manualComponents.length === 0`, targeting first checkpoint at 4-5 turns instead of 8-15. Also adds a checkpoint explanation message for Sage to weave into 2nd-3rd response.
- **Classifier threshold**: `classifier.ts` now accepts `isFirstSession` param; lowers word threshold from 100+ to 60+ for first-session users. `call-sage.ts` computes and passes the flag.
- **processingText visible**: `useChat.ts` now stores `processingText` from `message_complete` SSE events. *(processingText display and particles removed in 2026-03-02 cleanup.)*
- **Haiku model ID fix**: Updated from `claude-haiku-4-5-20241022` (404) to `claude-haiku-4-5-20251001` in `classifier.ts` and `generate-summary.ts`. Removed debug logging from `anthropic.ts`.

**2026-02-24 — Dev simulate feature**
- Added `POST /api/dev-simulate` route (Edge Runtime). Runs a simulated conversation with Sage using pre-scripted user messages. Stops at first checkpoint. Streams SSE events (started, turn, turn_complete, checkpoint, complete, error).
- `MobileSettings.tsx` gains "Simulate user" button with `onSimulationEvent` callback prop. Calls event handler at each stage: `"start"` (first turn), `"turn"` (each subsequent turn), `"checkpoint"` (when checkpoint fires).
- `MainApp.tsx` lifts `activeTab` state (was previously internal to `MobileLayout`). `handleSimulationEvent` callback calls `loadConversation(id)` on every event and `setActiveTab("session")` on start — user sees messages populate in real-time.
- `MobileLayout.tsx` now accepts `activeTab` and `onTabChange` as props (no longer manages own tab state).
- `useChat.ts` gains `loadConversation(id)` — loads messages from DB without guards (unlike `switchConversation` which has same-id and isLoading guards). Detects pending checkpoints in the last message and sets `activeCheckpoint` state so checkpoint cards render from DB-loaded messages.

**2026-02-25 — Onboarding flow replacement**
- Replaced 3-step onboarding (WelcomeCard → SoundCard → FocusCard) with 5-screen editorial flow (Brand → Time Investment → How It Works → Honesty Contract → Seed Input).
- New files: `OnboardingInfoScreen.tsx` (shared info screen with inline SVG icons + stagger animations), `OnboardingSeedScreen.tsx` (textarea + submit).
- Rewrote `OnboardingOverlay.tsx`: 5 screens, ambient radial glow, dash pagination, crossfade transitions, dissolve-to-chat sequence.
- Rewrote `useOnboarding.ts`: simplified to phase-based state machine (`hidden → onboarding → dissolving → complete`), removed blur/dismiss logic.
- `MainApp.tsx`: replaced blur overlay approach with visibility wrapper div + opacity transitions.
- `MobileLayout.tsx`: removed `isBlurred` prop.
- `MobileSession.tsx`: removed `onInputFocus` prop, removed `focused` state.
- Deleted: `WelcomeCard.tsx`, `SoundCard.tsx`, `FocusCard.tsx`.
- Removed `mantle_onboarding_dismissed` localStorage key (no longer used).

**2026-02-25 — Logout**
- Added `POST /api/auth/logout` route — uses server-side Supabase client to clear HttpOnly auth cookies (browser client cannot clear these).
- Added "Log out" button in `MobileSettings.tsx` between Account and Session history. Calls the API route then redirects to `/login`.
- Logout moved from "Not Yet Functional" to "What Works End-to-End".

**2026-02-25 — Chat UI fixes**
- Restored `alignSelf: "flex-end"` on user messages (accidentally removed in prior session's padding fix).
- Checkpoint card padding aligned with chat messages: removed extra right padding and `maxWidth: 320px` from checkpoint body.

**2026-02-25 → 2026-02-26 — Manual redesign, Explore with Sage, chat restyling, dev login**
- **Manual page rewrite**: `MobileManual.tsx` now renders via `buildLayers(components)` from `layer-definitions.ts`, with `EmptyLayer.tsx` and `PopulatedLayer.tsx` sub-components. Card-based layout with expand/collapse narratives, `LayerTooltip.tsx` for info popovers, `PatternItem.tsx` for expandable patterns. Dev state switcher (E/P/U/M) in top-right corner.
- **Explore with Sage**: New `ExplorationContext` type + `startExploration()` in `useChat.ts`. `POST /api/chat` now accepts optional `explorationContext` body field. `system-prompt.ts` injects `EXPLORATION FOCUS` block. `MainApp.tsx` orchestrates multi-phase interstitial transition (transitioning → loading → revealing). Manual sub-components have "Explore with Sage" buttons.
- **Chat restyling**: `MobileSession.tsx` Sage messages render in `--color-surface-sage` panels with dissolve overlays. Checkpoint cards use MeadowZone tokens + `warmPulse` animation. Button labels changed to "Write to manual" / "Not quite" / "Not at all". Three-dot typing indicator replaces single pulsing dot. Ghost input with focus-reactive border and whisper placeholder.
- **Session titles**: `generate-summary.ts` now requires `TITLE:` prefix in summaries. `GET /api/conversations` extracts `title` and includes `preview` (first user message) in response.
- **Login page**: Changed from magic link to email/password auth (`signInWithPassword` / `signUp`). "Dev Login" button (non-production) for quick access.
- **Dev login route**: New `POST /api/dev-login` (Edge, production-blocked). Looks up user via `DEV_USER_EMAIL` env var, generates magic link token, sets session cookies directly.
- **ProcessingIndicator.tsx**: New component with three tiers (normal/deeper/heavy) and breathing animations. Defined but currently unused. *(Deleted in 2026-02-27 cleanup.)*
- **New CSS tokens**: `--color-orb-normal`, `--color-orb-deeper`, `--color-orb-heavy` (both themes). New keyframes: `sageBreathNormal`, `sageBreathDeeper`, `sageBreathHeavy`, `sageTextFadeIn`. *(Deleted in 2026-02-27 cleanup.)*

**2026-02-26 — MobileSession component extraction**
- Extracted `ChatMessage`, `ManualComponent`, `ActiveCheckpoint`, `ExplorationContext` interfaces to `src/lib/types.ts`. Replaced 7 duplicate definitions across MobileSession, useChat, MobileManual, system-prompt, call-sage, PopulatedLayer, EmptyLayer, PatternItem.
- Extracted `renderMarkdown` and `formatShortDate` to `src/lib/utils/format.tsx`.
- Extracted session drawer (backdrop + panel + session list) from `MobileSession.tsx` into `SessionDrawer.tsx`.
- Extracted chat input (ghost container + textarea + send button + long-message delay) from `MobileSession.tsx` into `ChatInput.tsx`.
- MobileSession.tsx retains: message rendering, checkpoint cards, typing indicator, error display, header.

**2026-02-27 — Inline manual entry composition + extraction layer**
- **Extraction layer**: New `src/lib/sage/extraction.ts` — Sonnet-powered pre-pass producing `ExtractionState` (layer signals, language bank, depth tracking, checkpoint gate, next prompt, sage brief). Runs in **parallel** with Sage (fire-and-forget Promise, not awaited). Sage uses PREVIOUS turn's extraction state from DB. Zero added latency.
- **Inline manual entry**: Sage composes polished manual entries using `|||MANUAL_ENTRY|||` / `|||END_MANUAL_ENTRY|||` delimiter blocks. Streaming delimiter buffer in `call-sage.ts` prefix-matches to suppress the block from reaching the client. When present, Haiku classifier is skipped.
- **`system-prompt.ts`**: Fully replaced. New signature includes `extractionContext` and `isFirstCheckpoint` params. Includes `|||MANUAL_ENTRY|||` format instructions, extraction context integration, checkpoint self-gating criteria.
- **`call-sage.ts`**: Major rewrite — parallel DB reads via `Promise.all`, background extraction, delimiter buffer logic, dual-path checkpoint detection (manual entry vs classifier).
- **`confirm-checkpoint.ts`**: New shared utility. Uses `composed_content` from `checkpoint_meta`, falls back to `msg.content`. Archives previous versions to `manual_changelog`. Handles patterns (max 2 per layer, oldest archived when exceeded). Sets `source_message_id`.
- **`checkpoint/confirm/route.ts`**: Replaced inline confirm logic with `confirmCheckpoint()` call.
- **`sse-parser.ts`**: Added `cleanContent` and `nextPrompt` fields to `MessageCompleteEvent`.
- **`useChat.ts`**: Uses `cleanContent` when present for display text.
- **`dev-simulate/route.ts`**: Uses `confirmCheckpoint()` utility for auto-confirm. Captures `cleanContent`.
- **`dev-reset/route.ts`**: Added `manual_changelog` deletion.
- **DB migrations**: `conversations.extraction_state` JSONB column. `manual_changelog` table with indexes and RLS policy.

**2026-02-27 — Manual page MeadowZone integration**
- **`MobileManual.tsx`**: Scroll container changed from `padding: 24px 24px 120px` to zero horizontal padding so MeadowZone panels go edge-to-edge. Page title "Your Manual" gets its own `padding: 24px 24px 0`. Empty layers wrapped in a padded div. Top scroll fade added via `maskImage`/`WebkitMaskImage` gradient (same as Session page).
- **`PopulatedLayer.tsx`**: Layer label `lineHeight` changed from 1.3 to 1 to eliminate gap between feather ending and first text.
- MeadowZone panels already wrapped populated layers (from prior commit). This change removed the flex container wrapper and any parent padding that prevented edge-to-edge rendering.
- No changes to `MeadowZone.tsx` (feather height already 70px).
- Updated Manual section in CLAUDE.md UI Spec.

**2026-02-27 — Hide bottom nav when keyboard opens**
- New `src/lib/hooks/useKeyboardOpen.ts` — detects text input focus via document-level `focusin`/`focusout` with 100ms debounced blur.
- `MobileLayout.tsx` consumes the hook: hides nav + expands content panels to `bottom: 0` when keyboard open.
- `MobileNav.tsx` gains `hidden` prop: `translateY(100%)` slide-out with 0.25s transition.

**2026-02-27 — Codebase cleanup (Tiers 1 + 2)**
- **Dead code removed**: `ProcessingIndicator.tsx` (never imported), `--color-orb-*` CSS tokens (3 themes), `sageBreathNormal/Deeper/Heavy` + `sageTextFadeIn` keyframes, unused `ExplorationContext` re-export from `useChat.ts`.
- **Production guards added**: `dev-reset` and `dev-simulate` now return 403 in production (matching `dev-login` and `dev-populate`).
- **Error handling hardened**: `useChat.ts` catch blocks now log errors instead of swallowing silently. API routes (`dev-reset`, `auth/logout`, `account/delete`) wrapped in try-catch. `conversations` route checks Supabase `error` objects. `anthropic.ts` validates `ANTHROPIC_API_KEY` at call time instead of using non-null assertion.
- **CLAUDE.md drift fixes**: Added `POST /api/account/delete` and `POST /api/dev-populate` to API Routes. Documented Depth theme (blue `#7B9EC4`). Fixed MobileManual description (uses real data via `buildLayers`, not mock data). Updated file tree (removed ProcessingIndicator, added useKeyboardOpen, added missing route files).

**2026-03-02 — UI refactor: cleanup, consistency, token centralization**
- **Sound/audio removed** (Step 1): Deleted `AudioProvider.tsx`, `MobileSoundSelector.tsx`, `ambient-player.ts`, `public/audio/*.mp3`. Removed all sound imports/state/JSX from `MobileSession.tsx`, `MobileManual.tsx`, `MobileSettings.tsx`, `layout.tsx`. Replaced sound indicator with 44x44 spacer div in session/manual headers.
- **Theme toggle removed** (Step 2): Deleted Ember and Depth `[data-theme]` CSS blocks from `globals.css`. Removed blocking `<script>` from `layout.tsx`. Removed theme state/toggle/UI from `MobileSettings.tsx`. Sage is now the only theme — no `data-theme` attribute on `<body>`.
- **Keyframes centralized** (Step 3): Moved 7 inline `@keyframes` from component `<style>` blocks into `globals.css`: `mantleSpinner`, `mantleFadeIn`, `explorationGlow`, `manualAtmoFadeIn`, `layerFadeUp`, `tooltipFadeIn`, `tooltipFadeInUp`. Removed `<style>` tags from `MainApp.tsx`, `login/page.tsx`, `MobileManual.tsx`, `PopulatedLayer.tsx`, `LayerTooltip.tsx`.
- **Tailwind className removed** (Step 4): Converted all `className` instances in `MobileSession.tsx` (15+) and `ChatInput.tsx` (3) to inline `style={{}}`. Only `layout.tsx` retains `className` (Next.js font variables + `antialiased`).
- **Hardcoded colors tokenized** (Step 5): Added 30+ new CSS custom properties to `:root` in `globals.css`. Replaced hardcoded hex/rgba values across 9 files: `MobileLayout.tsx`, `MobileSession.tsx`, `ChatInput.tsx`, `MobileSettings.tsx`, `SessionDrawer.tsx`, `PopulatedLayer.tsx`, `PatternItem.tsx`, `EmptyLayer.tsx`. New token groups: `--color-surface-sage`, `--color-shell`, `--color-sage-text`, `--color-user-text`, `--color-input-text`, `--color-accent-muted`, `--color-error-*`, `--color-backdrop-*`, `--color-input-border-*`, `--color-input-placeholder`, `--color-empty-*`, `--cp-pattern-*`, `--cp-explore-*`, `--cp-link`. SVG stroke/fill attributes intentionally left hardcoded.
- **Shared component primitives** (Step 6): Created `src/components/shared/` with 3 components: `ConfirmationModal.tsx` (extracted 2 identical modals from MobileSettings), `SettingsRow.tsx` (replaces repeated title/subtitle/divider pattern across all settings items), `ExploreWithSageButton.tsx` (extracted identical button+chevron from PopulatedLayer, PatternItem, LayerTooltip — supports `meadow` and `dark` variants). MobileSettings.tsx reduced from ~855 to ~415 lines.
- **CLAUDE.md updated**: Rewrote Color System section (single theme, all tokens documented). Updated Settings spec (removed Theme/Sound rows, added Delete account). Updated Session header (spacer instead of sound indicator). Updated Manual spec (tokens instead of hardcoded values). Updated Dead Features, localStorage keys, file tree (added shared/), What Works, Known Issues.

**2026-03-02 — Post-refactor audit cleanup**
- **Dead CSS tokens removed**: `--color-warm`, `--cp-surface`, `--cp-surface-light`, `--cp-glow-a`, `--cp-glow-b`, `--cp-g1` through `--cp-g6`, `--color-error-dim` (11 tokens).
- **Missed token replacements**: `ChatInput.tsx` `#7A8B72` → `var(--color-accent-muted)` (send/mic icons). `PopulatedLayer.tsx` `#5E7054` → `var(--cp-text-accent)` (chevron stroke).
- **Particles removed**: Deleted `SessionParticles.tsx`. Removed import, `isConverging` state, convergence effect, and `<SessionParticles>` render from `MobileSession.tsx`. Removed 5 keyframes from `globals.css` (`particleDrift1-4`, `particleConverge`). Removed dead `processingTextFadeIn` keyframe.

**2026-03-03 — Onboarding bug cleanup + hardening**
- **promptAuth reset fix**: `useChat` now exports `resetPromptAuth()`. `MainApp` calls it on auth modal dismiss/success. Previously `promptAuth` stayed `true` permanently, preventing re-show on subsequent checkpoints.
- **AuthPromptModal improvements**: Added `mantle_pending_conversion` localStorage flag before Google OAuth redirect (cleaned up on app reload in MainApp). Added disclaimer text: "Already have an account? Your current session will continue — create a new account to save this work."
- **Google OAuth on LoginScreen**: Added `signInWithOAuth({ provider: "google" })` with "or" divider between email/password form and Google button.
- **CLAUDE.md rewrite**: Replaced outdated Onboarding Flow section (referenced deleted OnboardingOverlay/OnboardingInfoScreen/OnboardingSeedScreen/useOnboarding). Documented actual pre-auth flow (OnboardingFlow → EntryScreen → LoginScreen → InfoScreens → SeedScreen → AuthPromptModal → AmbientGlow). Updated localStorage/sessionStorage keys, file tree, dead features list, middleware section.

## Known Issues

- **Classifier aggressiveness**: Haiku may flag shorter reflections as checkpoints. The word heuristic (100+ for returning users, 60+ for first-session) is in the classifier's system prompt but not enforced in code — if Haiku returns `isCheckpoint: true` with a layer, it's accepted.
- **Auth token expiry**: No explicit token refresh on the client. Relies on middleware calling `getUser()` on each page request (which refreshes cookies). If user stays on the SPA without page navigation, token could expire. API routes return 401 -> redirect to `/login` as fallback.
- **Ghost conversation rows**: If `useChat` init sends `conversationId: null` to `/api/chat` and the user somehow also sends a message before state updates, a second conversation could be created. Mitigated by `initStarted.current` ref guard and `isLoading`/`isStreaming` checks, but not impossible.
- **OAuth redirect config**: Redirect URL is built dynamically (`window.location.origin + "/auth/callback"`). Supabase dashboard must have each environment's URL (localhost:3000, production domain) in the allowed redirect URLs. No `.env` variable for this.
- **Dead column**: `calibration_ratings` on `conversations` table — exists in schema, never used.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL          — https://nkmperzwcmttdkxwhbiv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     — Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY         — Supabase service role key (server-only, bypasses RLS)
ANTHROPIC_API_KEY                 — Anthropic API key
DEV_USER_EMAIL                    — (optional) Email for /api/dev-login auto-login target
```
