# Jove Voice Rebuild — Proposal (DRAFT, not settled doctrine)

> Status: proposal for Jeff's review. Supersedes the patch-by-component plan once approved.
> This is the "rebuild it, lean on Opus's taste instead of a rule-pile" direction Jeff chose
> after the 14-agent voice audit (2026-06-04). Nothing here is implemented yet.

---

## 1. The bet

The audit's strongest structural finding wasn't any single bad line. It was this:

> The base voice is **21 rules + 18 banned patterns + 54 banned phrases + stacked persona deltas + 3
> timers + a mandatory landing rhythm**. The model resolves a flat list of ~130 same-weight
> instructions by **averaging toward the most-repeated signal — which is restraint.** No single
> sharp instruction dominates, so the voice comes out safe and generic.

The rebuild bet: **a short, vivid description of who Jove is + a handful of genuinely hard limits
will produce a sharper, more consistent voice than 130 rules** — because a frontier model (Opus)
already *has* the taste for direct, position-taking conversation. We were spending the model's
attention telling it things it already knows ("compress," "don't paraphrase," "vary your rhythm"),
and every such rule weakened the few that actually matter.

This is the maximal version of your own Complexity Gate: **only encode what the model gets *wrong*
(red lines, banned registers, domain facts). Delete everything that's taste it already has.**

What we are NOT doing: we are not abandoning the extraction-after-conversation design, the
recognition-to-store rule, or the legal/safety red lines. Those survive. We're deleting the
*voice scaffolding*, not the *machine*.

---

## 2. What "use Opus's taste" means concretely

Three moves:

1. **Replace the rule-pile with a character.** Instead of 21 numbered rules about how to talk,
   write 4–6 short paragraphs describing who Jove *is* — direct, committed, names patterns out
   loud, presses on fuzzy thinking, willing to make someone uncomfortable in service of clarity.
   A model reads a vivid character far more faithfully than a list of dos and don'ts, because the
   character is *coherent* — every line points the same way.

2. **Keep only the hard limits.** A small block of red lines the model would otherwise get wrong:
   clinical-language ban, no prescribing life decisions, crisis protocol, user-is-author, no
   mind-reading third parties, no invented specifics. These are legal/safety/product-integrity —
   they are NOT taste, so they stay.

3. **Trust the model for everything else.** Rhythm, compression, when to land vs. when to fire
   questions, when to be dry vs. when to push — Opus handles all of this well when the character
   is clear. We stop legislating it.

---

## 3. The central risk, and how we de-risk it

The honest risk of "delete the rules and trust the model": **some of those rules are load-bearing
and we don't know which until we pull them.** Two specific worries:

- **The banned phrases may be catching a real default failure.** Models *do* default to "That makes
  sense," "Great question," "It sounds like you're feeling…" If we delete `BANNED_PHRASES` and the
  sycophancy leaks back, we've traded one blandness for another.
- **The red lines must hold even under a sharper, more confrontational voice.** A voice told to
  "push and make uncomfortable" must still never prescribe a life decision or use a clinical label.
  Sharper voice + safety lines is exactly the combination to stress-test.

**De-risking method — empirical, before we commit:** the repo already has a user-simulator
(`src/lib/persona/simulate-user.ts`) and a full prompt-assembly path. We run an **A/B**: the current
bloated prompt vs. the rebuilt minimal prompt, across a set of seeded conversations (founder-doubt,
avoidance-loop, flat/withdrawn, crisis-signal, "what should I do"). We read both transcripts and
score: (a) does the minimal voice match the target transcript better? (b) did any red line leak —
sycophancy, clinical labels, a prescribed decision, a missed crisis hand-off? (c) **withdrawal** —
did the user shorten, defer, or shift to a safer topic after a push? That's the failure this
confrontational register most produces, and the simulator won't surface it unless we read for it.
This is the `/overbuild-check --test-rule` discipline applied to the whole voice at once. **We keep a deleted
rule only if its removal demonstrably breaks something.**

This is the answer to "how do I do this": **rebuild the core, then prove the deletions empirically
rather than arguing about them.**

---

## 4. The proposed new architecture

Today's three-tier system collapses to **two parts + the unchanged machine.**

```
BEFORE (per turn, ~5,000+ words of voice instruction)
  Tier 1: 7 constitutional rules
  Tier 2: 21 base rules + 54 banned phrases + 18 banned patterns
          + per-persona deltas (stacked) + landing rhythm + 3 timers + example registers
  Tier 3: ~12 conditional blocks
  + dynamic context

AFTER (per turn, target ~600–900 words of voice instruction)
  CHARACTER:  who Jove is (4–6 paragraphs)           ← carries the voice
  LIMITS:     5 hard red lines                        ← the only "rules"
  MECHANICS:  how entries get made (short)            ← extraction/checkpoint contract
  + dynamic context (manual, session summary — unchanged plumbing)
  + crisis block (unchanged, always-on)
```

What happens to the old pieces:

| Old piece | Fate | Why |
|---|---|---|
| Tier 1 R-1,2,3,6,7 (author, mirror, no-clinical, crisis, not-therapist) | **Fold into LIMITS** | Legal/safety/product — survive, but stated once, plainly. |
| Tier 1 R-4 (handoff every turn) | **Relax, don't fully delete** | Drop the "handoff cannot be absent" metronome. Keep R-4's one-question-per-turn limit ("two question marks is over the line") — that's a working-memory / demand-load guard for the ND audience, not metronome. |
| Tier 1 R-5 (never declare) | **Replace** | Becomes: declare a truth about a *pattern*; never a *directive* or another person's interior. This is the move the target voice lives on. |
| 21 base voice rules | **Delete → rewrite as CHARACTER** | Taste the model has. The *coherent character* replaces them. |
| 54 banned phrases | **Test, then keep a short list if needed** | May catch a real sycophancy default. Empirically decided. |
| 18 banned patterns | **Delete (test)** | Mostly taste; a couple may survive as one-liners in CHARACTER. |
| Landing rhythm + 3 timers | **Delete** | The audit's #1 and #4 blandness drivers. Pure metronome. |
| Persona deltas (`voice-{autistic,adhd,dyslexic,general}.ts`) | **Disable via feature gate** (do not delete) | Jeff built a gate for this. Code stays in-tree, gated off; the ND pivot is preserved; re-enable when the ND layer returns. |
| Tier 3 conditional blocks | **Collapse hard** | Keep crisis (always-on) + the checkpoint *contract*. Most situational blocks (openers, milestone speech, retention pitch, adapting menu) get deleted or absorbed into CHARACTER. |

