# Prompt-injector audit — 2026-06-01

Branch: `dead-code-audit`.

> **Status (updated 2026-06-01):** all 9 findings below have since been implemented on this branch — the 4 confirmed bugs fixed, the 5 intent calls resolved per the owner's decisions, the single-source `deriveTier3Flags` refactor landed, and the G1–G7-style guard tests added (`src/lib/persona/tier3-blocks.test.ts`). 1,098 unit tests + production build green. The original analysis is preserved below for the record.

Scope: the Jove Tier-3 prompt injector (`TIER_3_BLOCKS` in `src/lib/persona/system-prompt.ts`), its upstream flag producers, the two builders, and the sibling injectors (extraction brief, session summary, checkpoint compression, shadow monitor).

Method: dynamic multi-agent workflow — map flag derivation → trace one agent per block/injector → adversarial skeptic refute-pass on every "broken" verdict → two-builder divergence → 3-lens refactor design judged + synthesized → test-infra design. 35 agents. The 4 "broken" findings each survived an independent refutation attempt; the highest-impact claims were re-verified by hand.

**Headline:** the injector has the same silent "wired-but-never-fires" bug class the flow review found. **23 targets traced → 4 confirmed bugs, 5 intent calls, 14 clean.** None crash; each is a block quietly rendering the wrong thing (or not rendering) with no error. Two structural roots breed most of them, and a small, cache-safe refactor + 7 test guards close the class.

| Bucket | Count |
|---|---|
| Confirmed broken | **4** (1 high · 2 medium · 1 low) |
| Suspect — needs your intent | **5** (2 medium · 3 low) |
| Clean (verified working) | 14 |

---

## Two structural roots (fix these and most findings collapse)

