# Two-Layer Engine — Collision Report, Feasibility, and Phased Plan

> **Status**: Proposal under review. Not a settled decision.
> **Scope**: Evaluates the design to replace the single-overloaded Jove call with monitor + tracker + selector + stripped generator. The full design lives in the originating mission brief; this document reports where it collides with the actual codebase and what to do about it.
> **Companion file**: `docs/reference/two-layer-engine-adr-draft.md` — drafted ADR for `decisions.md` once a direction is approved.

---

## How to read this document

The four parts of the deliverable are merged here because the collisions, feasibility verdicts, and ordering all condition each other:

- **§ 1 — Collision Report**: every place the design is wrong, naive, or costlier than it looked. Ranked by severity (top is most load-bearing).
- **§ 2 — Feasibility verdict per component**.
- **§ 3 — Phased plan** that ships the smallest valuable slice first.
- **§ 4 — Open questions for Jeff**.

I treated the design adversarially. Wherever the mission brief said "X is straightforward" I checked the actual code path. Wherever it said "Y is a known bug," I went to confirm. **In one notable case, the bug is no longer present** — see C-1 below.

---

## § 1. Collision Report

### C-1. The "post-200 AbortError" premise is stale — the timing problem is fixed (HIGH severity, REORDERS THE PLAN)

**What the mission assumed.** "In-flight Anthropic calls fire AFTER the webhook returns 200, producing AbortError and shape errors near anthropic.ts:44 ... given that timing, CAN a deterministic gate reliably suppress extraction, or does the post-200 firing make suppression unreliable? This is the most important feasibility question in the mission."

**What the code actually does.** `fireBackgroundExtraction` ([persona-pipeline.ts:321](src/lib/persona/persona-pipeline.ts:321)) wraps the extraction promise in `waitUntil` from `@vercel/functions` ([persona-pipeline.ts:355](src/lib/persona/persona-pipeline.ts:355)). The shipped fix is documented inline ([persona-pipeline.ts:302-309](src/lib/persona/persona-pipeline.ts:302)):

> Wrapped in `waitUntil` from @vercel/functions so the Vercel platform keeps the function alive until extraction settles. Without waitUntil, when the parent request's response closes before extraction finishes, Vercel terminates the in-flight fetch to Anthropic and it throws DOMException [AbortError].

The state log entry from 2026-04-21 ([state.md:146](docs/state.md:146)) names this work explicitly: a three-commit hardening pass that added the `waitUntil` wrap, a state-wipe fix on failure, and structured observability under `extraction_attempt` / `extraction_failed`. Post-merge, the `AbortError` class should be near-zero in production logs.

**Implication.** The mission's biggest stated feasibility risk — "can a deterministic gate reliably suppress extraction under unreliable post-200 timing" — **is not a risk anymore**. The gate is reliable. This reorders the plan:

- The monitor-first / scope-exit-first ordering is still right, but for a different reason — it's the safety fix, not the timing workaround.
- The mission's framing ("the most important feasibility question in the mission") was load-bearing on this concern. With it gone, **the most important real risk** becomes the one in C-2: the design's term "extraction hard off" is overloaded and points at the wrong thing.

**Action.** Before proceeding, run a one-line check in production observability: filter the last 7 days of `[persona-pipeline] extraction_failed` for `error_class: "abort"` and confirm the count is in single digits. If it's still high, the fix didn't fully land and the mission's premise is back in force. If it's near zero, the timing risk is closed and we move on.

---

### C-2. "EXTRACTION HARD OFF for the session" names the wrong thing (HIGH severity, conceptual clarity blocker)

**What the design says.** Selector row 1: `out-of-scope? → scope-exit. EXTRACTION HARD OFF for the session.`

**What the code shows about what "extraction" means.** The extraction call (`runExtraction` in [extraction.ts:362](src/lib/persona/extraction.ts:362)) is a Sonnet analysis pass that updates `conversations.extraction_state` — a JSONB blob holding `layers`, `language_bank`, `depth`, `checkpoint_gate`, `sage_brief`, `next_prompt`, etc. It feeds the *next* turn's research brief.

Extraction **does not** write to `manual_entries`. Manual entries come from a separate code path:

1. Jove emits the transition line "I want to put something in your Manual" (the model is the gatekeeper here).
2. `detectCheckpointInResponse` ([detect-checkpoint.ts:46](src/lib/persona/detect-checkpoint.ts:46)) regex-matches the line.
3. `applyCheckpointGates` ([persona-pipeline.ts:571](src/lib/persona/persona-pipeline.ts:571)) gates on material quality + turn count.
4. `composeManualEntry` ([confirm-checkpoint.ts:39](src/lib/persona/confirm-checkpoint.ts:39)) runs Opus to compose the polished entry.
5. User taps confirm in the UI → `confirmCheckpoint` writes the row.

