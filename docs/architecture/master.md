# Jove — Master Architecture

> **Authority**: This is the ground-truth description of Jove's engine. Other
> documents (positioning, ADRs, build prompts, visuals) derive from this one.
> **Audience**: Jeff (the human reading this) and the agents that will
> implement the gaps. Non-engineers must be able to navigate it. Engineers
> must be able to act from it.
> **Status discipline**: Two roles speak below. The **architect-of-the-code**
> reports what is actually there, with file paths and line numbers. The
> **architect-of-the-decisions** compares against the seven locked
> decisions and the pre-decision commitments. Where they disagree, the
> disagreement is named.

---

> **⚠ STATUS UPDATE (2026-06-04) — read before trusting §1 and the selector roadmap.**
> The **Phase-0 shadow monitor (§1 / "Watcher 1") has been removed** — code,
> `monitor_reads` table, replay harness, and `/replay-monitor` skill are gone
> (drop migration `20260604000000`). It was gated off and consumed by nothing.
> The **two-layer-engine / two-watcher roadmap** that frames much of this
> document — including the **pre-prompt selector** (ADR-043 Decision 1) that was
> to read the monitor — is **PAUSED and flagged as a candidate overbuild**, not
> being pursued. Do **not** rebuild toward it by default. See **ADR-045** for
> the decision and the consumer-first re-entry condition; prefer in-call
> detection over a separate watcher if it is ever revisited.
> **Still live and unaffected**: the checkpoint quality gate
> (`validateMaterialQuality` / `deriveCheckpointApproaching`, ADR-043 Decisions
> 2 & 3), the suppression circuit-breaker, and Lock 1. Sections below that
> describe the monitor or the selector as current are historical until this
> document is reworked.

---

## Executive summary (read first)

The engine has **six components** that move data and one another:
the two watchers (alliance monitor, pattern extraction), the planned
selector that picks a posture per turn, the conversation generator
that produces each Jove turn, the composer that writes Manual
entries, and the Manual itself. Ceiling and floor are not in this
list: they are constraints on the generator's prompt, not nodes in
the flow. The refer-out boundary is named at the top of the
document; voice discipline lives in an appendix at the back.

**Status pills** are: `solid` · `validated` · `partial` · `unproven` ·
`deferred` · `not-yet-built`. (`validated` = proven against real data
in a closed validation phase; distinct from `solid`, which means
built-and-stable in production.)

- **§1 Monitor (Watcher 1)** — `validated` (detection); read by
  **no one** (consumption). Phase 0 closed 2026-05-27: `direction`
  (slope) validated and load-bearing, `rupture` validated with a
  one-turn recovery lag, `scope` observed-but-not-validated for the
  decision-seeking pull. The reads are proven; nothing consumes them
  yet. Lives at `src/lib/persona/monitor.ts`, runs on every web turn
  under Opus, writes `public.monitor_reads`. See `phase-0-closeout.md`.
- **§2 Extraction (Watcher 2)** — `partial` within-session;
  `deferred` cross-session. Runs alongside the generator on every
  turn; produces the cumulative `ExtractionState` that gates Save
  today and will feed the Selector tomorrow. Cross-session pattern
  retrieval (real "Watch") is v1.5.
- **§3 Selector (planned)** — `not-yet-built`. The deterministic
  precedence ladder Decision 4 specifies. Today's substitute is a
  flags-keyed multi-block prompt renderer
  (`TIER_3_BLOCKS` in [system-prompt.ts:345](src/lib/persona/system-prompt.ts:345)).
- **Scope-exit gate (planned, alongside Selector)** — `not-yet-built`.
  Code-level save-suppression keyed on the monitor's `scope` field.
  Signal source exists; no consumer.
- **§4 Generator** — `solid` as the call mechanic; `partial` once
  you count the postures inside it. The conversation Sonnet call
  receives the assembled prompt and produces each Jove turn. The
  postures the Selector will route to (Reflect, Get concrete,
  Surface, Save, Contract, plus the alliance postures
  `withdrawal_yield` and `confrontation_hold`) live here as
  generator behaviors with mixed current state.
- **§5 Composer** — `partial`. Detection of "I want to put
  something in your Manual" → material-quality gates → Opus
  composition → atomic Manual write. **Lock 1 (verbatim-language
  fail-closed) is `not-yet-built`.** Composer will produce an
  entry on thin material today.
- **§6 Manual** — `solid` as artifact; `deferred` for cross-session
  read-back. The five-layer `manual_entries` table, atomic write
  via Postgres function. Semantic retrieval / active pattern recall
  across sessions is v1.5.

**The single biggest gap**: the *Selector* (§3) that the
architecture rests on does not exist in code. What exists today is
a multi-block prompt renderer that can render many blocks per turn,
plus post-detection material-quality gates. The withdrawal-yield /
confrontation-hold / scope-exit / surface / reflect ladder is not
present. The monitor's output is not read by any code path.
Everything else hinges on this.

**Architecture described, not yet built.** This document describes
the engine in full; several pieces are decisions or partial
wirings, not running code. Don't infer behavior from the prose
alone — these items do not currently fire:

- **The Selector** (Decision 4's precedence ladder, §3). The
  structural centerpiece. Not in code; today's substitute is a
  multi-block prompt renderer keyed on flags.
- **The Scope-exit gate** (Scope-exit gate section after §3). The
  signal source exists in `monitor_reads` but no code reads it back.
- **The Monitor read-back into anything** (§1). Phase 0 is
  shadow-only by design.
- **The Contract content** in the three openers (Contract posture
  inside §4). Plumbing in place; the two sentences naming what Jove
  does and doesn't do are missing.
- **The two rupture postures** — `withdrawal_yield` and
  `confrontation_hold` (alliance postures inside §4 / Decision 5).
  Signal exists in the monitor; postures do not.
- **Lock 1 — composer fail-closed on thin material** (§5 /
  Decision 6). The composer prompts for verbatim user language; no
  deterministic check enforces it.
- **Per-turn state plumbing for the monitor's `direction` field**
  (§1, open questions). Each turn recomputes from the 8-message
  window without the prior turn's read as input.
- **Recognition decay** (Surface posture inside §4 / §6). Nothing
  prevents re-surfacing the same pattern across turns or sessions,
  except a single one-line POST-REJECTION prompt instruction.

---

## What Jove is and isn't

> Framing section. This is positioning — the constitutional
> boundary the rest of the architecture sits inside. Not a
> component. Lives at the top so a non-engineer reads it before
> the engine.

Jove builds a self-understanding Manual through deep conversation.
Jove is not a therapist. Not a coach. Not a diagnostic tool. Not a
substitute for professional care. The product architecture reflects
this identity at every level: the user is the author, Jove is the
facilitator, the Manual is a self-authored document. Nothing enters
the Manual without explicit confirmation.

**Where this lives in code**:

- [rules.md](docs/rules.md) — "Product Identity," "Legal Positioning,"
  "What Jove Does and Does Not Do," "Professional Referral."
- [system-prompt.ts:282](src/lib/persona/system-prompt.ts:282) — Tier
  1 Rule 7: *"JOVE IS NOT A THERAPIST … Professional referral only
  when…"*
- [system-prompt.ts:711](src/lib/persona/system-prompt.ts:711) — the
  PROFESSIONAL REFERRAL block, which renders every turn: *"What
  you're describing sounds like it goes beyond what building a manual
  can help with. A therapist could work with this in ways I can't."*

**What it currently does**: the constitutional ceiling is stated in
Tier 1 Rule 7 and an always-rendering Tier 3 block. The model chooses
when to refer based on prompt criteria. There is no deterministic
detector that fires "refer to a clinician" off observed signals — and
under Decision 1 that's correct; the boundary is positioning, not
gating. The corresponding gating thing (scope-exit) is a separate
piece of the planned safety architecture, documented alongside the
Selector below.

**Status**: `solid`. The constitutional text is in place and tested
by phrase-pin assertions in
[system-prompt.test.ts](src/lib/persona/system-prompt.test.ts).

**Open question**: should referral fire deterministically when
extraction's `clinical_flag.level === "caution"` (i.e., as a code
gate, not just a prompt suggestion)? The flag exists at
[extraction.ts:37](src/lib/persona/extraction.ts:37). It is read by
`validateMaterialQuality` to block at `"crisis"`, but `"caution"` has
no code effect today.

---

## Architectural commitments (pre-decision)

These commitments pre-date the seven decisions and shape the architecture
alongside them. They aren't restated as decisions because they are not
arguable — they are the constraints inside which the decisions get made.
Five commitments load-bear:

**The two-watcher separation.** Watcher 1 (alliance monitor, §1) and
Watcher 2 (pattern tracker, §2) are SEPARATE Anthropic calls, kept apart
deliberately. A single call asked to do both jobs would starve the
quieter one (alliance watching) in favor of the louder one (pattern
hunting). This separation is non-negotiable. Verified in code:
[monitor.ts](src/lib/persona/monitor.ts) and
[extraction.ts](src/lib/persona/extraction.ts) are independent system
prompts to independent calls, cached separately, written to independent
tables.

**The monitor gates the tracker.** Recognition cannot fire while
alliance is in rupture. A "yes" from a sinking user is not a yes. This
precedence rule belongs in the Selector (alliance rows precede task
rows). It is not implemented today — see §1 and §3.

**Crisis is the one exception to never-prescribe.**
`WHEN_USER_ASKS_WHAT_SHOULD_I_DO`
([voice-scaffold.ts:434](src/lib/persona/voice-scaffold.ts:434)) is
never-prescribe — except when Tier 1 Rule 6 (crisis protocol,
[system-prompt.ts:279](src/lib/persona/system-prompt.ts:279)) fires. In
crisis, Jove DOES prescribe one thing: 988 and Crisis Text Line. The
carve-out is explicit in code in four places — see the
**Crisis carve-out** entry in the *Voice constraints* appendix.

**Each pattern runs the recognition arc once.** Re-surfacing the same
pattern produces weaker signal (decay). The architecture should not
loop the same pattern through Surface across many turns. No code
currently enforces this — see the Surface posture inside §4 and the
cross-session deferred work in §6.

