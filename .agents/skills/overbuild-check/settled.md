# Settled decisions — read before flagging (SKILL.md Step 0b)

Entries here are decided. **Do not re-flag a KEEP or SKIP** unless the code has materially
changed since the date — and if you do, say what changed. Record new decisions here at the
end of every run (keeps and skips, not just cuts). ADR-level decisions live in
`docs/decisions.md`; this file is for the finer-grained "I looked, it's fine, leave it" calls.

## SKIP — dead-ish but the cut isn't worth the churn/risk

- **`Tier3Flags.checkpointApproaching`** (system-prompt.ts) — 2026-06-04. The 2026-06-04 panel
  called it a "dead field." It is a redundant *output* copy of a **load-bearing input of the
  same name** that drives `showCheckpointInstructions`. ~50 test references and a deliberately
  strict no-spread `Tier3Flags` contract. Cut payoff is one property; blast radius is wide.
  Leave it.

## KEEP — looks cuttable, confirmed load-bearing

- **`validateHeadline` as a log-only smoke detector** (confirm-checkpoint.ts) — 2026-06-04.
  After the headline second-call was removed, this deterministic check stays as zero-cost
  observability into whether the single composer fumbles a title. No model call, never blocks.
- **manual-context compression** (manual-context.ts) — 2026-06-04. Premature at current entry
  counts but cheap, correct, well-tested. Verdict is "don't grow it," not "delete it."
- Moat (also enforced as a SKILL.md hard rule): `manual_entries`, `layers.ts`,
  `confirm_checkpoint_write` RPC, Tier-1 rules, `applyCheckpointGates`/`validateMaterialQuality`,
  the suppression circuit-breaker, neurotype deltas, BANNED_PHRASES/PATTERNS.

## OPEN — fair game on the next run (raised but not yet decided)

- The remaining **log-only validators**: `validateComposedEntry`, `validateResponseStructure`,
  `findUniversalToneViolations` (+ `validateHeadline` above, if observability turns out unused).
  Decision hinges on: is anyone actually reading these warnings and tuning off them?
- **3× checkpoint-gate evaluation** per propose turn (`validateMaterialQuality` runs ~3 places) —
  collapse to one evaluation, persist the result. Dedupe the *call*, never drop the gate inputs.
- **Model-version sprawl**: reply `opus-4-7` vs composition `opus-4-6`. Reconcile.
- **Voice-scaffold trim** (the big one): ~445 base lines + ~55 examples + 13 Tier-3 blocks.
  GATED on an `/evaluate` read of the Opus-every-turn build against a *non-expert* conversation.
  Use `--test-rule` before cutting any specific rule.

## DONE — already cut (2026-06-04, merge d5688bb; do not "rediscover" as live)

Phase-0 shadow monitor (+ `monitor_reads` table), the `NEXT PROMPT` extraction block, the empty
`DEEPENING_ADDITIONS`/`WEAK_STRONG_EXAMPLES` override slots, the `manual_changelog` table, and the
headline-retry second model call. See `docs/decisions.md` ADR-045 for the monitor + two-layer-engine
roadmap pause.