**Implication.** What the design *means* by "EXTRACTION HARD OFF" is **"the save path hard off"**. Three things to suppress:

| Behaviour | Where it lives | Gateable today? |
|---|---|---|
| Background analysis (sage_brief, language bank) | `fireBackgroundExtraction` (persona-pipeline.ts:321) | Yes — single `if (sessionScopeStatus === "exited") return;` |
| Transition line emitted by Jove | model behavior, prompt only | Soft — relies on the prompt |
| Save flow (compose → entry write) | `applyCheckpointGates` (persona-pipeline.ts:571) | **Yes — already the deterministic gate**; add a new suppression reason |

**The win**: the deterministic gate the design wants for safety **already exists**. `applyCheckpointGates` is the single chokepoint every save flows through; adding a `scope_exit: boolean` to the input gives you a hard off. The stripping (`stripCheckpointFromText`, [call-persona.ts:252](src/lib/persona/call-persona.ts:252)) already rewrites the user-visible message when the gate fires, so the user never sees a stranded "I want to put something in your Manual" line.

**The remaining risk**: stopping the model from *trying* to checkpoint is a prompt concern, not a code concern. A model holding the existing 21-rule voice with a strong checkpoint-approaching brief will still produce the transition line under pressure, and we'll be relying on the code-side gate to suppress + rewrite. That's already today's safety net. It works. Scope-exit just adds one more reason it fires.

**Action.** Rename the design's "EXTRACTION HARD OFF" to **"SAVE OFF + ANALYSIS OFF"** with the two pieces explicit. Don't merge them — the analysis is cheap and might still be valuable as observability ("we entered scope-exit at turn 14 with X material on the table"); the save is the safety lock.

---

### C-3. The forced-handoff law lives in prompt text and tests, not in code — soft to change (MEDIUM severity, but real test churn)

**What the mission claimed.** "Tier 1 currently says 'every turn ends with a handoff, the handoff cannot be absent.' Find this rule in code. Does it actually block a give-room / repair turn that intentionally hands NO next move?"

**What the code shows.**

The Tier 1 rule text ([system-prompt.ts:273-274](src/lib/persona/system-prompt.ts:273)):

> 4. EVERY TURN ENDS WITH A HANDOFF.
> Every Jove turn ends with a handoff — a question OR a directive that hands the user a clear next move. **The handoff cannot be absent.** Generating the next move is Jove's job, not the user's. A strong statement can sit second to last; it cannot be the closing beat...

Two reinforcing entries in `BANNED_PATTERNS` ([voice-scaffold.ts:396-397](src/lib/persona/voice-scaffold.ts:396)):

> "Unresolved forward statement as the closing beat. A strong statement can sit second to last. It cannot close the turn. The handoff comes after. See Tier 1 #4."
>
> "Strength named, then no handoff. Strength-naming tempts a closed feel-good ending. It still has to hand off. See Tier 1 #4."

**What enforces it at the code layer.** `validateResponseStructure` ([persona-pipeline.ts:708](src/lib/persona/persona-pipeline.ts:708)) is the only code-side validator that runs on every conversational turn. Two checks:

```
if (questionMarks > 1) console.warn(...)
if (dashCount > 0) console.warn(...)
```

**It does not check handoff presence. It does not block delivery on anything — both checks are `console.warn` only.** The "no handoff" case passes silently. The validator's docblock ([persona-pipeline.ts:696-700](src/lib/persona/persona-pipeline.ts:696)) explicitly states: *"0 question marks is allowed when the handoff is an imperative ('walk me through what happened'); the post-confirmation continuation-offer also has 0."*

**Implication.** Softening "the handoff cannot be absent" to a default has **zero engine code to touch**. The work is:

| Surface | Change | Cost |
|---|---|---|
| Tier 1 #4 text | Edit prose | trivial |
| `BANNED_PATTERNS` entries 14 + 15 | Edit or remove | trivial |
| `system-prompt.test.ts:98+` pinning the literal phrase | Update assertions | ~30 lines |
| `system-prompt.test.ts:1817+` Tier 1 #4 test block | Update assertions | ~50 lines |
| `docs/rules.md` Voice Principles section | Mirror the prompt | one section |
| `.claude/docs/quality-framework.md` "Handoff absent" check ([state.md:44](docs/state.md:44)) | Reframe from violation to context-conditional | one check |
| `validateResponseStructure` | **No change needed** — it already permits 0 question marks |

**Caveat.** Once the law softens, the model will sometimes hand the user no next move when one would have been better. The mission accepts this — under withdrawal / repair / out-of-scope the design *wants* room. But the audit framework currently treats "Handoff absent" as a flaggable miss. If we don't update it, the audit will start flagging legitimate give-room turns. Coordinate the prompt change with the audit framework update in the same change.

