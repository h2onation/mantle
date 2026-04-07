# decisions.md — Why Things Are the Way They Are

> **Authority level**: Case law. Each entry is a settled question. Closed for debate unless explicitly reopened.  
> **Audience**: You (to remember why you made a choice) and Claude Code agents (to not re-litigate settled architecture).  
> **Format**: Each entry has Status, Context, Decision, and Consequences. If you want to revisit a decision, change its status to "Revisiting" and add a new entry with the updated reasoning.

---

## ADR-001: Parallel Extraction Over Sequential

**Status**: Settled  
**Context**: The extraction layer analyzes each user message to produce a research brief for Sage. Running extraction before Sage would add 2-5 seconds of latency per turn. Running it after would mean Sage never benefits from analysis.  
**Decision**: Run extraction and Sage simultaneously. Sage uses the previous turn's extraction state. Extraction saves its output for the next turn.  
**Consequences**: Zero added latency. One-turn lag on extraction context, which is negligible because the state is cumulative. First message has no extraction context at all (acceptable — same as the pre-extraction system). Adds complexity to the pipeline (two parallel calls, async state management) but the UX benefit is decisive.

## ADR-002: One-Turn Extraction Lag Is Acceptable

**Status**: Settled  
**Context**: Because extraction and Sage run in parallel, Sage always sees extraction state from the previous turn, not the current one.  
**Decision**: Accept the lag. Do not add sequential dependency.  
**Consequences**: Sage responds to what the user just said (it has the raw conversation history) but its strategic context (which layers to explore, whether a checkpoint is approaching) is one turn behind. Since extraction state is cumulative (turns 1-7 contain everything from turns 1-6 plus one new turn), the practical difference is negligible. The alternative — running extraction first — would double the time-to-first-token and make the product feel sluggish.

## ADR-003: Inline Composition Over Separate API Call

**Status**: Superseded — Path A (inline `|||MANUAL_ENTRY|||` composition) was eliminated. All checkpoints now route through the Haiku classifier + server-side `composeManualEntry()` Sonnet call. The original ADR is preserved below for history.
**Context**: When Sage delivers a checkpoint, a polished manual entry needs to be composed. Options: (A) Sage composes the entry inline as part of the same response, or (B) a separate Sonnet call composes it afterward.
**Decision**: Sage composes inline using |||MANUAL_ENTRY||| delimiter blocks (Path A). A separate Sonnet call exists as a fallback (Path B) for when Sage doesn't produce the block.
**Consequences**: Path A is cheaper (no additional API call), faster (no additional latency), and produces better entries (Sage has the full emotional context of the conversation moment). Path B exists because Sage doesn't always produce the block — sometimes the classifier catches a checkpoint that Sage didn't explicitly flag. Having both paths ensures `composed_content` is never null at confirmation time.

**Why superseded**: Inline composition leaked operational meta-commentary into Sage's user-facing voice (the prompt had to teach Sage to emit `|||MANUAL_ENTRY|||` blocks, which made the system prompt user-readable in a way that violated the "no operational meta" rule). Eliminating Path A let the Sage prompt stay in pure conversational voice, with composition handled entirely server-side after the classifier decides a checkpoint has landed. The single-path flow is slightly more expensive per checkpoint but produces a cleaner separation between conversation and composition.

## ADR-004: Single Pattern Tracking Over Multi-Pattern

**Status**: Settled  
**Context**: The extraction layer could track multiple emerging patterns simultaneously on a single layer. This would require the model to decide, per turn, whether new material is a new pattern or a variant of the current one.  
**Decision**: Track one emerging pattern at a time per layer. Historical material carries forward in the cumulative extraction state — nothing is discarded when a pattern is confirmed or rejected. The single tracking slot means one *active* focus, not a reset of context.  
**Consequences**: Simpler extraction (fewer judgment calls for a boolean classifier). When a second pattern surfaces, the material lives in the conversation transcript and Sage circles back to it after the current pattern resolves. Previously tracked material remains in the extraction state and can seed future patterns. The tradeoff: Sage must actively manage multiple threads, which it does well as a conversationalist but can't delegate to the extraction layer.

## ADR-005: Component-Before-Pattern Hierarchy

**Status**: Settled  
**Context**: Patterns are specific behavioral loops within a layer. Components are the integrated portrait of the layer. A pattern without a parent component is an orphan — "The Exit Impulse" only makes sense after the component establishes that autonomy is the core need.  
**Decision**: A layer's first checkpoint is always a component. Pattern checkpoints only fire on layers with a confirmed component. Material that looks like a pattern on a layer without a component feeds the component instead.  
**Consequences**: Enforced four ways (system prompt TYPE RULE → extraction `target_type` → hard guard in `call-sage.ts` → safety net in `confirmCheckpoint()`). Means the manual always builds frame-first, detail-second. Users never see an isolated pattern without context.

