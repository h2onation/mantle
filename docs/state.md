# state.md — What's True Right Now

> **Authority level**: Volatile. This is the only doc that changes weekly.  
> **Audience**: You (to know what's live and what's broken) and Claude Code agents (to avoid building on broken foundations or duplicating what exists).  
> **Maintenance rule**: Update this doc before every merge to main. Use `/ship` or update manually. If a section's "last verified" date is more than 7 days old, treat it as suspect.  
> **Related docs**: system.md covers how the architecture works. intent.md covers what we're building and why. rules.md covers what never changes.

---

## Deployed Features
*Last verified: 2026-04-15*

- Typography minimums + WCAG AA contrast floor (2026-04-15): Darkened `--session-ink-ghost` (#B8B2AC → #756E6A, ~5.5:1 on linen) and `--session-ink-faded` (#8A8480 → #5E5855, ~7:1) so all secondary/tertiary text passes WCAG AA. Added size tokens `--size-meta` (12px), `--size-body` (15px), `--size-prose` (17px), `--size-heading` (22px). `docs/rules.md` typography table raised — mono 12–13px (was 7–9px), sans 14–15px (was 13px), serif 17–22px. 12px is now the stated minimum text size anywhere in the product. `--session-ink-whisper` marked decorative-only. Inline-styles-only rule nudged toward size tokens. Scope was tokens + spec; components with hardcoded inline `fontSize: "8px" | "9px" | "10px"` (admin/docs, SettingsRow, MobileSettings) do not inherit and need a follow-up migration pass.
- Admin docs page (2026-04-15): `/admin/docs` renders the five canonical docs (intent, system, rules, state, decisions) from disk via `/api/admin/docs` and `/api/admin/docs/[name]` (admin-guarded, node runtime, `fs.readFile` + `fs.stat`). Left sidebar ordered intent → system → rules → state → decisions with last-modified date; main panel markdown-renders with `react-markdown` + `remark-gfm`; staleness banner on state.md when mtime > 7 days. Extra "docs mapping" entry embeds `public/admin/docs-mapping.html` via iframe. Admin rail gains a "Docs" entry linking from `/admin`. Read-only — no editing, search, or versioning.
- intent.md canonical rewrite (2026-04-15): Replaced with April 2026 product strategy (hypothesis, how it works, Manual structure, beta scope w/ 2026-04-28 ship, WS1–WS7 workstreams). CLAUDE.md Documentation section now has per-doc one-line descriptions; added hard rules for browser test login (`devtest@test.com` / `testtest`) and the never-run-`npm run build`-while-preview-dev-server-is-running cache corruption.
- Wordmark "MYWALNUT" → "my walnut" (2026-04-15): Lowercase, letter-spacing 15px → 4px, removed `textTransform: uppercase` across MobileSession, MobileManual, reset-password, waitlist, EntryScreen, InfoScreens, LoginScreen, SeedScreen.
- Admin dashboard → `/admin` route (2026-04-14): Promoted admin out of the mobile settings overlay into a dedicated desktop-first route. Persistent left rail (Users / Beta / Feedback) with URL-driven section via `?section=`. Users section is master-detail: 320px user list + inline `UserProfilePane` with sessions/manual/feedback tabs — no more page-jumping when selecting a user. Beta section merges waitlist + allowlist under sub-tabs. Feedback section combines beta feedback (with unread badge on rail) and in-app feedback. Responsive: rail collapses to a horizontal tab strip under 720px. Internals: new `useAdminData` hook centralizes state + fetchers; extracted `UserProfilePane`, `ExtractionPanel`, `AdminManualView`; `src/components/mobile/admin/` → `src/components/admin/`; deleted the 1432-line `src/components/mobile/AdminView.tsx` overlay. `MobileSettings` now links to `/admin` instead of embedding the view.
- Persona rename Sage → Jove (2026-04-14): `PERSONA_NAME` / `PERSONA_NAME_FORMAL` flipped in `src/lib/persona/config.ts`. Abstraction held — system prompt, summary transcript labels, error strings, checkpoint prompts, simulation prompts, SMS templating, and group-gate direct-address regex all pick up the new name automatically. Hand-touched untemplated literals: `public/persona-contact.vcf` FN field, `public/offline.html` brand copy, `public/narrative/*.html` (4 investor/demo pages — visible text flipped, CSS class tokens like `.bubble-sage` / `--sage` preserved). Value-bound test assertions in `system-prompt.test.ts` and `generate-summary.test.ts` updated. `group-gate.ts` keeps `|sage` alternation as a transition fallback so old iMessage groups using "sage" as direct address still route correctly. `APP_VERSION` 2.10.0 → 2.11.0, `PERSONA_VERSION` 2.4.0 → 2.5.0 (Anthropic prompt cache invalidates on first call after deploy). Deferred: `sage_brief` JSONB key in extraction state — needs its own dual-read migration.
- Narrative pages brand fix (2026-04-14): `public/narrative/mantle_intro.html` → `mywalnut_intro.html`, access code `understandingwmantle26` → `understandingwmywalnut26`, 15 Mantle brand references flipped across `index.html` and the intro page. Old preview links and old access code will 404 / reject (small audience, acceptable break).

**Working end-to-end:**
- Auth: magic link + Google OAuth, middleware redirect, session refresh
- Onboarding: pre-auth flow (entry → info screens → seed → anonymous auth), dissolve transition into chat, skip for returning users
- Streaming chat with Jove: SSE, batch rendering, retry on error
- Sliding window: first 2 + last 48 when > 50 messages
- Checkpoint pipeline: Haiku classifier → server-side Sonnet composition (`composeManualEntry`). No inline sentinel — composition always runs server-side after classifier flags a checkpoint.
- Checkpoint cards: inline confirm/reject/refine UI
- Manual building: upsert to `manual_components`, manual tab with markdown rendering
- Bottom nav: 3 tabs (session, manual, settings), hides on keyboard open
- Session summary: Haiku, fire-and-forget on stale sessions (> 30 min)
- Session history: side drawer, browse/switch past sessions, start new session
- Dev simulate: Settings → "Simulate user" → auto-runs conversation until checkpoint. Persona can emit `[END]` to stop naturally.
- Dev reset: deletes all user data (not profile/auth) + localStorage clear
- Crisis protocol: detects crisis language, provides 988 + Crisis Text Line
- Voice input (Deepgram): auto-scroll during transcription, 3.5-line max height
- Guest-to-real auth conversion after first checkpoint
- Admin panel: user list (sorted by `last_active`), conversation/message viewer with extraction state, access logging. Tab bar: Users / Waitlist / Allowlist / Feedback.
- Exploration mode: "Explore with Jove" from manual entries
- Transcript recognition: regex detects pasted transcripts (iMessage, email, journal, timestamped chat), Jove asks for context and cross-references manual.
- Resonant content: URL detection + fetch, Jove asks what resonated. Hard rule prevents fabricating descriptions when fetch fails.
- PWA: web app manifest, icons, standalone display, service worker (offline fallback, stale-while-revalidate for static assets, network-only for API), update prompt.
- Typography system (2026-03-31): Jove messages use Source Serif 4 16px, user messages DM Sans 15.5px. Jove bubbles with sage-tint background, user messages plain text.
- Session opening states (2026-03-31): First-time welcome with chips, returning user prompt, explore mode, existing session resume. `firstSessionCompleted` localStorage flag.
- Sign-in nudge (2026-03-31): Inline banner for anonymous users after 5+ messages, 24-hour dismiss cooldown.
- Manual share & export (2026-03-31): PDF generation (jspdf) + native share sheet. Falls back to direct download. Gating: < 3 entries shows soft nudge.
- Manual page (2026-04-07, updated 2026-04-09): Flat section headers (name + "N entries" count + hairline rule). Entries as thread cards (line-clamp 3, expand inline, "Explore further with Jove" link). Empty sections show only muted title + "0 entries" + divider. First-visit intro modal (gated by `mywalnut_manual_intro_seen` localStorage) explains the manual and offers "Talk to Jove" or "Got it." Share CTA visible only when entries exist.
- Text Jove via Linq (2026-03-31): Full texting integration replacing Twilio. Shared `persona-pipeline.ts` ensures zero drift between web and text. Checkpoint flow works via text (YES/NOT QUITE/NO). STOP/START/HELP keywords, rate limiting, cross-channel continuity (TEXT badge in web).
- Session drawer text channel (2026-04-01): Aggregated text message view at top of session drawer. Read-only, synthetic "text-channel" ID.
- Narrative presentation (2026-04-02): Static HTML pages at /narrative/ for investor/demo storytelling. Password-gated, five standalone files.
- Group chat Jove (2026-04-01, gate 2026-04-03): Jove detects iMessage groups via Linq webhooks. Facilitator mode (short, no advice, references manual). Scoring-based message gate (emotion/bid keywords, message length, cooldown). Participant removal handling, inactive reminders. Single-mywalnut-user groups only.
- ND pivot (2026-04-06, 4 PRs): Layer rename to autism-specific (SSOT at `src/lib/manual/layers.ts`). Jove voice rewrite (`voice-autistic.ts`: somatic-first, sensory-verbatim, clinical framework ban). Checkpoint composition requires somatic anchor. All onboarding/legal/marketing copy rewritten for ND audience. Unified first-message handling (legacy Path A/B/C dropped). Quality framework rewrite for autistic-mode audit. `profiles.sage_mode` column for future voice modes.
- Legal page updates (2026-04-06): Privacy Policy + Terms of Service updated — provider-agnostic SMS, "not used to train AI" line, sharing sections, non-clinical/non-accommodation disclaimer.
- Closed-beta entry + onboarding gate (2026-04-08): Entry screen shows "Log in" + "Join the waitlist." Post-login onboarding for new users (`profiles.onboarding_completed_at`). Fails open on API error. Migration: `20260408_add_onboarding_completed_at.sql`.
- Beta access system (2026-04-08, admin add-to-beta 2026-04-09, allowlist tab 2026-04-14): Allowlist-gated signup (email + Google OAuth, fails closed). Waitlist page + `/api/waitlist` (rate-limited, 3/hr/IP). Admin: add-to-beta form + per-row buttons on Waitlist tab, status changes, feedback tab with unread count, dedicated Allowlist tab that lists/removes beta_allowlist entries via `GET`/`DELETE /api/admin/beta-allowlist`. Persistent `BetaFeedbackButton` for all logged-in users. Tables: `beta_allowlist`, `waitlist`, `beta_feedback`.
- Pattern feature removal (2026-04-07): Single entry type per layer. No mode flip, recurrence gate, chain walk, saturation, or per-layer cap. `manual_components.type` column dropped.
- Jove prompt hardening (2026-04-06): Moved sensitive logic out of system prompt into server-side code. `validateMaterialQuality` pre-emit gate, `validateComposedEntry` post-validator. ~75 lines of enforcement scaffolding pruned from prompt.
- Security hardening (2026-04-07): Upstash rate limiting on chat/summary/checkpoint/OTP routes (fails open if env vars missing). Anon Gate B at 2 manual_components. OTP phone verification (SHA-256, 6-digit, 10-min TTL). PII logging cleanup.
- Jove prompt tuning (7 rounds, 2026-03-17 through 2026-04-07): Abstract stacking rule, receive-land-ask rhythm, checkpoint delivery sequence (verbatim body/sensory word required, open validation question, 4-8 word headline), post-checkpoint advisory mode, clinical-label-in-negation rule, one-question-per-turn enforcement, therapy-ism bans ("sit with," "lean into," "hold space for").
- Sage → Persona rename (2026-04-14): Internal identifier rename across ~70 files. User-facing "Sage" strings routed through `PERSONA_NAME` constant at `src/lib/persona/config.ts`. Directory moved `src/lib/sage/` → `src/lib/persona/`, files renamed (`call-sage.ts` → `call-persona.ts`, `sage-pipeline.ts` → `persona-pipeline.ts`, `sage-bridge.ts` → `persona-bridge.ts`, `ExploreWithSageButton.tsx` → `ExploreWithPersonaButton.tsx`). Contact card `public/sage-contact.vcf` → `persona-contact.vcf`. DB migration `20260414_rename_sage_to_persona.sql` renames `sage_*` columns (e.g. `profiles.sage_mode` → `profiles.persona_mode`). System prompt rewritten in second-person with `{{PERSONA_NAME}}` templating. Direct-address detection routed through `mentionsPersona` helper.
- Brand migration Mantle → mywalnut (2026-04-09): 52 files across app, API, Jove prompt, Linq SMS, legal pages, onboarding, PWA manifest, service worker, scripts, docs. DB column `mantle_user_id` → `owner_user_id` (migration `20260409_rename_mantle_user_id.sql`). localStorage keys `mantle_*` → `mw_*` with one-time migration shim. Domain `mywalnut.app`. External steps: Supabase redirect URLs, Linq webhook re-registration, contact card update.

## Not Yet Functional
*Last verified: 2026-04-07*

- **Multi-user group conversations**: Groups with 2+ mywalnut users get neutral intro but can't create conversation records (user_id NOT NULL constraint). Facilitator mode only works for single-mywalnut-user groups.

## Known Issues
*Last verified: 2026-04-07*

- **Classifier aggressiveness**: Haiku may flag shorter reflections as checkpoints. Word-count heuristic is in the classifier prompt but not enforced in code.
- **Auth token expiry**: No explicit token refresh on the client. Relies on middleware `getUser()` per page request. Long SPA sessions could expire. API routes return 401 → redirect to /login.
- **Ghost conversation rows**: Race condition if user sends a message before conversationId state updates. Mitigated by ref guard but not impossible.
- **OAuth redirect config**: Supabase dashboard Redirect URLs allowlist must contain callback URL for every environment. Defensive `?code=` forward in middleware recovers from allowlist drift.
- **Waitlist rate limiter not enforcing**: Upstash env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are not set in production. Rate limiter fails open by design. Code is wired correctly — just needs the Redis instance.

## In-Flight Work
*Last verified: 2026-04-14*

- PWA Phase 3 pending: standalone polish, auth flow testing, splash screens — needs device QA
- Beta recruitment: target 10 late-diagnosed autistic adults, ages 25-45
- Migration `20260408_add_onboarding_completed_at.sql` not yet run in Supabase dashboard
- Migration `20260409_rename_mantle_user_id.sql` not yet run in Supabase dashboard — must run before deploying brand migration code
- Migration `20260414_rename_sage_to_persona.sql` not yet run in Supabase dashboard — must run alongside Sage→Persona rename deploy
- Upstash Redis setup needed for rate limiting to enforce in production
- Linq deprecation: moving away from Linq SMS provider

## Beta Users
*Last verified: 2026-03-15*

- [Jeff to fill: current beta user count, any active testers, recruitment status]
- Target: 10 late-diagnosed autistic adults, ages 25 to 45 (often AuDHD). Audience defined by demographic and lived experience, not by recruitment channel.
- Success metric: 3+ out of 10 return for 3rd session unprompted within 2 weeks

## Test Suite
*Last verified: 2026-04-09*

- Test count: 363
- All pass, < 1s, zero API cost (all mocked)
- Framework: Vitest with vite-tsconfig-paths
- Run: `npm run test` (all) or `npm run test:watch` (dev mode)
