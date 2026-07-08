// ---------------------------------------------------------------------------
// Shared persona pipeline logic — single source of truth for rules used by
// both the web (call-persona.ts) and text (persona-bridge.ts) paths.
// ---------------------------------------------------------------------------

import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runExtraction,
  type ExtractionState,
} from "@/lib/persona/extraction";
import {
  mapSystemMessages,
  applySlidingWindow,
  detectCrisisInUserMessage,
} from "@/lib/persona/call-persona";
import type { PersonaMode, OneOnOnePromptOptions } from "@/lib/persona/system-prompt";
import type { ManualEntryForContext } from "@/lib/persona/manual-context";

// ── Constants ────────────────────────────────────────────────────────────────

import { PERSONA_MODEL, PERSONA_MAX_TOKENS, CHECKPOINT_ACTIONS, type CheckpointAction } from "./config";
import { getFeatureGates } from "./feature-gates";
import { getVoiceOverrides, type VoiceOverrides } from "./voice-overrides";
export { PERSONA_MODEL, PERSONA_MAX_TOKENS, CHECKPOINT_ACTIONS, type CheckpointAction };

const CRISIS_RESOURCES =
  "\n\nIf you're in crisis or need immediate support, please reach out to the 988 Suicide & Crisis Lifeline — call or text 988. You can also text HOME to 741741 to reach the Crisis Text Line. Both are free, confidential, and available now.";

// ── Types ────────────────────────────────────────────────────────────────────

type ManualEntry = ManualEntryForContext;

export interface ConversationContext {
  messages: { role: "user" | "assistant"; content: string }[];
  manualComponents: ManualEntry[];
  previousExtraction: ExtractionState | null;
  sessionSummary: string | null;
  isReturningUser: boolean;
  isFirstCheckpoint: boolean;
  sessionCount: number;
  turnsSinceCheckpoint: number;
  conversationId: string;
  turnCount: number;
  personaModes: PersonaMode[];
  mode: "situation" | "guided-intake" | "upload";
  /** True when the web reflection meter is active — the user-pulled capture
   *  model. Web-only (surface === "web"); text/SMS has no meter and no capture
   *  path. Read by call-persona.ts to surface the depth + readiness signals to
   *  the client and by the compose/meter routes. */
  reflectionMeterEnabled: boolean;
  /** False when the `extraction_brief` feature gate is OFF. Read by
   *  call-persona.ts to skip the background extraction call. Extraction still
   *  feeds the save-time composer + safety detectors off the state object; the
   *  per-turn brief it used to narrate was retired 2026-07-02. When false, no
   *  extraction runs — voice-only. */
  extractionEnabled: boolean;
  /** Admin-editable voice-text overrides (persona_voice_overrides table),
   *  resolved once per turn alongside the feature gates. Empty {} when no
   *  enabled override exists, in which case every field falls back to its
   *  code constant at the resolution site. */
  voiceOverrides: VoiceOverrides;
  /** Fingerprint of the conductor prompt this conversation was stamped with, or
   *  null until the first Jove turn records it. Read by call-persona to decide
   *  whether it still needs to stamp (see stampConductorPrompt). Purely
   *  observational — feeds the Tuning score-vs-prompt trend, never Jove. */
  conductorPromptSha: string | null;
  /** True when Jove has published the landed signal (the ---reflection-ready---
   *  marker, tagged onto the message row as metadata.reflection_landed) since
   *  the last checkpoint. Conductor-only readiness source: Jove's own landed
   *  judgment, made in-conversation with full context, replaces every
   *  extraction-side proxy (depth thresholds, pattern_engaged) that fired the
   *  strip early — the 2026-07-02 Guerneville run. Resets automatically on
   *  save: a new checkpoint row postdates the marker message. */
  reflectionLanded: boolean;
}

