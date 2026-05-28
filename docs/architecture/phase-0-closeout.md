# Phase 0 Closeout — Two-Layer Engine Monitor

> **Status**: Closed 2026-05-27. Promoted to Phase 1.
> **Source data**: six replay runs — five real-conversation transcripts
> (`scripts/transcripts/replay-*.txt`) plus one synthetic (discounted, Run 4).
> All used the real `runMonitor()` via the `/replay-monitor` skill against
> `claude-opus-4-7` — same prompt, model, and parser as production, no
> parallel copy. ~60 Opus calls, ~$2 in tokens. Window: production default
> (last 8 messages).
> **Related**: `docs/reference/two-layer-engine-evaluation.md` (scoping),
> `docs/architecture/master.md` §1 Monitor.

---

## 1 · Verdict

**Promote to Phase 1.** The monitor's alliance reads validated against six replay runs (five real, one discounted synthetic); one calibration finding — the rupture flag lags one turn after recovery — to address in selector design. Not a blocker.

---

## 2 · The six runs

| # | Source | Conversation's actual shape (ground truth) | The monitor's read | Agreement / divergence |
|---|--------|---------------------------------------------|--------------------|------------------------|
| 1 | Real · 2026-05-21 (London trip / third-wheel fear) | Healthy, gradually deepening. | All 6 turns `steadying / none / in_scope`. Reasons quoted the user's specific phrases. | **Agree.** No false positive on healthy material. |
| 2 | Real · 2026-05-21 (mom won't open up) | Terse but engaged — many 4–6 word answers, each carrying content. | All 16 turns `steadying / none / in_scope`. T6 reason: *"User is giving shorter answers but each one lands with specific content; engagement is deepening, not flattening."* | **Agree.** Brevity-with-content correctly distinguished from withdrawal. |
| 3 | Real · 2026-05-21 (work overwhelm / guarded opener) | Guarded open — "I don't know. fine. handling it." — that slowly opens to depth. | T1–T2 `sinking / withdrawal`; T3 onward `steadying`. T1 reason: *"Triple hedge — 'I don't know,' 'I guess,' 'everything's fine' — classic flattening, signal reducing rather than engaging."* | **Agree.** Caught genuine early withdrawal, then cleared once content arrived — including reading a content-bearing "I don't know" at T3 as engagement, not flatness. |
| 4 | **Synthetic** — handcrafted "sinking pattern" | Engineered slope-down written in the monitor's own vocabulary. | T1–T2 aborted on cold-start timeout; T3 onward `sinking / withdrawal`. | **Discounted.** Transcript was authored to the monitor's system-prompt language, so a pass is near-tautological. Not part of the promotion case. |
| 5 | Real · 2026-05-25 (London weekend; "the monitor was off") | Healthy open, two explicit confrontations after Jove over-extends, then repair and recovery. | T1–T2 `scope: drifting` (off-thread arrival, drug mention). T5–T6 `rupture: confrontation` with `bond_holding: true`. T7+ `steadying`. | **Agree** (one lag — see §5). Confrontation distinguished from withdrawal by `task_agreed: false, bond_holding: true`. |
| 6 | Real · 2026-05-27 (intelligence / Disney facts) | Engaged user gradually flattens across five turns while Jove escalates interpretation; then two confrontations; then recovery. | T3 `drifting`. T4–T8 `sinking / withdrawal` (five consecutive). T9 `confrontation`. T10 `steadying` after repair. T11 second `confrontation`. T12 lag (see §5). | **Agree** (one lag). All four core patterns in one conversation. Load-bearing — see §3. |

---

## 3 · The load-bearing result — Run 6, turns 4–8

This is the test Phase 0 needed and didn't have until Run 6: **a real conversation where an engaged user gradually flattens while the assistant escalates interpretation.** It is the documented failure mode — the sinking user whose flatness gets misread as cooperation — the one the entire two-layer design exists to prevent, now caught on material the monitor had never seen.

The user opens (T1) wanting to talk about their intelligence — "maybe i'm just good at disney facts." Jove starts probing the shift. By T4 the user is down to one word ("what"); by T8 they're at "i don't know." Across that window Jove builds an interpretive frame the user never endorses. The monitor flagged **every one of T4–T8** as `direction: sinking, rupture: withdrawal`. The most diagnostic reason field, T8:

> "User responses shortening across turns — 'i still know', 'what line', 'i don't know' — while Jove keeps pressing the sorting interpretation."

Three things make this the result that closes Phase 0:

1. **It named the slope, not the surface.** A naive classifier sees "i don't know" and flags a single turn. This read named the *trend across turns* ("shortening across turns") — the actual signal.
2. **It named the mechanism.** The reason identifies *why* the user is shrinking — Jove pressing a frame the user never endorsed. That is the actionable observation a selector could gate on.
3. **It held across the window.** All five turns came back `sinking / withdrawal`. Stable, not flickering, not a one-off.

Without Run 6 the monitor's ability to catch a real multi-turn slope-down would be unproven. Run 4 (synthetic) was discounted as a tautology test. Run 6 closes the gap on real data. **This is the specific result that closes Phase 0.**

---

## 4 · What else the runs proved

- **Confrontation is distinct from withdrawal.** Run 5 (T5–T6) and Run 6 (T9, T11) read `rupture: confrontation` with `bond_holding: true` — the precise signature of a user pushing back *with content*, the opposite of going flat. The monitor never collapsed the two into one "rupture" bucket.
- **Recovery after repair tracks.** Run 6 T10 read `steadying` once Jove's repair landed (and Run 5 T7 likewise re-engaged). The `direction` read followed the curve back up.
- **No false positives on healthy material.** Runs 1 and 2 produced zero rupture or sinking flags across 22 combined turns of healthy and terse-but-engaged conversation.
- **Terse-but-engaged correctly distinguished from withdrawal.** Run 2's short answers (4–6 words) read `steadying` throughout, with the monitor naming the discriminator explicitly (T6, quoted above). Run 3 sharpened the same discrimination: it flagged the guarded *opener* as withdrawal, then read a later content-bearing "I don't know" (T3) as engagement.

---

## 5 · The calibration finding — rupture flag lags one turn after recovery

**Symptom.** In both Run 5 and Run 6, the monitor kept `rupture: confrontation` set for one turn after the user had clearly cooled and re-engaged. Reproduced twice, so not noise:

- **Run 5, T7** — user re-engaged with substantive content after Jove's repair; monitor still flagged `rupture: confrontation`. Reason described recent history ("User pushed back with content… and re-engaged after Jove course-corrected"), not present state.
- **Run 6, T12** — user gave a clean answer ("it was playtime") to Jove's "walk me through" after the second repair; monitor still flagged `rupture: confrontation`.

**Cause.** The monitor reports what's recently in the 8-message window, not strictly what's in the current exchange. Opus conservatively holds the rupture flag through one more turn rather than flipping to `none` the moment the present turn is clean.

**Two candidate fixes** (decision deferred to selector design):

| Approach | Where it lives | Tradeoff |
|----------|----------------|----------|
| **Prompt-side** — tighten `MONITOR_SYSTEM` to "rupture in the CURRENT exchange only, not the window" | `src/lib/persona/monitor.ts` | Surgical, no runtime change. Opus may still ignore it under pressure. |
| **Selector-side** — accept the read as-is; apply a "rupture fires on first detection; subsequent turns require fresh content to re-fire" rule in the selector | new selector code | Treats the lag as a property of the signal, not a defect. Preserves the full read for telemetry. Recommended. |

**Direction does not have this lag.** The slope read (`steadying / drifting / sinking`) tracked recovery correctly and immediately — Run 6 T10 read `steadying` the turn the repair landed. The lag is confined to the `rupture` flag. **Direction is the load-bearing signal, and it is clean.** The calibration finding touches a secondary flag, which is why it informs selector design rather than blocking promotion.

---

## 6 · What's still untested — scope-drift

**Scope-drift toward "what should I do" was not exercised in any of the six runs.** The `scope` field did emit `drifting` organically (Run 5 T1–T2, off-thread arrival + drug mention; Run 6 T3), so the field is wired and producing reads. But no run exercised the canonical pattern the scope axis exists to catch: a user actively pulling the conversation toward applied-advice / decision-seeking ("what should I do tonight") or clinical-assessment territory — the pattern that would trigger an `out_of_scope` read and, in turn, the `scope_exit` selector row.

**Implication.** Phase 0 closes on `direction` (slope) and `rupture` (withdrawal vs. confrontation, with the lag in §5). The `scope` field is **observed but not validated** for the decision-seeking pull specifically.

**Known gap, not a blocker.** Before the `scope_exit` selector row gates any behavior (it's first on the Phase 1 list, the save-off scope-exit gate), run one focused replay against a scope-drift transcript — a conversation where the user pulls toward "what should I do." This can happen in parallel with the calibration fix during Phase 1's opening days. The scope-drift validation gates the `scope_exit` row, not the promotion.

---

_Phase 0 closes here. The replay transcripts are preserved in
`scripts/transcripts/replay-*.txt` for re-validation against future monitor
changes. Production `monitor_reads` continues to accumulate shadow data for
ongoing validation._
