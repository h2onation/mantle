# Mantle

Mantle is a mobile-first web app where an AI conversationalist called Sage builds a five-layer behavioral model ("User Manual") through deep conversation — nothing enters the manual unless the user confirms it.

- **Repo**: https://github.com/h2onation/mantle.git
- **Live URL**: Not yet deployed (or configured entirely via Vercel dashboard — no project-level config files exist)
- **Supabase project ref**: `nkmperzwcmttdkxwhbiv`
- **Last verified**: 2026-02-27

## Worktree Setup

Every new worktree needs `.env.local`. Always run `ln -s /Users/jeffwaters/mantle/.env.local .env.local` when creating a new worktree. This is the first step before anything else.

## Git Workflow

- When asked to "merge and push", ALWAYS merge the feature branch INTO main (not main into the feature branch) unless explicitly told otherwise.
- After deleting worktrees or branches, verify the shell's cwd is still valid before running further commands.
- Never delete .env.local or other environment files during branch/worktree cleanup.

## Preview & UI Verification

- When using preview_screenshot or preview_eval, take extra care with click selectors. Prefer data-testid attributes or unique selectors over generic button/tab selectors.
- If a click fails, try alternative selectors (aria-label, text content, CSS class) rather than retrying the same selector.
- If auth session is lost after page reload, restart the dev server and re-authenticate before continuing verification.

## Build & Deploy

- Always use non-interactive flags when running scaffolding commands (e.g., `npx create-next-app --yes` or `--no-install` then `npm install`).
- After any code changes, run `npm run build` to verify before committing.
- This project deploys on Vercel — ensure builds pass locally before merging to main.

## API & Model References

- When referencing Anthropic model IDs, always verify the latest model version via web search rather than guessing from memory. Model IDs change frequently (e.g., claude-3-5-sonnet-20251001 vs 20241022).
- When integrating third-party APIs (Deepgram, etc.), start with the simplest auth approach (direct API key) before attempting complex token grant flows.

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
- **Never use real user emails for dev-login or testing.** Only use test@test.com or your own email. Claude Code sessions must not authenticate as other users' accounts.

> **CRITICAL: Never authenticate as a real user.** For testing, always use test@test.com or create a fresh anonymous user. Never generate magic links for any email other than your own or test@test.com.

## Versioning

Two version constants in `src/lib/version.ts`:
- **`APP_VERSION`** — tracks UI, components, hooks, utilities, API routes (everything in `src/` except Sage prompt files)
- **`SAGE_VERSION`** — tracks Sage behavior: `system-prompt.ts` and `extraction.ts` only

### When to bump

| Files changed | Bump |
|---------------|------|
| `src/lib/sage/system-prompt.ts` or `src/lib/sage/extraction.ts` | `SAGE_VERSION` |
| Any other `src/` file | `APP_VERSION` |
| Both categories | Both versions |

**Bump once per branch, in the first commit that touches relevant files.** Do not bump again on subsequent commits within the same branch.

### How to bump

Use **minor** increments (x.Y.0) for features, redesigns, or meaningful changes. Use **patch** increments (x.y.Z) for bug fixes and small tweaks. Judgment call — when in doubt, use minor.

### Merge conflict resolution

When merging branches that both modified `version.ts`:
- Take the **higher value** for each version independently
- Do not create an additional bump in the merge commit itself
- Example: Branch A has APP 2.2.0 / SAGE 1.0.0, Branch B has APP 2.0.0 / SAGE 2.1.0 → merge result: APP 2.2.0 / SAGE 2.1.0

### Pre-commit hook

The hook uses an interactive `read -p` prompt that Claude Code cannot answer. **Always bump `version.ts` before committing** when `src/` files changed — don't rely on the hook's skip option. Stage `version.ts` alongside your other changes.

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
- `confirm-checkpoint.ts`: `composeManualEntry()`
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

**Preview viewport**: Always call `preview_resize` with `preset: "mobile"` immediately after `preview_start`. The app is mobile-only (430px max-width centered shell), so desktop viewport (1280x800 default) will show the shell centered in a wide dark background, making the preview panel useless.

## Database Schema