**No new postures would be REJECTED by validateResponseStructure**, since it never rejects anything. It only logs question-count and dash-usage warnings.

---

### C-4. VOICE_RULES_BASE has a hard 21-count pin; rewriting rules is fine, removing them is not (MEDIUM severity, contained)

**What the mission asked.** "Find the actual base rules array. Confirm the real count. The design kills three timer-based forced moves... does anything — regression tests, the audit framework, validate checks — reference these by index or count such that removing them breaks pins?"

**What the code shows.**

[system-prompt.test.ts:1652](src/lib/persona/system-prompt.test.ts:1652):

```ts
it("VOICE_RULES_BASE has exactly 21 entries (14 pre-existing + 7 new)", () => {
  expect(VOICE_RULES_BASE.length).toBe(21);
});
```

[system-prompt.test.ts:1184](src/lib/persona/system-prompt.test.ts:1184):

```ts
const firstAutisticRuleNumber = VOICE_RULES_BASE.length + 1;
// ... persona rules numbered offset by base length
```

There's also a literal text pin at [system-prompt.test.ts:1181](src/lib/persona/system-prompt.test.ts:1181):

```ts
expect(result).toContain(`1. ${VOICE_RULES_BASE[0]}`);
```

This pins rule 0 by **content**, not by index — changing rule 0's text breaks the pin, but reordering or extending doesn't.

**The three timer-based moves' actual locations:**

1. **"After three turns of pure landing + open question, the next turn must commit a read."** Embedded **inside** R-2 in `VOICE_RULES_BASE` ([voice-scaffold.ts:48](src/lib/persona/voice-scaffold.ts:48)) — not its own array entry. Editing R-2's text to remove this clause is **content-level**, leaves the count at 21.

2. **"If the user has given three consecutive responses without describing a specific scene..."** In `DEEPENING_OUTRO` ([voice-scaffold.ts:419](src/lib/persona/voice-scaffold.ts:419)). Not part of the rules array. Editing the constant is decoupled from count.

3. **"Do not let more than 8 exchanges pass..."** In `PACING_RULE` ([voice-scaffold.ts:423](src/lib/persona/voice-scaffold.ts:423)). Same — constant, not array, not counted.

**Implication.** **None of the three timers are array slots.** All three are prose inside larger blocks that the design wants to KEEP. Removing the timer language is a surgical edit-in-place — the rule count never moves, the count pin never trips.

**What does trip.** Snapshot tests in `system-prompt.tier3.test.ts.snap` will regenerate (legitimate). Some phrase-pin tests under the "BANNED_PATTERNS" and the voice-rule "headlines" suites that text-match the relevant snippets will fail and need updating. Quick `rg` survey says ~10-15 assertion updates.

**There is a non-trivial cost the mission didn't flag**: the audit framework ([.claude/docs/quality-framework.md](.claude/docs/quality-framework.md), referenced from [state.md:44](docs/state.md:44)) **codifies the same timer behaviors** as audit checks. The state-log entry for the v2 voice ship explicitly added an A1 check pattern that includes timer-style audit items. If we kill the prompt-side timers without updating the audit framework, `/evaluate` will flag every conversation that "drifts" by not committing a read by turn 4 — false positives forever. Coordinate the kill with a framework update.

---

### C-5. The composer doesn't fail-closed on missing pieces; Lock 1 can't rely on it (MEDIUM severity, design assumption is wrong)

**What the design assumes.** Lock 1: pattern real = concrete scene + user's own words carry it + resonated. The mission asked: "Does the composer currently have a 'flag the missing component, do not fabricate it' discipline, or will it invent a what-helps when one is missing?"

**What the code shows.** `composeManualEntry` ([confirm-checkpoint.ts:39](src/lib/persona/confirm-checkpoint.ts:39)) returns null in exactly two cases:

1. The model's output omits `parsed.content` or it's not a string ([confirm-checkpoint.ts:216-218](src/lib/persona/confirm-checkpoint.ts:216)).
2. The model picks an invalid layer (out of 1-5) ([confirm-checkpoint.ts:231-240](src/lib/persona/confirm-checkpoint.ts:231)).

Everything else is **soft post-validation**:

- `validateComposedEntry` ([persona-pipeline.ts:638](src/lib/persona/persona-pipeline.ts:638)) checks word count, somatic anchor, clinical leaks, time references — **logs warnings, never rejects**.
- `findUniversalToneViolations` ([confirm-checkpoint.ts:361](src/lib/persona/confirm-checkpoint.ts:361)) checks for "always/every/all/never" — **logs warnings, never rejects**.
- `validateHeadline` + `composeHeadline` retry-once on bad headlines, but accept the better-of-two ([confirm-checkpoint.ts:296-326](src/lib/persona/confirm-checkpoint.ts:296)) — **never rejects**.

