# First-Run / New-User Plan — mywalnut (evidence-graded)

**Status:** Plan — design to this. No app code.
**Updated:** 2026-06-16
**Method:** Mapped from the new user's side using the Mobile Behavioral Researcher framework (7 lenses + evidence grading). Every recommendation carries a grade; Established/Consensus carry a cited source (§Sources).
**Scope:** the first in-app experience for a brand-new (allowlist-invited) user — i.e. an account already exists; this is first open. Companion to `docs/redesign-plan.md`.

---

## Verdict — the right shape of the first run

**Drop the new user into a conversation, not a setup.** The first screen is one warm sentence from Jove + one focused text field + 2–3 example-situation chips + a quiet "private; nothing's saved unless you say so" line + a one-tap "how this works" escape hatch. **No** orientation carousel, **no** "how it works" steps, **no** menu of five layers, **no** empty dashboard, **no** account/permission/notification asks.

Everything a user needs to understand — it's a conversation, it reflects you back, nothing saves without your say-so, it's not a test — is taught **by doing the first exchange**, not read before it. The one hard job of the first screen is to make the very first message easy to send (Fogg: raise *Ability*, supply the *Prompt*). The "that's me" recognition moment is the activation event; the whole flow sprints toward it.

**Both prior attempts were wrong, in opposite directions:** `firstrun-orient-choose` front-loads a 3-step explainer **and** a 5-option menu (two taxes before any value); `activation-newuser`'s "Empty Home" shows a blank manual + five empty layers (a blank slate the user must decode). The right shape is **neither** — Jove's opener *is* the landing.

---

## §1 — The new user's questions, in the order they actually arise

**First glance (~3–5s):** (1) *What even is this?* [Cognition] · (2) *Who's talking — bot, person, form?* [Trust] · (3) ***What do I do right now?*** [Onboarding] — the single most important.
**Orienting (10–20s):** (4) *What's in it for me?* [Motivation] · (5) *Is this therapy / will it diagnose me?* [Trust — a named kill-signal] · (6) *Will it judge me / box me?* [Trust] · (7) *Is this a quiz/test/form?* [Cognition] · (8) *Do I have to set anything up?* [Motor] · (9) *How long will this take?* [Motivation].
**At the threshold:** (10) ***What do I type? what's a "situation"? what if I don't have one?*** [Cognition — the blank-field freeze] · (11) *Do I have to pick something?* [choice overload] · (12) *There's no wrong answer, right?* [Trust].
**As they disclose:** (13) *What happens to what I tell it?* [Trust] · (14) *Is it saving this / deciding things about me?* [Trust — the confirmation gate] · (15) *Is it actually listening?* [Trust].
**After the first beat:** (16) *What's the artifact / what do I get?* [Motivation] · (17) *Why come back?* [Re-engagement].