Five tables in `supabase/schema.sql`: **profiles** (auto-created via trigger), **conversations** (status, summary, extraction_state JSONB), **messages** (role, content, is_checkpoint, checkpoint_meta JSONB, processing_text), **manual_components** (user-level, layer 1-5, type component/pattern), **manual_changelog** (archives previous versions on update).

**Gotcha**: `conversations.calibration_ratings` is a dead column — exists in schema, never read or written.

**`checkpoint_meta` JSON shape** (not in schema.sql, only in code):
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

**manual_components accumulation rules:**
- **Components**: Exactly 1 per layer per user (max 5 total). Upsert replaces. Partial unique index `unique_component_per_layer`.
- **Patterns**: Max 2 per layer per user. Same name = replace. 3rd pattern archives oldest to `manual_changelog`. Partial unique index `unique_pattern_name_per_layer`.
- Upsert uses select-then-insert/update (not `ON CONFLICT`) because partial unique indexes make standard upsert tricky.

**admin_access_logs** — Audit trail for admin data access. Logs every conversation/message view with admin_id, target_user_id, conversation_id, action, timestamp. RLS: admins can insert (own entries only) and read. Admin role determined by `is_admin()` Postgres function checking JWT `app_metadata.role`.

## API Routes

| Method | Path | Runtime | Purpose |
|--------|------|---------|---------|
| POST | `/api/chat` | Edge | Stream Sage response (SSE). Body: `{ message, conversationId, explorationContext? }` |
| POST | `/api/checkpoint/confirm` | Edge | Confirm/reject/refine checkpoint + stream follow-up |
| GET | `/api/manual` | Node | Return manual components for authenticated user |
| GET | `/api/conversations` | Node | List conversations with metadata (title, preview, message_count) |
| POST | `/api/conversations/complete` | Edge | Mark conversation completed + generate summary |
| POST | `/api/session/summary` | Edge | Generate summary via shared utility |
| POST | `/api/dev-simulate` | Edge | Dev-only: run simulated conversation until checkpoint |
| POST | `/api/dev-login` | Edge | Dev-only: passwordless login via `DEV_USER_EMAIL` |
| POST | `/api/dev-reset` | Edge | Dev-only: delete all user data (not profile/auth) |
| POST | `/api/dev-populate` | Edge | Dev-only: populate manual with mock content |
| POST | `/api/account/delete` | Edge | Delete all user data + auth user |
| POST | `/api/auth/logout` | Node | Server-side logout (clears HttpOnly cookies) |
| GET | `/auth/callback` | Node | OAuth callback |
| GET | `/api/admin/users` | Node | Admin-only: list all users with conversation/component counts |
| POST | `/api/admin/conversations` | Node | Admin-only: list conversations for a user. Logs access. |
| POST | `/api/admin/messages` | Node | Admin-only: view full message thread + extraction state. Logs access. |

Dev routes (`dev-*`) return 403 in production.

## Three Supabase Clients

| Client | File | Key | Purpose |
|--------|------|-----|---------|
| **Admin** | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. All DB writes in API routes. |
| **Server** | `lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies | Auth verification only (`getUser()`). Never does data operations. |
| **Browser** | `lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side auth + initial data reads through RLS. |

**Pattern**: Server client authenticates the user, admin client does all database work.

## SSE Event Protocol

All streaming responses (chat + checkpoint confirm) use the same format:

```
data: {"type":"text_delta","text":"chunk of text"}
data: {"type":"message_complete","messageId":"uuid","conversationId":"uuid","checkpoint":null|{"isCheckpoint":true,"layer":1,"type":"component","name":"Name"},"processingText":"tracking phrase","nextPrompt":"hint text...","cleanContent":"stripped text if delimiter was found"}
data: {"type":"error","message":"human-readable error"}
```

- `text_delta`: streamed token by token. Delimiter buffer suppresses `|||MANUAL_ENTRY|||` from reaching client.
- `message_complete`: final event. `cleanContent` included when delimiter was found. `nextPrompt` is extraction's suggested placeholder.
- `error`: emitted on failure, stream closes.
- Client parses via `parseSSEStream` in `src/lib/utils/sse-parser.ts`

## Checkpoint Lifecycle