The composer prompt itself forbids fabrication ("Stay within the scope of evidence the user gave you... AVOID UNIVERSAL TONE THROUGHOUT") but the prompt is the model's discipline, not the system's gate. The composer was caught last month producing universal-tone entries when the user had never said "always" ([state.md:44](docs/state.md:44) — universal-tone validator was added BECAUSE the prompt regularly fails).

**Implication for Lock 1.**

- "Concrete scene exists" is already enforced upstream — `concrete_examples >= 2` (or `>= 1` for first checkpoint) in `applyCheckpointGates` ([persona-pipeline.ts:478](src/lib/persona/persona-pipeline.ts:478)). This is reliable.
- "User's own words carry it" is **not** enforced. The composer is told to use them, validates softly for somatic anchor only. A determined model can ship without any quoted user phrase and only get a `console.warn`.
- "Resonated" is partially proxied by `pattern_engaged` ([extraction.ts:62](src/lib/persona/extraction.ts:62)) and gated in `validateMaterialQuality` ([persona-pipeline.ts:434](src/lib/persona/persona-pipeline.ts:434)). But `pattern_engaged` is the *extraction* model's read of whether the user engaged with Jove's naming move — it's a Sonnet judgment, not a deterministic signal.

**What this means for the design.** Lock 1's *"user's own words carry it"* needs either:

1. A pre-composer gate that verifies at least one high-charge language-bank entry exists AND is referenced in the conversational text (cheap, deterministic), or
2. A post-composer gate that asserts the entry contains a verbatim phrase from the language bank (cheap, deterministic, BLOCKS not warns).

Either is a small addition to `applyCheckpointGates` or `validateComposedEntry` — but the new design implies the second, since the first is just material-quality re-stated.

**For Lock 2** ("user EXTENDS the pattern — adds to it, gives their own example, sharpens it"): this is **net-new** signal that doesn't exist in any current code path. Today's flow is:

```
Jove proposes checkpoint → trigger card renders → user taps confirm | refine | reject
```

There is no "Jove names pattern → user extends → THEN Jove proposes checkpoint" two-step. The current "naming move" guidance lives only in the prompt ([system-prompt.ts:535-554](src/lib/persona/system-prompt.ts:535)). To enforce Lock 2 as a code-side condition you need either:

- A new pre-checkpoint conversation state ("pattern surfaced, awaiting user extension") tracked across turns, OR
- A signal classifier (monitor or tracker) that detects "user extended" vs. "user accepted softly" before allowing the save.

The latter fits the design naturally. The former is the bigger UX change.

---

### C-6. The current architecture (ADR-001, ADR-020) deliberately chose parallel over sequential — the monitor design reopens that choice (MEDIUM severity, latency math)

**What the existing ADRs say.**

- ADR-001 ([decisions.md:9](docs/decisions.md:9)): "Run extraction and Jove simultaneously... The alternative — running extraction first — would double the time-to-first-token and make the product feel sluggish."
- ADR-002 ([decisions.md:16](docs/decisions.md:16)): "Jove always sees extraction state from the previous turn, not the current one... Accept the lag. Do not add sequential dependency."

**What the design proposes.** Monitor runs **synchronously, blocking, before the generator**. Tracker runs parallel + lagged. The monitor pre-call adds time before any text reaches the user.

**Concrete latency math.**

- `/api/chat` ([chat/route.ts:1](src/app/api/chat/route.ts:1)) is `runtime = "edge"`. No `maxDuration` override and no `vercel.json`, so it inherits the platform default — 25s on Pro, 60s with config, etc. Vercel free tier is 10s and is already known not to fit Jove ([system.md:275](docs/system.md:275): "Vercel free tier kills functions at 10 seconds. Jove takes 5-8 seconds. Vercel Pro required for any real usage.").
- Current Jove latency end-to-end: 5-8s, single Sonnet call ([config.ts:36-37](src/lib/persona/config.ts:36): `PERSONA_MODEL=claude-sonnet-4-6`, `PERSONA_MAX_TOKENS=2048`).
- Haiku 4.5 ([config.ts:40](src/lib/persona/config.ts:40)) on a small prompt and small output: ~600-1200ms typical.

**Realistic added latency for the blocking monitor:**

- Best case (Haiku, tight prompt, ~200 output tokens): +1s, time-to-first-token grows from ~1s to ~2s.
- Worst case (Haiku, full context window, 500 output tokens): +3s, TTFT grows to ~4s, total turn ~10-11s.

