# Light mode implementation plan

> **Status:** Plan, not yet implemented. Approved 2026-05-12 by project owner.
> **Source of truth:** Visual design lives at `src/app/demo/linen/page.tsx`, **Version 03 — Embossed linen** section. View at `/demo/linen` (the demo page renders three variants; V3 is the chosen one — V1 and V2 are kept for reference).
> **Scope:** Add a light mode alongside the already-shipped dark mode. No new screens, no copy changes, no data-layer changes. The job is theme infrastructure + tokens + a Settings toggle.
> **Predecessor:** `docs/implementation/dark-mode.md` (shipped 2026-05-12, all 9 phases).
> **Branch:** Implementation belongs on a fresh branch off `main`.

---

## What's changing

A light mode option, selectable via a Settings toggle, defaulting to the user's OS preference.

- **Reintroduce theme infrastructure** that was dropped during the dark-only commit. `<html data-theme="dark|light">`, a FOUC-safe inline script in `layout.tsx`, a small `useTheme` hook, optional `ThemeInit` for live system-preference subscription.
- **V3 Embossed linen palette.** Linen ground `#E5D8BE`, walnut spine `#5C3A1E` (unchanged from dark — the brand spine is constant), espresso ink `#1F140A`. Paper surfaces (Jove bubbles, checkpoint plate, Manual cards) are *barely* lighter than the linen ground; lift comes from shadow and border rather than fill contrast. The premium choice — requires the cleanest typography to read well, which the dark mode work already established.
- **Per-surface light gradients** (Welcome / Chat / Checkpoint / Manual) — same three-layer math as dark, inverted opacities. Cream highlight at top, caramel pool in mid, deep walnut at corner.
- **Settings → Appearance** row: System / Light / Dark. Setting overrides system preference; clearing the setting falls back to system.
- **Default behavior:** new users follow OS preference. If `prefers-color-scheme` is unset, fall back to dark (the existing experience).

This is additive. Dark mode stays as-is for the ~100% of users who currently have it. The toggle is the only new UI.

## Critical decisions and rationale

| Decision | Why |
|---|---|
| **V3 Embossed** over V1 (Tonal cream) and V2 (Aged parchment) | V1 was the most subtle, V2 had the strongest personality (vellum/vintage), V3 was the most premium and quietest. Owner picked V3 after side-by-side comparison at `/demo/linen`. |
| **Walnut spine `#5C3A1E` unchanged across themes** | The app is named for walnut. Both modes are walnut-anchored — only the *surrounding* tone changes. Period mark, pill button, plate border, gradient corner all read the same hue across light and dark. |
| **Linen surface `#E5D8BE`, not white** | Pure white sheets read as foreign objects on a warm app. Medium linen gives the gradients somewhere to lift FROM, and keeps the whole surface in the walnut hue family. |
| **Default to system preference (with dark fallback)** | Users with OS-level "light" set probably want light here too. Users with OS-level "dark" (or unset) keep the existing experience. Setting overrides both. |
| **FOUC-safe inline script in `layout.tsx`** | Theme has to be set on `<html>` before paint or there's a flash. Small synchronous script that reads `localStorage.getItem('mywalnut.theme')` then falls back to `matchMedia('(prefers-color-scheme: light)')` then defaults to `'dark'`. |
| **No theme on `<html>` until script runs** | Better: render with `data-theme="dark"` in SSR (the existing default), then let the script flip to `light` if needed. Means SSR HTML always shows dark, which is the current experience, so worst-case is a one-frame flash to light — acceptable. |
| **Toggle lives in Settings, not the drawer** | Drawer is for navigation. Settings is for preferences. Adding it to the drawer clutters the primary nav surface and creates competing affordances. |
| **Audit, don't reset, the component tree** | The dark mode shipped with tokens consistently used (`var(--session-*)`). Where it's already tokenized, light mode just works. Where it isn't (hardcoded `rgb(...)` for dark colors), audit and tokenize. Don't rewrite components that already use tokens correctly. |