export interface CheckpointMeta {
  // Section slug chosen by composition — one of the five life-area sections.
  // Replaces the legacy `layer` number as the structural key. Nullable only to
  // tolerate in-flight checkpoint_meta written before parking was removed.
  section: string | null;
  // Closed tag set applied by composition.
  tags: string[];
  name: string | null;
  status: "pending";
  composed_content: string | null;
  composed_name: string | null;
  changelog: string | null;
  composed_summary: string | null;
  composed_key_words: string[] | null;
  // Number of "Close but not quite" refinements that produced THIS
  // entry. Inherited from the previous checkpoint when that previous
  // checkpoint's status was "refined" (chain unbroken). Reset to 0
  // when the previous checkpoint was confirmed/rejected.
  // The card UI shows the refinement-ceiling state when this value
  // is >= 2 (i.e. the user has already refined twice and is now
  // looking at the third attempt). Track A Phase 7-Mid.
  refinement_count: number;
}

// ── 1. Load conversation context ────────────────────────────────────────────

/**
 * Parallel DB reads + derived user state — shared by web and text paths.
 * Returns everything both paths need to build a system prompt and apply rules.
 */
export async function loadConversationContext(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  userId: string,
  // The reflection meter is a web-app affordance (the fill bar + pull strip
  // render only in the mobile/desktop client). Text/SMS has no meter and no
  // pull path, so the meter must NOT govern that channel — it has no capture
  // path until a future text rebuild. Callers that run over text pass "text";
  // everyone else (web chat, the compose/meter routes) takes the default.
  surface: "web" | "text" = "web"
): Promise<ConversationContext> {
  const [
    historyResult,
    manualResult,
    extractionResult,
    lastCheckpointResult,
    profileResult,
    gates,
    voiceOverrides,
  ] = await Promise.all([
    admin
      .from("messages")
      .select("role, content, created_at, metadata")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    admin
      .from("manual_entries")
      .select("layer, section, tags, name, content, summary, key_words, created_at, source_message_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    admin
      .from("conversations")
      .select("extraction_state, summary, mode, conductor_prompt_sha")
      .eq("id", conversationId)
      .single(),
    admin
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .eq("is_checkpoint", true)
      // Only a CONFIRMED checkpoint resets the reflection meter. Pulling an
      // entry plants an is_checkpoint row immediately (compose route), but a
      // pull the user then discards or reworks ("rejected"/"refined") — or one
      // still "pending" in the overlay — never became a Manual entry. Counting
      // it here would reset turnsSinceCheckpoint AND move the reflectionLanded
      // scope past the landed marker, wiping the user's progress for a save
      // that never happened. Confirmed saves flip checkpoint_meta.status →
      // "confirmed" (confirm_checkpoint RPC), so gate on that.
      .eq("checkpoint_meta->>status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("persona_modes")
      .eq("id", userId)
      .maybeSingle(),
    // Global feature gates — folded into this existing parallel batch so
    // the per-turn read adds no extra round-trip. Fails open to all-ON.
    getFeatureGates(admin),
    // Admin-editable voice-text overrides — same batch, same fail-open
    // discipline (fails open to {} = all code defaults).
    getVoiceOverrides(admin),
  ]);

  // Fallback flipped from ["autistic"] to ["general"] on 2026-05-19 to
  // match the new column default (migration 20260519100000). Hit when the
  // profiles row has a null persona_modes — pre-onboarding signups, legacy
  // rows that pre-date the array migration, or any path that creates a
  // profile without setting persona_modes (e.g., the chat-route upsert).
  // NOTE (audited 2026-07-07): there are currently NO downstream consumers of
  // personaModes — buildSystemPromptBlocks never reads it and extraction
  // doesn't consume it — so this value is inert. The plumbing (this read, the
  // profile column, the settings picker) is kept per the settled ND-personas
  // decision; delete only with a founder call. (The persona_deltas debug gate
  // that used to clamp this was removed 2026-07-08 — a dead switch.)
  const personaModes: PersonaMode[] =
    (profileResult.data?.persona_modes as PersonaMode[] | null) ?? ["general"];

  const rawMode = extractionResult.data?.mode;
  if (rawMode && rawMode !== "situation" && rawMode !== "guided-intake" && rawMode !== "upload") {
    console.warn("[persona-pipeline] unexpected conversation mode: %s, falling back to situation", rawMode);
  }
  // The requested mode is honored directly (the conductor has been the live
  // voice for all users since 2026-07-02, and it always honored the request).
  // The per-mode feature gates still do their real job elsewhere: they hide
  // entry doors on the home screen via /api/onboarding-status.
  const conversationMode = resolveConversationMode(rawMode);

  // Build conversation history
  let messages = applySlidingWindow(
    mapSystemMessages(historyResult.data || [])
  );
  if (messages.length === 0) {
    messages = [{ role: "user", content: "[Session started]" }];
  }

  // Raw entries from manual_entries. We map source_message_id → conversation_id
  // below so prepareManualContext can split "current session" from "older"
  // without another round-trip.
  const rawEntries = (manualResult.data || []) as Array<{
    layer: number | null;
    section: string | null;
    tags: string[] | null;
    name: string | null;
    content: string;
    summary: string | null;
    key_words: string[] | null;
    created_at: string | null;
    source_message_id: string | null;
  }>;

  const sourceMessageIds = rawEntries
    .map((e) => e.source_message_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const sourceMsgToConv = new Map<string, string>();
  if (sourceMessageIds.length > 0) {
    const { data: srcMsgs } = await admin
      .from("messages")
      .select("id, conversation_id")
      .in("id", sourceMessageIds);
    if (srcMsgs) {
      for (const m of srcMsgs as Array<{ id: string; conversation_id: string }>) {
        sourceMsgToConv.set(m.id, m.conversation_id);
      }
    }
  }

  const manualComponents: ManualEntry[] = rawEntries.map((e) => ({
    layer: e.layer,
    section: e.section,
    tags: e.tags,
    name: e.name,
    content: e.content,
    summary: e.summary,
    key_words: e.key_words,
    created_at: e.created_at || undefined,
    source_conversation_id: e.source_message_id
      ? sourceMsgToConv.get(e.source_message_id) || null
      : null,
  }));
  // extraction_brief gate OFF → the pipeline sees NO analysis state at all.
  // We null the stored extraction_state at the source, so every downstream
  // reader — the save-time composer, the admin extraction_snapshot, the safety
  // detectors, and the reflection meter — sees null and behaves as if nothing
  // has been analyzed. The DB row is untouched, so flipping the gate back ON
  // restores the real state on the next turn.
  const previousExtraction: ExtractionState | null = gates.extractionBrief
    ? (extractionResult.data?.extraction_state ?? null)
    : null;
  const sessionSummary: string | null =
    extractionResult.data?.summary ?? null;

  // Turns since last checkpoint
  let turnsSinceCheckpoint = Infinity;
  if (lastCheckpointResult.data) {
    const cpTime = lastCheckpointResult.data.created_at;
    const userMsgsSince = (historyResult.data || []).filter(
      (m: { role: string; created_at?: string }) =>
        m.role === "user" && m.created_at && m.created_at > cpTime
    ).length;
    turnsSinceCheckpoint = userMsgsSince;
  }

  // Jove's landed signal since the last CONFIRMED checkpoint (conductor
  // readiness — lastCheckpointResult is already filtered to confirmed saves).
  // Same metadata-tag pattern as checkpoint_suppressed above: call-persona
  // tags the row when it strips the ---reflection-ready--- marker. Scoped to
  // after the last confirmed checkpoint so a real save resets readiness — but
  // a discarded/reworked pull does not — with no extra state.
  const cpTime = lastCheckpointResult.data?.created_at ?? null;
  const reflectionLanded = (historyResult.data || []).some(
    (m: {
      role: string;
      created_at?: string;
      metadata?: { reflection_landed?: boolean } | null;
    }) =>
      m.role === "assistant" &&
      Boolean(m.metadata?.reflection_landed) &&
      (!cpTime || (m.created_at ?? "") > cpTime)
  );

  // User state
  const isReturningUser = manualComponents.length > 0;
  const isFirstCheckpoint = !isReturningUser;
  let sessionCount = 1;
  if (isReturningUser) {
    const { count } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("linq_group_chat_id", null);
    sessionCount = count || 1;
  }

  const turnCount = messages.length;

  // Capture model. The conductor (the live voice) is a pure PULL model: the
  // meter is the capture surface on WEB (text/SMS has no meter UI, so it has no
  // capture until the text rebuild). Jove never proposes — the Jove-pushed
  // checkpoint path was removed 2026-07-03 (Wave 3 ship 2).
  const reflectionMeterEnabled = surface === "web";

  return {
    messages,
    manualComponents,
    previousExtraction,
    sessionSummary,
    isReturningUser,
    isFirstCheckpoint,
    sessionCount,
    turnsSinceCheckpoint,
    conversationId,
    turnCount,
    personaModes,
    mode: conversationMode,
    reflectionMeterEnabled,
    extractionEnabled: gates.extractionBrief,
    voiceOverrides,
    conductorPromptSha: extractionResult.data?.conductor_prompt_sha ?? null,
    reflectionLanded,
  };
}

// ── Conductor-prompt fingerprint (Tuning: score-vs-prompt trend) ────────────
//
// Records which conductor prompt a conversation ran on, so scored sessions can
// be banded by prompt version and any past prompt recovered for revert. See
// migration 20260708130000. Edge-safe (Web Crypto, not node:crypto — this runs
// in the edge chat path); the scoring side's rubricSha is node-only and must
// not be imported here. The two never need to agree byte-for-byte — this sha is
// produced on the edge and only ever read back by the admin surface.

/** 12-hex-char SHA-256 prefix of the conductor prompt text. Matches the WIDTH
 *  of rubricSha so the two read alike in the Tuning UI, via a separate
 *  edge-safe implementation (Web Crypto). */
async function conductorPromptSha(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 6; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

/** Stamp the conductor prompt onto a conversation, once, on its first turn.
 *  Fire-and-forget from call-persona: upsert the prompt text (dedup by sha,
 *  on-conflict-do-nothing) and set conversations.conductor_prompt_sha only
 *  while it is still null — so a mid-conversation prompt edit keeps the prompt
 *  the session STARTED on, and a later turn self-heals a first-turn write that
 *  got cut off. Never throws into the caller. */
export async function stampConductorPrompt(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  conductorPromptText: string
): Promise<void> {
  try {
    const sha = await conductorPromptSha(conductorPromptText);
    await admin
      .from("prompt_snapshots")
      .upsert({ sha, text: conductorPromptText }, { onConflict: "sha", ignoreDuplicates: true });
    await admin
      .from("conversations")
      .update({ conductor_prompt_sha: sha })
      .eq("id", conversationId)
      .is("conductor_prompt_sha", null);
  } catch (err) {
    // Observational only — never disrupt the turn. Event + id, no content.
    console.error(
      "[persona-pipeline] stamp_conductor_prompt failed for conversation=%s: %s",
      conversationId,
      err instanceof Error ? err.message : "unknown"
    );
  }
}

// ── Conversation-mode resolution ───────────────────────────────────────────
//
// The single authority for turning a stored/requested mode string into
// the mode a turn actually runs in. Used by the main pipeline (above) and
// unit-tested directly. Rules:
//   - Use the requested mode if its gate is on.
//   - Otherwise fall to the first enabled mode, priority situation → guided →
//     upload (so disabling an optional mode keeps the old "fall to situation"
//     behavior while situation is on, and a guided-/upload-solo config falls to
//     whatever IS enabled).
//   - If every mode gate is off (misconfiguration), situation is the ultimate
//     hard floor, so a conversation is never left mode-less.
export function resolveConversationMode(
  rawMode: string | null | undefined
): "situation" | "guided-intake" | "upload" {
  // Parse-only: the stored mode is honored directly, unknown values fall back
  // to situation. The per-mode-gate fallback that used to live here was dead
  // since the 2026-07-02 conductor promotion (the conductor always honored the
  // request) and was removed 2026-07-06. The mode gates' live job is hiding
  // entry doors on the home screen (/api/onboarding-status), not clamping the
  // server-side mode.
  return rawMode === "guided-intake"
    ? "guided-intake"
    : rawMode === "upload"
      ? "upload"
      : "situation";
}

// ── 1b. Build prompt options from context ──────────────────────────────────
//
// Single source of truth for the context → BuildPromptOptions mapping.
// Both web (call-persona.ts) and text (persona-bridge.ts) call this, then web
// layers on its channel-specific fields (explorationContext, transcriptContext).
// Adding a new field to BuildPromptOptions? Add it here once.

export function buildPromptOptionsFromContext(
  ctx: ConversationContext
): OneOnOnePromptOptions {
  return {
    kind: "oneOnOne",
    manualComponents: ctx.manualComponents,
    currentConversationId: ctx.conversationId,
    isReturningUser: ctx.isReturningUser,
    sessionSummary: ctx.sessionSummary,
    isFirstCheckpoint: ctx.isFirstCheckpoint,
    sessionCount: ctx.sessionCount,
    turnCount: ctx.turnCount,
    personaModes: ctx.personaModes,
    mode: ctx.mode,
    // Admin-editable voice-text overrides; empty {} falls back to all code
    // defaults at each resolution site in system-prompt.ts.
    voiceOverrides: ctx.voiceOverrides,
    // (First-entry orientation is no longer a prompt flag — the server appends
    // it deterministically at the landing turn; see call-persona.ts. v0.8.3.)
  };
}

// ── 2. Background extraction ────────────────────────────────────────────────

/**
 * Classify an extraction error into a short bucket so log queries can group
 * failures by cause (abort, response_shape, parse, http, other) instead of
 * grepping free-form error messages. Kept deliberately simple — extend only
 * when a new failure mode proves distinct enough to act on.
 */
function classifyExtractionError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") return "abort";
    const msg = err.message || "";
    if (msg.includes("unexpected response shape")) return "response_shape";
    if (msg.startsWith("Anthropic API ")) return "http";
    if (err.name === "SyntaxError") return "parse";
  }
  return "other";
}

/**
 * Fire extraction in background — runs in parallel, doesn't block response.
 *
 * Wrapped in `waitUntil` from @vercel/functions so the Vercel platform keeps
 * the function alive until extraction settles. Without waitUntil, when the
 * parent request's response closes before extraction finishes, Vercel
 * terminates the in-flight fetch to Anthropic and it throws DOMException
 * [AbortError]. Next.js 14 Route Handlers do not expose a native waitUntil
 * (Next 15's `after()` does); @vercel/functions is the canonical shim and
 * works on both edge (/api/chat) and nodejs (SMS webhooks) runtimes.
 * Off-Vercel (local dev, tests) it degrades to a plain promise, no-op.
 *
 * Emits two structured log lines per call for observability:
 *   [persona-pipeline] extraction_attempt { conversation_id, ... }
 *   [persona-pipeline] extraction_failed  { conversation_id, error_class, ... }
 * The attempt line is the denominator for failure-rate queries. error_class
 * buckets failures into the categories we already know about (abort,
 * response_shape, parse, http, other).
 *
 * On failure, the prior `conversations.extraction_state` is preserved — the
 * DB write only happens inside the .then when extraction succeeded.
 */
export function fireBackgroundExtraction(
  ctx: ConversationContext,
  admin: ReturnType<typeof createAdminClient>
): void {
  console.log("[persona-pipeline] extraction_attempt", {
    conversation_id: ctx.conversationId,
    message_count: ctx.messages.length,
    is_first_checkpoint: ctx.isFirstCheckpoint,
  });

  const promise = runExtraction(
    ctx.messages,
    ctx.previousExtraction,
    ctx.manualComponents,
    ctx.isFirstCheckpoint
  )
    .then(async (newState) => {
      const { error } = await admin
        .from("conversations")
        .update({ extraction_state: newState })
        .eq("id", ctx.conversationId);

      if (error)
        console.error("[persona-pipeline] Failed to save extraction state:", error);
    })
    .catch((err) => {
      console.error("[persona-pipeline] extraction_failed", {
        conversation_id: ctx.conversationId,
        error_class: classifyExtractionError(err),
        error_message: err instanceof Error ? err.message : String(err),
        error_name: err instanceof Error ? err.name : null,
      });
    });

  waitUntil(promise);
}

// ── 3. Crisis detection ─────────────────────────────────────────────────────

/**
 * Detect crisis language, append 988 resources if needed, log safety event.
 * Returns the (potentially modified) response text and whether crisis was detected.
 */
export function handleCrisisDetection(
  userMessage: string,
  responseText: string,
  conversationId: string,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
): { responseText: string; crisisDetected: boolean } {
  if (!detectCrisisInUserMessage(userMessage)) {
    return { responseText, crisisDetected: false };
  }

  const personaIncluded988 = responseText.includes("988");
  if (!personaIncluded988) {
    responseText += CRISIS_RESOURCES;
  }

  console.log("[persona-pipeline] CRISIS DETECTED", {
    timestamp: new Date().toISOString(),
    conversation_id: conversationId,
    user_id: userId,
    crisis_detected: true,
    persona_included_988: personaIncluded988,
  });

  admin
    .from("safety_events")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      crisis_detected: true,
      persona_included_988: personaIncluded988,
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error)
        console.error("[persona-pipeline] Failed to log safety event:", error);
    });

  return { responseText, crisisDetected: true };
}


