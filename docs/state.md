# state.md — What's True Right Now

> **Authority level**: Volatile. This is the only doc that changes weekly.  
> **Audience**: You (to know what's live and what's broken) and Claude Code agents (to avoid building on broken foundations or duplicating what exists).  
> **Maintenance rule**: Update this doc before every merge to main. Use `/ship` or update manually. If a section's "last verified" date is more than 7 days old, treat it as suspect.  
> **Related docs**: system.md covers how the architecture works. intent.md covers what we're building and why. rules.md covers what never changes.

---

## Deployed Features
*Last verified: 2026-04-06*

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
- Session drawer text channel (2026-04-01): "Text with Sage" entry at top of session drawer aggregates all text messages across conversations. Shows TEXT badge, message count, latest preview. Read-only view (chat input disabled). Synthetic "text-channel" ID handled by conversations API and useChat hook.
- Narrative presentation (2026-04-02): Static HTML pages at /narrative/ for investor/demo storytelling. Password gate (client-side, code: mantle2026) → product story walkthrough (Quinn & Riley scenario) → three fictional demo manuals (Quinn, Riley, shared operating guide). Five standalone HTML files in public/narrative/, no build dependencies. All cross-links use relative paths.
- Group chat Sage (2026-04-01): Full group chat facilitation. Sage detects when added to iMessage groups via participant.added/chat.created webhooks. Identifies Mantle users by phone lookup (including owner_handle and sender_handle from Linq payloads), sends personalized intro. Facilitator system prompt (short, no advice, no sides, references manual for better questions). Scoring-based message gate (2026-04-03): emotional keywords (+3), engagement bids (+3), message length (+1/+2) — score >= 3 punches through counter immediately for vulnerability and questions; counter lowers threshold after 3 messages, auto-sends at 6+; 30-second cooldown prevents double-responding (direct address bypasses). Replaces old dumb counter. 21 unit tests. Sage can output [NO_RESPONSE] to stay quiet. Participant removal: farewell on Mantle user exit, API-verified group closing when last friend leaves, inactive group reminder (1x/24h). Re-detection: if a group was deactivated due to "no accounts" and a later message mentions Sage, detection re-runs to pick up newly linked phones. Hardened: 15s Sage timeout, phone unlink verification, structured cost logging, group conversations excluded from web app. No extraction, no checkpoints, no typing indicators in groups. Silent formation events (2026-04-01): chat.created and participant.added no longer send "no connected accounts" immediately — they save state silently and let message.received handle notifications, fixing duplicate intro race condition. Latency reduction (2026-04-03): prefetchGroupContext() loads conversation ID, phone, profile, manual in one parallel batch; counter update parallelized with prefetch; SEND path ~6→3 sequential round-trips, SKIP path ~7→2. Migration: last_sage_spoke_at column on linq_group_chats.
- ND pivot PR2a (2026-04-06): Sage voice tone layer rewritten for late-diagnosed autistic adults. New `src/lib/sage/voice-autistic.ts` as SSOT for 17 VOICE_RULES, 14 BANNED_PHRASES, and 5 EXAMPLE_REGISTER entries, with render helpers (`renderVoiceRules`, `renderBannedPhrases`, `renderExampleRegister`). `system-prompt.ts` imports from voice-autistic.ts and rewrites: VOICE section (somatic-first, mirror sensory language, no clinical translation), CLINICAL FRAMEWORK GUARDRAIL added inside LEGAL BOUNDARIES (Schema Therapy / Attachment Theory / Functional Analysis are internal-only; added rewrite examples like "fear of abandonment" → "your brain predicted the worst when they went quiet"), CONVERSATION APPROACH and DEEPENING MOVES rewritten body-first, FIRST MESSAGE Path B prompts made ND-specific ("Anywhere you went offline this week..."), SHORT ANSWERS protocol raised tolerance for brevity with walkthrough invitations instead of patronizing framing. `docs/rules.md` Sage Voice Principles section rewritten and now points to voice-autistic.ts as canonical source. Tests: +16 new PR2a assertions in system-prompt.test.ts (258 total, all passing) including a structural snapshot of ordered section headers designed to catch accidental deletions in PR2b. Scope excluded: checkpoint composition voice, manual entry format, classifier thresholds — those ship in PR2b.
- ND pivot PR1 (2026-04-06): Five manual layers renamed from general framework to autism-specific — 1=Some of My Patterns, 2=How I Process Things, 3=What Helps, 4=How I Show Up with People, 5=Where I'm Strong. New single source of truth at `src/lib/manual/layers.ts` (LAYERS, LAYER_NAMES, LAYER_COUNT, getLayer). Six consumers refactored to import from it — extraction, system-prompt, classifier, confirm-checkpoint, layer-definitions, MobileSession (checkpoint card label fix — it was still rendering the old names as a local record). Full `EXTRACTION_SYSTEM` rewrite with clinical framework guardrail, autistic-specific language bank (sensory/masking/shutdown/system/body/bind), somatic depth tracking, section-specific functional analysis chain framings (L1/2/4 standard, L3 needs-when-unmet, L5 conditions-for-activation), NO CLINICAL LANGUAGE rule. New `SageMode = 'autistic'` type and `profiles.sage_mode` column threaded through `ConversationContext` → `BuildPromptOptions` → `buildSystemPrompt` as a forward-compatible seam for future voice modes. Migration `supabase/add-sage-mode.sql` must be applied to each Supabase project before deploy. Docs: intent.md rewritten for autism audience; decisions.md adds ADR-028 (legacy manual_components left in place), ADR-029 (layer SSOT), ADR-030 (sage_mode seam). Voice content rewrite (tone, examples, voice-specific rules) ships in PR2a/PR2b.