**The "repair" naming.** In this codebase and this team's vocabulary,
**"rupture-repair" means detect-and-stop**. Therapeutic repair, as the
clinical literature uses the term, is above the ceiling — its force
comes from a real relationship surviving strain, which a tool does not
have. When the Selector adds rows for these postures, they will be
named for what they do (`withdrawal_yield`, `confrontation_hold`).
Until then, this document uses "repair" with that meaning explicit.

---

## How to read the component sections

Each of the six component sections (§1–§6) plus the *Scope-exit gate*
section follows the same seven-part structure:

1. **What it is, in one breath** — one-sentence definition.
2. **Where it lives in code** — specific files, functions, prompts.
3. **What it currently does** — behavior, traced to the code.
4. **What the decisions say it should do** — from the seven decisions
   and the pre-decision commitments.
5. **The gap** — difference between (3) and (4), with the change
   required.
6. **Status pill** — one of: `solid` · `validated` · `partial` ·
   `unproven` · `deferred` · `not-yet-built`.
7. **Open questions** — things the code raises that the decisions
   don't resolve.

§4 Generator additionally carries a *Postures the Selector routes to*
sub-section listing each posture (Reflect, Get concrete, Surface,
Save, Contract, plus the alliance postures `withdrawal_yield` and
`confrontation_hold`) with its own one-paragraph treatment. Postures
are generator behaviors, not separate components — they're shown
inside §4 because that's where they fire.

Role markers appear when a section is load-bearing for one role over
the other. **(Architect-of-the-code)** speaks from the file system.
**(Architect-of-the-decisions)** speaks from the locked decisions.

---

## 1 · Monitor (Watcher 1)

**What it is**: A separate Anthropic call, run alongside the generator
on every web turn, that produces a structured read of the **alliance**
between Jove and the user. Five axes: `bond_holding`, `task_agreed`,
`scope`, `rupture`, `direction`. One of the **two-watcher separation**
load-bearing commitments — Watcher 1 watches alliance, Watcher 2 (§2)
watches the user's patterns. They must remain separate calls.

**Where it lives in code**:

- Prompt + parser:
  [src/lib/persona/monitor.ts](src/lib/persona/monitor.ts) (the entire
  file). System prompt at lines 56–95. `parseMonitorRead` at line 189
  is adversarial — returns `null` on any shape error.
- Model: `MONITOR_MODEL = "claude-opus-4-7"` per
  [config.ts:52](src/lib/persona/config.ts:52). Deliberately Opus to
  test the ceiling of detection.
- Wiring:
  [persona-pipeline.ts:398](src/lib/persona/persona-pipeline.ts:398)
  `fireBackgroundMonitor()`. Called once per web turn at
  [call-persona.ts:531](src/lib/persona/call-persona.ts:531),
  fire-and-forget, wrapped in `waitUntil(promise)` so Vercel keeps
  the function alive until the write settles.
- Storage: `public.monitor_reads` per
  [supabase/migrations/20260521120000_add_monitor_reads.sql](supabase/migrations/20260521120000_add_monitor_reads.sql).
  Admin-read-only via `is_admin()`. CHECK constraints enforce the
  enum shape.
