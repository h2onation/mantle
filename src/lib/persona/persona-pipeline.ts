// ---------------------------------------------------------------------------
// Shared persona pipeline logic — single source of truth for rules used by
// both the web (call-persona.ts) and text (persona-bridge.ts) paths.
// ---------------------------------------------------------------------------

import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runExtraction,
  formatExtractionForPersona,
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

import { PERSONA_MODEL, PERSONA_MAX_TOKENS, CHECKPOINT_ACTIONS, LIVE_VOICE_VARIANT, type CheckpointAction } from "./config";
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
  extractionForPersona: string;
  turnCount: number;
  checkpointApproaching: boolean;
  personaModes: PersonaMode[];
  mode: "situation" | "guided-intake" | "upload";
  /** True when the immediately-preceding assistant turn proposed a
   *  checkpoint that the material-quality gate suppressed. Drives the
   *  POST-SUPPRESSION prompt block so Jove doesn't re-propose the same
   *  entry and re-trigger the suppression loop (2026-06-03 incident). */
  priorCheckpointSuppressed: boolean;
}

/** Outcome of the post-detection gates. `passed` is the only field
 *  callers act on; `reason` is for dev logging when a checkpoint is
 *  suppressed (turn-count or material-quality). The classifier-era
 *  shape carried layer + name pass-throughs; those are now produced by
 *  the composition step instead. */
export interface CheckpointGateResult {
  passed: boolean;
  reason?: string;
}

