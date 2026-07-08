# Prompt Constructor — Delta Report

> **What this is**: a cross-reference between what the
> `/admin/prompt-architecture` page currently renders and what the
> actual prompt-construction pipeline does on a single turn. Three
> sections. File-level. Read-only.
> **Authored**: 2026-05-27, against `main @ 51b4e78`.

---

## 1 · What the page shows today

### URL and primary source

- **URL**: `/admin/prompt-architecture` (mounted as
  [page.tsx](src/app/admin/prompt-architecture/page.tsx),
  2,804 lines).
- **API endpoint**:
  [`GET /api/admin/prompt-architecture`](src/app/api/admin/prompt-architecture/route.ts)
  (31 lines). Admin-gated via `requireAdmin`. Accepts
  `?personaModes=...&convMode=...` query params. Returns
  `{ phases: PhaseData[] }` via `buildAllPhases()`.
- **Data builder**:
  [src/lib/admin/prompt-sections.ts](src/lib/admin/prompt-sections.ts)
  (640 lines). Exposes `buildAllPhases`, `parsePromptSections`,
  `estimateTokens`, and the `SECTION_DEFS` registry.

### What it visualizes

- **Four hardcoded lifecycle phases**, built in `buildPhaseConfigs()`
  ([prompt-sections.ts:508–577](src/lib/admin/prompt-sections.ts:508)):
  - Phase 1 — Brand-new account (turn 1, no Manual, situation mode
    default).
  - Phase 2 — Approaching first checkpoint (turn 8, first checkpoint
    flag, mock extraction brief).
  - Phase 3 — Returning user (turn 1, 3 confirmed Manual entries,
    session count 3, no checkpoint).
  - Phase 4 — Returning user, approaching checkpoint (turn 10, same
    entries, mock extraction brief).
- For each phase the page calls `buildSystemPrompt(...)` (the legacy
  string-form constructor) and then parses the rendered prompt back
  out into named sections via `parsePromptSections`.
- **Sections it knows how to identify** (regex-keyed in
  `SECTION_DEFS`, [prompt-sections.ts:118–390](src/lib/admin/prompt-sections.ts:118)):

  | Tier | Section ids the parser recognises |
  |------|------------------------------------|
  | `intro` | `intro` |
  | `1` | `tier1` |
  | `2` | `tier2-voice`, `voice-rules`, `banned-phrases`, `example-register`, `landing`, `deepening`, `pacing`, `when-wrong`, `advisory` |
  | `3` | `tier3` (the header), `first-message`, `guided-intake`, `upload-mode`, `returning-user`, `checkpoints`, `first-checkpoint`, `post-rejection`, `adapting`, `short-answers`, `readiness-gate`, `clinical-material`, `professional-referral`, `fabricated-content`, `checkpoint-language`, `first-session` |
  | `dynamic` | `confirmed-manual`, `session-context`, `extraction-brief` |

- **Per-section metadata** rendered for each match: id, label, tier,
  full rendered text (collapsible), estimated tokens
  (`Math.ceil(text.length / 4)`), condition (`always` / `persona` /
  `state` / `conv-mode` / `dynamic`), source file + symbol,
  alternatives (other personas / modes with their token counts).
- **Aggregate views**: a "Token budget" footer
  ([page.tsx:2265](src/app/admin/prompt-architecture/page.tsx:2265),
  `ExampleAssemblyFooter`) that groups sections by cache tier
  (Tier 1 + intro = static; Tier 2 base = static; Tier 2 persona =
  persona-keyed; Tier 3 mode = persona-keyed; Tier 3 conditional =
  dynamic; live context = dynamic), shows tokens per bucket and
  percent cached vs rebuilt.
- **Two adjacent panels**:
  - **Alongside the prompt** (`ALONGSIDE_ITEMS` at
    [page.tsx:175–216](src/app/admin/prompt-architecture/page.tsx:175)):
    user message, conversation history, sliding window, synthetic
    system messages, `cache_control` marker. Five items, each with a
    one-liner + description + source path.
  - **Sibling calls — the other three this turn** (`SIBLING_CALLS`
    at [page.tsx:218–261](src/app/admin/prompt-architecture/page.tsx:218)):
    Extraction (labeled Sonnet, parallel), Classifier (labeled
    Haiku, post-stream), Composer (labeled Sonnet, on confirm).

### Where the data comes from

- **Live**, in the sense that it runs `buildSystemPrompt` against
  whatever is currently exported from
  `@/lib/persona/system-prompt` and `@/lib/persona/voice-*.ts`.
  Any change to those modules shows up the next time the page
  loads.
- **Mocked**, in the sense that the conversation state is
  hand-crafted: `MOCK_ENTRIES` at
  [prompt-sections.ts:465–499](src/lib/admin/prompt-sections.ts:465)
  supply three fake Manual entries; `buildPhaseConfigs()` hardcodes
  `turnCount`, `isReturningUser`, `isFirstCheckpoint`,
  `checkpointApproaching`, `extractionContext`, `sessionSummary`,
  etc. **No reads from `messages`, `manual_entries`, `conversations`,
  `monitor_reads`, or `profiles`.** The page never sees a real
  user's prompt.
