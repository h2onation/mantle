# ADR Draft — Two-Layer Conversation Engine (Monitor + Tracker + Selector + Stripped Generator)

> **This is a draft. It is not yet in `decisions.md`.**
> When approved, paste into `decisions.md` as **ADR-044** (next number after the existing ADR-042). Until then, this lives in `docs/reference/` as a working draft, alongside the evaluation report at `two-layer-engine-evaluation.md`.

---

## ADR-044: Two-Layer Conversation Engine

**Status**: Proposed

**Context**: Jove's conversation engine today runs one Sonnet call per turn, carrying all three prompt tiers and asked to do four jobs at once: track patterns, hold voice, decide whether to propose a checkpoint, and reply ([call-persona.ts:550](src/lib/persona/call-persona.ts:550)). ADR-020 already split *analysis* off into a parallel extraction call to give the conversation a research brief, but the conversation call itself remains overloaded.

Two failures show up consistently in real and simulated transcripts:

1. **The formula.** With 21 always-on base voice rules ([voice-scaffold.ts:46](src/lib/persona/voice-scaffold.ts:46)), the compliant turn-shape space collapses to one shape — mirror, claim, handoff. Three timer-based forced moves inside the voice ("after three turns commit a read" in R-2, "three responses without a scene → scene invitation" in `DEEPENING_OUTRO`, "8 exchanges max without a signal" in `PACING_RULE`) compound this — every turn that doesn't already qualify by the timer must produce a specific shape. The result is a model running the same beats turn after turn.
2. **The sinking user.** A distressed user goes flat over many turns. Jove, optimizing the current turn, reads the flatness as cooperation, escalates the read, and fires a checkpoint that saves what was a depressive state as a durable behavioral pattern. The post-200 timing bug that made deterministic suppression unreliable was fixed under the 2026-04-21 extraction hardening ([state.md:146](docs/state.md:146)), so the gate side of this could in principle be tightened — but there is no running representation of "the alliance is sinking" for any gate to act on.

Root cause for both: a single forward pass optimizes for the current turn. It has no standing read of "is the relationship holding" or "is this in scope," so it cannot act on those. It generates the locally best next turn and drifts toward its own recent output over the static prompt.

**Decision**: Replace the one-overloaded-call engine with four components, ordered top-to-bottom:

1. **Monitor** — a Haiku pre-call, blocking, current. Reads the relationship: bond holding, task agreed, scope status, rupture type (none / withdrawal / confrontation), and a sliding-window direction (steadying / drifting / sinking). Persisted on the same `conversations.extraction_state` JSONB (or a sibling column, see consequences). Falls back to prior-turn read on a 1500ms timeout.
2. **Tracker** — a slimmed Sonnet, parallel + lagged, replaces what `runExtraction` does today. One job: is there a single pattern ripe to surface? Keeps the language bank (Lock 1 reads it). Drops layer signals, sage_brief, next_prompt as required outputs — those become side effects we can revisit later.
3. **Selector** — deterministic code, extends `applyCheckpointGates`. Reads monitor + tracker output, runs the row-ordered selection: out-of-scope → withdrawal-rupture → confrontation-rupture → contract → formalize → surface → deepen → explore. First match wins.
4. **Stripped generator** — a Sonnet call that holds one posture (handed by the selector) and reads a brief. The 21-rule always-on voice block becomes a posture catalogue inside the cached prefix; only the selected posture's content + the brief lives in the dynamic tail. Three timer-based forced moves are removed (edit-in-place; the rule count stays at 21).

The two locks on saving:
- **Lock 1**: concrete scene (already gated via `concrete_examples`), user's own words carry it (new — verbatim language-bank phrase must appear in the saved text), and it resonated (proxied by `pattern_engaged`, today's signal — kept).
- **Lock 2**: user extended the pattern (new conversation state and tracker signal — see Q-1 in the evaluation report; UX surface to be decided).

Phasing ships in six PRs, smallest-first, each independently shippable:

- **Phase 0**: Shadow monitor (log-only, no behavior change). Validates the design's load-bearing assumption — that a Haiku monitor can reliably classify alliance state — before any other phase commits to it.
- **Phase 1**: Save-off scope-exit gate. Adds one new suppression reason to `applyCheckpointGates`. Voice unchanged. Safety-positive even if everything after stalls.
- **Phase 2**: Direction-driven give-room. Monitor's `direction: sinking` triggers a give-room modifier in the generator prompt.
- **Phase 3**: Edit-in-place removal of the three timer-based forced moves.
- **Phase 4**: Tracker slim-down + Lock 1.
- **Phase 5**: Lock 2.
- **Phase 6**: Posture catalogue + stripped generator.

The deferred features (cross-session thread memory, multi-thread parallel tracking, decision-mode that reads the Manual, dual-manual / network features) are out of scope for this decision and stay deferred.

**Alternatives considered**:

- **Keep tuning the single call.** The path of least change. Add more rules, tighten the brief, narrow the prompt further. Rejected: the diagnosis is over-specification, not under-specification. Adding rules narrows the compliant space further and produces more formula, not less. The 21-rule count already trips this exact failure mode.
- **Merge monitor and tracker into one call.** Cheaper, fewer round trips. Rejected: a single call asked to do alliance-watching AND pattern-hunting starves the quiet job. Pattern-hunting is the loud signal; alliance-watching is subtle. This is what's happening today and producing the observed failures. Also, the monitor must be able to gate the tracker's outputs (a ripe pattern named under a confrontation-rupture must not surface) — a judge cannot be the thing it judges.
- **Build only the monitor; leave the tracker alone.** A smaller change. Closes the safety failure but leaves the formula in place. Rejected as the *target* but accepted as the *Phase 1 slice* — phases 0-2 ship monitor-only behavior, with the tracker work waiting until the monitor is proven.
- **Move monitor synchronously before generation in all cases, no fallback.** Cleanest, simplest. Rejected: ADR-001 explicitly chose parallel extraction to avoid doubling TTFT, and adding a strict blocking step reopens that choice. The 1500ms-cap-with-prior-turn-fallback pattern preserves ADR-001's spirit for the common path while giving the monitor authority when it can be quick.

**Consequences**:

- **Latency.** Phase 2 onward adds a blocking monitor call. Best case +1s TTFT, worst case +3s. ADR-001 (parallel over sequential) is partly re-litigated; the 1500ms cap + prior-turn fallback pattern mirrors ADR-002's lag-is-acceptable position to preserve the parallel-feeling common path. Hard streaming TTFT cap and fallback behavior is Q-6 in the companion evaluation.
- **Token cost.** Per turn: +1 Haiku call (monitor). Phase 6: posture catalogue inflates the cached prefix by maybe 30-50% but pays the prefix cost once per session (cache-creation), reads cheaply thereafter. Net token cost expected to be modestly higher than today, mostly absorbed by cache. Real numbers should land in phase 6.
- **Test surface.** The 21-count pin in `system-prompt.test.ts:1652` does NOT trip (the timer-removal edits R-2's text without removing R-2). Phrase-pin tests covering the timer language need updates (~10-15 assertions). Snapshot tests in `system-prompt.tier3.test.ts.snap` regenerate. New unit tests for monitor output classification, selector ordering, Lock 1 verbatim-phrase gate, Lock 2 extension detection.
- **Audit framework dependence.** `.claude/docs/quality-framework.md` codifies the same timer behaviors as audit checks. Each phase that loosens a constraint must update the framework in the same PR or the audit will produce false positives forever ([state.md:42](docs/state.md:42) covers the recent pattern of audit drift). Q-7 in the evaluation locks this in.
- **State plumbing.** Monitor output rides on the existing `conversations.extraction_state` JSONB pattern (the `observation_miss_count` / `pattern_engaged` / monotonic-counter shape). No migrations needed at start. A dedicated `monitor_state` column is cheap to add later if telemetry queries want it.
- **Safety floor.** Phase 1 lands a structural safety improvement that exists regardless of voice work. If phases 4-6 stall or rework, the safety floor remains. This is the deliberate ordering — the architecture commitment is reversible at the voice level but not at the safety level.
- **`validateResponseStructure` is unchanged.** It logs question-count and dash-usage warnings only; it never blocks. The new design's new postures are not at risk of rejection at this layer ([persona-pipeline.ts:708](src/lib/persona/persona-pipeline.ts:708)).
- **Cache discipline.** Phase 6's posture catalogue must sit inside the cached prefix (`staticContext`) with the posture *selection* in the dynamic tail. Otherwise per-turn cache misses erode the existing cache_performance win.
- **Composer fabrication risk** (separate from this ADR but adjacent). Lock 1 only catches missing-phrase fabrication at the gate. The composer's other softer issues (universal-tone leaks, missing somatic anchor) remain handled by the existing log-only validators. If real beta data shows these failing, an additional pre-confirm rejection gate becomes worth adding — out of scope here, flagged for future.
- **Settled ADRs touched.** ADR-001 (parallel extraction over sequential) and ADR-002 (one-turn extraction lag) are NOT revised — the monitor is a new third call that adds a blocking-with-fallback step alongside the existing parallel pair. ADR-013 (quality-based checkpoint gate) is extended, not replaced: the selector's row-ordered gate keeps quality-based saves as the floor and adds safety-first rows above. ADR-017 (fire-and-forget extraction) is preserved for the tracker; the monitor is the new synchronous component. ADR-020 (three-stage pipeline) is extended into a four-stage pipeline.

---

## Notes for the reviewer

This draft was produced as the output of a scoping mission whose explicit goal was to find collisions, not to validate the design. Read the companion `two-layer-engine-evaluation.md` (Collision Report) before approving — there are seven open questions there that the decision depends on, especially Q-1 (Lock 2 UX), Q-5 (SMS scope), and Q-6 (latency cap).

If approved as-is, the next concrete action is Phase 0 — the shadow monitor PR. That's the cheapest commit that validates the architecture's load-bearing premise (that a Haiku monitor can reliably classify alliance state). Everything downstream is conditional on Phase 0's eval.

If the open questions land differently than the recommended answers, this ADR's phasing may shift but the architectural decision (monitor + tracker + selector + stripped generator with safety-first gating) is independent of those answers.