**Key insight:** Q1–4, 10 must feel resolved to get the first message sent. Q5–9, 12 are best **disconfirmed by the experience**, not pre-answered (pre-stating "this isn't therapy" plants the frame you're trying to avoid). Q13–17 are answered **just-in-time**, when they fire — never on an up-front wall.

---

## §2 — Sequencing (the core call)

Front-loaded education/setup measurably hurts activation; just-in-time beats up-front. **[Consensus — NN/g, *Onboarding: Skip it When Possible*; W3C COGA progressive disclosure]**

- **Before acting** (resolved by the landing, one breath): Q1 what is this · Q2 who · Q3 what do I do · Q4 why · **Q10 what to type → solved with example chips, not a blank box** (highest-leverage decision on the screen).
- **By acting** (taught through the conversation, never pre-explained): Q5/6/7 not-therapy/not-judging/not-a-quiz (disconfirmed *by Jove's behavior*) · Q15 it's listening (the first specific reflection) · Q14 the confirmation gate (surfaces at the **first checkpoint**, where it becomes true) · Q16 the artifact (when the first entry is proposed).
- **Just-in-time:** Q13 data — a single quiet reassurance **at the input**, plus a real privacy link one tap away. **[Established/Consensus — perceived privacy at the point of disclosure drives willingness to disclose, mediated by trust]**
- **Defer entirely:** Q17 retention story (can't be felt in session 1) · setup (there is none) · account, notification opt-in, sharing — all post-value.

---

## §3 — The recommended flow (design to this), step by step

**Step 1 — The landing IS Jove's opener + a live input + example chips.** Walnut mark, one warm sentence from Jove, the field already focused, 2–3 tappable example openers below it (e.g. *"A reaction that surprised me," "A conflict that keeps repeating," "A win I can't explain"*), and a quiet privacy line under the input. *Answers Q1,2,3,4,10,13.*
- Start in the product, skip the explainer — **[Consensus — NN/g *Mobile Tutorials*, *Onboarding: Skip it When Possible*]**
- Seeded chips beat a blank field; blank slates lose 40–60% of new users; "a 60%-relevant template beats a blank slate every time" — raises Fogg *Ability* — **[Consensus — empty-state activation research; NN/g *Empty States*; Fogg B=MAP]**
- One unmistakable next action = the Prompt; chips = the Ability boost — **[Consensus — Fogg B=MAP]**
- *Avoids:* the blank-field freeze and the 3–5s "what is this / what do I do" bounce.

**Step 2 — Jove's first reply reflects something specific back** (their words, one deepening move — not advice, not a label). *Answers Q5/6/7 by behavior, Q15.* Time-to-first-value is the dominant activation metric **[Consensus]**; disconfirming "is this therapy/a test" through behavior rather than disclaimer is **[Hypothesis]** (aligned with the product's kill-signals + COGA show-don't-tell). *Avoids:* the generic-chatbot "ChatGPT with a logo" exit.

**Step 3 — Just-in-time trust, only where disclosure deepens.** No separate privacy screen: the always-visible line under the input ("Private. Nothing's saved unless you say so."), with a real "how this works" / privacy link one tap away (progressive disclosure). *Answers Q13,12.* **[Established/Consensus — Joinson et al.; just-in-time privacy notices; COGA]** *Avoids:* a consent wall before value.

**Step 4 — The first checkpoint introduces the Manual + the confirmation gate *in context*.** When Jove has something worth proposing, the checkpoint card appears (a one-line articulation the user recognizes; confirm / refine / decline). *This* is where "nothing enters your manual unless you confirm" is shown — at the moment it's true. *Answers Q14,16.* **[Consensus — just-in-time over up-front, NN/g; recognition is the core activation moment per intent.md]** *Avoids:* abstract up-front promises with no payoff.

**Step 5 — Return cleanly to the conversation; defer everything else.** After confirm, Jove acknowledges briefly and continues from whatever the user surfaces next (no fork — settled product decision). No retention pitch, no sharing prompt, no notification ask in first run. *Seeds Q17 behaviorally by leaving a thread open.* **[Consensus — defer secondary asks until after first value]** *Avoids:* post-value clutter interrupting the one thing that worked.

---

## §4 — Resolved tensions

**A. Orient first, or drop straight in? → Drop straight in.** Pre-task explainers "reduce usability and should be avoided"; tutorials don't improve task performance and are quickly forgotten **[Consensus — NN/g]**. Orientation only helps for complex, non-inferable mechanics; mywalnut's mechanic (*talk, it reflects you back*) is learnable in one exchange. The only orientation that survives: one sentence in Jove's opener + a one-tap "how this works" link for the minority who want it first.

**B. A 5-layer start menu? → No. Wrong for a first-timer.** Three reasons: (1) **choice overload / Hick's Law** — decision time and abandonment rise with options; five abstract categories = five decisions before value **[Established (reaction time) / Consensus (abandonment)]**; (2) the layer names are *outputs* of the conversation, not natural entry points — asking a newcomer to self-classify is the ambiguous, abstract demand COGA says to avoid **[Consensus — W3C COGA]**; (3) it re-imposes the "is this a form/quiz?" frame you most need to avoid. **"Just explore" should be the default path, not one option among six** — realized as **2–3 concrete example chips**, not a taxonomy. The 5-layer index is right for the **returning**-user Home (v6 uses it correctly there as a quiet index of *populated* layers) — it's a re-engagement affordance, not a first-run gate.

**C. How many choices at first contact? → One primary action (send a message) + 2–3 optional seed chips as scaffolding, not branches.** Chips aren't Hick-choices — tap one or ignore all three, same destination. Net decisions to reach value: **one**. **[Consensus]**

---

## §5 — Anti-patterns to avoid

- **Onboarding carousels / swipe-through intros — [Myth]** (that they lift activation). Users swipe without reading; quickly forgotten (NN/g). The prior orient panel is a soft version — cut it.
- **Account / permission / privacy walls before value — [Consensus anti-pattern].** Account already exists (allowlist) — don't manufacture a gate.
- **Empty dashboard / blank-slate Home as the landing — [Consensus anti-pattern].** Lead with Jove's opener, not an empty Home/manual.
- **Big up-front "how it works" explainer — [Consensus anti-pattern]** (see §4A).
- **A 5-option start menu at first contact — [Consensus anti-pattern]** (see §4B).
- **"Tell us about yourself" forms / profile / quiz framing — [Consensus anti-pattern] + a named product kill-signal** (intent.md: "like therapy," "feels too much like work"). The premise is *you talk your way into it, you don't fill it out*.
- **Asserting the "come back" story in first run — [Hypothesis]** (likely neutral-to-negative). Accumulation is felt, not asserted — defer it.

---

## Build directive for design (one line)
**First-run screen = Jove's opener (one line) + a focused input + 2–3 example-situation chips + a quiet "private; nothing's saved unless you say so" line + a one-tap "how this works" escape hatch.** No carousel, no menu, no empty Home, no setup. Everything else is taught by the conversation and surfaced just-in-time. The 5-layer index belongs to the *returning*-user Home.

## Two claims worth A/B-testing in beta (currently [Hypothesis], not Consensus)
1. Disconfirm "is this therapy?" by Jove's behavior rather than a disclaimer.
2. Asserting the retention/"come back" story early is neutral-to-negative.

## Sources
- NN/g — [Onboarding: Skip it When Possible](https://www.nngroup.com/videos/onboarding-skip-it-when-possible/) · [Mobile Tutorials: Wasted Effort or Efficiency Boost?](https://www.nngroup.com/articles/mobile-tutorials/) · [Mobile-App Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/) · [Onboarding Tutorials vs. Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials/) · [Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Fogg Behavior Model (B=MAP)](https://www.behaviormodel.org/)
- Laws of UX — [Hick's Law](https://lawsofux.com/hicks-law/) · [Choice Overload](https://lawsofux.com/choice-overload/) (Hick & Hyman, 1952)
- W3C COGA — [Use Literal Language](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p04-literal-language/) · [Cognitive & Learning Disabilities + WCAG](https://w3c.github.io/coga/extension/index.html)
- Joinson et al. — *When is trust not enough? Perceived privacy & comfort with self-disclosure* ([ResearchGate](https://www.researchgate.net/publication/222249851_When_is_trust_not_enough_The_role_of_perceived_privacy_of_communication_tools_in_comfort_with_self-disclosure))
- [Just-in-time privacy notices — Michalsons](https://www.michalsons.com/blog/just-in-time-privacy-notices/69587)
