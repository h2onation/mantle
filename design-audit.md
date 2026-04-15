# mywalnut — Visual Design Audit

**Scope:** Visual design only. Every user-facing screen, modal, and shared component. Evaluated against a premium-consumer bar (Linear, Things 3, Arc, Raycast, Superhuman), not an MVP bar.

**Path note:** The prompt requested `/home/claude/design-audit.md`, which does not exist on this macOS host. File written to the worktree root instead.

**Severity legend**
- `[cosmetic]` — nitpick, power users or designers will notice
- `[noticeable]` — normal users register it subconsciously; contributes to a "this feels off" perception
- `[credibility]` — actively reads as unfinished / default / generic; hurts trust

---

## Foundation — tokens, fonts, globals

**Fonts (layout.tsx:8–30)** — Instrument Serif + DM Sans + Source Serif 4 + JetBrains Mono. This pairing is genuinely distinctive and on-brief for a conversational, thoughtful product. It is the strongest part of the design system. Keep it.

**Color tokens (globals.css:5–51)** — Cohesive "linen" palette (three warm surfaces, eight-step ink ramp, sage-green accent, terracotta error, gold glow). Palette itself is a strong concept.

### Foundation issues

- `[credibility]` **Font-size inventory is out of control.** Tokens define four sizes (12/15/17/22). Components use at least sixteen distinct sizes in practice: `8, 10, 11, 12, 13, 13.5, 14, 15, 15.5, 16, 17, 18, 20, 22, 24, 26, 28, 34`. Premium systems run 5–7. **Premium looks like:** Linear uses ~6 sizes total with clear semantic roles. Collapse to a typographic scale.
- `[noticeable]` **Ink ramp has five near-adjacent shades** (`ink-soft #3D3632`, `ink-persona #524C47`, `ink-user #4A4440`, `ink-mid #6B6360`, `ink-faded #5E5855`). `ink-faded` is actually darker than `ink-mid` — the naming implies the opposite. Mental-model breaks when designers-in-training maintain this. Collapse to three: primary / secondary / muted.
- `[noticeable]` **Hardcoded RGBAs bypass the token system.** Examples: `rgba(200,185,140,0.18)` (manual scroll gradient, MobileManual.tsx:109), `rgba(200,191,180,0.5)` (interim voice text, ChatInput.tsx:272), `rgba(181,86,77,0.5)` (mic denied stroke, ChatInput.tsx:378), `rgba(94,112,84,0.1)` (checkpoint divider, MobileSession.tsx:483), `rgba(26,22,20,0.08)` (MobileLayout border, duplicates `--session-ink-hairline`). Several duplicate values that already have tokens (`#1A1614` appears literally though `--session-ink` exists; `#FAF8F4` duplicates `--session-cream`; `#4A4440` duplicates `--session-ink-user`). Either tokenize or stop using tokens — the current hybrid is worse than either.
- `[cosmetic]` **"Uppercase label" letter-spacing varies between 1.5px / 2px / 3px / 4px** with no semantic pattern. Tabs get 1.5, form labels 2, drawer header 3, wordmark 4. Pick 2 values (e.g. 1.5 for small caps in-context, 4 for wordmark).
- `[noticeable]` **Border-radius has seven different values in regular use** (2, 6, 8, 10, 12, 16, 20, 999). Premium systems run 3–4. Pick a scale (e.g. 6 / 10 / 16 / pill) and enforce it.
- `[noticeable]` **No motion system.** Transitions use `0.2s`, `0.25s`, `0.4s`, `0.5s`, `250ms`, `350ms`, `400ms` interchangeably. Easing is almost always `ease` (browser default) rather than a curated curve. Premium apps define 2–3 canonical durations + 1–2 easings.
- `[credibility]` **Scrollbars are the OS default everywhere except the one place globals.css styles them** (4px, hairline thumb). Firefox and many mobile browsers still show native scrollbars inside SessionDrawer's session list. The inconsistency is more jarring than fully-native would be.

---

## Session screen — `src/components/mobile/MobileSession.tsx`

This is the hero surface. Everything here is disproportionately important.

