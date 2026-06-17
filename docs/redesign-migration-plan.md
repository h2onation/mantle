# Front-Door Redesign — Migration Plan (file-level)

**Status:** APPROVED — building. All decisions locked 2026-06-17 (§11). Design/implementation companion to `docs/redesign-plan.md` (which it supersedes for execution).
**Updated:** 2026-06-17
**Design source of truth:** `mockups/frontdoor-prototype-v6.html`.
**Method:** Four read-only planning agents each grounded one slice (design system · navigation · engine · Home+Manual) against the real tree; synthesized here; then senior-engineer reviewed (see §10).

This is the *how* to `docs/redesign-plan.md`'s *what*. The living plan owns the phase outline, locked decisions, and open questions. This doc adds: file:line-level change lists, a rollout/rollback spine, per-phase verification gates, and corrections where the living plan drifted from the code. **Nothing here is built until the phase is approved.**

---

## 1. How to read this

- **Phases** match the living plan (0–6). Each phase below carries: *what changes (file:line)* · *how it ships safely* · *how it rolls back* · *verification gate* · *overbuild note*.
- **§2 is the spine** — the cross-cutting migration model (branch strategy, the rollback truth, the dependency graph). Read it first; the phases assume it.
- **§9 corrects the living plan** — several claims in `redesign-plan.md` were overstated or stale; they're collected there with evidence, pending Jeff's sign-off to fold back.

---

## 2. The migration spine (cross-cutting)

### 2.1 The rollback model — corrected

The living plan and the original briefs assumed a feature-flag cutover. **That assumption is wrong, and all four agents confirmed it independently.** The `feature_gates` table (`src/lib/persona/feature-gates.ts:6-49`) is **server-side persona scaffolding** — four booleans (`personaDeltas`, `conversationModes`, `checkpoints`, `extractionBrief`) read once per turn inside `loadConversationContext`, written only via `/api/admin/feature-gates`. It has **no client/CSS/UI surface**, and there is **no other client flag system in the repo** (no PostHog gating, no `NEXT_PUBLIC_*` toggle). So:

- **Phases 0, 1, 2, 5 roll back by `git revert`** of a self-contained, reviewable branch. They carry no schema change and no data migration, so revert is clean.
- **Phase 3 (Home landing) is the one place a real flag is warranted**, because it changes *where every user lands on open*. Use a **client-side flag in `MainApp`'s landing effect** (env var or localStorage, optionally admin-readable) that defaults to **today's behavior** (auto-resume into the session view). Flag off ⇒ byte-for-byte current app. This keeps the app shippable through the whole migration.
- **Phase 0 needs no flag at all** — it's dormant until Phase 3 wires the layer rows, so landing it early carries zero runtime risk to current users.
- **`LIVE_VOICE_VARIANT`** (`config.ts:109`) rolls back the *voice rebuild*, **not** any of this. It does **not** remove the Phase-0 exploration branch (that branch is shared by both voice variants). Don't conflate them.

### 2.2 Branch & ship discipline

- One phase = one branch = one reviewable PR, merged to `main` only after its gate passes. Per the project's parallel-session rule, rebase onto `origin/main` right before pushing and ship one phase at a time.
- `npm run build` green + relevant tests before every merge. Never run `npm run build` while the preview dev server is up (it invalidates `.next`).
- Behavioral/prompt work (Phase 0) additionally requires `/evaluate` or human review — a green build cannot validate voice.
- **Theme: light-only for now (DECIDED 2026-06-17).** Jeff confirmed light-first; he isn't looking at dark this round. The code *already* defaults to light (`useTheme.ts`, `layout.tsx` `data-theme="light"`), so `rules.md:235` ("dark, default … every component works in both") is **stale vs. the code, not a live constraint** — this is a doc-correction, not a ratification gate. Fold the `rules.md` edit (light-first for the front door; relax "works in both" for these surfaces) into the work; no separate ceremony. *(Accepted consequence: the font swap also changes dark's fonts on the old dark palette — fine, since dark is out of scope now.)*

### 2.3 Dependency graph (the order that compiles)

```
Phase 1 (tokens/fonts)  ─┐  independent, low-risk
Phase 0 (engine)        ─┤  independent, dormant until P3
                         │
Phase 2 (nav + enum)  ───┤  adds `home` to MobileView → COMPILE-BLOCKS P3 until done
                         │
Phase 3 (Home)  ─────────┤  needs P2 (enum/nav) + P0 (layer rows) + P1 (visual)
Phase 4 (Manual) ────────┤  needs P1 (visual) + P0 (layer "go deeper")
Phase 5 (Chat)  ─────────┘  needs P1 (Jove-rule removal already folded into P1)
Phase 6 (docs/ADR) — last
```

