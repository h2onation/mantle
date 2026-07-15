# decisions.md — Why Things Are the Way They Are

> **Authority level**: Case law. Each entry is a settled question. Closed for debate unless explicitly reopened.  
> **Audience**: You (to remember why you made a choice) and Claude Code agents (to not re-litigate settled architecture).  
> **Format**: Each entry has Status, Context, Decision, and Consequences. If you want to revisit a decision, change its status to "Revisiting" and add a new entry with the updated reasoning.

---

## ADR-001: Parallel Extraction Over Sequential

**Status**: Settled  
**Context**: The extraction layer analyzes each user message to produce a research brief for Jove. Running extraction before Jove would add 2-5 seconds of latency per turn. Running it after would mean Jove never benefits from analysis.  
**Decision**: Run extraction and Jove simultaneously. Jove uses the previous turn's extraction state. Extraction saves its output for the next turn.  
**Consequences**: Zero added latency. One-turn lag on extraction context, which is negligible because the state is cumulative. First message has no extraction context at all (acceptable — same as the pre-extraction system). Adds complexity to the pipeline (two parallel calls, async state management) but the UX benefit is decisive.

## ADR-002: One-Turn Extraction Lag Is Acceptable

**Status**: Settled  
**Context**: Because extraction and Jove run in parallel, Jove always sees extraction state from the previous turn, not the current one.  
**Decision**: Accept the lag. Do not add sequential dependency.  
**Consequences**: Jove responds to what the user just said (it has the raw conversation history) but its strategic context (which layers to explore, whether a checkpoint is approaching) is one turn behind. Since extraction state is cumulative (turns 1-7 contain everything from turns 1-6 plus one new turn), the practical difference is negligible. The alternative — running extraction first — would double the time-to-first-token and make the product feel sluggish.

## ADR-003: Server-Side Composition After Classifier

**Status**: Settled  
**Context**: When Jove delivers a checkpoint, a polished manual entry needs to be composed. Earlier the architecture had Jove compose inline using `|||MANUAL_ENTRY|||` delimiter blocks (Path A) with a separate Sonnet fallback (Path B). This split produced two divergent code paths and inconsistent entry quality depending on which path fired.  
**Decision**: A Haiku classifier runs on every Jove response post-stream. When it flags a checkpoint, a separate Sonnet call (`composeManualEntry`) writes the polished entry from the conversational text plus the language bank. There is no inline delimiter, no Path A/B split. `composed_content` is always populated server-side before the confirmation card is shown.  
**Consequences**: One code path. Consistent entry quality regardless of how the checkpoint was detected. Cost is one additional Sonnet call per checkpoint (rare event). Jove's conversational response is no longer responsible for producing structured output, which simplifies its prompt and lets it focus on voice. `confirmCheckpoint()` keeps a raw-content fallback as a defensive safety net only.

## ADR-008: Raw Fetch Over Anthropic SDK

**Status**: Settled  
**Context**: The `@anthropic-ai/sdk` was initially installed but was removed.  
**Decision**: Use raw `fetch` for all Anthropic API calls via a custom `anthropicFetch` utility.  
**Consequences**: No dependency on SDK versioning or breaking changes. Full control over streaming, error handling, and request shaping. Slightly more code to maintain but the API surface is simple enough that the SDK's value-add didn't justify the dependency.

## ADR-009: Inline Styles Over CSS Classes

**Status**: Settled  
**Context**: Mobile-first app with a single design system.  
**Decision**: All styling uses `style={{}}` with CSS custom properties. Never use `className` on components. Tailwind is installed but only its base directives are used.  
**Consequences**: No class name conflicts. Design tokens are centralized in `globals.css` as CSS custom properties. Trade-off: slightly more verbose component code, no Tailwind utility classes for rapid prototyping. But for a mobile-first app with a controlled design system, inline styles with custom properties are simpler to reason about and harder to accidentally break.

## ADR-010: Linen Design System

**Status**: Settled  
**Context**: The app went through multiple design iterations including a dark void palette (`#0C0B0A` background) and a warm linen surface palette.  
**Decision**: Linen is the design system. Warm linen surface, Instrument Serif / DM Sans / JetBrains Mono typography, Jove green and navy token system. The dark void palette is deprecated.  
**Consequences**: All new work uses linen tokens (`--session-linen`, `--session-ink`, etc). Dark void tokens remain in `globals.css` for backward compatibility during migration but should not be used in new components. The linen palette creates a warmer, more approachable feeling that matches the product's purpose — this isn't a developer tool, it's a place where people examine their own patterns.

## ADR-011: Haiku for Classification, Sonnet for Conversation

**Status**: Settled  
**Context**: The pipeline uses AI models at three points: extraction (analysis), Jove (conversation), and classifier (checkpoint detection).  
**Decision**: Sonnet for extraction and Jove (quality matters). Haiku for classifier and session summary (speed and cost matter, task is simpler).  
**Consequences**: ~2x Sonnet + 1x Haiku per turn. Roughly doubles Sonnet cost versus a single-call architecture, but the quality improvement is decisive. Classifier on Haiku is slightly more aggressive than ideal (may flag shorter reflections as checkpoints) — this is a known issue documented in state.md.

## ADR-012: Mobile-First

**Status**: Settled  
**Context**: The primary use case is someone in the middle of their life pulling out their phone to talk through what just happened.  
**Decision**: Mobile-first design. The primary interface is a mobile shell (430px max-width centered). The product will also be accessible via text messaging (MMS, scoped separately) and web.  
**Consequences**: Design for the mobile surface first. Other entry points (text, web) adapt to the same interaction model. Desktop users see the mobile shell centered, which is acceptable for now. The text entry point (MMS via Twilio) uses the same Jove pipeline with a `smsMode` flag that strips checkpoint formatting but preserves voice and depth. Can be revisited post-product-market-fit.

## ADR-013: Quality-Based Checkpoint Gate

**Status**: Settled  
**Context**: A checkpoint could fire based on turn count (e.g., every 8 turns) or based on material quality.  
**Decision**: Quality-based. The extraction layer evaluates whether enough grounded material exists: concrete examples, mechanism connecting behavior to something deeper, and charged language from the user.  
**Consequences**: A checkpoint can fire at turn 4 if the user gives rich material, or take 15 turns if they're guarded. No artificial pressure to "produce" a checkpoint on schedule. The first-checkpoint gate is intentionally lighter (1 example vs 2) because the teaching moment needs to land early while still being substantive.

## ADR-014: Advisor Collapsed Into Jove

**Status**: Settled  
**Context**: Early designs had "Advisor" as a separate mode or toggle — a distinct context for applying the manual to live situations.  
**Decision**: Advisor is not a separate feature. It's Jove doing what it already does, in the context of a live situation. Same engine, same legal framework, different entry context.  
**Consequences**: No mode switching. No separate UI. When a user brings a live situation, Jove works with it in the same conversation. Jove surfaces the user's own confirmed patterns when relevant to a situation and asks what they want to do differently. This is simpler, more natural, and legally cleaner than a separate "advisor mode."

## ADR-015: Five-Layer Manual Structure

**Status**: Superseded by ADR-050 (structure migration 2026-06-24)  
**Context**: The manual needed a structure that captures the full picture of how someone operates without becoming either too shallow (one-page summary) or too fragmented (dozens of unconnected observations).  
**Decision**: Five layers grounded in clinical frameworks — drives, self-perception, reaction system, operating style, relational patterns. Layers can hold many entries; there is no per-layer cap.  
**Consequences**: Dense enough to be useful, bounded enough to complete. The five layers map to real dimensions of human behavior: what you need, how you see yourself, how you cope, how you work, how you relate. Grounded in Schema Therapy (layers 1-2), behavioral analysis (layer 3), and Attachment Theory (layer 5), with layer 4 as the practical synthesis. This structure may evolve as the product matures and user feedback reveals whether five layers is the right granularity. SUPERSEDED 2026-06-24: the five clinical pattern-type layers were replaced by five life-area sections + a closed tag set — see ADR-050. This entry is retained as the historical record of why five existed.

## ADR-016: User as Author

**Status**: Settled  
**Context**: Both a legal requirement and a product design principle. If Jove is the author of the manual, it's an AI-generated assessment. If the user is the author, it's a self-authored document created with AI assistance.  
**Decision**: The user is the author at every level. Jove proposes, user validates. Nothing writes without confirmation.  
**Consequences**: This principle governs everything: conversation design (Jove asks, doesn't tell), checkpoint flow (user confirms before writing), legal positioning (self-understanding, not assessment), marketing language ("build your manual" not "get your assessment"). Any feature where the answer to "who is doing the psychological work?" is Jove needs to be redesigned.

## ADR-017: Fire-and-Forget Extraction

**Status**: Settled  
**Context**: Extraction writes to `conversations.extraction_state` after each turn. The write could be awaited (guaranteeing state is saved before the next turn) or fire-and-forget (letting the write happen in the background).  
**Decision**: Fire-and-forget. `runExtraction()` is a background Promise, never awaited.  
**Consequences**: Jove's response is never delayed by extraction's write. In the rare case the write fails, the next turn's extraction starts from a slightly older state — acceptable because the state is cumulative. The alternative (awaiting the write) would add latency to every turn for a guarantee that's almost never needed.

## ADR-018: Message Rendering in MobileSession

**Status**: Settled  
**Context**: Message rendering (checkpoint cards, assistant messages, user messages, typing indicator, error display) could be extracted into separate components for cleaner file organization.  
**Decision**: Keep all message rendering in `MobileSession.tsx`. Do not extract.  
**Consequences**: Single file is larger but the rendering logic is tightly coupled — extracting would create a web of prop drilling and shared state. New chat UI features go in MobileSession unless fully independent of the message list. Import shared utilities from `@/lib/utils/format` and `@/lib/types`.

## ADR-019: Admin Role via JWT Only

**Status**: Settled  
**Context**: Admin access could be managed via a database column, a separate admin table, or JWT claims.  
**Decision**: JWT custom claims (`app_metadata.role = "admin"`), set only through direct SQL in the Supabase dashboard. Never via code, never via Claude Code.  
**Consequences**: No accidental admin grants. No code path that can escalate privileges. The `is_admin()` Postgres function checks the JWT claim and powers all admin RLS policies. Downside: after granting/revoking admin, the user must log out and back in (existing sessions retain old claims for ~1 hour).

## ADR-020: Three-Stage Pipeline

**Status**: Settled  
**Context**: A single prompt doing extraction, strategy, and conversation simultaneously produces generic results. The model can't hold "track what the user said three turns ago," "decide what layer to explore," "generate a grounded question using the user's language," and "maintain Jove's voice" in working memory at once.  
**Decision**: Separate extraction (analysis), conversation (Jove), and classification (checkpoint detection) into three distinct stages with distinct models and distinct outputs.  
**Consequences**: Jove receives a curated research brief every turn instead of trying to do its own analysis. The brief changes; the prompt stays the same. That's the leverage. The extraction layer can be tuned independently of Jove's voice. The classifier can be cheap (Haiku) because its job is narrow. Tradeoff: three models per turn instead of one, higher cost, more pipeline complexity. But the quality improvement is not incremental — it's categorical.

## ADR-021: Cumulative Extraction Model

**Status**: Settled  
**Context**: Extraction could either analyze the full conversation fresh each turn or build on the previous turn's state cumulatively.  
**Decision**: Cumulative. Each extraction call receives the previous state and the last 6 messages (3 exchanges). Language bank entries accumulate. Layer signals only advance forward. The cumulative state carries all earlier analysis.  
**Consequences**: Cheaper per turn (extraction reads 6 messages, not the full history). Consistent signals (a layer that reached "explored" stays explored). Extraction state from turn 8 contains everything from turns 1-7. Tradeoff: a bad classification on turn 3 carries forward into every subsequent turn. If extraction misreads a phrase's emotional charge or advances a layer signal prematurely, that error compounds. Mitigation: the cumulative state is large enough that one bad turn gets diluted by subsequent correct turns. And Jove has the full conversation history as a check — it doesn't rely solely on the extraction brief.

## ADR-022: Instant Checkpoint Confirmation

**Status**: Settled  
**Context**: When a user confirms a checkpoint, the manual entry could be composed at that moment (with an API call) or read from pre-composed content stored at detection time.  
**Decision**: Pre-compose at detection time. On confirmation, read `composed_content` from `checkpoint_meta` and write directly to the database. No Anthropic API call. Instant.  
**Consequences**: Confirmation feels immediate. No spinner, no waiting. The user taps confirm and their manual updates. Tradeoff: the entry captures the conversation state at the moment Jove checkpointed, not at the moment the user confirmed. If several messages pass between checkpoint and confirmation, the entry won't reflect refinements from those messages. In practice this rarely matters because users typically confirm or reject within 1-2 messages of the checkpoint. The fallback path (raw message content) handles edge cases.

## ADR-023: Sliding Window (First 2 + Last 48)

**Status**: Settled  
**Context**: Long conversations exceed the model's context budget. A windowing strategy is needed to keep conversation history within token limits while preserving the most useful context.  
**Decision**: When history exceeds 50 messages, include the first 2 messages and the last 48. Implemented in `call-persona.ts`.
**Consequences**: The first 2 messages preserve the session's opening context (what the user came in with, Jove's initial framing). The last 48 preserve recent conversational flow. The gap in the middle is acceptable because extraction state carries cumulative analysis of the dropped messages. Simpler than embedding-based retrieval, which would add latency and complexity for a marginal improvement at current conversation lengths. Revisit if users regularly exceed 100+ messages per session.