- **Two query-string switches**: `personaModes` (one or more of
  `autistic` / `adhd` / `dyslexic` / `general`) and `convMode`
  (one of `situation` / `guided-intake` / `upload`). The page's
  persona and mode pills re-fetch with the new query string.

### Interactions

- **Stepper** of 10 numbered stages
  ([page.tsx:28–89](src/app/admin/prompt-architecture/page.tsx:28))
  — click a circle or arrow-key through. Each stage shows/hides
  portions of the diagram via the `visible` map
  ([page.tsx:339–354](src/app/admin/prompt-architecture/page.tsx:339))
  and updates the right-column caption.
- **Persona pill** (4 options) — switches `personaMode` state and
  re-fetches the API. The diagram re-renders against the new
  rendered prompt.
- **Mode pill** (3 options) — same pattern for `convMode`.
- **Section band** click — opens `SectionDetail`
  ([page.tsx:889](src/app/admin/prompt-architecture/page.tsx:889))
  in the right column with source path, tokens, condition,
  alternatives, and a "Show rendered text" toggle that pretty-
  prints the parsed text for that block.
- **Alongside / sibling card** click — opens corresponding detail
  panel (`AlongsideDetail`, `SiblingDetail` at
  [page.tsx:2630](src/app/admin/prompt-architecture/page.tsx:2630)
  and 2714).
- **No mutations.** Read-only banner at the top
  ([page.tsx:415](src/app/admin/prompt-architecture/page.tsx:415))
  enforces that the page never writes.
- **No filtering**, no search, no export.

### Visual layout, in plain words

Page-wide layout, top to bottom:

1. **Red read-only banner** strip at the very top.
2. **Two-column shell**:
   - **Left rail** — `AdminNavRail` (vertical nav of admin pages).
   - **Right column** — the prompt-architecture surface, which
     itself splits into two columns at desktop width
     (`gridTemplateColumns: "1.55fr 1fr"`):
3. **Right column · upper bar** — `Header`: italic-serif title
   "Under the hood," a small `Active: AuDHD · Situation` mono pill
   on the same line, and a serif lead paragraph explaining what the
   page reads.
4. **Right column · left side (the diagram, ~60%)**:
   - **`DynamicSidecar`** flush left — a vertical dashed-border
     strip labelled "Live context (parallel)" listing the three
     dynamic sections (Confirmed Manual, Session Context, Extraction
     Brief) with token counts and a footnote about the one-turn
     extraction lag.
   - **Main vertical column**, optionally wrapped in a `CacheWrap`
     border:
     - **`PromptHeader`** — single click-target band reading
       "Jove's system prompt — assembled per turn / click for
       overview."
     - **`SpineBands`** — Tier 1 + always-on Tier 2 sections, one
       click-target band each (intro, tier1, banned-phrases, pacing,
       when-wrong, advisory).
     - **`PersonaFan`** — a persona-bg panel labelled "Persona delta"
       holding four pills (Autistic / AuDHD / Dyslexic / General),
       one of which is active.
     - **`ModeFan`** — a warning-bg panel labelled "Mode opener"
       holding three pills (Situation / Guided / Upload).
     - **`ConditionalLadder`** — a tinted panel headed "Tier 3 —
       Conversation mechanics (N blocks)" rendering a 2-column grid
       of the Tier 3 sections the parser found, each with a tiny
       row of "fires in: Phase 1 ●○○○" phase-dots underneath.
   - **`AlongsideStrip`** — full-width tinted panel labelled
     "Alongside the prompt" with five clickable cards.
   - **`SiblingCallsStrip`** — full-width persona-bg panel labelled
     "Sibling calls — the other three this turn" with three
     clickable cards (Extraction, Classifier, Composer).
   - **`ExampleAssemblyFooter`** — a token-budget table at the
     bottom, grouped by cache tier.
5. **Right column · right side (the stepper + detail, ~40%)**:
   - **Sticky `Stepper`** — 10 numbered circle buttons and
     prev/next arrows.
   - **Either `StageCaption`** (italic-serif title + serif body
     describing the current stage) **or `DetailPanel`** when
     anything's been clicked.

---

## 2 · What the full constructor actually does

The end-to-end path that builds Jove's system prompt on one
conversation turn.

### Entry point and per-turn flow

[`callPersona` in src/lib/persona/call-persona.ts](src/lib/persona/call-persona.ts).
Streaming entry point for the web channel. Per-turn step order
(comment-marked in the file):

1. **Save the user message** (with retry-storm dedup at
   [call-persona.ts:416](src/lib/persona/call-persona.ts:416)).
