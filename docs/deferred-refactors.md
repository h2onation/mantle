# Deferred refactors

Items surfaced during the May 2026 simplification passes but explicitly not
shipped. Each entry lists value, risk, and the trigger that should make it
worth picking up. Updated when items ship or when new context changes the
calculus.

## Context — what was shipped

Across two simplification passes plus four focused follow-up sessions:

- **Pass 1 / Pass 2**: dedupe of LLM response/JSON helpers, Manual entry
  rendering, model IDs, checkpoint action map, admin auth + auth-user listing
  helpers, email validation, persona name templating, layer/Roman constants,
  conversation mode union, `firstNameOrNull`, `useAsyncFetch` hook, dead
  state/ternary/flag removal, Promise.all parallelization in checkpoint and
  conversations routes, narrower `conversations` count query, deferred
  MobileSettings phone fetch, `manual_viewed` analytics dedup, voice rule
  templating, stale-comment sweep, `requireAdmin()` migration to all admin
  routes, module-scoped admin client cache.
- **`requireUser()` helper** (shipped): replaced 18 inline auth checks in API
  routes with a shared helper at `@/lib/auth/require-user`. Variants for
  custom error messages and unauthorized-branch telemetry.
- **SSE parser unification** (shipped): new `parseAnthropicStream` helper
  for upstream Anthropic SSE; migrated `dev-simulate/route.ts` to consume the
  existing downstream `parseSSEStream`. Every SSE loop now routes through one
  of two shared parsers.
- **`BuildPromptOptions` disjoint union** (shipped): refactored
  `buildSystemPrompt` to take a discriminated union (`group` vs `oneOnOne`)
  with type-narrowed branches. Dropped redundant `hasManualContext` flag in
  the same pass.
- **`buildTier3` refactor** (shipped): 350-line if/else ladder replaced with
  a `Tier3Block[]` data structure; each block is independently inspectable
  and unit-testable.
- **Anthropic prompt caching** (shipped 2026-05-14, vigilant-johnson worktree):
  the static portions of the Jove system prompt and the extraction system
  prompt now flow through Anthropic's `cache_control` blocks (`system` as a
  three-block array). Estimated ~90% input-token cost reduction on cached
  chunks. See state.md 2026-05-14 entry "Anthropic prompt caching on chat +
  extraction system prompts." Pass-1 efficiency review #1.

## Small follow-ups

- **Reconcile `guided-intake-copy.test.ts` type** — the test calls
  `buildSystemPrompt` with `ConversationContext`-shaped fields (`messages`,
  `previousExtraction`, etc.) instead of the `OneOnOnePromptOptions` shape
  the function actually accepts. 2 pre-existing TS errors at lines 31, 51.
  Either rename the test fixture fields or swap the type. ~10-line fix.
- **Collapse `buildSystemPrompt` into a wrapper** — the prompt-caching
  session deliberately kept the legacy implementation as a parallel function
  (alongside `buildSystemPromptBlocks`) to preserve byte-identical output for
  non-block callers. Future work: make `buildSystemPrompt(opts)` a one-line
  wrapper over `buildSystemPromptBlocks` that joins the three returned
  blocks. The existing `system-prompt.test.ts` assertions are the safety net.

## Deferred

### MobileSession.tsx surgical extractions

`src/components/mobile/MobileSession.tsx` is ~1000 LOC doing many jobs at
once. The pass-1 reviews identified five candidate extractions, deferred as
a sequence of focused sessions rather than one big-bang split (visual
regressions are hard to catch without dedicated UI testing).

#### 1. `<MessageItem>` memoized child component
- **What**: Extract the per-message Bubble + content rendering (~300 LOC of
  inline JSX in the `messages.map(...)` body) into a `React.memo`-wrapped
  child. Cache `renderMarkdown(msg.content)` via `useMemo([msg.id, msg.content])`.
- **Value**: HIGH on mobile streaming. Currently `renderMarkdown` runs for
  every historical message on every streaming token (per-token re-render of
  the whole list). With memoization: only the new message renders.
- **Risk**: MEDIUM. Visual regression possible (inline style transfer typos),
  subtle behavioral bugs in derived rendering (JOVE label only on first bubble
  in a sequence, chips only on latest message), memoization done wrong = no
  benefit. No automated test catches "label appears on wrong bubble."
- **Trigger**: Evidence of frame drops during streaming on a mid-tier mobile
  device, OR chat history routinely growing beyond 30+ messages, OR adding
  another streaming-triggered re-render path.
- **Audit reference**: pass-1 efficiency review #3.

#### 2. `<EntryCard>` extraction
- **What**: 3 near-identical entry-card buttons in the entry-cards welcome
  surface (~60 LOC each, varying only icon/title/onClick). Extract one
  `<EntryCard>` taking `icon`, `title`, `subtitle`, `onClick`, `disabled`.
- **Value**: ~150 LOC dedup, easier to add or modify entry options.
- **Risk**: LOW. Cards have static content and identical structure. The
  surgical "smallest first MobileSession extraction" pick.
- **Trigger**: Adding a fourth entry option, OR if the team wants to
  experiment with card design (variant testing becomes much easier).
- **Audit reference**: pass-1 quality review #2.

#### 3. `<CheckpointMessage>` extraction
- **What**: The pending-and-historical checkpoint render path inside MobileSession.
  Distinct enough from regular bubbles to deserve its own component.
- **Value**: MEDIUM. Reduces MobileSession size; isolates the most behavior-
  rich render path (status, refinement_count, edit overlay coordination).
- **Risk**: MEDIUM. Heavy interaction with `activeCheckpoint`, `confirmStatus`,
  `checkpointActionState` — props sprawl risk if extraction is mechanical.
