# Structure Migration Plan — Pattern-Type Layers → Life-Area Sections + Tags

> **Status:** PLAN ONLY — v2 (post senior-engineer review; verdict: SHIP WITH FIXES). Not executed.
> Correctness fixes folded in: B1 (write-pipeline carrier), S1 (hardcoded prompt literals), S2 (manual-context
> relabel), S4 (test canary), N1/N2 (doc notes), + §10 pre-execution checklist. Execution is a separate gate.
> **Authored:** 2026-06-24. **Scope:** replace the five pattern-type Manual layers with five life-area
> **sections** plus a closed **tag** set, with zero destructive writes to existing data.

---

## 0. The change in one paragraph

Today the Manual is five pattern-type **layers** (id 1–5, meaning lives only in code; the DB stores a bare
integer `manual_entries.layer`). We are switching to five life-area **sections** (Relationships / Work and
money / Routines and structure / Sensory and burnout / Interests and flow) plus a closed **tag** set
(`strength` anywhere; `romantic`/`family`/`friends` only inside Relationships). The old pattern-type concept
disappears as user-facing structure. Only the bare integer `layer` survives — frozen, as internal provenance.

**Keystone decision (C1):** the migration is **additive**. We ADD `section` (slug) and `tags[]` columns and
**never overwrite `layer`**. That single choice makes the whole migration non-destructive, gives free rollback,
and turns the frozen `layer` column into a post-migration **audit oracle**.

**Hard invariant (C5):** *No step performs a destructive write to existing data.* The migration only adds
columns and fills them after human review. Any plan step that mutates existing user data in place is a defect.

---

## 1. The target model

### Sections (one home per entry; ordered for display)
| order | slug | name | scope |
|-------|------|------|-------|
| 1 | `relationships` | Relationships | connection, withdrawal, how the user is read by others |
| 2 | `work-money` | Work and money | operating, masking, holding up where they earn |
| 3 | `routines-structure` | Routines and structure | the systems that hold the day up, and their collapse |
| 4 | `sensory-burnout` | Sensory and burnout | what the body takes in and what it costs |
| 5 | `interests-flow` | Interests and flow | where the user goes deep and does their best work |

### Tags (closed set, system-applied, optional lens — never primary nav)
- `strength` — any section.
- `romantic` / `family` / `friends` — **only** valid when `section = 'relationships'`.

### Invariants the new model enforces
1. Every entry has **exactly one** `section`.
2. `tags` is a **closed set** — not free text, not user-created. (DB CHECK, below.)
3. Tags are optional. The Manual reads cleanly by section with zero tags used.
4. The old pattern-type concept is gone as user-facing structure. The only retained signal is the frozen
   integer `layer`, as internal metadata — never shown, never a section.

---

## 2. Disambiguation rules (literal model instructions)

These become instructions in the composition prompt (new entries) and the re-derivation prompt (existing entries).

### Rule A — Sensory/energy that happens at work (Work and money vs Sensory and burnout)
> Pick the home by what the entry is **about at its core (its spine)**, not where the scene happens. If the
> spine is the body's intake and what it costs — the load, the shutdown, the burnout, the depletion — the home
> is **Sensory and burnout**, even when the scene is work. If the spine is how the person operates, masks, or
> holds up **as work behaviour** — the performance itself — the home is **Work and money**. Location is scene,
> not section.
>
> **Tiebreaker (masking-at-work).** When an entry contains BOTH the masking/performance AND the crash/cost
> (e.g. "I mask my discomfort at work until I crash"), **the body wins: home = Sensory and burnout.** The
> masking is the *mechanism*; the depletion is the *subject*. Work and money is the home only when the
> cost/crash is absent and the entry is purely about the work-performance itself.

### Rule B — Interests and flow vs the strength tag (territory vs property)
> **Interests and flow** is the home for any entry whose subject is the user's deep-focus domains, flow states,
> and best work — **whether or not it is a strength**. The **strength** tag is applied *on top* when the pattern
> is also a capability. There is no strengths *section*; strength is *only ever* a tag. A hyperfocus entry:
> home = Interests and flow, tag = `strength`.
>
> **Worked crossover (N1) — a strength whose subject is a relationship.** "I read what people aren't saying"
> is a former-L1 strength, but its *subject* is connection, so its home is **Relationships** with tag
> `strength` — not Interests and flow. The subject's territory always sets the home; `strength` is the lens on
> top. This is the case the 21-row review is most likely to fumble: route by subject, tag by capability.