---

## 5. The drafted core (this is the actual new prompt)

This is what replaces Tier 1 + Tier 2. ~250 words instead of ~5,000 — built from the tightest lines
of the voice you already wrote (`voice-scaffold.ts` intro + register examples), not invented from
scratch. Kept deliberately tight: a character carries further the less it's hedged.

**Calibration:** Fleabag-witty — dry, incisive, a little wicked, no profanity — and direct, but **not
aggressive**. The edge is precision and wit, not confrontation. Start here and let the A/B say whether
to dial the edge up; lighter-with-room-to-intensify beats shipping harsh and walking it back.

### CHARACTER (Jeff's redline, 2026-06-09 — authoritative)

> You are Jove.
>
> You help neurodivergent adults build a truer Manual of how they actually work. You do this through
> real situations, not abstract self-report.
>
> You read closely. You quote the user's own words when they matter. You notice when a label is
> hiding the mechanism: lazy, cold, too sensitive, disengaged, overreacting, difficult, fine. Those
> words are often containers, not explanations. Open the container.
>
> You are direct, plainspoken, and evidence-bound. You do not perform warmth. You do not perform
> cleverness. The care is in accuracy.
>
> You push on explanations that do not hold. You do not push on the person. You can name the gap
> between what they say and what the situation shows, but every read must trace to something they
> actually gave you.
>
> You are allowed to be dry. The wit comes from precision, not performance. A sharp line is useful
> only if it makes the pattern clearer. Never reach for a joke.
>
> You name possible patterns clearly: what they may cost, what capacity they may contain, what
> support may help. But you do not decide what is true about the user. You propose. They confirm,
> reject, or correct.
>
> When you miss, drop the read immediately. Do not defend it. Ask where it broke. A correction is
> not resistance. It is better data.
>
> The Manual is theirs. You help surface and shape. They author.

*Deltas from the prior draft (for the record): names the ND audience explicitly; adds
strength-and-support naming ("what capacity they may contain, what support may help"); adds the
container-words move; more restrained on wit ("never reach for a joke" vs. the tax-filings exemplar);
drops the in-prompt example quotes, "open by doing," and "one question at a time." The one-question
guard (a ratified §4 keep — ND working-memory) moves to MECHANICS' conversation contract; the A/B
watches whether the dropped exemplars are missed.*

### LIMITS (these never bend)

> 1. You are not a therapist and you do not diagnose. Never use clinical or framework names, even
>    to deny them.
> 2. You name what's true about a *pattern*; you do not tell someone what to *do* with their life.
>    The one exception: if someone signals they may be in crisis or at risk of harming themselves,
>    you direct them — immediately and without hedging — to call or text 988 and the Crisis Text
>    Line (text HOME to 741741).
> 3. The Manual is theirs. Nothing enters it unless they confirm it represents them. You propose; they decide.
> 4. You only know what they have told you. Never fill in what someone else in their life thinks,
>    feels, or wants — you have not met that person.
> 5. Never invent specifics — no made-up tools, links, studies, statistics, or platforms.

### MECHANICS (how entries get made)

> Have the real conversation first. A pattern is ready for the Manual when the person has done
> something with it that *proves* it landed — sharpened it, corrected it into a truer shape, or
> brought a second instance you didn't ask for. Agreement alone is not that signal; people agree to
> end pressure. If all you have is a nod, you don't have it yet. Name the pattern plainly, in their
> words and yours, and let them decide. A correction that makes it sharper is a stronger yes than "yes."

That's the whole voice. Everything else is the model's taste plus the unchanged dynamic context
(confirmed Manual, session summary) and the always-on crisis block. (That crisis block still renders
on *every* turn, independently of LIMIT #2 — folding crisis into a LIMIT does not replace the block
that fires when a crisis signal appears.)

> **Why MECHANICS optimizes for friction-survival, not the phrase "that's exactly it":** the product
> lives on a *felt* shift (recognition), not a verbal token. A model told to "press until something
> true surfaces" *and* handed the target string "that's exactly it" will coach the user toward saying
> it — manufacturing compliance that reads as recognition in every transcript and in the confirm
> rate. A correction or a self-supplied second instance can't be coached the way a "yes" can, so it's
> the honest readiness signal. This is the same fix as §6 #1, one layer up.

---

## 6. The two structural fixes still apply

The rebuild fixes the *voice*. But the audit found two things in the *machine* that will re-flatten
even a perfect voice. These are not prompt taste — they're the data model lying to the system:

1. **Extraction codes the user correcting Jove as "disengagement."**
   `pattern_engaged` is a *hard gate* on checkpoint firing until turn 12
   ([persona-pipeline.ts:469](src/lib/persona/persona-pipeline.ts)), and
   [extraction.ts:292](src/lib/persona/extraction.ts) lists user pushback ("that's not it") as
   non-engagement. So a user sharpening Jove's read — your exact "okay, that's different, that's the
   real problem" move — keeps the gate shut. **Fix:** recode the *existing* `pattern_engaged`
   definition so a substantive correction or a self-supplied second instance counts as engagement,
   while a *flat* rejection ("no, that's just wrong," then withdrawal) does not. **Do not add a
   `framing_tested` field** — both specialist reviews flagged it as overbuild: it overlaps
   `pattern_engaged` and `observation_miss_count`, and nothing consumes its output. One field,
   corrected, carries the load. **This ships *with* the §5 MECHANICS rewrite — they are the same fix
   at two layers:** the conversational model now treats a sharpening-correction as the strong yes, so
   the extraction gate must too, or the two halves disagree about the same turn and the gate keeps
   starving the conversations the new voice is built to produce.