// ── 4d. Conversational response structure validator ────────────────────────
//
// Soft post-generation validator for Jove's conversational turns. Runs on
// every response. Logs violations but does NOT block delivery — we want
// beta data on how often the model drifts from the rules, not interrupted
// conversations. Promote to a blocking/rewrite step only after the log
// volume justifies it.

/**
 * Two checks that mirror the violations the quality-framework eval keeps
 * catching:
 *   - question_count: Tier 1 rule 4 (handoff rule — every turn ends with a
 *     handoff, question OR directive that hands the user a next move).
 *     Count `?` in the response. 0 or 1 is fine; 2+ is a violation (pick
 *     one question, even when both are clarifiers). 0 question marks is
 *     allowed when the handoff is an imperative ("walk me through what
 *     happened"); the post-confirmation continuation-offer also has 0.
 *   - dash_usage: Tier 2 VOICE rule ("no dashes or hyphens joining clauses")
 *     — count em dashes and spaced en-dash/hyphen sequences.
 *
 * Logs as structured console.warn so log aggregators can slice on
 * `check` and `count`.
 */
export function validateResponseStructure(
  content: string,
  messageId: string | null
): void {
  const questionMarks = (content.match(/\?/g) || []).length;
  const emDashes = (content.match(/—/g) || []).length;
  const spacedDashes = (content.match(/ – | - /g) || []).length;

  if (questionMarks > 1) {
    console.warn("[persona-pipeline] response_validation", {
      type: "response_validation",
      check: "question_count",
      count: questionMarks,
      message_id: messageId,
    });
  }

  const dashCount = emDashes + spacedDashes;
  if (dashCount > 0) {
    console.warn("[persona-pipeline] response_validation", {
      type: "response_validation",
      check: "dash_usage",
      count: dashCount,
      message_id: messageId,
    });
  }
}

