# Behavioral-Instruction Audit — Passive Jove

> **Date:** 2026-07-22 · **Scope commit:** `d6ce7c09` (main) · **Branch:** `claude/mywalnut-instruction-audit-4cbda1` (read-only session; no files modified, no paid API calls, no production user data accessed)
> **Companion:** `active-jove-v1-reconciliation-2026-07-22.md` (reconciles this audit with the ACTIVE_JOVE_V1 experiment built the same day on the sibling branch `claude/mywalnut-module-authoring-85554f`).
> **Gate:** none of the cleanup recommended here begins before the conditions in `active-jove-cleanup-handoff.md`.

One scoping correction up front: the audit brief asked for a **Situation-mode** trace. Situation mode is **shelved** (ADR-053, 2026-07-15) — every conversation now starts inside a founder-authored module, and the prod `modules` table was verified empty as of 2026-07-21 (state.md). The trace below covers the live module path (legacy `mode="situation"` rows run the identical path with no opener and no brief). Several other systems the brief named do not exist in the current runtime: the monitor/alliance system (removed, ADR-045), readiness gates (replaced by Jove's own marker), guided intake and the Upload door (dead, ADR-053), pairwise judges and simulation-persona regression suites (none at the scope commit; see companion reconciliation — a harness was built the same day on a sibling branch).

---

## 1. EXECUTIVE VERDICT

**The most important single finding:** the passivity is not buried — it is the *centerpiece* of the live conductor prompt, and it is locked in place by a matching evaluation loop. `src/lib/persona/conductor-prompt.ts:219-234` ("Second rule: hand over the connection": *"When two things the person has said link into an insight, do NOT state the link… Stating it produces a 'yes,' and the insight stays yours, not theirs"*, extended at line 230 to *"Any time you are about to deliver a conclusion the person hasn't drawn, stop"*) pairs with a **code-locked** scorer stance at `src/lib/scoring/score-conversation.ts:73` (*"any reading that rewards Jove for steering, concluding for the user, or hunting for an entry is a misreading"* — hard-coded in `buildScoringInstructions()`, **outside** the admin-editable rubric) and with the rubric's #1 confirmed recurring failure slug, `stating-not-handing` (`docs/reference/conductor-scoring.md:158`, `score-conversation.ts:79`). The prompt bans stating conclusions; the scorer's biggest standing finding punishes stating conclusions; each tuning cycle therefore ratchets toward more hand-over. Individual prompt edits toward active Jove will be re-read as regressions by this loop and reverted — exactly the reintroduction dynamic the audit brief feared.

A second, equally important framing point: **this is not the legal user-as-author rule.** The legal floor explicitly *permits* active naming — `docs/rules.md:78` says Jove CAN say *"You have a pattern where, when you feel evaluated, something tightens and you move to take control…"* — a stated conclusion, delivered. The hand-over rule is a founder efficacy bet added in v0.9 (2026-07-09, per the version history at conductor-prompt.ts:139-149) layered *on top of* the legal floor. User ownership of **truth-acceptance and saved content** has expanded into user ownership of **in-conversation reasoning**. The experimental posture ("Jove owns the investigation") does not conflict with the legal doctrine; it conflicts with v0.9.

**Ranked causes of passive Jove:**

1. **Runtime prompt** (Critical). The conductor's Second Rule + "You are not adding information. You are arranging what they already gave you" (line 189) + the deliberate near-miss rule ("Aim to be right about the shape and a little off on the word", line 264) + "hand them the hypothetical to author, never author it for them. Their version is the useful one; **yours kills it**" (line 281) + "don't state the shape… let them say the whole thing" (line 246).
2. **Evaluation pressure** (Critical). The scorer's code-locked stance, rubric D1/D2/E4 (a Jove-induced "huh" is *disqualified* as recognition evidence), the `/evaluate` skill restating the same rule, and `simulate-user.ts:215` instructing sim users *not to light up* when Jove names a pattern they didn't reach.
3. **Product doctrine** (High). intent.md is split-brain: the hypothesis text is passive ("not by telling you what to think… Jove isn't telling you something new", lines 18-22) while the engine spec is active ("It surfaces patterns proactively. It names what it sees — including things the user hasn't named", line 122). The passive half won the prompt; the active half is now dead-letter doctrine.
4. **Tracker/checkpoint/composer incentives** (Moderate). Mostly cleaned by the pull model. Residual: the composer's entry bar duplicates the passivity into the written record ("never add a connection they didn't close themselves"), and the meter's depth ladder + `validateResponseStructure`'s one-question check apply mild formula pressure.
5. **Prompt assembly and precedence** (Low). One document, clean assembly; the only precedence risk is the DB override (blind spot §12 — resolved in the companion reconciliation: the delta is the founder-rewritten `## Writing the reflection` section).
6. **Pipeline architecture** (Low). The pull model itself is posture-neutral and is a protected boundary.
7. **Model capability** (Not a cause). Opus 4.7 on every turn; the repo's own diagnosis (`docs/voice-rebuild-proposal.md:13-16`) attributes blandness to instruction volume, not model tier.
8. **Unknown external configuration** (Uncertain at audit time). The live `conductor_prompt` DB override (18.8k chars serving vs 18,533-char code constant). Resolved post-audit: see companion reconciliation §7.

---

## 2. SOURCE-OF-TRUTH MAP

**Claimed hierarchy** (CLAUDE.md + doc banners): rules.md = "Constitutional" > intent.md = "Strategic" > decisions.md = "Case law" > system.md = "Technical reference" > state.md = "Volatile"; code wins over docs ("if any doc or memory describes tiers… the code wins").

**Actual authority, by domain:**

| Authority type | Actual source | Notes |
|---|---|---|
| **Runtime authority (voice)** | DB row `persona_voice_overrides.conductor_prompt` (when enabled) → `CONDUCTOR_PROMPT` code constant | The DB override **outranks code** at runtime (`system-prompt.ts:234`). Guarded only for 4 fragments (crisis ×2, marker, `## Writing the reflection`). |
| **Runtime authority (entry writing)** | `composer_entry_bar` override → `COMPOSER_ENTRY_BAR` (composer mode); conductor's `## Writing the reflection` (conductor mode) | Knowing duplication, A/B scaffolding — change one, change both (`confirm-checkpoint.ts:26-31`). |
| **Runtime authority (module steering)** | `modules.brief` DB rows | Composes with, never replaces, the voice (ADR-054). Empty set at audit time. |
| **Evaluation authority** | `buildScoringInstructions()` (code, locked) > `scoring_rubric` DB override > `docs/reference/conductor-scoring.md` (repo floor) + `/evaluate` skill + `simulate-user.ts` personas | The rubric doc self-labels "DRAFT v0.3 … Not yet approved" yet is wired as the live scoring floor (`rubric.ts:16`) — approved in practice, unapproved on paper. |
| **Product doctrine** | intent.md + rules.md (contradictory on this axis), decisions.md ADRs 052-054 | Plus two *proposal* docs with no banner authority but high influence history: voice-rebuild-proposal.md, docs/architecture/master.md (self-flagged partly paused). |
| **Operational authority** | CLAUDE.md + .claude/skills + .claude/agents | The `/evaluate` skill and applied-psychologist agent shape every future tuning session. |

Key precedence fact: **the loudest passive instructions sit in the highest-precedence runtime slot** (front of the cached prefix, the Three Rules section), and the evaluation authority independently encodes the same stance in code the rubric editor can't reach.

---

## 3. PRODUCTION EXECUTION TRACE (one module-conversation turn, web)

1. Client POSTs `/api/chat` (`src/app/api/chat/route.ts:26`): auth → ownership check → 16k length cap → anon gate → rate limits → daily cap → `callPersona()`.
2. `call-persona.ts:313`: retry-storm dedup → insert user message → `loadConversationContext()` (`persona-pipeline.ts:111`) — one parallel batch: history, `manual_entries`, `extraction_state` + `mode` + `conductor_prompt_sha`, last **confirmed** checkpoint, `persona_modes` (read but **inert** — no consumer), `feature_gates`, `persona_voice_overrides`.
3. `getModule(mode)` — module row (opener/brief). Turn 1 of an opener-bearing module short-circuits: server emits the opener verbatim, **no model call**.
4. `fireBackgroundExtraction()` — parallel Sonnet call (`claude-sonnet-4-6`), fire-and-forget; output feeds only the meter and the save-time composer, **never Jove's reply**.
5. `detectTranscript()` on the message; if a paste, the last user turn is wrapped in `<pasted_content>` tags with the treat-as-data preamble.
6. `buildSystemPromptBlocks()` → three system blocks (reconstructed in §12); module brief appended to block 1 after the SHA stamp; `cache_control: ephemeral` on block 2.
7. `anthropicStream({ model: "claude-opus-4-7", max_tokens: 8192, system, messages })` — raw fetch, no tools, no output schema; history mapped (system rows → synthetic user turns like "I saved that to my Manual."), sliding window first 2 + last 48.
8. Post-stream: tail-anchored strip of `---reflection-ready---` (persisted as `metadata.reflection_landed`); `stripDefunctMarkers` floor; one-time first-entry education append (server-fixed sentence); crisis phrase detector may append 988 resources; `validateResponseStructure()` **logs** (never blocks) >1 question mark and any em-dash.
9. `message_complete` carries `reflectionMeter { fill, ready }` — fill from extraction depth (surface 0 / behavior 15 / feeling 40 / mechanism 75), `ready` **only** from Jove's marker; crisis → `null` (meter hidden).
10. Capture (user-initiated only): tap → `/api/checkpoint/compose` → `getComposerMode()` (admin toggle → `COMPOSER_MODE` env → `"composer"`) → `composeManualEntry` (Opus, 50-msg window, language bank, `anchorApprovedVersion: true`) or `composeEntryAsConductor` (full context) or compare-both → pending row → editable overlay → `/api/checkpoint/confirm` (plain RPC write; user edits win verbatim) → post-confirm LLM turn (its `postConfirmMode` option is dead plumbing; the conductor's "After a save" section governs — F-22).

Dev/preview/prod differences: none in prompt content; `extraction_brief` gate can zero out extraction (debug); the DB override and env vars are the only environment-controlled behavior. Retry path: compose failures return retryable 502, meter stays full; chat errors emit an SSE `error` (no fallback prompt exists except `buildPostConfirmFallback`, F-22).

---

## 4. COMPLETE INSTRUCTION INVENTORY (classified)

Classifications: **1** direct runtime · **2** indirect runtime · **3** evaluation pressure · **4** product doctrine · **5** user expectation · **6** historical/stale · **7** protected boundary · **8** uncertain. A source can carry several.

| Source | Class | Status |
|---|---|---|
| `CONDUCTOR_PROMPT` (conductor-prompt.ts:183-325) | 1, 7 (crisis clause) | Active — the voice |
| `conductor_prompt` DB override | 1, 8 | Active; content resolved post-audit (reconciliation §7) |
| `modules.brief` / opener rows | 1 | Active mechanism, empty set |
| `COMPOSER_ENTRY_BAR` + `## Writing the reflection` (duplicated) | 1 | Active, knowing duplication |
| `buildEntryMachineContract()` (clinical ban, first-person, schema) | 1, 7 | Active, code-locked |
| `EXTRACTION_SYSTEM` (extraction.ts:105-203) | 1 (feeds composer/meter), 6 | Active call, **partly stale content** (F-14, F-15) |
| `LAYERS` (layers.ts) | 2, 6 | "Frozen" yet injected into a live prompt every turn |
| Group prompt (`buildGroupPrompt`) | 1 | Active (Linq groups); own passivity rules |
| Reflection meter + depth ladder | 2 | Active |
| `validateResponseStructure` (1-question + dash checks) | 2, 3, 6 | Active logger citing deleted Tier rules |
| Headline validator + universal-tone validator + `distinct_contexts` softener | 2 | Active |
| `CHECKPOINT_ACTIONS` flat naturalReplies | 1, 2 | Active, deliberate anti-fabricated-recognition |
| `buildScoringInstructions()` (score-conversation.ts:62-101) | 3 | Active, **code-locked** |
| conductor-scoring.md (rubric floor + Appendix C ledger) | 3, 4 | Active despite "DRAFT / not approved" banner |
| `/evaluate` skill | 3 | Active |
| applied-psychologist agent def | 3, 4 | Active (alliance/recognition frame) |
| `simulate-user.ts` personas + sim stop-at-first-ready loop | 3 | Active dev harness |
| conductor-prompt.test.ts banned-string assertions | 3 | Active; bans cross-domain generalization language |
| intent.md (both halves) | 4, 6 (beta scope) | Active doctrine, internally contradictory, partly stale |
| rules.md (Does/Does-Not, the CAN/CANNOT example, crisis) | 4, 7 | Active |
| decisions.md ADR-052/053/054 | 4 | Active case law |
| Landing page copy (page.tsx) | 5, 6 (five-section list) | Active |
| Consent/seed copy, overlay copy, first-entry education | 5, 7 | Active |
| Admin how-it-works / extraction-map / schema-map explainers | 4 | Active founder doctrine |
| master.md, two-layer-engine-*, voice-rebuild-proposal.md, phase-0-closeout | 6 (4-hauntable) | Paused/draft; high haunt risk |
| SYSTEM_MAP.md, DRIFT_LOG, scripts/voice-ab.ts headers, transcripts/example.txt, `__fixtures__/rebuilt-mechanics.snapshot.json` | 6 | Stale |
| system.md (chips marker, cooldownTurns, guided-intake SSE flags) | 6 | Partly stale in an otherwise-active doc |
| ND voice deltas + situation-copy.ts | 6 (settled keeps) | Dormant, protected by founder decision |
| postConfirmMode plumbing + `buildEntriesSummary` + `POST_CONFIRM_FIRST_ENTRY_SCAFFOLD` path | 6 | Dead-but-wired (F-22) |

---

## 5. PASSIVITY FINDINGS (ranked by behavioral impact)

### Critical

**F-1 — The hand-over rule (the Second Rule).** conductor-prompt.ts:219-234. *"do NOT state the link and ask them to confirm it… This holds through the whole back half, the cost and the condition… Any time you are about to deliver a conclusion the person hasn't drawn, stop."* Class 1. Active; enters at block 1 of every 1:1 turn, near the top, as one of "The three rules [that] govern every turn." Purpose: recognition-authenticity (a stated insight produces a hollow "yes"). Pressure: a total ban on Jove stating any conclusion, cost, or link — the precise definition of "the user must perform all the reasoning." Problem type: **scope** (one legitimate insight-landing technique promoted to an every-turn law covering "the whole back half") and **repetition** (restated in F-2, F-3, F-4). Confidence: high. Evidence: direct quote; the mechanism reaches the API call verbatim (subject to the DB override — resolved in reconciliation §7: the override carries this section unchanged).

**F-2 — "You are not adding information."** conductor-prompt.ts:189. *"You are not adding information. You are arranging what they already gave you until the link is theirs to make."* Class 1. The goal paragraph — first 200 words of the prompt. This is intent.md's passive hypothesis ("Jove isn't telling you something new", intent.md:22) compiled into a runtime identity statement. It directly forbids the experimental posture's "contribute synthesis before the user articulates everything." Problem: the rule itself (it denies the outside-vantage value proposition that intent.md:10-14 opens with). Confidence: high.

**F-3 — Hand-the-assembly + conclusions-are-handed-over.** conductor-prompt.ts:242-246. *"the pieces that are a conclusion they haven't drawn yet, usually the cost, or the link between two things, you don't state and check. You hand those over… don't state the shape. Line up the confirmed pieces in their words and hand them the assembly."* Class 1. Third statement of F-1 within one prompt (attention triple-spend). Problem: repetition + scope. Confidence: high.

**F-4 — "Yours kills it."** conductor-prompt.ts:281 (stuck list). *"Hand them the hypothetical to author, never author it for them. Their version is the useful one; yours kills it."* Class 1. Bans Jove-authored hypotheticals even as a stall-breaking tool — precisely the "form plausible explanations" capability the experiment wants. Problem: wording ("kills") plus scope. Confidence: high.

**F-5 — Code-locked evaluation stance.** score-conversation.ts:73 (*"…concluding for the user, or hunting for an entry is a misreading"*) and :79 (known slug `stating-not-handing`); restated at conductor-scoring.md:16 and .claude/skills/evaluate/SKILL.md:8-9. Class 3. Active on every admin scoring run and every `/evaluate` session. This is the ratchet: Appendix C's **#1 confirmed recurring failure** is "stating-not-handing" (conductor-scoring.md:158), so the tuning ledger perpetually recommends *more* hand-over. Critically, editing the rubric (doc or DB override) cannot remove the stance — it lives in `buildScoringInstructions()`. Problem: **placement** (evaluation doctrine hard-coded outside the editable rubric) + interaction with F-1. Confidence: high.

**F-6 — Recognition-evidence hierarchy disqualifies Jove-induced insight.** conductor-scoring.md:32 (D1: *"a well-timed recombination by Jove can induce a genuine 'huh' at a connection that is Jove's, not theirs"* — never sufficient) and :71 (E4: gating requires user-initiated correction or unprompted naming). Class 3. A correct, landed, Jove-stated synthesis is *definitionally* scored as failure regardless of user benefit. Problem: the rule itself, as applied to evaluation (it conflates authorship of phrasing with validity of insight). Confidence: high.

### High

**F-7 — Simulated users are built not to reward active Jove.** simulate-user.ts:215: *"If Jove names a pattern you didn't reach yourself, a real person mostly gives a mild 'yeah, i guess' and moves on — they don't light up"*; :146: push back on any *"pattern/conclusion on you that you didn't reach yourself."* Class 3. Every dev-simulate run structurally shows active moves failing. Arguably realistic; but combined with F-5/F-6 it means no tooling surface can ever show active Jove succeeding. Confidence: high (evidence), moderate (impact — sims are dev-only).

**F-8 — The near-miss rule: engineered inaccuracy.** conductor-prompt.ts:264: *"Aim to be right about the shape and a little off on the word, so there's a clear gap for them to close."* Class 1. Jove's one licensed naming move is required to be deliberately imperfect. Defensible as technique; as a *law* it forbids Jove ever stating its best-fit read plainly. Problem: scope. Confidence: high.

**F-9 — Composer: passivity extended into the written record.** confirm-checkpoint.ts:32-39 / conductor-prompt.ts:311-313: *"records a recognition that ALREADY HAPPENED… A line sharper than what they landed is yours, not theirs — cut it back… never add a connection they didn't close themselves."* Class 1 + 7-adjacent. For **saved content** this is the legitimate boundary (keep). The audit point: it also *presupposes* the conversation model — if Jove never states syntheses (F-1), no synthesis can "already have happened" except user-articulated ones, so the record inherits the ceiling. Note the internal contradiction with the same file's depth-brief comment (confirm-checkpoint.ts:255-258: *"so the entry can name what the user couldn't see from inside"* — a pre-v3 intent the entry bar now forbids). Problem: interaction. Confidence: high.

**F-10 — Rubric asymmetry + boundary-turn risk-zone.** conductor-scoring.md:17 (*"ending too early is worse than going too long"*), :23 (*"Everything Jove formulates after [the boundary turn] is the risk zone"*). Class 3. Rewards prolonged elicitation and frames Jove-formulation as inherently risky. Partially counterweighted by E1 landed≠resolved. Confidence: moderate.

**F-11 — Doctrine split-brain in intent.md.** Passive: intent.md:18 (*"not by telling you what to think, but by reflecting what you showed"*), :22 (*"Jove isn't telling you something new"*), :68 (recognition as the first-session emotional core). Active: :117 (*"Proposes pattern articulations"*), :120-128 (*"surfaces patterns proactively. It names what it sees — including things the user hasn't named… The constraint is on framing, not on depth"*). Class 4. Developers pattern-match whichever half they land on; the prompt lineage (v0.9) chose the passive half. Problem: contradiction unresolved at the doctrine layer. Confidence: high.

### Moderate

**F-12 — One-question validator, citing a dead law.** persona-pipeline.ts:561-601: flags ≥2 question marks per turn, comment cites *"Tier 1 rule 4 (handoff rule)"* — a rule deleted with the tier system (verified absent from the live prompt; the "handoff law" the eval docs quote as current at two-layer-engine-evaluation.md:81 no longer exists). Class 2 + 3 + 6. Log-only, but it is the repo's only remaining per-turn *shape* enforcement and it enforces the mirror-plus-one-question formula. Problem: staleness + formula lock. Confidence: high.

**F-13 — Depth ladder as value scale.** persona-pipeline.ts:713-718 (surface 0 → mechanism 75) + extraction.ts:140-146. Class 2. The only progress signal a user sees is "vertical descent"; nothing measures usefulness, decision progress, or synthesis. Encodes deepening-as-the-product. Confidence: moderate.

**F-14 — Extraction prompt claims a consumer that no longer exists.** extraction.ts:105-113: *"This is Jove's research brief. The quality of Jove's conversation depends entirely on the quality of your analysis"*; :164 *"What Jove should push on vs leave alone"*; :167 *"Whether a checkpoint is approaching."* Jove never sees any of this (system.md:109: only the meter and composer read it). Class 6 inside class 1. Wasted per-turn tokens + push-era ghost language. Confidence: high.

**F-15 — Deleted taxonomy still taught to a live model.** extraction.ts:121-122 injects "THE FIVE SECTIONS" from the frozen `LAYERS` and requires `layers: [1,3]` tags on every bank phrase — a taxonomy ADR-053 deleted; the tags are "carried not read." Class 6-in-1. Confidence: high.

**F-16 — Group prompt's own passivity rules.** system-prompt.ts:281-306: *"You help people think, not tell them what to think… Use it to ask BETTER QUESTIONS. Never to make statements or declarations."* Class 1 (group path only, Linq). Same doctrine, independently duplicated; would survive any 1:1 prompt change. Confidence: high (existence), low (impact).

**F-17 — Stay-on-contact as first priority.** conductor-prompt.ts:204-217: the First Rule, *"the single most common way this conversation fails"* framing, and the priority order "feeling first, hand-over second, brevity last." Class 1. Assumes live charge is present and makes affect-holding outrank everything; combined with F-10 it defers conclusions. Counterweights exist in-prompt ("One real feeling, fully met, is enough"; landed≠resolved at :296). Problem: interaction, not the rule itself. Confidence: moderate.

### Low

**F-18 — "Do not introduce emotion words on their behalf"** (extraction.ts:134) — passivity at the analysis layer. **F-19 — flat confirm replies** (config.ts:70-86 — deliberate, keep). **F-20 — banned cross-domain strings in tests** (conductor-prompt.test.ts:126-131 bans *"holds anywhere else"* / *"across more than this one moment"* — an active-Jove rewrite that reintroduces cross-context testing language would fail CI). **F-21 — sim loop stops at first `reflectionReady`** (useChat.ts:1691 — "entry available = session over" bias in dev tooling). **F-22 — dead post-confirm plumbing** (confirm route sets `postConfirmMode` and documents a "continue-or-pivot" offer; `buildSystemPromptBlocks` never reads it; the error-path fallback `buildPostConfirmFallback` still emits an options-offer that contradicts the conductor's "After a save… don't offer options"). **F-23 — "Do NOT run the first-session entry"** (system-prompt.ts:139 — an instruction referencing a first-session sequence that no longer exists in any prompt).

---

## 6. ADJACENT PRODUCT INFLUENCES (beyond passivity)

- **Live-charge assumption**: the entire conversational shape (scene → interior → contact) presumes the user arrives with a charged moment. Module doors + briefs may deliver users with practical, uncharged questions; the prompt has no branch for "exploration is unnecessary, just answer usefully." (conductor-prompt.ts:252-269; no counterpart anywhere.)
- **Recognition as the only scored outcome**: rubric D1-D6 + intent.md:68. "Practical usefulness delivered, nothing saved" is unrepresentable in every measurement surface. intent.md's own #1 value ("Decision-making tool", intent.md:60) has **no runtime or evaluation support** — "no advice" won the implementation while "decision support" won the roadmap.
- **Process observation is vaporware**: intent.md:102-107 promises avoidance signatures, framing consistency *across sessions*, discrepancy tracking. Nothing implements it — extraction is conversation-scoped, older entries are compressed to one line, and the conductor is told to "work only with what the person brings."
- **Therapy-shaped mechanics with therapy language banned**: rupture/repair scoring (rubric E3, ScoreRupture type), the applied-psychologist agent's alliance frame, somatic side-doors, affect-holding-first — a fairly complete therapeutic method, while rules.md:72 prohibits "simulat[ing] a therapeutic relationship." The prohibition currently polices vocabulary, not mechanics.
- **Conservatism stack on written claims**: universal-tone validator + headline "can/sometimes" softener + distinct-contexts hedging + "no always/never unless they used the word" — defensible individually, collectively they bias the Manual toward under-claiming.
- **ND-community language constraints**: extraction's sensory/masking/system-language taxonomy (extraction.ts:127-135) and "audience: late-diagnosed autistic adults" persist while the landing was de-ND'd (2026-07-15) and the brand factory points the shared engine at multiple verticals.
- **User expectation lock-in**: seed consent copy ("You're the authority… Jove isn't here to fix you"), landing Step 2 ("It never diagnoses. It never tells you what to do"), overlay ("Your words, your Manual") — an active-Jove pivot must decide whether these promises change, because the same landing *also* promises active behavior ("catches what you'd never think to mention… connects patterns… surfaces what you do well").

---

## 7. CONFLICT AND DUPLICATION MATRIX

| # | Rule A (source) | Rule B (source) | Both runtime? | Who wins & why | Observable behavior | Resolve via |
|---|---|---|---|---|---|---|
| 1 | "Jove follows the user and deepens" (intent.md:18,221) | "Surfaces patterns proactively; names what it sees" (intent.md:122) | Neither is runtime; both doctrine | A — v0.9 compiled A into the prompt | Jove waits for links to be user-drawn | **Doctrine** first, then prompt |
| 2 | "Do NOT state the link" (conductor:222) | "Offer words for it, tentatively" / near-miss (conductor:234,264) | Both (same doc) | Coexist by carve-out: feelings may be named, conclusions may not | Jove names feelings, withholds syntheses | Prompt wording (make the carve-out's boundary explicit) |
| 3 | "You never tell the person what to do" (conductor:194) | "You can guide, or occasionally suggest, if it furthers the goal" (same line, v0.8.1 founder edit) | Both, same sentence | Contradiction inside one line; the categorical half dominates | Rare, hedged suggestions | Prompt wording |
| 4 | "User is the author" as legal floor (rules.md:44-47: Jove *proposes articulations*) | "User is the author" as scoring law (scorer code :73: concluding = misreading) | B runtime-effective (eval); A doctrine | B — it's executable | Eval punishes what the legal doctrine permits | **Doctrine** (split the rule; §9) + evaluation |
| 5 | Stay with affect first (conductor:205-217) | Earn the length / stop when landed (conductor:237, 294-298) + E1 offer-at-peak | Both | Explicit priority order: feeling wins | Long affect-holding; late offers (the L-run under-fire) | Already prompt-arbitrated; watch only |
| 6 | "No therapy… no simulated therapeutic relationship" (rules.md:12,72) | Rupture/repair + alliance mechanics (rubric E3; applied-psychologist agent) | A doctrine; B evaluation | B shapes tuning unchallenged | Therapy-method behavior with therapy words banned | Doctrine (define the boundary as mechanics-level or vocabulary-level) |
| 7 | "No advice" (rules.md:74; conductor:194) | Decision-making = product value #1 (intent.md:60-64); rules.md:92-97 permits option-exploration | A runtime; B doctrine | A — nothing implements B | Users with live decisions get questions, not decision support | Doctrine + prompt |
| 8 | "Work only with what the person brings" (conductor:193) | Process observation of omissions/avoidance across sessions (intent.md:102-107) | A runtime; B doctrine | A — B was never built | No cross-session discrepancy surfacing | Doctrine cleanup (retire or re-scope B) |
| 9 | "Entry-hunting is a misreading; thin entry worse than lost capture" (scorer/rubric) | Week-1 metrics: "Manual has content after session one" (intent.md:199-203) | Neither runtime; both dev-facing | Rubric (it's operational; beta metrics are stale — no beta users exist) | None today; haunt risk if metrics revive | Documentation cleanup |
| 10 | Entry bar: "never add a connection they didn't close" (confirm-checkpoint.ts:34) | Same file's comment: entry "can name what the user couldn't see from inside" (:255-258) | A runtime; B comment | A | Entries record only user-closed material | Delete the stale comment |
| 11 | Conductor "After a save": one line, "don't offer options" (:325) | Confirm route's continue-or-pivot intent + fallback text (confirm/route.ts:347-356; call-persona.ts:291-311) | A yes; B dead plumbing + error path | A (builder ignores `postConfirmMode`) | Fallback path can emit an options-offer the prompt forbids | Architecture cleanup (delete plumbing) |
| 12 | Landing: "never tells you what to do… reflects your words back" (page.tsx:139-145) | Landing: "catches what you'd never think to mention… connects patterns" (page.tsx:207-249) | Both user-facing | Coexist on one page | Mixed user expectation | Copy pass at rebrand |
| 13 | Entry-writing spec in conductor (`## Writing the reflection`) | Same text in `COMPOSER_ENTRY_BAR` | Both (A/B arms) | By mode toggle | Documented knowing duplication | Kill loser at A/B winner-selection (already planned) |

---

## 8. STALE OR HAUNTING MATERIAL

**Dead-but-cited / superseded-but-copied:**
- docs/architecture/master.md — "ground-truth" header over paused monitor/selector/two-watcher architecture, tiers, five layers, R-12 hand-back, reflect-as-default (Decision 4: *"The engine's default action is REFLECT"* — the passive doctrine's architectural monument, banner-paused but the banner is 15 lines against ~1,400).
- docs/voice-rebuild-proposal.md — **highest-value haunt**: contains the explicit mirror-vs-sparring "→ BOTH" resolution (:499-503) and the active character spec ("names patterns out loud, presses on fuzzy thinking", :37-39) that never shipped; also the rule-pile-averages-to-restraint diagnosis (:13-16). Mine it before any experiment; don't let an agent execute it wholesale.
- two-layer-engine-evaluation.md quotes the "EVERY TURN ENDS WITH A HANDOFF" law as live code at `system-prompt.ts:273-274` — verified false; those lines are now group-prompt content. The law survives only as the `validateResponseStructure` comment (F-12).
- .claude/SYSTEM_MAP.md — still documents the push model (checkpoint cards, Confirm/Reject/Refine, 4-calls-per-turn, deleted `manual_changelog`).
- system.md stale spots: `---chips---` still described in the capture lifecycle (:143) and SSE `chips`/`sections`/`startSituationOffer` "guided-intake UI flags" (:190); `checkpoint_tuning`/`cooldownTurns` as "the one live dial" (:56, :232) — the dial was removed 2026-07-08 and `checkpoint_tuning` has zero code references.
- intent.md Beta Scope (April 2026, "~10 autistic adults", guided-intake/uploads shipping, "five sections", WS6 three-mode polish) — all superseded; no beta users exist.
- Extraction prompt: five-section block, `layers` tags, `sage_brief` name, "checkpoint is approaching", "Jove's research brief" (F-14/F-15) — a **stale prompt still billed per turn**.
- Dead-but-wired code: `postConfirmMode` + `buildPostConfirmFallback` + `POST_CONFIRM_FIRST_ENTRY_SCAFFOLD` chain (F-22); `buildEntriesSummary` (no production consumer; five-layer language); `personaModes` plumbing (read every turn, consumed by nothing — settled keep, but the *read* is inert); "Do NOT run the first-session entry" (F-23).
- Orphaned fixture `src/lib/persona/__fixtures__/rebuilt-mechanics.snapshot.json` — the retired push-model MECHANICS block, referenced by nothing, exemplifying banned behavior.
- Stale pointers: call-persona.test.ts:479 → deleted `system-prompt.tier3.test.ts`; scripts/transcripts/example.txt → deleted `replay-monitor.ts`; voice-ab.ts header naming deleted `pattern_engaged`/`observation_miss_count`; four voice-delta files + config comments referencing deleted `voice-scaffold.ts`/`composeTier2`/"one or two beats" rule.
- User-facing stale: landing's fixed five-section Manual list (page.tsx:174-195) vs the dynamic module world.

**Examples behaving as hidden instructions:** the rubric's Appendix A anchors (K-J11 "How do those sit together?", the F-J5 "That's not ambivalence — that's a no" negative) are the de-facto few-shot library for every tuning session; the conductor's in-prompt example phrasings (explicitly flagged "register, not scripts" after verbatim-reproduction incidents).

**External/DB material not visible in the repo:** §12.

---

## 9. PROTECTED RULES (do not weaken in an active-Jove experiment)

"User ownership" decomposes into five separable rules — the experiment touches only the fifth:

1. **Save confirmation** — nothing writes without an explicit user action (pull model; compose-on-tap; confirm-on-tap). Protect: ADR-052 invariants, `CONDUCTOR_REQUIRED_FRAGMENTS`, "Jove never saves" (system.md:149).
2. **Factual correction wins** — "If they correct you, the correction is the point… Their corrected version is the true one" (conductor:265). Protect verbatim; it's also the best active-Jove safety valve (state a read → accept correction).
3. **Accepted conclusion is the user's call** — Jove may propose; only the user ratifies what "represents them." Protect the *ratification*, not the proposal ban.
4. **Saved wording is the user's** — edited content lands verbatim (confirm-checkpoint.ts:689-697); entry bar's "their words verbatim… never add a connection they didn't close" stays for the **written record**.
5. **Conversational reasoning** — currently user-only (F-1..F-4). **This is the experiment's variable, and it is NOT load-bearing for 1-4.**

Also protected: the crisis clause verbatim + `CRISIS_PHRASES` + meter-hide-on-crisis (three layers); 988/741741 fragments; no-diagnosis/no-clinical-labels (conductor, extraction guardrail, machine contract — all three copies); never-prescribe/no-directives (rules.md:74 — narrow it, don't drop it); AI disclosure, 18+, marketing-language rules; prompt-injection wrap on pasted content; never-patronize; the group-prompt privacy rules (never reveal 1:1 specifics); the Goodhart guard (scores never feed Jove — score-conversation.ts:14-16); admin save-guard mechanics.

---

## 10. CLEANUP RECOMMENDATIONS (ranked; nothing edited)

1. **Clarify scope (highest leverage): split "user is the author" in rules.md** into the five sub-rules of §9 with explicit statement that authorship governs truth-acceptance and saved content, not who may reason.
2. **Test before changing: the conductor's Three Rules + goal paragraph** — the experiment itself (§11). Don't pre-edit doctrine to match; run the experiment first.
3. **Consolidate: intent.md's two halves** — merge "How it works" (:18-22) with "What Jove does and does not do" (:120-128) into one statement (the constraint is on framing/clinical claims, not on stating provisional reads).
4. **Move to a different layer: the scorer's hard stances** (score-conversation.ts:71-75, slug list) — move from code into the rubric text so evaluation doctrine is editable where the rubric already is. Keep the Goodhart guard in code.
5. **Remove from runtime, retain as history: extraction prompt staleness** — drop the five-sections block, `layers` tags, the "Jove's research brief" framing, push-era lines; describe the two real consumers (meter, composer).
6. **Delete eventually (dead plumbing):** `postConfirmMode` chain + `buildPostConfirmFallback` + `buildEntriesSummary`; the orphaned rebuilt-mechanics fixture; stale test pointer; `validateResponseStructure`'s dead-law comment (and decide whether the one-question check should exist at all); "Do NOT run the first-session entry" line.
7. **Documentation cleanup:** system.md (chips, cooldownTurns, guided-intake SSE flags), SYSTEM_MAP.md push model, intent.md beta scope, landing five-section list (fold into the rebrand pass), voice-ab/transcript headers.
8. **Deprecate with stronger banners:** master.md (or split live-truth from paused-roadmap), two-layer docs, voice-rebuild-proposal (after mining §8's "BOTH" resolution into doctrine).
9. **Keep unchanged:** everything in §9; the pull model; the composer machine contract; flat confirm replies; ND deltas + situation-copy (settled keeps); the module brief mechanism ("steer listening, not findings" is sound).

Prefer scoping the few authoritative rules over adding counter-rules — the repo's own zero-sum doctrine, and the voice-rebuild-proposal's averaging-toward-restraint diagnosis, both argue that an "also be active" block appended to the current prompt would make things worse.

---

## 11. ACTIVE-JOVE EXPERIMENT BOUNDARY (smallest change set)

**Must change (runtime, one document):** `CONDUCTOR_PROMPT` / the live `conductor_prompt` override, via the Tuning page — (a) the Second Rule (:219-234), (b) the hand-the-assembly paragraph (:242-246), (c) "You are not adding information" (:189), (d) "never author it for them / yours kills it" (:281), (e) optionally relax the near-miss requirement (:264). None of these lines is save-guarded, so no code change is required; the SHA stamp automatically bands scored sessions by prompt version.

**Must neutralize or the experiment will be misread (evaluation, two spots):** the code-locked stance in `buildScoringInstructions()` (score-conversation.ts:73 + the `stating-not-handing` slug) and rubric hard rule + D1/D2/E4 anchors (via the `scoring_rubric` DB override — no code change). Know that `simulate-user.ts:215` will also mute active moves in dev sims.

**Must NOT change:** crisis clause + fragments; `---reflection-ready---` contract; `## Writing the reflection` / `COMPOSER_ENTRY_BAR` (Manual-write fidelity); compose/confirm routes; the pull model; correction-wins (:265); rules.md legal floor; group prompt. The banned-strings test (F-20) only bites if the rewrite reintroduces the exact cross-domain phrases.

*(Post-audit note: ACTIVE_JOVE_V1 implemented essentially this boundary — see the companion reconciliation.)*

---

## 12. BLIND SPOTS

- **The live conductor prompt.** Runtime resolves `persona_voice_overrides.conductor_prompt` first. At audit time the serving text (18.8k chars per state.md) vs the 18,533-char code constant was unverifiable from the repo. **Resolved post-audit** (reconciliation §7): the serving override is 18,812 chars, differs from the code constant only in a founder-rewritten `## Writing the reflection` section (first divergence at char 15,723), stable since 2026-07-09.
- **Other DB-resolved behavior:** `composer_entry_bar`, `first_entry_education`, `post_confirm_first_entry`, `composer_mode`, `scoring_rubric` override, app-copy override rows, `modules` rows, `feature_gates`, `prompt_snapshots`, `conversation_scores`. (Partially resolved in reconciliation §7.)
- **Vercel env:** `COMPOSER_MODE`, `TEXT_MESSAGING_ENABLED`, `MESSAGING_PROVIDER`.
- **No transcripts read** (per audit rules): claims about actual conversational behavior rest on repo-recorded evidence.

**Effective prompt package (code floor, returning user, module conversation, mid-session)** — final order as sent: `system[0]` = CONDUCTOR_PROMPT (goal ¶ → What you never do → crisis → Three Rules → Build it in the open → shape/steps 1-5 → strengths → stuck list → more/landed → worth keeping → Saying it's available → Writing the reflection → After a save) + optional `## This conversation's focus\n{brief}`; `system[1]` (cache_control) = "EARLIER ENTRIES (compressed…)" one-liners; `system[2]` = "CONFIRMED MANUAL" recent entries + "SESSION CONTEXT / This is session N. / Returning user. Do NOT run the first-session entry. / Earlier in this conversation: {summary}" + optional EXPLORATION FOCUS; `messages` = mapped history (windowed 2+48, synthetic user turns for system rows, paste-wrap on the last turn when detected). No tools, no schema. Annotations: hand-over stated 3× (repeated); "never tell / can guide" contradictory in one line; Second Rule overbroad ("the whole back half"); crisis protected; "Writing the reflection" + "After a save" late-position → strong pull on save-adjacent turns; example phrasings historically reproduced verbatim (v0.8 evidence) — examples act as instructions.

## 13. AUDIT COVERAGE

**Directories inspected:** docs/ (all five core docs; reference/, architecture/, audits/, work-prompts/, implementation/ skimmed; voice-rebuild-proposal, depth-meter-spec, first-run-plan), src/lib/persona/ (all runtime + tests + fixtures), src/lib/scoring/, src/lib/manual/, src/lib/modules.ts, src/lib/linq/ (bridge headers), src/app/api/ (chat, checkpoint/{compose,confirm,meter}, admin scoring routes), src/app/admin/, src/components/ (chat/home/manual/checkpoint/onboarding), src/app/page.tsx, .claude/ (skills, agents, commands, SYSTEM_MAP, DRIFT_LOG, plans, diagrams, hooks), scripts/. **Excluded:** node_modules; mockups/design-demos and style-guide (design tokens — "Sage" there is a color); supabase/migrations read only where cited by docs; docs/implementation dark/light-mode (visual only).
**Prompt entry points inspected:** `CONDUCTOR_PROMPT`, `buildSystemPromptBlocks`, module brief injection, `EXTRACTION_SYSTEM`, `buildComposerSystemPrompt`/`buildEntryMachineContract`, `composeEntryAsConductor`, `buildGroupPrompt`, `recomposeHeadline`, `buildScoringInstructions`, `simulate-user` personas, `FIRST_ENTRY_EDUCATION`, all voice-override keys.
**Search terms:** the brief's full variant list (follow/deepen/reflect/mirror/author/facilitator/own words/recognition/validate/hand over/challenge/pattern/advice/never/always/must/clinical/therapeutic/alliance/rupture/readiness/checkpoint/save/one question/…) plus code identifiers: tier/TIER_3/composeTier2, monitor/pattern_engaged/observation_miss_count, checkpoint_tuning/cooldownTurns, sage/mantle, handoff, postConfirmMode, rubric, LAYERS, voice-scaffold, startSituationOffer, RETIRED_MARKERS.
**Effective production prompt:** fully reconstructed at the code floor; DB-override variant resolved post-audit (reconciliation §7).
