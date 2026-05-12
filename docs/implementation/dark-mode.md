# Dark mode implementation plan

> **Status:** Plan, not yet implemented. Approved 2026-05-11 by project owner.
> **Source of truth:** Visual design lives at `src/app/demo/glass/page.tsx` — view at `/demo/glass` in a running dev server.
> **Scope:** Visual redesign only. Data layer, API routes, Anthropic prompts, extraction logic untouched.
> **Branch:** Implementation belongs on a fresh branch off `main`, not on `claude/naughty-jones-85c417` (which carries demo iteration history).

---

## What's changing

A full visual redesign of the authenticated and unauthenticated surfaces:

- **Walnut + slate palette.** Cool graphite ground; walnut as the warm accent (period mark, drop cap, plate borders, gradient corner).
- **Spectral typography** for body prose across chat, checkpoint, Manual entries.
- **Bubble chat** with side-anchored speakers — Jove anchors left at 92% width, user anchors right at 88%. Asymmetric corner (5px on speaker side) suggests a tail without being one. Both speakers in roman (no italic differentiation; user identified by anchor + tint + label-absence).
- **Persistent `mywalnut.` masthead** at the top of every screen.
- **Dark mode only.** Drop light-mode tokens, theme toggle, FOUC script, `useTheme` hook, `ThemeInit`.
- **No tab bar.** Drop `MobileNav`. Primary navigation moves into an expanded `SessionDrawer` (sessions + Read my Manual + Settings + Beta feedback + Crisis support).
- **Manual as a single expanding-card document.** Drop the Layer-detail page; layers are typographic section headers; entries are flat cards that expand inline.
- **Pill composer** with `+` / mic / send-as-TextBtn pattern. Mic is tap-to-dictate (speech-to-text into the textarea); no voice exchange.
- **Checkpoint plate** with walnut tint, eyebrow + 24px heading + paragraphed 17px body. Same plate and same body typography as Jove chat bubble for continuity.
- **Post-checkpoint composing state.** Plate persists; decision row → pulsing sage fleuron + "Putting it on the page…" while Sonnet writes the entry server-side; resolves to "Saved to Layer Two."

## Critical decisions and rationale

| Decision | Why |
|---|---|
| Walnut + slate (not walnut + sage) | Sage was too close in temperature; navy added gravity but lost the brand. Walnut + slate gives temperature contrast and keeps the brand name visible in the gradient. |
| Walnut dominant (~75% of canvas) | The app is named for it. Earlier "navy + walnut equal" inversion made the brand recede. |
| Spectral over Source Serif 4 | Spectral has wider letterforms and "editorial book" presence. Tested against Newsreader, Lora, Fraunces, Literata — Spectral chosen. |
| 17px body / line-height 1.62 / letter-spacing -0.05 | Chat-bubble typography. Reading-tuned. The checkpoint body matches exactly so reading is continuous from chat → checkpoint. |
| Drop italic differentiation between Jove and user | Position (left/right anchor) + tint (walnut/slate) + asymmetric corner + Jove-only label do the work. Italic was redundant. |
| Drop the "you" label on user bubbles | Right-anchor + slate tint + corner is unambiguous. Label was clutter. |
| Drop separate Layer-detail page | Manual is ONE document (per `intent.md` — exports as one PDF). Inline expand reinforces that. |
| Drop drop cap on Layer entries | Decorative; didn't help reading or PDF export; created arbitrary "first entry is special" hierarchy. |
| Drop "featured Layer I" in Manual | All five layers are equal aspects of the user, not ranked. Visual hierarchy should not imply hierarchy of meaning. |
| Dark mode only | User confirmed. Simplifies the token system substantially. Light-mode `:root` block can be kept as a failsafe or deleted. |
| No tab bar | User confirmed. Drawer is the sole nav. Cleaner mobile feel; matches reference apps. |
| Mic = dictation, not voice exchange | Confirmed: speech-to-text into textarea; no back-and-forth voice with Jove. The earlier orb/listening screen designed for voice mode was dropped. |
| Walnut variations across light-mode options (if light ever ships) | The app is named for walnut; every palette variant must keep walnut present. Variations are in the SURROUNDING tone and walnut INTENSITY. Light mode is out-of-scope for this implementation. |