## Files to touch

### Foundation

| File | Action |
|---|---|
| `src/app/globals.css` | Add `[data-theme="light"]` block with the full V3 token set below. Existing dark tokens stay in `:root` (or `[data-theme="dark"]`). Update `@media (prefers-color-scheme: light)` to point at the light tokens. Add light versions of `--session-bg-welcome`, `--session-bg-chat`, `--session-bg-checkpoint`, `--session-bg-manual`. |
| `src/app/layout.tsx` | Add inline FOUC script before any React content. Script reads localStorage and prefers-color-scheme, sets `<html data-theme="...">`. Update viewport `themeColor` to support both modes (use the surface ground for each). |
| `src/lib/hooks/useTheme.ts` (new) | Small hook: `{ theme: 'system' \| 'light' \| 'dark', resolved: 'light' \| 'dark', setTheme }`. Reads/writes `localStorage.mywalnut.theme`. Subscribes to `matchMedia` changes when in system mode. |
| `src/components/ThemeInit.tsx` (new) | Tiny client component mounted in `layout.tsx` body that subscribes to system pref changes and flips `data-theme` if user is on `system`. Could be folded into `useTheme` provider if cleaner. |
| `src/components/mobile/MobileSettings.tsx` | Add Appearance row: a three-state pill or segmented control (System / Light / Dark). Calls `setTheme`. Reads `theme` to show active state. Persists to localStorage. |

### Visual audit (post-foundation)

| File | Action |
|---|---|
| All components currently using `--session-*` tokens | No change. Light mode "just works" because the same token name resolves to the light value under `[data-theme="light"]`. |
| Components with hardcoded colors | Audit. Search for `rgb(`, hex codes that look like dark colors (`#0A`, `#1F`, `rgba(255,255,255`), and inline color strings. Replace with `--session-*` tokens that have light counterparts. |
| Surface-level gradient inline strings | If any surface inlines a `background-image: radial-gradient(...)` instead of reading `var(--session-bg-chat)` etc., refactor it to use the token. |
| `src/components/onboarding/EntryScreen.tsx`, `LoginScreen.tsx`, `InfoScreens.tsx`, `SeedScreen.tsx` | The onboarding surfaces were rebuilt for dark mode in Phase 6 — verify they're tokenized correctly and that light mode renders. The welcome surface in `/demo/linen` V3 is the visual reference. |
| `src/components/layout/DesktopVitrine.tsx` | The phone frame and surrounding canvas should both flip with theme. Verify shadow color, masthead color, period color all read from tokens. |

## Token values — V3 Embossed light mode

These are the canonical values to write into `[data-theme="light"]` in `globals.css`. All extracted from `src/app/demo/linen/page.tsx` (the `C` constants object + the `V3_EMBOSSED` CSS-variable block).

### Surface and walnut

```css
--session-linen: #E5D8BE;        /* surface ground — medium linen */
--session-walnut: #5C3A1E;       /* true walnut — period, pill, plate border */
--session-walnut-deep: #3D2410;  /* espresso accent */
--session-walnut-soft: rgba(92, 58, 30, 0.55);
--session-walnut-faint: rgba(92, 58, 30, 0.18);
--session-walnut-tint: rgba(92, 58, 30, 0.08);
```

### Hairlines and borders

```css
--session-hair: rgba(92, 58, 30, 0.28);          /* visible 1px edge */
--session-hair-soft: rgba(92, 58, 30, 0.14);     /* subtle 1px edge */
```

### Ink (text colors)

```css
--session-ink: #1F140A;          /* primary — near-black walnut, AAA */
--session-ink-soft: #4A3220;     /* secondary */
--session-ink-faded: #7A5E40;    /* tertiary */
--session-ink-mono: #5C3F23;     /* mono caps eyebrow */
```