Two detection paths, both ending at the same confirm flow:

**Path A — Inline manual entry (preferred):** Sage includes a `|||MANUAL_ENTRY|||` delimiter block at the end of its response with composed content, layer, type, name, and changelog. The delimiter buffer in `call-sage.ts` suppresses this from the stream. Classifier is skipped — all metadata comes from Sage directly.

**Path B — Haiku classifier + Sonnet composition (fallback):** When Sage doesn't produce a manual entry block, the Haiku classifier runs post-stream on every response. Returns `{ isCheckpoint, layer, type, name, processingText }`. Checkpoint = sustained reflection (100+ words for returning users, 60+ for first-session). If a checkpoint is detected, `composeManualEntry()` (Sonnet) runs to compose a polished manual entry from the conversational text, so `composed_content` is populated at creation time — not deferred to confirmation.

**Full cycle:**

1. **call-sage.ts**: Sage responds. Stream parsed with delimiter buffer. If `|||MANUAL_ENTRY|||` found → Path A (skip classifier, use Sage's metadata). Otherwise → Path B (run classifier, then `composeManualEntry()` if checkpoint detected). Both paths save `composed_content` to `checkpoint_meta` at creation time. `is_checkpoint`, `checkpoint_meta`, and `processing_text` written to message row.
2. **Client (useChat.ts)**: `message_complete` event carries checkpoint data + `cleanContent` (stripped text). Sets `activeCheckpoint` state. MobileSession renders confirm/reject/refine buttons inline.
3. **confirm-checkpoint.ts**: `confirmCheckpoint()` utility reads `composed_content` from `checkpoint_meta` (always populated by either Path A or Path B) or falls back to `msg.content` as a safety net. Archives previous version to `manual_changelog` if updating an existing component. Handles patterns (max 2 per layer). Sets `source_message_id`.
4. **checkpoint/confirm/route.ts**: On confirm, calls `confirmCheckpoint()`. Inserts system message (`[User confirmed the checkpoint]`, etc.). Streams Sage's follow-up.
5. **call-sage.ts** (next call): System messages in DB are mapped to synthetic user messages in conversation history so Sage sees them naturally. E.g. `"[User confirmed the checkpoint]"` becomes `"I confirmed that checkpoint. That resonates."`

## Onboarding Flow (Pre-Auth)

`OnboardingFlow.tsx` orchestrates a pre-auth flow on `/login`. Four views: `"entry" | "login" | "onboarding" | "seed"`. Components in `src/components/onboarding/`.

**New user flow**: Entry → Get Started → Info screens (2 swipeable) → Seed screen → `signInAnonymously()` → sets localStorage flags → stores seed in `sessionStorage` → `router.push("/")`.

**Returning user flow**: Entry → Log In → email/password or Google OAuth → `router.push("/")`.

**Guest-to-real conversion**: After first checkpoint confirm, backend detects `user.is_anonymous` → returns `promptAuth: true` in SSE → `AuthPromptModal` shows. Email: `updateUser()`. Google: `linkIdentity()` with `mantle_pending_conversion` localStorage flag.

**Seed handoff**: `sessionStorage.setItem("mantle_seed_text", text)` in SeedScreen → `sessionStorage.getItem` + `removeItem` in MainApp → `sendMessage(seed)`.

## Color System

Single theme (Sage). All tokens defined in `:root` in `globals.css`. No `data-theme` attribute, no theme switching.

**Core tokens:**
```
--color-void:       #0C0B0A          page background
--color-surface:    #161513          cards, overlays
--color-text:       #E2E0DB          primary text
--color-text-dim:   rgba(226,224,219,0.55)   secondary (Sage messages)
--color-text-ghost: rgba(226,224,219,0.25)   tertiary (labels, meta)
--color-divider:    rgba(226,224,219,0.06)   borders
--color-accent:     #8BA888          primary accent
--color-accent-dim: rgba(139,168,136,0.4)    accent borders
--color-accent-ghost: rgba(139,168,136,0.08) accent backgrounds
--color-accent-glow:  rgba(139,168,136,0.12) checkpoint glow
```

See `globals.css` for full token list (chat surface, error, overlay, input state, checkpoint/meadow, pattern card, empty layer tokens).

## Typography

| Font | Variable | Weights | Role |
|------|----------|---------|------|
| Instrument Serif | `--font-serif` | 400 | Emotional/reflective content: session summary, checkpoint text, manual passages, headlines |
| DM Sans | `--font-sans` | 400, 500, 600 | Conversational UI: chat messages, buttons, input, form labels |
| JetBrains Mono | `--font-mono` | 400 | Metadata: nav labels, status lines, timestamps, progress indicators. Always uppercase with letter-spacing. |

## Current UI Spec

Detailed pixel values are in the component files. This section documents patterns and behavioral notes.

### Bottom Nav (`MobileNav.tsx`)
Four tabs: session, manual, guidance, settings. Fixed bottom, hides when keyboard opens (`useKeyboardOpen` hook). Active tab = `--color-accent`, inactive = `--color-text-ghost`.

### Session (`MobileSession.tsx`)
Always-on chat view + side drawer for session history. Header: hamburger menu (left) → "MANTLE" wordmark (center) → spacer (right). Messages render in Sage panels (`--color-surface-sage` bg) with top/bottom dissolve overlays. Typing indicator: three pulsing dots, shows when `(isLoading || isStreaming) && last message is user`. Checkpoint cards render inside `<MeadowZone>` with `--cp-*` tokens. Text is NOT streamed incrementally — buffered and shown in one shot after `parseSSEStream` completes.

### Manual (`MobileManual.tsx`)
Zero horizontal padding scroll container (panels go edge-to-edge). Populated layers wrap in `<MeadowZone>` — full-width feathered green panels. Empty layers render on dark void below. Dev state switcher (E/P/U/M) in top-right corner. Sub-components: `PopulatedLayer`, `EmptyLayer`, `PatternItem`, `LayerTooltip`.

### Guidance (`MobileGuidance.tsx`)
Locked until `confirmedCount >= 1`. Unlocked state is placeholder only ("coming soon").

### Settings (`MobileSettings.tsx`)
Items: Account, Log out, Session history, Export manual (display-only), Simulate user (dev), Delete data, Delete account. Uses shared `SettingsRow` and `ConfirmationModal` components.

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

### Admin Access
Admin role is set via JWT custom claims (`app_metadata.role = "admin"`), not a database column. Set/revoked only through direct SQL in Supabase SQL Editor. The `is_admin()` Postgres function checks the JWT claim and is used in all admin RLS policies. Admin routes are read-only (SELECT-only policies on user tables). Every conversation/message view is logged to `admin_access_logs`. Admin UI renders inside MobileSettings via the `AdminView` component, which returns null for non-admin users — completely absent from the DOM. Middleware blocks non-admin requests to `/api/admin/*` routes.

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
7. If no block → Haiku classifier runs as fallback (Path B). If checkpoint detected → `composeManualEntry()` (Sonnet) composes polished entry from conversational text + language bank
8. Both paths save `composed_content` to `checkpoint_meta` at creation time
9. Background extraction saves updated state to `conversations.extraction_state`

See "Checkpoint Lifecycle" for the full confirm flow.

### Critical Invariants

- `composed_content` must never be null on confirmed checkpoints. Three defenses: (1) Sage gets Manual Entry Format at `turnCount > 1` so it can produce `|||MANUAL_ENTRY|||` blocks (Path A), (2) `call-sage.ts` calls `composeManualEntry()` when classifier detects a checkpoint but Sage didn't produce the block (Path B), (3) `confirmCheckpoint()` falls back to `msg.content` as safety net
- Crisis text must never appear in manual entries (stripped in `confirmCheckpoint()` fallback path)
- `clinical_flag.level === "crisis"` blocks checkpoint gate entirely (in `formatExtractionForSage`)
- Checkpoint gate is quality-based (examples + mechanism + charged language), not turn-based
- First-checkpoint gate is lighter: 1 example (vs 2), mechanism OR behavior-driver link (vs both)

## Dead Features

Do not re-introduce: desktop layout, calibration/calibration_ratings, PromptCards, old onboarding (OnboardingOverlay/useOnboarding), synthetic first message, gate UI, advisor mode, SessionTimer, ENTRY SEQUENCE UI, insights page, reactive orb, session hub idle state, theme toggle, sound/audio, ambient particles.

**Gotcha**: `calibration_ratings` column still exists in `conversations` table schema — dead, never read or written.

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

## Component Structure — MobileSession

- **ChatInput.tsx**: Ghost input container, textarea with auto-resize, send button, long-message delay logic.
- **SessionDrawer.tsx**: Side drawer overlay with backdrop, session list, new session button.
- **MobileSession.tsx**: All message rendering — checkpoint cards, assistant messages (Sage panels), user messages, typing indicator, error display.

**Rules:**
- Message rendering stays in MobileSession. Do not extract checkpoint cards, assistant messages, user messages, typing indicator, or error display.
- New chat UI features go in MobileSession unless fully independent of the message list.
- Do not duplicate `renderMarkdown` or type interfaces. Import from `@/lib/utils/format` and `@/lib/types`.

**Shared modules:**
- `src/lib/types.ts` — `ChatMessage`, `ManualComponent`, `ActiveCheckpoint`, `ExplorationContext`. All components import from here.
- `src/lib/utils/format.tsx` — `renderMarkdown`, `formatShortDate`. Used by MobileSession and SessionDrawer.

## What Works End-to-End

- Auth: magic link + Google OAuth, middleware redirect, session refresh via middleware cookie handlers
- Onboarding: pre-auth flow (entry → info → seed → anonymous auth), dissolve transition into chat, skip for returning users
- Logout: Settings → Log out → server-side cookie clear → redirect to login
- Streaming chat with Sage: SSE, batch rendering (text buffered, shown in one shot), retry on error
- Sliding window: first 2 + last 48 when >50 messages
- Checkpoint detection (inline manual entry from Sage or Haiku fallback + Sonnet composition), inline cards, confirm/reject/refine
- Manual building: upsert to manual_components with NULL name handling, manual tab with markdown rendering
- Bottom nav: 4 tabs, SVG icons + labels, accent color active state, hides on keyboard open
- Delete everything: dev-reset API + localStorage.clear + reload
- Session summary: Haiku, fire-and-forget on stale sessions (>30 min)
- Session history: side drawer from menu button, browse/switch past sessions, start new session
- Dev simulate: Settings → "Simulate user" → auto-switches to Session tab, messages populate in real-time, stops at checkpoint

## Not Yet Functional

- **Export manual**: Display-only in Settings ("PDF or text" label, no handler)
- **Guidance tab**: Locked until 1 confirmed. Unlocked state is placeholder only.
- **"Still true?"**: Label on manual components has no click handler

## Drift Log

See `.claude/DRIFT_LOG.md`. Update that file when modifying the codebase.

## Known Issues

- **Classifier aggressiveness**: Haiku may flag shorter reflections as checkpoints. The word heuristic (100+ for returning users, 60+ for first-session) is in the classifier's system prompt but not enforced in code — if Haiku returns `isCheckpoint: true` with a layer, it's accepted.
- **Auth token expiry**: No explicit token refresh on the client. Relies on middleware calling `getUser()` on each page request (which refreshes cookies). If user stays on the SPA without page navigation, token could expire. API routes return 401 -> redirect to `/login` as fallback.
- **Ghost conversation rows**: If `useChat` init sends `conversationId: null` to `/api/chat` and the user somehow also sends a message before state updates, a second conversation could be created. Mitigated by `initStarted.current` ref guard and `isLoading`/`isStreaming` checks, but not impossible.
- **OAuth redirect config**: Redirect URL is built dynamically (`window.location.origin + "/auth/callback"`). Supabase dashboard must have each environment's URL (localhost:3000, production domain) in the allowed redirect URLs. No `.env` variable for this.
- **Admin JWT refresh**: After granting/revoking admin via SQL, the user must log out and back in. Existing sessions retain the old claim until token expiry (~1 hour).

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL          — https://nkmperzwcmttdkxwhbiv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     — Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY         — Supabase service role key (server-only, bypasses RLS)
ANTHROPIC_API_KEY                 — Anthropic API key
DEV_USER_EMAIL                    — (optional) Email for /api/dev-login auto-login target
```