## Not Yet Functional
*Last verified: 2026-04-06*

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
*Last verified: 2026-04-06*

- Documentation system migration — complete. Five-doc system (system, rules, intent, decisions, state) + CLAUDE.md router + /ship command with state.md gate.
- Sage prompt tuning (2026-03-17): Five fixes from conversation quality audit — replaced conciseness rule with depth/presence goal, added receive-land-ask rhythm to deepening moves, softened closed-question rule, added checkpoint depth test, enforced post-confirmation path forward.
- Sage prompt tuning (2026-03-22): Three fixes from second audit — strengthened landing instruction (witnessing vs reframing), added peak-vulnerability closed-question guard, reinforced checkpoint title-last and validation-question rules.
- Sage prompt tuning (2026-03-23): Eight fixes from third audit targeting checkpoint landing quality. System prompt: abstract stacking hard rule (3 abstract responses → must request scene), checkpoint emission consistency rule, short answer word-count trigger (15/25 word thresholds), checkpoint self-check (4-point verification before emitting manual entry), building-toward signal rewritten as mandatory collection turn, thin vs landed checkpoint example. Extraction: tightened concrete_examples to require narrated scenes not topic references. Quality framework: removed text volume, announcing observations, register mismatch checks.
- [Jeff to add: Phase 1 status — what shipped, what's remaining]
- MMS/Text: Linq integration complete and working. Twilio removed. SMS opt-in page (/sms) still live. A2P 10DLC CTA verification pending. Text checkpoints now use both Path A and Path B (classifier fallback added 2026-04-01). Shared pipeline refactor complete (2026-03-31): extracted sage-pipeline.ts with 7 shared functions, eliminated 13 duplication points between call-sage.ts and sage-bridge.ts, fixed pattern replacement sort (created_at instead of UUID), added getOrCreateConversation race condition guard, added Anthropic response shape validation, extracted shared normalizePhone utility. Verbose debug logging still in webhook — can be cleaned up later.
- Group chat (Parts 6a-6e shipped 2026-04-01, gate+latency 2026-04-03): Complete. Detection, intro, facilitation, scoring-based gate, participant removal, edge case hardening, latency optimization all deployed. Webhook subscription includes participant.added/removed and chat.created events. Three migrations: linq_group_chats table, conversations.linq_group_chat_id column, intro_sent_at (unused), last_sage_spoke_at (cooldown). Gate scoring constants (GATE_SCORE_THRESHOLD=3, GATE_REDUCED_THRESHOLD=1, GATE_COOLDOWN_MS=30000) and emotion/bid keyword lists tunable via exported constants — check GROUP_SAGE_CALL logs for score field.
- Linen migration complete (2026-03-20): All dark theme --color-* CSS variables removed, fully migrated to --session-* linen design tokens across globals.css and 12 component files. Zero dark theme references remain.
- Sage prompt tuning (2026-03-25): Two fixes from fourth audit — no-declare-reframe hard rule (convert "The difficulty isn't X, it's Y" to questions), no-name-before-scene hard rule (block mechanism naming until user narrates a specific moment). Short-answer protocol strengthened to mandatory.
- Sage prompt tuning (2026-03-30): Thirteen fixes from fifth and sixth audits across three evaluation sessions. Abstract stacking: added concrete violation example. Reframe rule: added three WRONG/RIGHT examples. Other-person inner state: upgraded to HARD RULE with example conversion to question. Confirmation questions: banned closed questions that confirm Sage's own hypothesis. Gender: added gender-assumption guard (default to "you"/"they"). Checkpoint delivery: formalized 4-step delivery sequence with violation checks, raised observation minimum to 5-8 sentences, added bind requirement. Checkpoint gating: block checkpoint when user expresses uncertainty about generalization, treat "help me think through it" as exploration invitation not checkpoint permission.
- PWA Phase 1+2 (2026-03-30): Installable app (manifest, icons, meta tags) + service worker (offline fallback, asset caching, update prompt). No npm dependencies added. Phase 3 (standalone polish, auth flow testing, splash screens) pending device QA.
- ND pivot (2026-04-06): PR1 shipped (layer rename, extraction rewrite, sage_mode seam, layer SSOT). PR2a shipped (Sage voice tone layer — voice-autistic.ts SSOT, clinical framework guardrail, somatic-first VOICE/CONVERSATION APPROACH/DEEPENING MOVES, rules.md voice section). PR2b next (checkpoint delivery sequence, checkpoint composition voice, manual entry format rewrite for ND voice; confirm-checkpoint.ts composition rules; extraction.ts SAGE BRIEF refinement). PR3 (user-facing "section" rename and any remaining UI polish) after that. Migration `supabase/add-sage-mode.sql` must be applied to Supabase before the merged code runs against production data.
- [Jeff to add: any other active workstreams]

## Beta Users
*Last verified: 2026-03-15*

- [Jeff to fill: current beta user count, any active testers, recruitment status]
- Target: 10 late-diagnosed autistic adults, ages 25 to 45 (often AuDHD). Audience defined by demographic and lived experience, not by recruitment channel.
- Success metric: 3+ out of 10 return for 3rd session unprompted within 2 weeks

## Test Suite
*Last verified: 2026-04-06*

- Test count: 258
- All pass, < 1s, zero API cost (all mocked)
- Framework: Vitest with vite-tsconfig-paths
- Run: `npm run test` (all) or `npm run test:watch` (dev mode)