- Branch history: `claude/phase-0-shadow-monitor` was merged via
  commit `3b77673` ("Merge: Phase 0 shadow monitor") and follow-up
  `db9cf35` ("Merge: Phase 0 follow-ups — Opus + replay harness +
  skill").
- SMS path **does not call** the monitor — see the explicit comment
  at [call-persona.ts:526–531](src/lib/persona/call-persona.ts:526).
  Web only for Phase 0.

**What it currently does**:

- Receives the last `MONITOR_MESSAGE_WINDOW = 8` messages (last ~4
  exchanges) per
  [monitor.ts:50](src/lib/persona/monitor.ts:50). Window is intentional
  — alliance state is about the recent shape, not the long arc.
- Asks Opus for a JSON-only structured read. System prompt is explicit:
  "Read the alliance, not the content."
- Writes a row to `monitor_reads` on success; logs structured
  `monitor_failed` on any failure (the `.catch` at
  [persona-pipeline.ts:434](src/lib/persona/persona-pipeline.ts:434)).
- **Reads its output into nothing.** Shadow-only by design. The
  comment at the top of `fireBackgroundMonitor` is unambiguous:
  *"Log-only — no behavior on the call path reads or gates on the
  monitor's output."* That is the whole Phase 0 stance.

**What the decisions say it should do**:

- **Pre-decision commitment — two-watcher separation**: Monitor is a
  *separate* Anthropic call, kept apart from the pattern tracker
  (extraction). **Non-negotiable.**
- **Pre-decision commitment — monitor gates the tracker**:
  Recognition cannot fire while alliance is in rupture. The
  precedence rule lives in the Selector (alliance rows precede task
  rows).
- **Decision 7 — sequencing**: Phase 0 first (validate the read
  against a real transcript), then Lock 1, then Contract, then
  Reflect-as-default, then safety spine integration. Safety spine
  integration is **last**, only after Phase 0 returns clean.

**The gap**:

- **The two-call separation is in place.** Confirmed: monitor.ts
  and extraction.ts are independent system prompts to independent
  calls, cached separately, written to independent tables.
- **The monitor gating the tracker is not.** No code reads
  `monitor_reads`. When the safety spine integrates, the path is:
  (1) load the latest monitor row in `loadConversationContext`,
  (2) pass it down into the deterministic Selector (§3), (3) let
  the Selector use `rupture` and `scope` to suppress recognition
  and pick an alliance-side posture. None of that exists.

**Status**: `validated` (detection). Phase 0 closed 2026-05-27; see
[phase-0-closeout.md](docs/architecture/phase-0-closeout.md). Not a
blanket validation — it holds per axis:

- **`direction`** (the slope read: `steadying` / `drifting` /
  `sinking`) — **validated and load-bearing.** It caught the
  documented failure mode on real data: an engaged user flattening
  across five consecutive turns while the assistant escalated
  interpretation (Run 6, T4–T8 — the depressive-state-as-pattern
  case the whole design exists to prevent). Tracks recovery
  immediately, with no lag.
- **`rupture`** (`withdrawal` vs `confrontation`) — **validated,**
  with a one-turn lag after recovery: the flag persists one turn past
  re-engagement (see the calibration finding in §3 Selector's open
  questions). Confrontation is correctly distinguished from
  withdrawal via `task_agreed: false` + `bond_holding: true`.
- **`scope`** (`in_scope` / `drifting` / `out_of_scope`) — **observed
  and wired, but NOT validated** for the decision-seeking pull. The
  axis emitted `drifting` organically in two runs (off-thread arrival,
  drug mention), but no run exercised a user pulling toward "what
  should I do." This must be validated before the `scope_exit`
  selector row gates behavior.

**Open questions**:

- The monitor sees an **8-message window**. Phase 0 confirmed it
  catches a five-turn slope (Run 6, well within the window). A slope
  longer than the window — withdrawal developing across 14+ turns —
  remains untested; the replay harness at
  `scripts/transcripts/replay-*.txt` and the `/replay-monitor` skill
  can exercise it if a long-arc transcript surfaces.
- The monitor produces a single per-turn read. The `direction` field
  is documented as a **sliding-window slope**, but the model is
  re-computing it fresh each turn without the prior turn's read as
  input. Worth piloting whether anchoring against trajectory improves
  the read (see Open Question 5 in section B).
- Monitor failures are caught and logged but not counted as a metric.
  Will Phase 0 telemetry distinguish "model unavailable" from "parse
  failure" from "valid but disagreed-with"?

---

## 2 · Extraction (Watcher 2)

**What it is**: A separate Anthropic call, run in parallel with the
generator on every turn, that produces the cumulative
`ExtractionState` — language bank, per-layer signals, depth,
checkpoint gate, `pattern_engaged`, clinical flag. The pattern-side
of the two-watcher separation. The within-session seed of Watch;
real cross-session Watch is v1.5 (§6).

**Where it lives in code**:

- Prompt + runner: [extraction.ts](src/lib/persona/extraction.ts).
  `runExtraction` at
  [extraction.ts:362](src/lib/persona/extraction.ts:362). System
  prompt at lines 150–358 (with `EXTRACTION_SYSTEM`).
- Model: `EXTRACTION_MODEL = "claude-sonnet-4-6"` per
  [config.ts:38](src/lib/persona/config.ts:38).
- Wiring:
  [persona-pipeline.ts:326](src/lib/persona/persona-pipeline.ts:326)
  `fireBackgroundExtraction()`. Wrapped in `waitUntil(promise)` so
  Vercel keeps the function alive until the write settles. Called
  at [call-persona.ts:525](src/lib/persona/call-persona.ts:525)
  before the generator starts streaming — true parallel execution.
- Inputs: previous extraction state + last
  `EXTRACTION_MESSAGE_WINDOW = 12` messages + confirmed Manual
  entries.
- Output shape: `ExtractionState` at
  [extraction.ts:43](src/lib/persona/extraction.ts:43). Stored as
  JSONB on `conversations.extraction_state`.

**The pattern-tracking fields**:

- `language_bank`: cumulative, capped at ~15 entries. User's exact
  charged phrases.
- `layers.[id]`: per-layer signal
  (`none → emerging → explored → checkpoint_ready`),
  `material`, `examples`. Monotonic forward.
- `depth`: `surface → behavior → feeling → mechanism → origin`.
- `checkpoint_gate`: `concrete_examples`, `distinct_contexts`,
  `has_mechanism`, `has_charged_language`,
  `has_behavior_driver_link`, `strongest_layer`.
- `pattern_engaged`: boolean. True when Jove has named a pattern and
  the user engaged with it (extraction.ts:292).
- `current_thread`: one-sentence summary of what's underneath the
  topic.
- `user_named_cost`, `user_named_stance`: informational, not gates.

**What it currently does**:

- Every web turn (and SMS turn, with a 1-turn lag per ADR-001 /
  ADR-002), extraction runs alongside the generator. It updates the
  cumulative `ExtractionState` and writes to
  `conversations.extraction_state` via `fireBackgroundExtraction`.
- The generator reads the *previous* turn's extraction state via
  `formatExtractionForPersona`. The brief is 3–5 sentences plus the
  language bank.
- `applyCheckpointGates` (§5 Composer) reads the extraction state to
  gate Save.

**What the decisions say it should do**:

- **Decision 2 — Watch (cross-session pattern detection) is v1.5**:
  "Beta proves within-session recognition. Within-session pattern
  tracking is the SEED of Watch, not Watch itself."
- **Pre-decision commitment — two-watcher separation**: kept.

**The gap**:

- **Within-session seed**: matches the decision. `partial` because
  the seed measures gate conditions and produces the brief, but it
  doesn't *act on* the patterns across turns beyond gating Save.
- **Cross-session retrieval**: deferred to v1.5; see §6 Manual for
  the read-back path.

**Status**: `partial` (within-session seed).

**Open questions**:

- The extraction prompt at lines 350–358 explicitly says *"The
  checkpoint gate is a quality assessment. Do not count turns."* But
  `applyCheckpointGates` has a turn-count suppression rule (< 5
  turns since last). The two coexist intentionally — extraction
  assesses quality, the gate adds an anti-flood floor.
- `pattern_engaged` is the key gate addition from the 2026-05-19
  changes. It catches the failure mode where Jove writes a
  checkpoint Sonnet thinks is justified but the user never engaged
  with the named pattern. The architecture document treats this as
  the within-session equivalent of Decision 6's "resonated"
  criterion.
- Across sessions, only confirmed `manual_entries` carry forward.
  `current_thread`, language bank — all
  die at session boundary. Decision 2 says Watch is v1.5; until
  then, session boundaries are walls.

---

## 3 · Selector (planned)

> **(Architect-of-the-decisions)** This is the architecture's
> centerpiece and the single largest gap. The whole document
> describes a system that will route through a selector that does
> not yet exist.

**What it is**: A deterministic precedence ladder. Reads context plus
the latest monitor read plus the extraction state. Picks one row per
turn, top to bottom, stops at first match. Each row routes to one
posture the generator (§4) will take. Decision 4's structural
centerpiece.

**Where it lives in code**: it doesn't. There is no `selector.ts`
file. Today's substitute is `TIER_3_BLOCKS` at
[system-prompt.ts:345–722](src/lib/persona/system-prompt.ts:345) —
an array of conditional Tier 3 blocks. Each block has a
`shouldRender(flags)` predicate. The blocks render in array order;
**multiple blocks can fire together**. This is a flags-keyed
multi-block renderer, NOT a precedence ladder that picks one posture.
The model — not deterministic code — chooses among the rendered
guidance.

**What it currently does**: nothing as a deterministic decider.
What's there:

- `TIER_3_BLOCKS` selects which prompt blocks load each turn, based
  on flags like `isNewUser`, `isReturningUser`, `checkpointApproaching`,
  `turnCount`, `mode`, `postConfirmMode`.
- `deriveCheckpointApproaching`
  ([persona-pipeline.ts:629](src/lib/persona/persona-pipeline.ts:629))
  decides whether to load the `checkpoints` block — closest existing
  analog to a row-condition.
- `applyCheckpointGates` post-detection check (§5 Composer).

None of these is a selector. They're context-aware block loading +
post-hoc gating.

**What the decisions say it should do**: Decision 4 — **Reflect-as-
default architecture (with selector ladder)**. The engine's default
**action** is REFLECT. Heavier moves (Get concrete, Surface, Save)
fire only when their specific conditions justify leaving the default.
**This is an architectural commitment about the SELECTOR, not a
prompt instruction to the generator.** Structural, not stylistic.

The decision is explicit about what this is NOT: *"not 'tell the
generator to reflect more.' Not 'reduce the variety of moves.'
Reflect is a wide family — mirroring, complex reflection, flat
acknowledgment, one-notch-beneath, sharp question about a specific
word, silence as a turn. The commitment is about WHEN reflect is the
default, not about what reflect contains."*

**The eight rows** (precedence top to bottom; English alongside the
schema names that downstream code will read):

Alliance rows (precedence above task rows):

1. **`scope = "out_of_scope"`?** — *Is the user pulling toward "what
   should I do tonight" rather than "how do I operate"?*
   → `scope_exit` (suppress save, return to behavior territory; see
   the *Scope-exit gate* section that follows for the code-level
   gate).
2. **`rupture = "withdrawal"`?** — *Is the user going flat —
   shrinking signal, "I guess," compliance without engagement?*
   → `withdrawal_yield` (give room; stop the move that produced
   the withdrawal).
3. **`rupture = "confrontation"`?** — *Is the user pushing back with
   content — "that's not what I meant," challenging the read?*
   → `confrontation_hold` (stay present; don't go soft).

Task rows:

4. **`needs_contract`?** — *Has the contract drifted mid-session, or
   is the user explicitly asking what this is?* (Rare; only on task
   drift. Mid-session re-firing requires `task_agreed` to be more
   reliable than it currently is — v1.5.) → `contract`.
5. **`thread_recognized && alliance_clear`?** — *Has the user
   already engaged with a named pattern, and the alliance reads
   stable?* → `formalize` (Jove writes the canonical Save transition
   line; the composer chain in §5 takes over).
6. **`thread_ripe && alliance_clear`?** — *Is a thread ripe (concrete
   scene + user's own words carrying the pattern), with no rupture in
   the way?* → `surface` (name the pattern back to the user; produce
   the recognition moment; do not propose Save this turn).
7. **`user_abstract_about_live_thing`?** — *Is the user being
   abstract about something live — using labels and claims instead of
   walking through a moment?* → `get_concrete` (move from label to
   scene).
8. **else (fall-through)** → `reflect` (the default; Jove receives,
   lands, asks).

**The gap**: this is the single largest gap between the architecture
and the code. To close:

1. **Build the selector.** A deterministic function (likely a new
   file `src/lib/persona/selector.ts`) that takes
   `ConversationContext` plus the latest monitor read and returns
   one of the eight row outputs.
2. **Wire it.** The selector's output picks which Tier 3 block(s)
   render (per *Blockers on Lock 1* blocker 1: pre-prompt
   selector). The conversation Sonnet then sees a prompt shaped to
   one posture row.
3. **Move the gates.** `applyCheckpointGates` becomes the
   `formalize` row's gate. The `surface` row gets its own
   threshold (per *Blockers on Lock 1* blocker 2). Reflect is the
   fall-through; no condition needed.

Today's substitute is implicit: Jove receives a system prompt that
contains many blocks at once plus an extraction brief, and the model
chooses what to do. The risk this carries is the same risk the
original failure carried — when the model picks Surface or Save on
weak material, there is no deterministic guardrail above the soft
post-validators in the composer chain.

**Status**: `not-yet-built`.

**Open questions**:

- The eight rows assume `surface` and `formalize` are distinct (see
  *Blockers on Lock 1*, blocker 2 — Surface's ripeness threshold).
  How does the selector hand a `surface` decision to the generator?
  A new Tier 3 block? A system-message directive the generator reads
  as "name the pattern, don't propose to save it"? The decision
  describes the row but not the wire-up.
- Several existing Tier 3 blocks already encode posture
  (`post-rejection`, `post-confirm-*`, `guided-intake`). Do those
  survive the selector, or get folded into rows? The clean answer is
  the selector picks a row, and the row picks the block — but that
  means `TIER_3_BLOCKS` becomes the selector's *output handlers*,
  not a flags-keyed render list. Non-trivial refactor.
- Voice rule R-12 (sequence is evidence → pattern → image → hand
  back) becomes the `surface` row's *quality* contract once trigger
  and quality are separated. Future R-12 edits get evaluated against
  the Selector, not against voice alone.
- **Rupture-flag lag (Phase 0 calibration finding).** The monitor
  holds `rupture` set for one turn after the user has cooled and
  re-engaged — reproduced in Run 5 (T7) and Run 6 (T12), so not
  noise. It touches rows 2 and 3 (`withdrawal_yield`,
  `confrontation_hold`): a stale rupture flag would hold an alliance
  posture one turn too long. The `direction` slope does **not** have
  this lag, so the load-bearing signal is unaffected. **Leaning
  answer — selector-side fix:** rupture fires on first detection;
  subsequent turns require fresh rupture-bearing content to re-fire,
  rather than asking the monitor prompt to self-correct (less
  reliable under pressure). Preserves the full monitor read for
  telemetry. Decision made during selector design. See
  [phase-0-closeout.md](docs/architecture/phase-0-closeout.md) §5.

---

## Scope-exit gate (planned, alongside the Selector)

> Part of the planned safety architecture. Distinct enough from the
> Selector to have its own section, but adjacent because both depend
> on the monitor read-back that doesn't exist yet.

**What it is**: A deterministic check that fires when the
conversation has drifted out of "understanding how you operate" and
into "what should I do tonight." Decision 4's Selector places this
as **the first row in the precedence ladder** (out-of-scope →
scope-exit posture, save-suppression ON). The scope-exit gate is
the *code-level enforcement piece* of that row: when the gate fires,
no Save is allowed to land regardless of what the rest of the
pipeline decides.

**Where it lives in code**:

- The signal source exists: monitor's `scope` field, written to
  `public.monitor_reads` per
  [monitor.ts:29](src/lib/persona/monitor.ts:29) and the migration
  at [20260521120000_add_monitor_reads.sql](supabase/migrations/20260521120000_add_monitor_reads.sql).
  Values: `"in_scope" | "drifting" | "out_of_scope"`.
- **No consumer**. Nothing reads `monitor_reads` back into any code
  path. The monitor is fire-and-forget via `fireBackgroundMonitor`
  and shadow-only by design (Phase 0).
- The closest analog that exists is the crisis branch of
  `validateMaterialQuality`:
  [persona-pipeline.ts:516–519](src/lib/persona/persona-pipeline.ts:516)
  blocks the checkpoint when `clinical_flag.level === "crisis"`.
  That comes from extraction, **not** from the monitor's `scope`
  field.

**What it currently does**: nothing. There is no code-level
scope-exit gate. The conversation prompt has prose nudging Jove back
to behavior when material runs hot, but nothing deterministically
suppresses saves when the user has pulled toward live decision-making.

**Beta exposure**: narrower than it was, but not closed. Phase 0
closed 2026-05-27 — monitor **detection** is proven (`direction` and
`rupture` validated against real transcripts; see
[phase-0-closeout.md](docs/architecture/phase-0-closeout.md)). The
remaining gap is **consumption**: no selector reads the monitor's
output, so detection that works changes no behavior on the live turn.
Until the safety spine integrates (per Decision 7, last in the build
order), the original failure mode — Save fires on out-of-scope
material — has the same architectural exposure as before this rebuild.
The soft validators in §5 are the only thing between extraction and a
bad Manual entry. Lock 1 (§5) closes one specific exposure (thin
material). The scope-exit exposure specifically persists for **two**
reasons: no consumer exists to read the `scope` signal, **and**
scope-drift detection (the decision-seeking pull) is itself not yet
validated — Phase 0 left `scope` observed-but-unproven. Both must
close before the `scope_exit` row gates behavior.

**What the decision says it should do**: Decision 4's Selector puts
scope-exit at row 1: when `scope === "out_of_scope"`, run a
scope-exit posture and **turn save-suppression ON**. Pre-decision
commitment: "Recognition cannot fire while alliance is in rupture. A
'yes' from a sinking user is not a yes." Scope-exit is the same
principle applied to `scope` rather than to `rupture`.

**The gap**: the signal exists in shadow mode but no code reads it.
To close:

1. Read the latest `monitor_reads` row for this conversation into
   `ConversationContext` (alongside `previousExtraction`).
2. Add an early-return / suppression branch in `applyCheckpointGates`
   when `latest.scope === "out_of_scope"` (or, per Decision 4, route
   through the deterministic Selector).
3. Decide whether the scope-exit posture is a new Tier 3 block, a
   different system message, or a tool-use directive (this is part
   of the Selector wire-up question).

**Status**: `not-yet-built` (Phase 0 of the safety spine —
read-back not yet promoted past shadow).

**Open questions**:

- Should the gate use the **latest** monitor read, or a **running**
  read over a window? The monitor today returns a per-turn read with
  a `direction` slope, but the slope isn't accumulated turn-to-turn
  (see §1's open questions).
- Does scope-exit suppress only saves, or also recognition naming?
  Decision 4 says save-suppression ON, but the Selector row also
  picks a scope-exit *posture* — what does that posture say to the
  user?

---

## 4 · Generator

**What it is**: The conversation Sonnet call that produces each Jove
turn. Receives the assembled system prompt (Tier 1 + Tier 2 + Tier 3
blocks + dynamic context) and the conversation history; streams a
response. Today, the model is told a lot at once via flags-keyed
prompt blocks; under the future Selector, it will be told *which
posture to take* and the prompt will be shaped accordingly.

**Where it lives in code**:

- Call site: `callPersona` in
  [src/lib/persona/call-persona.ts](src/lib/persona/call-persona.ts).
  Streaming Anthropic call via `anthropicStream`. Per-turn flow:
  save user message → load conversation context → fire extraction +
  monitor in parallel → assemble system prompt → stream response →
  post-stream classification + composition (see §5).
- Prompt assembly: `buildSystemPromptBlocks` at
  [system-prompt.ts:869](src/lib/persona/system-prompt.ts:869). Emits
  three cache-aware blocks: `tier1` (constitutional intro), `staticContext`
  (Tier 2 voice + compressed older Manual entries), `dynamic` (Tier 3
  mechanics + recent Manual entries + extraction brief).
- Model: `PERSONA_MODEL = "claude-sonnet-4-6"` per
  [config.ts:36](src/lib/persona/config.ts:36). Max tokens: 2048.

**What it currently does**: each turn, the generator receives the
full assembled prompt — Tier 1's constitutional rules, Tier 2's
voice scaffold + persona deltas (the *Voice constraints* appendix
catalogues these), Tier 3's conditional blocks (`first-message`,
`guided-intake`, `upload`, `returning-user`, `checkpoints`,
`first-checkpoint`, `post-rejection`, `post-confirm-*`,
`adapting-short-answers`, `readiness-gate`, `clinical-and-tail`) —
plus dynamic context (compressed Manual, session summary, extraction
brief, transcript detection, exploration focus). The model decides
what to do; output is streamed to the user.

**What the decisions say it should do**: Decision 4 makes the
generator's job narrower and more deterministic: it executes the
posture the Selector (§3) chose. The prompt becomes shaped to one
row. Today's flags-keyed multi-block assembly becomes a row-specific
assembly. The voice constraints (appendix) still wrap every turn —
they don't change. What changes is the Tier 3 layer: which posture
block loads, picked by the Selector instead of by flags.

**The gap**: the generator works (the call is solid and streams
reliably; chips, post-confirm hand-offs, crisis-resource append, and
the deterministic Save-transition detector all sit cleanly around
it). The gap is upstream: the Selector that should be shaping the
prompt doesn't exist. Today, the generator is asked to be its own
selector via prompt instructions. The model is generally good at
this; it is also occasionally wrong in ways the soft validators in
§5 catch but don't block.

**Status**: `solid` as the call mechanic; `partial` once you count
the postures inside it. The mixed state of the postures (described
below) is what gives the Generator its `partial` overall pill.

### Postures the Selector routes to

Seven postures — five "forward moves" plus two alliance postures —
that the Selector (§3) routes to. Each one's *current state* is
described accurately: some live in voice rules, some in Tier 3
blocks, some have plumbing but missing content, some don't exist
yet at all. The point of this sub-section is to show that the
postures are generator behaviors at varying maturity — not
components.

**`contract`** (forward move). The two-sentence opening posture: names
what Jove does, names what it doesn't, asks if that's the work.
**Current state**: plumbing exists in three mode-specific openers
(`SITUATION_OPENER` in
[situation-copy.ts](src/lib/persona/situation-copy.ts),
`GUIDED_INTAKE_OPENER` in
[guided-intake-copy.ts](src/lib/persona/guided-intake-copy.ts),
`UPLOAD_OPENER` in
[upload-copy.ts](src/lib/persona/upload-copy.ts)), each consumed by a
Tier 3 block in
[system-prompt.ts:347–482](src/lib/persona/system-prompt.ts:347).
None contains the contract sentences naming what Jove doesn't do.
Decision 3 specifies this is a **content edit** to the three
openers, no new selector wiring. **Status**: `not-yet-built`
(content); `solid` (plumbing). **Open question**: the three
variants must say different things — Situation's contract fits
before "tell me what's running"; Guided's before "name a
relationship"; Upload's before "paste what you've got." The
architecture document does not decide the wording.

**`reflect`** (forward move; the default). The wide family: mirror,
complex reflection, one-notch-beneath, flat acknowledgment, sharp
question about a specific word, silence as a turn. **Current
state**: lives in voice rules today — `VOICE_RULES_BASE` rules 2,
4, 17 ([voice-scaffold.ts:46](src/lib/persona/voice-scaffold.ts:46)),
and the rhythm receive → land → ask demonstrated in
`LANDING_EXAMPLES_BASE` (line 146). As a *selector behavior*,
reflect lives nowhere — there is no precedence ladder in code that
selects reflect as fall-through. Today, Jove is told to reflect via
voice rules, which is exactly what Decision 4 says NOT to do
(reflect should be *structural*, not stylistic). **Status**:
`partial` — voice instructions exist; selector-level default does
not.

**`get_concrete`** (forward move). The posture Jove takes when the
user is being abstract about a live thing — move from label to
scene, claim to moment. **Current state**: distributed across
multiple prompt locations — `DEEPENING_INTRO/OUTRO` at
[voice-scaffold.ts:417](src/lib/persona/voice-scaffold.ts:417);
`DIRECTED MOVES` in the `guided-intake` Tier 3 block at
[system-prompt.ts:425](src/lib/persona/system-prompt.ts:425); the
"Abstract" branch of `first-message` at
[system-prompt.ts:364](src/lib/persona/system-prompt.ts:364); the
`adapting-short-answers` escalation at
[system-prompt.ts:679](src/lib/persona/system-prompt.ts:679). No
deterministic detector says "user is being abstract → produce a
scene invitation"; the model decides. The closest extraction-side
signal is `depth === "surface"` with `current_thread` non-empty.
**Status**: `partial`. **Open question**: `depth === "surface"`
doesn't distinguish "user is abstract because they're starting"
from "user is abstract because they're retreating" (the latter is
withdrawal, not get-concrete). The Selector needs a way to tell
these apart.

**`surface`** (forward move; the recognition moment). The posture
where Jove names the pattern back to the user, in their own words.
**Precedes** Save. The product moment. **Current state**: lives in
the `checkpoints` Tier 3 block at
[system-prompt.ts:512–574](src/lib/persona/system-prompt.ts:512),
specifically the `NAMING THE PATTERN (before any checkpoint)`
subsection at line 533. Three shapes listed (pointing at repetition,
plain description, naming the contradiction). As a *separately
gated posture*, Surface does not exist — there's no `surface` block,
no `surface` row, no signal that says "ripe enough to Surface but
not ripe enough to Save." `pattern_engaged` is used as a gate on
Save, not as a trigger for Surface. **Status**: `partial` —
recognition fires as a generator move; the deterministic Selector
row Decision 4 + Decision 6 specify is `not-yet-built`. **Open
questions**: see §3 (Selector) and *Blockers on Lock 1* blocker 2
for the Surface threshold question; voice rule R-12 becomes the
Surface row's quality contract under the proposed architecture.

**`save`** (forward move). The posture where Jove writes the
canonical transition line *"I want to put something in your
Manual."* This **triggers the composer chain in §5** — detection,
gates, Opus composition, atomic write. **Current state**: the
transition phrase is detected deterministically by
`detectCheckpointInResponse` in
[src/lib/persona/detect-checkpoint.ts](src/lib/persona/detect-checkpoint.ts).
Whether the *generator* writes the transition is currently driven
by prompt logic (the `checkpoints` block instructs the model when
to propose). Under Decision 4, the Selector picks `formalize` and
the generator produces the transition; the composer chain in §5
takes over. **Status**: `partial` (generator-side; the composer
chain is `partial` with `not-yet-built` Lock 1 — see §5).

**`withdrawal_yield`** (alliance posture). When the user has gone
flat — short answers, "I guess," compliance without engagement.
Give room; stop the move that produced the withdrawal. Decision 5
ships this; the withdrawal slope it depends on was validated in
Phase 0 (Run 6, T4–T8). **"Yield"** because the achievable half of
repair is detect-and-stop
(see the *Architectural commitments* section on naming).
**Current state**: doesn't exist. The monitor's `rupture =
"withdrawal"` signal is written to `monitor_reads` and read by
nothing. **Status**: `not-yet-built`.

**`confrontation_hold`** (alliance posture). When the user pushes
back with content — "that's not what I meant" — stay present, don't
go soft. The opposite move from `withdrawal_yield`. Decision 5
ships this; confrontation was validated in Phase 0 against real
transcripts (Runs 5 and 6), distinguished from withdrawal via
`task_agreed: false` + `bond_holding: true`. **Current state**:
doesn't exist. **Status**: `not-yet-built`.

The corresponding `scope_exit` posture (when the gate fires) is
covered in the *Scope-exit gate* section above. The gate suppresses
save; the posture itself — what Jove *says* when the conversation
has drifted out of scope — is part of the Selector wire-up question
(see §3 open questions).

---

## 5 · Composer

**What it is**: The Save path. Detection of the canonical transition
line in Jove's response, post-detection gates, Opus composition of
the polished Manual entry, atomic write to the database. The end of
the recognition arc: Surface → Save (the posture in §4) → Detection
→ Gates → Compose → Confirm → Write.

**Where it lives in code**:

- **Detection**: `detectCheckpointInResponse` at
  [src/lib/persona/detect-checkpoint.ts](src/lib/persona/detect-checkpoint.ts).
  Looks for "I want to put something in your Manual" in Jove's
  response. Deterministic, code-level. No probabilistic classifier
  sits between Jove's words and the card.
- **Post-detection gates**: `applyCheckpointGates` at
  [persona-pipeline.ts:659–694](src/lib/persona/persona-pipeline.ts:659).
  Two rules: (1) material-quality gate via
  `validateMaterialQuality`, (2) turn-count suppression (< 5 turns
  since last checkpoint).
- **Material-quality gate**: `validateMaterialQuality` at
  [persona-pipeline.ts:508](src/lib/persona/persona-pipeline.ts:508).
  Standard gate (non-first): `concrete_examples >= 2`,
  `distinct_contexts >= 2`, `has_mechanism`, `has_charged_language`,
  `has_behavior_driver_link`, `pattern_engaged === true` (with
  turn-12 override), `depth` at `"mechanism"` or deeper.
  First-checkpoint gate is lighter: `concrete_examples >= 1`,
  `distinct_contexts >= 1`, `has_charged_language`,
  `has_mechanism OR has_behavior_driver_link`, `depth` at
  `"feeling"` or deeper.
- **Composer call**: `composeManualEntry` at
  [confirm-checkpoint.ts:39–338](src/lib/persona/confirm-checkpoint.ts:39).
  Separate Anthropic call. Model: `COMPOSITION_MODEL =
  "claude-opus-4-6"` per
  [config.ts:39](src/lib/persona/config.ts:39). (Note: this is
  Opus, not Sonnet — `docs/system.md` describes the composer as
  Sonnet, which is stale; see Open Question 2 in section B.)
- **Composer outputs**: `content`, `name`, `layer`, `changelog`,
  `summary`, `key_words`, `acknowledgment`.
- **Composer soft validators** (log only, never block):
  - `findUniversalToneViolations` at
    [confirm-checkpoint.ts:361](src/lib/persona/confirm-checkpoint.ts:361)
    — logs when "always/every/all/never/everyone/nobody" appears
    in the entry but not in the user's messages.
  - `validateHeadline` at
    [confirm-checkpoint.ts:392](src/lib/persona/confirm-checkpoint.ts:392)
    — structural check on the headline. **Retries once via
    `composeHeadline` on failure**; keeps better of the two. Never
    blocks the entry.
  - `validateComposedEntry` at
    [persona-pipeline.ts:726](src/lib/persona/persona-pipeline.ts:726)
    — checks word count (80–150), somatic anchor presence,
    clinical-leak regex, time-reference regex.
- **Confirm flow**: `confirmCheckpoint` at
  [confirm-checkpoint.ts:564](src/lib/persona/confirm-checkpoint.ts:564).
  Idempotent. Delegates the write to a Postgres function
  `confirm_checkpoint_write` (per migration
  `20260417000003_confirm_idempotency.sql`) that locks the row,
  inserts to `manual_entries`, flips status, inserts system message
  — atomic.

**What it currently does**:

- Detect transition phrase in Jove's response.
- Run `applyCheckpointGates`. If gate fails: strip the transition
  line from the response, rewrite the saved row, do not compose.
  This is the post-`waitUntil` April 2026 fix wired in step 12b of
  call-persona.ts; it prevents the user from seeing "I want to put
  something in your Manual" with no card behind it.
- If gates pass: call the composer (Opus). Composer picks layer,
  headline, prose. Soft validators run and log. If composition
  fails or returns an invalid layer: suppress, rewrite, no card.
- If composition succeeds: build `checkpoint_meta`, attach to the
  message, emit the trigger card. User confirms via UI button →
  `confirmCheckpoint` writes atomically via the Postgres function.

**What the decisions say it should do**:

- **Decision 6 — Lock 1 ships in beta**: *"The composer cannot save
  an entry unless the user's own evidence supports it. Concrete
  scene exists, user's own words carry the pattern, it resonated.
  The cheap implementation (chosen): a verbatim phrase from the
  user's language bank must appear in the saved entry, or the save
  fails."*
- **Decision 6 — Lock 2 is later**: *"Lock 2 (the user extended the
  pattern — 'real yes' detection) is a later upgrade. Ship Lock 1
  first."*
- **Decision 7 — Lock 1 is next**: after Phase 0. Smallest, most
  contained, highest safety value.
- **Pre-decision commitment — composer is a separate prompt from
  the conversational voice**: confirmed in code.

**The gap**:

- **Lock 1 is not implemented.** The composer prompt at
  [confirm-checkpoint.ts:99–191](src/lib/persona/confirm-checkpoint.ts:99)
  instructs the model to use the user's exact charged phrases
  verbatim. The composer does **not check** that any verbatim
  language-bank phrase appears in the saved entry. The soft
  validators do not enforce this. To close: a deterministic
  post-composition check — *for the composed `content` field, at
  least one entry from the input `languageBank` (filtered to
  `charge` ∈ {"high", "medium"}) appears verbatim, case-
  insensitively, in the content. If not, return null, suppress the
  checkpoint, rewrite the transition line out of the response.*
- **The composer papers over thin material.** Today, if the
  conversation has barely produced a language bank, the composer
  will still produce an entry. The headline retry and somatic-anchor
  regex are not thin-material gates; they're shape gates.
- **`composed_content` carries an Opus interpretation, not the
  user's words.** Per ADR-022, `composed_content` is rendered into
  the trigger card. The user reads it and either confirms or
  refines. If the composer hallucinated a phrase that "sounds like"
  the user, the user must catch it on the edit overlay. Lock 1
  closes this.
- **Cross-context requirement mismatch.** The code's standard gate
  requires `distinct_contexts >= 2`. Decision 6 says it is **not
  required, especially first session**. See *Blockers on Lock 1*
  blocker 3.

**Status**: `partial`. Detection, composition, soft validation,
confirm flow, and idempotent write are `solid`. Lock 1 is
`not-yet-built`. Lock 2 is `deferred`.

**Open questions**:

- **Verbatim is what, exactly?** A phrase from the language bank may
  be 1–10 words. The cheap implementation should be
  `content.toLowerCase().includes(phrase.toLowerCase())` with
  curly-quote normalization. Fragility lives in apostrophe variants
  and trailing punctuation.
- **What happens on Lock 1 failure?** The cleanest is: same as
  composition-failure today (strip transition, rewrite saved row, no
  card). Whether the suppression also signals back to extraction so
  next turn's brief is more honest is the deeper question — see
  Open Question 4 in section B.
- **Composer model is Opus, docs say Sonnet** — Open Question 2 in
  section B.
- **Lock 2 trigger.** "Real yes" detection is what — the user
  extended the pattern (added a third context, named a cost) in the
  *confirm* flow? Or post-confirm, the next turn shows engagement?
  The architecture does not specify, by design — Decision 6 says
  Lock 2 is later.

---

## 6 · Manual

**What it is**: The artifact the user is the author of. A five-layer
structured document of confirmed entries, accumulated across
sessions. The composer (§5) writes to it; the generator (§4) reads
from it as compressed context. The cross-session read-back that
would enable real "Watch" (Decision 2) is v1.5.

**Where it lives in code**:

- Schema: `manual_entries` table — five layers, many entries per
  layer, no per-layer cap, no type discriminator. Layer names are
  the single source of truth at
  [src/lib/manual/layers.ts](src/lib/manual/layers.ts) (per ADR-029).
- Write path: `confirm_checkpoint_write` Postgres function (per
  migration `20260417000003_confirm_idempotency.sql`). Atomic:
  locks the source message row, inserts the entry, flips checkpoint
  status to `confirmed`, inserts the system message. Called by
  `confirmCheckpoint` in
  [confirm-checkpoint.ts:564](src/lib/persona/confirm-checkpoint.ts:564).
- Read path: `prepareManualContext` and
  `prepareManualContextBlocks` in
  [src/lib/persona/manual-context.ts](src/lib/persona/manual-context.ts).
  Recent entries (current conversation + most recent ~4 backfill)
  render in full; older entries render as one-line summaries with
  key words. Loaded into the generator's prompt by
  `buildSystemPromptBlocks` (§4).
- Compressed summary + key words: produced by the same composer
  call (§5) that writes the entry. Stored as
  `manual_entries.summary` and `manual_entries.key_words`.
- UI: Manual tab in `MobileSession.tsx`; PDF export.

**What it currently does**:

- The artifact accumulates as users confirm checkpoints. Five
  layers, many entries each.
- Each turn, the generator loads the user's Manual via
  `prepareManualContext`. Within-session entries appear in full;
  older entries appear compressed. This is the cross-session
  "context bring-along" — confirmed material flows into the
  prompt, cheaply.
- The composer, when proposing a new entry, sees the full layer
  catalog (`composeManualEntry` reads all entries per
  [confirm-checkpoint.ts:78–89](src/lib/persona/confirm-checkpoint.ts:78))
  and is prompted to *"integrate with or deepen existing entries
  when relevant."* This is a *prompt instruction*, not an automated
  near-duplicate check.

**What the decisions say it should do**:

- **Decision 2 — Watch (cross-session pattern detection) is v1.5**:
  "Beta proves within-session recognition. Within-session pattern
  tracking is the SEED of Watch, not Watch itself. Real Watch needs
  cross-session retrieval (semantic search over the Manual or
  carrying Manual context per turn) which is not built and not in
  scope for beta."
- **Pre-decision commitment — each pattern runs the recognition arc
  once**: no code currently prevents near-duplicate Saves across
  sessions; the composer's layer-catalog input is the only
  guardrail.
- **Decision 1 — the Manual's expanded jobs are downstream**:
  sharing, articulation as polished artifact, augmenting external
  relationships. None of those load-bear on the engine's safety
  story for beta.

**The gap**:

- **The artifact and the write path are solid.** Atomic write,
  idempotent confirm, five-layer schema, compression in place.
- **Cross-session Watch is deferred.** The Manual-context
  compression is the *prerequisite* infrastructure for it — when
  v1.5 ships, the retrieval layer has somewhere to write to and
  read from cheaply.
- **No cross-session decay.** Nothing rejects a near-duplicate Save
  if the same pattern surfaced two sessions ago. The composer reads
  the catalog and is asked to integrate — but that's an instruction,
  not a check. Within-session decay is its own deferred item; see
  the Surface posture in §4 and Open Question 1 in section B.

**Status**: `solid` for the artifact + write path; `deferred` for
cross-session Watch and cross-session decay (both v1.5).

**Open questions**:

- The Manual-context compression already produces `summary` and
  `key_words` per entry — a near-duplicate check at Save time could
  read them. Whether to ship this with Lock 1, with the Selector, or
  with v1.5 Watch is part of Open Question 1 in section B.
- Decision 1 keeps the expanded jobs (sharing, network) downstream.
  The architecture must not yet load-bear on them. Worth flagging
  that beta does not need: per-recipient access controls, dual-Manual
  pairing, recipient-as-questioner mode. They're real product work,
  not engine work, and they live elsewhere when the time comes.

---

## A · The parallel build order

> **(Architect-of-the-decisions)** Decision 7 sequences the work
> *in parallel* — the decisions don't wait on each other. This
> section is the current status of each unit, not a Gantt.

### Phase 0 — Monitor validation against the original sinking transcript
- **Status**: `in flight`. Code is on main; data is being
  collected. The replay harness at
  [scripts/replay-monitor.ts](scripts/replay-monitor.ts) (referenced
  by the `/replay-monitor` skill) supports windowed vs. full-history
  comparison, and the `replay-20260521-*.txt` files in
  `scripts/transcripts/` are the saved test inputs.
- **Done when**: 20–30 transcripts have been eyeballed against the
  structured reads; the withdrawal slope reads correctly on the
  original sinking transcript at multiple snapshots; the rate of
  `monitor_failed` parse errors is acceptable (< 5% suggested).
- **Blocks**: safety spine integration (§1 + Scope-exit gate +
  §3 Selector).
- **Does not block**: Lock 1, Contract, Reflect-as-default (selector
  build).

### Lock 1 — Composer fail-closed on thin material
- **Status**: `not-yet-built`. Smallest unit. Decision 7 places this
  second, immediately after Phase 0.
- **Done when**: `composeManualEntry` returns null (and the pipeline
  strips the transition line) when no verbatim entry from the input
  `languageBank` appears in the composed `content`.
- **Touches**: [confirm-checkpoint.ts:200–340](src/lib/persona/confirm-checkpoint.ts:200)
  (composer return path), maybe `validateMaterialQuality` (if the
  check is upstream of composition), maybe `language_bank` shape
  (charge floor for what counts).
- **Risk**: the language bank can be sparse on early turns; the
  Lock 1 check needs a sensible "no charged language yet" branch
  that defers Save rather than failing every early checkpoint.
- **Blocks**: nothing else strictly, but every architecture decision
  that load-bears on Save being honest needs this.

### Blockers on Lock 1 — RESOLVED (ADR-043)

All three are now **decided** — see **ADR-043** in `docs/decisions.md`
("The Three Lock 1 Blockers — Pre-Prompt Selector, Surface Threshold,
Drop Cross-Context Gate"). Each was a question, a recommended answer,
and the downstream consequences of the recommendation vs. an
alternative; **ADR-043 ratified the recommended answer in every
case**, so the *Recommendation* in each block below is the decision.
In brief: (1) **pre-prompt selector** — runs after
`loadConversationContext`, before `buildSystemPromptBlocks`, reading
the *previous* turn's monitor output so the monitor stays off the
critical path; (2) **Surface fires on `concrete_examples >= 1 &&
has_charged_language` + alliance clear**, with `pattern_engaged` kept
Save-side only; (3) **drop the hard `distinct_contexts >= 2` gate**,
keeping it as a strengthening signal. With these settled, Lock 1's
build prompt can be written. The detail below is preserved as the
reasoning record.

**1 · Where does the Selector sit in the pipeline?** Pre-prompt (runs
after `loadConversationContext`, before `buildSystemPromptBlocks`; its
output picks which Tier 3 block(s) render), or pre-detector (runs
after generation, before `applyCheckpointGates`; its output is a
posture name the post-generation pipeline routes on)?

  *Recommendation*: **pre-prompt selector.** Decision 4 says the
  default action is REFLECT and heavier moves require their
  conditions to fire. That phrasing is about what the generator
  *does*, which is shaped by what the prompt *says*. A pre-prompt
  selector picks the row, which picks the block(s), which shape
  the generation. A pre-detector selector would have to gate or
  rewrite Jove's output after the fact, which is heavier and
  fights against the model rather than steering it.

  *Downstream if pre-prompt*: `TIER_3_BLOCKS` becomes the
  Selector's output handlers; many existing flags-keyed blocks
  collapse into row-specific blocks; `applyCheckpointGates`
  becomes the `formalize` row's gate; the generator sees a prompt
  shaped to one row, not a flags-keyed assembly. *If pre-detector*:
  the prompt builder stays flag-keyed; a new post-generation layer
  interprets Jove's output and decides whether to suppress,
  rewrite, or pass through. Larger refactor on the post-generation
  side; less invasive to the prompt assembly. The document's bias
  is pre-prompt because the decision describes the Selector as
  *structural, not stylistic* — that is a shaping move, not a
  filtering one.

**2 · What is Surface's ripeness threshold, separate from Save's?**
The code today has one ripeness check
([`deriveCheckpointApproaching`](src/lib/persona/persona-pipeline.ts:629)),
used both for `checkpointApproaching` (Save) and any Surface the
generator performs. Decision 6 defines Save's ripeness. Surface's
needs to be lighter, or Save's becomes the de facto Surface gate too.
Compounding problem: `pattern_engaged` requires Jove to have already
named a pattern, which is circular if Surface is what produces the
naming.

  *Recommendation*: **Surface trigger = `concrete_examples >= 1 &&
  has_charged_language` (plus alliance clear from the monitor).
  `pattern_engaged` stays on the Save side only.** The naming move
  *is* the Surface posture; it produces evidence the user can engage
  with; engagement is what `pattern_engaged` captures for the *next*
  turn's Save consideration. This breaks the circularity by
  separating "what triggers the naming" from "what gates the
  writing."

  *Downstream if this threshold*: Surface fires earlier than Save,
  sometimes much earlier — the user hears the pattern named in
  conversation well before any trigger card appears. The naming
  move's quality bar comes from voice rules (`VOICE_RULES_BASE`
  rule 12 — sequence is evidence → pattern → image → hand back),
  not from extraction's mechanical checks. *If a higher threshold*
  (e.g., adding `has_mechanism`): Surface and Save converge; the
  recognition arc skips its surfacing step; the original failure
  mode (Save on under-engaged material) gets a thinner guardrail.
  *If `pattern_engaged` is split in extraction into pre-naming and
  post-naming variants*: cleaner long-term but invasive — the
  extraction prompt and the `ExtractionState` shape both change.
  Recommendation is the cheapest path that breaks the circularity.

**3 · Does the cross-context requirement (`distinct_contexts >= 2`)
hold for non-first checkpoints?** The code's standard gate at
[persona-pipeline.ts:579](src/lib/persona/persona-pipeline.ts:579)
requires two distinct narrated scenes for a non-first checkpoint.
Decision 6 says *"Cross-context repetition strengthens but is NOT
required, especially first session."* Mismatch.

  *Recommendation*: **drop the hard requirement; keep
  `distinct_contexts` as a STRENGTHENING signal, not a blocking
  one.** Have it consume a softener in the headline (which it
  already does — `validateHeadline`
  ([confirm-checkpoint.ts:392](src/lib/persona/confirm-checkpoint.ts:392))
  enforces "can" or "sometimes" when `distinct_contexts <= 1`)
  rather than gate the entire Save path. Aligns with the decision;
  preserves the signal where it does load-bearing work.

  *Downstream if dropped*: more first-session non-first checkpoints
  (rare — most users won't have a confirmed entry yet on their first
  session); slightly higher rate of single-context Save events, each
  softened by the headline validator's hedging. Lock 1's verbatim
  check becomes the primary guardrail against over-claim, which
  matches Decision 6's intent. *If kept*: code stays as is;
  Decision 6's text needs updating to distinguish first-session from
  subsequent; Lock 1 has to thread around the cross-context gate.

### Contract — Opening posture (Decision 3)
- **Status**: `not-yet-built` (content); `solid` (plumbing).
- **Done when**: situation, guided-intake, and upload openers each
  contain two sentences naming what Jove does and doesn't do,
  asking if that's the work.
- **Touches**: `SITUATION_OPENER`, `GUIDED_INTAKE_OPENER`,
  `UPLOAD_OPENER`.
- **Risk**: copy work — iteration is the cost driver, not
  engineering.
- **Blocks**: nothing.

### Reflect-as-default — Selector ladder (Decision 4)
- **Status**: `not-yet-built`. Largest unit. Last before safety
  spine integration.
- **Done when**: a deterministic Selector picks one of the eight
  rows per turn, top-to-bottom precedence, reads from
  `ConversationContext` + latest monitor row + extraction state,
  and the prompt builder routes on the Selector's output rather
  than rendering a flags-keyed block list.
- **Touches**: new `src/lib/persona/selector.ts`. Existing
  `TIER_3_BLOCKS` becomes the Selector's output handlers (or gets
  collapsed into row-specific blocks). `loadConversationContext`
  reads latest `monitor_reads`. `applyCheckpointGates` becomes the
  `formalize` row's gate. `pattern_engaged` becomes the input to
  the formalize/surface distinction.
- **Risk**: largest. The Selector is the architecture's centerpiece.
  The prompt-builder refactor is non-trivial because many existing
  flags-keyed blocks are not 1:1 with selector rows.
- **Blocks**: safety spine integration. Lock 1 and Contract can
  ship in parallel.

### Safety spine integration — LAST
- **Status**: gated on Phase 0 returning clean.
- **Done when**: the monitor's `rupture`, `direction`, and `scope`
  drive Selector rows 1, 2, 3. Save-suppression is ON when `scope`
  is `"out_of_scope"` or `rupture` is active. Recognition is locked
  when `rupture` is active.
- **Touches**: Selector (Decision 4) + monitor read-back + the Save
  gate's awareness of Selector output.

---

## B · Open questions for Jeff

Six remaining. Four are post-Lock-1 follow-ups; two are
recommendations awaiting confirmation. For each, the document
proposes a recommended answer — confirm or push back. The three
architectural questions that block Lock 1's spec live in section A
under *Blockers on Lock 1*; the "repair" naming decision lives in
*Architectural commitments (pre-decision)*. Neither is open.

1. **Decay — within and across sessions.** The pre-decision
   commitment ("each pattern runs the recognition arc once") has no
   code today. *Recommended*: ship within-session decay **with the
   Selector (Reflect-as-default, fourth in the build order), not
   with Lock 1**. The recommendation looks small on the surface — a
   `recognized_threads: string[]` field on the extraction state,
   populated when a pattern is named, consumed to skip Surface on
   already-named threads — but in practice it requires changes to
   the `ExtractionState` TypeScript shape, the extraction prompt's
   JSON schema, the extraction prompt's instructions for when to
   populate the field, and a reader that does not exist until the
   Selector lands. Bundling this with Lock 1 expands Lock 1 beyond
   its current scope (Lock 1 is a composer-side verbatim check).
   Cross-session decay (read `manual_entries.summary` + `key_words`
   to refuse near-duplicate Saves) defers to v1.5. Confirm or push
   back.

2. **Composer model versus docs.** Code is Opus
   ([config.ts:39](src/lib/persona/config.ts:39)); `docs/system.md`
   says Sonnet. *Recommended*: update the doc to reflect Opus and
   add an ADR noting why composition specifically gets Opus while
   conversation stays on Sonnet — the failure mode of a bad
   composition (an entry filed under the wrong layer, or papered
   over thin material) is harder to roll back than a weak
   conversational turn, so the quality bar is higher. Confirm or
   push back.

3. **The handoff law's enforcement level.** Tier 1 Rule 4 is
   prompt-text plus soft post-gen counter
   ([`validateResponseStructure`](src/lib/persona/persona-pipeline.ts:796));
   no blocking. *Recommended*: stay soft for beta. Log the rate;
   promote to a blocking gate only if eval data shows the failure
   rate is structural rather than intermittent. Promoting risks
   false positives (the post-confirm continuation-offer is a
   directive-shaped handoff that the soft counter doesn't
   recognize). Confirm or push back.

4. **What happens when Lock 1 fails.** *Recommended*: same handling
   as composition-failure today — strip the transition line, rewrite
   the saved row, no card surfaced. *Open*: does the failure also
   signal to extraction so next turn's brief notes that this turn
   produced thin Save material? Decision-pending; the cheaper
   version (silent suppression) is enough for the first Lock 1
   build, and the richer signaling can be added later if the eval
   rate is high enough to justify.

5. **Per-turn state plumbing for the monitor's `direction` slope.**
   The monitor recomputes its sliding-window read fresh each turn
   without the prior turn's `direction` as input. *Recommended*:
   pilot against the replay harness — add a `previous_direction`
   field to the user prompt and compare reads against current
   behavior on the saved transcripts under `scripts/transcripts/`.
   Decide based on whether anchoring against trajectory improves
   the read or just adds tokens for no gain.

6. **R-19 catalogue placement.** Current Rule 21 names the
   turn-shape catalogue inline with an anti-rotation framing.
   *Recommended*: keep the current placement and run a small eval
   (sample turn-shape distribution with catalogue-inline vs.
   catalogue-extracted) before the more invasive restructure. The
   test pins at
   [system-prompt.test.ts:1686–1715](src/lib/persona/system-prompt.test.ts:1686)
   make moving costly; eval is cheap.

---

## C · What this document does NOT cover

The master architecture is the engine. The following live
elsewhere:

- **Voice tuning** (specific rule wording, register experiments,
  weak→strong pairs). See `rules.md`, the persona delta files, and
  the *Voice constraints* appendix below.
- **Copy** (opener text, checkpoint transition phrasing, error
  messages, marketing). See `rules.md` "Marketing Language" and the
  per-mode copy files (`situation-copy.ts`, `guided-intake-copy.ts`,
  `upload-copy.ts`).
- **Positioning** (who the audience is, how the product is described
  externally). See `intent.md` and the `docs/reference/` set.
- **Beta user research** (recruiting, feedback collection,
  segmentation). See `intent.md` "Beta Scope" and `state.md`
  In-Flight Work.
- **Schema and migration mechanics** (DDL, RLS, indexes). See
  `system.md` "Migration Protocols" and the `supabase/migrations/`
  files.
- **Per-channel concerns** (SMS routing, group chat, Sendblue/Linq
  split). See ADR-024, ADR-035, ADR-041.
- **Auth and onboarding flow.** See `system.md` "Onboarding Flow."
- **UI and design system.** See `rules.md` "Design System" and
  `globals.css`.
- **Phase 0 telemetry analysis.** The methodology and results live
  in `docs/reference/two-layer-engine-evaluation.md` (referenced by
  `monitor.ts` and the migration); the architecture document
  describes only what the monitor *is*, not what it *reads* on any
  particular transcript.

---

## Appendix · Voice constraints

> Constraints on the generator's behavior, not pipeline components.
> The generator (§4) reads these every turn; they wrap whatever
> posture the Selector picks. Catalogued here so the spine isn't
> conflated with policy.

Voice constraints are how Jove is instructed to *speak*, not how the
engine decides *what* to do. They render every turn, inside whatever
posture the Generator is performing. None of them is a node in the
flow.

### Tier 1 — constitutional rules

[system-prompt.ts:261–283](src/lib/persona/system-prompt.ts:261).
Seven rules that override everything else. Most load-bearing for
behavior:

- **Rule 4 — every turn ends with a handoff.** A question OR a
  directive that hands the user a clear next move. Enforcement is
  prompt-text plus soft post-gen counter (`validateResponseStructure`
  in [persona-pipeline.ts:796–822](src/lib/persona/persona-pipeline.ts:796)).
  The counter logs question count and dash count; does not block.
- **Rule 6 — crisis protocol.** *"If someone expresses suicidal
  ideation, self-harm intent, or intent to harm others: acknowledge
  without interpretation, share 988 Suicide and Crisis Lifeline (call
  or text 988). Stop exploring, reflecting, and checkpointing."* The
  one override of never-prescribe.
- **Rule 7 — Jove is not a therapist.** The constitutional ceiling
  named in the *What Jove is and isn't* framing section.

### Tier 2 — voice scaffold

[voice-scaffold.ts](src/lib/persona/voice-scaffold.ts).

- **`VOICE_RULES_BASE`** (line 46): **21 rules**. Count is pinned at
  [system-prompt.test.ts:1683](src/lib/persona/system-prompt.test.ts:1683)
  (`expect(VOICE_RULES_BASE.length).toBe(21)`). R-17 and R-18 are
  split into a/b (the v2 re-lock fixed the re-coupling issue). Rule
  12 (sequence is evidence → pattern → image → hand back) becomes
  the `surface` posture's quality contract once the Selector lands
  — see §3 (Selector) and the Surface posture in §4.
- **`VOICE_INTRO_PARAGRAPHS_BASE`** (line 22): two paragraphs
  setting Jove's stance — dry, observational, evidence-anchored.
- **`EXAMPLE_REGISTER_BASE`, `LANDING_EXAMPLES_BASE`,
  `WEAK_STRONG_EXAMPLES_BASE`**: demonstration, not rules.
- **`BANNED_PHRASES`** (line 316): literal phrases that never
  appear. Tests pin each.
- **`BANNED_PATTERNS`** (line 380): categories of speech to avoid.
- **`DASH_TO_PERIOD_RULE`** (line 300), **`LANDING_INTRO`**,
  **`DEEPENING_INTRO/OUTRO`**, **`PACING_RULE`**,
  **`WHEN_JOVE_IS_WRONG`**, **`WHEN_USER_ASKS_WHAT_SHOULD_I_DO`**.

### Tier 2 — persona deltas

[voice-autistic.ts](src/lib/persona/voice-autistic.ts),
[voice-adhd.ts](src/lib/persona/voice-adhd.ts),
[voice-dyslexic.ts](src/lib/persona/voice-dyslexic.ts),
[voice-general.ts](src/lib/persona/voice-general.ts). Each adds
intro paragraphs, voice rules, register examples, landings,
deepening additions, weak→strong pairs **on top of base**. The
compose function `composeTier2` at
[system-prompt.ts:76](src/lib/persona/system-prompt.ts:76) dedupes
and renders.

### `WHEN_USER_ASKS_WHAT_SHOULD_I_DO` — never-prescribe

[voice-scaffold.ts:434–436](src/lib/persona/voice-scaffold.ts:434).
The hard rule: Jove takes positions on what is TRUE, never on what
the user should DO. Has one exception:

### Crisis carve-out

The one exception to never-prescribe. When the user produces crisis
signals, Jove DOES prescribe one thing: 988 + Crisis Text Line. This
is the only directive Jove ever issues. **Visible in code in four
places**:

1. [system-prompt.ts:279–281](src/lib/persona/system-prompt.ts:279)
   — Tier 1 Rule 6 (the protocol).
2. [voice-scaffold.ts:61](src/lib/persona/voice-scaffold.ts:61) —
   `VOICE_RULES_BASE` rule 15 (the carve-out on never-prescribe).
3. [voice-scaffold.ts:434–436](src/lib/persona/voice-scaffold.ts:434)
   — `WHEN_USER_ASKS_WHAT_SHOULD_I_DO` (the carve-out in the
   "what should I do" handler).
4. [persona-pipeline.ts:452–491](src/lib/persona/persona-pipeline.ts:452)
   — `handleCrisisDetection` (server-side regex on the user message;
   appends 988 resources if Jove's response didn't include them;
   logs a `safety_events` row).

### Known voice-rule notes

- **R-18 issue (re-coupling) is FIXED.** Split into R-18a (refuse
  phantom) and R-18b (strength-in-mechanism) per the v2 re-lock —
  test pins at
  [system-prompt.test.ts:1779](src/lib/persona/system-prompt.test.ts:1779)
  confirm the split. The "Separate point:" tell is gone.
- **R-19 issue (catalogue inside a rule) is PARTIALLY MITIGATED.**
  Current Rule 21 ("Variance comes from responsiveness, not
  rotation") still names the catalogue inline: "single reflection,
  competing reads, the reframe, flat mirror, shared puzzlement,
  body redirect" + handoff forms "(choice, body-locating, sideways,
  specific-moment)." The rule's closing clause is explicit: "Reach
  for range by responding to the user, not by rotating through the
  catalogue." Open Question 6 in section B holds the placement
  question pending a small eval.

### Status

`solid`. The voice constraints render every turn, the banned
phrases and patterns are tested via assertion pins, and the crisis
carve-out is verified in four code locations. The constraints
themselves are not where the architectural gaps live.

---

## D · Edit history

The audit trail of changes to this document. Append, don't rewrite —
future readers should be able to see what each edit moved vs. what it
left alone.

- **2026-05-27 — first edit pass.** Seven fixes applied:
  - Added an *Architecture described, not yet built* block to the
    executive summary, listing every element the document describes
    that does not yet fire (Fix 1).
  - Added a new top-level section *Architectural commitments
    (pre-decision)* documenting the five commitments that shape the
    architecture alongside the seven decisions; promoted the "repair"
    naming from open question to documented commitment; replaced the
    long §9 discussion with a one-liner pointer (Fix 2).
  - Added a *Blockers on Lock 1* subsection in section A — three
    architectural questions (selector location, Surface threshold,
    cross-context requirement) promoted from open questions to
    decisions-pending-confirmation, each with a question, a
    recommendation, and the downstream consequences of taking the
    recommendation vs. an alternative (Fix 3, Fix 5).
  - Added a *Beta exposure* paragraph in §1b naming the scope-exit
    gap as architectural exposure that persists until safety spine
    integration (Fix 4).
  - Audited section B: removed four questions resolved elsewhere
    (selector location, Surface threshold, cross-context, "repair"
    rename); reframed the remaining six as recommendations awaiting
    confirmation rather than open decisions (Fix 6).
  - Added this *Edit history* section (Fix 7).

- **2026-05-27 — sharpening pass (Jeff push-back).** Two follow-up
  edits in response to specific push-back on the first pass:
  - Reframed section B Open Question 1 (decay). The original
    recommendation said "ship a `recognized_threads` field alongside
    Lock 1," which hand-waved a meaningful unit of work
    (`ExtractionState` shape change, extraction prompt update,
    consumer that doesn't exist until the selector lands). Revised
    to ship decay **with the selector (build-order step 4), not with
    Lock 1**, with the full scope named in the recommendation rather
    than implied.
  - Added a new bullet in §6's open questions naming **R-12 as
    load-bearing for Surface quality** under the proposed selector
    architecture. The Surface-threshold recommendation in section A
    decouples the *trigger* from extraction's mechanical checks; this
    means the *quality* of the naming move now relies on voice rule
    R-12. R-12 becomes the Surface row's quality contract, not just
    one rule among 21. Flagged here so future R-12 edits get
    evaluated against the selector, not against voice alone. Also
    updated §6's first open question to point to the resolution in
    section A's *Blockers on Lock 1* rather than restate it.

- **2026-05-27 — second edit pass (structural).** Document
  reorganized around the actual six engine components. The previous
  nine-element spine conflated two different kinds of structure —
  components that move data (watchers, selector, generator,
  composer, database) and constraints on the generator's prompt
  (ceiling text, voice rules, banned phrases). Giving them parity
  inflated the constraints and flattened the components. Four
  structural changes:
  - **Ceiling moved out of the spine.** §1a (the refer-out
    boundary) became a new top-of-document framing section,
    *What Jove is and isn't*, between the executive summary and
    the architectural commitments. §1b (the scope-exit gate) is a
    real planned code path, so it moved into its own
    *Scope-exit gate* section adjacent to the Selector — both
    pieces of the planned safety architecture, both depending on
    monitor read-back that doesn't exist yet.
  - **Floor moved to an appendix.** The 21 voice rules, banned
    phrases, banned patterns, crisis carve-out,
    `WHEN_USER_ASKS_WHAT_SHOULD_I_DO`, and the handoff law all
    moved to the new *Voice constraints* appendix between section
    C and this edit history. They wrap the Generator's output
    every turn; they are not pipeline nodes.
  - **Spine restructured around six components.** §1 Monitor (was
    §2 SAFETY OVERLAY), §2 Extraction (extracted from old §8 WATCH),
    §3 Selector (planned; absorbed the structural content from old
    §4 REFLECT-as-default), §4 Generator (new section — the
    conversation Sonnet call, with the five forward moves plus the
    two alliance postures listed as sub-sections inside it because
    postures are generator behaviors, not components), §5 Composer
    (the composer chain from old §7 SAVE), §6 Manual (new section
    making the artifact and cross-session deferred work explicit).
    Status pills, seven-part structure per component, and file
    paths preserved. Posture sub-sections use a lighter format
    inside §4 Generator.
  - **Selector rows rewritten in plain English alongside schema
    names.** Each of the eight rows in §3 carries both the technical
    condition (`scope = "out_of_scope"?`) and the human-readable
    question (*"Is the user pulling toward what should I do tonight
    rather than how do I operate?"*). Engineers get the schema;
    advisors and clinicians reading the document get the meaning.
  - The seven decisions, the pre-decision commitments, the open
    questions, and the blockers on Lock 1 are unchanged in content —
    only their cross-references update to point at the new section
    locations.

- **2026-05-27 — third edit pass (Phase 0 closeout reflected).**
  Monitor status moved `unproven` → `validated`, stated precisely per
  axis: `direction` load-bearing (no lag; caught the documented
  slope-down failure on real data, Run 6 T4–T8), `rupture` validated
  with a one-turn recovery lag (confrontation distinguished from
  withdrawal via `task_agreed: false` + `bond_holding: true`), `scope`
  observed-but-not-validated for the decision-seeking pull. The
  Scope-exit-gate beta-exposure note narrowed: detection is proven,
  the remaining gap is consumption (no selector reads the monitor),
  and the scope-exit exposure persists both because no consumer exists
  and because scope-drift detection is unvalidated. The rupture-lag
  calibration finding carried to §3 Selector open questions with the
  selector-side fix as the leaning answer (decision at selector
  design). Scope-drift validation flagged as a gate condition for the
  `scope_exit` row. Added `validated` to the status-pill legend (both
  the executive summary and the *How to read* list). Consistency
  follow-ons beyond the three enumerated changes: the §4 Generator
  `withdrawal_yield` and `confrontation_hold` posture notes updated
  (both rupture types are now validated, not just confrontation), and
  the Monitor's first open question reworded (Phase 0 is closed, so it
  no longer frames the slope test as pending — the long-arc-beyond-the-
  window case remains the genuine open part). New artifact:
  phase-0-closeout.md. The seven decisions, pre-decision commitments,
  Lock 1 blockers, and sections A–C are otherwise unchanged.

- **2026-05-27 — fourth edit pass (Lock 1 blockers decided).** The
  three "Blockers on Lock 1" in section A are resolved and captured as
  **ADR-043** in `docs/decisions.md` ("The Three Lock 1 Blockers —
  Pre-Prompt Selector, Surface Threshold, Drop Cross-Context Gate"):
  (1) pre-prompt selector reading the previous turn's monitor output;
  (2) Surface fires on `concrete_examples >= 1 && has_charged_language`
  + alliance clear, `pattern_engaged` Save-side only; (3) drop the hard
  `distinct_contexts >= 2` gate, keep it as a strengthening signal.
  Section A's "Blockers on Lock 1" retitled RESOLVED and pointed at the
  ADR; the *Recommendation* in each of the three blocks is now the
  ratified decision. Through-line recorded in the ADR: all three move
  the safety basis from frequency/quantity checks toward
  fidelity/alliance checks. No other master.md content changed — the
  three blocks' reasoning detail is preserved as the decision record.

- **2026-05-27 — Lock 1 shipped (input gate, fail-closed null path).**
  The charged-material gate now reads the real `language_bank`
  deterministically (≥1 high/medium phrase linked to `strongest_layer`)
  inside `validateMaterialQuality`, replacing the `has_charged_language`
  boolean; the null/empty-state path was flipped fail-closed. ADR-043
  amended with an implementation note distinguishing the input-vs-output
  guarantee (Lock 1 guarantees charged material *exists* in the bank,
  not that it is *used* in the saved entry; verbatim-in-saved-entry
  backstop deferred) and recording the `layers[]`-tagging dependency the
  test pair surfaced.

- **2026-05-28 — merged-gate principle extended to the upstream caller.**
  Closed the upstream half of the merged-gate principle —
  `deriveCheckpointApproaching`'s signal-ready short-circuit now requires
  charged material backing the signal-ready layer and no active crisis before
  it returns true; otherwise it falls through to the full ripeness gate. See
  ADR-043's second implementation note.

---

_End of master architecture document. Authored against the code as
of branch `jove-prompt-architecture-3.1`, head of `main` at commit
`51b4e78`._
