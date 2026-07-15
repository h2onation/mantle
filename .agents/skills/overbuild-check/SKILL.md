---
name: overbuild-check
description: Counter-ratchet against overbuilding in mywalnut. Hunts four kinds of bloat — dead weight, over-architecture, context/attention bloat, and inefficiency — across the codebase and the prompt. Tracks accretion over time (a ratchet meter), remembers what's already been decided (so it never re-litigates settled keeps or things a recent ADR deliberately built), quantifies and ranks every finding by cost, and adversarially verifies each cut before recommending it. Read-only by default; the remedy is always simplification (collapse/merge/remove/downgrade), never adding. Never deletes or edits without Jeff's approval. Invoke `/overbuild-check`, optionally scoped (`/overbuild-check persona`) and/or with flags: `--deep` (fan out parallel agents), `--test-rule <name>` (empirically test whether a prompt rule is dead weight), `--from-scratch <subsystem>` (minimal-rebuild delta).
---

# Overbuild Check

A standing counter-ratchet against the one failure mode this codebase keeps hitting: every fix *adds* a rule, check, call, flag, or table, and nothing ever pushes the pile back down. Overbuilding is not only dead code — it is *live* code doing a simple job in a heavy way. Your job is to find it and push the pile back down.

**The remedy is always simplification** — collapse, merge, remove, downgrade. You may NOT propose adding anything (a cache, a layer, an abstraction, a flag, a table). If the only fix needs a new thing, that is a *tradeoff for Jeff to decide*, flagged as such — never recommended as a cut. This discipline is what stops this skill from becoming a vehicle for the very thing it hunts.

**Irony guard:** do not overbuild this skill either. Resist adding new modes/metrics/files unless they earn their place. If you're editing this skill to make it "more thorough," apply the gate to your own change first.

## The four truths (from AGENTS.md "Removal-first / Complexity Gate")

1. **Removal-first.** The fix is almost never "add another thing." Default to deleting or changing what exists.
2. **Cost label.** Every call / table / flag / prompt rule must justify its running cost and name what consumes its output. "Nothing consumes it yet" = cut.
3. **Scaffolding test.** A prompt rule earns its seat only if a frontier model gets it *wrong* without it. Taste it already has is dead weight that steals attention from the rules that matter.
4. **One concept, one place.** Parallel implementations of the same idea are a smell. Consolidate.

## Run modes

- **Quick** (default) — single session. You scan the scope, verify, and report.
- **Deep** (`--deep`, or when scope is large, or Jeff says "be thorough") — fan out parallel **read-only** agents and synthesize. Roles: `senior-engineer` (cost / architecture / efficiency — dimensions 2 & 4), `applied-psychologist` (prompt / context bloat — dimension 3), and `Explore` (breadth — sweep for dimension 1 across the whole scope). Each returns findings with `file:line` evidence; you dedupe, then **adversarially verify** each candidate (spawn a skeptic told to *refute* that it's dead/heavy — kill the finding if it survives refutation). Use the `Workflow` tool for the fan-out when the scope warrants it (invoking `--deep` is the explicit opt-in). Default to omitting model overrides — inherit the session model.

## Procedure

**Step 0 — Ratchet meter (always run first).** Compute the metrics in the Appendix, read the last line of `baseline.log`, and open the report with the **delta since last run**: e.g. "prompt +18k chars, persona +210 LOC, +1 call site, 0 removals since 2026-06-04." An add-heavy delta with no removals *is the finding* — it tells you where to look. Append this run's metrics as a new line at the end. Also classify the recent commit arc (`git log --oneline -30`) as add / remove / tune; an add-heavy streak is corroborating evidence.

**Step 0b — Read what's already settled (don't re-litigate).** Before flagging anything: (a) read `settled.md` in this folder — entries there are confirmed KEEP or SKIP with reasons; do not re-flag them unless the code has materially changed since the decision (say what changed). (b) Skim `docs/decisions.md` — never propose cutting something a recent ADR deliberately built without naming the ADR and the conflict. Settled is settled.