2. **Load conversation context** via `loadConversationContext`
   ([persona-pipeline.ts:90](src/lib/persona/persona-pipeline.ts:90)).
   Five parallel DB reads:
   - `messages` (ordered by `created_at`, mapped through
     `mapSystemMessages` + `applySlidingWindow` — first 2 + last
     48 when > 50).
   - `manual_entries` for this user (ordered by `created_at`).
   - `conversations` row (`extraction_state`, `summary`, `mode`).
   - last `messages` row with `is_checkpoint = true` → derives
     `turnsSinceCheckpoint`.
   - `profiles.persona_modes` → derives `personaModes` (fallback
     `["general"]`).
   - Plus a follow-on `messages` lookup mapping
     `manual_entries.source_message_id` → `conversation_id` so
     `prepareManualContext` can split current-session from older.
3. **Fire extraction in background** via
   `fireBackgroundExtraction` ([persona-pipeline.ts:326](src/lib/persona/persona-pipeline.ts:326)).
   `runExtraction` (Sonnet) reads previous extraction state + last
   12 messages + Manual entries; writes the new state back.
   `waitUntil()` keeps the function alive until the write settles.
4. **Fire monitor in background** via `fireBackgroundMonitor`
   ([persona-pipeline.ts:398](src/lib/persona/persona-pipeline.ts:398),
   call site [call-persona.ts:531](src/lib/persona/call-persona.ts:531)).
   `runMonitor` (Opus 4.7) reads last 8 messages; writes a row to
   `public.monitor_reads`. **Output is read by nothing else
   downstream.** Shadow-only by design (Phase 0). Confirmed by the
   explicit comment at
   [persona-pipeline.ts:367–369](src/lib/persona/persona-pipeline.ts:367):
   *"on every web turn alongside extraction. Log-only — no
   behavior on the call path reads or gates on the monitor's
   output."*
5. **Detect transcript paste** via `detectTranscript`
   ([call-persona.ts:541](src/lib/persona/call-persona.ts:541)).
   Produces `transcriptDetection`; `selectTranscriptContextForPrompt`
   then drops it if `mode === "upload"` (the upload Tier 3 block
   carries that framing) but always lets the prompt-injection wrap
   fire.
6. **Build prompt options** via `buildPromptOptionsFromContext`
   ([persona-pipeline.ts:266](src/lib/persona/persona-pipeline.ts:266)),
   then spread in channel-specific fields (`explorationContext`,
   `transcriptContext`, `postConfirmMode`).
7. **Assemble system prompt** via `buildSystemPromptBlocks`
   ([system-prompt.ts:869](src/lib/persona/system-prompt.ts:869)).
   Returns three cache-aware blocks:
   - `tier1` — intro + Tier 1 constitutional rules.
   - `staticContext` — Tier 2 composed via `composeTier2` +
     compressed older Manual entries (`prepareManualContextBlocks
     .older`). Cache marker sits on this block.
   - `dynamic` — Tier 3 + current-session Manual entries
     (`prepareManualContextBlocks.recent`) + session context +
     extraction brief + transcript detected block + exploration
     focus block.
8. **Anthropic streaming call** with the three blocks plus the
   conversation history.
9. **Post-stream** (out of scope for the prompt construction
   itself): chip parsing, crisis detection,
   `validateResponseStructure` (soft log), checkpoint detection
   via deterministic phrase match, `applyCheckpointGates`, Opus
   composition if applicable.

### Inputs to the constructor

Everything that flows into `OneOnOnePromptOptions` and feeds
`buildSystemPromptBlocks`:

| Field | Source | Notes |
|-------|--------|-------|
| `manualComponents` | `manual_entries` table (per user, ordered by created_at) | Joined to `messages.conversation_id` so entries from the current session can be identified |
| `currentConversationId` | function arg | Used by `prepareManualContext` to partition recent vs older |
| `isReturningUser` | derived from `manualComponents.length > 0` | |
| `sessionSummary` | `conversations.summary` | Only emitted into the prompt if `isReturningUser` |
| `extractionContext` | `formatExtractionForPersona(previousExtraction, isFirstCheckpoint, manualComponents)` if previousExtraction; else `""` | Header at runtime is `── BRIEF FOR YOUR NEXT RESPONSE ──` |
| `isFirstCheckpoint` | derived from `!isReturningUser` | |
| `sessionCount` | `conversations` count for this user | Only meaningful for returning users |
| `turnCount` | `messages.length` after sliding window | Used to gate Tier 3 entry-phase blocks |
| `checkpointApproaching` | `deriveCheckpointApproaching(previousExtraction, isFirstCheckpoint, turnCount)` | Loads CHECKPOINTS block |
| `personaModes` | `profiles.persona_modes` (or override) | Default `["general"]`; multi-select array |
| `mode` | `conversations.mode` | Default `"situation"`; immutable per conversation |
| `postConfirmMode` | passed from caller | Track A Phase 7 — `"first-message-2"` / `"subsequent-single"` / `null` |
| `explorationContext` | passed from caller (web only, "Explore with Jove") | |
| `transcriptContext` | `selectTranscriptContextForPrompt(mode, transcriptDetection)` | Suppressed in upload mode |

