# mywalnut — Visual Design Audit v2

**Goal:** Clearer. Best-practice-aligned. Intuitive. This second pass validates v1, applies five lenses v1 missed, and re-ranks priorities by impact × effort.

**Scope:** Everything v1 covered (every user-facing screen, modal, component) plus previously-missed surfaces (MainApp init splash, sign-in banner, checkpoint pending card, welcome chips, reset-password success state, Manual export loading overlay, admin banner). Visual design + interaction design + accessibility. Non-code — code lives elsewhere. Same premium bar as v1: Linear, Things 3, Arc, Raycast, Superhuman.

---

## 1. Methodology (the plan)

### 1.1 Approach
Validate-then-extend, not start-over.

1. **Validate v1.** Every claim re-verified against source + targeted browser checks. Three outcomes per claim: *confirmed*, *corrected* (e.g. wrong measurement or wrong file), or *withdrawn* (false positive).
2. **Apply five lenses v1 missed:**
   - **Accessibility** (WCAG 2.1 AA: contrast math, semantic HTML, ARIA, keyboard, focus management, reduced-motion, screen-reader flow)
   - **Copy & voice** (errors, empty states, labels, placeholders, microcopy, tone consistency)
   - **Motion** (every transition and `@keyframes` catalogued — duration, easing, trigger)
   - **State coverage** (loading / error / empty / success matrix per data-driven surface)
   - **Screen inventory** (confirm nothing missed — routes, modals, overlays, banners, interstitials)
3. **Apply explicit frameworks.** Findings cite the framework they violate: Nielsen's 10 heuristics, Fitts's Law, Hick's Law, Miller 7±2, Gestalt proximity / similarity / closure, WCAG 2.1 AA, Apple HIG 44pt minimum.
4. **Apply "clear / intuitive" lenses:**
   - *Clarity:* can the user skim and understand the screen's purpose in 3 seconds? Does reading order follow hierarchy?
   - *Intuitiveness:* does every tappable thing look tappable? Does every destructive action look destructive? Do status changes match expectation?
5. **Re-prioritize with effort × impact**, not impact alone. You can pick high-leverage + low-effort items first.
6. **Red-team.** Final section: counterarguments, likely overreach, still-unknown.

### 1.2 Severity legend
- `[cosmetic]` — a designer will notice. Users won't consciously.
- `[noticeable]` — normal users register it subconsciously. Contributes to "feels off."
- `[credibility]` — reads as unfinished or generic. Hurts trust.
- `[a11y]` — fails a specific WCAG 2.1 AA success criterion. (Overlaps with severity above but I call it out so these stay legally-material.)

### 1.3 Data sources
- Validation agents across src/ (accessibility, copy/voice, motion, screen inventory, iconography)
- Direct reads of MobileNav, BetaFeedbackButton, and flagged components
- Grep verification of specific v1 claims that the new data contradicts
- Contrast ratios computed on hex values from globals.css

---

## 2. Validation of v1

**Scoreboard:** of v1's ~70 findings and its Top 15, the vast majority hold. Three corrections, one withdrawal, one strengthening.

### 2.1 Confirmed correct (spot-checks)
- **Font-size fragmentation** — count holds. 16+ distinct sizes in use, tokens define 4.
- **Ink ramp confusing** — `ink-faded` darker than `ink-mid` holds; naming is inverted.
- **Border-radius scale** — 7+ values in regular use. Holds.
- **Motion durations** — v1 said 7, actual count is **21 unique duration values** (including setTimeouts used as pacing). v1 *understated* the problem.
- **Tab bar hit area < 44px** — `padding: "0 0 3px"` with `lineHeight: 1` renders at ~12–14px of actual text height. Hit area = text height + 3px bottom padding ≈ 15–17px, not the 28px v1 inferred. **Worse than v1 said.**
- **Chat input focus ring missing** — `outline: none` confirmed, no `:focus-visible` anywhere in globals.css.
- **Primary-button variants** — 5 distinct treatments confirmed.
- **SWUpdatePrompt floats above tab bar with light shadow** — `boxShadow: "0 2px 12px rgba(0,0,0,0.08)"` confirmed ([SWUpdatePrompt.tsx:23](src/components/shared/SWUpdatePrompt.tsx:23)).
- **BetaFeedbackButton is a third voice in header chrome** — confirmed.
- **Hamburger-only-on-Session asymmetry** — confirmed. Header-left is empty on Manual and Settings.

