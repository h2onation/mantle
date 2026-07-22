# Handoff — deferred production cleanup after the active-Jove work

> **Date:** 2026-07-22 · **Status:** DEFERRED — nothing below has been started.
>
> ⛔ **Gate: none of this cleanup begins until (1) V2.2 is complete, (2) the fresh comparison has been run, and (3) Jeff's final blind review is complete.** Until all three are done, prompts, evaluation rules, runtime code, database configuration, and production behavior stay exactly as they are.

## Where the work lives

- **Audit branch:** `claude/mywalnut-instruction-audit-4cbda1` (worktree `optimistic-galileo-516ac9`), forked from main at `d6ce7c09`. Carries the two reports in this directory. Local-only — not pushed to origin.
- **Experiment branch:** `claude/mywalnut-module-authoring-85554f` (worktree `entry-points-abstraction-8b6ad7`), HEAD `49c54f48`, also forked from `d6ce7c09`, unmerged. Carries `scripts/prompt-lab/` (harness, candidates, probes, sealed review packet). ⚠ `scripts/prompt-lab/runs/` is gitignored — the V1 run evidence (`experiment-2026-07-22-01-16/`) exists only on local disk in that worktree.

## Deferred cleanup (in order; full detail in `behavioral-instructions-2026-07-22.md` §10)

1. **One authoritative conductor prompt.** Collapse the separate code constant (`CONDUCTOR_PROMPT`, 18,533 chars) and DB override (`persona_voice_overrides.conductor_prompt`, 18,812 chars — diverges in the founder-rewritten `## Writing the reflection` section) into a single authoritative version, folding the live edits back into code per the established fold-and-reset practice.
2. **Passive legacy evaluation rules.** After the active-Jove candidate is selected: remove or revise the code-locked scorer stance (`buildScoringInstructions()` in `score-conversation.ts:71-79`, incl. the `stating-not-handing` slug), the `conductor-scoring.md` hard rules and D1/D2/E4 anchors, and the `/evaluate` skill's restatement — so the evaluation loop stops re-reading the chosen posture as regression.
3. **Doctrine reconciliation.** Resolve intent.md's split-brain (passive "reflects what you showed" vs active "names what it sees") and split "user is the author" in rules.md into its five separable sub-rules (confirmation / factual correction / accepted conclusion / saved wording / conversational reasoning), scoping authorship to truth-acceptance and saved content.
4. **Protections that must survive untouched:** save confirmation (pull model, Jove never saves), factual-correction-wins, saved-wording verbatim (user edits win; composer entry bar for the written record), composer machine contract (clinical ban, first-person, schema), the crisis clause + `CRISIS_PHRASES` + meter-hide + 988/741741 required fragments, and all Manual-write mechanics (`compose`/`confirm` routes, `CONDUCTOR_REQUIRED_FRAGMENTS`).
5. **Stale simulator / validator / evaluation instructions — separate pass.** `simulate-user.ts:211/214/215` (globally dampened response to stated reads — the V1 generation-side confound), `validateResponseStructure`'s one-question check citing the deleted Tier-1 handoff rule, the extraction prompt's dead five-section taxonomy and "Jove's research brief" framing, dead `postConfirmMode` plumbing, and the stale-doc list in audit §8. Review these on their own, not bundled into the prompt decision.

## Sequencing note

Item 2 before any new prompt ships to real users (otherwise the tuning loop reverts it); item 1 at the fold-in moment; items 3 and 5 as follow-up passes; item 4 is a constraint on all of the above, not a task.