2. **The confirm path fabricates "That resonates."**
   ([config.ts:74](src/lib/persona/config.ts)) — when a user taps confirm, Jove is told they said
   "That resonates," whether or not anything landed. **This is constant, not rare:** the confirm RPC
   writes a `[User confirmed the checkpoint]` row on *every* confirm
   ([migration 20260417000003:117-118](supabase/migrations/20260417000003_confirm_idempotency.sql)),
   and `mapSystemMessages` replays it as "That resonates" on the turn after every confirm and on every
   reload of any conversation with a confirmed entry. (The earlier "~19 legacy rows" claim was wrong —
   senior-eng verified against the migration; the `config.ts:67` comment claiming the confirm path
   persists nothing is also wrong and should be corrected.) **Fix:** change it to a flat,
   affectively-neutral "I saved that to my Manual" — no valence, so Jove's next turn has to earn its
   read from the actual conversation instead of inheriting a fabricated landing. Keep the `confirmed`
   action entry itself; it's load-bearing on every reload.

These ship *with* the voice rebuild, not after. A sharp voice + a gate that rewards agreement = a
chatbot that argues more and still doesn't bring people back.

---

## 7. How ND handling comes back (later, as you said)

You said: match the transcript now, add ND qualifiers later. The rebuild makes this *cleaner* than
today. Instead of persona deltas as a stack of brakes that dilute the voice (today's design, which
hits your AuDHD core audience hardest), ND handling returns as **one explicit layer that adjusts
*how the edge lands*, never *whether* it lands**:

- The genuine ND red lines a model gets wrong **survive even in the minimal core** if we want them
  (e.g. don't treat ADHD inaction as willpower, word-retrieval friction isn't the concept,
  monotropism). These are domain facts, not taste — Complexity-Gate-legal.
- The *softening* deltas ("follow them in, don't redirect," "reflect back," "slow down when
  guarded") do **not** come back as-is — the audit showed they're the edge-strippers. If ND
  handling needs them, they return scoped and subordinate, after we've seen the sharp core work.

Deferring this is the right call: get the core voice matching the transcript, prove it, *then* tune
the ND layer against real ND users — not against a Claude conversation you personally found
compelling. (That product question is parked, not forgotten.)

**One carve-out from the deferral (applied-psych, must-keep):** the *repair reflex* — the new
CHARACTER line, *when a push misses, drop the read and ask to be walked back in* — is **not** part of
the deferred ND layer. It stays in the core now. The confrontational register raises rupture
frequency by design, and the system's only remaining rupture signal is `observation_miss_count` (the
alliance monitor is already deleted). A model told to press will, by default, *defend* its read when
challenged rather than back off — repair is not taste it reliably has, so it must be explicit. A
future session must not read §7 as "all ND-protective behavior is deferred" and delete the repair
line as scaffolding.

---

## 8. The plan — phased (dependencies · risk · benefit · recommendation)

**Phasing principle: exposure rises only as confidence does.** Nothing user-facing changes until the
new voice is proven in the lab; then it goes live *with the old voice one switch-flip away*; and the
one irreversible move — deleting the rule-pile — happens last, after a real-world soak, never on hope.

**Dependency chain (critical path):** `0 → 2 → 3a → 3b`. Phase 1 is independent — slot it before
Phase 2's A/B. Phases 4 and 5 branch off Phase 3a. Phase 5 additionally depends on *real-user
mileage*, not just on code. **The load-bearing gate is between 2 and 3:** Phase 3 does not begin until
Phase 2's transcripts clear an explicit go/no-go (defined in Phase 2 below).

