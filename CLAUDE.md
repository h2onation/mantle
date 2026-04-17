# mywalnut

mywalnut is a mobile-first AI app where an AI called Jove builds a five-layer behavioral model ("User Manual") through deep conversation. Nothing enters the manual unless the user confirms it.

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

The Jove system prompt is built in `src/lib/persona/system-prompt.ts` in three tiers. Lower tiers override higher tiers when they conflict.

- **Tier 1 — Constitutional.** Seven rules that never change: not a therapist, user is the author, mirror exact language, one question per turn, nothing enters the manual without confirmation, no clinical framework names, direct when asked what Jove is. Edit only for a fundamental product change.
- **Tier 2 — Voice and behavior.** Sourced from `src/lib/persona/voice-autistic.ts`: VOICE_RULES (15), BANNED_PHRASES, BANNED_PATTERNS, EXAMPLE_REGISTER, LANDING_EXAMPLES. Plus static sections for deepening rhythm, progress signals, repair, "what should I do" handling. Edit voice-autistic.ts, not the builder, when changing voice.
- **Tier 3 — Conversation mechanics.** Assembled at call time from flags (turn count, first session, returning user, checkpoint approaching, checkpoint just returned, manual entry count, clinical level). Conditional blocks — first message, returning user, approaching/returning checkpoint, post-checkpoint acknowledgement, readiness gate (3+ entries), clinical material, professional referral, fabricated content, first-session wrapper.

Dynamic context blocks (confirmed manual, session summary, extraction brief, transcript detected, shared URL content, exploration focus) are appended after Tier 3 and are not part of the tier structure.

There is no post-checkpoint fork. Jove acknowledges briefly and returns to the conversation from whatever the user just surfaced. No "Work with it / Keep building" menu.

## Manual Context Compression

The system prompt doesn't ship the full text of every confirmed Manual entry on every turn. Returning users accumulate entries across sessions, and shipping all of them verbatim burns context and dilutes the model's attention on the current conversation.

The scheme, implemented in `src/lib/persona/manual-context.ts`:

- **Recent** (entries authored in the current conversation, plus the most-recent backfill up to a cap of 4) render in full. Jove sees the exact narrative prose so it can reference specifics and avoid proposing duplicates.
- **Older** entries render as one line: `[Layer N — LayerName] "Headline" — one-sentence summary. Key words: w1, w2, w3.` Jove still knows the shape of the Manual but doesn't re-read the prose every turn.

The compressed summary and key words are generated at checkpoint-confirm time by the same Sonnet call that composes the entry (`src/lib/persona/confirm-checkpoint.ts`). They are stored on `manual_entries.summary` and `manual_entries.key_words`. Pre-existing rows and any fallback path derive a summary from the first sentence of `content`.

The extraction layer sees the full, un-compressed Manual (it analyzes the user's message in detail and benefits from the nuance). Only the Jove system prompt uses the compressed view.

Rules when touching this:
- Never compress the current session's entries. Freshly-confirmed material has to stay full-text so Jove can thread it back in subsequent turns.
- Never compress in the group-chat prompt path (`buildGroupPrompt` in `src/lib/persona/system-prompt.ts`); group flows are short and want the full Manual inline.
- When adding a new surface that reads Manual entries and wants a prompt-ready block, call `prepareManualContext(entries, currentConversationId)` — don't recreate the concatenation logic.

## Terminology

Canonical nouns. Use consistently in prompt text, code comments, UI copy, and docs.

- **Manual** — the user's self-authored document.
- **Layer** — one of the five structural sections of the manual.
- **Entry** — a single confirmed piece of content on a layer.
- **Checkpoint** — the moment Jove proposes an entry for confirmation.

The DB table is `manual_entries`. All surface area (prompts, UI, docs, comments) uses "entry," never "component," "thread," or "section."

## Hard Rules

These apply to every task. No exceptions.

- **Session start**: Always launch Claude Code from the main repo root (`/Users/jeffwaters/mywalnut`), not from inside a worktree. The preview tool locks its project root to the directory the session was started from — if that directory gets deleted (worktree cleanup), the preview tool breaks for the entire session. If this happens, tell the user to restart the session from `/Users/jeffwaters/mywalnut`.
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
- **Dead features**: Do not reintroduce anything listed in `docs/rules.md` under Dead Features.
- **Shipping**: Before merging to main, run `/ship` or manually update `docs/state.md` with what changed.

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
