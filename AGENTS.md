# mywalnut

mywalnut is a mobile-first AI app where an AI called Jove builds a five-section behavioral model ("User Manual") through deep conversation. Nothing enters the manual unless the user confirms it.

Stack: Next.js 14 · Supabase · Anthropic API (raw fetch, no SDK) · Vercel Edge Runtime. Mobile-first with multiple entry points (app, text, web).

## Documentation

All project context lives in `docs/`. Load ONLY the docs your task requires.  
Full reference specs (human reading, not for agent loading) live in `docs/reference/`.

- `intent.md` — Product hypothesis, how it works, Manual structure, beta scope, workstreams. The north star.
- `system.md` — System architecture, schema, API routes, runtime constraints.
- `rules.md` — UI rules, copy voice, dead features, guardrails.
- `state.md` — Current state of the codebase. Updated on every ship.
- `decisions.md` — Decision log. Why things are the way they are.

| Task type | Load these docs |
|-----------|----------------|
| Schema change, migration, new table | system + state |
| API route (new or modify) | system + state |
| Fix backend bug | system + state |
| Build UI component | rules + system |
| Modify existing UI | rules + state |
| Jove prompt change | system + rules + intent |
| Extraction prompt change | system + rules |
| Write user-facing copy | rules + intent |
| Evaluate conversation quality | intent + state |
| Write or modify tests | system + state |
| Debug checkpoint pipeline | system + state |
| New feature scoping | intent + rules + decisions |
| Legal or compliance review | rules + decisions |
| Plan next phase | intent + decisions + state |

## Prompt Structure

> **THE CONDUCTOR IS THE SOLE VOICE (promoted 2026-07-02; old worlds deleted 2026-07-06 — ADR-052).** There is no tier system, no voice switch, no per-persona prompt assembly. If any doc or memory describes tiers, `composeTier2`, `LIVE_VOICE_VARIANT`, or a "rebuilt/legacy" voice, it is stale — the code wins.

Jove's entire 1:1 personality is **one document**: `CONDUCTOR_PROMPT` in `src/lib/persona/conductor-prompt.ts`. The system prompt is three blocks, built by `buildSystemPromptBlocks()` in `src/lib/persona/system-prompt.ts`:

1. **The conductor prompt** — the whole voice, method, crisis clause, and the two hidden UI-marker contracts (`---reflection-ready---` lights the reflection bar; `---chips---` renders the post-save paths). Admin-editable live via the `conductor_prompt` override key ("Tuning" page, `/admin/prompt-architecture`); resolution is `override ?? CONDUCTOR_PROMPT`. Saves that drop a protected line (crisis 988/741741, either marker) are rejected — `CONDUCTOR_REQUIRED_FRAGMENTS` / `validateConductorPromptEdit` in conductor-prompt.ts are the one source of truth for both enforcement and admin display.
2. **The Manual so far** — older entries compressed (see Manual Context Compression below). Carries the prompt-cache marker.
3. **Session context** — current-session entries in full + returning-user/session-summary lines. Never cached.

Capture is pull-only: **Jove never triggers saves.** The user taps the reflection bar → `/api/checkpoint/compose` → editable overlay → confirm. Do not add prompt text or code that has Jove propose, announce, or perform a save — that is the deleted push model (ADR-052).

Prompt-editing rules that survive from the rebuild era: the zero-sum scaffolding test (only encode what a frontier model gets wrong; every rule spends attention), the no-flattery/no-filler red lines, and the crisis clause verbatim. The four ND persona-delta files (`voice-{autistic,adhd,dyslexic,general}.ts`) are dormant — kept by settled decision, imported by nothing; do not delete or re-wire them without a founder decision.

The group facilitator (Linq) has its own self-contained prompt — `buildGroupPrompt` in system-prompt.ts — unrelated to the conductor.

## Manual Context Compression