**Crucially absent**: the latest `monitor_reads` row. Nothing in
`loadConversationContext` reads `monitor_reads`. Nothing in
`buildSystemPromptBlocks` consumes monitor output. Confirmed by
grep of `persona-pipeline.ts` — the only contact with
`monitor_reads` is the `.insert` in `fireBackgroundMonitor` at
line 411.

### Tier 1 — Constitutional rules

- **What's in it**: 7 numbered rules (`TIER_1` constant at
  [system-prompt.ts:261–283](src/lib/persona/system-prompt.ts:261)).
  Plain text; no composition.
- **Selection**: identical every turn. Pinned at the front of the
  cache-aware `tier1` block.

### Tier 2 — composeTier2()

- **Entry**: `composeTier2(modes: PersonaMode[])` at
  [system-prompt.ts:76–191](src/lib/persona/system-prompt.ts:76).
- **What "base + persona delta" means**:
  - **Base** is everything in `voice-scaffold.ts` —
    `VOICE_INTRO_PARAGRAPHS_BASE`, `VOICE_RULES_BASE` (21 rules,
    pinned), `EXAMPLE_REGISTER_BASE`, `LANDING_EXAMPLES_BASE`,
    `WEAK_STRONG_EXAMPLES_BASE`, plus the standalone scaffolded
    sections (`DASH_TO_PERIOD_RULE`, `LANDING_INTRO`,
    `DEEPENING_INTRO/OUTRO`, `PACING_RULE`, `WHEN_JOVE_IS_WRONG`,
    `WHEN_USER_ASKS_WHAT_SHOULD_I_DO`).
  - **Delta** is the per-persona module's contributions —
    `VOICE_INTRO_PARAGRAPHS`, `VOICE_RULES`, `EXAMPLE_REGISTER`,
    `LANDING_EXAMPLES`, `DEEPENING_ADDITIONS`,
    `WEAK_STRONG_EXAMPLES` from
    [voice-autistic.ts](src/lib/persona/voice-autistic.ts),
    [voice-adhd.ts](src/lib/persona/voice-adhd.ts),
    [voice-dyslexic.ts](src/lib/persona/voice-dyslexic.ts),
    [voice-general.ts](src/lib/persona/voice-general.ts).
- **Multi-persona stacking**: `personaModes: ["autistic", "adhd"]`
  emits base + autistic delta + adhd delta in that order.
- **`general` is filtered out** when any neurotype mode is also
  selected (line 83). Reaching the `["general"]` fallback means
  upstream failed to pass modes.
- **Dedup**: `dedupeBy(items, keyFn)` collapses byte-identical
  duplicates from base vs delta (e.g., if a persona module
  accidentally repeats a base rule). Used for intro paragraphs,
  voice rules, register, landings, weak→strong pairs.
- **Output shape**: a single string with headers `VOICE`,
  `VOICE RULES`, `BANNED PHRASES`, `EXAMPLE REGISTER`, `LANDING`,
  `DEEPENING`, `PACING`, `WHEN JOVE IS WRONG`, `WHEN THE USER
  ASKS "WHAT SHOULD I DO"`.

### Tier 3 — conditional blocks

- **Container**: `TIER_3_BLOCKS` at
  [system-prompt.ts:345–722](src/lib/persona/system-prompt.ts:345),
  an array of `{ id, shouldRender(flags), render(flags) }`.
- **Iteration**: `buildTier3(flags)` at
  [system-prompt.ts:724](src/lib/persona/system-prompt.ts:724)
  filters blocks where `shouldRender(flags) === true`, calls
  `render(flags)`, and concatenates the results under the header
  `TIER 3: CONVERSATION MECHANICS`.
- **Multiple blocks can render together.** This is the key structural
  fact: Tier 3 is a multi-block emitter, not a precedence ladder.
- **The full set of blocks**:

  | id | Firing condition | Render |
  |---|------------------|--------|
  | `first-message` | `turnCount <= 3 && isNewUser && mode === "situation"` | Header: `FIRST MESSAGE (new user, situation mode)` |
  | `guided-intake` | `mode === "guided-intake"` | Header: `GUIDED INTAKE` |
  | `upload` | `mode === "upload" && turnCount <= 2` | Header: `UPLOAD MODE` |
  | `returning-user` | `isReturningUser` | Header: `RETURNING USER` |
  | `returning-user-first-turn-situation` | `isReturningUser && mode === "situation" && turnCount <= 3` | Header: `RETURNING USER — SITUATION OPENER AND EARLY TURNS (situation mode)` |
  | `checkpoints` | `showCheckpointInstructions` (= `checkpointApproaching && postConfirmMode === null`) | Header: `CHECKPOINTS` |
  | `first-checkpoint` | `isFirstCheckpoint && showCheckpointInstructions` | Header: `FIRST CHECKPOINT (one-time, exact order)` |
  | `post-confirm` | `postConfirmMode !== null` | Header: `POST-CONFIRM — FIRST LIFETIME ENTRY` (first-message-2 branch) or `POST-CONFIRM — SUBSEQUENT ENTRY` (subsequent-single branch) |
  | `adapting-short-answers` | always (`shouldRender: () => true`) | Headers: `ADAPTING` and `SHORT ANSWERS` |
  | `readiness-gate` | `manualComponentCount >= 3` | Header: `READINESS GATE (when all 5 layers have confirmed entries)` |
  | `clinical-and-tail` | always | Headers: `CLINICAL MATERIAL IN CONVERSATION`, `PROFESSIONAL REFERRAL`, `FABRICATED CONTENT`, `CHECKPOINT LANGUAGE (guidance for composition)`, `FIRST SESSION` |

