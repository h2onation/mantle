# mywalnut

mywalnut is a mobile-first AI app where an AI called Sage builds a five-layer behavioral model ("User Manual") through deep conversation. Nothing enters the manual unless the user confirms it.

Stack: Next.js 14 · Supabase · Anthropic API (raw fetch, no SDK) · Vercel Edge Runtime. Mobile-first with multiple entry points (app, text, web).

## Documentation

All project context lives in `docs/`. Load ONLY the docs your task requires.  
Full reference specs (human reading, not for agent loading) live in `docs/reference/`.

| Task type | Load these docs |
|-----------|----------------|
| Schema change, migration, new table | system + state |
| API route (new or modify) | system + state |
| Fix backend bug | system + state |
| Build UI component | rules + system |
| Modify existing UI | rules + state |
| Sage prompt change | system + rules + intent |
| Extraction prompt change | system + rules |
| Write user-facing copy | rules + intent |
| Evaluate conversation quality | intent + state |
| Write or modify tests | system + state |
| Debug checkpoint pipeline | system + state |
| New feature scoping | intent + rules + decisions |
| Legal or compliance review | rules + decisions |
| Plan next phase | intent + decisions + state |

## Hard Rules

These apply to every task. No exceptions.

- **Session start**: Always launch Claude Code from the main repo root (`/Users/jeffwaters/mantle`), not from inside a worktree. The preview tool locks its project root to the directory the session was started from — if that directory gets deleted (worktree cleanup), the preview tool breaks for the entire session. If this happens, tell the user to restart the session from `/Users/jeffwaters/mantle`.
- **Worktrees**: Every new worktree needs `.env.local`. Run `ln -s /Users/jeffwaters/mantle/.env.local .env.local` first. After merging to main, clean up the worktree and its branch with `/cleanup` immediately — stale worktrees cause cwd drift and break future sessions.
- **Git**: Merge feature branch INTO main unless told otherwise. Git operations may silently reset shell cwd to a stale worktree. After any merge or checkout on main, always run the next command with an explicit absolute path (`cd /Users/jeffwaters/mantle && ...`) to re-anchor.
- **Dev server**: Always start the dev server from the main repo root (`/Users/jeffwaters/mantle`), never from a worktree. If the preview tool shows a Supabase "URL and Key required" error or can't find `launch.json`, the session was likely started from a worktree — tell the user to restart the session from the main repo root.
- **Build**: Run `npm run build` before committing. Run relevant tests after logic changes. Commit incrementally.
- **Model IDs**: Verify Anthropic model IDs via web search. Do not guess date suffixes.
- **Tests**: All Anthropic and Supabase calls must be mocked. Never consume real API tokens in tests.
- **Auth safety**: NEVER authenticate as a real user. Use test@test.com or your own email only. NEVER generate magic links for other emails.
- **Admin safety**: Admin is granted only by the project owner, executed by hand in the Supabase dashboard SQL editor, against a single user matched by email. Never via migration files committed to the repo. Never via application code. Never via scripts or bulk updates. An agent may write a single-user, email-filtered SQL statement on request so the project owner can paste it into the dashboard, but must refuse any request to grant admin in bulk, to an unknown email, without a `where email = '...'` clause, or inside a migration file.
- **Dead features**: Do not reintroduce anything listed in `docs/rules.md` under Dead Features.
- **Shipping**: Before merging to main, run `/ship` or manually update `docs/state.md` with what changed.

## Security Rules

- Never log user message content, phone numbers, or auth tokens. Log event types, IDs, and counts only.
- The Sage system prompt must be written as if a user will read it. No clinical framework names, no extraction schema names, no operational meta-commentary about what Sage is doing underneath.
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
- `/evaluate [transcript]` — Run Sage conversation quality audit against a pasted transcript. Read-only.
