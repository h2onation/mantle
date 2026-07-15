---
name: doc-audit
description: Multi-agent freshness audit of mywalnut's documentation surfaces — the foundational docs, the skills/agents/commands, and the admin "how it works" pages. Fans out one verification agent per surface, each grounded in the actual code, and reports where the docs have drifted from reality with file:line evidence on both sides. Read-only by default — buckets every claim as Current / Stale / Broken, recommends the single best fix per finding, and never edits without Jeff's approval. Invoke with `/doc-audit`, optionally scoped to one surface (e.g. `/doc-audit admin` or `/doc-audit docs/system.md`).
---

# Doc Audit

Documentation rots silently. Someone tunes a prompt, drops a table, renames a route, or retires a skill — and the prose that *describes* that thing keeps asserting the old reality. Nobody updates a hardcoded "~7,000 tokens" in a React page when they change the prompt. Your job in this skill is to catch that drift: read what each doc *claims*, read what the code actually *does*, and report every place they disagree.

**You are here to verify, not to rewrite.** The output is a drift report. Nothing changes until Jeff approves a fix. This is the same read-only-audit family as `/overbuild-check` and `/evaluate`.

## The three surfaces

Discover them dynamically each run (glob, don't hardcode — new docs and pages appear). A surface is in scope if it *describes how the system works* and can therefore be wrong.

1. **Foundational docs** — `docs/intent.md`, `docs/system.md`, `docs/rules.md`, `docs/decisions.md`, `docs/state.md`, and the root `AGENTS.md`. The north-star + architecture + rules + decision log + current-state. (Skip `docs/reference/**` and `docs/audits/**` — those are point-in-time human reading, not live claims about the system.)
2. **Skills, agents, commands** — `.Codex/skills/*/SKILL.md`, `.Codex/agents/*.md`, `.Codex/commands/*.md`. Check two things: the definition is internally coherent, *and* what it claims about the codebase (file paths it references, flags, routes, table names, model IDs) still holds.
3. **Admin "how it works" pages** — `src/app/admin/how-it-works/`, `prompt-architecture/`, `extraction-map/`, `schema-map/`, `skills/`, `docs/` (the `page.tsx` under each). **This is the highest-drift surface.** ~10,000 lines of hand-authored prose hardcoding token counts, model names, the prompt tier structure, the schema, the extraction map, and the skills list. Treat every concrete number, name, and structural claim on these pages as a claim to verify against code.

## What counts as drift

For each surface, the agent reads the doc and then reads the ground truth. Drift is any place the doc asserts something the code contradicts. The recurring kinds:

- **Stale numbers.** Token counts, entry caps, turn thresholds, rule counts ("21 rules"), layer counts, model temperatures — a literal in prose that no longer matches the literal in code.
- **Renamed / moved.** A file path, route, function, constant, table, column, or env flag the doc names that has since been renamed, moved, or deleted. (A `file:line` reference that points at the wrong thing — or nothing — is the clearest signal.)
- **Retired or dead.** The doc describes a feature, flag, table, or skill that's been cut. Cross-check the Dead Features list in `docs/rules.md` and the removal ADRs in `docs/decisions.md`.
- **Wrong model IDs.** Any `Codex-*` model ID that doesn't match what the code actually calls. (Verify the live ID in code, not from memory.)
- **Structural drift.** The doc describes an architecture that no longer matches — e.g. "three tiers" when there are now four, a pipeline step that was removed, a fork in the flow that no longer exists (the post-checkpoint fork was cut — does any page still draw it?).
- **Inventory drift.** The skills page lists skills that no longer exist (or omits new ones); the schema-map omits a table; the extraction-map describes fields the extractor no longer writes.

Not drift, leave alone: prose style, ordering, things that are *vague* but not *wrong*, and anything in the reference/audits archives.

## Procedure — the multi-agent fan-out

1. **Scope and enumerate.** Glob the three surfaces (or the single surface Jeff named). Produce the work list: one item per doc / per admin page / per skill-cluster. Group tiny related files so no agent is starved and none is overloaded — aim for roughly a dozen agents, not fifty.

2. **Fan out one verification agent per work item, in parallel.** Launch them in a single message (multiple `Agent` calls) so they run concurrently. Use the `general-purpose` agent type. Give each agent:
   - the exact doc/page it owns,
   - the instruction to **read the ground truth in code itself** (open the files the doc references, grep for the constants/tables/routes/model-IDs it names) — never judge freshness from memory or from another doc,
   - the drift kinds above,
   - and this output contract: return a list of findings, each with `{ surface, claim (quoted from the doc + its line), reality (what the code shows + file:line), bucket, recommended_fix }`, plus a count of claims checked and confirmed current.

   **Verify before asserting stale.** A claim is only "Stale" or "Broken" once the agent has independently opened the code and seen the contradiction. A single failed grep is not proof — the thing may have moved, not died.

3. **Synthesize.** Collect every agent's findings into one report, grouped by surface, each finding in a bucket:
   - ✅ **Current** — checked, still true. (Report the *count* per surface so the report shows coverage, not just problems. Don't list every confirmed line.)
   - ⚠️ **Stale** — doc says X, code does Y. Quote both, cite `file:line` on the code side.
   - 🔴 **Broken** — references a file / route / table / flag / skill that no longer exists.

   Rank ⚠️/🔴 by blast radius: a wrong model ID or a route that 404s outranks a token count that's off by 500. For each, give the **single best fix** (usually: update the doc to match code — but if the *code* is the thing that's wrong, say so, because a stale doc can be the only surviving record of intended behavior).

4. **Present, then stop.** Show the report. **Do not edit anything until Jeff approves** (AGENTS.md "Recommendations require approval"). On approval, apply the accepted fixes as one reviewable batch. If any approved fix touches `docs/state.md`, fold it into the next `/ship` rather than editing state.md on the branch.

## Hard rules

- **Read-only until approved.** This skill diagnoses. It does not silently rewrite docs. Drift reports are cheap; a wrong "fix" that erases the last record of intended behavior is not.
- **Evidence on both sides.** Every ⚠️/🔴 must quote the doc's claim *and* cite the contradicting `file:line` in code. No finding stands on "I think this changed."
- **The code is usually right, but not always.** Default assumption: the doc drifted, fix the doc. But when a doc encodes a *decision* (an ADR, a guardrail, a Tier-1 rule) and the code violates it, the finding may be a **code bug, not a doc bug** — flag it that way and don't "fix" the doc to ratify a regression.
- **Don't widen scope into a rewrite.** Vague-but-correct prose, style, and ordering are out of scope. You're checking truth, not polishing.
- **Add nothing.** This skill is an on-demand audit with zero running cost — no new tables, flags, model calls, or doc sections. (Removal-first / Complexity Gate.) If a surface is missing documentation entirely, *note the gap* — don't author the missing doc inside this skill unless Jeff asks.
- **Model IDs: verify live.** Never assert a model ID is stale (or current) from memory. Check what the code actually calls, and if a doc's ID looks wrong, web-search to confirm the right one before recommending the change (AGENTS.md "Model IDs").