### Bubbles, plate, composer (V3 Embossed values)

```css
--session-bubble-jove: rgba(232, 220, 196, 0.90);     /* paper, barely lighter than ground */
--session-bubble-user: rgba(92, 58, 30, 0.16);        /* walnut wash */
--session-bubble-border: rgba(92, 58, 30, 0.32);      /* visible edge — fill barely differs from ground */
--session-bubble-border-soft: rgba(92, 58, 30, 0.22); /* Manual layer cards */
--session-bubble-shadow: 0 8px 24px rgba(31, 20, 10, 0.12), 0 2px 5px rgba(31, 20, 10, 0.10);

--session-plate: rgba(236, 224, 200, 0.93);
--session-plate-border: rgba(92, 58, 30, 0.32);
--session-plate-shadow: 0 22px 56px rgba(31, 20, 10, 0.16), 0 6px 14px rgba(31, 20, 10, 0.10), 0 1px 0 rgba(245, 235, 215, 0.4) inset;

--session-card-shadow: 0 5px 14px rgba(31, 20, 10, 0.08), 0 1px 3px rgba(31, 20, 10, 0.06);

--session-composer: rgba(92, 58, 30, 0.07);
--session-composer-border: rgba(92, 58, 30, 0.26);
```

### Per-surface gradients

Verbatim from the demo `C` object. Layer order matters; do not reorder. Do not approximate.

```css
--session-bg-welcome:
  radial-gradient(ellipse 110% 55% at 30% 18%, rgba(255, 248, 228, 0.85), transparent 60%),
  radial-gradient(ellipse 75% 50% at 100% 88%, rgba(92, 58, 30, 0.34), transparent 65%),
  radial-gradient(ellipse 70% 50% at 0% 100%, rgba(212, 176, 128, 0.62), transparent 60%);

--session-bg-chat:
  radial-gradient(ellipse 130% 60% at 35% 15%, rgba(255, 248, 232, 0.85), transparent 65%),
  radial-gradient(ellipse 90% 55% at 50% 95%, rgba(212, 176, 128, 0.58), transparent 70%),
  radial-gradient(ellipse 65% 45% at 100% 105%, rgba(92, 58, 30, 0.38), transparent 60%);

--session-bg-checkpoint:
  radial-gradient(ellipse 120% 60% at 50% 25%, rgba(255, 250, 232, 0.85), transparent 65%),
  radial-gradient(ellipse 95% 55% at 35% 100%, rgba(208, 168, 118, 0.60), transparent 70%),
  radial-gradient(ellipse 70% 50% at 100% 0%, rgba(92, 58, 30, 0.34), transparent 60%);

--session-bg-manual:
  radial-gradient(ellipse 130% 60% at 50% 10%, rgba(255, 250, 232, 0.78), transparent 60%),
  radial-gradient(ellipse 100% 55% at 50% 100%, rgba(208, 168, 118, 0.48), transparent 70%),
  radial-gradient(ellipse 60% 45% at 0% 90%, rgba(92, 58, 30, 0.28), transparent 60%);
```

### Crisis accent (cross-theme)

```css
--session-oxblood: #7A2E2E;  /* unchanged from dark */
```

## Phased execution

### Phase 0 — Pre-flight (30 min, no code)

1. `git checkout main && git pull && git checkout -b claude/light-mode-implementation`.
2. Symlink env: `ln -s /Users/jeffwaters/mywalnut/.env.local .env.local`.
3. Baseline: `npm run test`, `npm run build`. Note the current pass count.
4. Read this doc. Open `/demo/linen` and scroll to **Version 03 — Embossed linen** for the visual target.

### Phase 1 — Theme infrastructure (half day)

Re-add the theme primitives that were dropped during dark-only commit.