## Files-to-touch map

### Foundation

| File | Action |
|---|---|
| `src/app/globals.css` | Update `html[data-theme="dark"]` and `@media prefers-color-scheme: dark` blocks with new walnut+slate tokens from demo. Keep `:root` (light) block as failsafe or delete. |
| `src/app/layout.tsx` | Set `<html data-theme="dark">` permanently. Remove FOUC script. Remove `<ThemeInit />` import + render. Add `next/font/google` for Spectral, expose as `--font-spectral`. |
| `src/components/ThemeInit.tsx` | Delete (or leave as no-op shim if anything still imports it — verify and remove imports). |
| `src/lib/hooks/useTheme.ts` | Delete. Remove imports from `MobileSettings.tsx` and `DesktopVitrine.tsx`. |
| `src/components/layout/DesktopVitrine.tsx` | Remove the "Theme · sys · light · dark" toggle in the colophon. |

### Shared primitives (new)

| File | Purpose |
|---|---|
| `src/components/shared/Bubble.tsx` | Side-anchored speaker bubble. Props: `speaker: "jove" \| "user"`, `children`. Walnut tint for Jove (left, 92%), slate tint for user (right, 88%). Asymmetric corner. Spectral body. Jove gets a sage "Jove" tag only on first-in-sequence. |
| `src/components/shared/Plate.tsx` | Walnut-tinted card with optional eyebrow, heading, body. Used by Checkpoint, Disclaimer, FirstCheckpointModal, Empty Manual prompt. Reusable to avoid copy-pasting plate styles. |
| `src/components/shared/TopBar.tsx` | Persistent `mywalnut.` masthead with back chevron (optional) + menu icon (opens drawer). Used by every authenticated surface. |

### Surfaces

| File | Action |
|---|---|
| `src/components/mobile/MobileSession.tsx` | (~1500 lines) Replace italic-on-page chat rendering with `<Bubble />`. Restyle the inline checkpoint card to use `<Plate />` with the new eyebrow + 24px heading + 17px paragraphed body. Update typing indicator to single pulsing fleuron in a Jove bubble shell. Replace optimistic "Written to manual" with composing state. Wire `<TopBar />` to replace the existing header. Drop FEEDBACK from the chat header (moves to drawer). Preserve all branches: streaming, refinement-ceiling, sign-in banner, conversation loading, etc. |
| `src/components/mobile/ChatInput.tsx` | Full restyle to the pill composer (+ / mic / SEND ›). Preserve all dictation logic — mic stays tap-to-dictate. Add active-dictation visual (small sage waveform replacing mic, interim italic transcript in textarea). |
| `src/components/mobile/MobileManual.tsx` | Restructure as flat expanding-cards document. Drop `PopulatedLayer` vs `EmptyLayer` visual distinction; single rendering loop handles both. Wire `<TopBar />`. Update intro modal styling. Update export sheet UI to bottom-sheet with PDF cover preview. |
| `src/components/mobile/manual/PopulatedLayer.tsx` | Replace with typography section header pattern. May simplify or merge into MobileManual rendering. |
| `src/components/mobile/manual/EmptyLayer.tsx` | Replace with typography section header (same as Populated, just shows "0 entries"). |
| `src/components/mobile/manual/EntryItem.tsx` | Restyle as the expanding card (collapsed: headline + chevron; expanded: + body + explore-further). Keep the prop shape compatible with existing callers. |
| `src/components/mobile/SessionDrawer.tsx` | Expand to be the full app menu. Add sections beneath sessions list: "Read my Manual" (with entry count), "Settings", "Beta feedback", "Crisis support" (oxblood, footer-anchored). Same walnut+slate aesthetic. |
| `src/components/mobile/MobileSettings.tsx` | Restructure to flat list under typographic section headers. Drop the accordion `SectionHeader` pattern. Drop the APPEARANCE section (dark only). Remove `useTheme` import. |
| `src/components/layout/MobileNav.tsx` | Delete (or leave unimported). |
| `src/components/layout/MobileLayout.tsx` | Drop the bottom-nav rendering. Adjust padding so chat extends to bottom safe area. |
| `src/components/MainApp.tsx` | Refactor tab-switching logic. Currently uses `activeTab` state for three views; replace with drawer-driven view switching. The Manual and Settings surfaces become drawer-routed views, not tab-routed. |
| `src/components/layout/DesktopVitrine.tsx` | Update masthead + colophon styling. Phone frame stays. |