### Manual context — prepareManualContext

- **Entry**: `prepareManualContextBlocks(entries, currentConversationId)`
  at [manual-context.ts:70](src/lib/persona/manual-context.ts:70)
  (cache-aware caller) and `prepareManualContext(...)` at line 115
  (legacy single-string caller; the admin-page path uses this via
  `buildSystemPrompt`).
- **Compression rule**: split by `source_conversation_id`.
  - **Recent** = anything authored in the current conversation, plus
    backfill from most-recent overall to a floor of
    `RECENT_FULL_LIMIT = 4`. Rendered as `CONFIRMED MANUAL\nLayer N
    (Name) — "Headline":\n<full content>\n\n`, ordered oldest-first.
  - **Older** = everything else. Rendered as `EARLIER ENTRIES
    (compressed — full content lives in the Manual):\n` followed
    by one line per entry: `[Layer N — Layer Name] "Headline" —
    summary. Key words: w1, w2, w3.` See `compressManualEntry`
    at line 33.
- **Cache strategy**: in the cache-aware path, `older` goes into
  the static block (cacheable), `recent` goes into the dynamic
  block (rebuilt each turn).
- **Summary fallback**: `deriveSummaryFromContent(content)` returns
  the first sentence (line 183) for pre-feature rows where
  `summary` is null.

### Final output

`buildSystemPromptBlocks` returns
`{ tier1, staticContext, dynamic }`. The caller at
[call-persona.ts:562–569](src/lib/persona/call-persona.ts:562)
assembles a `SystemBlock[]` of three text blocks with
`cache_control: { type: "ephemeral" }` on the middle one. That's
what goes to Anthropic alongside the conversation history.

The legacy single-string path (`buildSystemPrompt` at
[system-prompt.ts:967](src/lib/persona/system-prompt.ts:967))
joins the same content as one string in legacy order (intro + Tier
1 + Tier 2 + Tier 3 + `prepareManualContext` + session context +
extraction brief + transcript + exploration). Byte-identical to
the three-block concatenation. **The admin page uses this path** —
the parser sees the joined string.

### Dynamic context blocks appended after Tier 3

- **Manual entries** (`prepareManualContext`) — header `CONFIRMED
  MANUAL` if recent entries exist, else `EARLIER ENTRIES
  (compressed — full content lives in the Manual)`. Both rendered
  if both kinds of entries exist.
- **Session context** (`renderSessionContextBlock` at
  [system-prompt.ts:792](src/lib/persona/system-prompt.ts:792))
  — only when `isReturningUser`. Header: `SESSION CONTEXT`. Body
  includes session count if > 1 and previous summary if present.
- **Extraction brief** (`extractionContext` =
  `formatExtractionForPersona(previousExtraction, ...)`) — only
  when `previousExtraction` exists. Header at runtime:
  `── BRIEF FOR YOUR NEXT RESPONSE ──` (extraction.ts:535).
- **Transcript detected** (`renderTranscriptContextBlock` at
  [system-prompt.ts:809](src/lib/persona/system-prompt.ts:809))
  — only when `transcriptContext.isTranscript === true`. Header:
  `TRANSCRIPT DETECTED`. Renders the shared
  `renderPastedContentGuidance()` body.
- **Exploration focus** (`renderExplorationContextBlock` at
  [system-prompt.ts:838](src/lib/persona/system-prompt.ts:838))
  — only when `explorationContext` is passed (user clicked
  "Explore with Jove" on a Manual entry). Header: `EXPLORATION
  FOCUS`. Body varies by `type: "entry"` vs `"empty_layer"`.

### Does the monitor feed the constructor? No.

Quoting [persona-pipeline.ts:365–372](src/lib/persona/persona-pipeline.ts:365):

> Phase 0 of the two-layer engine plan
> (docs/reference/two-layer-engine-evaluation.md). Fires the Haiku
> monitor on every web turn alongside extraction. Log-only — no
> behavior on the call path reads or gates on the monitor's output.
>
> Persistence goes to public.monitor_reads, a dedicated table created
> for shadow analysis.

`monitor.ts` is imported by `persona-pipeline.ts` only to call
`runMonitor`; nothing reads `monitor_reads` back. Confirmed by
grep: the only contact is the `INSERT` in `fireBackgroundMonitor`
at line 411. The constructor sees no monitor data.