**Recommended sequence:** **0 + 1 in parallel** (safe foundations, no user-visible landing change) → **2** (nav, the heaviest) → **3 + 4** → **5** → **6**. Phase 3's layer-row *tap action* is the only thing gated on Phase 0; Home's other blocks (hero, begin, share, read-link, progress index) can build before Phase 0 with rows temporarily routing to the Manual read view.

### 2.4 One naming decision resolved here

The engine agent proposed the exploration type be named **`started_layer`** ("you've started this; let's add to it" — avoids implying the layer is full); the Home/Manual agent wrote `populated_layer`. **Standardize on `started_layer`** everywhere below.

---

## 3. Phase 0 — Engine: populated-layer "go deeper"

**Reframe (correcting the living plan):** this is **not "new engine"** — it's one union member, one ~4-line opener branch, and one analytics value. The dispatch is a single `if/else if` in one function; the populated layer's entries are *already* in the prompt every turn, so there's no new context plumbing and no duplicated decision logic. The *risk* (on-voice, no self-contradiction) is real; the *surface area* is three small edits.

**Changes (file:line):**
1. **Type — add `started_layer`.** `src/lib/types.ts:53` union → `"entry" | "empty_layer" | "started_layer"`. No new fields (`content` stays the layer description, same as `empty_layer`).
2. **The duplicated inline type.** `src/app/api/chat/route.ts:38` hand-redeclares the union — it **must** also gain `started_layer` or the route silently narrows the field. (Flag for Phase 6: this inline copy should import from `types.ts` — it's exactly the duplication the codebase warns against.)
3. **The opener branch.** `src/lib/persona/system-prompt.ts:961-983`, a new `else if` after the `empty_layer` branch (~4 lines). It must: say the layer is *already started* (NOT "empty" — the current bug at `:974`); point at the entries already in context without summarizing them back; not re-introduce the "reference your *other* layers" framing. No-duplication proof: the entries are rendered by `prepareManualContextBlocks` already; the deepening/handoff posture lives in Tier 2/Tier 1 already — the branch only orients the opener.
4. **Analytics — break the alias.** `src/lib/analytics/events.ts:21` is `EntryPoint = ConversationMode` (`"situation"|"guided-intake"|"upload"`, `config.ts:117`) — no layer-scoped value. Change to `EntryPoint = ConversationMode | "explore"` (break the alias; do **not** widen `ConversationMode`, which would leak into `/api/chat` mode validation at `route.ts:46-49`).
5. **Fix the mis-report.** `src/lib/hooks/useChat.ts:1273-1277` — `startExploration` sets `sessionOrigin="explore"` (`:1233`) but reports `entry_point:"situation"`. Change to `"explore"`.

**Ships safely / rollback:** dormant until Phase 3 calls `type:"started_layer"`. Test without a Home UI via the existing per-entry "Explore" control (temporarily point it at `started_layer`) or pure `/evaluate` on the prompt. No `feature_gates`; rollback = drop the `else if` (a `started_layer` payload then renders no exploration block) or revert the branch.

**Verification gate:**
- `tsc` passes across **all three** consumers (`types.ts`, `route.ts:38`, `system-prompt.ts`). **Baseline caveat (S6):** `npx tsc --noEmit` is NOT clean today — 2 pre-existing errors in `useChat.test.ts:175,180` (test fixture missing `channel`), unrelated to the redesign. Fix these first or define the gate as "no *new* tsc errors vs. baseline" so a phantom regression isn't chased.
- Unit test (mirror the `empty_layer` test at `system-prompt.test.ts:783`): `started_layer` context **renders the layer description + the "already started" framing** (positive assertion — `renderExplorationContextBlock` always emits the `EXPLORATION FOCUS` header + closing line regardless of type, so a header-only empty block would pass a negative-only test) AND **does NOT** `toContain("is empty")`.
- `/evaluate` on a scoped conversation for a user with 1–2 entries in the target layer: on-voice opener, references existing material as a doorway without summarizing, one concrete handoff.
- PostHog `conversation_started` carries `entry_point:"explore"`; PII guard still green.

**Overbuild note:** one union member, one ~4-line branch (fires once per scoped session, zero cost on normal turns — gated behind `if (explorationContext)`), one analytics value, one bug-fix. Justified because the current behavior is a *confirmed wrong output* (Jove contradicting the Manual), clearing the soak-governance bar. Deletion condition: Home layer rows removed, or a frontier model opens a started layer correctly given only `empty_layer`.

---

## 4. Phase 1 — Foundation: tokens, fonts, theme

All edits land as **two independently-revertible commits**.

### Commit A — light-theme token rebind (`globals.css:210-366` only; dark `:root` untouched)

**Mechanical rebinds (low judgment)** — surfaces + ink ramp + hairlines, old→new from the v6 palette:

| Token | line | → new |
|---|---|---|
| `--session-linen` | 214 | `#E6E0D4` |
| `--session-cream` | 215 | `#FBF9F4` |
| `--session-cream-bright` | 216 | `#FFFDF8` |
| `--session-parchment` | 217 | `#F4F1EA` |
| `--session-ink` / `-soft` / `-mid` / `-faded` | 222 / 223 / 225 / 226 | `#1A1712` / `#463E32` / `#6E6557` / `#8C8475` (non-contiguous — `:224` sits between; `-mid`/`-faded` may be `rgba()`, alpha-only, no hex swap) |
| `--session-ink-persona` (S3 — plan originally omitted) | 224 | rebind to the navy ink tone |
| `--session-hair` / `-soft` | 232–233 | `rgba(26,23,18,0.10)` / `rgba(26,23,18,0.06)` |
| `--session-ink-hairline` (S3 — plan originally omitted; used app-wide for borders, e.g. `DesktopSidebar.tsx:151,350`) | 229 | rebind to match the new hairline tone, or surfaces keep the old graphite border |

**Brand reassignment (HIGH judgment — needs sign-off):** brown = you, navy = Jove is the **inverse** of today (walnut = global accent, sage/brass = Jove). The hex lookup is mechanical; the *role reassignment* is not, because the prototype only colors the four front-door screens.
- `--session-walnut*` family (249–255, 313, 323, 348) → brown `#6E4527` / deep `#583619` / borders `rgba(110,69,39,…)`.
- `--session-persona*` family (238–242) → navy `#21436B` / borders `rgba(33,67,107,…)`.
- **Speaker bubbles:** Jove bubble stays *paper* (`--session-jove-bg`, navy is only Jove's label/accents); user bubble gets the warm brown wash (`--session-user-bg` → `linear-gradient(180deg,#F6ECDF,#F1E3D0)`, `--session-user-border` → `rgba(110,69,39,0.20)`).
- **Jove bubble rule removed here, one line:** `--session-jove-rule` (`:327`) `#A6803C` → `transparent`. (This is the living plan's Phase-5 "remove the rule" item — folding it into the token block makes Phase 5 a no-op for it.)
- **Chrome consumers — DECIDED 2026-06-17: apply globally, no exceptions this round.** Every *chrome* consumer of `--session-walnut*` (desktop rail `:565-575`, scrollbars `:519`, hovers `:526-541`) turns brown, and the global focus ring (`--session-persona`, `:449`) turns navy. **That's accepted** — desktop gets its own dedicated pass next, so the desktop chrome is designed intentionally then rather than fitted with a throwaway neutral mapping now (removal-first). Navy focus ring is fine everywhere. No surface-by-surface work this round.

**The FOUC hazard (most likely bug in the phase — sharpened by S2):** the warm-white ground hex is duplicated in **four** places. Today they all happen to be `#E8E6DF` — but only `globals.css:214` (`--session-linen`) is in the rebind table above; the other three (the inline FOUC script `layout.tsx:15`, `applyTheme` in `useTheme.ts:43`, and `viewport.themeColor` at `layout.tsx:67`) are *not*. If only the token moves to `#E6E0D4`, the status bar stays `#E8E6DF` and mismatches the new page ground on first paint — the exact FOUC bug, introduced by omission. **All three theme-color sites must be updated to the new ground hex in Commit A.** Add them to the change list explicitly.

### Commit B — font loader swap (REFRAMED after senior review — B2)

**The earlier framing was wrong and would cause a visible regression.** It assumed `--font-spectral` is "the heading variable + 6 body exceptions." The code shows `--font-spectral` is the primary face in **~120–130 sites**, most of them **not headings** — it's a pervasive serif-display token used for headings *and* a lot of running body/label text: `MobileManual.tsx`, `MobileCrisis.tsx`, all of onboarding (`LoginScreen`, `AuthPromptModal`, `SeedScreen`, `InfoScreens`), `EntryItem.tsx:223`, `EmptyLayer.tsx`, `LayerHeader.tsx`, and the **checkpoint's secondary text** (refinement-ceiling/decline copy, `CheckpointOverlay.tsx:406/533/543/580/607`). Two stack patterns exist: the body-prose stack `var(--font-spectral), var(--font-persona), serif` (~7 sites incl. `Bubble.tsx:65`, `CheckpointOverlay.tsx:336`, `Plate.tsx:41/56`, `ChatInput.tsx:221/294`) and the much larger `var(--font-spectral), var(--font-serif), serif` (~120 sites). **Repointing `--font-spectral` → Fraunces flips all ~120 to a display face**, including crisis copy, login body, manual entry text, and 14px italic checkpoint copy — none of which should be a display face.

**Corrected approach — the inverse of the original (this is the "should this be a token?" answer, DECIDED 2026-06-17 = yes):** introduce a *dedicated heading token* `--font-display` for the true headings and **leave the prose/label stacks on the serif token**, rather than overloading `--font-spectral` to mean "display" and hand-patching the exceptions. The audit below is the **one-time cost of establishing that clean token** — separating headings from body across the ~120 sites. After it lands, changing the heading face is a single token swap, permanently.

1. **Audit first (human eye, not a grep count):** classify the ~120 `--font-spectral` usages by *intent* — true heading vs. body/label — per stack pattern, not blanket. This audit gates the rest of Commit B.
2. **Headings → Fraunces** via a real `--font-display` (the slot the original plan wanted to delete — keep and use it for headings; load Fraunces into it). Repoint only the *true-heading* sites the audit identifies.
3. **Prose → Newsreader** by repointing `--font-serif` (change `Instrument_Serif` at `layout.tsx:27-31` to `Newsreader`); leave the body/label stacks pointing at it.
4. **Sans/mono:** DM Sans → Plus Jakarta Sans, DM Mono → JetBrains Mono (pure loader swaps, `--font-sans`/`--font-mono` names unchanged).
5. **`--font-spectral`'s fate is decided by the audit** — if every true-heading site moves to `--font-display`, `--font-spectral` may be retired or left as the serif-display fallback for the remaining body/label text. Do **not** assume it's deletable until the audit says so.

**Load via `next/font/google`** (self-hosted, no layout shift) — do **not** copy the prototype's `<link>` tags. Request Fraunces optical-sizing + weights 400/500/600. **This phase needs a human looking at rendered output across the ~120 surfaces, not just a green build** (see verification gate).

**Verification gate:**
- After A: build green; light shows warm-white/brown-you/navy-Jove/no Jove rule; **dark byte-identical** (diff confined to `[data-theme="light"]`); contrast re-check on `--session-ink-faded` + lightened hairlines; no-FOUC (status bar matches ground on hard reload — validates the 4-place hex sync).
- After B: build green; true headings render Fraunces, prose Newsreader in both themes; **checkpoint regression gate (critical):** the 3 longest real proposed entries don't clip/overflow the plate, edit box still fits, AND the secondary checkpoint copy (`:406/533/543/580/607`) did NOT silently become a display face; `Bubble.tsx:65` prose renders Newsreader; existing `design-tokens.test.ts` + `CheckpointOverlay.test.ts` green.
- **B2 visual gate (human, not a build):** pixel-diff a *sample of body-text surfaces* — crisis copy, login/onboarding body, manual entries — before+after, not just headings, to confirm no running text became a display face. Screenshot light+dark Home/Manual/Chat/checkpoint before+after each commit.

**Overbuild note:** rebind loaders, don't mass-repoint; delete `--font-display`; fix the stale `globals.css:6` "Dark mode (default)" comment while in-file; don't extend the token-discipline test to the front door yet (its regex misses raw `#hex` anyway — deferred with a revisit condition).

---

## 5. Phase 2 — Navigation (heaviest; deletes more than it adds)

**Net:** +1 component (`BottomNav`) +1 small extract (`SessionList`), against deleting `SessionDrawer.tsx` (573 lines) + the swipe gesture + the whole `onOpenDrawer` chain + the TopBar menu glyph.

**Changes (file:line):**
1. **Widen the enum (one line):** `MobileView` at `MobileLayout.tsx:6` gains `"home"` (and `"you"` only if "You" becomes a distinct screen — see #2). This is the compile-blocker (conflict #7): it's imported by 6 files, so the type widens everywhere at once.
2. **"You" = relabel of existing Settings, NOT a new screen.** `MobileSettings.tsx` already holds account + theme + persona picker + log out + delete-account (`:371-444`). Route the "You" tab to the settings view (relabel header) rather than building a `MobileYou.tsx` that re-imports ~650 lines. **If accepted, the enum gains only `home`, shrinking conflict #7.** *(Note per B1: Settings does NOT currently hold a Crisis row — `:447-449` carries a comment that Crisis moved out to its own surface. So adding a Crisis row under "You" is net-new, not a preserved feature.)*
3. **`BottomNav` (new, `src/components/shared/BottomNav.tsx`):** four tabs Home→`home`, Manual→`manual`, Talk→`session` (label only — no `talk` enum value), You→`settings`/`you`. Mount in `MobileLayout` as a pinned flex child; convert the panel container to `flex-direction:column` with a `flex:1` scroll region. **Build at 44px tap target from the start** (the prototype's 38px is an artifact; don't ship known-bad and backlog it).
4. **Crisis — DECIDED 2026-06-17: a row under "You," 2 taps. No persistent header button.** The "≤1 tap safety gate" that drove earlier versions of this section was an unfounded assumption — `rules.md` documents a **Crisis Protocol** (`:99-107`) that is entirely about *Jove's in-conversation behavior* (on crisis signals, Jove stops and prescribes 988 + Crisis Text Line). That is the real safety net and it is **zero-tap** — it surfaces itself wherever the user is talking. There is no documented requirement for a static link in one tap. So the static "Crisis support" link is a passive backstop, and 2-tap-under-You is acceptable. **Build a Crisis row in the "You"/Settings screen** (it currently lives only in the drawer footer `SessionDrawer.tsx:364-410` + desktop sidebar `DesktopSidebar.tsx:391-401`, so deleting the drawer requires building this row — see B1). Wire it → existing `setActiveView("crisis")` (`MainApp.tsx:379-381`); `MobileCrisis.tsx` already exists. *(This is no longer a phase gate.)*
5. **Conversation list under "Talk":** lift the session-list render out of `SessionDrawer` (`:235-342`, incl. `showAllSessions`/`VISIBLE_SESSION_COUNT`) into a small `SessionList`, and re-home the `refreshConversations()` trigger there. (Talk's resume-vs-list behavior is Q4/Phase 3; Phase 2 only preserves *reachability*.)
6. **Desktop decision (minimum to compile + behave):** `RoomHeader.tsx:24-40` and `gradientFor` (`MobileLayout.tsx:27-37`) already have safe `default` branches. In `MainApp`, when `isDesktop`, **coerce `home`→`session` and `you`→`settings`** before passing `activeView` to `DesktopShell` (whose panel map `:100-106` has no `home`/`you` entry). That's the plan's accepted "redirect" shim.
7. **Dead-code removal (in this order so nothing references a deleted symbol mid-step):** swipe gesture (`MainApp.tsx:302-343`) → `onOpenDrawer` chain across `MainApp` + `MobileSession` + `MobileManual` + `MobileSettings` + `MobileCrisis` + `TopBar` → TopBar menu glyph (`TopBar.tsx:34-55`) → delete `SessionDrawer.tsx` + its render/overlay plumbing (`MainApp.tsx:525-540`, `MobileLayout.tsx:23,84`).

**Ships safely / rollback:** **not a flag cutover** (feature_gates doesn't fit, and a UI-shell flag would force carrying *both* nav systems — fighting the deletion goal). It's a single-PR hard swap on a branch, gated by §verification. Order within the PR: widen enum + desktop coercion together (build stays green) → build `BottomNav` + Crisis header button (Crisis must be live *before* the drawer dies) → mount nav → lift `SessionList` → delete drawer/swipe/chain/glyph. Rollback = revert the branch (no schema/data).

**Verification gate:** all four tabs route + active-state tracks `activeView`; **Crisis support reachable via the "You" screen** (the row exists and opens `MobileCrisis`); grep `onOpenDrawer`/`SessionDrawer`/`drawerOpen` → zero hits; desktop sidebar unchanged and `home`/`you` never strand a user; `tsc`/build green with the widened enum; past conversations still reachable under Talk.

---

## 6. Phase 3 — Home

**No Home component exists today;** `MainApp` boots to `activeView="session"` (`:32`). The good news: `useChat` already *computes* everything Home needs — `firstName`, `sessionSummary`, `lastSessionDate`, `sessionOrigin`, `isNewUser`, `firstSessionCompleted`, `conversations`, `confirmedEntries` (`useChat.ts:1377-1420`) — but `MainApp` **drops** several of them (`:159-193`). Home wiring is mostly "consume what's already there."

**A. Composition → data (each v6 block):** greeting ← `firstName` (+ `hasRealName` guard, fallback "Good evening."); **continue-hero snippet** ← `sessionSummary` (must add to MainApp's destructure) with fallback ladder `sessionSummary → active conversation title → preview → generic`; **"Bring a situation"** ← existing `startConversation("situation")`; Guided/Upload stay as the session entry-cards (don't duplicate on Home); **5-layer index + per-layer count + "N of 5 started"** ← `buildLayers(confirmedEntries)` (pure derivation, no new data); **share tile** ← existing PDF (`generateManualPdf`/`shareManual`), reworded.

**B. The resume control-flow inversion (riskiest, conflict #1):** **don't touch the data half of `initializeConversation`** (`useChat.ts:464-624` — it picks the conversation, loads messages, reactivates pending checkpoints; keep all of it). Change only **where `MainApp` points `activeView` after init**: add a post-init landing effect keyed on `initialized` —
- `isNewUser || !firstSessionCompleted` → `session` (first-run conversation);
- else → `home`;
- **override: if `activeCheckpoint !== null` → `session`** (a pending proposal is unfinished business — drop them back in, as today);
- **override (S1): if the resume path triggered an opener into an empty conversation → `session`** (or suppress the auto-opener when landing on Home). `initializeConversation` calls `triggerPersonaOpener` when the most-recent conversation has zero messages (`useChat.ts:590-593`) — streaming Jove's opener *live* into the session view. A returning user routed to Home while that opener streams into an unviewed session is a race / half-streamed-state hazard on Continue. **Needs a real manual test:** a returning user whose latest thread is empty.
The auto-loaded thread sits behind Home ready for one-tap resume; nothing is discarded. This is a *navigation* change in one file, not a `useChat` rewrite.

**C. First-run vs returning (per `first-run-plan.md` — new users never see the 5-layer Home):** the branch above lands new users on the session entry-cards (`MobileSession.tsx:217-353`), already close to the first-run-plan's "one opener + entries." (The plan's preferred seeded-chips + focused-input is a separate Chat-screen refinement, flag for Phase 5.)

**D. Q3/Q4:** Q3 → conditional hero (returning-with-thread shows "pick up"; returning-fresh degrades to the begin tile; new users never reach Home). Q4 → Talk = `setActiveView("session")`: resume if a `conversationId` is loaded, else show entry-cards — no new handler.

**Ships safely / rollback:** the **client-side landing flag** from §2.1 — off ⇒ today's auto-resume-into-session. Layer rows route to the Manual read view as a **pre-Phase-0 fallback**, then swap to `started_layer` exploration once Phase 0 lands.

**Verification gate:** new user → session entry-cards (never 5-layer Home); returning → Home; pending checkpoint → session with the card live; Continue opens the resumed thread (no new conversation row); hero never blank; layer tap (post-P0) fires `started_layer` and Jove doesn't call the layer empty; progress count matches `buildLayers` for fixtures (0/1/4/5 started).

---

## 7. Phase 4 — Manual

**Today** `MobileManual` renders an *interactive* document (`buildLayers` → `PopulatedLayer` with expanded editable/explorable entry cards). **v6** is collapsible-by-default read sections, first-person entries, layer glosses, provenance.

**Changes (file:line):**
1. **`MobileManual.tsx`** stays the container (masthead, share invitation, share sheet all survive); masthead copy → first person ("How I operate"); layer-map renders a **collapsed-by-default accordion**.
2. **`PopulatedLayer.tsx`** becomes a collapsible section (header button toggles a panel; mirror the existing `EntryItem` chevron pattern). **Default collapsed** — this *overrides* the living plan's "expanded" recommendation (§9).
3. **`EntryItem.tsx` survives, restyled — do NOT replace it.** It already holds the read body + edit contentEditable + Save/Cancel (PATCH `/api/manual/[id]`). v1 changes: (a) always-expanded inside an open layer (accordion owns collapse); (b) add the provenance line; (c) confirm first-person render (entries are authored first-person at confirm — no transform).
4. **Edit stays behind its explicit control** — already true (`EntryItem.tsx:306-317`); preserved as-is (re-skin, not rebuild).
5. **Q5 → layer-level "go deeper" only:** **remove the per-entry "Explore further" block** (`EntryItem.tsx:318-353`) + its prop threading (`PopulatedLayer.tsx:62-63`). `EmptyLayer`'s layer-level explore stays.
6. **Provenance (the one real data task):** the manual API returns `created_at` (`route.ts:23`) but `buildLayers`/`Entry` drops it (`Entry` is `{id,name,body}`). Extend `Entry` with `createdAt`, carry through `buildLayers`, format "Added from a conversation · {month}" in `EntryItem`. **Month only** — no conversation *name* (not stored; v6's "dishwasher conversation" is mockup flourish).
7. **Layer→scoped-chat handoff:** reuse `handleExploreWithPersona` + `startExploration` *verbatim*, passing `type:"started_layer"` (depends on Phase 0). No new transition machinery.

**Note:** there is **no `EntryCard.tsx`** in `manual/` — the living plan's reference is stale; the file is `EntryItem.tsx` and it survives (§9).

**Verification gate:** entries read first-person; layers collapsed on first paint (`aria-expanded="false"`); Edit flips to contentEditable, Save PATCHes without refetch, Cancel restores; **no per-entry "Explore" button remains**; provenance renders from `created_at` (absent when missing); empty layer still offers layer-level explore; share sheet still makes the PDF, copy has no "page you control."

---

## 8. Phase 5 — Chat (lighter than the living plan implies)

The Jove-rule removal is already folded into Phase 1 (Commit A). So Phase 5 shrinks to: the consistent logo header + a context subtitle (esp. for scoped chats), wiring scoped openers into the chat surface, restyling the in-chat checkpoint card to match (keep the full-screen confirm overlay + its edit/refine/decline), and shrinking the empty state. Also (from `first-run-plan.md`) the optional first-run refinement: seeded example chips + a focused input in place of three cards. *Detail this phase after Phases 1–4 land; it's mostly restyle + the scoped-opener wiring that Phase 0 enables.*

---

## 9. Corrections the agents found in `docs/redesign-plan.md` (pending Jeff's sign-off to fold back)

1. **`feature_gates` is not a UI rollout flag** (§2.1). The plan's implied flag-cutover for Phases 2–4 should be replaced with: git-revert rollback for 0/1/2/5, one client-side landing flag for 3.
2. **Font change ≠ 44-file repoint** (§4). It's two loader rebinds + 6 hand-edits; the "44" counts files that *reference* the variable, not files that *change*. And `--font-spectral` serves *two* roles (headings + body prose), which is why both a display and a serif rebind are needed.
3. **Color "meaning change is mechanical" is half-right** (§4). Hex is mechanical; the role *reassignment* across non-front-door chrome (desktop rail, focus ring, scrollbars) needs a surface-by-surface call the prototype can't answer.
4. **"You" is the existing Settings screen** (§5), not a new screen — ratify this and the enum gains only `home`.
5. **The 38px nav target needn't be backlogged** (§5) — build `BottomNav` at 44px now.
6. **The prototype never composed "You" and never placed Crisis** (§5) — both are net-new in Phase 2, strengthening the "Crisis unsolved" flag.
7. **Phase 0 is smaller than "new engine"** (§3) — one union member + one branch + one analytics value; but it also requires editing the **duplicated inline type at `route.ts:38`**, which the plan omits.
8. **`EntryPoint` fix is "break the alias," not "widen `ConversationMode`"** (§3).
9. **Manual default state: collapsed, not expanded** (§7) — the v6 prototype + the locked copy direction override `redesign-plan.md:159`.
10. **`EntryCard.tsx` does not exist** (§7) — the Manual card is `EntryItem.tsx` and it survives; the `EntryCard` that exists is the unrelated session entry-mode card.
11. **The resume inversion is a `MainApp` landing-view change** (§6), not a `useChat` rewrite — `useChat` already exposes the needed signals; `MainApp` just discards them.

---

## 10. Senior-engineer review (2026-06-17)

**Verdict: sound approach, sequencing, and rollback model — but three load-bearing errors had to be fixed before the affected phases are built.** All three are now folded into the phases above. The great majority of file:line claims checked out (see "confirmed" below).

**Blockers (now corrected inline):**
- **B1 — Crisis inventory was wrong.** Settings does NOT hold a Crisis row (`MobileSettings.tsx:447-449` says it moved out); Crisis lives only in the drawer being deleted (`SessionDrawer.tsx:364`) + desktop sidebar. So a Crisis row under "You" is net-new and must be built. → §5.2/§5.4 corrected. *(Follow-up: Jeff decided 2026-06-17 against a persistent header button; the row goes under "You" at 2 taps. The "≤1-tap safety gate" the review inherited from the planning docs was itself unfounded — see §11.)*
- **B2 — font swap was under-scoped by ~20×.** `--font-spectral` is the primary face in ~120–130 sites (not "headings + 6 exceptions") — much of it running body/label text. Repointing it to a display face would flip crisis/login/manual/checkpoint copy to Fraunces. → §4 Commit B reframed to the inverse approach (new `--font-display` for true headings, audit-gated, human visual review).
- **B3 — rule supersession sequenced too late.** `rules.md:235` ("dark default" + "works in both"). **Resolved 2026-06-17:** Jeff confirmed light-only for now; the code already defaults to light, so this is a stale-doc correction, not a ratification gate. → §2.2 updated; fold the `rules.md` edit into the work.

**Should-fixes (now corrected inline):** S1 resume-opener race on empty restored conversation (§6B); S2 the 3 theme-color FOUC sites omitted from the rebind list (§4 Commit A); S3 `--session-ink-persona`/`-ink-hairline` omitted + line ranges imprecise (§4 table); S4 TopBar slot rationale wrong, outcome holds (§5.4); S5 Phase 0 gate needs a positive render assertion (§3); S6 `tsc` not clean today — define gates against baseline (§3).

**Confirmed accurate (spot-checked, holds):** the `feature_gates` characterization + "no client flag system" + clean-revert claim (§2.1); `useChat` exposes / `MainApp` drops the signals (§6); the duplicated inline `ExplorationContext` at `route.ts:35-41` (§3); `EntryPoint = ConversationMode` with no `"explore"` + "break the alias" (§3); the `MobileView` 6-consumer compile-block + desktop coercion shim (§2.3/§5); `SessionDrawer`/swipe/`onOpenDrawer`/menu-glyph inventory (§5); `EntryItem.tsx` (not `EntryCard.tsx`) is the Manual card (§7); provenance `created_at` drop (§7); chat route has rate limiting, Phase 0 adds no route/auth/RLS surface; no Dead Feature reintroduced; the 0+1-parallel→2→3+4→5→6 order has no hidden cycle.

**Overbuild check: passed.** The plan deletes more than it adds (Phase 2 nets +1 component, −572 lines), folds the Jove-rule removal into Phase 1, reuses `startExploration`/`handleExploreWithPersona` verbatim, and introduces no second source of truth. One watch item: the new front-door components will be the least token-disciplined surface (the token test guards admin only and misses raw `#hex`) — deferred with a revisit condition.

**Minor notes (not folded, low value):** `SessionDrawer.tsx` is 572 lines (plan said 573); `buildLayers` also feeds `AdminManualView.tsx:13`, so the admin Manual view will diverge visually from the restyled mobile one after the read-view change (additive, won't break).

**Where a human or real test is required (not a green build):** (1) the B2 font swap across ~120 surfaces — visual judgment; (2) the S1 resume edge — manual test of a returning user with an empty latest thread; (3) the Phase 0 opener voice — `/evaluate`; (4) the brand reassignment on non-front-door chrome (§11) — Jeff's eye.

---

## 11. Decisions (resolved 2026-06-17)

- **"You" = relabel of Settings.** ✅ **Yes.** Route the "You" tab to the existing `MobileSettings` view; the enum gains only `home`. No new screen.
- **Crisis mechanism.** ✅ **Crisis lives in Settings (the "You" tab), NOT on Home/the main page, and NOT as a persistent header button** (Jeff confirmed 2026-06-17). A row under "You," 2 taps. Verified against `rules.md`: the documented **Crisis Protocol** (`rules.md:99-107`) governs *Jove's in-conversation behavior* (on crisis signals Jove stops and prescribes 988 + Crisis Text Line) — that is the real, **zero-tap** safety net, surfaced wherever the user is actually talking. **There is NO documented "static link in ≤1 tap" rule** — that was an assumption that propagated through the planning docs, not a constraint. So the static "Crisis support" link is a passive backstop, and 2-tap-under-You is acceptable. Phase 2 must still **build** that row (it currently lives only in the drawer being deleted — see B1). *The "Crisis ≤1 tap unsolved / safety gate" framing in §5, §10-B1, and `redesign-plan.md` Q1 is hereby retired as unfounded; corrected below.*
- **Display face.** ✅ **Fraunces** (matches v6).
- **Manual collapsed by default.** ✅ **Yes** — overrides the living plan's "expanded" recommendation.
- **Brand reassignment on non-front-door chrome.** ✅ **Apply brown/navy globally; do NOT build a throwaway neutral mapping.** Rationale: desktop is getting its own dedicated pass next, so let the desktop chrome (sidebar, scrollbars) inherit the rebound brown/navy values temporarily and design it intentionally in the desktop round — building a neutral exception layer now is effort we'd discard (removal-first). The focus ring going navy is fine everywhere (a reasonable accessibility color). *Resolves the §4 "surface-by-surface" open item: no surface-by-surface work this round.*
- **Share copy (Q6):** reuse the local PDF for v1 and reword "a page you control." (Confirmed earlier; carried.)