### Typography
- `[credibility]` **The wordmark at 13px with 4px letter-spacing is beautiful** (MobileSession.tsx:265–271) — but the new "feedback" pill button in that same header is **DM Sans lowercase at 12px with zero letter-spacing**. These two pieces of chrome on the same horizontal line don't belong to the same language. **Premium looks like:** Things 3 header — all chrome lives in one font, one case-treatment.
- `[noticeable]` **User message text** is 15.5px DM Sans (MobileSession.tsx:735–740). A half-pixel size is a strong smell of "tweaked until it looked right" rather than a scale. Use 15 or 16.
- `[cosmetic]` **Persona label** uses mono lowercase with 1.5px letter-spacing (line 23). Drawer header uses mono UPPERCASE with 3px. Two mono-label conventions for similar roles (category / header).

### Color
- `[noticeable]` **Checkpoint card gradient hardcodes `#EFEADF`** (MobileSession.tsx:422) — a paper shade that isn't in the token system. It reads as "someone eyedropped from Figma once". Tokenize.
- `[cosmetic]` Scroll-fade gradient (line 348) mixes `var(--session-glow-scroll)` with a hardcoded `rgba(200,185,140,0.08)`. The 0.08 should derive from the glow token.

### Spacing
- `[noticeable]` **Messages area uses `gap: 14px`** (line 363), welcome block uses `padding: 16px 18px 14px` (line 140 — asymmetric), checkpoint uses `padding: 16px 16px 14px` (line 426 — also asymmetric). The mixing of 14 and 16 reads as two passes by two people. Pick 16 or 12 and stay disciplined.
- `[cosmetic]` Checkpoint divider has `padding-top: 12px` and `margin-top: 18px` (lines 481–482). Two spacing knobs doing similar work — confusing.

### Layout
- `[noticeable]` **Header horizontal padding is `12px 24px`** (line 228) while the bottom nav is `14px` top / `20px + safe-area` bottom (MobileNav.tsx:27–28) and messages area is `20px 16px 4px` (line 362). Three different horizontal rhythms on one vertical stack. Eye reads this as "screens stitched together".

### Touch targets (mobile-critical)
- `[credibility]` **Bottom tab buttons** (MobileNav.tsx:40) are `padding: 0 0 3px` with no height — inferred ~28px. On iOS guidelines say 44, Android says 48. Missing both by ~16px. These are the single most-tapped interactive elements in the app. **Premium looks like:** Tapping Linear's tab bar — you can be sloppy. Here you need aim.
- `[credibility]` **Checkpoint buttons** (MobileSession.tsx:514) are `padding: 9px 0` — ~32px tall. The single most consequential decision moment in the app, styled with a borderline-reachable target.
- `[credibility]` **Welcome chips** have no explicit height, rely on `padding: 10px 16px` (line 197) — inferred ~36px. Borderline.

### Component styling
- `[noticeable]` **Welcome chips (radius 20), checkpoint card (radius 8), persona bubble (12)** — three radii in three adjacent surfaces. Arc would pick one and commit. **Premium looks like:** Things 3's single 10px radius or Superhuman's 4px — same shape language everywhere.
- `[noticeable]` **Checkpoint "Confirm" / "Refine" / "Reject" buttons are text-only** (lines 525–568) with zero visual weight. For the single most important moment in the product (a user deciding whether to accept something into their Manual), three unstyled text links does not read as a premium decision surface. **Premium looks like:** a primary button with real weight, a secondary with outline, a tertiary text link. Superhuman's keyboard-shortcut hints would also fit here well.
- `[credibility]` **Retry button** in the error state (lines 831–839) — `background: none; border: none` bare text. Default browser button. Every other product has designed error retry.

### States
- `[credibility]` **Chat input textarea has `outline: none` and no replacement focus ring** (ChatInput.tsx:260–261). Keyboard users have no indication of focus. This is a WCAG failure and a design smell. **Premium looks like:** Raycast's subtle inner glow on the command input.
- `[noticeable]` **No hover/pressed states** on welcome chips (MobileSession.tsx:195–202), menu button, checkpoint secondary buttons. On mobile this is less critical, but the app is also a PWA shown on desktop — and the absence reads as "no interaction design pass".