export interface CheckpointMeta {
  layer: number | null;
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
  // when the previous checkpoint was confirmed/rejected/deferred.
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
  personaModesOverride?: PersonaMode[]
): Promise<ConversationContext> {
  const [
    historyResult,
    manualResult,
    extractionResult,
    lastCheckpointResult,
    profileResult,
  ] = await Promise.all([
    admin
      .from("messages")
      .select("role, content, created_at, metadata")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    admin
      .from("manual_entries")
      .select("layer, name, content, summary, key_words, created_at, source_message_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    admin
      .from("conversations")
      .select("extraction_state, summary, mode")
      .eq("id", conversationId)
      .single(),
    admin
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .eq("is_checkpoint", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("persona_modes")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  // Fallback flipped from ["autistic"] to ["general"] on 2026-05-19 to
  // match the new column default (migration 20260519100000). Hit when the
  // profiles row has a null persona_modes — pre-onboarding signups, legacy
  // rows that pre-date the array migration, or any path that creates a
  // profile without setting persona_modes (e.g., the chat-route upsert).
  const personaModes: PersonaMode[] =
    personaModesOverride && personaModesOverride.length > 0
      ? personaModesOverride
      : (profileResult.data?.persona_modes as PersonaMode[] | null) ?? ["general"];

  const rawMode = extractionResult.data?.mode;
  if (rawMode && rawMode !== "situation" && rawMode !== "guided-intake" && rawMode !== "upload") {
    console.warn("[persona-pipeline] unexpected conversation mode: %s, falling back to situation", rawMode);
  }
  const conversationMode: "situation" | "guided-intake" | "upload" =
    rawMode === "guided-intake" ? "guided-intake" :
    rawMode === "upload" ? "upload" : "situation";

  // Build conversation history
  let messages = applySlidingWindow(
    mapSystemMessages(historyResult.data || [])
  );
  if (messages.length === 0) {
    messages = [{ role: "user", content: "[Session started]" }];
  }

  // Loop circuit-breaker (2026-06-03): did the immediately-preceding
  // assistant turn propose a checkpoint that the gate suppressed? The
  // suppressed turn tags its row metadata; we read it back here so the
  // next turn's prompt can tell Jove not to re-propose the same entry.
  const priorAssistant = [...(historyResult.data || [])]
    .reverse()
    .find((m: { role: string }) => m.role === "assistant");
  const priorCheckpointSuppressed = Boolean(
    (
      priorAssistant?.metadata as
        | { checkpoint_suppressed?: boolean }
        | null
        | undefined
    )?.checkpoint_suppressed
  );

  // Raw entries from manual_entries. We map source_message_id → conversation_id
  // below so prepareManualContext can split "current session" from "older"
  // without another round-trip.
  const rawEntries = (manualResult.data || []) as Array<{
    layer: number;
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
    name: e.name,
    content: e.content,
    summary: e.summary,
    key_words: e.key_words,
    created_at: e.created_at || undefined,
    source_conversation_id: e.source_message_id
      ? sourceMsgToConv.get(e.source_message_id) || null
      : null,
  }));
  const previousExtraction: ExtractionState | null =
    extractionResult.data?.extraction_state ?? null;
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

  // Derived prompt flags
  const extractionForPersona = previousExtraction
    ? formatExtractionForPersona(previousExtraction, isFirstCheckpoint, manualComponents)
    : "";

  const turnCount = messages.length;
  const checkpointApproaching = deriveCheckpointApproaching(
    previousExtraction,
    isFirstCheckpoint,
    turnCount
  );

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
    extractionForPersona,
    turnCount,
    checkpointApproaching,
    personaModes,
    mode: conversationMode,
    priorCheckpointSuppressed,
  };
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
    extractionContext: ctx.extractionForPersona,
    isFirstCheckpoint: ctx.isFirstCheckpoint,
    sessionCount: ctx.sessionCount,
    turnCount: ctx.turnCount,
    checkpointApproaching: ctx.checkpointApproaching,
    personaModes: ctx.personaModes,
    mode: ctx.mode,
    priorCheckpointSuppressed: ctx.priorCheckpointSuppressed,
    // Phase 3a: the live voice switch. Both consumers of these options — the
    // app path (call-persona → buildSystemPromptBlocks) and the SMS path
    // (persona-bridge → buildSystemPrompt) — flip together. Rollback is
    // LIVE_VOICE_VARIANT = "legacy" in config.ts.
    voiceVariant: LIVE_VOICE_VARIANT,
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

// ── 4. Checkpoint gates ─────────────────────────────────────────────────────

/**
 * Pre-emit material-quality gate. Re-checks the extraction state's
 * quality criteria server-side BEFORE we let a flagged checkpoint
 * proceed to manual-entry composition. This enforces the same self-check
 * the conversation prompt used to spell out, but silently and outside
 * the leaked surface area.
 *
 * Standard gate: 2+ scenes, mechanism, charged language, behavior↔driver link.
 * First-checkpoint gate (lighter): 1 scene + charged language + (mechanism OR link).
 *
 * Returns { ok, reasons } so callers can log without echoing the
 * gate vocabulary back to the user.
 */
export function validateMaterialQuality(
  extractionState: ExtractionState | null,
  isFirstCheckpoint: boolean,
  turnCount?: number
): { ok: boolean; reasons: string[] } {
  // Fail closed on missing material (Lock 1 — ADR-043). A null extraction
  // state means no ripeness condition can be verified, charged material
  // included. The old two-gate design backstopped this with a post-composition
  // check; this one-gate build removed that backstop, so "no data" must read as
  // "not ripe," never as ripe. Empty / low-only banks on a non-null state are
  // already caught downstream by the charged-material check.
  if (!extractionState) {
    return {
      ok: false,
      reasons: ["no extraction state — material cannot be verified"],
    };
  }

  const cf = extractionState.clinical_flag;
  if (cf?.active && cf.level === "crisis") {
    return { ok: false, reasons: ["crisis active — checkpoint blocked"] };
  }

  // Phase gate: pattern must be engaged before checkpoint can fire.
  // Override at turn 12+: if extraction missed the engagement signal
  // but material quality is otherwise strong, allow the checkpoint.
  if (!extractionState.pattern_engaged) {
    if (turnCount === undefined || turnCount < 12) {
      return { ok: false, reasons: ["pattern not yet engaged in conversation"] };
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[persona-pipeline] pattern_engaged override at turn %d",
        turnCount
      );
    }
  }

  const gate = extractionState.checkpoint_gate;
  const reasons: string[] = [];

  // Depth gate: the conversation must have descended past surface
  // description before a checkpoint can fire. Without depth at
  // "mechanism" or "origin," we are still at the layer of "what
  // happened" / "what they did," not "why this happens to them."
  // Structural backstop on top of has_mechanism — even if extraction's
  // per-flag check is generous, the depth reading catches the case
  // where the conversation as a whole hasn't gone deep. For first
  // checkpoint the lighter bar is "feeling" — the user has named
  // what their body or system was doing, which is enough for a
  // teaching-moment entry.
  const DEPTH_ORDER = [
    "surface",
    "behavior",
    "feeling",
    "mechanism",
    "origin",
  ] as const;
  const requiredDepth = isFirstCheckpoint ? "feeling" : "mechanism";
  const currentDepthIdx = DEPTH_ORDER.indexOf(extractionState.depth);
  const requiredDepthIdx = DEPTH_ORDER.indexOf(requiredDepth);
  if (currentDepthIdx < requiredDepthIdx) {
    reasons.push(
      `depth at ${extractionState.depth} (need ${requiredDepth} or deeper)`
    );
  }

  const minExamples = isFirstCheckpoint ? 1 : 2;
  if (gate.concrete_examples < minExamples) {
    reasons.push(
      `concrete scenes ${gate.concrete_examples}/${minExamples}`
    );
  }

  // Distinct-contexts gate (two-instance rule, promoted from prose).
  // A pattern claim "this is how you operate" needs evidence across at
  // least two contexts, not just multiple moments within one incident.
  // Falls back gracefully when the field is missing from extraction
  // states written before this field existed — undefined means "skip
  // this check" rather than failing closed.
  const minContexts = isFirstCheckpoint ? 1 : 2;
  const distinctContexts =
    typeof gate.distinct_contexts === "number" ? gate.distinct_contexts : null;
  if (distinctContexts !== null && distinctContexts < minContexts) {
    reasons.push(
      `distinct contexts ${distinctContexts}/${minContexts}`
    );
  }

  // Charged-material gate (Lock 1 — ADR-043). Deterministic check over the
  // real language_bank, replacing the model-reported has_charged_language
  // boolean (which can read true while the bank is empty or weak). A pattern
  // is not ripe unless the bank actually carries a high/medium charged phrase
  // the candidate pattern is built on.
  //
  // - high|medium aligns the gate with the rest of the system: the composer
  //   (confirm-checkpoint.ts) and formatExtractionForPersona both treat
  //   "charged" as high-or-medium. The has_charged_language field is still
  //   produced by extraction and read by those callers — we just stop gating
  //   on it here.
  // - "Built on" approximation: prefer phrases tagged to the candidate layer
  //   (gate.strongest_layer). When strongest_layer is null (the gate hasn't
  //   resolved a layer), fall back to any high/medium phrase in the bank.
  //   A non-null strongest_layer with no charged phrase tagged to it reads as
  //   not ripe — the charge has to attach to the pattern being proposed.
  const chargedPhrases = (extractionState.language_bank || []).filter(
    (e) => e.charge === "high" || e.charge === "medium"
  );
  // Coerce to a number so a legacy/in-flight string strongest_layer ("1")
  // can't fail strict-equality membership against numeric language_bank
  // layers. Boundary coercion (mergeExtractionState) handles freshly-written
  // state; this guards previousExtraction rows persisted before that fix.
  const candidateLayer =
    gate.strongest_layer === null || gate.strongest_layer === undefined
      ? null
      : Number(gate.strongest_layer);
  const builtOnCharged =
    candidateLayer !== null
      ? chargedPhrases.filter(
          (e) =>
            Array.isArray(e.layers) &&
            e.layers.some((l) => Number(l) === candidateLayer)
        )
      : chargedPhrases;
  if (builtOnCharged.length === 0) {
    reasons.push(
      candidateLayer !== null
        ? `no high/medium charged phrase on candidate layer ${candidateLayer}`
        : "no high/medium charged phrase in language bank"
    );
  }
  if (isFirstCheckpoint) {
    if (!gate.has_mechanism && !gate.has_behavior_driver_link) {
      reasons.push("no mechanism or behavior-driver link");
    }
  } else {
    if (!gate.has_mechanism) reasons.push("no mechanism");
    if (!gate.has_behavior_driver_link) reasons.push("no behavior-driver link");
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Decide whether to load the CHECKPOINTS instructions into Jove's
 * system prompt for this turn. Two paths to "true":
 *
 * (1) Extraction's per-layer signal has promoted at least one layer
 *     to "explored" or "checkpoint_ready", backed by charged material
 *     on one of those layers and not during a crisis — its holistic
 *     "feels developed" read (signal alone is not enough; see body and
 *     ADR-043).
 *
 * (2) Extraction's mechanical checklist (concrete scenes + charged
 *     language + mechanism/driver, plus the turn-12 pattern_engaged
 *     override) would pass the downstream material-quality gate —
 *     the field-by-field tally the post-detection suppression check
 *     already uses.
 *
 * Both paths read fields from the same Extraction call. The two
 * readings diverge in practice: long, rich conversations sometimes
 * fill the checklist while the per-layer signal stays at "emerging".
 * Under signal-only, Jove never gets the checkpoint instructions and
 * keeps deepening through material that already qualifies. Reading
 * the checklist too brings this upstream decision into sync with
 * `validateMaterialQuality` — same gate logic applied earlier, so the
 * prompt and the suppression check stay aligned. No new criterion.
 *
 * Returns false when previousExtraction is null (cold start).
 * Exported for direct testing.
 */
export function deriveCheckpointApproaching(
  previousExtraction: ExtractionState | null | undefined,
  isFirstCheckpoint: boolean,
  turnCount: number
): boolean {
  if (!previousExtraction) return false;

  // Signal-ready is a candidate, not a verdict. A layer extraction promoted
  // to "explored"/"checkpoint_ready" loads checkpoint instructions only if
  // (a) charged material backs one of those layers (Lock 1 principle,
  // ADR-043) and (b) no crisis is active. Otherwise fall through to the full
  // gate, which applies every check — crisis, pattern_engaged, depth, charged
  // — uniformly. Returning true on signal alone used to bypass
  // validateMaterialQuality entirely, so a returning user's bootstrapped
  // "explored" layer could load instructions with no charged material, even
  // during an active crisis.
  const signalReadyLayers = Object.entries(previousExtraction.layers)
    .filter(([, l]) => l.signal === "explored" || l.signal === "checkpoint_ready")
    .map(([k]) => Number(k));

  if (signalReadyLayers.length > 0) {
    const cf = previousExtraction.clinical_flag;
    const crisisActive = cf?.active && cf.level === "crisis";
    const chargedOnSignalLayer = (previousExtraction.language_bank || []).some(
      (e) =>
        (e.charge === "high" || e.charge === "medium") &&
        Array.isArray(e.layers) &&
        e.layers.some((ln) => signalReadyLayers.includes(Number(ln)))
    );
    if (chargedOnSignalLayer && !crisisActive) return true;
  }

  return validateMaterialQuality(
    previousExtraction,
    isFirstCheckpoint,
    turnCount
  ).ok;
}

/**
 * Apply material-quality gate and turn-count suppression to a detected
 * checkpoint. Called AFTER the deterministic transition-line detector
 * says yes, BEFORE the composition Opus call. Cheaper to gate here than
 * to compose and discard.
 *
 * Rule 1: Pattern engagement + material quality (validateMaterialQuality).
 * Rule 2: Suppress if fewer than 5 user turns since last checkpoint.
 *
 * Returns `{ passed: true }` when the checkpoint should proceed, or
 * `{ passed: false, reason }` when one of the gates fired. The reason
 * is for dev logging only — callers should never echo it to the user.
 */
export function applyCheckpointGates(
  turnsSinceCheckpoint: number,
  extractionState?: ExtractionState | null,
  isFirstCheckpoint?: boolean,
  turnCount?: number
): CheckpointGateResult {
  // Rule 1: pattern engagement + material-quality pre-emit gate
  if (extractionState !== undefined) {
    const quality = validateMaterialQuality(
      extractionState ?? null,
      isFirstCheckpoint ?? false,
      turnCount
    );
    if (!quality.ok) {
      const reason = quality.reasons.join("; ");
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "[persona-pipeline] Checkpoint suppressed by material-quality gate: %s",
          reason
        );
      }
      return { passed: false, reason };
    }
  }

  // Rule 2: turn-count suppression
  if (turnsSinceCheckpoint < 5) {
    const reason = `only ${turnsSinceCheckpoint} turns since last checkpoint (minimum 5)`;
    if (process.env.NODE_ENV !== "production") {
      console.log("[persona-pipeline] Checkpoint suppressed: %s", reason);
    }
    return { passed: false, reason };
  }

  return { passed: true };
}