Note: because tags are a closed set with no "work" or "sensory" member, overlap (a) **cannot** be papered over
with a tag — it must resolve to a single home via Rule A. That is by design.

---

## 3. Data migration — the 21 existing entries

Beta data (verified 2026-06-24, read-only count): **21 entries, 12 users.** Distribution: L1=5, L2=4, L3=7,
L4=2, L5=3. The small absolute size is what makes **review-everything** the cheap option.

### 3.1 Old layer → new section: routing method per layer
The mapping is **not 1:1**. Method per old layer:

| old layer (n) | deterministic? | method | default seed | tag |
|---|---|---|---|---|
| 1 My Strengths (5) | ❌ scattered | per-entry re-derivation + review | — (subject-derived) | **`strength` mandatory** unless human override (C3) |
| 2 Some of My Patterns (4) | ❌ scattered | per-entry re-derivation + review (apply Rule A) | — | none unless subject warrants |
| 3 How I Process Things (7) | 🟡 mostly | re-derivation flags exceptions; review | `sensory-burnout` | none |
| 4 What Helps (2) | ❌ split | per-entry re-derivation + review | — (Routines vs Sensory by subject) | none |
| 5 How I Show Up with People (3) | 🟡 mostly | re-derivation; review | `relationships` | `romantic`/`family`/`friends` only if entry names which |

### 3.2 The propose → review → apply flow (C2) — nothing auto-written
1. **Propose (read-only).** One Opus pass over all 21 entries. Input: entry `content` + current `layer` + the
   §1 taxonomy + the §2 rules. Output per entry: `proposed_section`, `proposed_tags[]`, `confidence`
   (high/med/low), one-line rationale. **Writes nothing.**
2. **Review.** Emit as a table (Markdown artifact or a read-only admin view). Every row gets human eyes;
   low-confidence rows and all L1/L2/L4 rows flagged for scrutiny. Human edits any cell.
   **Confidence rule:** low-confidence → mandatory human decision; never applied automatically.
3. **Apply.** The approved mapping writes to the **new** `section`/`tags` columns only. `layer` untouched.
   Strength guard (C3): no current-L1 entry is applied without `strength` in `tags` (or an explicit logged
   override).
4. **Audit oracle (C1).** After apply, cross-check `section` against the frozen `layer` for systematic errors:
   every former-L1 should carry `strength`; every former-L5 should be `relationships` unless review said
   otherwise. Surface mismatches for a second look. This is a *validation* pass, not just rollback insurance.

### 3.3 Fallback for entries that can't be cleanly mapped
There is no auto-apply at low confidence. For the 21 known entries, the fallback is **human decides each row**.
For any row still unreviewed at code cutover (only possible for entries created in the backfill→cutover window),
a deterministic render-safety default applies so nothing renders blank — see §4 Step 3's `sectionForEntry()`
safety net. These defaults are provisional and flagged, never authoritative.

---

## 4. Order of operations (additive first, deletions last)

Each step is independently deployable and leaves the system in a working state.

### Step 1 — Schema (additive, non-breaking)
Migration `…_add_section_and_tags.sql`:
- `ALTER TABLE manual_entries ADD COLUMN section text;` (nullable during rollout)
- `ALTER TABLE manual_entries ADD COLUMN tags text[] NOT NULL DEFAULT '{}'::text[];`
- **Closed-set CHECK (mandatory, C10):**
  `CHECK (section IS NULL OR section IN ('relationships','work-money','routines-structure','sensory-burnout','interests-flow'))`
  `CHECK (tags <@ ARRAY['strength','romantic','family','friends']::text[])`