### Micro details
- `[cosmetic]` **Send button is `border-radius: 50%`** (ChatInput.tsx:344) while the action button wrapper is `44×44` with no radius (lines 286–287). Two radius approaches in the same component.
- `[cosmetic]` **Icon strokeWidth varies**: hamburger lines are 1.5 (MobileSession.tsx:250–259), chat send arrow 2 (ChatInput.tsx:360), mic 1.5, drawer close 1.5, share arrow 1.4 (MobileManual.tsx:213). Premium systems lock to 1.5 or 2.

---

## Manual screen — `src/components/mobile/MobileManual.tsx` + `manual/*.tsx`

### Typography
- `[credibility]` **Title "Your Manual"** is serif 26px tight (line 125). Sibling tab Settings uses mono UPPERCASE "SETTINGS" as its title. These are supposedly peer screens — they need the same title treatment or a clearly-different one on purpose. Current state reads as two designers, two moods.
- `[cosmetic]` **Section h2** (EmptyLayer.tsx:26–38, PopulatedLayer.tsx:36–48) is DM Sans 16/500 with `letter-spacing: -0.1px`. Negative letter-spacing at 16px is imperceptible — it's cargo-cult from display sizes.

### Color
- `[credibility]` **Intro modal "Talk to Jove" primary button uses `--session-persona` (sage)** (MobileManual.tsx:435–452). Manual's share-button text uses `#A0734E` (a warm brown, lines 189–215). Two brand-primary colors on the same screen. Which is the accent?
- `[noticeable]` **Disabled state uses `#C4A888`** (MobileManual.tsx:316) — a sandy brown that appears nowhere else in the token system. Orphaned color.

### Spacing & Layout
- `[credibility]` **Vertical rhythm drifts**: section margin-bottom is sometimes 32px (EmptyLayer.tsx:15), sometimes 40px top + 24px bottom (MobileManual.tsx:159). Share section uses `padding: 1.25rem` (mixing `rem` and `px` in the same file, line 160). **Premium looks like:** Linear — everything snaps to 4px or 8px.
- `[noticeable]` **Five Manual layers (Patterns / Process / Helps / Show Up / Strong) are visually identical** — same type, same gray border, same everything. Each layer has a distinct concept; the visual design treats them as rows in a table. **Premium looks like:** Things 3's lists have subtle icons, Notion's databases use color accents, Superhuman has label pills. A single character sigil or 2-3px color bar per layer would give each an identity.
- `[noticeable]` **Entry count "0 entries"** — displaying a count of zero is awkward for empty states. **Premium looks like:** "Not yet captured" / "Jove hasn't picked this up yet" / icon-only. Zero-counts in right-aligned metadata is a Jira pattern.

### Touch targets
- `[noticeable]` **"Read more" and "Explore further" are 13px text buttons with zero padding** (EntryItem.tsx:69–116). They're indistinguishable from the body copy itself except for ghost-ink color. User is expected to tap accurately on small prose.
- `[noticeable]` **Sheet "Cancel" and intro "Dismiss" buttons** use `padding: 10px` — ~34px tall (lines 330, 459). Both are secondary actions on critical flows, under the 44px floor.

### States
- `[credibility]` **Empty state is just `0 entries` in light gray** (EmptyLayer.tsx). No illustration, no invitation, no copy, no icon. The Manual is the product's one deliverable — the empty version should feel like an intentional waiting room, not a blank table. **Premium looks like:** Things 3's "No to-dos" illustrated state; Notion's templated blank databases.
- `[noticeable]` **No loading state for Manual**. When the Manual is fetching, the screen is presumably blank or shows cached. No skeleton, no spinner.

### Cohesion
- `[noticeable]` **Share section uses a faint `rgba(0,0,0,0.03)` gray block** (line 161) — this is the only surface in the app that uses "slightly darker than background" shading. It floats. Either commit (use `--session-parchment`, which exists) or remove.

---

## Settings screen — `src/components/mobile/MobileSettings.tsx` + `SettingsRow.tsx`

