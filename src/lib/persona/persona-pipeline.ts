// ---------------------------------------------------------------------------
// Shared Sage pipeline logic — single source of truth for rules used by
// both the web (call-sage.ts) and text (sage-bridge.ts) paths.
// ---------------------------------------------------------------------------

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
import type { PersonaMode } from "@/lib/persona/system-prompt";

// ── Constants ────────────────────────────────────────────────────────────────

export const PERSONA_MODEL = "claude-sonnet-4-6";
export const PERSONA_MAX_TOKENS = 2048;

const CRISIS_RESOURCES =
  "\n\nIf you're in crisis or need immediate support, please reach out to the 988 Suicide & Crisis Lifeline — call or text 988. You can also text HOME to 741741 to reach the Crisis Text Line. Both are free, confidential, and available now.";

// ── Types ────────────────────────────────────────────────────────────────────

type ManualComponent = { layer: number; name: string; content: string };

export interface ConversationContext {
  messages: { role: "user" | "assistant"; content: string }[];
  manualComponents: ManualComponent[];
  previousExtraction: ExtractionState | null;
  sessionSummary: string | null;
  isReturningUser: boolean;
  isFirstCheckpoint: boolean;
  sessionCount: number;
  turnsSinceCheckpoint: number;
  conversationId: string;
  extractionForSage: string;
  turnCount: number;
  checkpointApproaching: boolean;
  personaMode: PersonaMode;
}

export interface CheckpointGateResult {
  isCheckpoint: boolean;
  layer: number | null;
  name: string | null;
}

export interface CheckpointMeta {
  layer: number | null;
  name: string | null;
  status: "pending";
  composed_content: string | null;
  composed_name: string | null;
  changelog: string | null;
}

// ── 1. Load conversation context ────────────────────────────────────────────

/**
 * Parallel DB reads + derived user state — shared by web and text paths.
 * Returns everything both paths need to build a system prompt and apply rules.
 */
export async function loadConversationContext(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  userId: string
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
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    admin
      .from("manual_components")
      .select("layer, name, content")
      .eq("user_id", userId),
    admin
      .from("conversations")
      .select("extraction_state, summary")
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
      .select("persona_mode")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  // Voice mode. Null/missing → 'autistic' (the only mode that ships in PR1).
  // The seam exists so future modes can be added without re-plumbing.
  const personaMode: PersonaMode =
    (profileResult.data?.persona_mode as PersonaMode) || "autistic";

  // Build conversation history
  let messages = applySlidingWindow(
    mapSystemMessages(historyResult.data || [])
  );
  if (messages.length === 0) {
    messages = [{ role: "user", content: "[Session started]" }];
  }

  const manualComponents: ManualComponent[] = manualResult.data || [];
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
  const extractionForSage = previousExtraction
    ? formatExtractionForPersona(previousExtraction, isFirstCheckpoint, manualComponents)
    : "";

  const turnCount = messages.length;
  const checkpointApproaching = previousExtraction
    ? Object.values(previousExtraction.layers).some(
        (l) =>
          l.signal === "emerging" ||
          l.signal === "explored" ||
          l.signal === "checkpoint_ready"
      )
    : false;

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
    extractionForSage,
    turnCount,
    checkpointApproaching,
    personaMode,
  };
}

// ── 1b. Build prompt options from context ──────────────────────────────────
//
// Single source of truth for the context → BuildPromptOptions mapping.
// Both web (call-sage.ts) and text (sage-bridge.ts) call this, then web
// layers on its channel-specific fields (explorationContext, transcriptContext,
// contentContext). Adding a new field to BuildPromptOptions? Add it here once.

export function buildPromptOptionsFromContext(ctx: ConversationContext) {
  return {
    manualComponents: ctx.manualComponents,
    isReturningUser: ctx.isReturningUser,
    sessionSummary: ctx.sessionSummary,
    extractionContext: ctx.extractionForSage,
    isFirstCheckpoint: ctx.isFirstCheckpoint,
    sessionCount: ctx.sessionCount,
    turnCount: ctx.turnCount,
    checkpointApproaching: ctx.checkpointApproaching,
    personaMode: ctx.personaMode,
  };
}

// ── 2. Background extraction ────────────────────────────────────────────────

/**
 * Fire extraction in background — runs in parallel, doesn't block response.
 */
