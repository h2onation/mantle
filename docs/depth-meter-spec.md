# Depth Meter — spec (proposal, for review)

> **Status: proposal. Not canonical.** Replaces the Jove-initiated checkpoint *trigger* with a user-pulled, depth-gated "moment." The saved artifact (an **Entry** on a **Layer**) and the confirm overlay are unchanged. Needs founder sign-off before any code or doc lands. Companion artifact: `docs/mockups/depth-meter-mockup.html`.

## 1. In one line

A quiet progress hairline in the chat fills as the conversation deepens. When it completes, the **user** — not Jove — chooses to reflect and build a saved moment. The auto-dropped checkpoint card goes away.

## 2. Why this is cheap to build (cost label)

The bar visualizes a signal the system **already computes every turn**: the extraction `depth` ladder (`surface → behavior → feeling → mechanism → origin`) and the checkpoint gate (`concrete_examples ≥ 2`). Already flagged internally as `checkpoint_ready` when `depth ≥ mechanism` **and** `concrete_examples ≥ 2`.

- **What consumes its output:** the user (a visible readiness cue) + the new "build a moment" affordance.
- **What it costs to run:** no new model call, no new table, no new prompt rule. We surface existing numbers to the client.
- **What it overlaps:** it *replaces* the server-side "Jove writes a transition line → auto-compose → card drops" trigger. Net complexity is neutral-to-down (we remove an auto-trigger path; we add a client meter + an on-demand compose call).
- **Deletion condition:** if extraction depth scoring is ever removed, the bar goes with it.

## 3. The mechanic — before / after

**Before:** Jove decides → writes hidden `I want to put something in your Manual` → server composes entry → brass trigger card auto-drops into chat → overlay → confirm.

**After:** conversation deepens → bar fills from extraction depth → at full (mechanism + a concrete scene) the bar blooms a quiet affordance → user taps **Build this moment** → server composes the entry *on demand* → the **same** plate overlay → confirm → saved → bar empties and rebuilds.

Jove no longer drops cards unbidden, and **does not narrate the bar** (no "looks like we went deep — want to save?"). The meter carries the signal silently; Jove keeps talking. This is a strict win for *user-is-the-author*: the user now owns the moment of capture.

## 4. What fills the bar

The system's existing **two-part gate**, shown honestly:

- **Depth rung** — `surface → behavior → feeling → mechanism`. The bar climbs one notch per rung.
- **Concrete scene** — it only *completes* (unlocks the affordance) when there are `≥ 2` concrete examples behind it. So the bar can sit at ~90% ("there's a read, but no scene yet") and finish only when a real moment has been walked through. This blocks a "full but hollow" save.

**It can ebb.** If the user withdraws or changes topic, extraction depth recedes and so does the bar — gently, never with a "you lost progress" callout. Silence is processing.

## 5. The bar — visual language

On-brand = **hairline + brass, in the metadata register.** Not a chunky candy progress bar.

- A 2px track in `--session-hair-soft`; a brass fill (`--session-walnut-light → --session-walnut`) grows left→right.
- Near-invisible at `surface`; earns presence as it fills; a soft brass glow appears **only** near full.
- **No segments.** Segments read as gamification — against our "no streaks / no nudges" rule.
- **No persistent text label** (no machine-narration). An optional 10px mono `READY` whisper appears only at completion.
- At completion: one brass **strike / shimmer** (echoes the checkpoint brass-rule strike), then the affordance fades up.
- Respects `prefers-reduced-motion` (state change only, no creep/glow).
- A11y: `role="progressbar"` + `aria-valuenow`; the ready state is also carried by the affordance's text + button, never by color alone.

## 6. Placement — LOCKED: Tide (top)

The meter is a **full-bleed hairline under the TopBar divider** (the "Tide line"). Decided 2026-06-18 — the reading-progress position keeps the composer clean and gives the deferred-state handle (§7) a natural home at the top. The earlier "Composer pulse" (bottom) option is dropped.

Theme: the mockup is committed to **Bloom (light)**. The meter is token-based, so Hearth inherits automatically when both themes ship — but Bloom is the reference skin for sign-off.

## 7. The full-state affordance + the "moment"

Impact through restraint. The first offer is **one compact bloom above the composer** — no eyebrow, no redundant label:

> ❦ (brass fleuron) · *There's something here worth keeping.* (Instrument Serif, the hero line — direct, not flowery) · **Build this reflection →** (solid deep-brass button, white text) · *Not yet*

- We cut the `READY TO REFLECT` mono eyebrow and the divider rule — they said the same thing as the serif line. One mark, one line, one button.
- **The button is a solid brass fill (`#7A5A1E`, the brass-deep token value) with white text** — clears ~7:1. Note: a filled button must set its background **inline**; class-level background gets clobbered by the host/global button reset (this bit us twice — the button kept rendering transparent).
- **"Not yet" → a narrow strip at the very top, by the meter:** `❦ A reflection's ready — Tap to build it →`. The strip's position and slide-in mark where the moment went; the copy names the action.
- **The strip persists** (founder, 2026-06-18). Once a moment is ready, the option stays available at the top until the user builds it — it does **not** recede if the conversation drifts. Tapping the strip goes **straight to the output** (compose + overlay), not back to the bloom. (Requirement #1.)
- **Sending another message while the bloom is up collapses it to the strip** — talking on is an implicit "not yet," so the bloom never blocks the composer. The option simply moves to the persistent top strip.
- Tapping Build **reuses the existing `CheckpointOverlay` verbatim** — the plate, read/edit/confirm, the "Added to Layer N" cover. We are **not** redesigning the overlay; we change only what triggers it. (Removal-first: reuse, don't rebuild.)

## 8. Reset / loop

- **Ready latches.** Once the meter completes, the moment stays available — as the bloom, or (after "Not yet" or another message) as the persistent top strip — until the user builds it. It does not expire or recede on its own (founder, 2026-06-18). This removes the earlier "abandonment recede" logic — simpler, and it keeps the option there.
- **On save (build → confirm):** the bar **starts over** — resets to empty and rebuilds as the conversation keeps going. We reuse the existing post-checkpoint cooldown so it can't instantly snap back to full; it climbs again as new understanding accrues. The saved entry and Jove's brief acknowledgment render via the **existing post-checkpoint behavior** — no new "receipt" UI (founder: "use what it has now, piped into the flow").
- **On discard (in the overlay):** the material is still ripe; the strip stays, so the user can pull a fresh framing.

## 9. Safety

During crisis signals the bar **hides entirely** and no affordance can appear — the extraction layer already suppresses readiness in crisis; the bar inherits that. No "build a moment" while someone is in crisis.

## 10. Terminology — DECIDED: "Reflection" (2026-06-18)

The user-pulled ritual is named a **Reflection** ("Build this reflection" / "A reflection's ready"). **Entry** (the saved artifact), **Layer**, and **Manual** are unchanged — a Reflection produces an Entry. "Checkpoint" is retired to internal/deprecated (the dormant Jove-pushed path).

Needs a `rules.md` amendment, flagged for the founder to ratify (not mine to make):
- `rules.md` Terminology lists "**reflection card**" among banned synonyms for Checkpoint. "Reflection" as the user-pulled ritual name is a different, deliberate term — amend the entry to bless "Reflection" and drop "reflection card" from the ban.
- Voice/Marketing guardrails ban *therapeutic/clinical* register. "Reflection" reads as the user's own act (self-reflection, user-as-author), not a service Jove performs — keep the surrounding copy plainly non-clinical so it stays on the right side of that line.

## 11. Build implications (plain language)

- **Front-end (the mockup):** the meter, the bloom affordance, the reset. Small; lives in `MobileSession`.
- **Plumbing:** pass the already-computed `depth` + `checkpoint_ready` + example count to the client each turn (today only a few of these reach the client).
- **Backend (the real work):** composition currently fires when Jove decides. Under user-pull it must fire **on demand** when the user taps "Build this moment." That's a new compose-on-request path (or a repurpose of the existing checkpoint compose). This is the one non-trivial backend change and where an estimate would sit.
- **Out of scope:** redesigning the overlay, the Manual page, or extraction. Untouched.

## 12. Open decisions for you

1. ~~Placement~~ — resolved (§6): **Tide (top), Bloom skin.**
2. ~~Naming~~ — resolved (§10): **"Reflection."** Pending `rules.md` amendment (founder to ratify).
3. ~~Affordance copy~~ — resolved: **"Build this reflection"** / strip **"A reflection's ready — Tap to build it →."**
4. ~~"Not yet" behavior~~ — resolved (§7–8): collapses to a narrow `❦ A reflection's ready — Tap to build it →` strip at the top; bar stays full; recedes only if the thread is abandoned.

## 13. Implementation plan (senior-engineer audit, 2026-06-18)

Grounded in the real pipeline. Heavy reuse; one real backend change; one mechanical defect fix. Gated behind a `depth_meter` feature flag so it's reversible.

### The load-bearing finding (drives requirement #2)
Composition (`composeManualEntry`, `confirm-checkpoint.ts`) reads only the **last 8 messages** of literal transcript (`conversationHistory.slice(-8)`), plus a cumulative "understanding brief" (`depth` / `sageBrief` / `currentThread`) and the last 10 charged phrases (`languageBank`). So composing at pull-time is *not* automatically "the whole thread" — if the user defers and talks 20 more turns, the literal scenes that earned the moment slide out of the 8-message window. The brief/language-bank partially rescue it, but the concrete scenes can fall out.
**Fix (mechanical, ~1 line + a constant + a test):** widen the window to a **50-message cap** (founder, 2026-06-18) so the earning scenes stay in. Not unbounded — a 200-message thread would bloat the compose call toward the Vercel edge timeout. See decision (a) below.

### What gets built
1. **Surface two signals to the client** (no new model call, no table): add `depth` and `checkpointReady` to the `message_complete` SSE event. Both are already computed server-side — `depth` lives in the extraction state; `checkpointReady` **reuses `validateMaterialQuality(...).ok`** (the exact predicate the old path uses — we do NOT write a second "is it ready" formula; two diverging gate formulas caused the 2026-06-03 incident). Fill = function of `depth`; completion = `checkpointReady`.
2. **Client state machine** in `MobileSession` — two booleans (`momentDeferred`, `momentComposing`), no library. States: `filling → ready/armed (bloom) → deferred (top handle) → composing → overlay`. Requirement #1 is structural: the handle tap calls the **same handler** as "Build this moment" — straight to compose + overlay, with no code path back to the bloom.
3. **One new endpoint `POST /api/checkpoint/compose`** — composes on demand by **reusing** `composeManualEntry` + `loadConversationContext` + `buildCheckpointMeta` (no duplicated compose logic). It writes the same `is_checkpoint` message row the old path writes, so the **existing confirm route + CheckpointOverlay are reused verbatim** — they don't care whether the checkpoint was Jove-pushed or user-pulled. Net AI-call volume goes **down** (today composes on every Jove proposal incl. discarded ones; new path composes only on actual pulls).
4. **Turn off the Jove auto-trigger** behind **one combined switch** (founder, 2026-06-18 — the existing `checkpoints` gate flips to the new behavior rather than adding a second `depth_meter` flag). Go dormant, don't delete (rollback per the `LIVE_VOICE_VARIANT` precedent). **Care point:** also suppress the Tier-3 "propose the checkpoint" prompt lines, or Jove keeps writing "I want to put something in your Manual" with nothing behind it — dangling text in chat. Once the meter proves out, a follow-up `/overbuild-check` harvests the now-dead split-delivery + acknowledgment + suppression-strip machinery.
5. **Reuse the post-checkpoint behavior** (founder: "use what it has now, piped into the flow"). After a user-pulled save confirms, the existing post-checkpoint Tier-3 acknowledgment and the confirmed-entry Plate fire exactly as today — the confirm row is identical, so this works with no new UI. Jove still **never proposes** (the trigger is off), but it still **acknowledges** a save, as it does now.

### Post-pull lifecycle (founder, 2026-06-18)
- **Ready latches; the strip persists.** Once ready, the option stays (bloom → strip) until built. We do **not** recede on drift — this *removes* the abandonment logic the audit had proposed. Client holds a `momentReady` latch set true when `checkpointReady` first goes true; it clears only on a confirmed save.
- **Deferred tap → straight to compose+overlay** (shared handler with Build; no path back to the bloom). Sending another message while the bloom is up collapses it to the strip.
- **On save → start over.** Reset the visual meter to empty on confirm; reuse the **existing post-checkpoint cooldown** so readiness can't immediately re-latch; it rebuilds as new depth accrues. Post-save acknowledgment + the saved entry render via the **existing post-checkpoint behavior** — no new UI.

### Edge cases (handled with existing signals)
- **Crisis** → `validateMaterialQuality` already returns false in crisis, so `checkpointReady` is false → no affordance, for free. Plus one boolean to **hide the meter entirely** (spec §9), and clear the `momentReady` latch if crisis begins after a defer (the strip must not sit over a crisis). Needs a real test (highest-stakes path).
- **Anonymous first-checkpoint conversion** → the compose endpoint **must replicate** the anonymous-count gate that lives in `/api/chat` today, or an anon user burns a compose call before the signup wall fires. Easy to forget — flagged must-fix.
- **Compose fails** → close overlay, keep meter full + strip, brief error, user re-taps. No silent auto-retry (it's an Opus call).
- **Discard in overlay** → material is still ripe; strip stays so they can pull a fresh framing.
- **Tap during a streaming Jove turn** → gate the handler on `!isStreaming` (reuses the existing flag).
- **Which layer** → `composeManualEntry` already chooses the layer; the meter is layer-agnostic. Don't pass it one.

### Do NOT build (anti-overbuild)
No thread-segmentation. No readiness/meter table (derive from the extraction state already persisted). No second compose path. No second readiness formula. No surfacing raw gate sub-counts for a cosmetic fill effect.

### Open engineering decisions
- **(a) Composition window — DECIDED 2026-06-18: cap at 50 messages.** Named constant tied to this requirement, with a test asserting a ready-point scene ~25 messages back survives into the compose input. Must **load-test** a long, deep conversation before trusting (50 messages × deep prose is a real input size against the edge timeout); if it proves marginal, fall back toward the brief for older depth. Fidelity-over-narrowness, bounded for reliability.
- **(b) Compose endpoint returns JSON, not SSE.** No Jove turn rides along, so streaming buys nothing and SSE is where the timeout class bites. The overlay's existing `composing` phase covers the wait. (Internal call — recommend JSON.)

## 14. Build status — as shipped (2026-06-18)

Implemented behind the `reflection_meter` feature gate (**defaults OFF, fails closed**), so production is byte-for-byte unchanged until an admin flips it on (Admin → Feature gates → "Reflection meter"). No migration needed — the table has no key constraint, the admin route upserts the row on first toggle, and the read fails closed to OFF.

**Files:** `feature-gates.ts` (gate) · `persona-pipeline.ts` (`reflectionMeterEnabled`; `checkpointsEnabled = checkpoints && !reflectionMeter`) · `call-persona.ts` (emit nullable `reflectionMeter` signal, crisis→null; transition-line backstop) · `confirm-checkpoint.ts` (`checkpointText` optional + framing swap; window 8→50) · `api/checkpoint/compose/route.ts` (new) · `auth/anon-checkpoint-gate.ts` (new shared gate, consolidated out of `api/chat`) · `rate-limit.ts` (compose limiter) · `useChat.ts` + `MobileSession.tsx` + `MainApp.tsx` (meter/strip/bloom + signals) · `FeatureGatesPanel.tsx` (admin toggle).

**Verification:** `npm run build` green; full suite 1174 passing (added a composer-framing test + updated the gate tests). Senior-engineer change-review: no blockers; gate-OFF invariance, the latch/reset race, and the compose endpoint all verified. Added during review: the compose endpoint is idempotent against double-taps (returns the existing pending row), and the anonymous conversion wall is now a single shared helper.

**One gate BEFORE enabling in production** (cannot be unit-tested; needs a real run + a human safety call):
1. **Crisis defer→crisis** integration test + safety sign-off on the one-turn extraction lag: the meter/strip hide on `reflectionMeter: null`, but that reads from `previousExtraction`, so there's a one-turn window on the exact turn crisis first surfaces (pre-existing pipeline behavior; spec §9 calls this the highest-stakes path).

**Resolved (2026-06-18): the 50-message compose is NOT a timeout risk.** 50 mobile messages ≈ 3–7k tokens; compose latency is output-bound (~15–20s to generate the entry), the same profile as today's Jove-pushed checkpoint that already ships in production — independent of the transcript window. The window size barely moves latency, so no load-test gate and no window trim is needed. The only tail input is a large pasted Upload; that's bounded by `MAX_UPLOAD_LENGTH` (16k chars) and the ~50-message sliding window, both unchanged. Caps left as-is (founder, 2026-06-18) — sized against the 200k context wall.