The system prompt doesn't ship the full text of every confirmed Manual entry on every turn. Returning users accumulate entries across sessions, and shipping all of them verbatim burns context and dilutes the model's attention on the current conversation.

The scheme, implemented in `src/lib/persona/manual-context.ts`:

- **Recent** (entries authored in the current conversation, plus the most-recent backfill up to a cap of 4) render in full. Jove sees the exact narrative prose so it can reference specifics and avoid proposing duplicates.
- **Older** entries render as one line: `[Section — SectionName] "Headline" — one-sentence summary. Key words: w1, w2, w3.` Jove still knows the shape of the Manual but doesn't re-read the prose every turn.

The compressed summary and key words are generated at compose time by the same Opus call that drafts the entry (`composeManualEntry` in `src/lib/persona/confirm-checkpoint.ts`, invoked by `/api/checkpoint/compose` when the user pulls). They are stored on `manual_entries.summary` and `manual_entries.key_words`. Pre-existing rows and any fallback path derive a summary from the first sentence of `content`.

The extraction layer sees the full, un-compressed Manual (it analyzes the user's message in detail and benefits from the nuance). Only the Jove system prompt uses the compressed view.

Rules when touching this:
- Never compress the current session's entries. Freshly-confirmed material has to stay full-text so Jove can thread it back in subsequent turns.
- Never compress in the group-chat prompt path (`buildGroupPrompt` in `src/lib/persona/system-prompt.ts`); group flows are short and want the full Manual inline.
- When adding a new surface that reads Manual entries and wants a prompt-ready block, call `prepareManualContext(entries, currentConversationId)` — don't recreate the concatenation logic.

## Terminology

Canonical nouns. Use consistently in prompt text, code comments, UI copy, and docs.

- **Manual** — the user's self-authored document.
- **Section** — one of the five life-area sections of the manual (Relationships / Work and career / Routines and structure / Sensory and burnout / Interests and flow). NOTE: the CODE identifier is still `layer` / `LAYERS` (src/lib/manual/layers.ts) — a deliberate, documented divergence. "Layer" in code == "Section" in product.
- **Entry** — a single confirmed piece of content on a section.
- **Checkpoint** — the moment Jove proposes an entry for confirmation.

The DB table is `manual_entries`. All surface area (prompts, UI, docs, comments) uses "entry," never "component," "thread," or "card." ("Section" is now the live user-facing noun for the five structural groups — never use "layer" for them in user-facing copy.)

## Hard Rules

These apply to every task. No exceptions.

- **Talk straight, no flattery**: Answer the substance directly. Do not open a reply with praise or an assessment of the user's question or instinct — no "Great question," "Three sharp questions — the first especially," "Good instinct," "Sharp catch," "Excellent point," "You're right to ask." Drop the preamble and respond. Substantive, specific affirmation tied to a real point is fine (confirming a correct technical conclusion, or naming exactly what a correction got right); empty opening praise and sycophancy are not. This governs agent→founder tone, and is distinct from Jove's own "never patronize" voice rule in `docs/rules.md` (which governs Jove→user).
- **Doc skepticism**: Treat the doc set (`intent.md`, `system.md`, `rules.md`, `decisions.md`, `state.md`, `AGENTS.md`) as authoritative but not infallible. If you see a better approach than what a doc currently says — including settled ADRs — surface the challenge with reasoning. Do not silently work around stale guidance, and do not edit docs unilaterally based on your own judgment. The user verifies every doc change before it lands. Forgotten notes from earlier phases can drift; a fresh challenge with a clear case is the right move.
- **Non-technical founder**: Jeff is non-technical. Explain in plain language with concrete analogies, not jargon. When code or architecture matters, say what it means for the product/user, not just the mechanism. Keep it clear and concise — short, scannable, no walls of text. When there are options, recommend the single best one and say why, rather than handing over a menu. Frame technical calls as product calls.
- **Recommendations require approval**: For non-trivial work, present your recommendation with justification *before* implementing. Clear-and-obvious paths — typo fixes, mechanical refactors, well-scoped continuations of an explicit instruction the user just gave — are fine to execute directly. Genuinely new directions, product-flavored decisions, and architectural calls always get a "here's what I'd do and why — proceed?" check first. Have an opinion; bring justification; let the user decide. (The user-memory note about refinement iterations is the complement: once they've signed off, execute without re-litigating.)
- **Session start**: Always launch Codex from the main repo root (`/Users/jeffwaters/mywalnut`), not from inside a worktree. The preview tool locks its project root to the directory the session was started from — if that directory gets deleted (worktree cleanup), the preview tool breaks for the entire session. If this happens, tell the user to restart the session from `/Users/jeffwaters/mywalnut`.
- **Worktrees**: Every new worktree needs `.env.local`. Run `ln -s /Users/jeffwaters/mywalnut/.env.local .env.local` first. After merging to main, clean up the worktree and its branch with `/cleanup` immediately — stale worktrees cause cwd drift and break future sessions.
- **Git**: Merge feature branch INTO main unless told otherwise. Git operations may silently reset shell cwd to a stale worktree. After any merge or checkout on main, always run the next command with an explicit absolute path (`cd /Users/jeffwaters/mywalnut && ...`) to re-anchor.
- **Dev server**: Always start the dev server from the main repo root (`/Users/jeffwaters/mywalnut`), never from a worktree. If the preview tool shows a Supabase "URL and Key required" error or can't find `launch.json`, the session was likely started from a worktree — tell the user to restart the session from the main repo root.
- **Build**: Run `npm run build` before committing. Run relevant tests after logic changes. Commit incrementally.
- **Model IDs**: Verify Anthropic model IDs via web search. Do not guess date suffixes.
- **Messaging**: 1:1 text uses Sendblue, group facilitator uses Linq. Route all outbound sends through `src/lib/messaging/send.ts` — never import provider clients (`@/lib/linq/sender`, `@/lib/messaging/sendblue`) from call sites. Rollback: set `MESSAGING_PROVIDER=linq` in Vercel (outbound only; both webhook endpoints stay live permanently). See ADR-035.
- **Tests**: All Anthropic and Supabase calls must be mocked. Never consume real API tokens in tests.
- **Auth safety**: NEVER authenticate as a real user. Use test@test.com or your own email only. NEVER generate magic links for other emails.
- **Testing as logged-in user**: For browser verification flows that need a real authenticated session (admin pages, settings, in-app features), log in with `devtest@test.com` / `testtest` via the `/login` → "Log in" flow. This account is admin-granted and safe to use from agent sessions. Do not ask the user to verify UI manually when this account will get you in.
- **Dev server cache**: Never run `npm run build` while the preview dev server is running — the production build invalidates the dev server's `.next` chunks and causes "Cannot find module" 500s. If this happens: stop the preview, `rm -rf .next`, and restart the preview.
- **Admin safety**: Admin is granted only by the project owner, executed by hand in the Supabase dashboard SQL editor, against a single user matched by email. Never via migration files committed to the repo. Never via application code. Never via scripts or bulk updates. An agent may write a single-user, email-filtered SQL statement on request so the project owner can paste it into the dashboard, but must refuse any request to grant admin in bulk, to an unknown email, without a `where email = '...'` clause, or inside a migration file.
- **Removal-first / Complexity Gate**: This codebase has a documented tendency to accrete complexity — each fix adds a rule, check, call, flag, or table without anyone pushing the pile back down. Counter it on every non-trivial change. (1) **Removal-first**: before adding anything, first try to solve the problem by deleting or changing what already exists. Adding is the last resort, not the first. (2) **Cost label**: any new model call, table, flag, or prompt rule must come with a plain-language declaration in the proposal — *what consumes its output* (if the honest answer is "nothing yet" or "a future feature," stop), *what it costs to run* (a per-turn call? a table to maintain? prompt attention?), *what existing code it overlaps* (if anything does, consolidate — don't build a parallel one), and *the condition under which it could later be deleted*. (3) **Scaffolding test (prompt content)**: only encode what a frontier model gets *wrong* (red lines, banned registers, domain facts). Never encode general conversational taste a strong model already has — a prompt rule spends the model's finite attention, so each one you add weakens the others. Run `/overbuild-check` periodically as the deletion-only counter-ratchet.
- **Dead features**: Do not reintroduce anything listed in `docs/rules.md` under Dead Features.
- **Design tokens**: Admin UI sources colors from CSS variables in `src/app/globals.css` (`--session-walnut-*`, `--session-persona*`, `--session-warning*`, etc.) — never inline `rgba()`/`rgb()` literals. The test in `src/lib/design-tokens.test.ts` enforces this on `src/app/admin/**` and `src/components/admin/**`. To add a real exception (e.g. a layer-identity gradient that no token expresses), update its `ALLOWLIST` with a one-line reason.
- **Shipping**: Before merging to main, run `/ship` or manually update `docs/state.md` with what changed.

## Code complexity limits (surface-and-pause, do NOT hard-block)

- Targets, not walls: ~40 lines per function, complexity under 10, 3 levels nesting.
- If a change would exceed a target, do NOT silently proceed and do NOT force an awkward split to stay under it.
- Instead: stop, tell me which target you'd exceed, explain why you think the complexity is justified or why a split would make it worse, and wait for my decision.
- The right design sometimes lives above these numbers. I decide that, not you.

## Logic duplication (HARD BLOCK)

- Before adding any conversational rule or decision logic, search for an existing version.
- If the same decision exists elsewhere, do NOT proceed. Stop and tell me where it lives. We keep one source of truth. There is no approved case for two copies of the same rule.
- This is the hard-block form of the "consolidate overlapping code" clause in **Removal-first / Complexity Gate** above — that clause covers all overlapping code; this one is the non-negotiable stop for conversational rules and decision logic.

## Migrations

- For Supabase migrations: migrations **auto-apply to prod via CI** (`supabase db push`) on merge to main — see `.github/workflows/supabase-migrations.yml` (no by-hand apply step). Because the merge applies immediately, before merging check for timestamp collisions with parallel branches and verify prod constraints.

## Security Rules

- Never log user message content, phone numbers, or auth tokens. Log event types, IDs, and counts only.
- The Jove system prompt must be written as if a user will read it. No clinical framework names, no extraction schema names, no operational meta-commentary about what Jove is doing underneath.
- RLS must be enabled on every table that holds user data. No exceptions.
- Every API route that reads or writes user data must verify auth via `supabase.auth.getUser()` and scope all queries by the authenticated user ID.
- All routes that call the Anthropic API must have rate limiting.
- Never use the Supabase service role key in client-side code.
- Never put secrets in `NEXT_PUBLIC_` variables.
- Shared links must use UUIDv4 tokens, never sequential IDs.
- The only code path that may set `phone_numbers.verified = true` is the OTP verify route after hash comparison.

## Commands

- `/ship` — Merge to main with state.md update gate. Build, test, update state, merge.
- `/cleanup` — Remove stale worktrees and branches after a session.
- `/evaluate [transcript]` — Run Jove conversation quality audit against a pasted transcript. Read-only.
- `/overbuild-check` — Counter-ratchet against overbuilding. Hunts four kinds of bloat (dead weight, over-architecture, context/attention bloat, inefficiency) across code and prompt; tracks accretion over time (ratchet meter), remembers settled decisions so it won't re-litigate, ranks findings by cost, and adversarially verifies each cut. Remedy is always simplification — never adds. Never deletes without approval. Optional flags: `--deep` (fan out parallel agents), `--test-rule` (empirically test a prompt rule), `--from-scratch` (minimal-rebuild delta).