- **Cross-column CHECK (relationship sub-tags require Relationships, C10) — HARDENED:**
  `CHECK (NOT (tags && ARRAY['romantic','family','friends']::text[]) OR COALESCE(section,'') = 'relationships')`
  ⚠️ **Null-section hole (found in CHECK-hardening, missed by v1 AND the senior review).** The naïve form
  `… OR section = 'relationships'` accepts a bad row when a relationship tag is present and `section IS NULL`
  (the rollout window): the predicate evaluates to `FALSE OR NULL = NULL`, and Postgres CHECKs **pass on NULL**.
  `COALESCE(section,'')` (equivalently `section IS NOT DISTINCT FROM 'relationships'`) forces `FALSE` → the row
  is rejected. **Still to be confirmed by the §10 harness** — not yet run against a live Postgres.
- **Leave `layer` and `manual_components_layer_check` untouched** (frozen provenance).
- RLS: existing row-level policies on `manual_entries` cover new columns automatically (no column-scoped
  policies exist). Verify in the migration PR; add nothing.
- Idempotent guards (`IF NOT EXISTS`). No code reads these columns yet → zero behaviour change.
- **Reversible:** drop the two columns + three constraints.

### Step 2 — Backfill (reviewed, data-only)
- Run §3.2 propose → review → apply. Populate `section`/`tags` for all 21 rows. `layer` stays frozen.
- Still no code reads `section` → still zero behaviour change.
- **Reversible:** `UPDATE manual_entries SET section = NULL, tags = '{}'` — `layer` is intact, so this fully
  restores the pre-backfill state.

### Step 3 — Code cutover (one atomic deploy)
The only deploy that changes behaviour. Reads `section` (fully backfilled in Step 2), so nothing renders blank.

**Source of truth + grouping**
- Rewrite `src/lib/manual/layers.ts`: the `LAYERS` array becomes the five **sections** — each item's `slug`
  = section slug, `name`/`description`/`tagline`/`dimensions`/`example` = section content, `id` = display order
  (1–5). Add the **C9 divergence comment** at the top: *"`layer`/`LAYERS` in code == `section` in product. The
  DB `section` slug is the stable key; the integer `manual_entries.layer` is frozen legacy provenance."*
- Add a `sectionForEntry(e)` helper: `e.section ?? DEFAULT_SECTION_BY_LEGACY_LAYER[e.layer]` (render-safety net
  for any null-section straggler; defaults provisional: 1→interests-flow+strength, 2→sensory-burnout,
  3→sensory-burnout, 4→routines-structure, 5→relationships).
- `src/components/mobile/manual/layer-definitions.ts` `buildLayers()`: group by `sectionForEntry(e) === def.slug`
  instead of `e.layer === def.id`. Every downstream UI consumer inherits this.

**Extraction / tracker** (`src/lib/persona/extraction.ts`)
- `LAYER_MODEL_BLOCK` regenerates from the new `LAYERS` automatically.
- **Fix the latent crash (C4):** remove `LAYERS.find(l => l.slug === "what-helps")!.id` /
  `…"where-strong")!.id`. Replace the "mechanism per layer" prose with section-appropriate wording (no
  what-helps/strengths special-casing — strengths is no longer a section).
- The `for i=1..5` signal loop stays valid (still five). Per-conversation `extraction_state` JSONB is **not
  migrated** (ephemeral). **Cutover step (DECIDED — null-out, see §6):** as part of the deploy run
  `UPDATE conversations SET extraction_state = NULL WHERE updated_at > now() - interval '24 hours'` so any
  mid-session conversation rebuilds clean next turn — turns the one mislabeled turn into zero.

**Composition** (`src/lib/persona/confirm-checkpoint.ts`)
- Layer catalog regenerates from new `LAYERS`.
- Replace the hardcoded `LAYER (field: "layer", 1-5)` instruction with: emit **`section`** (slug) **and**
  **`tags[]`**, applying the §2 rules incl. the masking tiebreaker.
- App-level validation (the single write chokepoint, C10): before the RPC call, reject/repair any composition
  output whose `tags` are outside the closed set or whose relationship sub-tags appear without
  `section = relationships`. This is the suspenders to the DB CHECK belt.

