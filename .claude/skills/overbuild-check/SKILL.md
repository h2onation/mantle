---
name: overbuild-check
description: Periodic deletion-only pass that holds mywalnut to the Removal-first / Complexity Gate. Hunts for dead code, dormant subsystems, duplicated logic, and prompt scaffolding that teaches a frontier model what it already knows. Read-only by default — reports what to cut and why, recommends a single best action per finding, and never deletes or edits without Jeff's approval. Invoke with `/overbuild-check`, optionally scoped to an area (e.g. `/overbuild-check persona` or `/overbuild-check src/lib/manual`).
---

# Overbuild Check

A standing counter-ratchet against the one failure mode this codebase keeps hitting: every fix *adds* a rule, check, call, flag, or table, and nothing ever pushes the pile back down. Your job in this skill is the opposite of a normal task — **you are here to remove, not add.** The only acceptable outputs are deletions, consolidations, and "this is genuinely load-bearing, leave it."

This is the simple, single-session version. For a deep multi-agent audit (panel of judges + adversarial challenge), Jeff runs that as a one-off workflow — don't build it here.

## The truths you are holding (from CLAUDE.md "Removal-first / Complexity Gate")

1. **Removal-first.** The fix is almost never "add another thing." Default to deleting or changing what exists.
2. **Cost label.** Every call / table / flag / prompt rule must justify its running cost and name what consumes its output. "Nothing consumes it yet" = cut.
3. **Scaffolding test.** A prompt rule is only earning its seat if a frontier model gets it *wrong* without it. Taste it already has is dead weight that steals attention from the rules that matter.
4. **One concept, one place.** Parallel implementations of the same idea are a smell. Consolidate.

## What you are hunting for — the overbuild smells

Sweep the scope (default: `src/lib/persona/` + `src/lib/manual/` + recent diffs via `git log --stat -30`). For each smell, cite `file:line` evidence — never assert from memory.

- **Dormant subsystems.** Code gated off by a flag that defaults off, with no near-term plan to turn it on. (The Phase-0 monitor was the canonical case: a whole subsystem, gated off, writing a table nothing read.) Grep the flag; check `.env.local`; check whether anything reads the output back.
- **Output nobody consumes.** A model call, table, or computed field whose result is never read on any live path. Grep the writer, then grep for readers outside tests/admin. Zero live readers = cut.
- **Duplicated logic.** The same gate / validation / formula evaluated in 2–3 places. Collapse to one evaluation, persist the result. (Watch for drift — duplicates diverge silently.)
- **Prompt scaffolding that fails the test.** Rules or examples telling Jove to do what Opus already does well. Tells: a rule whose job is to undo the stiffness of *other* rules (e.g. a "sound natural, not like you're following rules" rule); rules split into a/b to stop the model over-applying a coupled instruction; long worked-example lists re-specifying general taste. **Never touch the neurotype deltas or BANNED_PHRASES/PATTERNS** — those encode what the model gets wrong and are the product's reason to exist.
- **Dead prompt instructions.** Sections of a system prompt that generate a field no longer in the schema/type/merge. Pure token + attention waste on every call.
- **Empty override slots.** Exported constants set to `""` / `[]` that exist only as type surface.
- **Speculative schema.** Tables/columns with zero application writers, reserved for a feature that was never built.
- **Premature optimization.** Machinery for a scale that hasn't arrived (check real prod counts before crediting it — e.g. total confirmed entries, active users).

## Procedure

1. State the scope and read it for real — open the files, don't work from docs. Pull `git log --stat` for the recent arc; a burst of "add" commits with no "remove" commits is itself a signal.
2. For each finding: name the smell, cite `file:line`, state **what consumes the output today** (the decisive question), what breaks if deleted, and the running cost it carries.
3. Run each finding through the gate and label it: **CUT NOW** (verified dead, zero behavioral risk), **SIMPLIFY** (consolidate / collapse), **GATED** (a real cut but it depends on a product decision only Jeff can make — state the decision), or **KEEP** (genuinely load-bearing — say why, so it's not re-litigated next sweep).
4. **Verify before recommending a cut.** Independently grep the "nothing reads this" / "no writers" claim yourself. Do not recommend deleting on a single search.
5. Present the report. Recommend the single best action per finding. **Do not delete or edit anything until Jeff approves** (CLAUDE.md "Recommendations require approval"). Then execute the approved cuts as one reviewable batch, `npm run build` + relevant tests, and update `docs/state.md` / add a `docs/decisions.md` ADR noting the removal so a future agent doesn't rebuild it.

## Hard rules

- **You may not propose adding anything.** If a finding seems to need a new thing to fix it, that finding is out of scope for this skill — note it and move on. This skill only subtracts.
- **Protect the moat.** Never recommend cutting the persistence/safety spine: `manual_entries`, `layers.ts`, the `confirm_checkpoint_write` RPC, Tier-1 constitutional rules, the checkpoint evidence gate, the suppression circuit-breaker, neurotype deltas, BANNED_PHRASES/PATTERNS. These were reviewed and confirmed load-bearing.
- **Evidence or it didn't happen.** Every CUT must cite `file:line` and an independently-verified "nothing consumes this." Flag uncertainty rather than guessing.
- **Schema drops are the one irreversible move.** A table/column drop discards data. Flag it separately, never bundle it silently into a code cut, and confirm explicitly.
