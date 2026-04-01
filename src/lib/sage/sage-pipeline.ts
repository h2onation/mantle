// ---------------------------------------------------------------------------
// Shared Sage pipeline logic — single source of truth for rules used by
// both the web (call-sage.ts) and text (sage-bridge.ts) paths.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import {
  runExtraction,
  formatExtractionForSage,
  type ExtractionState,
} from "@/lib/sage/extraction";
import {
  mapSystemMessages,
  applySlidingWindow,
  detectCrisisInUserMessage,
} from "@/lib/sage/call-sage";

// ── Constants ────────────────────────────────────────────────────────────────

export const SAGE_MODEL = "claude-sonnet-4-6";
export const SAGE_MAX_TOKENS = 2048;

const CRISIS_RESOURCES =
  "\n\nIf you're in crisis or need immediate support, please reach out to the 988 Suicide & Crisis Lifeline — call or text 988. You can also text HOME to 741741 to reach the Crisis Text Line. Both are free, confidential, and available now.";

// ── Types ────────────────────────────────────────────────────────────────────

type ManualComponent = { layer: number; type: string; name: string; content: string };

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
  hasPatternEligibleLayer: boolean;
  checkpointApproaching: boolean;
}

export interface CheckpointGateResult {
  isCheckpoint: boolean;
  layer: number | null;
  type: string | null;
  name: string | null;
}

export interface CheckpointMeta {
  layer: number | null;
  type: string | null;
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
  const [historyResult, manualResult, extractionResult, lastCheckpointResult] =
    await Promise.all([
      admin
        .from("messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
      admin
        .from("manual_components")
        .select("layer, type, name, content")
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
    ]);

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
      .eq("user_id", userId);
    sessionCount = count || 1;
  }

  // Derived prompt flags
  const extractionForSage = previousExtraction
    ? formatExtractionForSage(previousExtraction, isFirstCheckpoint, manualComponents)
    : "";

  const turnCount = messages.length;
  const confirmedComponentCount = manualComponents.filter(
    (c) => c.type === "component"
  ).length;
  const hasPatternEligibleLayer =
    previousExtraction && confirmedComponentCount >= 3
      ? Object.values(previousExtraction.layers).some(
          (l) => l.discovery_mode === "pattern"
        )
      : false;
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
    hasPatternEligibleLayer,
    checkpointApproaching,
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
    hasPatternEligibleLayer: ctx.hasPatternEligibleLayer,
    checkpointApproaching: ctx.checkpointApproaching,
  };
}

// ── 2. Background extraction ────────────────────────────────────────────────

/**
 * Fire extraction in background — runs in parallel, doesn't block response.
 * Preserves discovery_mode and confirmed_patterns set by confirmCheckpoint().
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
      const { data: currentConv } = await admin
        .from("conversations")
        .select("extraction_state")
        .eq("id", ctx.conversationId)
        .single();

      if (currentConv?.extraction_state) {
        const currentState = currentConv.extraction_state as ExtractionState;
        for (let i = 1; i <= 5; i++) {
          if (newState.layers[i] && currentState.layers[i]) {
            newState.layers[i].discovery_mode =
              currentState.layers[i].discovery_mode;
          }
        }
        newState.confirmed_patterns = currentState.confirmed_patterns || [];
      }

      const { error } = await admin
        .from("conversations")
        .update({ extraction_state: newState })
        .eq("id", ctx.conversationId);

      if (error)
        console.error("[sage-pipeline] Failed to save extraction state:", error);
    })
    .catch((err) =>
      console.error("[sage-pipeline] Background extraction failed:", err)
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

  const sageIncluded988 = responseText.includes("988");
  if (!sageIncluded988) {
    responseText += CRISIS_RESOURCES;
  }

  console.log("[sage-pipeline] CRISIS DETECTED", {
    timestamp: new Date().toISOString(),
    conversation_id: conversationId,
    user_id: userId,
    crisis_detected: true,
    sage_included_988: sageIncluded988,
  });

  admin
    .from("safety_events")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      crisis_detected: true,
      sage_included_988: sageIncluded988,
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error)
        console.error("[sage-pipeline] Failed to log safety event:", error);
    });

  return { responseText, crisisDetected: true };
}

// ── 4. Checkpoint gates ─────────────────────────────────────────────────────

/**
 * Apply layer guards and turn-count suppression to a detected checkpoint.
 *
 * Rule 1: First entry on any layer must be a component.
 * Rule 2: Only one component per layer — force to pattern after.
 * Rule 3: Suppress if fewer than 5 user turns since last checkpoint.
 */
export function applyCheckpointGates(
  manualEntry: { layer: number; type: string; name: string } | null,
  manualComponents: ManualComponent[],
  turnsSinceCheckpoint: number
): CheckpointGateResult {
  if (!manualEntry) {
    return { isCheckpoint: false, layer: null, type: null, name: null };
  }

  const { layer, name } = manualEntry;
  let { type } = manualEntry;

  // Rule 1 & 2: layer guards
  const layerHasComponent = manualComponents.some(
    (c) => c.layer === layer && c.type === "component"
  );

  if (type === "pattern" && !layerHasComponent) {
    type = "component";
  } else if (type === "component" && layerHasComponent) {
    type = "pattern";
  }

  // Rule 3: turn-count suppression
  if (turnsSinceCheckpoint < 5) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[sage-pipeline] Checkpoint suppressed: %d turns since last (minimum 5)",
        turnsSinceCheckpoint
      );
    }
    return { isCheckpoint: false, layer: null, type: null, name: null };
  }

  return { isCheckpoint: true, layer, type, name };
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
  manualEntry: { content?: string; name?: string; changelog?: string } | null,
  composedEntry: { content: string; name: string; changelog: string } | null
): CheckpointMeta {
  return {
    layer: gateResult.layer,
    type: gateResult.type,
    name: composedEntry?.name || manualEntry?.name || gateResult.name,
    status: "pending",
    composed_content: manualEntry?.content || composedEntry?.content || null,
    composed_name: manualEntry?.name || composedEntry?.name || null,
    changelog: manualEntry?.changelog || composedEntry?.changelog || null,
  };
}