### Typography
- `[credibility]` **Section headers are 8–10px mono at 500 weight** (lines 32–36, 325–329, 805–810). 8px is below iOS minimum readable size for metadata, let alone a section header. This reads as "placeholder until a real designer arrives". **Premium looks like:** 11px or 12px minimum. Arc's settings headers are 13px. Raycast's are 12px. 8px is terminal-emulator energy.
- `[credibility]` **SettingsRow title is 13px** (SettingsRow.tsx:50–55). Most of the settings screen is body-level content shown at metadata size. Feels cramped.
- `[noticeable]` Metadata subtitle uses `--size-meta` (12px) mono with 0.5px letter-spacing (SettingsRow.tsx:62–66). Mono at 12px for "devtest@test.com" reads as telemetry. An email address should be sans-serif and legible.

### Color & Layout
- `[noticeable]` **Settings has no page title hierarchy.** Manual opens with serif 26px "Your Manual". Settings opens with mono 8px "SETTINGS". If both tabs own similar cognitive weight, they should get the same title gesture.
- `[cosmetic]` **DEV TOOLS** visible to the logged-in test user. Sure, it's a test account — but seeing a "DEV TOOLS" header on production settings dilutes the final visual pass.

### Component styling
- `[credibility]` **"Delete user data" and "Delete account"** are styled identically to "Log out" — same 13px row, same position, no destructive visual treatment. These are dangerous actions; they should read as dangerous. **Premium looks like:** Linear uses red text for destructive; Arc puts destructive behind a one-more-tap; Superhuman uses an inset destructive card.
- `[noticeable]` **Account section disclosure caret (`▼`)** is ASCII. Every other icon in the app is SVG. Using a text arrow character is a framework-default tell.
- `[credibility]` **Checkpoint pills are 28×28px squares with 6px radius** (MobileSettings.tsx:820–836). 28×28 is a fingernail-wide target. On a settings control you will tap them maybe twice per session — still, 44×44 is the floor.

### States
- `[noticeable]` **No disabled-state hierarchy.** Disabled buttons go to `opacity: 0.5` (lines 540, 606, 853). Opacity-based disable is the default-Tailwind approach. Premium apps use desaturated color + muted border, not a translucency filter.

---

## Onboarding — EntryScreen, LoginScreen, InfoScreens, SeedScreen, PostLoginOnboarding

### Typography
- `[noticeable]` **EntryScreen H1 is 34px serif** (EntryScreen.tsx:75–82) — LoginScreen H1 is 28px (lines 321–326), AuthPromptModal H1 is 24px (lines 81–84), info labels are 8px mono. The auth surfaces use a compressed type scale that doesn't match the landing's breath. A user entering via modal loses the editorial gesture the landing promised.
- `[cosmetic]` **Form labels are 8px mono with 2px letter-spacing** (LoginScreen.tsx:347–357 and six other places). 8px is too small for a label — user has to trust memory of what the field is. **Premium looks like:** 11–12px; let the spacing and case do the work, not the compression.

### Color
- `[noticeable]` **"Continue" button on InfoScreens uses `--session-persona-soft`** (line 97 in its styles), not `--session-persona`. Every other primary CTA in the product uses the darker `--session-persona`. The softer tone on the onboarding CTA reads as "less primary" right when the user needs the most confidence.

### Form fields
- `[credibility]` **Inputs are transparent with a 1px bottom underline.** This Google-Material-2014 pattern is now a tell — "the app uses the default material-design input". Arc/Linear/Superhuman abandoned this years ago for either boxed inputs with subtle fills or rigorously custom solutions. With Source Serif 4 and Instrument Serif in the rest of the product, underline inputs feel beneath the typography. **Premium looks like:** Raycast's inset fills on `rgba(0,0,0,0.04)` with 1px internal border — matches the linen palette beautifully.
- `[credibility]` **`outline: none` with no replacement focus ring on every input** (LoginScreen.tsx:376, 414, 649; AuthPromptModal.tsx:149, 186; WaitlistForm.tsx:146, 187). Border-bottom color shifts on focus via inline `onFocus`/`onBlur` — that's a JS-driven focus ring, which is fragile. Keyboard focus order is invisible to sighted keyboard users.

### Touch targets
- `[noticeable]` **"Back" button, "Forgot password?" link, "Dismiss" button** — all under 44px.
- `[credibility]` **Checkbox in SeedScreen is 22×22** (lines 156–172) — the consent checkbox for the product's core claim. A user needs to reach confidently. **Premium looks like:** 28px visual + 44px invisible hit area.

