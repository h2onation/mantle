# state.md — What's True Right Now

> **Authority level**: Volatile. This is the only doc that changes weekly.  
> **Audience**: You (to know what's live and what's broken) and Claude Code agents (to avoid building on broken foundations or duplicating what exists).  
> **Maintenance rule**: Update this doc before every merge to main. Use `/ship` or update manually. If a section's "last verified" date is more than 7 days old, treat it as suspect.  
> **Related docs**: system.md covers how the architecture works. intent.md covers what we're building and why. rules.md covers what never changes.

---

## Deployed Features
*Last verified: 2026-03-30*

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
- Voice input (Deepgram): auto-scroll during transcription, 3.5-line max height on input
- Guest-to-real auth conversion after first checkpoint
- Admin panel: user list, conversation viewer, message viewer with extraction state, access logging
- Exploration mode: "Explore with Sage" from manual entries
- PWA Phase 1: web app manifest, app icons (192/512/maskable/apple-touch), standalone display, dark splash screen, "Add to Home Screen" support
- PWA Phase 2: service worker (precache app shell, stale-while-revalidate for static assets, network-only for /api/* and /auth/*), offline fallback page, SW update detection with in-app "Update available" prompt

## Not Yet Functional
*Last verified: 2026-03-15*

- **Export manual**: Display-only in Settings ("PDF or text" label, no handler)
- **Guidance tab**: Locked until 1 confirmed component. Unlocked state is placeholder only.
- **"Still true?" label**: Visible on manual components but no click handler
- **MMS / Text Sage**: Fully scoped (see docs/reference/mms-build-guide-v3.md) but not built. Public SMS opt-in page live at /sms (TCR A2P 10DLC CTA compliance). SMS consent disclosure added to Settings phone input. Screenshot page at /sms-opt-in-screenshot.

## Known Issues
*Last verified: 2026-03-30*

- **Classifier aggressiveness**: Haiku may flag shorter reflections as checkpoints. The word-count heuristic (100+ for returning users, 60+ for first-session) is in the classifier prompt but not enforced in code — if Haiku returns isCheckpoint: true with a valid layer, it's accepted.
- **Auth token expiry**: No explicit token refresh on the client. Relies on middleware calling getUser() on each page request. If user stays on the SPA without page navigation, token could expire. API routes return 401 → redirect to /login as fallback.
- **Ghost conversation rows**: If useChat init sends conversationId: null and the user sends a message before state updates, a second conversation could be created. Mitigated by initStarted.current ref guard and isLoading/isStreaming checks, but not impossible.
- **OAuth redirect config**: Redirect URL is built dynamically (window.location.origin + "/auth/callback"). Supabase dashboard must have each environment's URL in allowed redirect URLs.
- ~~**OAuth session leak (FIXED 2026-03-25)**: Auth callback responses could be cached by Vercel CDN, causing one user to receive another user's session cookies on OAuth redirect. Additionally, client hooks (useChat, useIsAdmin) used `getSession()` which reads from cache without server validation. Fix: added `force-dynamic` + `Cache-Control: no-store` to auth callback, replaced all client-side `getSession()` with `getUser()`.~~

## In-Flight Work
*Last verified: 2026-03-30*

- Documentation system migration — complete. Five-doc system (system, rules, intent, decisions, state) + CLAUDE.md router + /ship command with state.md gate.
- Sage prompt tuning (2026-03-17): Five fixes from conversation quality audit — replaced conciseness rule with depth/presence goal, added receive-land-ask rhythm to deepening moves, softened closed-question rule, added checkpoint depth test, enforced post-confirmation path forward.
- Sage prompt tuning (2026-03-22): Three fixes from second audit — strengthened landing instruction (witnessing vs reframing), added peak-vulnerability closed-question guard, reinforced checkpoint title-last and validation-question rules.
- Sage prompt tuning (2026-03-23): Eight fixes from third audit targeting checkpoint landing quality. System prompt: abstract stacking hard rule (3 abstract responses → must request scene), checkpoint emission consistency rule, short answer word-count trigger (15/25 word thresholds), checkpoint self-check (4-point verification before emitting manual entry), building-toward signal rewritten as mandatory collection turn, thin vs landed checkpoint example. Extraction: tightened concrete_examples to require narrated scenes not topic references. Quality framework: removed text volume, announcing observations, register mismatch checks.
- [Jeff to add: Phase 1 status — what shipped, what's remaining]
- MMS: SMS opt-in page (/sms) deployed, privacy/terms updated with data sharing language. A2P 10DLC CTA verification pending.
- Linen migration complete (2026-03-20): All dark theme --color-* CSS variables removed, fully migrated to --session-* linen design tokens across globals.css and 12 component files. Zero dark theme references remain.
- Sage prompt tuning (2026-03-25): Two fixes from fourth audit — no-declare-reframe hard rule (convert "The difficulty isn't X, it's Y" to questions), no-name-before-scene hard rule (block mechanism naming until user narrates a specific moment). Short-answer protocol strengthened to mandatory.
- Sage prompt tuning (2026-03-30): Thirteen fixes from fifth and sixth audits across three evaluation sessions. Abstract stacking: added concrete violation example. Reframe rule: added three WRONG/RIGHT examples. Other-person inner state: upgraded to HARD RULE with example conversion to question. Confirmation questions: banned closed questions that confirm Sage's own hypothesis. Gender: added gender-assumption guard (default to "you"/"they"). Checkpoint delivery: formalized 4-step delivery sequence with violation checks, raised observation minimum to 5-8 sentences, added bind requirement. Checkpoint gating: block checkpoint when user expresses uncertainty about generalization, treat "help me think through it" as exploration invitation not checkpoint permission.
- PWA Phase 1+2 (2026-03-30): Installable app (manifest, icons, meta tags) + service worker (offline fallback, asset caching, update prompt). No npm dependencies added. Phase 3 (standalone polish, auth flow testing, splash screens) pending device QA.
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