- `src/lib/hooks/useTheme.ts` (new). Returns `{ theme: 'system' | 'light' | 'dark', resolved: 'light' | 'dark', setTheme }`. Persists to `localStorage.mywalnut.theme`. Subscribes to `matchMedia('(prefers-color-scheme: light)')` when theme === 'system'.
- `src/components/ThemeInit.tsx` (new). Client component that watches system pref + localStorage and updates `<html data-theme>`. Mount once in `layout.tsx`.
- `src/app/layout.tsx`. Inline FOUC script in `<head>` before any React renders. Reads localStorage → falls back to `matchMedia` → falls back to `'dark'`. Sets `<html data-theme>` synchronously.
- Verify dark mode still renders identically in browser (no regression).

Commit: `feat(theme): reintroduce theme infrastructure for light mode`.

### Phase 2 — Token foundation (half day)

Add the V3 light tokens to `globals.css`.

- Wrap existing dark tokens in `:root, [data-theme="dark"]` (if not already).
- Add `[data-theme="light"]` block with every variable above.
- Update `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ... } }` to mirror the light values, so users without JS still get something reasonable.
- Set `<html data-theme="light">` manually for testing, walk through every surface, confirm tokens resolve.

Commit: `feat(theme): add V3 light-mode tokens`.

### Phase 3 — Per-surface gradients (1–2 hr)

Add the four light gradient values to `globals.css`. If any surface inlines a gradient directly (rather than reading the token), refactor to read from the token.

Verify each surface flips correctly when `data-theme` changes: Welcome, Chat, Checkpoint, Manual, the auth surfaces.

Commit: `feat(theme): add light-mode surface gradients`.

### Phase 4 — Component audit (1 day, **highest risk**)

Sweep for hardcoded colors that should be tokens. Where found, replace with the equivalent `--session-*` token.

Search patterns:
- `rgb(` in component files
- Hex codes starting `#0`, `#1`, `#2` (likely dark)
- `rgba(255` (likely dark mode "white" text on dark surface)
- `rgba(115, 72, 42` and `rgba(170, 120, 82` (the original walnut RGBs from dark mode demo — flag for review)
- Inline strings like `background: "#..."`

This is the part that determines whether light mode "just works" or breaks in subtle places. Take it seriously. Cross-reference against the demo: every visible element in `/demo/linen` V3 should have a token-driven analog in production.

Common offenders, based on the dark-mode work:
- Bubble shadows hardcoded with old walnut RGB
- TopBar borders inline
- Plate shadows inline
- SessionDrawer rows inline
- Composer styling inline

Commit per logical group (e.g. one commit per component family).

### Phase 5 — Settings toggle (2 hr)

Add Appearance row to `MobileSettings.tsx`. Three-state segmented control or pill row: **System** (default) / **Light** / **Dark**. Calls `setTheme`. Persists.

Visual treatment: matches the existing Settings row styling. No big section header — fits between existing rows.

Commit: `feat(settings): add appearance toggle for theme`.

### Phase 6 — Cross-mode visual audit (half day)

Walk through every surface in light AND dark mode. Compare against demos:
- Light: `/demo/linen` V3 section
- Dark: `/demo/glass`

Fix anything that doesn't match. Common issues:
- Border opacity reads differently between modes
- Shadow color baked for one mode
- Backdrop-filter behaves differently on the new ground

Use the audit framing from `docs/implementation/dark-mode.md` Phase 8 (computed-style diff via DevTools, not just screenshots).

### Phase 7 — Tests + build (2 hr)

- `npm run test` — should be green. If any test asserts a specific color, update it to assert the token name or pattern, not the hex.
- `npm run build` — clean.
- Manual: full auth flow walkthrough in both modes with `devtest@test.com`.

### Phase 8 — Ship (half day)