**This is the real risk the mission underweighted.** ADR-001 picked parallel because the cost of an extra sequential step was deemed UX-decisive. The new design proposes adding one back. That trade can be made — safety and alliance-reading are arguably worth the 1-3s — but the trade is real and re-litigates a settled decision. The ADR draft needs to confront ADR-001 directly.

**Streaming UX consequence.** Today the user sees Jove start typing ~1s after sending. With a blocking monitor, the typing indicator extends to ~2-4s before any text streams. That's the *feel* difference, and it's where users will notice. The current code path ([call-persona.ts:550-580](src/lib/persona/call-persona.ts:550)) flushes `text_delta` events as soon as the Anthropic stream produces them. Monitor blocks the start of that stream.

**Mitigation worth considering.** Surface the monitor as a parallel "preflight" that finishes before the generator emits its first token in *most* cases, but doesn't fully block: if the monitor returns within a 1500ms budget, use its read; if it times out, fall back to the previous turn's monitor state (mirror the one-turn lag from ADR-002 specifically for this case). This preserves alliance-reading on the common path and adds zero latency on the slow-monitor path. The cost is that one slow monitor call lets one risky turn through. The collision in C-5 covers the safety-gate that catches it on the save side, so this isn't catastrophic.

---

### C-7. Per-turn state plumbing exists; alliance read can ride on it without new tables (LOW severity, good news)

**What the mission asked.** "Does ANY per-turn state currently get computed in code and passed between calls, or is every turn assembled fresh from flags + history? Is there a place this state could live (Supabase row, in-request, conversation record)?"

**What the code shows.**

- `conversations.extraction_state` is JSONB ([extraction.ts:43-67](src/lib/persona/extraction.ts:43)). The state shape includes `observation_miss_count` (carry-forward int), `pattern_engaged` (carry-forward bool), `user_named_cost` / `user_named_stance` (carry-forward bools), monotonic counters (`concrete_examples`, `distinct_contexts` — taken as max() of incoming-vs-prior at [extraction.ts:469-489](src/lib/persona/extraction.ts:469)).
- Each turn loads `previousExtraction` ([persona-pipeline.ts:195](src/lib/persona/persona-pipeline.ts:195)) and threads it into the prompt build.
- The monotonic-counter pattern is already in place — adding a sliding-window "direction" computation is the same shape.

**Implication.** A new alliance read (e.g., `{ bond: bool, task: bool, scope: string, rupture: "none"|"withdrawal"|"confrontation", direction: "steadying"|"drifting"|"sinking" }`) can be a new field on the same JSONB column, written by the monitor pre-call, read by the selector and the generator. No migration required. No new table.

**Optional refinement worth flagging.** If we want clean separation, a new column `conversations.monitor_state` JSONB is cheap to add — it would make telemetry queries easier and prevent the monitor from racing with the extraction writer for the same JSON document. Not required at start; consider in phase 2.

---

### C-8. The selector ordering in the design partly duplicates `applyCheckpointGates` — name the relationship, don't compete (LOW severity, integration risk)

**What the design says.** The deterministic selector runs rows 1-8 top to bottom, stops at first match. Row 5+ are the checkpoint paths.

**What `applyCheckpointGates` does today.** Same idea, narrower. ([persona-pipeline.ts:571-606](src/lib/persona/persona-pipeline.ts:571)):

1. `validateMaterialQuality` — pattern engagement + material quality (crisis-active, pattern_engaged-or-turn-12-override, depth gate, concrete_examples, distinct_contexts, charged language, mechanism, behavior-driver link).
2. Turn-count suppression — `turnsSinceCheckpoint < 5`.

**Implication.** The new selector should **extend** this function rather than replace it. The clean integration:

- Add scope-exit and rupture-type fields to the function's input.
- Add new rows at the top (out-of-scope, withdrawal-rupture, confrontation-rupture, needs-contract) above the existing material-quality + turn-count gates.
- Rename the function to `selectAndGateCheckpoint` or similar to reflect that it's now doing both selection and gating.

If we build a parallel selector instead, we'll have two places that decide whether a checkpoint fires and they'll drift.

---

### C-9. Prompt cache boundary is on staticContext — posture-driven prompts will pay the cache miss (LOW severity, ongoing cost)

**What the code shows.** [call-persona.ts:467-475](src/lib/persona/call-persona.ts:467) sets `cache_control: { type: "ephemeral" }` on `promptBlocks.staticContext`, meaning Anthropic caches the prefix up through Tier 2 voice + compressed older Manual entries. Tier 3 mechanics + per-turn context stays uncached.