## ADR-006: Recurrence Is Sage's Judgment

**Status**: Settled  
**Context**: A pattern requires at least two distinct examples of the same behavioral loop. The extraction layer could try to count recurrence, but deciding whether a new story is "a distinct situation with the same trigger-response structure" or elaboration on the same story is genuinely hard.  
**Decision**: Recurrence confirmation is Sage's responsibility. The extraction layer tracks chain element booleans (has_trigger, has_response, etc). Sage, which has the full conversation and nuance, judges whether the loop has actually recurred.  
**Consequences**: Extraction stays simple and reliable (boolean classification). Sage probes for recurrence naturally before presenting a pattern checkpoint. If the user can't identify a second instance, Sage moves on without pressure.

## ADR-007: chain_elements Derived, Not Co-Authored

**Status**: Settled  
**Context**: Pattern manual entries have both a narrative (what the user reads) and structured chain_elements (what the system uses for matching and synthesis). If Sage writes both simultaneously, they can drift out of sync.  
**Decision**: The narrative is the source of truth. chain_elements are derived from the narrative via a lightweight extraction pass after each pattern write.  
**Consequences**: One source of truth, one derived index. Eliminates sync drift. The extraction pass runs once per pattern write (negligible cost). Sage doesn't have to worry about maintaining structural consistency — it writes good prose, and the system extracts the structured data.

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
**Decision**: Linen is the design system. Warm linen surface, Instrument Serif / DM Sans / JetBrains Mono typography, sage green and navy token system. The dark void palette is deprecated.  
**Consequences**: All new work uses linen tokens (`--session-linen`, `--session-ink`, etc). Dark void tokens remain in `globals.css` for backward compatibility during migration but should not be used in new components. The linen palette creates a warmer, more approachable feeling that matches the product's purpose — this isn't a developer tool, it's a place where people examine their own patterns.

## ADR-011: Haiku for Classification, Sonnet for Conversation

**Status**: Settled  
**Context**: The pipeline uses AI models at three points: extraction (analysis), Sage (conversation), and classifier (checkpoint detection).  
**Decision**: Sonnet for extraction and Sage (quality matters). Haiku for classifier and session summary (speed and cost matter, task is simpler).  
**Consequences**: ~2x Sonnet + 1x Haiku per turn. Roughly doubles Sonnet cost versus a single-call architecture, but the quality improvement is decisive. Classifier on Haiku is slightly more aggressive than ideal (may flag shorter reflections as checkpoints) — this is a known issue documented in state.md.

## ADR-012: Mobile-First

**Status**: Settled  
**Context**: The primary use case is someone in the middle of their life pulling out their phone to talk through what just happened.  
**Decision**: Mobile-first design. The primary interface is a mobile shell (430px max-width centered). The product will also be accessible via text messaging (MMS, scoped separately) and web.  
**Consequences**: Design for the mobile surface first. Other entry points (text, web) adapt to the same interaction model. Desktop users see the mobile shell centered, which is acceptable for now. The text entry point (MMS via Twilio) uses the same Sage pipeline with a `smsMode` flag that strips checkpoint formatting but preserves voice and depth. Can be revisited post-product-market-fit.

## ADR-013: Quality-Based Checkpoint Gate

**Status**: Settled  
**Context**: A checkpoint could fire based on turn count (e.g., every 8 turns) or based on material quality.  
**Decision**: Quality-based. The extraction layer evaluates whether enough grounded material exists: concrete examples, mechanism connecting behavior to something deeper, and charged language from the user.  
**Consequences**: A checkpoint can fire at turn 4 if the user gives rich material, or take 15 turns if they're guarded. No artificial pressure to "produce" a checkpoint on schedule. The first-checkpoint gate is intentionally lighter (1 example vs 2) because the teaching moment needs to land early while still being substantive.

## ADR-014: Advisor Collapsed Into Sage

**Status**: Settled  
**Context**: Early designs had "Advisor" as a separate mode or toggle — a distinct context for applying the manual to live situations.  
**Decision**: Advisor is not a separate feature. It's Sage doing what it already does, in the context of a live situation. Same engine, same legal framework, different entry context.  
**Consequences**: No mode switching. No separate UI. The post-checkpoint "work with it" fork is the natural entry point for advisory behavior. Sage surfaces the user's own confirmed patterns when relevant to a situation and asks what they want to do differently. This is simpler, more natural, and legally cleaner than a separate "advisor mode."