**Step 1 — Scope and scan.** Default scope: `src/lib/persona/` + `src/lib/manual/` + migrations. Open the files; don't work from docs. Hunt the four dimensions below.

**Step 2 — Entanglement trace (before any cut).** For each candidate, list *what else touches it* — callers, tests, DB functions/triggers, a same-named input it shadows, ADRs. The real cost of a cut is its hidden dependencies, not the lines removed. This step is what catches false positives. (Real examples this discipline caught: `checkpointApproaching` shadowed a load-bearing input; `manual_changelog` was deleted-from by a live cleanup function; the headline retry was a defensible quality net.)

**Step 3 — Verify, then cost, then rank.** Independently re-grep every "nothing reads this" / "no writers" claim (don't trust one search; in `--deep`, adversarially refute). Attach a **quantified cost** to each finding (model calls/turn, tokens, latency, $, a table, prompt-attention). **Rank** by confidence × value × safety, so the report leads with "do this first" (verified-dead, zero-entanglement, high-cost) and trails with "probably leave it."

**Step 4 — Label each finding** (see below), recommend the single best simplifying action, and present. **Do not delete or edit until Jeff approves.** Then execute approved cuts as one reviewable batch → `npm run build` + relevant tests → update `docs/state.md`, add a `docs/decisions.md` ADR if it removes something a future agent might rebuild, and **record the decision in `settled.md`** (both the cuts AND the keeps/skips, so the next run respects them).

### Verdict labels

The cut-list is a **hypothesis, not a verdict** — roughly half of "obviously dead" findings don't survive Step 2. KEEP and SKIP are common, valid, valuable outcomes; a run that only ever produces cuts is overcutting.

- **CUT NOW** — verified dead, zero entanglement, zero behavioral risk.
- **SIMPLIFY** — live but heavy: collapse N calls to 1, merge duplicate logic, downgrade an over-powered model, dedupe a gate evaluated 3×.
- **GATED** — a real cut that depends on a product/quality decision only Jeff can make. State the decision.
- **KEEP** — looks cuttable but is load-bearing. Say why, so it lands in `settled.md` and isn't re-litigated.
- **SKIP** — genuinely dead-ish but the cut isn't worth the churn/risk (tiny payoff, wide blast radius). Record it.

## The four dimensions you hunt

**1 — Dead weight.** Dormant subsystems (gated off, no near-term consumer — grep the flag, check `.env.local`, check for readers). Output nobody consumes (a call/table/field never read on a live path — grep writer then readers outside tests/admin). Dead prompt instructions (generate a field gone from the type/schema/merge). Empty override slots (`""` / `[]` exports). Speculative schema (tables/columns with zero app writers). Premature optimization (machinery for scale that hasn't arrived — check real prod counts).

**2 — Over-architecture.** A pathway heavier than its job: N model calls where 1 would do (a second call to fix the first call's output is the canonical tell); parallel implementations of one concept; a gate/validator evaluated multiple times per turn; an abstraction with a single caller; multi-step orchestration that collapses; a config/flag lattice for behavior that never branches.

**3 — Context / attention bloat.** Prompt rules or examples teaching a frontier model what it already does well. Tells: a rule whose job is to undo the stiffness *other* rules created ("sound natural, not like you're following rules"); rules split a/b to stop over-application of a coupled instruction; long worked-example lists re-specifying general taste; large context shipped every turn but rarely referenced; a prompt past the point of diminishing returns (use the ratchet meter's `prompt_chars` delta). **Never touch the neurotype deltas or BANNED_PHRASES/PATTERNS** — those encode what the model gets *wrong* and are the product's reason to exist.

**4 — Inefficiency.** An expensive model where a cheap one suffices; serial blocking calls that could collapse or defer; per-turn work that could run once or async; recomputation of a stable value. Remedy must be simplification (collapse/downgrade/defer) — if making it faster *requires* adding a cache/index/queue, that's a flagged tradeoff for Jeff, not a cut.

## Optional deep lenses (flags — don't run by default)

- **`--test-rule <name>`** — empirically settle "is this prompt rule dead weight?" Spawn an agent that runs the prompt *with the rule removed* against representative inputs and checks whether the failure the rule guards against actually reappears. Behaves fine without it → provably dead; failure returns → load-bearing, KEEP. Turns the scaffolding test from opinion into evidence. (Use this before any large conductor-prompt trim.)
- **`--from-scratch <subsystem>`** — an agent specs the *minimal* version of the subsystem with today's models, ignoring the current code; you diff against reality. The delta is the over-architecture. Catches heaviness that line-by-line scanning misses.

## Hard rules

- **Never propose adding.** The remedy is simplify / collapse / merge / remove / downgrade. A fix that needs a new thing is a tradeoff flagged for Jeff, not a cut.
- **Protect the moat.** Never recommend cutting the persistence/safety spine: `manual_entries`, `layers.ts`, the `confirm_checkpoint_write` RPC, Tier-1 constitutional rules, the checkpoint evidence gate (`applyCheckpointGates`/`validateMaterialQuality`), the suppression circuit-breaker (`stripCheckpointFromText`/`priorCheckpointSuppressed`), neurotype deltas, BANNED_PHRASES/PATTERNS.
- **Evidence or it didn't happen.** Every CUT cites `file:line` + an independently-verified "nothing consumes this" + an entanglement trace. Flag uncertainty rather than guessing.
- **Schema drops are the one irreversible move.** A table/column drop discards data. Flag separately, never bundle silently into a code cut, confirm explicitly, and remember migrations here are applied by hand in the Supabase dashboard (no automated pipeline) — hand Jeff the SQL, don't try to run it.
- **No silent caps.** If you scoped or sampled, say what you did NOT cover.
- **Update `settled.md` at the end** — record keeps and skips, not just cuts, so the next run starts from the decisions this one made.

## Appendix — ratchet-meter metrics (run identically every time)

```bash
cd /Users/jeffwaters/mywalnut
PLOC=$(find src/lib/persona -name '*.ts' ! -name '*.test.ts' -print0 | xargs -0 cat | wc -l | tr -d ' ')
PROMPT_CHARS=$(cat src/lib/persona/system-prompt.ts src/lib/persona/conductor-prompt.ts src/lib/persona/voice-autistic.ts src/lib/persona/voice-adhd.ts src/lib/persona/voice-dyslexic.ts src/lib/persona/voice-general.ts src/lib/persona/extraction.ts src/lib/persona/confirm-checkpoint.ts | wc -c | tr -d ' ')
CALLSITES=$(grep -rEn 'await (anthropicFetch|anthropicStream)\(' src/lib/persona --include='*.ts' | grep -v '\.test\.' | wc -l | tr -d ' ')
NET_TABLES=$(( $(grep -rhiE 'create table' supabase/migrations --include='*.sql' | wc -l) - $(grep -rhiE 'drop table' supabase/migrations --include='*.sql' | wc -l) ))
ENVFLAGS=$(grep -rn 'process.env' src/lib/persona --include='*.ts' | grep -v '\.test\.' | wc -l | tr -d ' ')
echo "$(date +%F) loc=$PLOC prompt_chars=$PROMPT_CHARS call_sites=$CALLSITES net_tables=$NET_TABLES env_flags=$ENVFLAGS"
```

Append the echoed line (verbatim) to `baseline.log` (this folder). Rising `prompt_chars` / `loc` / `call_sites` with no offsetting removals is the ratchet — that delta is the headline of every report. These are proxies, not truth; a jump means "look here," not "cut blindly."

State files in this folder: `baseline.log` (the ratchet meter, append-only) and `settled.md` (confirmed keeps/skips, so decisions aren't re-litigated).
