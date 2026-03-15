# state.md — What's True Right Now

> **Authority level**: Volatile. This is the only doc that changes weekly.  
> **Audience**: You (to know what's live and what's broken) and Claude Code agents (to avoid building on broken foundations or duplicating what exists).  
> **Maintenance rule**: Update this doc before every merge to main. Use `/ship` or update manually. If a section's "last verified" date is more than 7 days old, treat it as suspect.  
> **Related docs**: system.md covers how the architecture works. intent.md covers what we're building and why. rules.md covers what never changes.

---

## Deployed Features
*Last verified: 2026-03-15*

**Working end-to-end:**
- Auth: magic link + Google OAuth, middleware redirect, session refresh
- Onboarding: pre-auth flow (entry → info screens → seed → anonymous auth), dissolve transition into chat, skip for returning users
- Streaming chat with Sage: SSE, batch rendering, retry on error
- Sliding window: first 2 + last 48 when > 50 messages
- Checkpoint detection: inline manual entry from Sage (Path A) or Haiku classifier + Sonnet composition (Path B)
- Checkpoint cards: inline confirm/reject/refine UI
- Manual building: upsert to manual_components, manual tab with markdown rendering
- Pattern system: component → pattern mode flip, chain element tracking, recurrence requirement, max 2 per layer
- Bottom nav: 4 tabs (session, manual, guidance, settings), hides on keyboard open
- Session summary: Haiku, fire-and-forget on stale sessions (> 30 min)
- Session history: side drawer, browse/switch past sessions, start new session
- Dev simulate: Settings → "Simulate user" → auto-runs conversation until checkpoint
- Dev reset: deletes all user data (not profile/auth) + localStorage clear
- Crisis protocol: detects crisis language, provides 988 + Crisis Text Line
- Voice input (Deepgram)
- Guest-to-real auth conversion after first checkpoint
- Admin panel: user list, conversation viewer, message viewer with extraction state, access logging
- Exploration mode: "Explore with Sage" from manual entries

## Not Yet Functional
*Last verified: 2026-03-15*

- **Export manual**: Display-only in Settings ("PDF or text" label, no handler)
- **Guidance tab**: Locked until 1 confirmed component. Unlocked state is placeholder only.
- **"Still true?" label**: Visible on manual components but no click handler
- **MMS / Text Sage**: Fully scoped (see docs/reference/mms-build-guide-v3.md) but not built

## Known Issues
*Last verified: 2026-03-15*

- **Classifier aggressiveness**: Haiku may flag shorter reflections as checkpoints. The word-count heuristic (100+ for returning users, 60+ for first-session) is in the classifier prompt but not enforced in code — if Haiku returns isCheckpoint: true with a valid layer, it's accepted.
- **Auth token expiry**: No explicit token refresh on the client. Relies on middleware calling getUser() on each page request. If user stays on the SPA without page navigation, token could expire. API routes return 401 → redirect to /login as fallback.
- **Ghost conversation rows**: If useChat init sends conversationId: null and the user sends a message before state updates, a second conversation could be created. Mitigated by initStarted.current ref guard and isLoading/isStreaming checks, but not impossible.
- **OAuth redirect config**: Redirect URL is built dynamically (window.location.origin + "/auth/callback"). Supabase dashboard must have each environment's URL in allowed redirect URLs.

## In-Flight Work
*Last verified: 2026-03-15*

- Documentation system migration (completing now)
- [Jeff to add: Phase 1 status — what shipped, what's remaining]
- [Jeff to add: MMS status — Phase 0.5 A2P registration started?]
- [Jeff to add: any other active workstreams]

## Beta Users
*Last verified: 2026-03-15*

- [Jeff to fill: current beta user count, any active testers, recruitment status]
- Target: 10 users from Reddit (r/attachment_theory, r/SchemaTherapy, r/CPTSD, r/selfimprovement)
- Success metric: 3+ out of 10 return for 3rd session unprompted within 2 weeks

## Test Suite
*Last verified: 2026-03-15*

- Test count: 185
- All pass, < 1s, zero API cost (all mocked)
- Framework: Vitest with vite-tsconfig-paths
- Run: `npm run test` (all) or `npm run test:watch` (dev mode)