// ── 4b. Checkpoint action system message ────────────────────────────────────

/**
 * Insert the canonical system message for a checkpoint action.
 * Used by: confirmCheckpoint (confirmed), checkpoint/confirm/route (rejected/refined),
 * and message-router (text path rejected/refined).
 */
export async function insertCheckpointActionMessage(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  action: CheckpointAction
): Promise<void> {
  await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "system",
    content: CHECKPOINT_ACTIONS[action].systemMessage,
  });
}

/**
 * Builds the entries-summary sentence for the subsequent-single
 * post-confirm message (Track A Phase 7-High). Templated server-side
 * so the LLM reproduces a verbatim string rather than reconstructing
 * pluralization and layer joining.
 *
 * Shape: "<N> entries. <X>[ and <Y>] have material. <R> still empty."
 * With three or more populated layers, uses Oxford-comma joining:
 * "X, Y, and Z have material."
 *
 * Edge cases:
 *   - Only the confirmed layer has any entries → "X has material" (singular)
 *   - All five layers have material → "<N> entries. <joined>. 0 still empty."
 *     (does not special-case the zero-remaining form — the downstream
 *     prompt treats "0 still empty" as valid copy.)
 */
export function buildEntriesSummary(args: {
  entryCount: number;
  confirmedLayerName: string;
  otherLayersWithMaterial: string[];
  remainingEmptyCount: number;
}): string {
  const { entryCount, confirmedLayerName, otherLayersWithMaterial, remainingEmptyCount } = args;
  const allMaterial = [confirmedLayerName, ...otherLayersWithMaterial];
  let materialPhrase: string;
  if (allMaterial.length === 1) {
    materialPhrase = `${allMaterial[0]} has material`;
  } else if (allMaterial.length === 2) {
    materialPhrase = `${allMaterial[0]} and ${allMaterial[1]} have material`;
  } else {
    const last = allMaterial[allMaterial.length - 1];
    const head = allMaterial.slice(0, -1).join(", ");
    materialPhrase = `${head}, and ${last} have material`;
  }
  return `${entryCount} entries. ${materialPhrase}. ${remainingEmptyCount} still empty.`;
}