### Buttons (cross-screen)
- `[credibility]` **Primary-button definition drifts across screens:**
  - LoginScreen / AuthPromptModal / SeedScreen / WaitlistForm / Reset-password: `--session-persona` bg, cream text, 16px padding, 8px radius
  - InfoScreens: `--session-persona-soft` bg, cream text, 12px 28px padding, 8px radius (lighter color, smaller padding)
  - BetaFeedbackButton (new): `--session-ink` bg, cream text, mono 600, 6px radius, 7px 14px padding
  - Manual intro: `--session-persona` bg, cream text, 14px padding, 12px radius
  - Manual share sheet "Export": white on `#A0734E` brown, 16px padding, 10px radius

  Five primary buttons, five different treatments. Most users never see all five — but the lack of a single primary-button style is the clearest system-level gap in the app.

### Layout
- Positive: onboarding screens share a layout grammar (wordmark top, spacer, 28px horizontal padding, bottom nav). That coherence is good. Keep it. Extend to all non-tab surfaces.

---

## Session drawer — `src/components/mobile/SessionDrawer.tsx`

### Typography
- Good: "SESSIONS" header in mono 3px spacing, session title 13px sans, metadata in mono — clear three-tier hierarchy.

### Layout
- `[credibility]` **Close button (×) is a 14×14 SVG with 4px padding** (lines 96, 93) — the click region totals 22×22. This is the primary way to dismiss the drawer. Tapping it requires aim.
- `[noticeable]` **Session rows use a 2px left border for the active session** (line 148). A 2px colored stripe on the left edge of a list item is a VS Code / Slack pattern — correct but dated. Premium apps use a filled background tint (Linear) or an icon marker (Superhuman).

### States
- `[noticeable]` **Session drawer empty state is "13px ghost text"** (lines 213–215). No artwork, no invitation.
- `[noticeable]` **`TEXT` badge** (lines 173–177) — mono 12px ghost text with no container. Labels should look like labels (pill with subtle bg). Bare uppercase letters look like placeholders.

---

## Modals

### BetaFeedbackButton popover (just updated)
- `[cosmetic]` The success state padding is `16px 4px` — asymmetric. Use `16px` symmetric.
- `[cosmetic]` The retry state button is styled like the send button (dark, cream). The popover now has zero chrome on its error message — no icon, no accent. Could be the only time the user sees `--session-error` color.

### ConfirmationModal
- `[noticeable]` **Both buttons are outlined** (lines 66, 83–85). No visual primary vs secondary hierarchy. User tapping "Confirm delete" has to read the text — no color tells them they're about to confirm. **Premium looks like:** filled destructive button (red bg) + ghost cancel, or the reverse.
- `[noticeable]` **Radius is 16px** (line 38) — different from feedback modal (12), intro modal (12), auth modal (12), sheet modal (20). Four different modal radii.

### AuthPromptModal
- `[noticeable]` **Backdrop uses `--session-backdrop-heavy` (0.6 black)** (line 60) while ConfirmationModal also uses 0.6. Fine. But the sheet uses a different backdrop pattern. Pick one backdrop token.
- `[cosmetic]` Dismiss button is `padding: 4px 8px` (line 284) — a 13px text link with 8px wide hit area. Tiny.

### SWUpdatePrompt
- `[credibility]` **Floats at `bottom: 72px + safe-area`** (line 12) — directly above the tab bar. "You're reading this because something is new" — but the visual weight (12px 16px pad, 12px radius, light shadow) doesn't announce it. Competes with the tab bar rather than sitting with it. **Premium looks like:** Linear's system messages slide in from the top-right with weight; SWUpdate pills in Gmail have a distinctive pill + color.

### Manual intro modal
- The copy is warm ("Talk to Jove"). The button styling is a fourth primary-button variation. Align with the canonical primary.

### Manual share sheet
- `[noticeable]` **Drag handle is `width: 36px, height: 4px, border-radius: 2px`** (line 258 area, implied from agent output). This is the iOS modal affordance. It works. But `2px` radius in a component otherwise using `20px` radius reads as a lone exception.