**Implication for the new design.** Today, Tier 2 (voice) is stable across turns within a session — cache hits. Tomorrow's "stripped generator" rebuilds per turn from a per-turn "posture" content blob handed by the selector. If different postures use different content (give-room drops imagery, repair drops handoff, etc.), the cache prefix changes per turn and we pay cache-creation tokens on every turn instead of cache-reads.

**Mitigation.** Put the *full* posture catalogue inside the cached prefix and have the dynamic tail reference by ID:

```
[cached prefix] = tier1 + posture catalogue (all 8 postures) + compressed manual entries
[dynamic tail]  = posture selection ("This turn is: explore"), brief, conversation history
```

This preserves the cache hit even as postures rotate. Adds tokens to the cached prefix (paid once, amortized across turns). Worth pricing before any phase-3 implementation — pretty sure it's still a net win, but the math should be done with real prompt sizes.

---

### C-10. validateResponseStructure is observability, not enforcement — no posture will be rejected (LOW severity, eliminates a concern)

**What the mission asked.** "Which of the new postures (give-room, repair, contract, explore-as-just-listening) would it currently REJECT as malformed?"

**What the code shows.** [persona-pipeline.ts:708-734](src/lib/persona/persona-pipeline.ts:708). Two checks, both `console.warn`. The function returns `void`. It logs and continues. The caller ([call-persona.ts:664](src/lib/persona/call-persona.ts:664), [persona-bridge.ts:143](src/lib/linq/persona-bridge.ts:143)) never inspects its result. No posture will be rejected.

**Note for clean-up.** Once the new design lands, the `dash_usage > 0` check will continue to fire on every em-dash. If the new postures permissively allow more punctuation flexibility, prune this check at the same time. Not blocking.

---

## § 2. Feasibility verdict per component

For each component: **in-prompt** (text-only change), **needs-harness** (code change in pipeline / route handlers), or **out-of-reach** (requires UX, DB schema, or product-level redesign beyond this work).

| Component | Verdict | Code evidence |
|---|---|---|
| **Monitor** (Haiku, alliance read, blocking) | **needs-harness** — new pre-call before `anthropicStream`. Add to `persona-pipeline.ts` so web + SMS share. Persist read on `extraction_state` JSONB (C-7). Falls back to prior-turn read if it times out (C-6). | — |
| **Tracker** (Sonnet, single-pattern read, parallel + lagged) | **needs-harness — but it already exists in spirit**. `runExtraction` ([extraction.ts:362](src/lib/persona/extraction.ts:362)) is the tracker today, with extra concerns (language bank, layer signals, sage_brief) bolted on. Step one: slim it. Step two: add explicit "single ripe pattern" output field. Same `waitUntil` plumbing. | — |
| **Selector** (deterministic code) | **needs-harness** — extend `applyCheckpointGates` ([persona-pipeline.ts:571](src/lib/persona/persona-pipeline.ts:571)) per C-8. Don't write a parallel selector. | — |
| **Give-room modifier** | **in-prompt** — a flag that swaps in trimmed prompt text for the generator turn. No engine change. | — |
| **Two-rupture repair split** (withdrawal / confrontation) | **needs-harness** + in-prompt. Monitor produces `rupture_type`. Selector reads it. Generator gets a posture-specific brief. New prompt fragments. | — |
| **Lock 1** (pattern real) | **needs-harness** — extend material-quality gate (C-5) to require a verbatim language-bank phrase appears in the conversational text. Cheap, deterministic. | — |
| **Lock 2** (yes real / user extended) | **needs-harness — and partially out-of-reach**. Requires a new conversation state ("pattern named, awaiting user extension"). Tracker can detect "user extended"; selector can gate on it. But the current trigger-card flow ([call-persona.ts:897-947](src/lib/persona/call-persona.ts:897)) assumes one terminal save event. Need to decide whether Lock 2 sits between "Jove named pattern" and "Jove proposes save," or whether it folds into the existing card's confirm step with stricter signal classification. **Open question for Jeff** (Q-1). | — |
| **Scope-exit / save off** | **needs-harness** — single new suppression reason in `applyCheckpointGates`. The save-side stripping already exists (`stripCheckpointFromText`, [call-persona.ts:252](src/lib/persona/call-persona.ts:252)). | — |
| **Stripped generator** | **in-prompt — but consequential**. Editing the system-prompt assembly to remove the always-on 21 rules in favor of posture-specific content is feasible without engine changes. The cost is the rule-count test pin (C-4) plus widespread test churn. Test cost: medium. Engine cost: zero. | — |
| **Cross-session thread memory** | **out-of-reach** — deliberately deferred. Do not scope. | — |
| **Multi-thread parallel tracking** | **out-of-reach** — deliberately deferred. Do not scope. | — |
| **Decision-mode that reads the Manual** | **out-of-reach** — deliberately deferred. Do not scope. | — |

