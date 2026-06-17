# Front Door Redesign — Living Plan

> **⚠️ SUPERSEDED FOR EXECUTION (2026-06-17).** All open questions are now resolved and the file-level build plan lives in **`docs/redesign-migration-plan.md`** (decisions locked — see its §11). This doc remains the narrative origin (what/why/conflicts) but is no longer the live build reference. Where the two disagree, the migration plan wins. Stale framings retired here on 2026-06-17: "Crisis ≤1 tap unsolved / gates Phase 2" (the ≤1-tap requirement was never documented — Crisis lives in Settings, 2 taps; the real safety net is Jove's in-conversation Crisis Protocol) and "Manual default = expanded" (now collapsed).

**Status:** Superseded for execution — see `docs/redesign-migration-plan.md`.
**Updated:** 2026-06-17
**Design source of truth:** `mockups/frontdoor-prototype-v6.html` (clickable: Home → Manual → Chat). Earlier explorations and the 3 manual-layout options live alongside it in `mockups/`.

This doc is the working plan for taking the prototyped front-door redesign into the real app. It captures what we're building, what's already decided, where the design conflicts with the current app, the phased build order, and the open questions still to settle. We refine this as we go; nothing here is built until the phase is approved.

---

## 1. What we're building (the short version)

A mobile-first redesign of the app's "front door" and the screens behind it:

- A real **Home** screen as the landing (today login drops straight into chat). It greets you, lets you **continue your last conversation** or **bring a new situation**, shows **your manual as an index** (the five layers, each a quiet "go deeper with Jove" tap), and offers to **share** your manual.
- The **Manual** as a calm, collapsible reading view — each layer a section of clean entry cards (with an explicit Edit control), and one place to read the whole thing.
- The **Chat** cleaned up — no "Jove" title bar, no colored rule on Jove's bubbles, and conversations that can open **scoped to a specific layer**.
- A warm visual identity: **warm-white** background, **brown = you**, **navy = Jove**, a display font for headings, a serif for your own words.
- A persistent **bottom navigation** (Home · Manual · Talk · You) and one **consistent logo header** across screens.

---

## 2. Decisions locked

| Decision | Choice | Why |
|---|---|---|
| **Dark mode** | Retune the **light** theme to the new palette now; leave **dark unchanged** for a later pass | Light is the default, so the new look reaches almost everyone immediately; no risky teardown |
| **Guided intake + Upload** | **Keep reachable** as secondary entry points | They're shipped beta features; don't silently remove them |
| **Manual editing** | **Keep**, behind an explicit "Edit" control on each card | Preserves a working feature without cluttering the read view |
| **Back button (mobile)** | **Removed** from Manual + Chat | The persistent bottom nav already provides the way back; back arrows are only for true drill-down pages |

**Two consequences of "light now, dark later":**
- In light you'll get brown=you / navy=Jove; **dark keeps walnut/sage** until the later pass — the two themes diverge for a while. Expected.
- **Fonts aren't theme-specific** — new fonts apply to *both* themes. So dark would temporarily show new fonts on the old dark palette. Flag, not a blocker.

---

## 3. What already exists — and what's overstated (senior-reviewed 2026-06-16)

The redesign reuses more than it builds, but the first planning pass over-stated several claims. Verdicts:

- **Resume your last conversation — TRUE.** The app auto-loads your most recent thread on init (and re-activates a pending checkpoint). "Continue this thread" reuses it. *Caveat:* resume is automatic-on-load today, not a button — making Home the landing inverts that control flow (= conflict #1).
- **Inline entry editing — TRUE.** The edit + save API path exists; keeping it behind a per-card Edit control is a re-skin.
- **Removing Jove's bubble rule — TRUE (one line).** It's a **brass/walnut** rule (the `--session-jove-rule` token, brass in light / transparent in dark), *not* blue — rebinding it to transparent in light removes it in one place.
- **Layer-scoped conversations — PARTLY TRUE (the big correction).** The mechanism exists (`startExploration` → exploration prompt block), but only for an **entry** or an **empty layer**. Home's primary action launches "go deeper" from **populated** layers (4 of the 5), and there is no type for that — the empty-layer prompt literally tells Jove the layer "is empty," so firing it on a populated layer makes Jove contradict the user's own Manual. So Home's main affordance is **new engine + prompt work**, not re-wiring → pulled out as **Phase 0**.
- **Share / PDF export — PARTLY TRUE.** A client-side PDF + native share-sheet exists. But the mockup's "Create a shareable version / a page you control" implies a **hosted link**, which is **net-new** (and triggers the UUIDv4-token security rule). PDF-vs-hosted is open question Q6.
- **Colors centralized / "~98% token-driven" — PARTLY TRUE / unverified.** Tokens are centralized per-theme and most components read them, but "98%" was a vibe, not measured: components carry inline `rgba()`, the share tile in the mockup is raw hex, and the token-discipline test only guards admin. The repaint is concentrated *for tokenized values*; the new front-door components will introduce fresh literals with nothing enforcing tokens.

---

## 4. The conflicts (where the design meets the current app)

These are the friction points the planning agents confirmed against the real code.

1. **No Home screen today.** Login lands on chat; there's no "home" view and the app auto-resumes your last thread in the background. Adding Home as the default means untangling "continue vs. start fresh."
2. **Navigation is a slide-out drawer, not a bottom bar.** The drawer holds **session list, Settings, Log out, and Crisis support**. Retiring it isn't just "remove a panel" — it orphans the left-edge **swipe gesture** and an `onOpenDrawer` prop threaded through ~5 components + the TopBar menu glyph (all dead code to remove). Crisis support currently lives in the drawer footer; retiring the drawer means it needs a new home. **RESOLVED 2026-06-17:** Crisis becomes a row under "You"/Settings (2 taps), not a header button and not on Home. The "≤1 tap" framing earlier in this doc was an unfounded assumption — `rules.md`'s documented Crisis Protocol governs Jove's *in-conversation* behavior (the real, zero-tap safety net); there is no documented one-tap requirement for the static link. Not a phase gate. See migration plan §5/§11.
3. **Color *meaning* changes.** Today one warm "walnut" runs throughout and sage/brass marks Jove. The new design assigns **brown = you, navy = Jove**. Applying the values is mechanical; deciding the mapping is the brand call.
4. **Fonts aren't centralized.** The look depends on new typefaces, but there's no single "display font" seam: the `--font-display` slot is **defined but unused**, and headings actually run on `--font-serif` + `--font-spectral` across ~44 files (and `--font-spectral` feeds the **checkpoint** text — Jove's most sensitive surface). Adopting a display face = a multi-file repoint + a spacing check, not one variable. Applies to both themes.
5. **Manual is interactive today** (editable entries, per-entry "explore"); the new design is read-first. We keep editing behind a control and move "go deeper" to the layer level.
6. **"Added from a conversation" provenance** isn't shown today; the date exists but a conversation *name* (e.g. "the dishwasher conversation") doesn't. No migration needed for the month version.
7. **Desktop** uses a sidebar, not a bottom bar. Mobile-first this round — but adding `home`/`you` to the shared view enum **won't compile** until the desktop shell is given a decision for them (even "redirect to session/settings"). So the desktop call moves into Phase 2, not Phase 5. (TypeScript catches this — it fails loudly, doesn't silently break.)
8. **Reverses *and contradicts* current rules.** `docs/rules.md` still says "**Two themes ship. Hearth (dark, default)** … every new component must work in both" — but the code default is **light**, and "light now, dark later" knowingly ships front-door components that look right only in light. The new ADR must **supersede both** the dark-default claim and the "works in both" clause (not just ADR-034). Also fix the stale `globals.css` `:root` "Dark mode (default)" comment.

---

## 5. Phased build plan

Each phase is verified before the next; the shape of each is confirmed with Jeff first. **(Phase 0 added on senior review — Home's main action depends on it.)**

**Phase 0 — Engine: populated-layer "go deeper."** Add a new exploration type for an already-started layer (`ExplorationContext` today only has `entry` / `empty_layer`), a new branch + opener variant in the prompt, and an analytics entry-point value (`startExploration` currently mis-reports `entry_point:"situation"` and the enum has no `"explore"`). This is behavioral-chat work governed by the voice rules + soak-governance, so the opener wants `/evaluate` or human review, not just a green build. **Must land before Phase 3** (Home's layer rows fire this).

**Phase 1 — Foundation.** Retune the light-theme tokens (warm-white / brown=you / navy=Jove); the consistent logo header (kept separate from the onboarding/login header); and the font change — which is a **heading-font-var audit + repoint across ~44 files** (pick the seam among `--font-serif` / `--font-spectral` / the dead `--font-display`), then load the display face. *Gated by: Fonts (Q2).*

**Phase 2 — Navigation (heaviest).** Mobile bottom nav (Home · Manual · Talk · You); make **"You" a real screen** (Settings, account, log out, session history); **solve Crisis ≤1 tap concretely** (a persistent affordance, or ratify 2-tap); retire the drawer **and its dead code** (swipe gesture, `onOpenDrawer` chain, TopBar menu); and give the desktop shell a decision for the new `home`/`you` views (or it won't compile). *Gated by: Navigation/You + Crisis (Q1).*

**Phase 3 — Home.** New landing reusing resume / **Phase-0 scoped-exploration** / share; "Bring a situation" primary, Guided intake + Upload secondary. *Gated by: Phase 0, Continue-hero (Q3), Talk behavior (Q4).*

**Phase 4 — Manual.** Collapsible read-cards + provenance + the Edit control + layer→scoped chat. *Gated by: per-entry explore (Q5), plus the smaller collapse/provenance calls.*

**Phase 5 — Chat.** Remove the Jove rule, logo header + context subtitle, wire scoped openers, restyle the checkpoint (keep the confirm overlay), shrink the empty state.

**Phase 6 — Docs + ADR.** Update intent/state/decisions; write the ADR that supersedes the reversed decisions.

---

## 6. Open questions

Plain-language, with options and trade-offs. **Big calls** shape phases; **smaller calls** have a recommended default you can just confirm.

### Big calls

#### Q1 — Navigation: what does "You" hold, and where do past conversations and Crisis live? *(gates Phase 2)*
**What it is:** The bottom bar has four spots: Home, Manual, Talk, You. Today a slide-out menu holds your **past conversations**, **Settings**, **Log out**, and the **Crisis support** link. We need to decide where each lands. Crisis must always be reachable in one tap (safety).
- **Option A — "You" = your account; conversations live under "Talk." (Recommended.)** "You" holds Settings, account, log out, and Crisis. Your list of past conversations appears when you open "Talk."
  - *Pros:* clean meaning — "You" is about you, "Talk" is about conversations; Crisis sits in a fixed, predictable place.
  - *Cons:* a "recent conversations" view under Talk is a new little screen to design.
- **Option B — "You" holds everything,** including the conversation list.
  - *Pros:* one place for all "my stuff."
  - *Cons:* "You" gets crowded; a conversation list feels odd under an account tab.
- **Option C — keep the slide-out menu *and* add the bottom bar.**
  - *Pros:* least change; nothing moves.
  - *Cons:* two navigation systems at once — clutter, and it defeats the point of the bottom bar.
- **Recommendation:** A — **but the real unsolved piece is Crisis ≤1 tap.** It's not one of the four tabs, and "under You" is two taps. We need a concrete answer before Phase 2: either a **persistent Crisis affordance** (e.g. a small always-present header button = one tap from anywhere), or accept **2-tap-under-You** and explicitly ratify that against the safety rule. "A fixed affordance" is the intent; pick the actual mechanism.

#### Q2 — Fonts: which display typeface, and how far does the font change go? *(affects Phase 1)*
**What it is:** The design's character comes largely from its fonts: a bold **display** font for headings, a clean **sans** for buttons/labels, a **serif** for your own words, and a **mono** for tiny labels. Today's app uses different fonts. Fonts apply to both light and dark.
- **Option A — Commit to the new font set (Recommended), and pick the display face:**
  - *Fraunces* — warm, literary, "a book about you." (This is what the v6 prototype uses.)
  - *Bricolage Grotesque* — sharper, more modern/product. (Used in the earliest Home mockup you liked.)
  - *Pros:* the design only looks "designed" with these fonts; coherent identity.
  - *Cons:* touches text everywhere (both themes); needs a spacing/size check so nothing shifts. **And there's no single "display font" setting today** — the display slot is unused and headings run on two *other* font variables across ~44 files (one of which feeds the checkpoint text), so this is a multi-file repoint, not one switch.
- **Option B — Change only the colors for now, keep today's fonts.**
  - *Pros:* lowest risk.
  - *Cons:* it won't actually look like the mockups you approved.
- **Recommendation:** A, with **Fraunces** as the display face — it fits "owner's manual / self-understanding" warmth better than the techier Bricolage, and it's already what the agreed v6 uses. (Taste call — easy to A/B.)

#### Q3 — "Continue where you left off" for brand-new users *(Phase 3 detail)*
**What it is:** The Home hero shows a snippet of your last conversation and a "Continue" button. New users have no last conversation, and even returning users don't always have a summary ready.
- **Option A — Conditional hero (Recommended):** show "Continue" only when there's a thread to resume; for new users the hero becomes a warm first-time prompt ("Let's start — bring something that's on your mind").
  - *Pros:* never shows an empty or broken hero.
  - *Cons:* two hero states to design.
- **Option B — Always show the hero;** if there's no summary, use the conversation's first line.
  - *Pros:* simpler.
  - *Cons:* can look thin or odd.
- **Recommendation:** A. (Happy to just build this if you trust the call.)

#### Q4 — What does the "Talk" tab open? *(Phase 3 detail)*
**What it is:** With no back buttons, tapping "Talk" needs a predictable result: resume your current conversation, or start fresh?
- **Option A — Resume if a conversation is active, otherwise start a new "situation." (Recommended.)**
  - *Pros:* matches "pick up where I was."
  - *Cons:* need to handle a pending checkpoint gracefully.
- **Option B — Talk always starts fresh.**
  - *Pros:* totally predictable.
  - *Cons:* loses your place; annoying if you're mid-thread.
- **Recommendation:** A.

#### Q5 — Manual: keep per-entry "explore," or only layer-level "go deeper"? *(Phase 4)*
**What it is:** Today each entry inside the Manual has an "Explore further with Jove" button. The new design moves "go deeper" up to the layer level (tapping a layer on Home opens a scoped chat).
- **Option A — Layer-level only; the Manual stays a clean read. (Recommended.)**
  - *Pros:* simpler; matches the design (Manual = read, Home = act).
  - *Cons:* lose the shortcut to deepen one specific entry.
- **Option B — Keep both.**
  - *Pros:* more ways to deepen.
  - *Cons:* clutters the read cards; duplicates the "go deeper" idea.
- **Recommendation:** A.

#### Q6 — Share: the existing PDF, or a hosted "page you control"? *(Phase 3 / Manual)*
**What it is:** The share card says "Create a shareable version… a page you control." Today's share is a **PDF + your phone's share sheet** — a file you send. "A page you control" implies a **hosted link** someone opens in a browser (and you could revoke).
- **Option A — Reuse the existing PDF/share-sheet for now. (Recommended for v1.)**
  - *Pros:* already built; ships now; nothing new to secure.
  - *Cons:* the copy ("a page you control") has to be reworded to match a PDF.
- **Option B — Build a hosted shareable page.**
  - *Pros:* matches the aspiration — revocable, view-controlled.
  - *Cons:* net-new feature (hosting + access control + UUIDv4-token links per the security rules) — its own project, not part of this redesign.
- **Recommendation:** A for this redesign; treat the hosted page as a separate initiative, and soften the card copy to match the PDF.

### Smaller calls (recommended defaults — confirm or override)

- **Manual default state:** ~~expanded~~ → **collapsed** (DECIDED 2026-06-17; overrides the earlier "expanded" rec — matches the v6 prototype and the locked copy direction).
- **Provenance text:** "added from a conversation · {month}" (we have the date) vs naming the conversation (needs data we don't store). *Rec: the month version for v1.*
- **Checkpoint:** keep the full-screen confirm overlay (it carries edit / refine / decline), just restyle the in-chat card to match. *Rec: yes — don't lose those actions.*
- **Desktop:** mobile-first this round; desktop keeps its sidebar and we just ensure nothing breaks. *Rec: yes.*
- **"Go deeper" on a layer that already has entries:** the engine has scoped openers for empty layers and single entries; "add more to a started layer" needs a small new prompt variant (governed by the voice rules). *Rec: add it; minor prompt copy.*
- **Color token names:** rebind the existing tokens' *values* in the light theme (the Jove token → navy, the walnut token → brown) without renaming them, to keep the change small and dark intact. *Rec: rebind now, revisit naming later.*
- **Token-discipline test:** today it only guards the admin screens; leave the new front-door surfaces out of it for now. *Rec: yes for now; revisit.*

---

## 7. Decision log

- **2026-06-16** — Light theme retuned now, dark deferred. Guided intake + Upload kept as secondary. Manual editing kept behind an Edit control. Mobile back button removed (bottom nav handles return). Holding on code; planning continues.
- **2026-06-16 (senior review)** — Pressure-tested the plan vs the codebase. Added **Phase 0** (populated-layer exploration = new engine + prompt work, not re-wiring). Flagged **Crisis ≤1 tap as unsolved** (safety; gates Phase 2). Corrected reuse claims (share = local PDF, not a hosted page; fonts = ~44-file repoint; "98% tokenized" = unverified). Noted `rules.md` theme-default drift + the "works in both" clause to supersede in the new ADR.
- **2026-06-17 (file-level migration plan built + senior-reviewed; decisions locked)** — Four planning agents grounded the build against the code → `docs/redesign-migration-plan.md`; senior-engineer pressure-tested it (3 blockers folded in: Crisis inventory, the font swap was ~20× under-scoped, theme-rule sequencing). **Decisions:** (1) "You" = relabel of Settings (enum gains only `home`); (2) Crisis = a row under "You" (2 taps), no header button, not on Home — the "≤1 tap" gate was unfounded and is retired; (3) heading font = **Fraunces** via a dedicated `--font-display` token (the font swap is an untangling of the overloaded `--font-spectral`, not a 44-file repoint); (4) Manual **collapsed** by default; (5) brown/navy applied globally (desktop chrome handled in the next desktop pass — no neutral exception layer); (6) **light-only for now** (code already defaults to light; `rules.md` theme line corrected). Corrected stale code refs: `EntryCard.tsx`→`EntryItem.tsx`; the duplicated inline `ExplorationContext` at `route.ts:38`; `EntryPoint` fix = break the alias. Execution begins from the migration plan.

---

## 8. Notes & references (for implementation)

- **Prototype:** `mockups/frontdoor-prototype-v6.html`. Manual-layout options explored: `mockups/manual-fresh-A-cards.html` (chosen — folded into v6), `-B-sections.html`, `-C-tabs.html`.
- **Key files by area** (from the conflict-mapping pass):
  - Entry/Home: `src/components/MainApp.tsx`, `src/components/layout/MobileLayout.tsx`, `src/lib/hooks/useChat.ts`, `src/components/mobile/MobileSession.tsx`.
  - Navigation: `src/components/mobile/SessionDrawer.tsx`, `src/components/shared/TopBar.tsx`, `src/components/desktop/*`.
  - Design system: `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/hooks/useTheme.ts`, `src/lib/design-tokens.test.ts`.
  - Manual: `src/components/mobile/MobileManual.tsx`, `src/components/mobile/manual/*`, `src/lib/manual/layers.ts`, `src/lib/types.ts` (`ExplorationContext`).
  - Chat: `src/components/mobile/MobileSession.tsx`, `src/components/shared/Bubble.tsx`, `src/lib/persona/system-prompt.ts` (exploration block).
- **Docs to update at Phase 6:** `docs/intent.md` (on-ramps), `docs/rules.md` (two-themes claim, dead features), `docs/state.md`, `docs/decisions.md` (new ADR superseding ADR-034 + the theme decision). Stale comment to fix: `globals.css` `:root` is labeled "Dark mode (default)" but light is the actual default.
- **Engine note:** a populated-layer "go deeper" opener is a prompt change — must follow the voice rules in `docs/rules.md` and the soak-governance discipline (no new rule without a recurring failure; revise before add).

### Senior-review field notes (2026-06-16)
- **`rules.md` theme default is stale.** It says "Hearth (dark, default)"; the code makes **light** the default (`useTheme.ts`, `layout.tsx` `data-theme="light"`, the FOUC script). Treat code as authoritative; correct the rule + the `globals.css :root` "Dark mode (default)" comment in the Phase-6 ADR. *(Changing `rules.md` needs Jeff's sign-off — not done yet.)*
- **`--font-display` (Newsreader) is defined but used nowhere.** Headings run on `--font-serif` (Instrument Serif) + `--font-spectral`. The display-font change is a multi-file repoint.
- **Analytics gap (Phase 0/3):** `startExploration` reports `entry_point:"situation"` though it sets `sessionOrigin="explore"`, and the `EntryPoint` enum has no `"explore"`. Add it, or Home usage (hero vs layer vs fresh) is invisible.
- **Dead code to delete (Phase 2/5):** the left-edge swipe effect (`MainApp.tsx`), the `onOpenDrawer` prop chain (~5 components + `TopBar` menu), `SessionDrawer.tsx` (if Talk owns the session list); check whether `EntryCard.tsx` survives the read-card redesign.
- **Token test caveat:** guards admin only, and its regex doesn't catch raw `#hex` — so the front door will be the least token-disciplined surface until addressed; the deferral should carry a revisit condition.