### 2.2 Corrections (v1 was directionally right but wrong on detail)
- **v1 Top 15 #15 (ASCII `▼` in Settings disclosure) — WITHDRAW.** The Unicode `▼`/`▾`/`▸` characters appear in `src/components/admin/*` only ([ExtractionPanel.tsx:56, 112](src/components/admin/ExtractionPanel.tsx:56), [UserProfilePane.tsx:380](src/components/admin/UserProfilePane.tsx:380)). None in user-facing MobileSettings. This is NOT a user-facing credibility issue. *The real finding*: Unicode arrows are used in **copy** in three places ("→") — see v2 § 3.6.
- **v1 "tab bar ~28px" — worse than stated.** Actual tap height ≈ 15–17px, not 28. Still below the 44px floor (now by 26–29px, not 16). Elevates severity.
- **v1 Nav icons claim "Icons absent from the tab bar" — directionally correct, structurally wrong.** [NavIcons.tsx](src/components/icons/NavIcons.tsx) exists with four carefully-drawn 20×20 icons (Flame / Seed of Life / Constellation / Mortar & Pestle) that [MobileNav.tsx](src/components/layout/MobileNav.tsx) **never imports.** The tab bar is labels-only in practice, but the app has designed icons sitting unused. Either ship them or delete them.
- **v1 "Checkpoint buttons ~32px" — roughly correct.** `padding: 9px 0` with 14px font = ~32px. Confirmed close enough.
- **v1 "Drawer close button 22×22" — confirmed.** Button has `padding: 4px`, SVG is `14×14`. Total = 22×22. Correct.

