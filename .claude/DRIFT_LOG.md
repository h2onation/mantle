# Drift Log

This file tracks codebase changes session by session. Referenced from CLAUDE.md. Update this file when modifying the codebase.

Key areas that drift:
- API route contracts (new params, changed responses)
- Color tokens or font sizes in components vs what's documented
- New localStorage keys
- Dead feature cleanup (e.g. removing `calibration_ratings` from schema)

**2026-03-09 — Sage Opening: chip-based routing replaces seed text**
- `SeedScreen.tsx`: Removed textarea and seed text storage. Now renders age checkbox + "Begin" button only.
- `MainApp.tsx`: Removed seed handoff useEffect (no more sessionStorage seed text).
- `MobileSession.tsx`: Removed orientation box. Added welcome message ("Welcome. Let's start where you are at.") + 3 chip buttons for new users. Removed first-user-message hiding — chip text displays as normal message. Removed `confirmedComponents` from destructured props (unused after orientation box removal).
- `system-prompt.ts`: Replaced FIRST MESSAGE section (seed-based) with chip-based routing (Path A: meta Q&A, Path B: progressive narrowing, Path C: direct situation). Added convergence rules. Updated FIRST SESSION section.
- `system-prompt.test.ts`: Updated test to check for PATH A/B/C routing content instead of old seed/orientation references.
- Versions: APP 2.10.0, SAGE 2.4.0
- sessionStorage key `mantle_seed_text` is now dead — no longer set or read.

**2026-02-23 — Session History feature**
- Added `GET /api/conversations` and `POST /api/conversations/complete` routes
- Added `src/lib/sage/generate-summary.ts` (shared Haiku summary utility, extracted from `session/summary/route.ts`)
- `useChat.ts` now manages `conversations[]` state, exports `switchConversation`, `startNewSession`, `refreshConversations`
- `call-sage.ts` and `system-prompt.ts` now pass/render `sessionCount` for Sage context

**2026-02-23 — Session drawer redesign**
- `MobileSession.tsx` rewritten: removed idle/active state toggle, replaced with always-on chat + side drawer
- Removed: `sessionActive` state, hero card, older sessions list, new session input, `formatDaysSince`, particles, back button
- Added: `drawerOpen` state, hamburger menu button (top-left), fixed-position side drawer with session list, backdrop overlay
- Drawer pattern: menu button -> slide-from-left drawer (80vw, max 320px) -> "New session" button + session list with active indicator
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
- `MainApp.tsx` lifts `activeTab` state (was previously internal to `MobileLayout`). `handleSimulationEvent` callback calls `loadConversation(id)` on every event and `setActiveTab("session")` on start -- user sees messages populate in real-time.
- `MobileLayout.tsx` now accepts `activeTab` and `onTabChange` as props (no longer manages own tab state).
- `useChat.ts` gains `loadConversation(id)` -- loads messages from DB without guards (unlike `switchConversation` which has same-id and isLoading guards). Detects pending checkpoints in the last message and sets `activeCheckpoint` state so checkpoint cards render from DB-loaded messages.

**2026-02-25 — Onboarding flow replacement**
- Replaced 3-step onboarding (WelcomeCard -> SoundCard -> FocusCard) with 5-screen editorial flow (Brand -> Time Investment -> How It Works -> Honesty Contract -> Seed Input).
- New files: `OnboardingInfoScreen.tsx` (shared info screen with inline SVG icons + stagger animations), `OnboardingSeedScreen.tsx` (textarea + submit).
- Rewrote `OnboardingOverlay.tsx`: 5 screens, ambient radial glow, dash pagination, crossfade transitions, dissolve-to-chat sequence.
- Rewrote `useOnboarding.ts`: simplified to phase-based state machine (`hidden -> onboarding -> dissolving -> complete`), removed blur/dismiss logic.
- `MainApp.tsx`: replaced blur overlay approach with visibility wrapper div + opacity transitions.
- `MobileLayout.tsx`: removed `isBlurred` prop.
- `MobileSession.tsx`: removed `onInputFocus` prop, removed `focused` state.
- Deleted: `WelcomeCard.tsx`, `SoundCard.tsx`, `FocusCard.tsx`.
- Removed `mantle_onboarding_dismissed` localStorage key (no longer used).

