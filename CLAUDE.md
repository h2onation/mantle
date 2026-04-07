# Mantle

Mantle is a mobile-first AI app where an AI called Sage builds a five-layer behavioral model ("User Manual") through deep conversation. Nothing enters the manual unless the user confirms it.

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

- **Worktrees**: Every new worktree needs `.env.local`. Run `ln -s /Users/jeffwaters/mantle/.env.local .env.local` first.
- **Git**: Merge feature branch INTO main unless told otherwise. Verify shell cwd after worktree cleanup.
- **Build**: Run `npm run build` before committing. Run relevant tests after logic changes. Commit incrementally.
- **Model IDs**: Verify Anthropic model IDs via web search. Do not guess date suffixes.
- **Tests**: All Anthropic and Supabase calls must be mocked. Never consume real API tokens in tests.
- **Auth safety**: NEVER authenticate as a real user. Use test@test.com or your own email only. NEVER generate magic links for other emails.
- **Admin safety**: NEVER grant admin roles via SQL or code. Admin is set only by the project owner in the Supabase dashboard.
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
