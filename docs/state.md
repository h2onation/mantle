# state.md — What's True Right Now

> **Authority level**: Volatile. This is the only doc that changes weekly.  
> **Audience**: You (to know what's live and what's broken) and Claude Code agents (to avoid building on broken foundations or duplicating what exists).  
> **Maintenance rule**: Update this doc before every merge to main. Use `/ship` or update manually. If a section's "last verified" date is more than 7 days old, treat it as suspect.  
> **Related docs**: system.md covers how the architecture works. intent.md covers what we're building and why. rules.md covers what never changes.

---

## Deployed Features
*Last verified: 2026-04-01*

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
- Transcript recognition: regex detects pasted transcripts (iMessage, email, journal, timestamped chat), loads conditional prompt section so Sage asks for context, cross-references manual, focuses on user's behavior. No UI changes.
- Resonant content: URL detection + fetch (5s timeout, HTML text extraction, 3000-word cap). Sage describes content in one sentence, asks what resonated, connects to manual only after user leads. Graceful fallback when fetch fails. Hard rule prevents Sage from fabricating content descriptions when fetch fails or no content is present — guessing from URLs is blocked in base prompt. No UI changes, no new dependencies.
- PWA Phase 1: web app manifest, app icons (192/512/maskable/apple-touch), standalone display, dark splash screen, "Add to Home Screen" support
- PWA Phase 2: service worker (precache app shell, stale-while-revalidate for static assets, network-only for /api/* and /auth/*), offline fallback page, SW update detection with in-app "Update available" prompt
- Typography & contrast polish (2026-03-31): Send button replaced with sage green filled circle active state (44px tap target)
- IA cleanup (2026-03-31): Increased bottom nav padding (top 14px, bottom 20px), switched nav font to Instrument Serif to match MANTLE logo
- Chat typography system (2026-03-31): Sage messages use Source Serif 4 (--font-sage) at 16px/#524C47/1.55, user messages use DM Sans at 15.5px/#4A4440/1.5. Sage bubbles: 12px radius, sage-tint background. User messages: plain text, no bubble. sage label: 8px lowercase JetBrains Mono #7A8B72. Welcome block unified with standard sage bubble style.
- Session opening states (2026-03-31): Four entry states — first-time welcome with chips (once ever, localStorage flag), returning user prompt ("What's on your mind?"), explore (skip to context), existing session (no greeting). `firstSessionCompleted` localStorage flag + `sessionOrigin` state in useChat.
- Sign-in nudge (2026-03-31): Inline banner below header for anonymous users after 5+ messages. "Sign in to keep your progress" with 24-hour localStorage dismiss cooldown. Triggers existing AuthPromptModal.
- Manual share & export (2026-03-31): Share button on manual tab generates PDF (jspdf, client-side) and opens native share sheet (Web Share API) with pre-populated message. Falls back to direct download on unsupported browsers. Gating: < 3 entries shows soft nudge before proceeding. Display name fetched from profiles table via /api/manual.
- Text Sage via Linq (2026-03-31): Full texting integration replacing Twilio. Users link phone in Settings → greeting sent via Linq → text Sage anytime. Shared sage-pipeline.ts ensures zero drift between web and text: checkpoint layer guards, turn-count suppression (5-turn minimum), crisis detection, model/max_tokens constants, conversation context loading, and background extraction all from single source. Checkpoint flow works via text: Sage sends insight, follow-up shows name + "Does this feel right?", user replies YES/NOT QUITE/NO. STOP/START/HELP keywords, rate limiting, phone normalization (shared utility), cross-channel conversation continuity (text messages visible in web with TEXT badge). Contact card set to "Sage by Mantle" with app icon.
- Group chat Sage (2026-04-01): Full group chat facilitation. Sage detects when added to iMessage groups via participant.added/chat.created webhooks. Identifies Mantle users by phone lookup (including owner_handle and sender_handle from Linq payloads), sends personalized intro. Facilitator system prompt (short, no advice, no sides, references manual for better questions). Message gate controls participation: direct address always responds, counter-based thresholds (min 3 messages, nudge at 6+), short messages skipped. Sage can output [NO_RESPONSE] to stay quiet. Participant removal: farewell on Mantle user exit, API-verified group closing when last friend leaves, inactive group reminder (1x/24h). Re-detection: if a group was deactivated due to "no accounts" and a later message mentions Sage, detection re-runs to pick up newly linked phones. Hardened: 15s Sage timeout, phone unlink verification, structured cost logging, group conversations excluded from web app. No extraction, no checkpoints, no typing indicators in groups.

## Not Yet Functional
*Last verified: 2026-04-01*

- **Guidance tab**: Locked until 1 confirmed component. Unlocked state is placeholder only.
- **"Still true?" label**: Visible on manual components but no click handler
- **Multi-user group conversations**: Groups with 2+ Mantle users get neutral intro but can't create conversation records (user_id NOT NULL constraint). Facilitator mode only works for single-Mantle-user groups.

## Known Issues
*Last verified: 2026-04-01*

- **Classifier aggressiveness**: Haiku may flag shorter reflections as checkpoints. The word-count heuristic (100+ for returning users, 60+ for first-session) is in the classifier prompt but not enforced in code — if Haiku returns isCheckpoint: true with a valid layer, it's accepted.
- **Auth token expiry**: No explicit token refresh on the client. Relies on middleware calling getUser() on each page request. If user stays on the SPA without page navigation, token could expire. API routes return 401 → redirect to /login as fallback.
- **Ghost conversation rows**: If useChat init sends conversationId: null and the user sends a message before state updates, a second conversation could be created. Mitigated by initStarted.current ref guard and isLoading/isStreaming checks, but not impossible.
- **OAuth redirect config**: Redirect URL is built dynamically (window.location.origin + "/auth/callback"). Supabase dashboard must have each environment's URL in allowed redirect URLs.
- ~~**OAuth session leak (FIXED 2026-03-25)**: Auth callback responses could be cached by Vercel CDN, causing one user to receive another user's session cookies on OAuth redirect. Additionally, client hooks (useChat, useIsAdmin) used `getSession()` which reads from cache without server validation. Fix: added `force-dynamic` + `Cache-Control: no-store` to auth callback, replaced all client-side `getSession()` with `getUser()`.~~

## In-Flight Work
*Last verified: 2026-04-01*

- Documentation system migration — complete. Five-doc system (system, rules, intent, decisions, state) + CLAUDE.md router + /ship command with state.md gate.
- Sage prompt tuning (2026-03-17): Five fixes from conversation quality audit — replaced conciseness rule with depth/presence goal, added receive-land-ask rhythm to deepening moves, softened closed-question rule, added checkpoint depth test, enforced post-confirmation path forward.
- Sage prompt tuning (2026-03-22): Three fixes from second audit — strengthened landing instruction (witnessing vs reframing), added peak-vulnerability closed-question guard, reinforced checkpoint title-last and validation-question rules.
- Sage prompt tuning (2026-03-23): Eight fixes from third audit targeting checkpoint landing quality. System prompt: abstract stacking hard rule (3 abstract responses → must request scene), checkpoint emission consistency rule, short answer word-count trigger (15/25 word thresholds), checkpoint self-check (4-point verification before emitting manual entry), building-toward signal rewritten as mandatory collection turn, thin vs landed checkpoint example. Extraction: tightened concrete_examples to require narrated scenes not topic references. Quality framework: removed text volume, announcing observations, register mismatch checks.
- [Jeff to add: Phase 1 status — what shipped, what's remaining]
- MMS/Text: Linq integration complete and working. Twilio removed. SMS opt-in page (/sms) still live. A2P 10DLC CTA verification pending. Text checkpoints now use both Path A and Path B (classifier fallback added 2026-04-01). Shared pipeline refactor complete (2026-03-31): extracted sage-pipeline.ts with 7 shared functions, eliminated 13 duplication points between call-sage.ts and sage-bridge.ts, fixed pattern replacement sort (created_at instead of UUID), added getOrCreateConversation race condition guard, added Anthropic response shape validation, extracted shared normalizePhone utility. Verbose debug logging still in webhook — can be cleaned up later.
- Group chat (Parts 6a-6e shipped 2026-04-01): Complete. Detection, intro, facilitation, message gate, participant removal, edge case hardening all deployed. Webhook subscription includes participant.added/removed and chat.created events. Two migrations applied: linq_group_chats table + conversations.linq_group_chat_id column. Gate thresholds (GATE_MIN_MESSAGES=3, GATE_NUDGE_MESSAGES=6) may need tuning after watching real conversations — check GROUP_SAGE_CALL logs.
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
*Last verified: 2026-03-30*

- Test count: 221
- All pass, < 1s, zero API cost (all mocked)
- Framework: Vitest with vite-tsconfig-paths
- Run: `npm run test` (all) or `npm run test:watch` (dev mode)