// ── 5. Checkpoint meta builder ──────────────────────────────────────────────

/**
 * Build the checkpoint_meta object stored on messages.
 * Single shape definition — no drift between web and text. Layer + name
 * now come from the composition Opus call (Opus picks the layer based
 * on the entry content and the existing Manual). If composition failed,
 * layer/name are null and the checkpoint should not have been surfaced —
 * callers gate on `composedEntry?.layer` before calling this.
 */
export function buildCheckpointMeta(
  composedEntry: {
    content: string;
    name: string;
    section: string | null;
    tags?: string[];
    changelog: string;
    summary?: string;
    key_words?: string[];
  } | null
): CheckpointMeta {
  return {
    section: composedEntry?.section ?? null,
    tags: composedEntry?.tags ?? [],
    name: composedEntry?.name ?? null,
    status: "pending",
    composed_content: composedEntry?.content || null,
    composed_name: composedEntry?.name || null,
    changelog: composedEntry?.changelog || null,
    composed_summary: composedEntry?.summary || null,
    composed_key_words: composedEntry?.key_words || null,
    // Always 0 at creation: the pull model has no checkpoint inheritance.
    // "refined" bumps it on the (terminal) row in checkpoint/confirm — pure
    // bookkeeping; nothing gates on it. (The push-era refinement ceiling and
    // its "deferred" action were removed 2026-07-07 as unreachable.)
    refinement_count: 0,
  };
}