---

## 3 · Delta — what's in the constructor that the page doesn't show, and vice versa

### A. What the constructor does that the page does not show

#### A1. Monitor (Watcher 1) is entirely absent from the page

- The `SiblingCallsStrip` panel
  ([page.tsx:2509](src/app/admin/prompt-architecture/page.tsx:2509))
  is titled *"Sibling calls — the other three this turn"*. It lists
  Extraction, Classifier, Composer. **Monitor is not listed.**
- The page never mentions `monitor.ts`, `monitor_reads`,
  `fireBackgroundMonitor`, or Watcher 1.
- **Type**: this is a missing rendering of an existing constructor
  sibling (the monitor IS firing on every turn — it just doesn't
  feed the prompt). The architectural commitment of two-watcher
  separation (per master.md) is invisible from this page.
- **Invasiveness to add as a rendering**: low. The
  `SIBLING_CALLS` array would gain a fourth entry (Monitor,
  `claude-opus-4-7`, parallel-with-extraction, reads last 8
  messages, writes `monitor_reads`, no consumer yet). A
  `SiblingDetail` case would need extending similarly. Two-file
  edit: `page.tsx` only. Re-title "the other three" → "the other
  three or four" or drop the count.

#### A2. Five Tier 3 blocks are not recognised by the parser

The constructor emits these blocks; the page's regex parser does
not match them, so they don't appear in the diagram or detail
panels even when they fire:

| Block | Header at runtime | Why parser misses it |
|-------|-------------------|----------------------|
| `first-message` (situation mode) | `FIRST MESSAGE (new user, situation mode)` | Parser pattern `/^FIRST MESSAGE \(new user\)$/m` requires the line to *end* with `(new user)`. Actual line continues with `, situation mode)`. **Bug**: this block never parses in situation mode. |
| `returning-user-first-turn-situation` | `RETURNING USER — SITUATION OPENER AND EARLY TURNS (situation mode)` | No regex registered for this id. |
| `post-confirm` | `POST-CONFIRM — FIRST LIFETIME ENTRY` / `POST-CONFIRM — SUBSEQUENT ENTRY` | No regex registered. |
| `EARLIER ENTRIES (compressed ...)` (from `prepareManualContextBlocks.older`) | `EARLIER ENTRIES (compressed — full content lives in the Manual):` | No regex registered. The page recognises `CONFIRMED MANUAL` only. The compressed older block, when present, gets concatenated into whatever section came before it in the parser's split. |

- **Type**: missing rendering (the constructor already emits them).
- **Invasiveness to add**: very low. Each is one entry in
  `SECTION_DEFS` at
  [prompt-sections.ts:118](src/lib/admin/prompt-sections.ts:118).
  Worth fixing the `first-message` regex while there — the current
  pattern is just wrong against the actual emitted header.

#### A3. Two dynamic blocks are absent from the parser

| Block | Header at runtime | Source |
|-------|-------------------|--------|
| Transcript detected | `TRANSCRIPT DETECTED` | `renderTranscriptContextBlock` ([system-prompt.ts:809](src/lib/persona/system-prompt.ts:809)) |
| Exploration focus | `EXPLORATION FOCUS` | `renderExplorationContextBlock` ([system-prompt.ts:838](src/lib/persona/system-prompt.ts:838)) |

- These fire conditionally on real signal: a transcript paste in
  the user's message (via `detectTranscript`) or the user clicking
  "Explore with Jove" on a Manual entry.
- The page would need either new mock-phase configurations that
  toggle them on, or a parser entry that surfaces them when they
  appear in the rendered string.
- **Type**: missing rendering.
- **Invasiveness**: low. New `SECTION_DEFS` entries + new mock
  phase configurations to demonstrate. The phase configs currently
  do not exercise `transcriptContext` or `explorationContext` at
  all, so even if the parser recognised the headers, no phase
  would surface them.

#### A4. The extraction brief header is wrong in the parser

- Parser pattern: `/^EXTRACTION BRIEF/m`
  ([prompt-sections.ts:385](src/lib/admin/prompt-sections.ts:385)).
- Actual runtime header from `formatExtractionForPersona`:
  `── BRIEF FOR YOUR NEXT RESPONSE ──` ([extraction.ts:535](src/lib/persona/extraction.ts:535)).
- The page only surfaces an "Extraction Brief" section because the
  Phase 2 and Phase 4 configs inject a synthetic mock string that
  *starts with* `\nEXTRACTION BRIEF\n` ([prompt-sections.ts:535](src/lib/admin/prompt-sections.ts:535)
  and 569). The real prompt would not match.
- **Type**: a hybrid — the rendering exists but it's pointing at
  mock content that doesn't share shape with the real brief. The
  page is showing admins what looks like an extraction brief but
  is in fact a hand-written stand-in.