// ── 4c. Composed-entry post-validation ──────────────────────────────────────

/**
 * Body/system words we expect to see in a composed manual entry.
 * If a user described a sensation in conversation, the entry should
 * carry it through. Used as a soft signal — logged, not blocked —
 * because the composer prompt already requires a somatic anchor.
 */
const SOMATIC_WORD_PATTERNS = [
  // Shutdown / freeze register
  /\bbuzz/i, /\btight/i, /\bheav/i, /\bcrash/i, /\bshut(?:\s|-)?down/i,
  /\bwent\s+(?:still|offline|gone|blank|silent)/i, /\bfull\b/i,
  /\bfloody?\b/i, /\boverload/i, /\btoo\s+(?:loud|much|close|bright|fast)/i,
  /\bjaw\b/i, /\bchest\b/i, /\bbody\b/i, /\bsystem\b/i, /\bfrozen\b/i,
  /\bnumb/i, /\bblank/i, /\bquiet/i, /\bdark\s+room/i, /\bwave\b/i,
  /\bsharp/i, /\bslow/i, /\bgray\s*out/i, /\bwall\b/i,
  // Activation / hyper-arousal register. Agent B catch: the list above
  // skews freeze-only, so a user whose pattern is hyper-activation (heart
  // racing, lit up, surging, prickle) had no somatic-anchor word the
  // composer could recognize. These add the activation side.
  /\brac(?:e|es|ed|ing)\b/i, /\bsurg/i, /\bhot\b/i, /\bprickl/i,
  /\balert\b/i, /\blit\s*up\b/i, /\bpound/i, /\belectri/i, /\bjump(?:y|ing)\b/i,
  // Sensory-environmental load. For users whose anchor is the input itself
  // (a draining environment, sound, noise) rather than a body location, the
  // load IS the somatic anchor. Added 2026-06-03 so the log-validator stops
  // false-flagging sensory-anchored entries (cf. the music transcript).
  /\bdrain/i, /\bexhaust/i, /\bnois/i,
];