- Update `docs/state.md`: move light-mode entry from "In-Flight Work" to "Deployed Features" with full description (mirror the dark-mode entry's level of detail).
- Run `/ship` workflow. Merge to main. Watch deploy.

## Rules of execution

1. **Update existing files; don't fork.** No `globals-light.css`. Add to existing `globals.css`.
2. **The demo at `/demo/linen` is reference only.** Port the V3 patterns into production tokens. The demo stays as the historical snapshot (with V1 and V2 visible for context).
3. **Run `npm run test` and `npm run build` between phases.** Never ship red.
4. **Don't touch the data layer.** Schema, API routes, Anthropic prompts, extraction logic stay as-is.
5. **Default to system preference.** A user on macOS light mode should see light mode here without doing anything. A user on macOS dark mode (or unset) sees dark.
6. **Stop after Phase 4 (component audit) for owner review** if the audit surfaces more hardcoded colors than expected. The audit is the riskiest phase — if it sprawls, get input before continuing.
7. **Browser-verify each phase in both modes.** Toggling between themes should never produce a broken surface.

## Risks

| Risk | Mitigation |
|---|---|
| **Theme flicker (FOUC)** | Inline script in `<head>` sets data-theme before paint. Test with throttled network. |
| **Hardcoded colors hiding in components** | Phase 4 sweeps. Cross-reference against demo. Use DevTools Computed panel to verify tokens resolve correctly on every surface. |
| **Backdrop-filter looks wrong in light** | Light backgrounds + backdrop-filter behave differently than dark. Walk through every glass surface in light specifically (MobileNav is gone now, but TopBar, plates, drawer all use blur). |
| **Existing tests assert dark-specific values** | If a test fails on token swap, it's probably asserting a hex/rgb. Update the assertion to be theme-agnostic (test the token name or test rendered class). |
| **Settings toggle clutters Settings page** | Keep the row compact. Three-state segmented control, no section header, fits between existing rows. |
| **Beta users on dark wake up to light** | Default for existing users (localStorage empty) is system preference. If a user has been on dark and their OS is light, they'll flip. Acceptable — this is opt-out via the Settings toggle, and the change is intentional. Mention in release note if a release note is being written. |
| **PWA installed copies** | The PWA caches `globals.css`. Test that updates propagate after SW update. |
| **iOS Safari color rendering** | iOS in P3 color space lifts warm tones. The V3 walnut and caramel pools may read warmer on device than in dev. Test on actual iOS PWA. |

## Done = ship checklist

- [ ] All 8 phases committed
- [ ] `npm run test` green
- [ ] `npm run build` clean
- [ ] No console errors in browser dev session
- [ ] Walk through (light): logged-out → entry → login → chat → checkpoint → confirm → Manual → entry expand → settings → log out
- [ ] Walk through (dark): same flow
- [ ] Walk through (system follows OS): change OS theme, verify app follows
- [ ] Settings toggle: System / Light / Dark all work, persist across reload
- [ ] DesktopVitrine renders in both modes
- [ ] iOS Safari PWA verified in both modes
- [ ] `docs/state.md` updated with the ship entry
- [ ] `/ship` workflow run → merged to main

## Open questions to resolve during implementation

- **Where to mount `ThemeInit`** — directly in `layout.tsx` body, or wrap in a provider? Decide during Phase 1 based on how `useTheme` ends up structured.
- **Whether to expose `data-theme` to CSS-in-JS** — if any component reads theme via JS (e.g. for an SVG that needs to flip color), the hook handles it. Decide if any such surface exists during Phase 4.
- **Browser theme-color meta tag** — set to the surface ground for each theme so PWA status bar matches. May need a small effect that updates `<meta name="theme-color">` when theme changes.
- **Onboarding default theme** — for a brand new user (first paint, no localStorage), do we want to default to dark (current experience) or to system preference? Owner call. The plan above defaults to system; revise if owner prefers always-dark for first-time users.

---

**Status when you start:** Phase 0 (pre-flight). Read this doc, scroll to **Version 03 — Embossed linen** at `/demo/linen`, branch fresh off main, then execute Phase 1 and stop for owner review before continuing to Phase 4 (the audit).