---

## § 3. Phased plan

Smallest first slice that proves the spine. Earliest phase must be **safety-positive even if everything after it stalls**.

### Phase 0 — Shadow monitor (1 PR, no behavior change)

Spawn the monitor call but **don't gate anything on it**. Log its outputs alongside the existing `extraction_attempt` log. Run it on every web turn for a week.

**Why first.** The mission's whole spine depends on the monitor being a reliable classifier of bond / task / scope / rupture / direction. If the monitor is noisy, the whole design rests on quicksand. Shadow mode validates this without risk.

**Exit criteria.** Eyeball 20-30 conversations against monitor output. If monitor's "direction: sinking" classification corresponds to actual withdrawal in the transcript, monitor is real. If it's just guessing, the design needs rework before we proceed.

**Cost.** ~2-3 days. Tiny model + Haiku output. Negligible ongoing token cost.

---

### Phase 1 — Save-off scope-exit gate (1 PR, safety-positive)

The monitor gates **one** behavior: when scope-exit fires, `applyCheckpointGates` rejects with `reason: "scope_exit"`. `stripCheckpointFromText` already handles the user-visible rewrite. Voice prompt unchanged. Generator unchanged.

**Why this slice.** It's the safety fix from the mission's example (the depressive-state-as-pattern bug) and it's true regardless of whether we ever finish the voice work. It also exercises the monitor → selector wire, which is the new architectural seam.

**Tests.** New unit tests for `applyCheckpointGates` with scope-exit input. End-to-end test in the dev-simulator covering a transcript that should trigger scope-exit.

**Cost.** ~3-5 days assuming monitor is reliable from phase 0.

---

### Phase 2 — Direction gate (give-room under sinking)

Monitor's `direction: sinking` triggers the give-room modifier on the generator prompt. Give-room is implemented as: append a "the user is withdrawing — drop imagery, drop forced moves, sit with what they said" block in `dynamic` context, plus zero out the `checkpointApproaching` flag for the turn so checkpoint instructions don't load.

**Why this order.** Direction is the catch for gradual withdrawal — the second failure the mission names. Save-off (phase 1) covers the wrong-save symptom; give-room covers the wrong-reading-of-flatness-as-cooperation symptom.

**Tests.** Generator prompt-shape tests. Audit framework update so "no handoff" isn't auto-flagged under direction=sinking.

**Cost.** ~3-5 days.

---

### Phase 3 — Kill the three timer-based forced moves

Edit-in-place: R-2 (commit-a-read), DEEPENING_OUTRO (scene invitation timer), PACING_RULE (8-exchange pacing). Update audit framework. Regenerate snapshot tests. Update phrase-pin tests.

**Why this slice and this position.** The mission diagnosed the formula as caused by over-specification, and these are the most over-specified moves. But killing them first risks regressing the audit eval before the new design protects against the new failure modes (formula bleeds into directionless wandering). Putting it after phases 1-2 means the safety floor is already in place when the voice loosens.