## ADR-024: Shared Pipeline Over Parallel Implementations

**Status**: Settled
**Context**: The text (Linq) and web paths through Jove duplicated ~280 lines of identical logic — DB reads, user state derivation, extraction firing, crisis detection, checkpoint gates, model constants. The text path was missing checkpoint layer guards and turn-count suppression, causing drift in checkpoint behavior.
**Decision**: Extract shared logic into `persona-pipeline.ts`. Both `call-persona.ts` (web) and `persona-bridge.ts` (text) import from the same module. Web-specific logic (streaming, Path B classification/composition, SSE events, URL/transcript detection) stays in call-persona. Text-specific logic (non-streaming fetch, checkpoint text formatting) stays in persona-bridge.
**Consequences**: Seven shared functions replace 13 duplication points. Rule changes (new gate, model upgrade, crisis phrase) happen in one place. Text path now enforces the same checkpoint rules as web. Tradeoff: an additional import layer adds one level of indirection. But the alternative — maintaining two copies of identical rules — already caused a real bug (missing layer guards in text). The indirection cost is trivial compared to the drift risk.

## ADR-025: Text Checkpoint Shows Name Only

**Status**: Settled
**Context**: When Jove detects a checkpoint via text, the original implementation sent a follow-up message containing the full composed entry plus the name and confirmation prompt. But Jove's conversational response already presented the insight in natural language — the user was reading the same content twice in different formats.
**Decision**: The checkpoint follow-up text shows only the proposed name and the confirmation question ("Does this feel right?" / "Does this resonate?"), not the full composed content. The user already read the insight in Jove's response.
**Consequences**: Cleaner text experience — one message with the insight, one short message asking for confirmation. Matches the web app's pattern where the checkpoint card shows the name prominently and the content is secondary. Tradeoff: the user can't re-read the exact composed content before confirming. In practice this is fine because (a) the conversational text and composed content are very similar, and (b) the user can always check their manual in the app afterward.

## ADR-026: Text Checkpoint Language Matches Text Context

**Status**: Settled
**Context**: The web app uses button labels "Yes, write to manual" / "Not quite" / "Not at all". The text path originally used "Reply YES to write to manual, NOT QUITE if it needs refining, or NO to discard." User feedback suggested aligning language but the button labels don't map cleanly to text replies.
**Decision**: Keep text-appropriate language. "Reply YES to write to manual, NOT QUITE to refine, or NO to discard." Do not force web button labels ("Not at all") into the text context where users need clear single-word reply instructions.
**Consequences**: Text and web have slightly different surface language but identical underlying behavior (confirmed/refined/rejected). The text variant prioritizes clarity of instruction (what to type) over exact label matching. Accepted keywords are broad: YES/Y/CONFIRM, NOT QUITE/NOTQUITE/REFINE, NO/N/DISCARD.

## ADR-027: Race Condition Guard Over Database Locks

**Status**: Settled
**Context**: `getOrCreateConversation()` in the text path has a read-then-write pattern vulnerable to race conditions when two texts arrive simultaneously. Options: (A) database-level advisory locks, (B) unique constraints with upsert, (C) retry-on-failure pattern.
**Decision**: Retry-on-failure. If the insert fails (another request won), re-query to find the winning conversation.
**Consequences**: No database schema changes needed. No advisory lock complexity. The retry adds one extra query in the rare concurrent case. Tradeoff: doesn't prevent two conversations from being created if the database has no unique constraint on (user_id, status=active). In practice, Supabase allows multiple active conversations per user by design (session history feature), so the worst case is two active conversations — not data corruption. The retry ensures both messages land in the same conversation.

## ADR-028: ND Pivot — Existing manual_components Are Left in Place

**Status**: Settled (2026-04-06)
**Context**: PR1 of the ND migration renames the five manual layers from the general framework ("What Drives You", "Your Self Perception", etc.) to the autism-specific framework ("Some of My Patterns", "How I Process Things", etc.). Existing rows in `manual_components` reference layer ids 1-5 with content written under the old framework. Three options were considered: (a) leave rows in place; entries display under new section names; (b) archive existing rows behind a `framework_version` column; (c) per-user opt-in reset on first post-migration session.
**Decision**: Leave them in place (option a). The beta has effectively zero existing autistic users with confirmed manuals — the affected accounts are test accounts and Jeff's own. No schema change, no archive logic, no migration code.
**Consequences**: Zero-cost migration for content. The handful of legacy entries will display under their new layer names. If a real user complains post-launch with a meaningfully populated pre-pivot manual, revisit this decision then. Avoids building a `framework_version` column and archive flow that would only ever serve a single user transition.

## ADR-029: ND Pivot — Layer Names Centralized in src/lib/manual/layers.ts

**Status**: Settled (2026-04-06)
**Context**: Layer names were duplicated across 5+ files (`extraction.ts`, `system-prompt.ts`, `classifier.ts`, `confirm-checkpoint.ts`, `layer-definitions.ts`, plus tests and docs). The Feb 2026 layer rename and the Apr 2026 ND pivot both required touching these strings file by file. `.claude/DRIFT_LOG.md` exists in part because of this drift.
**Decision**: Single source of truth at `src/lib/manual/layers.ts`. Exports `LAYERS` (full definitions including names, descriptions, dimensions, examples), `LAYER_NAMES` (id → name lookup), and `getLayer(id)`. Every consumer (extraction prompt builder, system prompt, classifier, confirm-checkpoint, mobile UI) imports from this file. Prompts interpolate the canonical block instead of hardcoding strings.
**Consequences**: Renaming a layer is a one-line change in `layers.ts`. Drift between UI and Jove code is structurally impossible — they both read the same constant. Tests assert against `LAYER_NAMES[N]` rather than literal strings, so a future rename never silently breaks assertions. Cost: one new file, minor refactor of five existing files. Offset: every future layer change touches one file instead of twelve.

## ADR-030: ND Pivot — sage_mode Column With Single Value, Forward-Compatible Seam

**Status**: Settled (2026-04-06)
**Context**: PR1 ships ND-only voice. The plan needs to support adding additional voice modes (general, ADHD-specific, etc.) later without re-plumbing the call chain. Options: (a) hardcode autism voice in the prompt and add the seam later; (b) add the seam now even though there's only one value; (c) build a full mode registry with branching now.
**Decision**: Option (b). Add `persona_mode text` column to `profiles` (nullable, check constraint allows only `'autistic'` for now; originally shipped as `sage_mode`, renamed in `supabase/migrations/20260414_rename_sage_to_persona.sql`). Thread `personaMode` through `ConversationContext` → `BuildPromptOptions` → `buildSystemPrompt`, defaulting null to `'autistic'`. Voice content remains hardcoded autism-only in PR2a/PR2b. The seam exists but does not branch yet.
**Consequences**: Adding a second voice mode in the future is a content change, not a plumbing change — extend the check constraint, add a branch in `buildSystemPrompt`, done. The single-value plumbing is a small amount of "future-facing" code, but it lives behind type-safe interfaces (`PersonaMode = 'autistic'`) so a second mode added later gets caught by the compiler at every consumer site.

## ADR-031: Remove Pattern Feature, Single Entry Type