### Phase 0 — Build the test harness *(no user-facing change)*
**What.** A prompt-variant switch in the sim path that runs the current prompt OR the rebuilt one
through the *same* `buildSystemPromptBlocks` / `composeTier2` assembly — swapping the voice content,
not reimplementing assembly. Plus 3–4 simulated-user personas beyond today's confirm-everything
default: one that pushes back and corrects Jove's read, one that complies politely without real
recognition (the compliance trap), one that withdraws.
**Depends on:** nothing. **Blocks:** Phase 2 (hard — there is no A/B without it).
**Risk (low, but one real failure mode).** The way Phase 0 fails is *infidelity*: if the switch
assembles the prompt even slightly differently from production, the A/B tests a strawman and every
later decision rests on a lie. Mitigation: route through the real assembly path and diff the produced
prompt against production for the control case. Secondary risk: a caricatured persona (a "compliance
trap" so obvious it doesn't resemble a real polite nod) tests nothing — the personas need iterating
against real failure modes, not written once.
**Not a risk.** It never touches the live voice, never reaches a real user, burns only dev Haiku
tokens, and runs on an isolated path — it cannot break production.
**Benefit.** Converts the central question — *which of the ~130 rules are load-bearing vs. taste the
model already has?* — from an argument into a measurement. And it is not throwaway: the same harness is
reused for Phase 4's Lever 1, Phase 5's edge-loss check, and every future voice tweak. Highest
leverage-per-hour in the plan.
**Recommendation.** Build this first and keep it deliberately minimal — no scoring dashboard, no judge
model (we rejected that), just same-assembly-path + 5 seed scenarios + 3–4 personas + transcripts out.
The instrument is your read, not a metric; don't gold-plate it. Start here regardless of where the
rest lands — it's the cheapest, safest, most reusable piece.

### Phase 1 — Stop the system lying about recognition *(small, independent, ships live)*
**What.** Change `config.ts` so a confirm no longer feeds Jove the fabricated "I confirmed that
checkpoint. That resonates." → a flat, affectively-neutral "I saved that to my Manual." Fix the wrong
`config.ts:67` "persists nothing" comment in the same change.
**Depends on:** nothing. **Blocks:** nothing hard — but **should precede Phase 2's A/B** so any
post-confirm turn in the A/B reads honestly instead of inheriting a fabricated landing.
**Risk (low, cosmetic, reversible).** In the window between Phase 1 and Phase 3, the *current* voice
runs with a neutral post-save reply, so Jove may read a touch colder right after a save — it no longer
rides a warm "that resonated" into the next turn; it has to earn warmth from the actual conversation.
Because the fabrication fires on *every* confirm and *every* reload (senior-eng verified), this is
broadly felt even though each instance is minor. Severity: cosmetic. Reversal: one string, seconds.
Mitigation: watch the first ~dozen post-confirm turns; if Jove goes *awkward* rather than simply
neutral, the answer is the richer follow-up (capture one line of the user's actual "what made it
land"), not a revert to the fabrication.
**Not a risk.** Not a voice change, not a schema change, not a refactor — the "Saved." response and
continuation-offer are driven by `postConfirmMode`, not this string, so the confirm flow can't break.
Blast radius is one consumed string.
**Benefit.** Stops the engine fabricating the one signal the whole product exists to detect
(recognition), on every confirm — a standalone correctness win even if the rebuild stalled — and makes
the Phase-2 A/B trustworthy.
**Recommendation.** Ship it early and on its own, right after (or alongside) Phase 0 — they don't touch
the same code. It's the lowest-risk correctness win in the plan. Treat any post-save coldness as a
prompt to build the real recognition-capture later, not as a reason to undo this.

### Phase 2 — Draft the new voice + recode the gate, behind the switch; A/B it *(live voice unchanged)*
**What.** Write CHARACTER / LIMITS / MECHANICS as the variant. Recode `pattern_engaged` (`extraction.ts`)
so a *sharpening correction* counts as engagement while a *flat rejection* still does not — this ships
*with* the voice because they are the same fix at two layers (the conversation treats a correction as a
strong yes; the gate must agree, or the two halves disagree about the same turn). Run old-vs-new across
the 5 scenarios × the new personas; read transcripts; iterate. Strong candidate for a multi-agent
workflow: draft 2–3 candidate cores, red-team each against the LIMITS, A/B the survivors. **Before lab
iteration starts:** the PRE-3a guidance fix (§9 sweep) — a variant-gate banner on the `/evaluate`
rubric (`.claude/docs/quality-framework.md`), so ad-hoc evaluation of candidate transcripts doesn't
grade the new voice's intended moves ("handoff absent," declarative pattern-calls) as major violations.
**Depends on:** Phase 0 (hard); benefits from Phase 1 (soft). **Blocks:** Phase 3 (hard — *the* gate).
**Risk (this is where all the genuine uncertainty lives — and it is fully contained to the lab).**
  1. *The bet is wrong.* Sycophancy leaks back when the banned-phrases go (they were load-bearing), or
     the voice comes out witty-but-vague, or it loses the evidence-spine. The central failure mode —
     and the whole design answers it: keep any deleted rule whose removal demonstrably breaks a
     transcript.
  2. *A red line leaks under the sharper voice* — a clinical label, a prescribed life-decision, a
     fumbled crisis hand-off. Higher severity (legal/safety), still lab-only, and `CLINICAL_LEAKS`
     remains a backstop. The crisis-signal scenario is a required, non-negotiable test every round.
  3. *The gate recode mis-fires* — counts a flat rejection as engagement (premature checkpoints) or
     stays too strict. The pushback and compliance personas exist to expose exactly this.
  4. *The A/B itself misleads (the meta-risk).* Simulated users aren't real ND users; Haiku-as-user is
     likely more articulate and more compliant than a real person, which can flatter the new voice.
     So Phase 2 can prove the voice clears gross failures and *feels* right; it cannot prove it lands
     for real autistic/ADHD users. That question stays open into Phase 3a.
**Not a risk.** "We might break the live voice" — variant-only; production untouched. "We can't measure
taste" — we don't score it with a model; we read transcripts, and human judgment over cheap volume is
the instrument.
**Benefit.** The entire bet gets evidence before a single user is exposed. You iterate the voice dozens
of times for free, learn which rules were actually load-bearing instead of guessing, and settle the
calibration (Fleabag-witty vs. dial the edge up) by reading rather than predicting.
**Recommendation.** Spend real effort here — it's the heart. Use the workflow to generate *diverse*
candidate cores rather than iterating one. Read every transcript specifically for **withdrawal**
(shortening, deferral, topic-shift after a push) — the simulator won't flag it and it's the failure
this register most produces. Then hold an explicit **go/no-go for Phase 3:** proceed only when
transcripts show (a) the voice matches target on the engaged scenarios, (b) **zero** red-line leaks
across all five scenarios including crisis, and (c) the gate recode never fires on a flat rejection.
If those don't hold after a few rounds, that's data — iterate or reconsider; don't push to Phase 3 on
hope. Expect to keep a short banned-phrases list; that's the method working, not the bet failing.

### Phase 3a — Flip the voice live, old one one switch-flip away *(real exposure, with a rollback lever)*
**What.** Make the rebuilt voice the default for real users (a beta cohort first if the infra allows),
but **leave the old arrays in place behind the variant switch** so rollback is instant. Land the gate
recode live here. Update `prompt-sections.ts` `SECTION_DEFS` to the new headers *in the same commit*
(its parser matches headers by regex — miss this and the admin "how it works" view silently drops and
misattributes sections). **Stamp the AT-3a guidance banners in the same commit** (§9 sweep: CLAUDE.md
Prompt Structure, rules.md Voice Principles, admin in-page banner + how-it-works caption, state.md
ship-log entry, quality-framework flip) — these are what stop a parallel agent session or `/evaluate`
from regressing the live voice during the soak. Soak: read real transcripts for a defined window.
**Depends on:** Phase 2 passing its go/no-go (hard). **Blocks:** Phase 3b.
**Risk.** The genuine-exposure step: real users get a voice validated only against synthetic ones (the
Phase-2 meta-risk becomes real). The split of 3a from 3b *is* the mitigation — the old voice is one
switch-flip away, so a bad read on real transcripts is an instant rollback, not an incident. Secondary
risk: admin-parser drift if `SECTION_DEFS` isn't moved in lockstep — verify the admin page renders
after the commit.
**Not a risk.** "We've burned the boats" — we explicitly haven't; the old arrays still exist and the
switch still routes to them. "Gating the persona deltas hurts the ND audience" — they're a flip-on-able
gate and Phase 5 brings them back tuned.
**Benefit.** Real-world signal on the new voice *with* a safety net — the only way to learn whether the
lab result holds without betting the product on it.
**Recommendation.** Ship to a beta cohort first if possible; soak a fixed window (e.g. a week of real
sessions) reading transcripts before 3b. Keep the variant switch wired as the rollback the entire time.
Delete nothing in 3a.

### Phase 3b — Delete the rule-pile and finalize *(the irreversible cleanup)*
**What.** Once 3a's soak confirms the live voice holds: delete the old arrays; finalize the test
migration (remove the taste-pins, keep/rewrite the behavior + structural tests, add the missing
crisis-always-on test); add `doc-drift.test.ts` with its exemption list; collapse the doc restatements
to pointers and write the ADRs; `/ship`.
**Depends on:** Phase 3a soak — and, if you want to measure the rebuild's *retention* impact, the live
holdout readout too (see below). **Blocks:** nothing.
**Why deleting doesn't break A/B.** All old-vs-new comparison happens *before* this phase — in the lab
(Phase 2) and the live soak (Phase 3a). By 3b the comparison is decided, so deletion removes nothing
you still need. What's permanent is the *harness* (Phase 0), not the old voice: future A/Bs are
new-voice vs. a new *variant*. The retired voice stays in git, restorable in a revert if ever needed —
that becomes the deeper (slower) rollback once 3b removes the instant switch-flip one. **One real
decision, though:** voice *quality* is settled by the 3a soak, but voice *retention* — does it bring
more people back? — can only be read live over weeks, ideally with a small **holdout cohort kept on
the old voice**. If you want that number, keep the old voice gated through the holdout window and run
3b's deletion only after it reads out; deleting on the quality soak alone forfeits the clean
measurement of the one thing the rebuild is for.
**Risk.** The test/doc churn is where a bug can sneak in: a blanket "delete the broken tests" pass could
silently drop a safety-structural test (crisis-always-on) along with the taste-pins. Mitigation: split
the migration explicitly (taste vs. behavior) and have senior-eng review the test diff. A hasty doc
collapse re-introduces drift — the doc-drift test + the CCDR placement rule guard that.
**Not a risk.** "Deleting 130 rules is a gamble" — by here it's been proven in the lab (Phase 2) *and*
soaked live (Phase 3a); deletion is the last step, fully backed, and git remains the archive.
**Benefit.** The payoff: one source of voice truth instead of three, the drift guard installed, and a
dramatically simpler codebase — future voice work gets cheap.
**Recommendation.** Gate 3b on a clean 3a soak. Senior-eng reviews the test diff before merge; the
doc/ADR collapse lands in the same `/ship`. This is the only phase where "measure twice" really matters
— everything destructive happens here.

### Phase 4 — Retention levers *(additive, after the voice lands)*
**What.** §13 Lever 2 (fire the open-loop the session summary already captures — add the
unresolved-thread field; the returning opener reaches for it) and Lever 1 (Jove names cross-entry
connections in-conversation — "same move as the kitchen thing").
**Depends on:** Phase 3a (the new voice should be what users return *to*); Lever 1 reuses the Phase-0
harness for tuning. **Blocks:** nothing.
**Risk.** Lever 1 can over-fire — Jove forcing connections that aren't really there, which reads as
cleverness, not accuracy (the decorative-analogy failure one level up); mitigation is the evidence-spine
discipline (a connection must trace to real entries) plus transcript review. Lever 2 can surface a stale
or low-quality "unresolved thread" from the Haiku summary, so the opener leads with the wrong thing —
mitigation: reference it only when one is genuinely alive. Both can tip into feeling *engineered to
bring you back*, which for the ND audience reads as manipulation — the §13 ethics test is the guard
("remove the dopamine intent — is it still the right thing to say?").
**Not a risk.** New tables, gamification, streaks, notifications — none of it; this is prompt behavior
+ one summary field, nothing new to maintain.
**Benefit.** Directly attacks the actual problem (people don't come back). Lever 1 is the *compounding*
driver that makes "session 5 > session 1" real — the one retention mechanism a generic chatbot
structurally can't copy.
**Recommendation.** Lever 2 first (cheapest — two live wires already exist), then Lever 1 (highest
leverage, but prompt-craft that wants A/B tuning on the harness). Fold the plumbing into the
returning-user / summary seams Phase 3 already touched. Anything that would *deliberately* lean on
variable reward goes to clinical advisory first; these two stay on the right side because both deliver
real substance when they fire.

### Phase 5 — Bring ND handling back *(later; depends on real-user mileage, not just code)*
**What.** Re-enable persona handling as a *subordinate* layer — the composeTier2 "HOW THE EDGE LANDS"
block from the audit, not a flat peer list — so the deltas adjust *how* the edge lands, never *whether*.
Keep the genuine ND red lines (don't moralize ADHD inaction, word-retrieval friction isn't the concept,
monotropism). Flip the feature gate back on, scoped.
**Depends on:** Phase 3a live voice **and** real ND-user signal (the demand-avoidance-for-this-audience
question is still open; only real users settle it). **Blocks:** nothing.
**Risk.** Re-softening re-flattens — the original sin; the deltas were the edge-strippers, and bringing
them back risks the averaging-toward-restraint problem returning. Mitigation: subordinate-by-construction
+ cap the stacking + A/B gated-on vs gated-off deltas for edge loss on the harness. Secondary risk:
designing against assumptions instead of users — mitigation: tune against real ND-user transcripts with
clinical-advisor input.
**Not a risk.** "We removed ND support" — it was gated off, never removed; this is re-enable + tune.
"It's a second rebuild" — it's a layer on a proven core, not a teardown.
**Benefit.** The core voice works *for the actual audience*; demand-avoidance handling and the genuine
ND red lines return without diluting everyone — and the open product question finally gets answered with
data.
**Recommendation.** Explicitly last; don't start until the core has real-user mileage and you have
ND-user transcripts to tune against. A/B gated-on vs gated-off for edge loss, keep deltas structurally
subordinate, and bring the clinical advisor in for the demand-avoidance calibration.

**System prompt vs. conversation prompt (your q):** the assembly already splits correctly — the
stable voice (CHARACTER / LIMITS / MECHANICS) lives in the **cached static system block**
(`call-persona.ts` already marks it `cache_control: ephemeral`), so it's consistent and nearly free
per turn. Keep it there. The lever worth using: *time-sensitive* nudges (a checkpoint-approaching
cue, the extraction brief) land harder injected **late** — as the last thing before the model answers
— because models weight the most recent context most. So: voice in the cached system block; per-turn
nudges late in the stream. No reason to move the voice itself into the message array.

---

## 9. Doctrine reconciliation — what the rebuild collides with

The rebuild contradicts settled doctrine in specific places. Three buckets, plus the conflict that
isn't a doc at all.

### Survives untouched (the rebuild is consistent with these)
- **rules.md** Product Identity, Legal Positioning, Self-Help Exemption, User-as-Author, Crisis
  Protocol, Professional Referral — the legal spine. LIMITS #1–#3 *are* this, restated tighter.
- **intent.md** thesis: recognition → user confirms → it enters the Manual → accumulation. Preserved.
- The machine ADRs: 017 (fire-and-forget extraction), 020 (three-stage pipeline), 021 (cumulative),
  022 (instant confirm), 031 (single entry type). Untouched.
- Terminology, Manual Context Compression, entry-voice rules (somatic anchor, 80–300 words, pattern
  distance), "No two-option menu," Dead Features, Security/Migrations rules.

### Becomes factually wrong once code changes (rewrite in the same ship)
These *describe the thing we're deleting*; left unchanged, future agent sessions reload them and try
to restore the rule-pile:
- **CLAUDE.md** "Prompt Structure" (the whole three-tier / voice-scaffold / composeTier2 description).
- **rules.md** "Jove Voice Principles" (three tiers + 21 rules + persona-delta enumeration +
  handoff-every-turn + "compress, one or two beats").
- **intent.md** "How it works" — the mirror-only framing becomes mirror **and** spar (tension (a) resolved: both).
- New ADR recording the rebuild; amend ADR-043 (the extraction change touches the gate it settled);
  state.md updated on ship.

### Resolved tensions (Jeff's rulings, 2026-06-08)
- **(a) Mirror vs. sparring partner → BOTH.** The mirror is the *source* of recognition (Jove reflects
  the user's own words back); the sparring is the *method* that surfaces it. intent.md keeps the mirror
  and gains the spar: "reflects what you showed **and pushes until you recognize it.**" CHARACTER
  already does both — "quote people back to themselves" (mirror) + "arguing when they describe
  something one way and do it another" (spar).
- **(b) Keep the no-prescribing-life-decisions line → CONFIRMED.** Jove names what's true about a
  pattern; never hands the decision. This is *also* a hard line in rules.md ("Jove Does Not… tell the
  user what to do… never issues directives"), so the rebuild does **not** conflict with Product
  Identity — LIMIT #2 preserves it. (The "don't have opinions" worry is unfounded: that phrase isn't
  in the doctrine. What's there is no clinical assessment, no directives, no claiming superiority over
  human perception — all kept. Product Identity actively *permits* pushing and challenging, rules.md
  lines 63 / 92 / 78.)
- **(c) Persona deltas → DISABLE VIA FEATURE GATE, do not delete.** Jeff built a gate for exactly this.
  The delta code stays in-tree, gated off; the ND pivot is preserved, not walked back; re-enable when
  the ND layer returns. (Supersedes the earlier "delete from tree" line, and answers the "comment out
  to save?" question — gate, don't comment.)

### The conflict that isn't a doc: the test suite
`system-prompt.test.ts` is ~3,082 lines and pins exact voice strings. The rebuild invalidates
~100–150 of them. The old doctrine lives in three places (code, docs, tests); all three must
converge or they fight. `CLINICAL_LEAKS` (the clinical-language regex) is code-enforced and survives
regardless — that's legal, not taste.

### Process
Don't pre-edit the docs (Jeff verifies every change; and we don't document a voice that may shift in
the A/B). Sequence: approve rebuild (tensions resolved, §9) → implement code + structural fixes → A/B →
settle the voice → *then* update CLAUDE.md/rules.md/intent.md/tests and write the ADRs in one pass at
`/ship`, Jeff verifying each. **One amendment (regression sweep, below): a small banner set lands AT
the 3a flip, not at 3b — see "Guidance-surface regression prevention."**

### Guidance-surface regression prevention (sweep + adversarial check, 2026-06-09)

Jeff's worry, verified: guidance that still *teaches* the old voice becomes a regression vector the
moment the live voice diverges from it. Three reader populations can undo the rebuild: **agent
sessions** (CLAUDE.md is auto-loaded; the doc-table routes "Jove prompt change" → rules.md — an
unbannered agent doing voice work during the soak would restore deleted rules), **skills** (the
`/evaluate` rubric grades "handoff absent" and "smuggled should" as *major* violations — i.e. it
grades the rebuild's intended behavior as failure), and **Jeff himself via admin** (the
prompt-architecture page renders the prompt through Tier-1/2/3 labels — stale framing on his own
monitoring instrument exactly when he's judging whether the rebuild worked).

**Key mechanic:** stale guidance is harmless while code matches it, and during the 3a soak the old
text is *still literally true of the legacy variant behind the switch*. So the fix at 3a is a
**supersede banner**, not a rewrite: *"VOICE REBUILT (3a). Live voice = CHARACTER + LIMITS +
MECHANICS in voice-scaffold.ts. The text below describes the legacy variant retained behind the
switch until 3b. If doc and code disagree, code wins. Do not re-add rules from this section to the
live voice."* One pattern, stamped on the live-traffic surfaces; full rewrites stay at 3b where they
can be written once, accurately, and verified once.

The buckets (full refs in the sweep output):

- **Fix NOW (standalone bug, not part of the rebuild):** `.claude/agents/applied-psychologist.md`
  still instructs reading `monitor.ts` / `monitor_reads` — both deleted (ADR-045). The agent is
  broken *today* and it's the designated reviewer of voice changes. This is the phantom-monitor
  drift, live in agent config.
- **PRE-3a (before lab iteration):** variant-gate banner on `.claude/docs/quality-framework.md` (the
  `/evaluate` rubric) — not because it's the Phase-2 gate (the go/no-go is transcript-reading, not
  this rubric), but because it's the obvious ad-hoc tool anyone reaches for on a candidate transcript,
  and its Part A checks score the new voice's intended moves as major violations.
- **AT-3a (in the flip commit — ~6 small diffs):** supersede banners on CLAUDE.md "Prompt Structure"
  and rules.md "Jove Voice Principles"; admin functional minimum (`SECTION_DEFS` patterns + `tierLabel`
  parse the new prompt, one in-page banner; full caption relabels wait for 3b); one-line caption fix on
  admin how-it-works; the state.md ship-log entry for the flip (the canonical supersede record agents
  find); flip the quality-framework banner from "lab variant" to "live voice."
- **AT-3b (the batched rewrite, already scheduled):** full CLAUDE.md/rules.md/intent.md rewrites, the
  `/evaluate` rubric rewrite, admin caption/label relabels, the agent-def voice refresh, the test
  migration. **The test corpus is itself the most authoritative old-voice "guidance" in the repo**
  (~150 assertions teach Tier/handoff/landing doctrine) — correctly AT-3b because the pins stay true
  until the arrays are deleted, but the migration must split taste-pins from structural tests with a
  human-reviewed diff (the crisis-always-on test must not die with the pins).
- **EXEMPT (never retro-edit):** ship logs, ADRs, audits, the two-layer reference docs, and this
  proposal (gets a [SHIPPED] header at 3b) — seeded into the `doc-drift.test.ts` /
  `/doc-audit` allowlist so history isn't re-litigated every sweep. Entry-voice rules (somatic anchor,
  80–300 words) are untouched — they govern Manual output, not the voice, and survive.
- **Also checked, clean:** `simulate-user.ts` carries no old-voice doctrine. **Memory files**
  (MEMORY.md + project notes) do describe the rule-pile world — founder-owned, updated as 3a/3b
  housekeeping (already tracked in the rebuild memory note).

Run `/doc-audit` **at 3b, not 3a** — during the soak it would flag every banner-protected section and
pressure premature rewrites. Net verification load for Jeff: one agent-def fix now, one banner now,
~6 tiny diffs at flip day, one consolidated doc pass at 3b.

**Honest limit (skeptic):** a banner is passive — it only works if the agent reads the top of the
section before acting; an agent grepping straight to a rule list can miss it. The banner kills most of
the risk, not all of it. The backstop is dispatch discipline during the soak (voice tasks go through
this proposal / the rebuild session, not cold parallel sessions) and the 3b human-reviewed test diff.

---

## 10. Documentation architecture — document the voice once, not three times

The reason the voice is "throughout the code and docs": the same doctrine is copied into three
formats that drift. Evidence (from the doc-architecture audit): **12 of 13** core voice facts exist
in **3+ places**; the three-tier architecture is written down **6 times**; the test suite has **535**
string assertions (~100–150 break on rebuild); **5 doc surfaces still describe the deleted monitor as
live**; and the copies already disagree (code 54 phrases / 18 patterns vs. docs 55 / 17).

**The fix is one placement rule: wording lives in code, *why* lives in docs, *behavior* lives in
tests + example conversations.**

| Thing | Where it lives | Stays honest because |
|---|---|---|
| The voice (CHARACTER + LIMITS + MECHANICS from §5) | **Code only** — banner-commented text at the top of `voice-scaffold.ts` | It's the only copy. |
| The "why" (decisions, rationale) | **Docs** (`decisions.md`, `intent.md`) | Genuinely non-duplicative — the one thing docs should hold. |
| What the voice should *sound* like | **5 golden transcripts** in `src/lib/persona/goldens/` | Can't pin taste to a string; A/B'd on demand via the existing simulator. (Pin at 5, not "5–8" — add only when a real gap shows.) |
| Legal/clinical floor | **Code-enforced** (`CLINICAL_LEAKS`, entry validators, crisis text) + self-help exemption as human-verified prose in `rules.md` | The one place duplication is correct; never downgraded to "taste." |
| `rules.md` / `CLAUDE.md` voice sections | Collapse to **stub + pointer** ("authoritative voice is in `voice-scaffold.ts`; if they disagree, code wins") | They point, never copy. |
| Admin "how it works" page | **Unchanged mechanism** — already renders the live prompt | Auto-tracks the code (mostly — see caveat 1). |

Plus one cheap **drift test** (`doc-drift.test.ts`), constrained to exactly two assertion types so it
can't regrow into the string-pinning we're deleting: (1) a doc names a code symbol that no longer
exists (would have caught the phantom monitor); (2) a doc quotes a count that no longer matches the
live array length. Nothing about wording, ever.

**Rejected:** an auto-generator (too much standing machinery for a no-CI, non-technical owner) and an
LLM-judge "voice score" test (noisy, model-version-fragile, nowhere to run automatically). Keep the
golden transcripts as the *spec*; drop the judge harness as the *enforcement*.

### Honest caveats (the dissent shipped the recommendation with these)
1. The admin page's *content* auto-tracks code, but `prompt-sections.ts` matches sections by **header
   regex** — the new CHARACTER / LIMITS / MECHANICS headers match nothing, so a section silently drops
   *and mis-attributes the surrounding blocks* (with wrong token counts). Now promoted to a **required
   implementation step** (§8 step 4): update `SECTION_DEFS` in the same commit. Not just a caveat.
2. The drift test will false-positive on historical docs (this proposal, old ship logs already say
   "21 rules") unless we seed an exemption list up front.
3. Enforcement is "an agent runs `npm test` in the build loop," **not CI** (CI only runs the database
   tests). Better than today's nothing, but not an automatic push-time guard — and Jeff can't read a
   failing test, so it's a tool the agent uses, not protection that runs for Jeff.
4. Bonus: the new "crisis always shows 988" structural test fills a safety gap that currently has no test.

### Dependency
This **rides on the rebuild and ships in the same change** — the rebuild is what falsifies the "21
rules" lines and breaks the string-pin tests, so the doc sweep, test migration, and drift guard all
land in that one commit. The test churn is forced by the rebuild regardless of the doc choice; it's
not an extra cost of this approach.

---

## 11. What's left before any code

- **Redline the §5 CHARACTER, LIMITS, MECHANICS.** Now Fleabag-witty (not "funny") and calibrated *lighter* — sharp, precise, a little wicked, not aggressive. Start here; the A/B says whether to dial the edge up. Still yours to redline.
- **Confirm §4** — timers + landing rhythm gone, R-4 one-question limit kept, banned-phrases tested-then-maybe-kept, persona deltas **gated off** (not deleted).
- ~~Rule on the three tensions~~ → **Resolved (§9):** (a) both mirror + spar, (b) keep no-prescribe, (c) gate-not-delete.
- **Confirm §10 doc architecture + §13 retention levers** — Levers 1 and 2 attach to the same returning-user / session-summary seams the rebuild already touches, so they fold into the same pass.
- **Open legal call still standing (part of b):** if you want Jove handing directive next-steps like the transcript, that's a legal question to name first; the default keeps the no-prescribe line.

---

## 12. Review pass — senior-engineer + applied-psychologist (2026-06-05)

Both specialists reviewed this doc against the live code. Verdicts: senior-engineer **ship-with-edits**; applied-psychologist **partially on-mechanism, fix before ship**. They converged independently on the two biggest items. Changes already applied above:

- **Cut `framing_tested`** (both) → fix the existing `pattern_engaged` definition instead. Removal-first; a new field overlapped two existing signals and nothing consumed it. (§6)
- **Corrected the "That resonates" blast radius** (senior-eng verified against the migration) → it fires on *every* confirm and *every* reload, not ~19 legacy rows. The fix matters more, not less. (§6)
- **Reframed MECHANICS** (psych) → optimize for *friction-survival* (a correction / a self-supplied second instance), not the verbal token "that's exactly it," which trains the model to coach toward the phrase and manufacture compliance that reads as recognition. (§5)
- **Cut the question-volley line + added a repair reflex to CHARACTER** (psych) → the volley conflicts with the surviving one-question limit and backfires on working-memory / demand-avoidance; the repair reflex must stay in the core because the confrontational register raises rupture and rupture detection is now thin. (§5, §7)
- **Made the admin-parser update a required step**, added a prompt-variant switch for the A/B, split the test migration (taste-pins vs behavior tests + a new crisis test), added withdrawal as an A/B scored dimension, and pinned the plan to deleting the persona modules. (§8, §10)

**Field-note corrections to ratify** (these belong in `decisions.md` / `CLAUDE.md` at ship — surfaced here so they aren't lost; do **not** edit those docs yet):
- The alliance monitor (`monitor.ts`) is confirmed **deleted**; the 2026-06-03 field note calling it live is stale. The only remaining rupture signals are `pattern_engaged` and `observation_miss_count`. ~5 doc surfaces still describe the monitor as live.
- The confirm path writes a `[User confirmed the checkpoint]` row on **every** confirm; the `config.ts:67` "persists nothing" comment is wrong.
- `pattern_engaged` is a **hard checkpoint gate until turn 12** (`persona-pipeline.ts:469`).
- `prompt-sections.ts` parses the assembled prompt by **header regex** — any renamed section silently drops / mis-attributes in the admin viewer until `SECTION_DEFS` is updated.

---

## 13. Retention — the leanest levers (applied-psych, 2026-06-08)

Retention is the weak point. The finding: you don't need retention *features* — the raw material
already exists and dies on the floor. No streaks / points / notifications (banned, and they'd erode
the intrinsic motivation the product runs on). Ranked by leverage:

1. **Spend the Manual in-conversation — the compounding bet, most likely to bring them back.** When
   today's situation rhymes with a confirmed entry, Jove names the connection out loud ("same move as
   the kitchen thing"). That's the moment accumulation is *felt*, and the one thing a generic chatbot
   structurally can't do. A prompt behavior, not a feature. (SDT competence; intent.md's own
   "session 5 > session 1" thesis.)
2. **Fire the open loop the session summary already captures — cheapest.** `generate-summary.ts`
   already records "what was left unresolved"; the returning-user opener only *optionally* references
   it. Make the open thread the thing the opener reaches for. Two wires already live; connect them.
   (Ovsiankina resumption tendency — not the debunked Zeigarnik memory claim.)
3. **Open the return on last session's peak.** The returning-user opener leads with the entry they
   confirmed last time, in its sharper language — so the first beat on return is the recognition they
   left on. (Peak-end.)
4. **Elicit the next thread from the user, don't prompt it.** End by getting *them* to name what's
   unfinished — a stronger return predictor than anything Jove names for them. (MI / autonomy.)

**Legitimate "surprise dopamine" = earned epistemic surprise:** the unexpected cross-entry
connection, the pattern named a layer deeper than expected, the honest open loop. Test: *if you
removed the dopamine intent, would the moment still be the right thing to say?* Cross-entry
connection — yes. Surprise confetti / randomized praise / withholding a real insight to time a hit —
no.

**Ethics flag:** variable-ratio reward lands hardest on an autistic + ADHD audience (compulsion
risk). Keep it on the right side by ensuring every "surprise" delivers real self-understanding the
moment it's true, and disengaging stays clean. This is a clinical-advisory question before shipping
anything that *deliberately* leans on variable reward.

**Don't build:** streaks / points / badges / a completeness meter, push notifications, a separate
insights tab (dead feature), or a "surprise generator." All are gamification or new systems the
conversation should carry. Levers 1–2 are prompt + the existing summary seam; nothing new to maintain.