---

## Header chrome (top bar across app)

- `[credibility]` **The new "feedback" pill button doesn't belong to the same type family as the wordmark and hamburger.** Wordmark is Instrument Serif 13px lowercase with 4px spacing (refined, editorial). Hamburger is a thin 1.5px stroke (structural, quiet). "feedback" pill is DM Sans 12px lowercase, 0 spacing, with a visible border (asserting, utility). Three competing voices in 40 vertical pixels. **Premium looks like:** either match the wordmark case (lowercase serif "feedback" without border), or match the mono-UPPERCASE label convention used for tabs/categories ("FEEDBACK" tiny mono). Either removes the clash.
- `[noticeable]` **Hamburger appears on Session only, not on Manual or Settings** (visible in screenshots). The header's left slot is empty on two of three tabs. An asymmetric header is a choice; asymmetric on half the tabs is drift.

---

## Bottom tab bar — `src/components/layout/MobileNav.tsx`

- `[credibility]` **Tab hit area ≈28px** — already called out.
- `[noticeable]` **Active tab indicator is a 1px bottom border** (line 44). At 12px type with 1.5px letter-spacing, the underline is thin — hard to see from across the room, and visually ambiguous vs the serif descenders. **Premium looks like:** Things 3 fills the active tab with an icon + label both color-shifted; iOS guidelines pair icon + label with color delta.
- `[noticeable]` **Icons are absent from the tab bar.** Labels-only is a legitimate choice for a minimalist app — but combined with serif uppercase at 12px, the bar reads as section titles rather than navigation. iOS/Android users expect tab = icon + label.

---

## Exploration interstitial — `src/components/MainApp.tsx:250–312`

- **Positive.** The radial sage glow with `explorationGlow` 3s animation and staggered fade-ins is the most intentional visual moment in the app. It delivers on the brand promise. Do more of this elsewhere (empty states, checkpoint reveal, seed confirmation).

---

## Public pages — `/terms`, `/privacy`, `/sms`, `/reset-password`, `/waitlist`

- `[noticeable]` **`/terms`, `/privacy`, `/sms` use `font-sans 14px body, line-height 1.6, max-width 640px`** (lines 22–25 terms). This is a generic prose stack. The app otherwise pairs Source Serif 4 for long prose (the persona voice). Using DM Sans for terms content makes the legal pages feel outsourced.
- `[cosmetic]` **Lists use `padding-left: 20px`** (terms line 121) — browser default indent.
- `[cosmetic]` **Footer border** is `1px solid --session-ink-hairline` (line 275) — that's consistent. Good.

---

## Cross-screen inconsistencies — named once

- **Primary button (5 variants)** — see Onboarding § Buttons.
- **Section / page title (3 grammars)** — serif 26px title case (Manual), mono 8px UPPERCASE (Settings), serif 28–34px title case (onboarding). Sibling tabs should share a grammar.
- **Modal radius (4 values)** — 10 / 12 / 16 / 20.
- **Touch targets <44px** — tab bar, checkpoint buttons, drawer close, sheet cancel, dismiss, checkbox, settings pills, "Read more" / "Explore further" entry-item links.
- **Focus rings missing** — every input in the app, every button not specifically handled.
- **Hover states missing** — most buttons outside BetaFeedbackButton (new).
- **Uppercase-label letter-spacing (4 values)** — 1.5 / 2 / 3 / 4px.
- **Radius scale (7 values)** — 2 / 6 / 8 / 10 / 12 / 16 / 20 / 999.
- **Motion durations (7 values)** — 0.2s / 0.25s / 0.4s / 0.5s / 250ms / 350ms / 400ms.
- **Disabled treatment** — sometimes opacity 0.5, sometimes opacity 0.7, sometimes color swap. No rule.
- **Font sizes (16+ values)** — collapse to a scale.

---

## Top 15 changes, ranked by impact on perceived quality

> **#1 is the single highest-leverage change. Everything else follows.**