## ADR-015: Five-Layer Manual Structure

**Status**: Settled (may evolve)  
**Context**: The manual needed a structure that captures the full picture of how someone operates without becoming either too shallow (one-page summary) or too fragmented (dozens of unconnected observations).  
**Decision**: Five layers grounded in clinical frameworks — drives, self-perception, reaction system, operating style, relational patterns. Each with 1 component and up to 2 patterns.  
**Consequences**: 5 components (max) + 10 patterns (max) = 15 entries total. Dense enough to be useful, bounded enough to complete. The five layers map to real dimensions of human behavior: what you need, how you see yourself, how you cope, how you work, how you relate. Grounded in Schema Therapy (layers 1-2), behavioral analysis (layer 3), and Attachment Theory (layer 5), with layer 4 as the practical synthesis. This structure may evolve as the product matures and user feedback reveals whether five layers is the right granularity.

## ADR-016: User as Author

**Status**: Settled  
**Context**: Both a legal requirement and a product design principle. If Sage is the author of the manual, it's an AI-generated assessment. If the user is the author, it's a self-authored document created with AI assistance.  
**Decision**: The user is the author at every level. Sage proposes, user validates. Nothing writes without confirmation.  
**Consequences**: This principle governs everything: conversation design (Sage asks, doesn't tell), checkpoint flow (user confirms before writing), legal positioning (self-understanding, not assessment), marketing language ("build your manual" not "get your assessment"). Any feature where the answer to "who is doing the psychological work?" is Sage needs to be redesigned.

## ADR-017: Fire-and-Forget Extraction

**Status**: Settled  
**Context**: Extraction writes to `conversations.extraction_state` after each turn. The write could be awaited (guaranteeing state is saved before the next turn) or fire-and-forget (letting the write happen in the background).  
**Decision**: Fire-and-forget. `runExtraction()` is a background Promise, never awaited.  
**Consequences**: Sage's response is never delayed by extraction's write. In the rare case the write fails, the next turn's extraction starts from a slightly older state — acceptable because the state is cumulative. The alternative (awaiting the write) would add latency to every turn for a guarantee that's almost never needed.

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
**Context**: A single prompt doing extraction, strategy, and conversation simultaneously produces generic results. The model can't hold "track what the user said three turns ago," "decide what layer to explore," "generate a grounded question using the user's language," and "maintain Sage's voice" in working memory at once.  
**Decision**: Separate extraction (analysis), conversation (Sage), and classification (checkpoint detection) into three distinct stages with distinct models and distinct outputs.  
**Consequences**: Sage receives a curated research brief every turn instead of trying to do its own analysis. The brief changes; the prompt stays the same. That's the leverage. The extraction layer can be tuned independently of Sage's voice. The classifier can be cheap (Haiku) because its job is narrow. Tradeoff: three models per turn instead of one, higher cost, more pipeline complexity. But the quality improvement is not incremental — it's categorical.

## ADR-021: Cumulative Extraction Model

**Status**: Settled  
**Context**: Extraction could either analyze the full conversation fresh each turn or build on the previous turn's state cumulatively.  
**Decision**: Cumulative. Each extraction call receives the previous state and the last 6 messages (3 exchanges). Language bank entries accumulate. Layer signals only advance forward. The cumulative state carries all earlier analysis.  
**Consequences**: Cheaper per turn (extraction reads 6 messages, not the full history). Consistent signals (a layer that reached "explored" stays explored). Extraction state from turn 8 contains everything from turns 1-7. Tradeoff: a bad classification on turn 3 carries forward into every subsequent turn. If extraction misreads a phrase's emotional charge or advances a layer signal prematurely, that error compounds. Mitigation: the cumulative state is large enough that one bad turn gets diluted by subsequent correct turns. And Sage has the full conversation history as a check — it doesn't rely solely on the extraction brief.

## ADR-022: Instant Checkpoint Confirmation

**Status**: Settled  
**Context**: When a user confirms a checkpoint, the manual entry could be composed at that moment (with an API call) or read from pre-composed content stored at detection time.  
**Decision**: Pre-compose at detection time. On confirmation, read `composed_content` from `checkpoint_meta` and write directly to the database. No Anthropic API call. Instant.  
**Consequences**: Confirmation feels immediate. No spinner, no waiting. The user taps confirm and their manual updates. Tradeoff: the entry captures the conversation state at the moment Sage checkpointed, not at the moment the user confirmed. If several messages pass between checkpoint and confirmation, the entry won't reflect refinements from those messages. In practice this rarely matters because users typically confirm or reject within 1-2 messages of the checkpoint. The fallback path (raw message content) handles edge cases.

## ADR-023: Sliding Window (First 2 + Last 48)

**Status**: Settled  
**Context**: Long conversations exceed the model's context budget. A windowing strategy is needed to keep conversation history within token limits while preserving the most useful context.  
**Decision**: When history exceeds 50 messages, include the first 2 messages and the last 48. Implemented in `call-sage.ts`.
**Consequences**: The first 2 messages preserve the session's opening context (what the user came in with, Sage's initial framing). The last 48 preserve recent conversational flow. The gap in the middle is acceptable because extraction state carries cumulative analysis of the dropped messages. Simpler than embedding-based retrieval, which would add latency and complexity for a marginal improvement at current conversation lengths. Revisit if users regularly exceed 100+ messages per session.