### Onboarding & auth

| File | Action |
|---|---|
| `src/components/onboarding/EntryScreen.tsx` | Restyle to the demo's logged-out entry — masthead at hero scale, italic Spectral thesis, "Begin" pill button, "Sign in" quiet link. |
| `src/components/onboarding/LoginScreen.tsx` | Restyle to the demo's Login form (Email + Password + Google + magic link + Create account footer). |
| `src/components/onboarding/InfoScreens.tsx` | Collapse to a single Disclaimer card (matches demo). |
| `src/components/onboarding/SeedScreen.tsx` | Light restyle to match the chat surface (same masthead, same composer). |
| `src/components/onboarding/OnboardingFlow.tsx` | Update view transitions if structure changes. |
| Sign-up form | Reuse Login plate + add a name field. |
| OTP / magic-link / reset-password screens | Small adaptations of the Login plate. |

### Modals

| File | Action |
|---|---|
| `src/components/modals/FirstCheckpointModal.tsx` | Restyle to use `<Plate />` over dark backdrop. Copy unchanged. |
| `src/components/modals/AuthPromptModal.tsx` | Restyle to the demo's "Save your conversation" pattern. |
| `src/components/modals/PatternFormingModal.tsx` | Restyle using same plate pattern. |
| `src/components/modals/ChatWindowModal.tsx` | Restyle. |
| `src/components/shared/ConfirmationModal.tsx` | Restyle to the destructive-action pattern (oxblood accent). Used for delete-data/delete-account/delete-entry confirms. |

### Edge states + new components

| File | Action |
|---|---|
| `src/components/shared/PillComposer.tsx` (new) | Wraps existing `ChatInput.tsx` logic in the new pill shell. Or just restyle ChatInput directly — decide during implementation. |
| Connection error UI | Small new component, dropped into `MobileSession.tsx` when API errors. Plate over the chat with oxblood eyebrow, RETRY + dismiss. |
| Edit entry sheet | New bottom sheet for editing a Manual entry. Either new component or expand `EntryItem.tsx`. |
| Composing state UI | Inline replacement for the optimistic "Written to manual" in `MobileSession.tsx`. |

## Phased execution

### Phase 0 — Pre-flight (30 min, no code)

1. Branch fresh: `git checkout main && git pull && git checkout -b claude/dark-mode-implementation`.
2. Run baseline: `npm run test` and `npm run build`. Should be 564 green.
3. Read `docs/state.md` "In-Flight Work" — confirm nothing else is mid-flight on these files.

### Phase 1 — Foundation (half day)

Update tokens, drop theme, load Spectral. Single commit. Verify dark mode renders everywhere. Tests green.

### Phase 2 — Shared primitives (half day)

Add `Bubble.tsx`, `Plate.tsx`, `TopBar.tsx`. Not wired yet. Pure addition. Tests green.

### Phase 3 — Chat surface (1 day)

`MobileSession.tsx` + `ChatInput.tsx`. Bubbles, checkpoint plate, typing indicator, composing state, pill composer. Browser-verify every chat state. Tests green.

**STOP HERE and ask the project owner to review** before continuing. The chat surface is the most-visited; getting it right unblocks downstream.

### Phase 4 — Manual surface (1 day)

`MobileManual.tsx` + `manual/*`. Flat expanding cards, section headers as typography, drop Layer detail. Export sheet. Empty state. Tests green.

### Phase 5 — Navigation rework (half day, **highest risk**)

`SessionDrawer.tsx` expansion, `MobileNav.tsx` deletion, `MobileLayout.tsx` + `MainApp.tsx` refactor. Tab bar gone. Drawer is sole nav. Verify all routes still work. Tests green.

### Phase 6 — Onboarding + auth (1 day)

`EntryScreen`, `LoginScreen`, `InfoScreens`, `SeedScreen`. Plus sign-up, OTP, reset-password. Walk through full auth flow as a new user with `devtest@test.com`. Tests green.