**Checkpoint write pipeline — the carrier (B1, REQUIRED; missing in v1)**
- `section`/`tags` must travel from proposal → confirm through the `checkpoint_meta` carrier. v1 specified the
  two ends (composer emits, RPC accepts) but not the pipe between — without this, every new entry persists
  `section = NULL` **permanently** (not a transient window), and `sectionForEntry` silently mis-files it from a
  layer the composer no longer chooses on purpose. Widen the whole chain:
  - composer return type + `composeManualEntry` output (`confirm-checkpoint.ts:~60-77, ~315-323`) → add `section`, `tags`.
  - `CheckpointMeta` interface (`persona-pipeline.ts:~101`) → add `section`, `tags`.
  - `buildCheckpointMeta` (`persona-pipeline.ts:~1025`) → carry them into the meta.
  - the **three** `checkpoint_meta` write sites: `call-persona.ts:~1141`, `compose/route.ts:~155`, `persona-bridge.ts:~247` (text path).
  - `confirmCheckpoint` meta extraction + RPC call (`confirm-checkpoint.ts:~542-600`) → read `meta.section`/`meta.tags`, pass `p_section`/`p_tags`.
- Mechanical once enumerated, but it is the spine of the cutover. Grep `checkpoint_meta` to confirm no writer is missed.

**Prompt rendering into Jove (S2, REQUIRED — manual-context relabel)**
- `manual-context.ts` renders confirmed entries INTO Jove's prompt and reads `entry.layer` directly at `:34`
  (compressed) and `:82` (recent) — an independent read NOT covered by `buildLayers`. Post-cutover
  `LAYER_NAMES[entry.layer]` emits a WRONG section label (frozen `layer` no longer matches the entry's
  `section`). Route both sites through `sectionForEntry(entry)` so they render the real section. **Ruling:** the
  relabel is required correctness; the helper's null branch only fires for a backfill→cutover straggler (never
  at steady state once B1 + backfill are in) — it rides along free, it is not load-bearing defense.

**Hardcoded prompt literals (S1, REQUIRED — hand-edit, NOT auto-derived)**
- `system-prompt.ts` bakes old-layer text that does NOT read from `LAYERS` and would ship stale inside a
  sections-world prompt: a worked example `**Layer 2 — Some of My Patterns: The Rule From the Kitchen**`
  (`:~527`) and "layer(s)" copy at `:~707, ~709, ~734`. (v1 mis-cited `:762`.) The exploration-context strings
  (`:~940-952`) and `LayerIndex`/`EmptyLayer` DO ride on `LAYERS.name`/`.id` and inherit correctly — the gap is
  specifically the hardcoded example + copy. Hand-edit to section language.

**Confirm RPC** (`…_extend_confirm_write.sql`)
- Extend `confirm_checkpoint_write` with `p_section text DEFAULT NULL`, `p_tags text[] DEFAULT '{}'` and insert
  them. **Additive params with defaults** → old callers keep working, which is what makes Step 3 a clean code
  revert (rollback safety). `confirm-checkpoint.ts:590` passes the new values.

**UI / copy**
- `LayerIcon.tsx`: replace the five emblem paths (keyed to old meaning) with section emblems.
- `page.tsx` landing list, `LayerIndex.tsx` strings ("Five sections…", "{n} of 5 started"): new section names,
  user-facing noun → **"section."**
- `dev-populate/route.ts` `LAYER_CONTENT` + `DevToolsPanel.tsx` seeds: new section content.
- Admin `schema-map` / `extraction-map` prose: describe sections + tags; note `layer` is frozen provenance.
- PDF (`generate-manual-pdf.ts`): groups by section automatically; **decision** whether to render `strength` /
  relationship tags as small markers (recommend: yes, minimal).

**Tag filter UI (net-new)**
- A small, dismissible facet on the Manual view (chips: Strengths / Romantic / Family / Friends) that filters in
  place. Default shows everything by section. Optional lens, never primary nav (structural rule). Exact
  affordance is a Step-3 design detail; route through `/mobile-behavior` before finalizing.

- **Reversible:** revert the deploy. UI reads `layer` + old `LAYERS` again; `section`/`tags` columns sit
  dormant; the RPC's defaulted params mean old code calls it fine. No data restore needed.

### Step 4 — Cleanup (LAST; mostly "delete nothing")
Only after Step 3 has soaked and is verified stable:
- **Keep `manual_entries.layer` + `manual_components_layer_check` permanently** as frozen provenance / audit
  oracle / rollback key. Recommendation: **do not drop them.** (Cost: one unused integer column. Benefit:
  permanent forensic + rollback capability.)