## ADR-024: Shared Pipeline Over Parallel Implementations

**Status**: Settled
**Context**: The text (Linq) and web paths through Sage duplicated ~280 lines of identical logic — DB reads, user state derivation, extraction firing, crisis detection, checkpoint gates, model constants. The text path was missing checkpoint layer guards and turn-count suppression, causing drift in checkpoint behavior.
**Decision**: Extract shared logic into `sage-pipeline.ts`. Both `call-sage.ts` (web) and `sage-bridge.ts` (text) import from the same module. Web-specific logic (streaming, classifier + `composeManualEntry()` invocation, SSE events, URL/transcript detection) stays in call-sage. Text-specific logic (non-streaming fetch, checkpoint text formatting) stays in sage-bridge.
**Consequences**: Seven shared functions replace 13 duplication points. Rule changes (new gate, model upgrade, crisis phrase) happen in one place. Text path now enforces the same checkpoint rules as web. Tradeoff: an additional import layer adds one level of indirection. But the alternative — maintaining two copies of identical rules — already caused a real bug (missing layer guards in text). The indirection cost is trivial compared to the drift risk.

## ADR-025: Text Checkpoint Shows Name Only

**Status**: Settled
**Context**: When Sage detects a checkpoint via text, the original implementation sent a follow-up message containing the full `manualEntry.content` (150-250 words) plus the name and confirmation prompt. But Sage's conversational response already presented the insight in natural language — the user was reading the same content twice in different formats.
**Decision**: The checkpoint follow-up text shows only the proposed name and the confirmation question ("Does this feel right?" / "Does this resonate?"), not the full composed content. The user already read the insight in Sage's response.
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
**Decision**: Single source of truth at `src/lib/manual/layers.ts`. Exports `LAYERS` (full definitions including names, descriptions, dimensions, examples), `LAYER_NAMES` (id → name lookup), `LAYER_COUNT`, and `getLayer(id)`. Every consumer (extraction prompt builder, system prompt, classifier, confirm-checkpoint, mobile UI) imports from this file. Prompts interpolate the canonical block instead of hardcoding strings.
**Consequences**: Renaming a layer is a one-line change in `layers.ts`. Drift between UI and Sage code is structurally impossible — they both read the same constant. Tests assert against `LAYER_NAMES[N]` rather than literal strings, so a future rename never silently breaks assertions. Cost: one new file, minor refactor of five existing files. Offset: every future layer change touches one file instead of twelve.

## ADR-030: ND Pivot — sage_mode Column With Single Value, Forward-Compatible Seam

**Status**: Settled (2026-04-06)
**Context**: PR1 ships ND-only voice. The plan needs to support adding additional voice modes (general, ADHD-specific, etc.) later without re-plumbing the call chain. Options: (a) hardcode autism voice in the prompt and add the seam later; (b) add the seam now even though there's only one value; (c) build a full mode registry with branching now.
**Decision**: Option (b). Add `sage_mode text` column to `profiles` (nullable, check constraint allows only `'autistic'` for now). Migration lives at `supabase/add-sage-mode.sql` per the existing convention. Thread `sageMode` through `ConversationContext` → `BuildPromptOptions` → `buildSystemPrompt`, defaulting null to `'autistic'`. Voice content remains hardcoded autism-only in PR2a/PR2b. The seam exists but does not branch yet.
**Consequences**: Adding a second voice mode in the future is a content change, not a plumbing change — extend the check constraint, add a branch in `buildSystemPrompt`, done. The single-value plumbing is a small amount of "future-facing" code, but it lives behind type-safe interfaces (`SageMode = 'autistic'`) so a second mode added later gets caught by the compiler at every consumer site.