- **Trigger**: Adding new checkpoint states or visual variants, OR after the
  `<MessageItem>` extraction reduces the surrounding noise.
- **Audit reference**: pass-1 quality review #3.

#### 4. `<ChannelBadge>` extraction
- **What**: Two literal copies of the `<div><span>TEXT</span></div>` channel
  badge (one for user message, one for assistant). ~8 LOC of dedup.
- **Value**: LOW. Tiny. Worth doing as a free pickup during another extraction.
- **Risk**: LOW.
- **Trigger**: Doing any other MobileSession surgical extraction in the same
  session.
- **Audit reference**: pass-1 quality review #11.

#### 5. State cleanup
- **What**: `signInBannerDismissed` reads localStorage in lazy init then
  writes in a click handler — could move to MainApp where session/auth state
  lives. `modal1Dismissed` / `modal2Dismissed` are local mirrors of an event
  that should reset on `conversationId` change. The "modal3 advance" effect
  fires *because of* a checkpoint arriving — should be in the same code path
  that creates the checkpoint, not a useEffect.
- **Value**: MEDIUM. Real React hygiene — fewer fragile useEffects in the
  most fragile component.
- **Risk**: MEDIUM. State migration always risks subtle timing bugs.
- **Trigger**: Doing the `<MessageItem>` extraction (cleaner if state is
  sorted first), OR a bug surfaces in the modal/banner timing.
- **Audit reference**: pass-1 quality review #6, #7, #10.

### Admin panel UI dedup

#### 6. HealthPanel visual shell extraction
- **What**: `ApiErrorsPanel`, `ConfirmHealthPanel`, `ActiveUsersPanel`,
  `SchemaHealthTab` share the same window-toggle / banner / recent-feed /
  footer pattern. Pass 2 shipped the data-side dedup (`useAsyncFetch` hook);
  this is the remaining visual extraction (~300 LOC).
- **Value**: MEDIUM. Single source of truth for the admin Health visual
  language; ~300 LOC reduction.
- **Risk**: MEDIUM. Visual regression possible across 4 surfaces. The four
  panels look similar but each has subtle layout variations.
- **Trigger**: Adding a fifth health panel, OR a styling refresh of the admin
  Health tab, OR a bug in one panel that should be fixed across all.
- **Audit reference**: pass-1 reuse review #1, pass-1 quality review #4.

#### 7. `DevToolsPanel` ↔ `MobileSettings` dev controls dedup
- **What**: ~250 LOC of duplicated simulate/populate logic + UI between the
  admin DevTools panel and MobileSettings' admin section. Extract `useSimulateUser`
  / `usePopulateManual` hooks plus a small `<DevToolsControls>` component.
- **Value**: MEDIUM. Significant LOC reduction; a single place to change
  dev-tool behavior.
- **Risk**: MEDIUM-HIGH. MobileSettings is large and has user-facing surfaces
  beyond dev tools. UI changes in MobileSettings need careful visual QA.
- **Trigger**: Adding a third dev-tool consumer, OR a bug in dev tools that
  has to be fixed in both places.
- **Audit reference**: pass-1 reuse review #4, pass-1 quality review #1.

### Backend / data

#### 8. Phone normalization full migration
- **What**: Replace `normalizePhone` (always returns `+1<garbage>`) with
  `normalizeUSToE164` (returns null on invalid) across 11 call sites in linq
  webhook, group-detection, group-bridge, message-router, and user/phone
  routes. Add explicit null handling at each site.
- **Value**: MEDIUM. Removes a real footgun where invalid phones become
  garbage strings that compare against themselves.
- **Risk**: HIGH. The Linq sites use equality comparisons that depend on the
  always-prefixed semantic. Switching to null-returning could silently break
  group detection, owner-phone matching, or webhook routing if any site's
  null handling is wrong.
- **Status**: Pass 2 shipped a `@deprecated` note on `normalizePhone`
  pointing future code at `normalizeUSToE164`. Documents the divergence
  without touching the 11 call sites.
- **Trigger**: A real bug in phone matching (e.g. group detection fails with
  malformed webhook payloads), OR a focused security/correctness review of
  the phone-handling surface.
- **Audit reference**: pass-1 reuse review #1, pass-2 risk audit #8.

#### 9. `admin/users` N+1 message scan
- **What**: The admin Users tab loads every message's `created_at` to compute
  `last_active` per user (N+1-style). Single SQL `select user_id, max(created_at)
  group by user_id` via RPC or view would replace it.
- **Value**: LOW today (admin-only, low traffic).
- **Risk**: LOW (would need a new RPC).
- **Status**: Comment in code explicitly notes "Fine for the small admin user
  count; revisit if it grows."
- **Trigger**: Beta exceeds ~500 users AND the admin Users tab gets noticeably
  slow.
- **Audit reference**: pass-2 risk audit #5.

#### 10. `mock-anthropic` / `mock-supabase` adoption
- **What**: The helpers in `src/lib/__test-helpers__/` exist but no test imports
  them. Tests hand-roll their own mocks per file.
- **Value**: LOW.
- **Risk**: LOW (test-only changes).
- **Status**: Audit found the helpers are too generic for real per-call control
  most tests need. Migrating would be pure churn — tests would either over-stub
  or fall back to hand-rolled mocks anyway.
- **Trigger**: The helpers grow richer affordances (e.g. per-call response
  control, error injection per call), OR a new test pattern emerges that
  matches the helpers' shape.
- **Audit reference**: pass-1 reuse review #5, #6, pass-2 risk audit #10.