/**
 * Soft post-composition validator. Checks the composed manual entry
 * against the rules the composer is supposed to enforce. Returns
 * { ok, warnings } so the caller can log structural drift without
 * blocking the entry. Word counts are inclusive ranges.
 */
export function validateComposedEntry(
  content: string
): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 80) warnings.push(`entry too short: ${wordCount}/80`);
  if (wordCount > 150) warnings.push(`entry too long: ${wordCount}/150`);

  const hasSomaticAnchor = SOMATIC_WORD_PATTERNS.some((re) => re.test(content));
  if (!hasSomaticAnchor) {
    warnings.push("no somatic anchor word detected");
  }

  // Clinical-label leak check: terms the composer is explicitly told to avoid.
  // Includes both DSM-flavored labels and the next-wave wellness vocabulary
  // (polyvagal, window of tolerance, fawn/freeze response, co-regulation)
  // that creeps in as pseudo-clinical framing.
  const CLINICAL_LEAKS = [
    /\bdysregulation\b/i, /\bsensory processing disorder\b/i,
    /\bexecutive dysfunction\b/i, /\brejection sensitive dysphoria\b/i,
    /\battachment style\b/i, /\bschema\b/i, /\btrauma response\b/i,
    /\bdissociation\b/i, /\bavoidance\b/i,
    /\bpolyvagal\b/i, /\bwindow of tolerance\b/i,
    /\bfawn response\b/i, /\bfreeze response\b/i,
    /\bco-?regulation\b/i, /\bnervous system response\b/i,
  ];
  for (const re of CLINICAL_LEAKS) {
    if (re.test(content)) {
      warnings.push(`clinical label leaked: ${re.source}`);
    }
  }

  // Time-reference leak check.
  const TIME_LEAKS = [
    /\bright now\b/i, /\bcurrently\b/i, /\bat this point\b/i,
    /\bat this stage\b/i, /\bthese days\b/i, /\bthis week\b/i,
  ];
  for (const re of TIME_LEAKS) {
    if (re.test(content)) {
      warnings.push(`time reference leaked: ${re.source}`);
    }
  }

  return { ok: warnings.length === 0, warnings };
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
 * Used by: confirmCheckpoint (confirmed), checkpoint/confirm/route (rejected/refined/deferred),
 * and message-router (text path rejected/refined; deferred is web-only).
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
 * Computes the refinement_count for a NEW checkpoint based on the
 * most recent prior checkpoint's meta. The chain rule:
 *   - If there is no prior checkpoint → 0 (fresh start)
 *   - If the prior checkpoint was refined → inherit its count
 *   - Any other prior status (confirmed, rejected, deferred-as-rejected,
 *     pending) → reset to 0 (chain broken)
 *
 * The function does NOT add 1 — incrementing happens at action time
 * (see /api/checkpoint/confirm route for the increment). The new
 * checkpoint inherits the post-increment value of the previous one.
 *
 * Track A Phase 7-Mid.
 */
export function computeInheritedRefinementCount(
  previousMeta: { status?: string; refinement_count?: number } | null
): number {
  if (!previousMeta) return 0;
  if (previousMeta.status !== "refined") return 0;
  return previousMeta.refinement_count ?? 0;
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
    layer: number;
    changelog: string;
    summary?: string;
    key_words?: string[];
  } | null,
  inheritedRefinementCount: number = 0
): CheckpointMeta {
  return {
    layer: composedEntry?.layer ?? null,
    name: composedEntry?.name ?? null,
    status: "pending",
    composed_content: composedEntry?.content || null,
    composed_name: composedEntry?.name || null,
    changelog: composedEntry?.changelog || null,
    composed_summary: composedEntry?.summary || null,
    composed_key_words: composedEntry?.key_words || null,
    refinement_count: inheritedRefinementCount,
  };
}