- **Invasiveness to fix**: trivial. Either update the regex to
  match `── BRIEF FOR YOUR NEXT RESPONSE ──` or change the mock
  string to use the real header. Probably both: update the regex
  and also have the mock phases use the actual `formatExtraction
  ForPersona` output on a fixture `ExtractionState` so the page
  shows the real brief shape.

#### A5. The page renders mock data, not real conversation state

- Every prompt the page renders runs against `buildPhaseConfigs()`
  + `MOCK_ENTRIES`. No database reads. No real `extraction_state`,
  no real `monitor_reads`, no real `manual_entries`, no real
  `messages` history, no real sliding-window behavior.
- **Type**: design choice, not a bug — the page is for
  understanding the prompt's *shape* and reachable variations, not
  for inspecting any particular user's prompt.
- **Invasiveness to add a "real conversation" mode**:
  significant. Would need (a) a conversation picker UI, (b) the
  API to accept a `conversationId` and call
  `loadConversationContext` for it, (c) reuse `buildSystemPrompt`
  on the real options, (d) the parser to actually handle every
  block the real prompt emits (which means fixing A2, A3, A4
  first), (e) admin-only RLS so the picker can list any
  conversation. Touches: `page.tsx`, `route.ts`,
  `prompt-sections.ts`, plus a new query against `conversations`
  for the picker. The hardest part is not the wiring — it's
  making the parser robust enough to handle real content
  (including unexpected block combinations) without silently
  dropping sections.

#### A6. The constructor's monitor + extraction parallel firing is invisible

- The page's `SiblingCallsStrip` describes Extraction's `when` as
  *"Parallel — fires the same instant as Jove"* — accurate for
  extraction. The same parallel firing applies to the monitor
  ([call-persona.ts:525–531](src/lib/persona/call-persona.ts:525)),
  but the page doesn't show it because it doesn't show the monitor
  at all (see A1).
- **Type**: knock-on from A1.

#### A7. The constructor's `applyCheckpointGates` + composer chain happens after the prompt assembly

- The page describes the composer in `SIBLING_CALLS` but doesn't
  show the gate logic (`applyCheckpointGates`,
  `validateMaterialQuality`, the deterministic
  `detectCheckpointInResponse` phrase match). The "Classifier"
  card claims a Haiku call — see B1 below for why that's stale.
- **Type**: this is post-construction, so arguably out of scope for
  a "prompt architecture" page. Worth noting as scope.

### B. What the page shows that doesn't reflect current code

#### B1. "Checkpoint classifier" is described as a Haiku call — it isn't

- `SIBLING_CALLS` entry id `classifier`
  ([page.tsx:240–249](src/app/admin/prompt-architecture/page.tsx:240))
  reads: *"Checkpoint classifier · Haiku · Post-stream … Looks at
  what Jove just said and decides if it's a checkpoint proposal.
  Cheap and fast — Haiku, single-turn, no streaming."*
- Source listed as `src/lib/persona/detect-checkpoint.ts →
  detectCheckpoint`.
- Actual implementation:
  [detect-checkpoint.ts](src/lib/persona/detect-checkpoint.ts)
  is a **deterministic regex** matcher on the transition phrase
  *"I want to put something in your Manual."* It is not a Haiku
  call. It is not an Anthropic call at all. Called by
  `call-persona.ts:791` as `detectCheckpointInResponse(...)`.
- This matches ADR-003 (server-side composition after classifier
  — but the classifier became deterministic in a later
  refactor). The page is referencing a previous architecture.
- **Type**: stale page metadata, not a missing rendering.
- **Invasiveness to fix**: one `SIBLING_CALLS` entry edit. Change
  `model: "Haiku"` to `model: "Deterministic"` or `model:
  "Regex"`, update `when` and `description` to reflect the phrase
  match, update the source citation.

#### B2. Composer is described as Sonnet — it's Opus

- `SIBLING_CALLS` entry id `composer`
  ([page.tsx:250–260](src/app/admin/prompt-architecture/page.tsx:250))
  labels `model: "Sonnet"`.
- Actual: `COMPOSITION_MODEL = "claude-opus-4-6"` per
  [config.ts:39](src/lib/persona/config.ts:39). The composer call
  at [confirm-checkpoint.ts:202](src/lib/persona/confirm-checkpoint.ts:202)
  passes `model: COMPOSITION_MODEL`.
- This is the same discrepancy flagged as Open Question 2 in the
  master architecture document — `docs/system.md` also says
  Sonnet. The admin page inherits the same staleness.
- **Type**: stale page metadata.
- **Invasiveness**: one-character edit to the `model:` field; the
  longer fix is the ADR question in master.md Open Question 2.

#### B3. The Tier 3 mode-opener visual implies one of three loads — actually all three are conditional

- `ModeFan` at
  [page.tsx:1805](src/app/admin/prompt-architecture/page.tsx:1805)
  is labelled *"Mode opener — entry-phase Tier 3 block · 1 of 3 ·
  click to switch."*