**2026-02-25 — Logout**
- Added `POST /api/auth/logout` route -- uses server-side Supabase client to clear HttpOnly auth cookies (browser client cannot clear these).
- Added "Log out" button in `MobileSettings.tsx` between Account and Session history. Calls the API route then redirects to `/login`.
- Logout moved from "Not Yet Functional" to "What Works End-to-End".

**2026-02-25 — Chat UI fixes**
- Restored `alignSelf: "flex-end"` on user messages (accidentally removed in prior session's padding fix).
- Checkpoint card padding aligned with chat messages: removed extra right padding and `maxWidth: 320px` from checkpoint body.

**2026-02-25 -> 2026-02-26 — Manual redesign, Explore with Sage, chat restyling, dev login**
- **Manual page rewrite**: `MobileManual.tsx` now renders via `buildLayers(components)` from `layer-definitions.ts`, with `EmptyLayer.tsx` and `PopulatedLayer.tsx` sub-components. Card-based layout with expand/collapse narratives, `LayerTooltip.tsx` for info popovers, `PatternItem.tsx` for expandable patterns. Dev state switcher (E/P/U/M) in top-right corner.
- **Explore with Sage**: New `ExplorationContext` type + `startExploration()` in `useChat.ts`. `POST /api/chat` now accepts optional `explorationContext` body field. `system-prompt.ts` injects `EXPLORATION FOCUS` block. `MainApp.tsx` orchestrates multi-phase interstitial transition (transitioning -> loading -> revealing). Manual sub-components have "Explore with Sage" buttons.
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
- **Extraction layer**: New `src/lib/sage/extraction.ts` -- Sonnet-powered pre-pass producing `ExtractionState` (layer signals, language bank, depth tracking, checkpoint gate, next prompt, sage brief). Runs in **parallel** with Sage (fire-and-forget Promise, not awaited). Sage uses PREVIOUS turn's extraction state from DB. Zero added latency.
- **Inline manual entry**: Sage composes polished manual entries using `|||MANUAL_ENTRY|||` / `|||END_MANUAL_ENTRY|||` delimiter blocks. Streaming delimiter buffer in `call-sage.ts` prefix-matches to suppress the block from reaching the client. When present, Haiku classifier is skipped.
- **`system-prompt.ts`**: Fully replaced. New signature includes `extractionContext` and `isFirstCheckpoint` params. Includes `|||MANUAL_ENTRY|||` format instructions, extraction context integration, checkpoint self-gating criteria.
- **`call-sage.ts`**: Major rewrite -- parallel DB reads via `Promise.all`, background extraction, delimiter buffer logic, dual-path checkpoint detection (manual entry vs classifier).
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

**2026-02-27 — Hide bottom nav when keyboard opens**
- New `src/lib/hooks/useKeyboardOpen.ts` -- detects text input focus via document-level `focusin`/`focusout` with 100ms debounced blur.
- `MobileLayout.tsx` consumes the hook: hides nav + expands content panels to `bottom: 0` when keyboard open.
- `MobileNav.tsx` gains `hidden` prop: `translateY(100%)` slide-out with 0.25s transition.

**2026-02-27 — Codebase cleanup (Tiers 1 + 2)**
- **Dead code removed**: `ProcessingIndicator.tsx` (never imported), `--color-orb-*` CSS tokens (3 themes), `sageBreathNormal/Deeper/Heavy` + `sageTextFadeIn` keyframes, unused `ExplorationContext` re-export from `useChat.ts`.
- **Production guards added**: `dev-reset` and `dev-simulate` now return 403 in production (matching `dev-login` and `dev-populate`).
- **Error handling hardened**: `useChat.ts` catch blocks now log errors instead of swallowing silently. API routes (`dev-reset`, `auth/logout`, `account/delete`) wrapped in try-catch. `conversations` route checks Supabase `error` objects. `anthropic.ts` validates `ANTHROPIC_API_KEY` at call time instead of using non-null assertion.

**2026-03-02 — UI refactor: cleanup, consistency, token centralization**
- **Sound/audio removed**: Deleted `AudioProvider.tsx`, `MobileSoundSelector.tsx`, `ambient-player.ts`, `public/audio/*.mp3`. Removed all sound imports/state/JSX.
- **Theme toggle removed**: Deleted Ember and Depth `[data-theme]` CSS blocks. Sage is now the only theme.
- **Keyframes centralized**: Moved 7 inline `@keyframes` from component `<style>` blocks into `globals.css`.
- **Tailwind className removed**: Converted all `className` instances to inline `style={{}}`. Only `layout.tsx` retains `className`.
- **Hardcoded colors tokenized**: Added 30+ new CSS custom properties. Replaced hardcoded hex/rgba values across 9 files.
- **Shared component primitives**: Created `ConfirmationModal.tsx`, `SettingsRow.tsx`, `ExploreWithSageButton.tsx` in `src/components/shared/`.

**2026-03-02 — Post-refactor audit cleanup**
- Dead CSS tokens removed (11 tokens). Missed token replacements fixed. Particles removed (`SessionParticles.tsx` deleted, 5 keyframes removed).

**2026-03-03 — Onboarding bug cleanup + hardening**
- **promptAuth reset fix**: `useChat` now exports `resetPromptAuth()`. `MainApp` calls it on auth modal dismiss/success.
- **AuthPromptModal improvements**: Added `mantle_pending_conversion` localStorage flag before Google OAuth redirect. Added disclaimer text.
- **Google OAuth on LoginScreen**: Added `signInWithOAuth({ provider: "google" })` with "or" divider.

**2026-03-04 — Checkpoint quality-bar + Path B composition**
- **Checkpoint gate softened**: `system-prompt.ts` CHECKPOINTS section replaced hard extraction gate with quality-bar language. Sage now decides based on conversational material quality, not extraction permission.
- **Path B composition at creation time**: New `composeManualEntry()` function in `confirm-checkpoint.ts` (exported, called from `call-sage.ts` step 12c). When Haiku classifier detects a checkpoint but Sage didn't produce `|||MANUAL_ENTRY|||`, Sonnet composes a polished manual entry. Runs between classifier and DB save.
- **Composition guard**: `call-sage.ts` step 12c checks `hasComposedContent` before calling `composeManualEntry()`.

**2026-03-14 — Text Sage: Twilio SMS + phone linking**
- **New dependency**: `twilio` npm package added.
- **New `POST /api/sms/incoming`** (Node runtime): Twilio webhook handler. Validates Twilio signature, echoes incoming SMS back. Returns TwiML XML (even on error).
- **New `GET+POST /api/settings/link-phone`** (Node runtime): GET returns linked phone status. POST initiates (sends 6-digit code via Twilio) or verifies (checks code + expiry). Upserts `phone_numbers` table.
- **New `public/sage-contact.vcf`**: vCard for Sage with Twilio number +15305000927.
- **`MobileSettings.tsx`**: Added "TEXT SAGE" collapsible section with phone linking flow (unlinked → input → verifying → linked states). Linked state shows phone number, "Change" button, and "Add Sage to contacts" VCF download.
- **New table `phone_numbers`**: user_id (unique), phone, verified, verification_code, code_expires_at, linked_at.
- Diagram updates: `api-routes.md`, `database-schema.md`, `user-flows.md`, `SYSTEM_MAP.md`.

**2026-03-04 — CLAUDE.md slimmed**
- Moved Drift Log to `.claude/DRIFT_LOG.md` (~130 lines saved)
- Removed File Tree section (~80 lines saved — use glob instead)
- Condensed: Color System, UI Spec, Database Schema, API Routes, Dead Features, Onboarding Flow
- Total reduction: ~900 lines -> ~400 lines