### Phase 7 — Modals + Settings (half day)

All five modals restyled. `MobileSettings.tsx` flat-list refactor. Tests green.

### Phase 8 — Edge cases + tests (half day)

Connection error, composing state, refinement-count badge, dictation active state, public pages (`/privacy`, `/terms`, `/waitlist`), SW update prompt, DesktopVitrine. Update test assertions where structure changed. Full `npm run test` + `npm run build`.

### Phase 9 — Ship (half day)

Update `docs/state.md` with comprehensive entry. Run `/ship` workflow. Watch deploy.

## Rules of execution

1. **Update existing files, don't fork.** No `MobileSessionV2.tsx`. Modify `MobileSession.tsx` directly.
2. **Extract shared primitives for repeated patterns.** `<Bubble />`, `<Plate />`, `<TopBar />` exist once and are reused.
3. **Run `npm run test` and `npm run build` between phases.** Never ship red.
4. **Don't touch the data layer.** Schema, API routes, Anthropic prompts, extraction logic stay as-is.
5. **The demo at `/demo/glass` is reference only.** Don't ship code FROM the demo file; PORT THE PATTERNS into production components. The demo stays as a snapshot.
6. **Tests reference visual copy.** `onboarding-copy.test.ts` asserts checkpoint action labels (`Put it in my Manual`, `close but not quite`, `this is not me`, `Put it in as it is`, `let it go`). These labels DON'T change — only their visual treatment. Tests should still pass after Phase 3. If a test breaks, understand why before mass-updating.
7. **Browser-verify each phase.** Use `devtest@test.com` / `testtest` (the dev account flagged as admin-safe in CLAUDE.md). Log in via `/login` → "Log in" form.
8. **Commit per phase.** Easy to review. Easy to rollback.
9. **Stop after Phase 3 for owner review.** Don't push through to ship without a checkpoint with the owner.

## Risks

| Risk | Mitigation |
|---|---|
| Real beta users see this | Phase the rollout. After Phase 3 (chat surface), gather feel from the owner before continuing. |
| Dropping the tab bar disrupts navigation | Phase 5 is the most architecturally risky. Verify all routes still work. Consider feature-flagging if needed. |
| `MobileSession.tsx` has many branches | The file is ~1500 lines with streaming, refinement-ceiling, sign-in banner, etc. Test each state in browser. |
| PDF export visual stays old | `generateManualPdf` reads from entries directly; updating the PDF visual is a separate task post-implementation. |
| Test assertions on source content | `onboarding-copy.test.ts` checks specific strings in `MobileSession.tsx`. Don't bulk-update tests; understand each break. |
| DesktopVitrine compatibility | The phone frame on desktop wraps mobile content. If a surface assumes more height than the frame allows, layout breaks. Verify desktop after each phase. |

## Done = ship checklist

- [ ] All 9 phases committed
- [ ] `npm run test` green (564 expected, may shift slightly)
- [ ] `npm run build` clean
- [ ] No console errors in browser dev session
- [ ] Walk through: logged-out → entry → login → chat → checkpoint → confirm → Manual → entry expand → settings → log out
- [ ] DesktopVitrine renders correctly at desktop viewports
- [ ] Tab bar fully gone (no flash, no leftover space)
- [ ] Drawer reaches Manual, Settings, Feedback, Crisis
- [ ] `docs/state.md` updated with the ship entry
- [ ] `/ship` workflow run → merged to main

## Open questions to resolve during implementation

- **Sign-up form fields**: Login form + name? + access code (closed beta)? Confirm with owner if access-code is still gating.
- **Edit entry**: does the actual app currently allow editing entry name + body? If not, decide whether this lands in scope or punts to post-ship.
- **Voice dictation active state**: small visual cue when mic is recording. Waveform on mic icon? Italic interim transcript in textarea? Pick during Phase 3.
- **Confirmed-entry receipt** (after composing resolves): "Saved to Layer Two" pill on the plate? Toast? Decide during Phase 3.
- **Refinement-count badge** on entries the user has refined: needed in the Manual list view. Small UI. Decide during Phase 4.

---

**Status when you start:** Phase 0 (pre-flight). Read this doc, skim `/demo/glass`, branch fresh off main, then execute Phase 1 and stop.
