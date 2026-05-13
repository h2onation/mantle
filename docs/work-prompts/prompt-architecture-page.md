# Build the VC-readable prompt architecture page

Kickoff prompt for a fresh Claude Code session. Paste this whole file into the first message.

---

## Why this exists

A VC or new collaborator looking at our prompt architecture for the first time should understand it in 60 seconds: the prompt is **modular** — some pieces are constitutional (always present), some swap based on user choice (persona, conversation mode), some appear/disappear based on conversation state (new user, returning, approaching checkpoint). The current standalone `docs/prompt-architecture.html` aimed at this goal but suffered from copy-pasted prompt content that drifts from the real modules. This rebuild fixes that by importing the live modules directly.

## What exists today (read these first)

- `docs/prompt-architecture.html` — current standalone visualizer with three views (Interactive, Overview, Journey). Open in browser for visual reference of the walnut/cream design language. Will be deleted as part of this work.
- `src/lib/persona/system-prompt.ts` — `composeTier2(modes)`, `buildTier3(opts)`, `buildSystemPrompt(opts)` are the live composition functions
- `src/lib/persona/voice-scaffold.ts` — shared Tier 2 structural content (banned phrases, dash-to-period rule, LANDING/DEEPENING intros, PACING, repair, advisory)
- `src/lib/persona/voice-{autistic,audhd,dyslexic,general}.ts` — per-persona unique modules (intro paragraphs, voice rules, example register, landing examples, deepening additions, weak→strong examples)
- `docs/state.md` — the top entry under "Deployed Features" titled "Multi-select persona modes + equal voice stacking" gives full background on the recent refactor; read it before touching anything

## What to build

A new server-rendered Next.js page, admin-gated, that renders the prompt architecture as an **annotated scrolling document**: central column with the actual rendered prompt text, margin alongside each section showing slot-in alternatives, token count, and logic for why the block is there.

### Page location

- Route: `/admin/prompt-architecture` (admin-gated — match the existing admin route pattern; check `src/app/api/admin/*` and middleware for the auth model)
- File: wherever your existing admin pages live (probably under `src/app/(authenticated)/admin/` or similar — grep for existing admin pages)

### Top of page (sticky)

- Header: "Jove System Prompt Architecture" + short subhead explaining the doc's purpose
- Controls:
  - **Persona** checkboxes: Autistic / AuDHD / Dyslexic / General (multi-select; mirror PersonaModeScreen rules — General unchecks neurotypes and vice versa)
  - **Conv mode** radio: Standard / Guided Intake / Upload
- Phase nav: 4 anchor links jumping to phase sections below

### Phases (4, stacked, all on the same scrollable page)

Each phase = a lifecycle moment with a specific state combo. The page renders `buildSystemPrompt()` for each phase using the current persona + conv-mode selections.

1. **Phase 1 — Brand new account** (turn 1) → `isNew: true`
2. **Phase 2 — Approaching first checkpoint** → `isNew: true, isCheckpoint: true`
3. **Phase 3 — Returning user, days later** → `isReturning: true`
4. **Phase 4 — Returning user, approaching next checkpoint** → `isReturning: true, isCheckpoint: true`

### Per-section layout (within each phase)

Two-column inside each phase:

**Main column (~65%):**

- Section label (e.g. "TIER 2 · Voice (Autistic)")
- First 2-3 lines of the **actual rendered prompt text** (truncate with fade-out)
- "Show full text" toggle to reveal the rest
- Tier-coded left border (blue intro / brown T1 / amber T2 / green T3 / purple dynamic)

**Margin column (~35%, aligned to top of each section):**

- Token count badge
- "Why this is here" pill — one of:
  - `Always` (gray)
  - `Persona: autistic` (gold; color-coded per persona)
  - `State: new user` / `returning user` / `checkpoint approaching` (green)
  - `Conv mode: guided intake` / `upload` (blue)
  - `Dynamic: appended at runtime` (purple)
- **Slot-in alternatives** — every component that could occupy this slot, with its token count and the trigger that activates it. Example for Voice section: lists the 3 other persona Voice blocks; for Conv mode: lists the 2 unselected modes.
- **Info button `(i)`** — opens a modal/popover showing:
  - Full section content (the complete text)
  - Source file + symbol reference (e.g. `voice-autistic.ts → LANDING_EXAMPLES`)
  - List of every flag/prop that controls visibility (`isNew`, `convMode`, `personaModes`, etc.)

### Phase footer

- Total tokens for this phase
- Delta vs previous phase (+/- token count, +/- block count)
- Bulleted "what changed" list: added blocks, dropped blocks

## Key behaviors

- **Live source of truth.** No copy-pasted prompt text. Import `composeTier2()`, `buildTier3()`, `buildSystemPrompt()` and render their output. Any voice module edit auto-reflects on next page load.
- **Section attribution.** Parse the rendered prompt into labeled sections (the prompt's section headers like `TIER 2: VOICE AND BEHAVIOR`, `VOICE RULES`, `LANDING`, etc. are stable anchors). Map each section to its source module(s) for the margin.
- **Token counts.** `Math.ceil(text.length / 4)` for approximations; sum per section.
- **Phase diff.** Render `buildSystemPrompt()` for each phase's state combo, diff section IDs between consecutive phases to compute the "what changed" footer.
- **Client-side interactivity.** Toggling persona/conv-mode chips updates all four phases live without a full page reload. Phases could be initially server-rendered for SEO/perf, then re-render client-side on filter change.

## Visual design

Match the existing walnut/cream design system. Same tokens (`--session-walnut`, `--session-walnut-surface`, `--session-bg-welcome`, etc.). Spectral serif for headings, sans for body. The page should feel like a thoughtful internal documentation surface — closer to an annotated literary document than a dashboard.

## What this replaces

- Delete `docs/prompt-architecture.html` and its three views (Interactive, Overview, Journey). Those were exploratory prototypes that taught us what the docs should look like; this annotated page is the consolidation.
- Optional: if you want a flip-state engineer playground for debugging, add a `?mode=interactive` query toggle on the same page that lets you set `isNew/isReturning/isCheckpoint` manually. Not required.

## Done criteria

- [ ] Page renders at `/admin/prompt-architecture`, admin-gated, no leakage to non-admins (verify with the test account)
- [ ] All four phases render correct prompt content for the selected persona + conv mode
- [ ] Margin shows accurate alternatives, token counts, and "why" pills
- [ ] Info modal shows full text + source file reference
- [ ] Toggling persona/conv mode updates all four phases live (no full page reload)
- [ ] Visual matches the walnut/cream design system
- [ ] `docs/prompt-architecture.html` deleted
- [ ] Build + test suite green (add 1-2 basic render tests if helpful)
- [ ] Update `docs/state.md` "Deployed Features" with what shipped

## Verification path

Use the preview tool. Log in as `devtest@test.com` / `testtest` (admin per `CLAUDE.md`). Navigate to `/admin/prompt-architecture`, toggle each persona, each conv mode, scroll through all four phases, click "show full text" on a few sections, click an info button, confirm the modal shows the source reference.

## Out of scope

- Group prompt path (`buildGroupPrompt`) — unrelated flow
- Editing prompts from the page — read-only
- Saving filter state per user — purely interactive