- Optional, deferred: add `ALTER COLUMN section SET NOT NULL` once every row is confirmed populated, to harden
  the "exactly one section" invariant.
- The **code** deletions of the old structure (old `LAYERS` content, old prompt strings, old icons, old landing
  copy, the what-helps/strengths slug special-casing) already happened in Step 3 — they *are* the cutover; they
  cannot survive into it. What is deferred to last is the **data** deletion, which we recommend never doing.

---

## 5. Rollback path (per step)
| after | rollback | data restored from |
|-------|----------|--------------------|
| Step 1 | drop the 2 columns + 3 CHECKs | n/a (nothing populated) |
| Step 2 | `UPDATE … SET section=NULL, tags='{}'` | frozen `layer` (never touched) |
| Step 3 | revert the code deploy | frozen `layer` + old `LAYERS`; RPC params defaulted so old code works |
| Step 4 | n/a (we keep `layer`) | — |

No rollback at any step requires a database backup restore, because `layer` is never overwritten.

---

## 6. In-flight `extraction_state` at cutover (verified behavior)
`extraction_state` is cumulative/carried-forward, **not** rebuilt from scratch (verified:
`mergeExtractionState` uses `parsed.layers || state.layers`; `formatExtractionForPersona` labels
`state.layers[i]` with current `LAYER_NAMES[i]`). Effect for a conversation mid-session at the Step 3 deploy:
**exactly one turn** where Jove's brief renders prior layer-id signals under the new section labels (a
mislabeled `strongest_layer` + "where touched" lines). User language is unaffected. Self-heals after the first
post-deploy extraction cycle. Severity low; ≤12 users; no data corruption.

**Decision (DECIDED — null-out):** at cutover run
`UPDATE conversations SET extraction_state = NULL WHERE updated_at > now() - interval '24 hours'` so each
mid-session conversation rebuilds clean next turn. Safe and reversible (gate high-water marks + language bank
rebuild from history within a turn or two). Turns "one mislabeled turn for ≤12 users" into zero for one line.
Wired into Step 3's cutover.

---

## 7. What stays as internal metadata vs deleted
- **Kept (internal, never shown):** `manual_entries.layer` (frozen integer) + `manual_components_layer_check`.
  Repurposed from live structure → provenance/audit/rollback. Satisfies the structural rule that any retained
  pattern-type signal is internal metadata only.
- **Also frozen (N2):** `manual_changelog.layer` + its CHECK carry the same old integer, but the table is dead
  (zero application writes — grep-confirmed). Leave it frozen exactly like `manual_entries.layer`; no migration
  step touches it.
- **Deleted (in Step 3 cutover):** old `LAYERS` content, all prompt strings naming the pattern-type model, old
  `LayerIcon` path meanings, old landing copy, the what-helps/strengths slug special-casing.
- **Net-new:** `section` column, `tags[]` column + 3 CHECKs, composition `tags` output, tag filter UI.

---

## 8. Open questions (unresolved — need your call before execution)
1. ~~In-flight mitigation~~ — **DECIDED: null-out** at cutover (§6, wired into Step 3).
2. ~~Section display order~~ — **DECIDED: Relationships first → Interests and flow last** (the §1 order — lead
   with the room a user most likely has something in, close on the bright one). One-line change anytime.
3. ~~Drop `layer` ever?~~ — **DECIDED: never.** Frozen as provenance / audit / rollback.
4. **PDF tag rendering:** show `strength`/relationship tags as markers? (Rec: yes, minimal — Step-3 detail.)
5. **Landing/marketing copy** for the five new sections is a product/copy pass, not mechanical — out of
   migration scope but blocks the landing-page edit in Step 3.
6. **Docs/memory:** the canonical-noun list (Manual / Layer / Entry / Checkpoint) changes — "Layer" → "Section"
   user-facing, "layer" retained in code. Update `CLAUDE.md`, `docs/`, and the persona/terminology memory on
   your diff review (C9).

---

## 9. File/reference map (by concern)
- **Schema:** `supabase/migrations/` (2 new migrations: add columns+CHECKs; extend RPC). Frozen:
  `20260417000000_squash_baseline.sql` `manual_entries` + `manual_components_layer_check`.