// ── Reflection meter fill ────────────────────────────────────────────────────

/** Depth rung → base fill percent. The deepest rung sits just under full so
 *  only true readiness (the gate) completes the bar.
 *  BACK-LOADED 2026-07-02 (founder call): the bar must wait — visible fill
 *  creates "I should action this" pressure, and early fill was part of why
 *  premature pulls produced thin entries. It now barely moves through
 *  storytelling (surface/behavior), stirs at feelings, and does its real
 *  rising only once the WHY is on the table. */
const REFLECTION_DEPTH_PCT: Record<string, number> = {
  surface: 0,
  behavior: 8,
  feeling: 28,
  mechanism: 60,
  origin: 80,
};

/**
 * Reflection meter fill (0–100), depth-only. The pre-ready bar reflects one
 * thing — how deep the conversation has gone (the depth rung) — and nothing
 * else. It does NOT reset or recharge after a save: a session builds toward a
 * single reflection, so there is no in-session refill to pace (the post-save
 * cooldown and its admin dial were removed 2026-07-08). Readiness — fill → 100
 * plus the pull affordance — is Jove's landed marker alone, applied by
 * resolveReflectionMeter, not this function.
 */
export function reflectionMeterFill(depth: string | null | undefined): number {
  return REFLECTION_DEPTH_PCT[depth ?? ""] ?? 0;
}