**Tests.** Update `system-prompt.tier3.test.ts.snap` snapshots. Update audit framework checks. The 21-count pin in `system-prompt.test.ts:1652` does NOT trip (we're editing within R-2, not removing it).

**Cost.** ~2-3 days. Mostly test churn.

---

### Phase 4 — Tracker slim-down + Lock 1

Slim `runExtraction`'s output to: `single_ripe_pattern: { phrase, layer, context } | null`. Keep the language bank (Lock 1 reads it). Drop everything else the new design doesn't use.

Add Lock 1 to `applyCheckpointGates`: require at least one verbatim language-bank phrase appears in the conversational text being saved.

**Why this slice.** Lock 1 closes the C-5 gap. Tracker slim-down reduces the tracker prompt's surface area and makes its single job (pattern ripening) the only thing it does.

**Tests.** Lock-1 unit tests with mocked language-bank entries. Tracker behavior tests against simulated transcripts.

**Cost.** ~5-7 days. Tracker prompt rewrite is the heaviest item.

---

### Phase 5 — Lock 2 (user extension signal)

Add a new conversation state: `pattern_surfaced_awaiting_extension`. Tracker outputs whether the user's most recent turn extended the surfaced pattern. Selector gates the save proposal on extension having happened.

**Why last.** Lock 2 requires a UX decision (Q-1) and the most state plumbing. By this point the other locks are in place and the new architecture has shaken out.

**Cost.** ~7-10 days, including UX iteration.

---

### Phase 6 — Postures and the stripped generator

Move the 21 always-on voice rules into a posture catalogue. The generator picks a posture (default: explore) and renders only that posture's content + the brief. Cache-control sits on the full posture catalogue so all postures share one cached prefix (C-9).

**Why last.** Highest blast radius and most prompt rewriting. The earlier phases prove the architecture without rebuilding the prompt; phase 6 collects the win.

**Cost.** ~2-3 weeks. Significant test rewriting. The voice eval needs a new baseline.

---

## § 4. Open questions for Jeff

Numbered for easy reference. Each one names what the code forced into the open.

### Q-1. Lock 2's UX surface

The current CheckpointCard offers confirm / refine / reject as terminal actions on Jove's proposed entry. Lock 2 needs "user extends the pattern after Jove names it, *before* Jove proposes the save."

**Choose one:**

- **(a)** Lock 2 lives entirely *before* the checkpoint trigger. Jove names the pattern conversationally, the tracker detects "user extended," only then is the save flow eligible. The CheckpointCard flow is unchanged. (My recommendation — it's the smallest UX delta, the largest design fidelity.)
- **(b)** Lock 2 folds into the trigger card flow. The card itself renders a "tell me more before saving" path that the user picks. (Bigger UX change, more user-visible.)
- **(c)** Both — Lock 2 is an upstream gate AND a card-side path.

### Q-2. Monitor's user-facing surface area

When monitor reads `direction: sinking`, should anything happen besides changing the generator's prompt?

**Choose one:**

- **(a)** Pure internal. Monitor only modifies generator behavior. (My recommendation — first cut. Anything else is a feature, not a foundation.)
- **(b)** Quiet system-level check-in, separate from Jove ("we noticed you've gone flat — want to take a break?"). A new UI element.
- **(c)** Telemetry only — surface to admin dashboards so we can study direction calls.

### Q-3. Scope-exit semantics

"Out of scope" can mean (a) a domain Jove can't engage in (regulatory, clinical, or beyond self-understanding), or (b) the conversation has drifted into applied advice for a live decision the user is actively making.

Today's code has crisis detection (handled), professional referral (prompt-only), and the "what should I do" never-prescribe rule (prompt-only). None of these are explicit scope-exit states.

**Decide:** Is scope-exit a single state with one entry condition, or a family of states (clinical-exit, applied-advice-exit, beyond-self-understanding-exit) with distinct downstream behaviors?

**Recommendation:** Single state to start, downstream behavior is uniform: save-off, give-room on, no further checkpoint proposals this session. Refine into a family later if real conversations want different responses to different exit reasons.

### Q-4. Posture × persona interaction

Postures (explore, deepen, repair, give-room, scope-exit, contract, surface, formalize) sit on top of personas (autistic, ADHD, dyslexic, general, stacked combinations).

**Decide:** Does a posture stack ON the active persona's prompt (one posture catalogue, persona deltas still apply), or does each persona define its own postures (autistic-repair vs. ADHD-repair are different prompts)?

**Recommendation:** Stack. One posture catalogue. Persona deltas apply on top. This preserves the existing base + delta architecture and avoids a 4× explosion in posture content. Can revisit if real personas need radically different repair postures.

### Q-5. SMS path priority

The persona-bridge.ts SMS path runs the same pipeline as web (non-streaming). Monitor pre-call adds latency to both. The mission notes SMS is "deferred for beta enrollment" — confirm the operational interpretation:

**Choose one:**

- **(a)** Build for web only at first. SMS keeps the single-call engine until phase 6 lands. (My recommendation.)
- **(b)** Build for both at once. SMS is non-streaming so the TTFT cost is less visible.
- **(c)** Monitor disabled on SMS via a runtime flag.

### Q-6. Latency budget commitment

What is the streaming TTFT goal post-monitor? Today ~1s; Phase 1 of the design lands it at ~2-4s.

**Decide:** Is 3s TTFT acceptable, or do we hard-cap the monitor at e.g. 1500ms with fallback to prior-turn read (C-6)?

**Recommendation:** Hard-cap at 1500ms with prior-turn fallback. The fallback IS the lag pattern ADR-002 already chose for the tracker — extending it to the monitor in the slow-call case is consistent.

### Q-7. Audit framework ownership

Phase 3 kills three prose-level audit checks. Phase 1 adds a "scope-exit" attribution check. The audit framework is `.claude/docs/quality-framework.md` — owned by the /evaluate skill but the framework's text drives every voice audit.

**Decide:** Update framework in lockstep with each phase, or batch the framework rewrite at the end?

**Recommendation:** Lockstep. A skipped framework update produces false positives that train you to ignore the audit, which is worse than no audit.

---

## What I did not change

This document is the only file I wrote. No engine code touched. No prompts edited. No tests modified.

If you green-light any phase, the next pass implements that phase's PR. The collision report and feasibility section above stay accurate against today's code — verify each citation by file/line before relying on it after future churn.