1. ⭐️ **`[credibility]` Touch-target audit & fix pass across the app.** Tab bar (~28px), checkpoint buttons (~32px), drawer close (22×22), sheet cancel (~34px), dismiss (~22px), checkbox (22×22), settings pills (28×28), "Read more" links, onboarding Back/Forgot links. A mobile-first PWA that fails to meet the 44×44 floor on its most-tapped controls is the single loudest credibility signal. *Fix first — nothing else matters if users mis-tap.*
2. **`[credibility]` Define one primary button, delete the other four.** Five variants across five flows is the clearest "multiple designers, no system" smell. Pin: `--session-persona` bg, cream 15/600, 16px padding, 10px radius, hover darken. Use it everywhere; ghost + destructive as the only siblings.
3. **`[credibility]` Replace the form-input underline pattern** (LoginScreen / Auth / Waitlist / Reset / Settings) with an inset filled input (subtle `rgba(0,0,0,0.04)` fill, 1px `--session-ink-hairline` border, 8px radius, real focus ring). Material-2014 underlines are the single most dated UI pattern in the app.
4. **`[credibility]` Add real focus rings app-wide.** `outline: none` with no replacement is both a design smell and a WCAG 2.1.4.11 failure. Pick: 2px offset-2 `--session-persona-soft` ring, applied to `:focus-visible` on every interactive element.
5. **`[credibility]` Redesign the checkpoint decision moment.** Confirm / Refine / Reject are currently three unstyled text links at the most important decision point in the product. A proper primary + secondary + ghost trio (with the confirm primary at full weight) would transform the product's hero interaction.
6. **`[credibility]` Fix Settings page typography hierarchy.** 8px mono section headers, 13px row titles. Take titles to 16px sans 600, section headers to 11px mono 500 with `--session-persona` color, metadata to 12px mono ghost. The bar here is Arc or Linear settings.
7. **`[credibility]` Give the Manual empty state a soul.** Five gray rows with "0 entries" is the product's one deliverable in its waiting state. Add per-layer iconography or a 2–3px color-bar identity, a warm invitation line, a single illustration or glyph. Matches the exploration-glow moment's intentionality.
8. **`[credibility]` Style destructive actions destructively.** "Delete user data" and "Delete account" rendered in neutral ink looks like an oversight. Red text, subtle red tint background on press, or a dedicated "Danger zone" card at the bottom of Settings.
9. **`[credibility]` Decide what the "feedback" pill wants to be** — serif lowercase to match the wordmark, or mono UPPERCASE to match tabs and section labels. Its current DM Sans lowercase with border is a third voice in header chrome that should have two voices max.
10. **`[noticeable]` Collapse the font-size scale** to seven values (11 / 12 / 13 / 15 / 17 / 22 / 34) with semantic roles (meta / label / body-small / body / prose / heading / display). Audit and migrate.
11. **`[noticeable]` Collapse the border-radius scale** to four values (6 / 10 / 16 / pill). Kill 2, 8, 12, 20 by migration.
12. **`[noticeable]` Collapse the ink ramp** — five near-adjacent near-black shades is two too many. Three: `--ink-primary`, `--ink-secondary`, `--ink-muted`. Delete `ink-faded`, `ink-persona`, `ink-user`.
13. **`[noticeable]` Give the bottom tab bar real active-state weight.** 1px underline on 12px uppercase serif is below-threshold visible. Either color-shift the label + weight change, or introduce icons. iOS users expect icons.
14. **`[noticeable]` Build a motion system.** 3 durations (fast 150ms, base 250ms, slow 400ms), 2 easings (standard, emphasized). Replace every `0.2s`, `0.25s`, `0.4s`, `0.5s`, `250ms`, `350ms`, `400ms` with tokens.
15. **`[cosmetic]` Replace ASCII arrow in Settings disclosure (`▼`)** with an SVG chevron at the same stroke-weight as the rest of the icon system (1.5). Single character but the whole screen passes through it.

---

### Closing note

The strongest parts of this design are the **font pairing** (Instrument Serif + Source Serif 4 + DM Sans + JetBrains Mono), the **linen palette**, and the **exploration interstitial glow**. Those three choices would not be out of place in a Linear or Arc. The weaker parts — touch targets, primary-button drift, underline inputs, 16+ font sizes — are recoverable without changing the brand, because the brand itself is intact. Fix the system, and the brand gets to show.