/**
 * The ONE reflection-meter resolution, shared by the live SSE emit
 * (call-persona) and the reload-restore endpoint (checkpoint/meter route) so
 * the two can never disagree — the 2026-07-02 incident was exactly that drift:
 * one path hid the meter while the other served it, so the bar appeared only
 * after a browser reload.
 *
 * The conductor (the live voice) is the only regime now: `ready` = Jove's own
 * published landed signal (the ---reflection-ready--- marker → reflectionLanded),
 * nothing else. Jove JUDGES readiness firsthand, per the landed markers in its
 * prompt; every extraction-side proxy tried before it fired the strip early
 * (the mom-run and Guerneville-run incidents). Pre-ready fill is the depth
 * journey and caps at 80; ready snaps fill to 100 — full bar ⇔ strip visible,
 * one story.
 *
 * Returns null to HIDE the meter (crisis, or nothing analyzed yet).
 */
export function resolveReflectionMeter(args: {
  extraction: ExtractionState | null;
  reflectionLanded: boolean;
}): { fill: number; ready: boolean } | null {
  const { extraction, reflectionLanded } = args;
  if (!extraction) return null;
  if (extraction.clinical_flag?.active && extraction.clinical_flag.level === "crisis") {
    return null;
  }
  const depthFill = reflectionMeterFill(extraction.depth);
  return { fill: reflectionLanded ? 100 : depthFill, ready: reflectionLanded };
}