- **Source of truth:** `src/lib/manual/layers.ts`.
- **Extraction/tracker:** `src/lib/persona/extraction.ts` (LAYER_MODEL_BLOCK, the crashing slug resolver,
  mechanism-per-layer prose, i≤5 loop, formatExtractionForPersona labels).
- **Composition:** `src/lib/persona/confirm-checkpoint.ts` (layer catalog, the 1-5 instruction → section+tags,
  app-level tag validation, RPC call at :590).
- **Write-pipeline carrier (B1):** `persona-pipeline.ts` (`CheckpointMeta:~101`, `buildCheckpointMeta:~1025`),
  the three `checkpoint_meta` writers `call-persona.ts:~1141` / `compose/route.ts:~155` /
  `persona-bridge.ts:~247`, and `confirmCheckpoint` (`confirm-checkpoint.ts:~542-600`).
- **Prompt rendering (S2):** `manual-context.ts` reads `entry.layer` at `:34` / `:82` — route through
  `sectionForEntry` (NOT auto).
- **Prompt literals (S1):** `system-prompt.ts` hardcoded old-layer example `:~527` + "layer" copy
  `:~707, ~709, ~734` (v1 mis-cited `:762`) — hand-edit. Exploration strings `:~940-952` inherit from `LAYERS`
  (auto). Plus terminology (C9).
- **Manual UI:** `layer-definitions.ts` (buildLayers grouping), `MobileManual.tsx`, `LayerIndex.tsx`,
  `LayerIcon.tsx`, `EmptyLayer.tsx`, `LayerHeader.tsx`, `CheckpointOverlay.tsx`, `MobileSession.tsx`,
  `AdminManualView.tsx`, + new tag-filter component.
- **Export:** `src/lib/utils/generate-manual-pdf.ts`.
- **Analytics:** `src/lib/observability/log.ts` (`layer?` field — currently unpopulated; if wired, emit
  `section`+`tags`).
- **Seed/admin:** `dev-populate/route.ts`, `DevToolsPanel.tsx`, admin `schema-map`/`extraction-map` pages.
- **Marketing:** `src/app/page.tsx` landing list.
- **Tests (incl. S4):** `db-contract.e2e.test.ts` inserts `manual_entries` with `layer` only (`:112, :130`) and
  a `checkpoint_meta` canary (`:83`) — these pass at Step 1 (section nullable) but must gain a `section` value
  BEFORE any optional Step 4 `SET NOT NULL`, and `section`/`tags` once the `CheckpointMeta` change lands.
  Persona snapshot tests regenerate; `design-tokens.test.ts` if new section colors land.

---

## 10. Pre-execution checklist (human-escalation points — do these at/before execution)
1. **Run the CHECK constraints against your real Supabase before Step 1 — DO NOT skip; not yet executed.** Paste
   `docs/reference/structure-migration-checks.sql` into the Supabase SQL editor (session-local TEMP tables, zero
   real data). It tests BOTH the naive and the hardened constraint in one run and self-asserts:
   it `RAISE`s unless the naive form fails **exactly** the hole-case (proving the harness discriminates) AND the
   hardened form is clean. The Supabase editor hides `RAISE NOTICE` (it goes to Postgres logs), so the editor's
   own signal is the verdict: a plain **"Success. No rows returned" = gate closed**; a red **ERROR** = gate fail,
   with the reason in the message. Run it where the constraint will live (real Supabase), not a brew-local proxy
   — version/config can differ. This is the one assertion in the whole task where reasoning and execution diverged every time
   (the hole itself was found in reasoning and missed by the senior review), so it must run green, not read green.
2. **Human eyes on all 21 rows at Step 2** — the propose pass is read-only; never auto-apply, even at high
   confidence. Whether an entry's "spine" is burnout vs work is product judgment on real user material.
3. **Drop the new RPC signature explicitly in the migration.** Postgres overloads by signature; the existing
   RPC migration drops specific signatures before `CREATE OR REPLACE` (`remove_so_what.sql:10-11`). The new
   migration must do the same for the new arity or risk an ambiguous-function error.