**Status**: Settled (2026-04-07)
**Context**: The earlier architecture distinguished "components" (the integrated portrait of a layer) from "patterns" (specific behavioral loops within a layer), with a four-way enforcement chain (system prompt TYPE RULE → extraction `target_type` → call-sage hard guard → confirm-checkpoint safety net), single-pattern tracking per layer, recurrence detection, derived `chain_elements`, a `discovery_mode` flip from "component" to "pattern" after the first confirmed entry, and a saturation rule capping each layer at 1 component + 2 patterns. In practice the type discriminator was the source of most checkpoint pipeline bugs, the component-vs-pattern distinction was invisible to users (they just saw "manual entries"), and the saturation cap prevented Jove from writing additional material when a layer had more to say.
**Decision**: Remove the pattern feature entirely. Every manual entry is the same shape. Layers can hold many entries with no cap, no type discriminator, no discovery mode flip, no recurrence gate, no chain walk, no saturation rule, no pattern-specific composition or validation. The classifier only decides which of the five layers an entry belongs in. User-facing copy that says "patterns" stays as product language — this is an internal architecture change, not a product rename.
**Consequences**: One entry shape simplifies the entire pipeline. The four-way TYPE RULE enforcement chain is gone, eliminating an entire class of pipeline bugs. Jove writes to the manual whenever it has something worth writing, judged by quality (concrete examples, mechanism, charged language) rather than by component-vs-pattern hierarchy. ADR-003 (inline composition Path A/B), ADR-004 (single pattern tracking), ADR-005 (component-before-pattern), ADR-006 (recurrence is Jove's judgment), and ADR-007 (chain_elements derived) are all superseded — their pre-removal entries are deleted from this document. The 1+2 cap from ADR-015 is also lifted. No data migration was needed because there was no real user data.

## ADR-032: Linen Tokens Projected Into Tailwind (Design 2.0)

**Status**: Settled (2026-04-16)
**Context**: The Linen design system lives in `src/app/globals.css` as `--session-*` CSS variables, but `tailwind.config.ts` had `theme: { extend: {} }`. Every component authored design decisions as inline `style={{}}` reading CSS vars directly. Design system coherence was not enforceable through utility classes — a raw hex literal in a JSX diff would slip through review as system drift. Opening a Design 2.0 branch surfaced this as a blocker to every subsequent visual commitment.
**Decision**: Project the existing `--session-*` vars into `tailwind.config.ts` under `theme.extend.colors`, `fontFamily`, and `fontSize`. Drop the `session-` prefix at the utility surface (`bg-linen`, `text-ink-soft`, `font-persona`) while leaving CSS var names unchanged. No new tokens introduced; every value points at an existing var. `font-sans` / `font-serif` / `font-mono` intentionally override Tailwind defaults so the utilities resolve to project faces. `text-ink` resolves to the darkest value (`--session-ink`, `#1A1614`) because grep confirmed it is the body default across the app (~57 `color:` uses versus ≤4 for softer variants) — not a strongest-emphasis variant. Components are not migrated in this step; the utility surface is available for new work and opportunistic edits.
**Consequences**: Two naming quirks are accepted as tech debt: `border-persona-border` and `text-error-text` read redundantly because the corresponding CSS var names (`--session-persona-border`, `--session-error-text`) encode intent-of-use in the token name itself. Cleaning them up would require renaming the CSS vars, which is a token-hygiene pass outside this step's scope. Revisit if they grate in real use. Spacing scale, `borderRadius`, `boxShadow`, and `animation` are deliberately not projected in this step — each requires a design decision (canonical radii, shadow grammar, animation timing) that is due in later Design 2.0 steps. ADR-009 (Inline Styles Over CSS Classes) is not reversed here: existing components keep their inline styles, and the new utility surface is additive. A future ADR will revisit inline-vs-utility policy once Design 2.0 migration lands.

## ADR-033: MobileNav Tap Target Sub-44px (Known Accessibility Debt)

**Status**: Known debt, scheduled (2026-04-16)
**Context**: MobileNav tab buttons have `padding: 0 0 3px` with an 11px mono label, giving a vertical tap target of ~14px. Apple HIG requires 44×44. This predates Design 2.0 — the original serif-at-12px implementation had the same issue. Design 2.0 Step 2 ("cramping fix") was scoped to nav visual weight reduction, not tap targets; enlarging the tap target to meet HIG while keeping the nav visually quiet requires a larger structural change (e.g., invisible touch padding extended into the nav's vertical zone, or a different active-affordance that doesn't require tapping directly on the label glyph).
**Decision**: Accept the sub-44px targets for now. Do not fix in Step 2. Do not introduce touch padding as a band-aid without a considered approach. Schedule a dedicated accessibility pass after Design 2.0 lands that audits tap targets across all mobile surfaces (nav, ChatInput action button, SessionDrawer rows, Manual entry Read-more buttons, checkpoint action row) rather than fixing the nav in isolation.
**Consequences**: Existing sub-HIG targets in the nav remain. Users with motor-control differences may miss taps. Mitigation: the tab labels are well-separated horizontally (space-evenly distribution across a 430px phone frame gives each tab ~143px of horizontal tap zone width — the horizontal axis is generous, only the vertical is constrained). The next accessibility pass will resolve this project-wide with one coherent approach rather than three ad-hoc fixes.

## ADR-035: Dual-Provider Messaging (Sendblue 1:1, Linq Groups)

**Status**: Settled (2026-04-16)
**Context**: Linq Partner API V3 handled both 1:1 SMS/iMessage and iMessage group facilitator. We moved 1:1 to Sendblue for improved iMessage deliverability and operational simplicity. Sendblue's webhook, however, does not emit `participant.added`, `participant.removed`, or `chat.created` events and has no equivalent to Linq's `getChatInfo` — all four primitives the group facilitator relies on for intro-on-add, close-on-owner-left, and re-detection.
**Decision**: Dual-provider permanently. 1:1 text flows through Sendblue. Group facilitator stays on Linq. Outbound routes through `src/lib/messaging/send.ts`, which picks Sendblue by default (env `MESSAGING_PROVIDER`) and always picks Linq when a `linqGroupChatId` is passed. Both webhook endpoints stay live. Rebuilding group detection on Sendblue (per-message participant diffs) was rejected as out of scope for the 2026-04-28 beta.
**Consequences**: Two webhook endpoints, two credential sets, two providers to monitor. The cost is ongoing but bounded. Rollback is partial: flipping `MESSAGING_PROVIDER=linq` reverts 1:1 outbound, but inbound always flows through whichever endpoint the message landed on — both must stay live. The group facilitator path is unchanged, so the existing feature does not regress. Future port of groups to Sendblue is tracked in state.md "In-Flight Work." Unified `sendMessage()` preserves Linq's non-throwing contract (`{ok: false}` on failure) so every existing caller continues to compile and behave unchanged.

## ADR-036: No Dev Supabase — Migrations Apply to Prod via Dashboard

**Status**: Infrastructure Debt (2026-04-16)
**Context**: The Supabase CLI is linked to one remote project (`nkmperzwcmttdkxwhbiv`, prod). Local Supabase via `supabase start` requires Docker Desktop, which is not installed. There is no separate dev remote project. Consequence: every migration so far has been applied by pasting the SQL into the Supabase dashboard SQL editor against prod, or by letting CI run `supabase db push` on merge.
**Decision**: Accept this state for the 2026-04-28 beta. Continue to apply migrations by dashboard paste (additive-only schemas), guarded by the rule that agent-generated migrations must be reviewed by the owner before application. Do not `supabase db push` from an agent session — the CLI would write to prod without a confirmation gate.
**Consequences**: No safe rehearsal environment for non-trivial schema changes. Drift risk is mitigated by the Schema Health admin panel (Track 1) and the CI workflow. Before beta scale, resolve by either (a) installing Docker locally and adding a `supabase db reset` step to the pre-merge workflow, or (b) provisioning a dedicated dev Supabase project and re-linking the CLI.

## ADR-037: messaging_events.content Is Metadata-Only

**Status**: Settled (2026-04-16)
**Context**: ADR-035 introduced the `messaging_events` audit table and copied the `content` field through from the Sendblue response on outbound and from the webhook payload on inbound. Review at Checkpoint E of the migration — before any real user text flowed through the system — identified this as a violation of the CLAUDE.md Security Rule *"Never log user message content, phone numbers, or auth tokens."* The table stored (a) user-authored inbound text, (b) Jove-authored outbound text, and (c) **OTP codes on OTP-send rows**. RLS + service-role-only access limited the blast radius but did not eliminate the PII surface. For a product that helps ND adults examine their inner lives, logging message text even under admin access crosses a trust line.
**Decision**: `messaging_events.content` is metadata-only by design. The unified `sendMessage()` wrapper takes an optional `contentKind` of `"otp" | "user" | "jove" | "system"` and runs `redactForAudit()` before insert. Replacement strings: `[OTP_SEND]`, `[USER_MSG len=N]`, `[JOVE_REPLY len=N]`, `[SYSTEM_MSG len=N]`. Default when unspecified is `"system"` — the safest fallback. The inbound Sendblue webhook applies the same transform inline (`[USER_MSG len=N]`) and replaces `raw_payload` with a fields-only projection so the full message body does not land there either. Migration `20260417000008_redact_messaging_events_content.sql` nulls legacy rows.
**Consequences**: Audit rows still carry `direction`, `provider`, `provider_message_id`, `from_number`, `to_number`, `status`, `error_code`, `error_message`, length, and `created_at` — enough for delivery debugging, dedupe, and cutover monitoring. What's lost: byte-for-byte content comparison. Operational impact: if a user reports "I got the wrong reply," we reconstruct from the `messages` table (joined via `provider_message_id` / timestamps) rather than reading audit content. This is the correct separation — the `messages` table is the product's conversational record, the `messaging_events` table is ops-only. Retroactively, pre-fix content is purged; no admin dashboard relies on content today. The `raw_payload` column on outbound rows is omitted entirely for Sendblue sends because Sendblue's response echoes the full body there; on inbound it is replaced with a safe projection.

## ADR-038: Drop Per-Row OTP Attempts Counter; Rely on Upstash Rate Limiter

**Status**: **Reversed (2026-05-19)** — see "Reversal" below. Original decision settled 2026-04-16.
**Context**: The OTP flow had two layers of abuse protection against a phone being spammed with verify-code guesses: (a) a per-row `otp_attempts` counter on `phone_numbers`, incremented on each wrong code, capped at `OTP_MAX_ATTEMPTS = 5`; and (b) phone-keyed Upstash rate limiters on `/api/user/phone` (OTP send: 3/hr) and `/api/user/phone/verify` (verify: tighter window). During Checkpoint E of the Sendblue migration, a schema audit caught that `phone_numbers` has no `otp_attempts` column. Every increment silently failed, and every `select` returned `null` for the field. The counter had been a no-op in production for an unknown period. Rather than add the column retroactively and keep two counters to reason about, we removed the in-code attempts logic in migration 20260417000009 (schema-align rename `verification_code → otp_code`, `code_expires_at → otp_expires_at`, no new column added).
**Decision (original)**: Attempts protection lives in Upstash only. `OTP_MAX_ATTEMPTS` is removed from `src/lib/phone-otp.ts`. `src/app/api/user/phone/verify/route.ts` no longer reads, writes, or gates on `otp_attempts`. A wrong code returns 400 as before; a 429 comes only from the Upstash rate limiter. This cuts the reasoning surface to one layer and removes the silent-no-op footgun.
**Consequences (original)**: Abuse protection is **weaker than the prior documented design** until the Upstash env vars are set. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are missing in Vercel production (confirmed from runtime logs: `[rate-limit] Upstash env vars missing — all rate limiters will fail open`). With both layers gone, an attacker with a valid phone number could attempt unlimited OTP guesses until the 10-minute expiry. The 6-digit code space and 10-minute TTL bound worst-case attack success to roughly a 1-in-166 chance per OTP lifetime under naive brute force — not catastrophic, but materially worse than the prior design. **Closing this gap is a beta-blocking task.** Fix: provision an Upstash Redis REST instance, add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to Vercel (all scopes), redeploy. After that, the verify route's rate limiter enforces a per-phone attempts ceiling naturally, and the OTP-send limiter (3/hr) prevents re-request spam. Tracked prominently in state.md In-Flight Work.

**Reversal (2026-05-19)**: Restored the per-row attempts counter rather than provisioning Upstash. The owner pushed back on adding an 8th vendor for what was conceptually a single-counter feature, and the broader chat-token-abuse concern was independently addressed by the Postgres-backed daily message limit (merge SHA `dbd433b`, see state.md ship log). With chat covered, the only remaining gap was OTP brute force — which the per-row counter was originally designed for. Migration `20260519000000_restore_otp_attempts.sql` adds `otp_attempts integer not null default 0` to `phone_numbers` (idempotent via `add column if not exists`). `OTP_MAX_ATTEMPTS = 5` is back in `src/lib/phone-otp.ts`. The verify route reads the column, returns 429 with `{ error: "too_many_attempts" }` once attempts hit the cap, increments on every wrong code (best-effort; an increment failure logs but doesn't change the response status), and resets to 0 on successful verify alongside the existing OTP-field clear. The send route resets to 0 on every fresh issuance in both the update branch (existing row) and the insert branch (new row), so the legitimate "I typed wrong; send me a new code" path is never locked. Legacy rows from before the migration are coerced via `?? 0` in the route, so the cap is treated as "fresh" rather than "exceeded." Upstash provisioning is now optional rather than beta-blocking; the verify-route rate limiter still calls `checkLimit(phoneOtpVerifyTenMin, phone)` and would add burst protection if Upstash were provisioned later. Files: `supabase/migrations/20260519000000_restore_otp_attempts.sql` (new), `src/lib/phone-otp.ts` (+OTP_MAX_ATTEMPTS, header rewrite), `src/app/api/user/phone/verify/route.ts` (read otp_attempts, 429 at cap, increment on wrong, reset on success), `src/app/api/user/phone/route.ts` (reset on send in both branches), `src/app/api/user/phone/route.test.ts` (+5 tests: increment, cap → 429, legacy-null safety, reset on send update, reset on send insert; existing happy-path test extended to assert otp_attempts: 0 in the promotion patch). 801 tests pass (was 796; +5). Migration applies by dashboard paste per ADR-036.

## ADR-039: Sendblue Webhook Auth Is Shared Secret, Not HMAC

**Status**: Settled (2026-04-17) — **revisit if Sendblue adds body signing**
**Context**: When wiring inbound Sendblue routing (ADR-035 follow-up), the first real webhook's header set surfaced `sb-signing-secret` as the only non-standard header. Sendblue's scheme is: on webhook registration we supply a secret string, and Sendblue attaches that exact string — verbatim, no HMAC — as the `sb-signing-secret` header on every outbound webhook. There is no body signature. Incoming requests cannot be authenticated as *"this body hasn't been tampered with"* — only as *"this request came from someone who knows our shared secret."* An attacker who obtains the secret (leaked log, repo history, compromised Vercel env) can forge arbitrary webhooks that our handler will treat as authentic.
**Decision**: Verify by constant-time equality compare of the header value against `SENDBLUE_WEBHOOK_SECRET` on every inbound. Fail closed: if the env var is unset, verification returns false and routing is skipped. Audit rows stamp `verified: boolean` in `raw_payload` so ops can distinguish verified from unverified inbound. Do **not** design around HMAC semantics that Sendblue doesn't offer — don't demand a signature of the body, don't derive one from the body, don't pretend this protects integrity. Rotate the shared secret via Sendblue dashboard + Vercel env any time the current value is suspected leaked; the audit trail makes pre-rotation traffic visible for post-hoc review.
**Consequences**: Weaker than HMAC. An attacker with the secret can inject arbitrary inbound messages for any phone number; the router would then attempt to look up the spoofed `from_number` against `phone_numbers` and either respond to an unknown-number prompt (most cases) or impersonate an existing verified user (if they know a real user's phone number). Blast radius for that second case: the attacker can cause our system to send Jove replies *back to the real user's phone* — we address replies by phone, not by webhook sender identity. That's not quite a forgery-of-conversation-content attack, but it's a vector for user harassment. Mitigations that are cheap to layer later: per-number inbound rate limits in the router (would require Upstash to be live; see ADR-038), correlating webhook source IP against a Sendblue-published IP allowlist if they ever publish one, and shared-secret rotation cadence. Revisit this ADR if Sendblue publishes HMAC body signing — at that point we can demand proof of body integrity and stop trusting forgeable shared-secret checks alone.

## ADR-041: Sendblue Migration Shipped — Closing the Loop

**Status**: Shipped (2026-04-17)
**Context**: ADR-035 established the dual-provider architecture for the Sendblue migration (Sendblue for 1:1, Linq for group facilitator). Over 2026-04-16 and 2026-04-17 the migration shipped in nine commits with explicit checkpoints, schema integrity gates, a PII-redaction fix caught pre-ship (ADR-037), an OTP-schema reconciliation (migration 20260417000009), shared-secret webhook signature verification (ADR-039), typing-indicator UX, latency instrumentation, and outbound status callbacks that close the delivery-visibility loop. A bug at the final step — outbound status events routing to a deleted scaffold URL — was diagnosed as a Sendblue webhook-registration gap and resolved by registering both `receive` and `outbound` at the single `/api/webhooks/sendblue` endpoint; the handler dispatches on `payload.is_outbound`.
**Decision**: Close the migration as shipped. End-to-end verification on 2026-04-17 from 20:42:55 to 20:43:05: real inbound iMessage to +16292925296 → Jove reply generated in ~6s (Anthropic + send) → Sendblue outbound-status callback confirmed DELIVERED in ~4s more. The `messaging_events` outbound row for that reply carries `status=DELIVERED` and `delivered_at=2026-04-17 20:43:05.578+00`. Ten seconds of measurable inbound-to-delivery-confirmation latency end-to-end. Any delay beyond that point (the 30-60s perceived gap before the iMessage bubble renders on the recipient's device) is Apple's iMessage relay — outside our instrumentation surface.

**What's live as of this ADR**:
- 1:1 text outbound (OTP codes, greetings, Jove replies) via Sendblue with PII-redacted audit rows (ADR-037)
- `/api/webhooks/sendblue` verifies `sb-signing-secret` on every inbound event (ADR-039) and dispatches on `payload.is_outbound` — inbound user text → Jove pipeline; outbound status callback → update existing audit row with `status` and, on DELIVERED, `delivered_at`
- Forward-progress status guard prevents late/out-of-order Sendblue events from overwriting terminal states
- New `delivered_at timestamptz` column on `messaging_events` (migration 20260417000010) with a partial index for future delivery-latency analytics
- Typing indicator fires after signature verification, fire-and-forget, so typing API failures never block Jove's reply
- Latency breakdown log per round-trip (`[latency] sendblue_roundtrip handle=… total=… verify=… audit_in=… phone_lookup=… context_load=… anthropic=… persist=… send=…ms`)
- Rollback flag: `MESSAGING_PROVIDER=linq` reverts 1:1 outbound without a code change; both webhook endpoints (`/api/webhooks/sendblue` and `/api/linq/webhook`) remain permanently live
- Linq group facilitator path untouched — groups continue to route through Linq's `chat_id`-based API

**Commit sequence (2026-04-16 → 2026-04-17)**: `33f2431` phone-schema alignment · `2afda55` ADR-038 + Upstash flag · `54245f3` inbound routing + signature verification · `69dca2a` latency instrumentation · `4be91db` typing indicator · `af18e18` outbound-status probe scaffold · `b4897bc` scaffold env-gate hardening · `7cded30` outbound status callbacks wired to `messaging_events`. Sendblue webhook registration updated in-session to point both `receive` and `outbound` at the main endpoint.

**Consequences**: 1:1 text on mywalnut runs on Sendblue with full server-side observability — latency buckets per round-trip, delivered_at per outbound, signature-verified ingress on both directions, status-progression tracking that survives out-of-order delivery. Linq stays alive for groups and as the outbound rollback target. The scaffold debug gate (`SENDBLUE_STATUS_DEBUG`) was decommissioned when the scaffold was deleted and can be removed from Vercel. **Follow-up work is tracked in state.md In-Flight Work, not unfinished pieces of this migration**: (1) Upstash rate-limit env vars missing in production — beta-blocker per ADR-038, must close before beta enrollment; (2) typing-indicator visibility on the recipient device was ~1 second during the end-to-end test — worth a follow-up to understand whether Sendblue's typing API propagation is slow or whether Apple expires the indicator before Jove's reply lands; (3) extraction pipeline errors surfaced during manual testing are a separate bug, not migration-related; (4) Sendblue support follow-up on `IC-Qb-008` phone-pool queue variance (3.7-45s observed during the latency investigation). None of those block closure of this ADR.

## ADR-034: Design 2.0 Step 2 — Cramping Fix (No Architectural Change)

**Status**: Settled (2026-04-16)
**Context**: The mobile chat feed was losing ~150px of reading height to a cramped bottom stack (nav + input + safe-area). Option considered and rejected: demote the three-tab nav to a single menu control and recover the full zone. Rejected because the Manual is the product's output, not incidental navigation — demoting it mid-beta would create noise in the feedback signal. The fix had to recover feed height without architectural change.
**Decision**: Reduce the nav's visual weight and recalibrate the reservation. Specific moves: (a) swap nav label face from `--font-serif` (Instrument Serif) to `--font-mono` (JetBrains Mono) at 11px with 1.8px tracking — mono unifies the nav with other structural labels (`JOVE`, `TEXT`, layer names) and reads as structure rather than decoration; (b) reduce nav container padding from 14/20 to 10/14 above-safe-area; (c) add `border-top: 1px solid var(--session-ink-hairline)` as a structural floor boundary; (d) keep inactive tab at `--session-ink-mid` and push active to `--session-ink` (darkest) for strong active/inactive contrast without relying on `--ink-ghost` (which trends toward 4:1 at 11px and fails for dyslexic users in low-light conditions); (e) bump ChatInput outer padding from `8px 20px 4px` to `12px 20px 8px` so the input reads as a dedicated writing surface on linen, not as utility chrome; (f) recalibrate `main`'s paddingBottom across all three tabs (Session, Manual, Settings) from 68px to 52px to match the lighter nav.
**Consequences**: ~14–18px of feed height recovered. Nav reads as a structural floor rather than a competing bottom-zone element. Input claims priority as the writing surface. The hairline boundary is felt but not seen (8% ink on linen). Architecture unchanged — three tabs remain, absolute positioning remains, phone-frame remains. Risk: sub-44px tap targets remain (see ADR-033); active-tab ink-darkest may read as over-asserted on some surfaces — if feedback comes in that active reads too heavy, fallback is active at `--ink-soft` with a thicker (2px) or warmed (`--session-persona`) underline. On-device daylight verification for the ink-mid/ink contrast pair is the responsibility of the human reviewer; the agent session cannot verify outside simulated screenshots.

## ADR-042: Input Modes — Readiness-State On-Ramps, Two Interview Styles

**Status**: Settled (2026-05-18)

**Context**: The product surface and shipped code have three chat input modes — Situation, Guided intake, and Upload — but `intent.md` until now described a different trio (Situation, Resonant content, Personal uploads) framed as signal-type diversity ("each generates different signal; together they build a picture no single source can"). Resonant content (URL detection + fetch) was removed from the runtime pipeline when Upload shipped, but its source files (`src/lib/utils/url-detection.ts`, `src/lib/utils/fetch-url-content.ts`) were retained "for a future entry point," and Guided intake was added without an ADR. A May 2026 audit traced the drift and surfaced opportunities for cleanup, deduplication, and prompt-engineering polish. This ADR ratifies the shipped product, retires Resonant content, and locks the architecture that the upcoming per-mode polish will build on.

**Decision**: Three input modes as readiness-state on-ramps; two interview styles; per-mode entry-phase exhaustion encoded as conditions on the existing Tier 3 prompt-block ladder.

1. **Three modes, three entry experiences.**
   - *Situation* — user brings something live; opens by typing into an empty input; Jove listens and deepens.
   - *Guided intake* — user wants Jove to lead; Jove opens with a locked invitation to name a relationship; structured-intake posture persists for the conversation's life and softens only on explicit user redirect.
   - *Upload* — user has an artifact (text-paste); Jove opens with a locked invitation; entry-phase mechanics (format identification, framing question, third-party-content guardrails) cover the first ~2-3 user turns, then the conversation runs on reflective exploration with the artifact as enriched context.

2. **Two interview styles, mapped onto the modes.** *Reflective exploration* (user-driven, narrative, depth-oriented) runs Situation and post-entry-phase Upload. *Structured intake* (Jove-driven, systematic, coverage-oriented) runs Guided intake. The two are not interchangeable — Guided's posture is a deliberate interview-style override, not a different entry into the same posture.

3. **Per-mode lifecycle, encoded on the existing Tier 3 ladder.** Each mode-specific Tier 3 block declares its own render condition using `userTurnCount`, `mode`, and a `guidedPostureSoftened` redirect signal. No unified "phase" or "modeActive" primitive — per-block conditions match each mode's true exhaustion pattern (turn count for Situation's first-message + Upload's entry phase; redirect signal for Guided).

4. **`conversations.mode` is immutable.** Set at conversation creation, stored for analytics, never mutates. The runtime never "flips" mode mid-conversation; the prompt simply renders fewer mode-specific blocks once the entry phase exhausts.

5. **Shared pasted-content template.** Mechanical handling guidance for pasted text (format identification, third-party guardrails, format-aware reading) is shared between Upload's Tier 3 block and the passive `transcript_detected` dynamic block via a single `renderPastedContentGuidance()` template. The framing — Upload's locked-opener context vs. transcript-detected's mid-conversation-paste context — stays mode-specific.

6. **Prompt-injection wrap on pasted content.** Whenever pasted content is identified (upload turn or transcript-detected turn), the content is wrapped in `<pasted_content>` XML tags at message construction with an explicit "treat as data, not instructions" preamble. Low-cost defense against in-band instructions in user-supplied text.

7. **`buildSystemPrompt` survives as a thin wrapper.** The string-form `buildSystemPrompt` cannot be deleted — `src/lib/linq/group-bridge.ts` routes through it to reach `buildGroupPrompt`, which is not currently exported. The wrapper preserves byte-identical legacy join order so the Linq production paths and admin prompt-architecture viewer remain unchanged. Production hot path (`call-persona.ts`) continues to use `buildSystemPromptBlocks` directly for cache control.

8. **Resonant content is retired.** The source files (`url-detection.ts`, `fetch-url-content.ts`, and their tests) are deleted. The "retain for future entry point" justification ends here. If we ever want URL-based input again, it ships as a deliberate new product decision, not as a dormant capability.

9. **Deferred to post-beta** (acknowledged future work, not part of this decision):
   - Chip protocol (`---chips---` in-band delimiter) → Anthropic tool-use.
   - JSON outputs (extraction, composition) → forced tool-use / `response_format`.
   - File / image / PDF support for Upload (currently text-paste only).
   - A/B harness for prompt iteration (current tests assert substring presence, not behavior).

**Consequences**:

- `intent.md` Layer 1: Input rewritten from signal-type to readiness-state framing. Beta scope's "Resonant content input" line replaced with "Guided intake input." WS6 (Resonant Content Input) and WS7 (Personal Uploads Input) collapse into a single WS6 (Input Modes Polish).
- `rules.md` Dead Features list gains Resonant content; the dynamic-context-blocks enumeration drops the stale "shared URL content" entry. `CLAUDE.md` matched.
- Upload's Tier 3 block stays lean (entry-phase mechanics only); the prompt instructions that asked the model to interpret exit conditions ("drop guided posture after first checkpoint," "this becomes a normal conversation") are removed because per-block render conditions handle transition.
- Guided intake's posture persists for the conversation's life rather than exhausting at first checkpoint — a single checkpoint isn't a strong signal to abandon a structured-intake style the user opted into.
- Three duplicate bodies of pasted-content guidance collapse to one shared template.
- The `transcript_detected` suppression in `call-persona.ts` narrows in scope but does not disappear. With the shared template (§5), the *body* of the guidance is consolidated, but the *framing wrappers* still differ (`UPLOAD MODE / OPENER / WHEN THE USER PASTES CONTENT` vs. `TRANSCRIPT DETECTED / RECOGNITION`). Firing both on the same turn would duplicate the wrapper sections around identical body content. The Phase 1.4 implementation keeps the suppression for the dynamic-block rendering decision while running detection itself on every message so the prompt-injection wrap (§6) can fire in both upload and non-upload paths. This is a refinement to the §5 architectural intent, not a divergence from it.
- Future addition of a fourth mode would require a new entry in the Tier 3 ladder, a mode-specific block with its render condition, and a `conversations.mode` CHECK constraint update — no other plumbing.

## ADR-043: The Three Lock 1 Blockers — Pre-Prompt Selector, Surface Threshold, Drop Cross-Context Gate

**Status**: Settled (2026-05-27)

**Context**: Lock 1 — the composer's fail-closed verbatim-language check (one of the seven locked decisions in `docs/architecture/master.md`, "Decision 6") — could not be spec'd until three architectural questions were resolved. They were documented as "Blockers on Lock 1" in master.md section A. The three are interdependent: where the selector sits determines where the ripeness gates live; the Surface threshold determines what the selector routes on; the cross-context requirement determines what the Save gate (which Lock 1 sits on top of) enforces. This ADR resolves all three. ("Decision 4" / "Decision 6" below refer to the master.md seven-decision set, not to ADR numbers. The parent plan is the proposed two-layer-engine ADR, drafted in `docs/reference/two-layer-engine-adr-draft.md` as ADR-044.)

### Decision 1 — Selector location

**Decided**: A **pre-prompt selector**. It runs after `loadConversationContext` and before `buildSystemPromptBlocks`. Its output is a row name that determines which Tier 3 block(s) render. It reads the **previous** turn's monitor output, not the current turn's — so the monitor stays parallel/background via `waitUntil` and adds no latency to the critical path, consistent with how extraction already runs on a one-turn lag (ADR-001, ADR-002).

**Why**: Decision 4 calls the selector "structural, not stylistic." Shaping the prompt before generation is structural; rewriting output after generation is not. Reflect-as-default only works if the selector shapes the prompt — you cannot make reflection the *default action* by filtering output post-hoc. Safety gating is also cleaner this way: the model is never prompted to recognize during rupture, rather than generating a recognition that a downstream gate then has to suppress.

**Consequence**: `TIER_3_BLOCKS` becomes the selector's output handlers. Blocks that don't map 1:1 to rows (`post-rejection`, the `post-confirm-*` pair, `returning-user`) must be folded into a row, kept always-on, or re-conditioned — that mapping is a design pass that precedes the build. `applyCheckpointGates` becomes specifically the SAVE row's gate. Runtime gets simpler — one ordered ladder replaces combinatorial flag-firing — at the cost of a one-time refactor at build time.

**Rejected**: a **pre-detector selector** (a post-generation filter). It is structurally incompatible with reflect-as-default and turns the selector into a corrective filter rather than the structural centerpiece the architecture rests on.

### Decision 2 — Surface ripeness threshold, separate from Save

**Decided**: The Surface row fires on `concrete_examples >= 1 && has_charged_language`, plus alliance clear from the monitor. `pattern_engaged` stays on the Save side only.

**Why**: `pattern_engaged` only becomes true *after* Jove names a pattern, so it cannot be the trigger for the naming move itself — that is circular. The Surface row *is* the naming move; it produces the evidence the user then engages with; that engagement is what `pattern_engaged` captures for the *next* turn's Save consideration. Separating "what triggers naming" from "what gates writing" breaks the circularity.

**Consequence**: Voice rule R-12 (sequence: evidence → pattern → image → hand back) becomes the Surface row's quality contract — load-bearing now, not one rule among 21. Future R-12 edits get evaluated against the selector, not against voice alone.

**Rejected**: splitting `pattern_engaged` in extraction into pre-naming and post-naming variants. Cleaner conceptually, but it changes the `ExtractionState` shape and the extraction prompt — more invasive. The chosen path breaks the circularity without touching extraction's schema.

### Decision 3 — Cross-context requirement for non-first checkpoints

**Decided**: Drop the hard `distinct_contexts >= 2` requirement from the non-first-checkpoint gate in `validateMaterialQuality`. Keep `distinct_contexts` as a *strengthening* signal — it already feeds `validateHeadline`'s "can"/"sometimes" hedging for single-example entries — not as a blocking gate.

**Why**: Decision 6 says cross-context repetition strengthens but is not required, especially first session. The code was stricter than the decision. A genuine recognition from a single vivid concrete scene in the user's own charged language is saveable; requiring two contexts blocks exactly the single-powerful-moment case the recognition mechanism exists for.

**Consequence**: More single-context Save events, each softened by the headline validator's hedging. Over-claim protection shifts from frequency-of-occurrence to fidelity-to-the-user's-words — Lock 1's verbatim check becomes the primary guardrail, with user confirmation as the backstop against over-crystallization.

**Rejected**: keeping the requirement and updating Decision 6's text to distinguish first-session (one context) from later (two contexts). The chosen path keeps the recognition mechanism's intent intact rather than carving an exception into it.

**Consequences (the through-line)**: All three decisions move the engine's safety basis from frequency/quantity checks toward fidelity/alliance checks. The engine saves when the pattern is in the user's own words (Lock 1), the user engaged with the naming (`pattern_engaged`), and the alliance is intact (monitor clear) — not when material has accumulated by count. With these three resolved, Lock 1's build prompt can be written. The selector itself (Decision 4 / Reflect-as-default, fourth in the master.md build order) is a separate, larger build; this ADR settles the questions that gate it and Lock 1 both. Cross-references in master.md section A ("Blockers on Lock 1") and §3 Selector point here.

**Implementation note (2026-05-27 — Lock 1 shipped)**: Lock 1 shipped as an INPUT gate, not the output check originally scoped (Decision 6 framed it as "a verbatim phrase from the language bank must appear in the saved entry, or the save fails"). Charged material — at least one high- or medium-charge phrase in the `language_bank`, linked to the candidate pattern's `strongest_layer` where one has resolved — must exist before a checkpoint fires. The check folds into the existing ripeness logic (`validateMaterialQuality` in `persona-pipeline.ts`), replacing the model-reported `has_charged_language` boolean with a deterministic read of the real bank; the field is kept (it is still read by `formatExtractionForPersona` and the Stage A narrative) but no longer gated on. The high|medium set aligns the gate with the composer and `formatExtractionForPersona`, correcting a prior high-only mismatch. The fail-open null/empty-state path in `validateMaterialQuality` was flipped to fail closed, so a missing extraction state or an empty/low-only bank now reads as not ripe rather than ripe. The build does **NOT** verify that the composed entry contains the phrase verbatim — output-fidelity is trusted to the composer prompt for now. The verbatim-in-saved-entry backstop is deferred; add it only if the composer is observed paraphrasing charged language away in beta. **So Lock 1 guarantees charged material EXISTS in the bank, not that it is USED in the saved entry.**

One dependency surfaced while writing the test pair: the linked reading filters bank phrases by their `layers[]` tag. A high/medium phrase with an empty or missing `layers` array is invisible to the linked filter — rejected when `strongest_layer` is non-null, accepted under the unlinked fallback (used when `strongest_layer` is null). In practice `LanguageEntry.layers` is a required `number[]` and extraction reliably emits layer tags, so this should not occur, but the linked guarantee depends on that reliability; the unlinked fallback is the looser safety net. Shipped on branch `jove-prompt-architecture-3.1`; `persona-pipeline.test.ts` carries the coverage (the charged-material-gate describe block plus the flipped null-state fail-closed proof).

**Implementation note (2026-05-28 — merged-gate principle extended to the upstream caller)**: The first implementation note (above, 2026-05-27) put Lock 1's charged-material check inside `validateMaterialQuality` — the gate that runs before a checkpoint *fires*. This note records extending the same principle to the *upstream* caller that decides whether to load the CHECKPOINTS instructions into the prompt: `deriveCheckpointApproaching`. That function had a signal-ready short-circuit (`if (signalReady) return true`) that returned **before** `validateMaterialQuality` ran, so every gate in that function — charged-material, crisis, depth, mechanism, all of it — was bypassed from the signal path. Two fixes, one root cause: (1) the **charged-material check** now applies to the short-circuit — a signal-ready layer returns true only when a high/medium phrase in the `language_bank` is tagged to that same layer; and (2) the **crisis guard** — the short-circuit also requires no active crisis. When either condition fails, the function falls through to `validateMaterialQuality`, which applies all gates uniformly.

The architectural principle this enforces: **signal-ready is a candidate, not a verdict.** Ripeness is never extraction's pattern signal alone — it requires charged material backing the signal-ready layer and the absence of a crisis. The merged-gate principle from this ADR applies at *every* threshold where ripeness is checked (instruction-loading as well as firing), not only at the firing gate.

Why this was a live bug, not a theoretical one: extraction is instructed to bootstrap any layer with a confirmed entry to "explored" minimum (`extraction.ts:353`), and `extraction_state` is conversation-scoped, so a returning user starts every new session with an empty `language_bank` but their confirmed-entry layers already at "explored." Under the old short-circuit, **every returning user's session opener hit the bypass** — loading checkpoint-seeking instructions (and, during a crisis, conflicting with the crisis protocol) before any charged material had surfaced in the session. The actual save was still blocked downstream by the firing gate, but the prompt was primed wrongly. Built on branch `jove-checkpoint-gate-upstream`; `persona-pipeline.test.ts` carries the regression guards in the `deriveCheckpointApproaching` describe block — the three "returns false …" tests at `:588` (signal-ready but uncharged), `:621` (charge on a different layer), and `:655` (signal-ready + charged + crisis), each paired with a one-variable contrast that flips the result back to true.


## ADR-045: Phase-0 Shadow Monitor Removed; Two-Layer-Engine Roadmap Paused as Candidate Overbuild

**Status**: Settled (2026-06-04) — implementation removed; roadmap decision deferred.

**Context**: The 2026-06-04 overbuilt-review panel found the Phase-0 shadow monitor (`monitor.ts`, the `monitor_reads` table) gated off in every environment, with nothing on the live call path reading its output back — "consumed by nothing" by its own admin copy — and mislabeled (wired to `claude-opus-4-7` while header/comments still said "Haiku"). It was Stage 1 of the proposed two-layer engine (the "two-watcher" architecture in `docs/architecture/master.md`; parent plan drafted in `docs/reference/two-layer-engine-adr-draft.md` as the reserved ADR-044). Its consumer — a **pre-prompt selector** reading the monitor's previous-turn alliance read (ADR-043 Decision 1) — was never built. A sensor shipped ahead of its actuator is the canonical overbuild pattern; this is the planning-layer version of it.

**Decision**: Remove the monitor implementation in full — `monitor.ts` + test, `scripts/replay-monitor.*`, the `/replay-monitor` skill, `fireBackgroundMonitor`, `MONITOR_MODEL`/`MONITOR_ENABLED`, all call sites, and the `monitor_reads` table (drop migration `20260604000000`). Do **not** decide the fate of the two-layer-engine roadmap now. The roadmap (reserved ADR-044 draft) and ADR-043 Decision 1 (the selector that reads the monitor) are **paused and flagged as candidate overbuild** — not being pursued, and not to be rebuilt by default. Founder's call (2026-06-04): *"I don't know — this is a risk of overbuilding."* The honest state is deferred, not killed.

**Re-entry condition (consumer-first)**: If alliance/withdrawal detection is wanted later, build (or specify) the consumer *before* any sensor, and prefer detecting the signal **inside the main Jove call** — which already reads the whole conversation under Opus — over a separate watcher + table + selector. Reinstating a parallel monitor must first clear the Complexity Gate (CLAUDE.md): name what consumes its output before writing it.

**Scope guard — what this does NOT touch**: ADR-043 Decisions 2 & 3 (Surface ripeness threshold; drop the hard `distinct_contexts >= 2` gate) shipped as live logic in `validateMaterialQuality` / `deriveCheckpointApproaching` and are independent of the monitor. They remain in force. Only ADR-043 Decision 1 (selector reading the monitor) is paused. The checkpoint quality gate, the suppression circuit-breaker, and Lock 1 are unaffected.

**Why deferred, not killed**: Per the Removal-first / Complexity Gate, an unproven plan whose first artifact was just deleted should be neither enshrined as "the plan" nor force-finished. Parking it with its cost named and a consumer-first re-entry condition is the correct state until a concrete need or evidence decides it. Supersedes the monitor-dependent portion of ADR-043 and pauses the ADR-044 draft.

## ADR-046: Desktop Shell — Same Four Views, New Chrome at >=1030px

**Date**: 2026-06-10. **Status**: Shipped (merge `5fc94ca`).

**Context**: Desktop rendered the mobile app inside a 430px phone-frame vitrine (ADR-012: "acceptable for now, pending redesign"). The founder commissioned a redesign; five rounds of HTML mockups (`mockups/desktop-*.html`) plus an applied-psychologist review and a desktop-pattern survey converged, and the founder chose option 5 ("the Rail"): a Claude-style collapsible sidebar whose collapsed rail keeps every destination visible (icons + count badges), a persistent room header carrying the wordmark and live session title, and the Manual REPLACING the conversation as a full center view — never side-by-side (the psychology review's strongest finding: an ambient, always-visible self-document during disclosure reads as surveillance for exactly this population).

**Decision**: New chrome, zero new machinery. `DesktopShell`/`DesktopSidebar`/`RoomHeader` render the SAME four `activeView` panels `MainApp` already builds for MobileLayout; the sidebar consumes SessionDrawer's existing prop contract rather than extracting a shared component (the drawer is a transient modal, the sidebar persistent furniture — same data seam, deliberately separate presentations, per senior-engineer review). The four mobile views gained `showTopBar?: boolean` (default true). Breakpoint is 1030px — aligned to the vitrine's existing wide-desktop boundary, not 1024 — via an SSR-safe matchMedia hook gated alongside `initialized` so no wrong-shell flash. Below 1030px and on onboarding/login the vitrine is untouched. The vitrine's dev-tools slot (unreachable once the authed app stops rendering the vitrine at >=1030px) was deleted with its CSS.

**Founder-ratified alongside**: the Dead Features amendment (rules.md) removing "Desktop layout" (referred to the pre-vitrine layout) and the stale "Theme toggle" entry; scope cuts — no "new since last view" Manual badge (no existing data source), full-window checkpoint dim kept, 431-1029px keeps the phone vitrine (a mid-width layout is a later call).

**Why not the alternatives**: side-by-side Manual pane (off-mechanism for disclosure — observer effect on a phantom-baseline population), full three-panel studio (attention competition; post-PMF shape), CSS-only both-shells-in-DOM (duplicate live effects/ids — rejected for a single rendered tree).

## ADR-047: Front-Door Redesign — Mobile-First Bottom Nav + Home Landing; Light-First Supersedes "Works in Both Themes"

**Date**: 2026-06-17. **Status**: Shipped (Phases 0–5, branch claude/angry-zhukovsky-fff218; merged via fast-forward push).

**Context**: The app dropped users straight into chat; the Manual structure and the ways to begin were buried behind a slide-out drawer. The founder commissioned a front-door redesign — many rounds of HTML mockups (`mockups/frontdoor-*.html`, `mockups/manual-*.html`; v6 is the source of truth) plus an evidence-graded first-run plan (`docs/first-run-plan.md`) and a senior-reviewed, file-level migration plan (`docs/redesign-migration-plan.md`). The redesign is **mobile-first**: ADR-046's desktop Rail is untouched and keeps its sidebar.

**Decision**: Six phases, each tsc-clean, senior-reviewed, build-verified by the pre-commit hook, merged as a unit.
- **Palette + type (light only):** warm-white ground, **brown = the user, navy = Jove**, Jove bubble top-rule removed (token → transparent); **Fraunces** display headings (opt-in `--font-display`), **Newsreader** body serif (`--font-serif` and the legacy `--font-spectral`), **Plus Jakarta Sans** UI, **JetBrains Mono** meta. Dark theme untouched. Text/meta ink kept at warm-graphite ≥6.5:1 (the prototype's lighter values failed AA).
- **Bottom nav replaces the drawer:** persistent **Home · Manual · Talk · You**; the slide-out drawer + its dead code (−572 lines: drawer, edge-swipe gesture, `onOpenDrawer` chain, TopBar menu glyph) retired. "You" = relabel of Settings. **Crisis moved into "You"** — the real safety net is Jove's in-conversation Crisis Protocol (rules.md §Crisis Protocol); the static link is the passive backstop. The **"≤1-tap Crisis" requirement that circulated through planning was unfounded** — no such rule is documented; 2-tap-under-You is fine.
- **Home is the landing for returning users** (greeting, resume hero, 5-layer Manual index with per-layer "go deeper", recent conversations). The auto-resume-into-chat behavior is **inverted**: returning users land on Home; first-run (`isNewUser`), pending-checkpoint, and opener-still-streaming users still drop into the conversation. Behind a one-line `LAND_ON_HOME` revert flag in `MainApp.tsx` (the riskiest change's rollback primitive).
- **Engine:** a `started_layer` `ExplorationContext` + opener branch so "go deeper" on a populated layer opens from the existing entries instead of claiming the layer is empty (the old `empty_layer` bug on populated layers).
- **Manual:** collapsible read view (collapsed by default, entry count + chevron) + provenance ("Added from a conversation · {month}"); per-entry "Explore further" removed (go-deeper is on Home); Edit preserved.
- **Chat:** a "GOING DEEPER · {layer}" context bar on scoped chats.

**What this supersedes**: the **"dark, default"** claim and the **"every new component must work in both themes"** clause (the old theme decision recorded in rules.md §Design System, the ADR-034-era two-themes rule). The code already defaulted to **light**; the front door is now explicitly **light-first** — new front-door surfaces are tuned for light, and **dark gets a later, dedicated pass**. rules.md §Design System theme line + Typography table updated to match.

**Why mobile-first / light-first**: the founder's locked call — retune the light theme (which already reaches almost everyone) now, leave dark for a later pass; ship the structural redesign on mobile and restructure desktop (ADR-046's Rail) separately. Fonts are not theme-scoped, so dark temporarily shows the new fonts on the old dark palette — an accepted, flagged consequence.

**Deferred (tracked, not killed)**: the first-run/activation redesign (seeded chips + focused input, `first-run-plan.md`); **Guided intake + Upload reachability for returning users** — a real feature-access regression introduced by the drawer retirement (the entry-cards screen is now new-user-only; task chip filed); the **desktop pass** (the 431–1029px phone-frame vitrine is awkward with the new bottom nav); and the first-person Manual masthead copy ("How I operate" vs the current "Your Manual.").

**Relationship to prior ADRs**: ADR-046 (desktop Rail) untouched — desktop keeps its sidebar this round. Supersedes ADR-031's "3 tabs" bottom-nav shape (now 4 tabs incl. Home). The Crisis-in-conversation safety floor (rules.md) is unchanged.

## ADR-048: Desktop Front-Door — Home + Manual in the New Design, Shared Not Forked

**Status**: Settled (Phases A–E shipped 2026-06-18)

**Context**: ADR-047 shipped the mobile front-door redesign and explicitly left the desktop pass deferred — desktop (≥1030px, the ADR-046 Rail) inherited only the new palette/fonts, none of the new *concepts*: no Home (a one-line `home → session` coercion in `MainApp` hid it), the mid-width phone-frame vitrine collides with the new bottom nav, and the sidebar's big "Your Manual" card overlapped the Home index. Plan + a single approved HTML mockup ("The Reading Room"): `docs/desktop-redesign-plan.md`, `mockups/desktop-frontdoor-v1.html`. The governing constraint from ADR-046 holds: the Manual's **entry prose** never sits beside an active chat (surveillance risk for this population). The 5-layer **index** (names/counts/"go deeper", no disclosed content) is navigation, the same category as the sidebar's existing count — so it may live on Home.

**Decision**: Express the new concepts natively on desktop by **sharing substance, not forking components** (the founder's mandate — "no duplicated components, properly refactored").
- **Shared core (Phase A):** `src/components/home/useHomeModel.ts` (the single source of truth for greeting / date / resume-thread selection / layers / started count) and `src/components/home/LayerIndex.tsx` (the 5-layer "go deeper" index; a `variant: "mobile" | "desktop"` controls density only, never structure). `MobileHome` was refactored onto both — verified byte-identical on mobile. Rejected one responsive component branching on width (the two Homes diverge in *composition*, not just size).
- **Desktop Home (Phase B):** a new thin layout shell `DesktopHome.tsx` — greeting (Fraunces), a slim resume ribbon, a 3-equal-card "ways to begin" triptych (Bring a situation / Guided / Upload), and `LayerIndex variant="desktop"`. **No recents list** — the sidebar owns session history (overlap removed). The `home → session` coercion is **dropped**; `DesktopShell` mounts a real `home` panel and `LAND_ON_HOME` now lands returning desktop users on Home (same first-run / pending-checkpoint / opener-streaming guards as mobile). The sidebar's oversized Manual card collapses to a quiet nav row with its count, joined by Home and Conversation rows + a Home rail button.
- **Manual (Phase C):** reused as-is at the 720px measure — **not forked**. The only desktop-specific change: the "share your manual" half-sheet becomes a **centered modal** on desktop, gated by an `isDesktop` prop that defaults to the mobile bottom sheet.
- **Guided + Upload:** the triptych *surfaces* the existing modes on Home (they were never broken — reachable from the new-session screen via `startConversation`). Not a rescue; trivial wiring.
- **Mid-width (Phase D):** at 431–1029px a signed-in user now sees the app as a **centered phone-width column** (~430px, calm `--session-linen` margins, a soft `--session-card-shadow` lift — no frame, no masthead/colophon paratext), replacing the phone-in-a-frame vitrine. Founder's pick over the alternatives (shrink the desktop shell to fit; keep-and-fix the frame). `DesktopVitrine` is retired from the authed path (`MobileLayout`) but **kept for `/login`**. The `DesktopShell` cutover stays at **1030px** (the centered column owns 431–1029) — the earlier "~860px breakpoint" idea was dropped because the founder chose the centered column for the whole band.
- **Scoped header (Phase E):** the "Going deeper · {layer}" context folds into `RoomHeader` on desktop; `MobileSession`'s in-body bar is gated on `showTopBar` so it shows once (in the header on desktop, in-body on mobile), never doubled.

**Consequences**: One data hook + one index component drive both platforms; the decision logic exists once (honors the duplication hard-block). Mobile is untouched (the four shared views still build once in `MainApp`; only `DesktopHome` is desktop-only). Desktop now has the greeting/resume/index moment natively. The 720px reading measure applies to Home too (consistent with the other views; the triptych fits). **Verification gap, named:** these surfaces have no component tests, and the live authed app couldn't be visually driven from the agent session (password-entry is barred by the agent safety rules) — Phases A–C shipped on tsc + the full suite + three senior-engineer reviews + the founder-approved mockup, with live screenshots deferred to a founder-assisted pass. **Phases D + E shipped 2026-06-18:** mid-width is now a centered phone-width column (vitrine retired from the authed path, kept for login; the `DesktopShell` cutover stays at 1030px — the "~860px breakpoint" idea was dropped once the founder chose the centered column), and the scoped "Going deeper · {layer}" context folds into `RoomHeader`. The verification gap above applies to D + E too: the ≤430px visual-equivalence and the mid-width look were reasoned from geometry and senior-reviewed, with live screenshots deferred to a founder pass.

**Relationship to prior ADRs**: Extends ADR-046 (the Rail evolves; the surveillance constraint is preserved — index yes, entry prose never beside a chat) and closes ADR-047's deferred "desktop pass" for Home + Manual. Reuses ADR-042's `startConversation` modes for the triptych. The mid-width vitrine retirement (ADR-012-era "acceptable for now") lands in Phase D.

## ADR-049: Retire the In-Session 3-Card Entry Screen — Home Is the Single Launchpad

**Status**: Settled (shipped 2026-06-18)

**Context**: The session view rendered a "What's on your mind today?" empty-state with three cards (Navigate a situation / Guided intake / Upload) whenever there was no active conversation. After the front-door redesign (ADR-047/048), the Home screen carries those same three "ways to begin" (mobile: a primary "Bring a situation" + Guided/Upload secondary links; desktop: the triptych). So the in-session cards were a duplicate launchpad — and a brand-new user finished the consent/intake screen and landed on them rather than on the new front door. The founder flagged it as superseded and asked for the cleanup. An audit confirmed it was reachable-but-superseded (not dead): all three modes are reachable from Home on both platforms, so nothing is lost by removing it once the two entry points are rerouted.

**Decision**: Remove the in-session 3-card entry screen entirely; **Home is the single launchpad.**
- The `entryCards` block, the `chipsVisible` flag, the welcome-greeting helpers, and the orphaned `EntryCard.tsx` are deleted from `MobileSession`. `MobileSession` no longer starts conversations (the `startConversation` / `firstName` / `confirmedEntries` props were dropped) — it is now only the active conversation.
- **A brand-new user lands on Home after intake** (the `firstRun`/`isNewUser` exception in `MainApp`'s landing effect is removed; the mid-checkpoint and opener-streaming guards stay). **This supersedes ADR-047's "first-run drops into a conversation" landing** — the cards were a menu, not a conversation, so they never satisfied that intent's spirit anyway.
- **"+ New session" lands on Home** (was: an empty session showing the cards).

**Consequences**: One launchpad (Home), no duplicate; `MobileSession` is leaner and single-purpose. The two source-string tests that pinned the modes to `MobileSession` were rewritten to assert them against `MobileHome`/`DesktopHome` — the guard moved with the code, not deleted. **The richer first-run experience first-run-plan.md describes (one warm Jove sentence + focused input + example chips) remains the deferred replacement** for the new-user landing — Home is the interim launchpad, not the final first-run answer. **Open follow-up (flagged, unmade):** the just-in-time "Nothing's saved unless you say so" control line lived on the retired cards (added 2026-06-17 from the applied-psychologist trust pass). A new user still sees that promise on the consent screen, but a returning user starting fresh from Home no longer sees it pre-disclosure — moving it onto Home is a pending decision. **Verification gap:** the authed app couldn't be driven from the agent session (password-entry barred); shipped on tsc + full suite + rewritten tests + senior review, with live click-through deferred to a founder pass.

**Relationship to prior ADRs**: Supersedes the "first-run drops into a conversation" landing in **ADR-047** (its returning-user Home landing is unchanged; now new users land there too). Builds on ADR-048 (Home as the front-door launchpad) and ADR-042 (`startConversation` modes).

## ADR-050: Structure Migration — Pattern-Type Layers → Life-Area Sections + Tags

**Status**: Settled (2026-06-24, live on prod)

**Context**: The Manual's five pattern-type layers (My Strengths / Some of My Patterns / How I Process Things / What Helps / How I Show Up with People) didn't fit the post-ND-pivot audience; entries were hard to navigate by life situation.

**Decision**: Replace the five pattern-type layers with five **life-area sections** (Relationships / Work and career / Routines and structure / Sensory and burnout / Interests and flow) + a **closed tag set** (`strength` on any section; `romantic`/`family`/`friends` only inside Relationships, DB-CHECK-enforced). Key sub-decisions worth recording as case law:
- **Additive / non-destructive (keystone).** Added `section`+`tags` columns; NEVER overwrite `layer`. `manual_entries.layer` is kept FROZEN forever as legacy provenance / audit oracle / rollback key (now nullable; new rows born with section + NULL layer). Decision: never drop it.
- **Code keeps `layer`/`LAYERS`; product says "section"** — a deliberate, documented naming divergence (avoids churn-rename of the identifier).
- **Closed tags** with a cross-column CHECK (relationship sub-tags require section='relationships').
- **Held group:** ~~self-to-self patterns that don't fit a life area are PARKED (section=NULL) and shown in a "held" group — the proto-face of a **deferred sixth "inner-world" section**.~~ **REVERSED by ADR-051 (2026-06-25): parking is killed; there is no held group and no deferred sixth section. Every entry homes on one of the five.**
- **Migrations:** 20260624000002 (columns+CHECKs), 20260624000003 (reviewed backfill: 17 homed / 4 parked), 20260624000004 (code cutover: layer nullable, confirm_checkpoint_write gains p_section/p_tags, extraction_state null-out).

**Consequences**: Supersedes ADR-015. Plan of record: docs/reference/structure-migration-plan.md. The held-group / deferred-sixth-section sub-decision was later reversed — see ADR-051.

## ADR-051: Kill Parking — Every Entry Homes on One of the Five Sections

**Status**: Settled (2026-06-25, code + migration shipped)

**Context**: ADR-050 parked self-to-self patterns (inner critic, self-verdict, self-permission) at `section = NULL` and gathered them into a "held group" — the proto-face of a deferred sixth "inner-world" section. The held group was given full *section* chrome (its own id, name, icon) and pushed into the same array every surface treats as "the five sections." An `isHeld` flag was meant to keep it apart, but only 1 of 5 renderers checked it — so it leaked as a visible **sixth category** into the Home "Your manual" index, the "N of 5 started" counter (could read "6 of 5"), the Manual page (a full tile titled "How you relate to yourself" — a copy stub never meant to ship), and the PDF export. Jeff flagged it ("why six?"). Parking was also *ongoing*, not a one-time backfill artifact: the composer actively parked new self-to-self patterns each turn.

**Decision**: Kill parking entirely; abandon the deferred sixth section. Three parts shipped together:
- **Composer always assigns one of the five** (`confirm-checkpoint.ts`): the "section: null to park" option is removed; an off-spec/missing section defaults to `relationships` (the catch-all, logged) rather than orphaning a confirmed entry.
- **Held-group concept deleted at the source** (`buildLayers` returns exactly five): removed `HELD_SECTION` / `HELD_GROUP_LABEL` / `HELD_GROUP_ABOUT` / `sectionForEntry` / the `isHeld` field and the now-dead branches in every consumer (Home index/counter/pips, mobile Manual, admin manual view, PDF, icons/headers). One source-level change fixes all surfaces — net **−45 LOC**.
- **The 4 existing parked rows refiled** via migration `20260625000001` so they don't orphan: *the caregiver trap* + *the permission loop* → **relationships** (romantic; both are partner-dynamic patterns that fail the survives-solitude test — arguably mis-parked originally); *The Room Inside You* → **work-money** (inner critic about capability); *Exposure Freeze with a Running Verdict* → **sensory-burnout** (a body freeze — "the body wins" spine rule). Destinations read from the entries' content, confirmed by Jeff. `layer` left frozen.

**Consequences**: Reverses the held-group / deferred-sixth-section sub-decision in ADR-050. The survives-solitude boundary rule (plan §2 Rule C) is no longer a pending build — there is no sixth-section path. The DB `section` column stays nullable (frozen legacy provenance only); the invariant "every entry homes on one of five" is enforced in code, not yet by a NOT NULL constraint (a deferred hardening option). If the inner-world territory ever proves real in beta, it starts fresh — not from these four rows.

## ADR-052: The Pull Model — Jove Talks, the User Saves

**Status**: Settled (2026-07-02 promoted; 2026-07-06 old world fully deleted)

**Context**: Under the push model, Jove decided when the user had built "enough" and proposed a Manual entry — a detector regex on every response, quality gates on extraction fields (layer signals, a five-field scorecard, pattern_engaged), suppression rules, split delivery, and a card pushed into the chat. It produced two persistent failure classes that tuning never fixed: entries saved too fast/thin (single scene, leading-yes — see the guided-intake over-deepening postmortem), and a voice that bent the conversation toward extraction ("building toward" a checkpoint instead of following the person). The machinery also accreted: three voice worlds (legacy three-tier, rebuilt, conductor experiment), gates on gates, and an extraction schema generating fields nothing read well.

**Decision**: Invert capture. Jove **never triggers saves** — its one signal is a hidden `---reflection-ready---` marker on the message where it judges the insight landed, which lights a reflection bar. The user pulls: tap → `/api/checkpoint/compose` (Opus drafts from the whole conversation, anchored to the user-approved working version) → editable overlay → confirm (plain DB write). Shipped as a sequence: conductor prompt promoted to the sole live voice for all users (2026-07-02); the entire Jove-pushed checkpoint machinery deleted (detector, gates, split delivery, Tier-3 checkpoint blocks — net −3,497 lines); extraction trimmed to the six fields the pull model reads (−397 lines); the rebuilt/legacy rollback voice worlds retired once they no longer restored a working capture path (−4,398 lines, byte-identical conductor output verified); the conductor prompt made **admin-editable as one document** (`conductor_prompt` override key, save-guarded so the crisis lines and the two hidden UI markers can't be edited away).

**Consequences**: The voice core is one self-contained document (`conductor-prompt.ts`), editable live at `/admin/prompt-architecture`; there is no voice switch (`LIVE_VOICE_VARIANT` deleted) and no rollback flip — reverting the pull model is a git revert plus rebuild, a deliberate one-way door. Extraction serves only the meter and the save-time composer, never Jove's reply. 1:1 text/SMS went dark behind `TEXT_MESSAGING_ENABLED` (the channel has no reflection bar) pending a text-capture rebuild. The mode feature gates survive only to hide home-screen doors. The four ND persona-delta files stay dormant (settled keep, not deleted). Watch-item carried from the checkpoint/voice decoupling review: under-firing — evaluate the *rate* of landed markers, not just entry quality.

## ADR-053: Modules — Founder-Authored Doors That ARE the Manual's Sections

**Status**: Settled (2026-07-15, shipped on branch claude/entry-points-abstraction-8b6ad7)

**Context**: The app had two fixed structures: three hardcoded entry doors (Situation / Guided intake / Upload — ADR-042's readiness-state on-ramps) and five fixed life-area Manual sections (ADR-050/051). The founder wanted to experiment with entry points without shipping code — create N doors in admin, each with its own name, copy, opener, and Jove prompt — and then unified further: each door should BE a Manual section, and the five fixed sections should go. This also settles the taxonomy re-scope question left pending by the 2026-06-15 Manual taxonomy review.

**Decision**: One founder-authored abstraction, the **module** (`modules` table, edited at `/admin/modules`). A module is simultaneously an entry door on Home and a section of the Manual:

1. **Doors are rows.** A module carries the Home card (name / description / cue / icon), an optional one-time intro modal, an optional fixed opener (server-emitted turn 1, no model call), an optional **full custom Jove prompt**, an enabled flag, and a sort order. Home renders enabled modules as the single "ways to begin" list — with per-module entry counts, replacing BOTH the door trio and the five-section "go deeper" index (guided intake and go-deeper are the same act now: entering a module). Modules are **disabled, never deleted** once referenced — a disabled module hides as a door but its Manual section and entries stay visible (the ADR-051 nothing-orphans lesson). Hard delete is allowed only while nothing references the slug.
2. **Voice ladder (amends ADR-052).** Per conversation: module `custom_prompt` → admin `conductor_prompt` override → code `CONDUCTOR_PROMPT`. The conductor is now the sole **default** voice: a module with a blank prompt runs the live shared conductor, and a custom prompt is a deliberate per-module fork. Every custom prompt is save-guarded by the SAME `CONDUCTOR_REQUIRED_FRAGMENTS` (crisis lines + reflection markers) as the conductor itself, and the admin editor offers "start from the current conductor" (drift warning: a fork does not inherit later Tuning edits).
3. **The Manual's structure IS the module set.** `conversations.mode` = the module slug (validated against enabled modules at creation; **no default mode** — the situation floor is gone; the CHECK enum was replaced by a slug-format constraint). An entry's `section` = its conversation's module slug, **code-assigned at compose time** — the composer no longer picks among five sections (that judgment is deleted, both composer and conductor paths). Manual page, Home counts, PDF export, and the admin manual view all group via one `buildModuleGroups(modules, entries)`.
4. **Fresh start (destructive, founder-approved).** Migration `20260715020000` deletes ALL existing manual_entries (including beta users') — everyone starts blank in the module world. The five-section CHECK constraints are dropped; tags trim to a closed `{strength}` set (the relationships-scoped sub-tags die with the fixed sections). The frozen legacy `layer` column stays untouched (ADR-050 keystone).
5. **The three old doors:** *Situation* is **shelved, not dead** — `situation-copy.ts` kept dormant (persona-deltas treatment) because "bring a situation" is a planned future product on top of the module structure (the open entrance whose whole point is you don't pre-categorize). *Guided intake* dissolves into module doors. *Upload* demotes to a capability: pasting works in ANY conversation (transcript detection + prompt-injection wrap fire everywhere), and the dual message cap collapses to one 16k cap.
6. **Deleted with the cutover:** the hardcoded door registries (WaysToBegin DOORS + door-intros), the three per-mode feature gates (+rows; a module's `enabled` flag is the only door switch — `extraction_brief` remains the sole gate), ~14 door copy/override keys (incl. both opener keys), the Intake Doors admin panel + route, the dead guided section-picker plumbing (`---sections---` / `---start-situation---` parsing, SectionPicker, the whole chip-response path), `upload-copy.ts`, and the five-section LayerIndex/LayerIcon. `/api/door-intros` survives as per-user seen-tracking only (intro copy rides the module rows).

**Consequences**: Creating a module in admin adds a door AND grows the Manual — one structure, no classifier mis-filing, per-module analytics for free (`mode` = slug on every event). Supersedes ADR-042 entirely and the section-taxonomy halves of ADR-050/051 (the additive/non-destructive keystone and frozen `layer` column survive); amends ADR-052 ("sole voice" → "sole default voice," same protected fragments). Named risks, accepted: users must pick a module before the conversation that would reveal what it's about (the shelved situation entrance is the counterweight, when it returns); a custom module prompt is a fork that drifts from Tuning edits (labeled in admin); watch per-module save RATE and thinness when experimenting (the guided-intake over-deepening lesson — leading doors produce fast, thin saves). Deletion condition: if experimentation closes and the module set stabilizes, fold the rows back into code constants and drop the table. Follow-up cuts flagged: `availableOptions` in `/api/dev-simulate/turn` is now unreachable; `dev-populate` fixtures still write the five legacy section slugs (invisible in the module Manual until matching modules exist).