export function fireBackgroundExtraction(
  ctx: ConversationContext,
  admin: ReturnType<typeof createAdminClient>
): void {
  runExtraction(
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
    .catch((err) =>
      console.error("[persona-pipeline] Background extraction failed:", err)
    );
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
  isFirstCheckpoint: boolean
): { ok: boolean; reasons: string[] } {
  if (!extractionState) {
    return { ok: true, reasons: [] };
  }

  const cf = extractionState.clinical_flag;
  if (cf?.active && cf.level === "crisis") {
    return { ok: false, reasons: ["crisis active — checkpoint blocked"] };
  }

  const gate = extractionState.checkpoint_gate;
  const reasons: string[] = [];

  const minExamples = isFirstCheckpoint ? 1 : 2;
  if (gate.concrete_examples < minExamples) {
    reasons.push(
      `concrete scenes ${gate.concrete_examples}/${minExamples}`
    );
  }
  if (!gate.has_charged_language) {
    reasons.push("no charged language captured");
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
 * Apply material-quality gate and turn-count suppression to a detected checkpoint.
 *
 * Rule 1: Material quality must meet the gate (validateMaterialQuality).
 * Rule 2: Suppress if fewer than 5 user turns since last checkpoint.
 */
export function applyCheckpointGates(
  manualEntry: { layer: number; name: string } | null,
  _manualComponents: ManualComponent[],
  turnsSinceCheckpoint: number,
  extractionState?: ExtractionState | null,
  isFirstCheckpoint?: boolean
): CheckpointGateResult {
  void _manualComponents;
  if (!manualEntry) {
    return { isCheckpoint: false, layer: null, name: null };
  }

  const { layer, name } = manualEntry;

  // Rule 1: material-quality pre-emit gate (silent, server-side)
  if (extractionState !== undefined) {
    const quality = validateMaterialQuality(
      extractionState ?? null,
      isFirstCheckpoint ?? false
    );
    if (!quality.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "[persona-pipeline] Checkpoint suppressed by material-quality gate: %s",
          quality.reasons.join("; ")
        );
      }
      return { isCheckpoint: false, layer: null, name: null };
    }
  }

  // Rule 2: turn-count suppression
  if (turnsSinceCheckpoint < 5) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[persona-pipeline] Checkpoint suppressed: %d turns since last (minimum 5)",
        turnsSinceCheckpoint
      );
    }
    return { isCheckpoint: false, layer: null, name: null };
  }

  return { isCheckpoint: true, layer, name };
}

// ── 4c. Composed-entry post-validation ──────────────────────────────────────

/**
 * Body/system words we expect to see in a composed manual entry.
 * If a user described a sensation in conversation, the entry should
 * carry it through. Used as a soft signal — logged, not blocked —
 * because the composer prompt already requires a somatic anchor.
 */
const SOMATIC_WORD_PATTERNS = [
  /\bbuzz/i, /\btight/i, /\bheav/i, /\bcrash/i, /\bshut(?:\s|-)?down/i,
  /\bwent\s+(?:still|offline|gone|blank|silent)/i, /\bfull\b/i,
  /\bfloody?\b/i, /\boverload/i, /\btoo\s+(?:loud|much|close|bright|fast)/i,
  /\bjaw\b/i, /\bchest\b/i, /\bbody\b/i, /\bsystem\b/i, /\bfrozen\b/i,
  /\bnumb/i, /\bblank/i, /\bquiet/i, /\bdark\s+room/i, /\bwave\b/i,
  /\bsharp/i, /\bslow/i, /\bgray\s*out/i, /\bwall\b/i,
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
  if (wordCount > 300) warnings.push(`entry too long: ${wordCount}/300`);

  const hasSomaticAnchor = SOMATIC_WORD_PATTERNS.some((re) => re.test(content));
  if (!hasSomaticAnchor) {
    warnings.push("no somatic anchor word detected");
  }

  // Clinical-label leak check: terms the composer is explicitly told to avoid.
  const CLINICAL_LEAKS = [
    /\bdysregulation\b/i, /\bsensory processing disorder\b/i,
    /\bexecutive dysfunction\b/i, /\brejection sensitive dysphoria\b/i,
    /\battachment style\b/i, /\bschema\b/i, /\btrauma response\b/i,
    /\bdissociation\b/i, /\bavoidance\b/i,
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

// ── 4b. Checkpoint action system message ────────────────────────────────────
//
// Single source of truth for the system messages inserted after checkpoint
// actions. These strings must stay in sync with mapSystemMessages() in
// call-sage.ts — if you change the wording here, update the mapping there.

const CHECKPOINT_ACTION_MESSAGES: Record<string, string> = {
  confirmed: "[User confirmed the checkpoint]",
  rejected: "[User rejected the checkpoint]",
  refined: "[User wants to refine the checkpoint]",
};

/**
 * Insert the canonical system message for a checkpoint action.
 * Used by: confirmCheckpoint (confirmed), checkpoint/confirm/route (rejected/refined),
 * and message-router (text path rejected/refined).
 */
export async function insertCheckpointActionMessage(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  action: "confirmed" | "rejected" | "refined"
): Promise<void> {
  await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "system",
    content: CHECKPOINT_ACTION_MESSAGES[action],
  });
}

// ── 5. Checkpoint meta builder ──────────────────────────────────────────────

/**
 * Build the checkpoint_meta object stored on messages.
 * Single shape definition — no drift between web and text.
 */
export function buildCheckpointMeta(
  gateResult: CheckpointGateResult,
  composedEntry: { content: string; name: string; changelog: string } | null
): CheckpointMeta {
  return {
    layer: gateResult.layer,
    name: composedEntry?.name || gateResult.name,
    status: "pending",
    composed_content: composedEntry?.content || null,
    composed_name: composedEntry?.name || null,
    changelog: composedEntry?.changelog || null,
  };
}