- The page presents this as "exactly one mode block loads per
  conversation." The actual condition for `upload` is
  `mode === "upload" && turnCount <= 2`, for `guided-intake` is
  `mode === "guided-intake"`. After the
  Upload entry phase exhausts (turn 2+), the upload block stops
  rendering — there's no "mode opener" at all for the rest of the
  conversation. Situation mode has its own entry-phase block
  (`first-message`, gated `turnCount <= 3 && isNewUser`).
- The "1 of 3" framing is accurate for the entry phase only.
  Mid-conversation, the answer is often "zero of three."
- **Type**: the visual framing oversimplifies the firing
  conditions.
- **Invasiveness**: small. Could add a phase-dot row under the
  ModeFan showing which phases trigger each mode opener, mirroring
  the `ConditionalLadder` pattern.

#### B4. Mock entries / mock briefs read as if from a real user

- Nothing in the page UI flags that `MOCK_ENTRIES` aren't real
  data, or that the Phase 2 / Phase 4 extraction briefs are
  hand-written rather than produced by `formatExtractionForPersona`.
- A reader could reasonably assume the Manual entries on the page
  are from a real account.
- **Type**: missing rendering of a meta-fact (this is a synthetic
  fixture).
- **Invasiveness**: trivial. A "mock data — for illustration" pill
  on the Confirmed Manual section, plus a one-line caption on the
  page header.

### C. What's missing functionality (not just rendering)

These items appear in the planned architecture (master.md) but do
not exist in code yet. The page can't render them because the
system doesn't do them. Flagged here for completeness; building
them is a separate decision.

#### C1. The monitor's output is not read anywhere

- The page can't show "what the selector does with the monitor
  read" because no selector exists and no consumer of `monitor
  _reads` exists.
- Master.md describes this as the safety-spine integration —
  Decision 7, last in the build order.

#### C2. The deterministic selector

- Master.md §3. Decision 4's precedence ladder.
- Not in code (`grep -r "selector" src/lib/persona/` finds nothing
  matching the architectural sense).
- The page renders today's substitute (`TIER_3_BLOCKS`, a
  flags-keyed multi-block emitter) but doesn't flag it as a
  substitute.

#### C3. The scope-exit gate

- Master.md §3 / Scope-exit gate. Code-level save-suppression keyed
  on `monitor_reads.scope`. Doesn't exist.

#### C4. Lock 1 (composer fail-closed on thin material)

- Master.md §5. The page references the composer but not the
  planned Lock 1 verbatim-language check.

#### C5. Contract content in the openers

- Master.md §4 — Contract posture. The page renders today's
  openers (situation, guided-intake, upload) faithfully via the
  Tier 3 blocks; the missing two-sentence contract content is a
  copy edit, not a missing rendering.

#### C6. The two rupture postures (`withdrawal_yield`,
       `confrontation_hold`) and the planned posture-routing

- Master.md §4 — alliance postures. Selector rows 2 and 3. Don't
  exist in code; can't be rendered.

#### C7. Per-turn state plumbing for the monitor's `direction`

- Master.md Open Question 5. The monitor recomputes its slope
  fresh each turn without the prior read as input. Not currently
  in the constructor.

#### C8. Recognition decay

- Master.md Open Question 1. Nothing prevents re-surfacing the
  same pattern across turns or sessions.

### D. Summary table — by gap type

| Item | Type | File touch points to add as rendering |
|------|------|----------------------------------------|
| A1 Monitor as fourth sibling | Missing rendering | `page.tsx` (SIBLING_CALLS + SiblingDetail case). Re-title the strip. |
| A2 Five Tier 3 blocks unrecognised | Missing rendering | `prompt-sections.ts` (SECTION_DEFS); fix existing `first-message` regex too. |
| A3 Transcript / exploration dynamic blocks | Missing rendering | `prompt-sections.ts` (SECTION_DEFS); new mock phases in `buildPhaseConfigs()` to exercise them, or a "live" mode. |
| A4 Extraction brief header mismatch | Missing rendering (mock vs real shape) | `prompt-sections.ts` (regex + mock string). |
| A5 Mock data, not real | Design choice | Requires real-conversation mode → multi-file. Optional. |
| A6 Parallel firing of monitor invisible | Knock-on from A1 | Follows A1's fix. |
| A7 Post-construction gates not shown | Out of scope (probably) | Could be added as a "Post-stream pipeline" strip. Page-design decision. |
| B1 Classifier is regex, not Haiku | Stale page metadata | One SIBLING_CALLS edit. |
| B2 Composer is Opus, not Sonnet | Stale page metadata | One SIBLING_CALLS edit. |
| B3 Mode opener "1 of 3" oversimplifies | Stale framing | Add phase-dot under ModeFan. |
| B4 Mock data not flagged | Missing meta-rendering | Caption + pill. |
| C1–C8 | Missing functionality | Don't build yet — see master.md. |

---

_End of delta report. Reads against `main @ 51b4e78`. No code
modified. Stage at `docs/architecture/prompt-constructor-delta.md`
for review._