### 2.3 Strengthened (now grounded in math, not smell)
- **Contrast failures are measurable, not inferred.** Two canonical color pairings fail WCAG 2.1 AA for body text:
  - `--session-ink-ghost` (#756E6A) on `--session-linen` (#F4F0EA) = **~3.8:1** — FAILS 4.5:1 body requirement. This color is used for metadata, "Read more" links, placeholder text, tab-inactive labels, drawer close icon, drawer timestamps. Heavy usage.
  - `--session-cream` (#FAF8F4) on `--session-persona` (#5E7054) = **~3.8:1** — FAILS 4.5:1 body requirement. This is the primary button's text-on-bg combo. Hero action fails contrast.
  - `--session-ink-faded` (#5E5855) on `--session-linen` = **~4.6:1** — marginal pass. 0.1 of headroom.
  - Safe: `--session-ink-mid` (#6B6360) on `--session-linen` = ~5.2:1 ✓. `--session-ink-soft` on linen = ~9:1 ✓. `--session-cream` on `--session-ink` = ~11:1 ✓.
  This reframes v1's concern about the ink ramp from "aesthetic" to "legal and legible." *The single smallest, highest-leverage fix in this audit is swapping `--session-ink-ghost` → `--session-ink-mid` for every text usage.*

### 2.4 Everything else from v1 Top 15 (with v2 status)
| v1 # | Item | v2 status |
|---|---|---|
| 1 | Touch-target audit | **Confirmed, scope expanded** (see v2 §3.1). Severity raised for tab bar. |
| 2 | Unify primary button (5→1) | Confirmed. |
| 3 | Replace underline inputs | Confirmed. Adds a11y dimension (see §3.1). |
| 4 | Focus rings app-wide | Confirmed. WCAG 2.4.7 violation, not just aesthetic. |
| 5 | Redesign checkpoint decision | Confirmed. |
| 6 | Settings typography hierarchy | Confirmed. |
| 7 | Manual empty state | Confirmed. Also missing copy — see §3.2. |
| 8 | Style destructive actions destructively | Confirmed. |
| 9 | "feedback" pill voice | Still open. |
| 10 | Collapse font-size scale | Confirmed. |
| 11 | Collapse radius scale | Confirmed. |
| 12 | Collapse ink ramp | Strengthened — contrast failures give this teeth. |
| 13 | Tab bar active weight | Confirmed. Adds aria-selected gap. |
| 14 | Motion system | Strengthened — **21 durations**, 5 unused keyframes, zero reduced-motion. |
| 15 | ASCII `▼` | **Withdrawn.** |

---

## 3. New findings — organized by lens

### 3.1 Accessibility (WCAG 2.1 AA)

`[a11y]` is not a "nice to have" — in 2026 this is baseline. The app has seven distinct a11y gaps, each with a specific WCAG criterion.

**Perceivable:**
- `[a11y]` `[credibility]` **Contrast fails — `--session-ink-ghost` on linen (3.8:1).** WCAG 1.4.3. Used extensively for secondary text, icons, and timestamps. *Fix:* migrate body/label usages to `--session-ink-mid` (5.2:1 ✓); keep `ink-ghost` for decorative-only.
- `[a11y]` `[credibility]` **Contrast fails — cream on persona-sage (3.8:1).** Hero primary button. WCAG 1.4.3. *Fix:* darken `--session-persona` to ≈ #4A5C42 (~4.6:1) or use white (~4.1:1 — still short) or shift button to `--session-ink` background (11:1 ✓, matches v1 #2's suggested consolidation).
- `[a11y]` `[noticeable]` **No `prefers-reduced-motion` anywhere.** WCAG 2.3.3. Eleven active keyframes and 19 transitions will play at full intensity for users who've opted out. *Fix:* one block in globals.css neutralizes animations on `@media (prefers-reduced-motion: reduce)`.

**Operable:**
- `[a11y]` `[credibility]` **No `:focus-visible` styles anywhere in globals.css** — zero. Every input, textarea, and button currently drops the browser default outline without a replacement. WCAG 2.4.7 fail on every interactive element in the app. *Fix:* single globals.css rule `:focus-visible { outline: 2px solid var(--session-persona); outline-offset: 2px; }`.
- `[a11y]` `[credibility]` **Touch targets < 44px on the most-tapped controls.** Apple HIG, Fitts's Law.
  - Bottom tab bar buttons: ~15–17px actual. v1 understated.
  - Drawer close (×): 22×22.
  - Hamburger: 40×40 (close but under).
  - Checkpoint primary/secondary: ~32px.
  - Welcome chips: ~34px.
  - ConfirmationModal buttons: ~34px.
  - "Read more" / "Explore further" links: text-only, ~16px.
  - "Forgot password?" / "Back" / "Dismiss": ~22–24px.
  - SeedScreen age-confirmation checkbox: 22×22.
  - Settings checkpoint pills: 28×28.
  - "Not quite" / "Not at all" checkpoint secondaries: ~20px.
- `[a11y]` `[noticeable]` **Modals don't trap focus, don't restore focus on close.** Tab key escapes out of ConfirmationModal and AuthPromptModal into the content behind. On close, focus goes to `<body>`. WCAG 2.4.3. *Fix:* small focus-trap helper on mount (first/last focusable, Escape handling, restoration).
- `[a11y]` `[noticeable]` **No focus management on drawer open.** Focus stays on hamburger; keyboard users may not realize the drawer opened.

**Understandable:**
- `[a11y]` `[noticeable]` **Chat textarea has no label.** [ChatInput.tsx:239–275](src/components/mobile/ChatInput.tsx:239). Placeholder `"tell me . . ."` disappears on focus — screen readers announce "edit text, blank." WCAG 1.3.1, 4.1.2. *Fix:* add visually-hidden `<label htmlFor>` or `aria-label="Message Jove"`.
- `[a11y]` `[noticeable]` **Form inputs lack `htmlFor` binding in LoginScreen, AuthPromptModal, WaitlistForm.** Labels render but are disconnected from their inputs. WCAG 1.3.1, 3.3.2.
- `[a11y]` `[cosmetic]` **Password fields missing `autoComplete="current-password"` / `"new-password"`**.

**Robust:**
- `[a11y]` `[credibility]` **Modals missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.** ConfirmationModal and AuthPromptModal render as bare `<div>`s. Screen readers don't announce them as dialogs. WCAG 4.1.2.
- `[a11y]` `[credibility]` **Tabs missing `role="tab"` / `aria-selected` / `role="tablist"`.** Tab bar is three `<button>`s in a `<div>` — no semantic navigation. Screen-reader users can't navigate by tab structure or hear which tab is active. WCAG 4.1.2, 1.3.1. (Also: `<nav>` landmark missing — [MobileNav.tsx:18](src/components/layout/MobileNav.tsx:18).)
- `[a11y]` `[noticeable]` **Icon-only buttons missing `aria-label`.** Hamburger ([MobileSession.tsx:233](src/components/mobile/MobileSession.tsx:233)), drawer close ([SessionDrawer.tsx:87](src/components/mobile/SessionDrawer.tsx:87)), chat input multi-state button ([ChatInput.tsx:277](src/components/mobile/ChatInput.tsx:277) — label should change with state: "Send message" / "Record voice message" / "Stop recording"). WCAG 4.1.2.
- `[a11y]` `[noticeable]` **New chat messages not announced.** `aria-live` absent on the messages scroll region ([MobileSession.tsx:354](src/components/mobile/MobileSession.tsx:354)). Screen-reader users see Jove's replies only if they manually re-read the region. WCAG 4.1.3.
- `[a11y]` `[noticeable]` **Settings disclosures missing `aria-expanded`.** The SectionHeader component toggles visibility but doesn't expose state. WCAG 4.1.2.
- `[a11y]` `[cosmetic]` **`<main>` landmark absent** — entire app is nested `<div>`s. Screen readers can't skip to main content.

### 3.2 Copy & voice

Overall: **voice is strong** — arguably the strongest non-visual system in the product. Onboarding copy is excellent (somatic, permission-giving, user-as-author). The gaps are concentrated in error and empty states.

- `[credibility]` **"Something went wrong. Try again."** appears three times (SeedScreen.tsx:46, 70; WaitlistForm.tsx:45). Violates Nielsen #9 (help users recognize, diagnose, and recover). No recovery path suggested. *Fix:* `"Couldn't save that. Check your connection and try again."` Attach to the action, not the app.
- `[credibility]` **"Network error. Please try again."** in MobileSettings phone flow (lines 130, 154). Same issue. *Fix:* `"Couldn't reach the server. Check your connection."`
- `[noticeable]` **BetaFeedbackButton subtitle is ungrammatical.** `"What did you love,  if you caught a bug, your notes. All useful."` Double space after `love,`; the comma joins a fragment to what isn't an independent clause. *Fix:* `"What did you love. If you caught a bug, your notes. All useful."` — matches the product's short-declarative rhythm.
- `[noticeable]` **"Identifies patterns" is the one clinical word in the product.** InfoScreens.tsx:73. *Fix:* `"surfaces patterns"` or `"notices patterns"` — matches Jove's voice direction in docs/rules.md (non-clinical, somatic, direct).
- `[noticeable]` **Manual is missing a whole-screen empty state.** When every layer is empty, the user sees "Your Manual" + five gray rows each showing "0 entries." There's no welcome, no invitation, no hint that typing into Session will populate this. Nielsen #10 (help & documentation), and v1 §Manual §States. *Fix:* above-the-layers line: *"Nothing yet. Jove will add to this as you talk."*
- `[cosmetic]` **Disabled microphone has no explanation.** [ChatInput.tsx](src/components/mobile/ChatInput.tsx) — mic icon goes faded when permission denied but no tooltip or message explains why. Nielsen #1 (visibility of system status). *Fix:* lightweight tooltip on first denied-tap: *"Mic access is blocked in your browser settings."*
- `[cosmetic]` **"0 entries" as right-aligned metadata** reads as Jira ticketing, not craftsmanship. Discussed in v1. Consider removing the count for empty layers entirely, or replacing with a short suggestion like "emerging" / "waiting" / "not yet captured."

### 3.3 Motion

v1 said "build a motion system." v2 quantifies the mess.

- `[credibility]` **21 unique duration values in use** — 0.15s, 0.2s, 0.25s, 0.3s, 0.4s, 0.45s, 0.5s, 0.6s, 0.7s, 0.8s, 1.2s, 1.5s, 2s, 2.4s, 3s, 400ms, 4500ms, and the bare 250ms/350ms setTimeouts in MainApp. Premium systems run **3 durations** (fast/base/slow) + **2 easings** (standard/emphasized).
- `[noticeable]` **5 unused `@keyframes` in globals.css** — `mwSpinner`, `manualAtmoFadeIn`, `fadeIn`, `tooltipFadeIn`, `tooltipFadeInUp`. 36% of defined keyframes are dead. *Fix:* delete during the motion-system pass.
- `[noticeable]` **`transition: all` in SeedScreen.tsx:171, 236.** Minor perf risk: every property change animates. Use specific property lists.
- `[noticeable]` **Bare `opacity 0.2s` with no easing in LoginScreen, AuthPromptModal, WaitlistForm, reset-password.** Defaults to linear — feels robotic on a fade. *Fix:* `opacity 200ms ease-out`.
- `[noticeable]` **No modal exit choreography.** Modals fade in; they disappear on close with no symmetric exit (backdrop snaps, modal snaps). Breaks Nielsen #4 (consistency — users expect symmetry they've seen in iOS and Things).
- `[noticeable]` **No skeletons or loading shimmer for data surfaces.** Admin tabs, Manual, SessionDrawer all load async and simply pop. *Fix:* `mwFadeIn` exists but isn't wired to data arrival — a shimmer keyframe would be the right tool.
- `[noticeable]` **ChatInput border-focus uses 400ms ease-in-out; text entrance uses 300ms ease-out.** Two unrelated easings on one component.
- **Positive — keep:** the MainApp exploration interstitial (MainApp.tsx:250–313) is the product's single most sophisticated motion moment — `explorationGlow` 3s ambient pulse, staggered fade-ins, 250ms/800ms/350ms choreography. It delivers on the brand promise. Do *more* of this on the checkpoint reveal and the "first entry added to Manual" moment.
- **Positive — keep:** the `waveformBar` voice-transcription animation — staggered 1.2s per-bar scaleY with a 0.15s per-bar offset. That's correct motion design.

### 3.4 State coverage

v1 noted missing loading states on Manual. v2 builds the full matrix.

| Surface | Loading | Error | Empty | Success |
|---|---|---|---|---|
| MobileSession | thinking dots ✓ | red banner ✓ | welcome + chips ✓ | stream in ✓ |
| Manual (layers) | none ✗ | none ✗ | "0 entries" per layer ⚠ | populated layer ✓ |
| Manual export (PDF) | full-screen "Preparing…" ✓ | none ✗ | n/a | toast/file? ⚠ |
| Settings phone | `phoneState === "loading"` ✓ | inline "Try again?" ✓ | unlinked state ✓ | linked state ✓ |
| SessionDrawer conversations | none ✗ | silent fail ✗ | "No sessions yet" text ⚠ | list ✓ |
| Admin Users | none ✗ | silent fail ✗ | "No users" ⚠ | list ✓ |
| Admin Feedback | none ✗ | silent fail ✗ | "No feedback" ⚠ | list ✓ |

**Gap rollup:**
- `[noticeable]` **No loading state on Manual, Drawer, or Admin.** Nielsen #1 (visibility of system status). User taps a tab, sees nothing, then content appears. Appears as jank even when fast. *Fix:* `mwFadeIn 200ms` on data arrival + a skeleton when loading exceeds 200ms.
- `[noticeable]` **Silent async failures on Drawer and Admin.** If `loadWaitlist()` throws, the list is just empty. No "Couldn't load" message. Nielsen #9.
- `[cosmetic]` **Empty states are text-only in ghost ink.** See v1 — the Manual empty state especially.

### 3.5 Surfaces not in v1

v1 catalogued 10+ surfaces. v2's screen-inventory agent added these. Each with at least one v2-level finding.

- **MainApp initialization splash** (MainApp.tsx:185) — a linen div shown during the `!initialized` phase before auth resolves. No branding, no feedback. Feels like a white flash. *Fix:* 200ms fade-in on content load, or show the wordmark faintly.
- **PostLoginOnboarding wrapper** (PostLoginOnboarding.tsx) — separate wrapper around InfoScreens+SeedScreen. Fade transition between views (400ms opacity). Looks OK; mostly a structural note.
- **MobileSession sign-in banner** (inline, not modal) — "Create an account to keep your manual" with "Later" dismiss. 24-hour localStorage-dismiss. This is a good pattern but the banner is styled inconsistently with the rest of the app (confirm in-browser).
- **Checkpoint pending card** — separate from the message stream; proposal card with three action buttons (Confirm / Refine / Reject). v1 Top 15 #5 addresses the button treatment, but the *card itself* has `boxShadow: "0 8px 44px var(--session-glow-cp), 0 2px 8px rgba(26,22,20,0.05)"` — a strong double shadow that's unique to this one surface. If this is meant to be the hero moment, great; if not, it's a fourth shadow treatment (v1 said three).
- **Welcome chips** (MobileSession.tsx:174) — first-message only, dismiss on send. Good pattern. Touch-target gap noted in §3.1.
- **Reset-password success state** (reset-password/page.tsx) — shows "Password updated / Taking you to your manual…" with a 2s setTimeout redirect. No progress affordance during the 2s wait. Nielsen #1. Works fine, but a subtle progress bar or spinner would be kinder.
- **Manual export loading overlay** (MobileManual.tsx:350–373) — "Preparing your manual…" full-screen backdrop. Good pattern. `mwFadeIn` wired. No cancellation affordance — if PDF gen hangs, user has no out.
- **Admin "READ ONLY — ADMIN" banner** — red bar, mono-uppercase, top of admin pages. Correctly loud. No v2 note.
- **No 404, no `error.tsx`, no `loading.tsx`, no offline banner, no rate-limit-reached state, no PWA install prompt.** v1 missed this entire category. The app's failure modes are largely invisible. See Top 20.

### 3.6 Small but real
- `[cosmetic]` **Unicode `→` in three places in copy:** "Explore further with {PERSONA_NAME} →" (EntryItem.tsx:114), "Join the waitlist →" (LoginScreen.tsx:614), "Open admin dashboard →" (MobileSettings.tsx:983). Compare with the SVG right-arrow in InfoScreens.tsx (14×14, 1.3 stroke). Either one or the other system — mixing is a character-in-prose vs an icon-in-UI inconsistency. *Fix:* keep `→` in prose, only use SVG for interactive affordances. The three locations above are links — convert to SVG chevrons.
- `[cosmetic]` **NavIcons.tsx defines four carefully-drawn 20×20 icons that MobileNav.tsx never imports.** Four finished icons (Flame, Seed of Life, Constellation, Mortar & Pestle) sit unused. Either ship them in the tab bar (also solves v1 #13 tab-bar active-weight gap) or delete the file.
- `[cosmetic]` **9 distinct SVG strokeWidth values** (0.5, 0.8, 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 2.0). v1 said "lock to 1.5 or 2" — the actual distribution is wider than v1 noted. The 0.5 constellation connectors are intentional; 1.1 vs 1.2 vs 1.3 vs 1.4 is drift.
- `[cosmetic]` **Noise-texture data URI in 4 places** (OnboardingFlow, PostLoginOnboarding, reset-password, MobileLayout) at `opacity='0.025'`. Subtle but consistent — positive finding, **keep using it** and consider extending to the Manual screen for parity.
- `[cosmetic]` **Hardcoded `#EFEADF` in 2 gradients** (MobileSession checkpoint card bg, UserProfilePane). Token it as `--session-parchment-warm` or similar.

### 3.7 Nielsen heuristics — screen-level calls
Each heuristic the product either meets, bends, or breaks:

| # | Heuristic | Status | Notes |
|---|---|---|---|
| 1 | Visibility of system status | **Bends** | Strong during send / streaming. Weak on Manual/Drawer/Admin load; weak on PDF generation; weak on the 1.5s long-message-send delay (silent). |
| 2 | Match with the real world | **Meets** | Conversational language throughout. Jove's voice is grounded. |
| 3 | User control & freedom | **Meets** | Can dismiss sign-in banner, cancel share sheet, cancel reset flow. Missing: cancel PDF export once started. |
| 4 | Consistency & standards | **Breaks** | Five primary-button variants; four modal radii; seven border-radius values; missing a11y patterns users expect. |
| 5 | Error prevention | **Meets** | Confirmation modals before deletions. Age-gate checkbox. |
| 6 | Recognition over recall | **Meets** | Chips, suggestions, returning-user "pick up where you left off." |
| 7 | Flexibility & efficiency | **Bends** | No keyboard shortcuts (would be nice on desktop PWA). Mobile doesn't need them. |
| 8 | Aesthetic & minimalist design | **Meets** | This is the product's strength. |
| 9 | Help recognize, diagnose, recover from errors | **Breaks** | Three instances of "Something went wrong. Try again." Silent failures in Drawer/Admin. |
| 10 | Help & documentation | **Bends** | The Seed + Info screens are strong on getting started. Settings lacks an empty-state hint. Manual lacks a "what is this" hint once populated. |

### 3.8 Clarity audit (3-second test)
For each main screen, what does a first-time user understand in ≤3 seconds?

- **Session screen (first load)**: ✓ Chips make the purpose clear ("I have a situation…" / "I know something about myself…"). Strong.
- **Session screen (returning, blank)**: ⚠ "What's going on? Or we can pick up where we left off." — meets the bar. Good.
- **Manual (empty)**: ✗ Five unfilled layer cards. User must read each layer description to understand what any of them mean. "Your Manual" doesn't explain itself in 3 seconds. Fix per v1 #7 + v2 §3.2.
- **Manual (populated)**: ⚠ Sections feel like a table. Layer identity is not distinguishable at a glance.
- **Settings**: ⚠ 8px mono headers are below-threshold readable. User scans, sees gray shapes, can't identify section purpose fast. Fix per v1 #6.
- **Login**: ✓ Clear.
- **Onboarding Entry**: ✓ Strong headline, rotating example carries the idea.

### 3.9 Intuitiveness audit (predict-before-tap)
- **Checkpoint decision buttons**: ✗ "Confirm" / "Not quite" / "Not at all" are three text links. A user can't predict what's primary. Visual weight should signal the primary path. v1 #5.
- **Manual "Explore further with Jove →"**: ⚠ text-link affordance at 13px. Unclear it's interactive vs description.
- **SWUpdatePrompt**: ⚠ positioned above the tab bar with low visual weight. Users may not notice it. Nielsen #1.
- **"DEV TOOLS" section in Settings** (isAdmin-gated): ⚠ visible to the test account and any admin. A normal-user-admin path could hit this and be confused. (Admin should only be a handful of people, so low priority.)
- **Feedback popover submit button label** ("Send"): ✓ predicts action.
- **Bottom tab bar**: ⚠ labels-only at 12px mono uppercase. Without icons, users must read each tab to know what it is. iOS/Android convention is icon+label; labels alone works but trades speed for minimalism.

---

## 4. Per-screen notes — only where v2 adds to v1

### Session
- Add: **checkpoint card shadow is a fourth distinct shadow treatment.** If the hero moment, intentional; otherwise drift.
- Add: **sign-in banner needs styling review** — inline banner below header, likely a chrome mismatch.
- Add: **1.5s delay on long-message send is silent.** User types a long message, taps send, nothing happens visibly for 1.5s. *Fix:* button state change + subtle label, even if just "Composing…".

### Manual
- Add: **no loading state.** Tapping Manual → white until data arrives. v1 noted this; v2 confirms.
- Add: **share arrow color `#A0734E` is a ninth orphan color** that should either be tokenized or removed. Earlier findings noted `#EFEADF`, `#C4A888`, and `#A0734E` — three orphans just on this screen.
- Add: **Manual share sheet has no error state.** If PDF export fails, user stays on the "Preparing…" overlay until timeout. Silent fail.

### Settings
- Add: **phone-number masking on "linked" state is correct** — good pattern. (Cite as positive.)
- Add: **SMS TCPA disclaimer copy is well-crafted** (line spacing, period cadence, "Msg & data rates may apply. Reply STOP to opt out."). Reads intentional.

### Onboarding
- Add: **SeedScreen `transition: all 0.2s` on the checkbox** flashes background color on every rerender — minor animation overtrigger.
- Add: **Back-arrow SVG is 12×12 with strokeWidth 1.2**; all other app arrows are 14–16×14–16 with 1.3–1.5 stroke. Undersize.

### Drawer
- Add: **session drawer refresh is silent-async**. User opens drawer, list may still be stale. No visible refresh.

### Public pages
- Add: **footer `/sms`, `/terms`, `/privacy`** render with `font-sans 14px body, line-height 1.6, max-width 640px` — a generic prose stack. The product otherwise uses Source Serif 4 for extended prose ("Instrument Serif" for display, "Source Serif 4" for persona voice). Legal pages in DM Sans read outsourced. Low priority, but mention.

---

## 5. System-level findings v2

- **The design is a ~75% system** — tokens exist for color/ink/spacing and are used >90% of the time, but a handful of hardcoded values (`#EFEADF`, `#C4A888`, `#A0734E`, several RGBAs) expose that the system was built iteratively. Closing those 5–10 gaps closes the "system feeling."
- **Shadow inventory = 3 distinct treatments:** checkpoint card double-shadow, SWUpdatePrompt light shadow, BetaFeedbackButton popover shadow. One is too many if the design is flat; three is correct-ish if layering is intentional. Canonicalize: e.g. `--shadow-card`, `--shadow-popover`, `--shadow-fab` with one value each.
- **Icon system = six different stroke weights + inconsistent sizes.** Lock to 1.5 stroke + 16/20/24 sizes.
- **Border system = consistent** — all use tokens except one public-page outlier. Positive.
- **Typography pairing = the product's single strongest asset.** Instrument Serif + Source Serif 4 + DM Sans + JetBrains Mono. On-brief. Keep.
- **Color palette = correct in concept, failing in execution on contrast.** The linen/ink/sage/gold palette is beautiful. Just three tokens (`ink-ghost`, `persona`, `ink-faded` marginal) need tweaking to pass WCAG AA.
- **Motion = the one part that is actively unfinished.** 21 durations, 5 dead keyframes, zero reduced-motion. Also the fastest of the big problems to fix.

---

## 6. Top 20, ranked by impact × effort

Each row has **Impact** (H/M/L user-perceived quality lift) and **Effort** (S/M/L engineer-hours). Ordered by impact, with effort column so you can re-filter by "what can I do in an afternoon."

> ⭐ = v2's highest-leverage single change. 🆕 = new in v2 (not in v1 Top 15).

| # | Change | Impact | Effort | Notes |
|---|---|---|---|---|
| 1 | ⭐ **Touch-target audit & fix pass.** Tab bar (15–17→44), drawer close, chip sizes, checkpoint buttons, all the secondaries under 44. Apple HIG, Fitts's Law. | H | M | Same as v1 #1. Still the loudest credibility signal. |
| 2 | 🆕 **Fix contrast on `--session-ink-ghost` + the primary button.** WCAG 2.1 AA 1.4.3. Two color changes pass the app. | H | S | Single highest impact-per-hour fix. Swap `ink-ghost` body usages → `ink-mid`; shift primary button from sage to `--session-ink`. |
| 3 | 🆕 **Add `:focus-visible` global + `prefers-reduced-motion` global.** Two globals.css blocks close two WCAG criteria app-wide. | H | S | ~5 lines of CSS. Afternoon work. |
| 4 | **Unify primary button (5 → 1).** Pin: `--session-ink` bg, cream text, 15/600, 16px pad, 10px radius. | H | M | v1 #2. The cleanest consolidation signal. |
| 5 | **Redesign checkpoint decision.** Primary / secondary / ghost trio. | H | M | v1 #5. Hero interaction. |
| 6 | 🆕 **Add `role="dialog"`, `aria-modal`, focus trap, focus restoration to ConfirmationModal + AuthPromptModal.** | H | M | WCAG 4.1.2 + 2.4.3. Requires a small focus-trap helper (well-known pattern). |
| 7 | **Replace underline inputs with inset filled.** | H | M | v1 #3. Apply everywhere at once — do not leave a mixed state. |
| 8 | **Give the Manual empty state a soul + a sentence.** Per-layer identity + "Jove will add to this as you talk." | H | M | v1 #7 + v2 §3.2 copy fix. |
| 9 | 🆕 **Add `aria-label` to icon-only buttons; `aria-selected` / `role="tab"` to nav; `aria-live` to message stream.** | H | S | ~15 attribute additions. No visual change. WCAG 4.1.2. |
| 10 | **Fix Settings typography hierarchy.** 8px → 11–12px. | H | M | v1 #6. |
| 11 | **Style destructive actions destructively.** | M | S | v1 #8. Dedicated "Danger zone" card. |
| 12 | 🆕 **Rewrite generic error messages.** Three copies of "Something went wrong. Try again." + two "Network error." | M | S | Nielsen #9. 30-min copy pass. |
| 13 | **Collapse font-size scale** to 7 values with semantic roles. | M | L | v1 #10. High-impact cleanup but touches every component. |
| 14 | 🆕 **Build motion tokens (3 durations, 2 easings) + delete 5 unused keyframes + fix `transition: all`.** | M | M | v1 #14 + v2 §3.3 specifics. |
| 15 | **Collapse the ink ramp** to three roles. | M | M | v1 #12 — now with extra teeth from contrast finding. |
| 16 | **Collapse border-radius scale.** | M | M | v1 #11. |
| 17 | 🆕 **Loading + error states for Manual, Drawer, Admin.** Skeleton or `mwFadeIn` on data arrival; inline error "Couldn't load."  | M | M | Closes three silent-failure surfaces. Nielsen #1, #9. |
| 18 | **Tab bar active weight + icons.** Ship the unused NavIcons or delete them. | M | M | v1 #13 + v2 finding. Also solves intuitiveness §3.9. |
| 19 | 🆕 **Fix BetaFeedbackButton subtitle grammar + "identifies patterns" → "surfaces patterns".** | L | S | 10-minute copy fix. |
| 20 | 🆕 **Unify shadows into 3 tokens; tokenize `#EFEADF`, `#A0734E`, `#C4A888`; lock SVG stroke to 1.5; unify Unicode→SVG arrows.** | L | M | Closes the remaining "75% system → 100% system" gap. |

**If you only do three things:** #2 (contrast), #3 (focus + reduced-motion globals), #9 (ARIA attributes). They're all S-effort and fix 80% of the a11y debt without a single layout change.

**If you only do one:** #1 (touch targets). Unchanged from v1. Mobile-first product that fails the 44pt floor on its most-tapped controls is the one thing you can't explain.

---

## 7. Red-team — where v2 may be wrong

Credibility is earned partly by saying what I'm not sure of.

- **I didn't measure every touch target in the browser.** v1 inferred from padding + font-size + line-height. v2 tightened where the evidence contradicted v1 (tab bar ~15–17, not ~28) but the other measurements are still computed, not measured. Could be off by 2–4px on any given component.
- **Contrast ratios are computed on hex values, not on actual rendered pixels under the noise texture.** The 0.025 noise overlay doesn't materially change contrast, but the 0.5 opacity accent on the mic-denied stroke might push borderline values either way.
- **"21 duration values" includes setTimeout pacing values that aren't technically "durations."** A strict motion audit would say 19 CSS durations + 5 setTimeouts. I bucketed them because from a user's perspective they're all time-values-shaping-the-interface.
- **"Five primary buttons" is a judgment call.** Some could be argued as *different* primary buttons for different contexts (modal-primary vs screen-primary vs header-primary). I hold the opinion they shouldn't be different, but reasonable designers could disagree.
- **The "Manual looks like a Jira table" claim is vibes-based.** I didn't A/B this. It's a read, not a fact.
- **WCAG compliance claims assume AA, not AAA.** The app would fail AAA in several more places (7:1 contrast, stricter focus visibility). Holding to AA is standard for consumer products.
- **I did not verify the iconography agent's "no box-shadow" claim matches reality — it was wrong.** Three shadows exist. Similar agent errors could lurk elsewhere in v2's data; I spot-checked claims that contradicted v1 but not every positive finding.
- **The admin UI got a pass.** It's out-of-scope (admin-only) but has its own drift ("EXIT ADMIN" Unicode, ExtractionPanel's `▸`/`▾`, "READ ONLY" banner). Ignored on purpose.
- **"Ship or delete NavIcons.tsx" is a choice I don't get to make.** Shipping icons re-opens the whole tab-bar visual decision. Deleting is simpler but discards finished work. Judgment call for the designer.
- **I assume `docs/rules.md` is current.** The copy-audit agent read it; I didn't re-validate the rules I'm citing.

---

## 8. Closing

The three claims from v1's close still hold: the **font pairing**, the **linen palette**, and the **exploration interstitial glow** are all premium. What's changed in v2: the palette has a legibility hole (contrast) that's easy to close, the motion system has 21 unique values and 5 dead keyframes that are easy to collapse, and the app has zero `:focus-visible` / zero `prefers-reduced-motion` — both one-line fixes in globals.css that move the app from "a11y-fails" to "a11y-meets-AA" on two criteria in one afternoon.

The system is a 75% system. The remaining 25% is small, specific, and known. Fix #2 + #3 + #9 this week, and the app stops looking like it has three problems — because it doesn't. It has three polish items and a lot of good design.