1. **`showCheckpointInstructions` is a verbatim alias of `checkpointApproaching`** ([system-prompt.ts:899](src/lib/persona/system-prompt.ts:899) and :1000, both builders). It carries no independent information, yet it gates *three* blocks (checkpoints, post-rejection) whose intent has nothing to do with "a checkpoint is approaching." This single aliasing is the root of findings #1, #4, #5.
2. **The flag literal is hand-rolled twice** — a 10-field `Tier3Flags` object built independently in `buildSystemPromptBlocks` ([:904-915](src/lib/persona/system-prompt.ts:904)) and the legacy `buildSystemPrompt` (:1005-1016). Two literals = two places a flag can be forgotten, defaulted wrong, or wired to a phantom producer. This is the literal home of the dead-flag and never-fires classes (it's how `guidedPostureSoftened` went dead invisibly).

A note on flag redundancy the map surfaced: `isNewUser === !isReturningUser === isFirstCheckpoint` in the real pipeline (all pivot on `manualComponents.length`), and `showCheckpointInstructions === checkpointApproaching`. Several "flags" are aliases — worth collapsing for clarity, though only the aliasing in root #1 actively causes a bug.

---

## A. Confirmed bugs (skeptic-verified)

### A1. `post-rejection` block can silently fail to fire — **HIGH** · gate-copy-mismatch
- **Where:** gate [system-prompt.ts:594](src/lib/persona/system-prompt.ts:594) (`showCheckpointInstructions`), prose :597.
- **Mechanism:** the block's own prose says its trigger is *"the most recent system message is `[User rejected the checkpoint]`"* — but it actually renders on `checkpointApproaching`. These are different propositions. The rejection turn runs `callPersona({message:null})`, which skips extraction; meanwhile turn N's background extraction can **downgrade** `depth`/`language_bank` non-monotonically ([extraction.ts:493-494](src/lib/persona/extraction.ts:493)), so `deriveCheckpointApproaching` can return **false** on the post-rejection turn. Then the block is skipped and the canonical line *"That entry didn't land. Was it off, or just not ready?"* — which exists only at [:599](src/lib/persona/system-prompt.ts:599), with zero runtime injection — **never ships**; Jove free-forms. Symmetric across web + SMS.
- **Design intent confirms the gate is wrong:** the deferred path ([config.ts:72-79](src/lib/persona/config.ts:72)) already treats the *system message* as the discriminator.
- **Fix:** add a `postRejection` flag derived from "most recent mapped system message === `[User rejected the checkpoint]`" and gate on that. As a bonus, this removes the co-render with `checkpoints` (both currently share `showCheckpointInstructions`).

### A2. `readiness-gate` copy claims all 5 layers done at 3 entries — **MEDIUM** · gate-copy-mismatch
- **Where:** gate [system-prompt.ts:693](src/lib/persona/system-prompt.ts:693) (`manualComponentCount >= 3`), copy :695-698.
- **Mechanism:** `manualComponentCount` is a **raw entry-row count** (no per-layer collapse anywhere — verified through `buildPromptOptionsFromContext` → flat `manual_entries` select, no `DISTINCT`/`GROUP`). But the copy's header says *"when all 5 layers have confirmed entries"* and the pinned line says *"Five layers, each with a core picture of how you operate."* A user with **3 entries all on Layer 1** is told their whole 5-layer manual is complete and asked for cross-layer synthesis that's impossible.
- **Which half is wrong:** the **copy**. `CLAUDE.md:41` and `docs/rules.md:130` both document the intended trigger as "3+ entries" — the gate matches intent.
- **Fix:** rewrite the copy to speak to "a working first version / enough material" without claiming per-layer completion. Also reconcile the admin label ([prompt-sections.ts:353](src/lib/admin/prompt-sections.ts:353) says "5+ entries" — also wrong). Re-baseline the two snapshots.

### A3. Transcript handling never fires over SMS/text — **MEDIUM** · builder-divergence (+ mild safety gap)
- **Where:** web computes it ([call-persona.ts:541-558](src/lib/persona/call-persona.ts:541)); the text bridge ([linq/persona-bridge.ts:79](src/lib/linq/persona-bridge.ts:79)) calls `buildSystemPrompt(buildPromptOptionsFromContext(ctx))` with **no** `transcriptContext`. It's an optional field the mapper never sets, so `renderTranscriptContextBlock(undefined)` returns `""`.
- **Mechanism:** a user who pastes an email chain / iMessage thread / journal **over text** gets Jove with **no** transcript-handling instructions — no "which side is you?" framing and, more importantly, none of the *"do not summarize / do not profile or diagnose the other person / keep analysis on the USER"* guardrails the in-app prompt carries. The upload-mode fallback is also web-only (SMS can't set `mode:"upload"`), so there's no compensating block.
- **Fix:** have the text path compute `detectTranscript` + `selectTranscriptContextForPrompt` and pass `transcriptContext`, mirroring web — ideally by hoisting it into `buildPromptOptionsFromContext` (the single funnel). See refactor step 5.

### A4. `first-checkpoint` block points at a deleted section — **LOW** · stale-reference
- **Where:** [system-prompt.ts:581](src/lib/persona/system-prompt.ts:581).
- **Mechanism:** the block tells Jove *"The approaching-signal wrapper was delivered 1-2 turns earlier (see PROGRESS SIGNALS) so the user already knows the mechanic."* PROGRESS SIGNALS was deleted in Gate 8 (moved to modals — comment :339-344); the wrapper is no longer a Jove turn. So it's a dangling pointer **and** a false premise about Jove's own prior output. The operative instruction is still correct, so harm is bounded.
- **Why the test missed it:** the negative guard ([system-prompt.test.ts:901](src/lib/persona/system-prompt.test.ts:901)) inherits `isFirstCheckpoint:false`, so the block is suppressed and `not.toContain("PROGRESS SIGNALS")` passes **vacuously**; the firing test asserts only the header.
- **Fix:** delete the stale sentence (keep the operative line + 5-step sequence). Drop the parallel stale comment at [extraction.ts:634](src/lib/persona/extraction.ts:634). Add a non-vacuous assertion in the firing test.

---

## B. Suspect — needs your intent (not auto-fixable)

### B1. `guidedPostureSoftened` is a confirmed dead flag — **LOW** · dead-flag
`rg` confirms it's produced by nothing (only 2 declarations, 2 `= false` defaults, 2 literal threads, 1 gate conjunct, 1 manually-passing test). The gate `mode === "guided-intake" && !guidedPostureSoftened` collapses to `mode === "guided-intake"`. The block's **primary job works** (renders every guided turn, which is the documented intent). But the EXIT/PIVOT prose promises an *engine-level* softening that was never wired ("lands in Phase 2 guided polish"). **Decision:** (a) if Phase 2 is shelved, delete the flag everywhere and let the in-prompt softening stand alone; (b) if still planned, keep it as the pinned wiring point. Either way, no user-facing change today.

### B2. `pattern_engaged` can't reset, but the prompt says it can — **LOW** · gate-copy-mismatch
All 14 `ExtractionState` fields have both a producer and a consumer (no dead fields — good). The one real mismatch: [extraction.ts:302](src/lib/persona/extraction.ts:302) prose says `pattern_engaged` resets true→false on explicit user reversal, but the merge `Boolean(parsed.pattern_engaged) || state.pattern_engaged` ([:503](src/lib/persona/extraction.ts:503)) **permanently latches it true**. The documented reset is unreachable; the brief keeps asserting "Pattern is live and engaged" after the user pulled back. **Decision:** (a) honor the reset (trust the model's boolean), or (b) delete the "unless the user explicitly rejects" clause from the prompt. The admin extraction-map documenting the latch hints (b) is the real intent — confirm.

### B3. "Previous session:" actually shows the current conversation's own recap — **LOW** · gate-copy-mismatch
The label says "Previous session" but the attached text is the **same** conversation's rolling recap ([renderSessionContextBlock:806](src/lib/persona/system-prompt.ts:806)). And a genuinely **new** session (fresh row, `summary=NULL`) never surfaces the prior session's summary at all — contradicting `docs/system.md:172`. **Decision:** (a) reword to "Earlier in this conversation" and accept no cross-session carry, or (b) wire the most-recent prior conversation's summary into new sessions. Plus a small hardening: skip the summary write when the Anthropic response is empty so a degenerate response can't blank an existing summary.

### B4 + B5. Post-confirm blocks co-render with the full checkpoint machinery — **MEDIUM ×2** · co-render-conflict
On the post-confirm turn, `extraction_state` isn't re-run or cleared (`message:null` → no extraction), so `checkpointApproaching` stays **true** from the pre-confirm state → `showCheckpointInstructions` true → the full **CHECKPOINTS** block co-renders with `post-confirm-first-message-2` / `post-confirm-subsequent-single`. The result is contradictory turn-output instructions: *"propose a checkpoint using the canonical phrase"* vs *"Open directly with 'Saved.'"* The authors guarded the **output** twin of this ([call-persona.ts:783-792](src/lib/persona/call-persona.ts:783) skips `detectCheckpointInResponse` on post-confirm turns) but **not** the prompt — so if Jove follows CHECKPOINTS and emits the transition phrase, no card renders and the user sees checkpoint prose in plain chat with nothing saved (a Tier-1 Rule-1 violation). **Decision/fix:** derive `showCheckpointInstructions = checkpointApproaching && postConfirmMode === null` (cache-safe, lives in the uncached dynamic tail). Suspect-not-broken only because two downstream guards bound the blast radius; the prose contamination is real.

---

## C. The two-builder divergence (the refactor target)

Consumers: `buildSystemPromptBlocks` = **web/app hot path only** ([call-persona.ts:561](src/lib/persona/call-persona.ts:561)). `buildSystemPrompt` (legacy) = **SMS/text** ([linq/persona-bridge.ts:79](src/lib/linq/persona-bridge.ts:79)), the **admin** prompt-architecture viewer, and (short-circuited to a separate `buildGroupPrompt`) the **group** path.

**Verdict: zero flag-value divergence** — both 1:1 builders consume the same upstream `buildPromptOptionsFromContext` and derive the two local flags byte-identically. The divergence is entirely:
- **(consequential) three optional per-turn fields the SMS bridge never passes:** `transcriptContext` (finding A3 — has the safety angle), `postConfirmMode` (post-confirm pinned copy never fires over SMS), `explorationContext` (no SMS entry point — not a real defect). Web spreads all three at the call site; SMS passes bare options.
- **(intentional) manual-context position:** older/compressed entries sit in the cached prefix (before Tier 3) on web vs inline-after-Tier-3 on SMS. This is the deliberate, test-locked cost of the cache split — **must not change** (touching it breaks caching).

---

## D. Recommended refactor — minimal spine + funnel graft (NOT a rewrite)

The judged synthesis: take the **MINIMAL** lens as the spine, graft the **funnel-completion** from the medium lens, and take the **typed-exhaustiveness** idea from the maximal lens but implement it the cheap way. **Explicitly reject the full block-registry/single-builder rewrite** — it would have to re-derive the cache boundary from scratch, risking the one invariant we must preserve, for a payoff the spine already delivers.

**The change:**
1. **`deriveTier3Flags(input): Tier3Flags`** — one pure function (above `buildTier3`) owning the defaults + the two derived-flag expressions that are duplicated today. The return is an **explicit no-spread `const flags: Tier3Flags = {…}`**, so adding a `Tier3Flags` field without producing it is a **compile error at one site** (converts never-fires/dead-flag from silent-at-render to loud-at-compile).
2. **Both 1:1 builders** replace their hand-rolled literal with `buildTier3(deriveTier3Flags(options))`. After this there is provably **one** flag derivation shared by web + SMS.
3. **Complete the option funnel:** move `postConfirmMode`/`explorationContext`/`transcriptContext` into `buildPromptOptionsFromContext` so "web sets a field SMS forgets" is impossible by construction. **Behavior-preserving** on day one (SMS still passes nothing).

**Cache marker is untouched** — `deriveTier3Flags` produces gating inputs only; `staticContext`/`dynamic` assembly and the `cache_control` placement are byte-for-byte unchanged. The existing byte-equivalence + byte-stability suites ([system-prompt.test.ts:2815-2953](src/lib/persona/system-prompt.test.ts:2815), :2960-3074) passing **with zero edits** is the cache-preservation proof at every step.

**Migration (each step independently shippable, verified by existing suites staying green):**
1. Add `deriveTier3Flags` + `Tier3FlagInput` (pure add, dead code until step 2).
2. Route `buildSystemPromptBlocks` through it; delete the now-dead locals.
3. Route legacy `buildSystemPrompt` through it; add the cross-builder lock test.
4. **[product call]** resolve `guidedPostureSoftened` — drop it, or pin it with a single `// PRODUCER: none yet` line.
5. Complete the funnel (the only signature change; keep last; closes the SMS channel-axis divergence).
6. Comment hygiene (turnCount gate comments).

**What it kills:** flag-literal duplication, dead-flag (d) and never-fires (a) structurally, and builder-divergence (g) on both the flag axis (step 3) and the channel axis (step 5).

**What it explicitly does NOT kill** (honest scope boundary): gate-copy-mismatch (A1/A2/B2/B3), stale-reference (A4), and co-render-conflict (B4/B5) live in individual `render()` prose and `shouldRender` predicates — flag unification neither fixes nor worsens them. Those are the per-block fixes in sections A/B above.

**Effort:** steps 1-3 ≈ +40/-24 lines, one sitting. Step 4 a short follow-up after your call. Step 5 a second small PR. No feature flag, no schema, no cache touch.

---

## E. Test infra — 7 guards that make the class un-shippable

The load-bearing design choice: **G1/G4/G5/G7 consume one shared `reachableFlagDomain()` that mirrors the REAL producers**, not hand-built flags. Hand-built flags *mask* the bug (the existing test literally passes `guidedPostureSoftened: true`, a value no producer emits); a reachable-domain generator *exposes* it.

| Guard | Catches | Gist |
|---|---|---|
| **G1** Reachable-domain render coverage | never-fires, dead-flag | every block must render for ≥1 producer-reachable flag combo; pins `guidedPostureSoftened` as known-dead. *Would have caught it.* |
| **G2** Per-block gate↔copy contract snapshots | gate-copy-mismatch, stale-reference | inline-snapshot each block's prose next to a one-line documented intent + a `forbiddenRefs` list (PROGRESS SIGNALS, etc.). Owns A1/A2/A4/B2/B3. |
| **G3** Builder-parity over the reachable matrix | builder-divergence | assert both builders emit the same **Tier-3 region** (sliced *before* the manual-context tail, so it never collides with the intentional position difference). Owns A3. |
| **G4** Mutual-exclusion exhaustiveness | co-render-conflict | declare `EXCLUSION_GROUPS`; assert never co-render over the reachable matrix. Owns B4/B5. |
| **G5** Always-on allowlist | always-on-unintended | pin the `() => true` blocks; prove every other block is sometimes-off. |
| **G6** Cache-boundary invariant | (refactor safety net) | `staticContext` = tier1+voice+older-manual, no per-turn headers; `dynamic` has Tier 3 + per-turn. Proves the refactor preserved caching. |
| **G7** `deriveTier3Flags` exhaustiveness | dead-flag, never-fires *at source* | post-refactor: no-spread typed return + a `DEAD_FLAGS` ledger test forcing "wire a producer OR declare it dead on purpose." |

Several guards (G2's known-bug rows, G4's post-confirm assertion) are **red against current code** — land them in the same PR as the fix, or `.skip` with a ticket; do not water down the assertion.

**⚠️ CI gap that makes the refactor's compile-time safety load-bearing on a missing step:** the gate (`.git/hooks/pre-commit`) runs `npm run test` + `npm run build`, **not** a standalone `npm run typecheck`. `next build` typechecks app code (so a forgotten field in `deriveTier3Flags` *would* fail the build), but it does **not** check test files — which is why **11 pre-existing type errors** sit unblocked today. **Recommendation: add `npm run typecheck` to the gate (order: typecheck → test → build).** Otherwise G7's full strength reduces to its runtime ledger test, which is weaker than the compile error the refactor was designed to produce.

---

## F. Corrections & caveats (cross-checks that caught agent errors)

- **The flag-map agent claimed `manualComponentCount` is a dead flag (no gate reads it). That is wrong** — `readiness-gate` gates on `f.manualComponentCount >= 3` ([system-prompt.ts:693](src/lib/persona/system-prompt.ts:693), verified by hand). The per-block tracer and divergence agent both treat it as live. Trust those.
- **The test-infra agent said "no pre-commit hook exists."** It does — `.git/hooks/pre-commit` (runs test + build); the agent looked at the literal `.git/hooks` path, which doesn't resolve inside a git worktree. The substantive point (typecheck isn't in the gate) stands.
- All 4 "broken" findings survived an adversarial refutation pass. The 5 "suspect" findings are genuine product-intent calls, not code defects to auto-fix.

---

## Recommended sequencing

1. **Quick, isolated copy fixes (low risk, ship anytime):** A4 (delete stale PROGRESS SIGNALS sentence), A2 (readiness-gate copy + admin label).
2. **The flag-deriver spine (refactor steps 1-3)** + the G1/G3/G7 guards — the highest-leverage structural work; existing suites prove the cache split is preserved.
3. **A1 (post-rejection flag)** and **B4/B5 (`&& postConfirmMode === null` on the checkpoint gates)** — the two real behavioral bugs in the checkpoint family; pair with G2/G4.
4. **A3 / funnel completion (refactor step 5)** — closes the SMS transcript gap + the channel-axis divergence.
5. **Add `npm run typecheck` to the gate** — makes G7 fully load-bearing.
6. **Your intent calls:** B1 (drop/keep `guidedPostureSoftened`), B2 (`pattern_engaged` reset vs sticky), B3 (session-summary label/wiring).
