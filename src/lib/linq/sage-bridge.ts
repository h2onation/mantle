// ---------------------------------------------------------------------------
// Sage bridge — connects inbound text messages to the existing Sage engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import {
  runExtraction,
  formatExtractionForSage,
  type ExtractionState,
} from "@/lib/sage/extraction";
import {
  mapSystemMessages,
  applySlidingWindow,
  detectCrisisInUserMessage,
  parseManualEntryBlock,
} from "@/lib/sage/call-sage";


const CRISIS_RESOURCES =
  "\n\nIf you're in crisis or need immediate support, please reach out to the 988 Suicide & Crisis Lifeline — call or text 988. You can also text HOME to 741741 to reach the Crisis Text Line. Both are free, confidential, and available now.";

interface SageBridgeResult {
  responseText: string;
  conversationId: string;
  messageId: string | null;
  checkpointText: string | null;
}

/**
 * Processes an inbound text message through the Sage pipeline.
 * Reuses the same extraction, prompt building, and conversation logic
 * as the web app, but collects the response non-streaming and skips
 * checkpoint classification.
 */
export async function processTextMessage(
  userId: string,
  messageText: string
): Promise<SageBridgeResult> {
  const admin = createAdminClient();

  // 1. Find or create the user's active conversation
  const conversationId = await getOrCreateConversation(admin, userId);

  // 2. Save the inbound message with channel: "text"
  const { error: insertError } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: messageText,
    channel: "text",
  });

  if (insertError) {
    console.error("[sage-bridge] Failed to save user message:", insertError);
    throw new Error("Failed to save message");
  }

  // 3. Parallel DB reads (same pattern as callSage)
  const [historyResult, manualResult, extractionResult] = await Promise.all([
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
  ]);

  // 4. Build conversation history
  let messages = applySlidingWindow(
    mapSystemMessages(historyResult.data || [])
  );
  if (messages.length === 0) {
    messages = [{ role: "user", content: "[Session started]" }];
  }

  const manualComponents = manualResult.data || [];
  const previousExtraction: ExtractionState | null =
    extractionResult.data?.extraction_state ?? null;
  const sessionSummary: string | null =
    extractionResult.data?.summary ?? null;

  // 5. Determine user state
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

  // 6. Fire extraction in background (same as web — doesn't block response)
  runExtraction(messages, previousExtraction, manualComponents, isFirstCheckpoint)
    .then(async (newState) => {
      const { data: currentConv } = await admin
        .from("conversations")
        .select("extraction_state")
        .eq("id", conversationId)
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

      await admin
        .from("conversations")
        .update({ extraction_state: newState })
        .eq("id", conversationId);
    })
    .catch((err) =>
      console.error("[sage-bridge] Background extraction failed:", err)
    );

  // 7. Build system prompt with SMS mode
  const extractionForSage = previousExtraction
    ? formatExtractionForSage(
        previousExtraction,
        isFirstCheckpoint,
        manualComponents
      )
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

  const basePrompt = buildSystemPrompt({
    manualComponents,
    isReturningUser,
    sessionSummary,
    extractionContext: extractionForSage,
    isFirstCheckpoint,
    sessionCount,
    turnCount,
    hasPatternEligibleLayer,
    checkpointApproaching,
  });

  // Use the same system prompt as web — no SMS-specific modifications
  const systemPrompt = basePrompt;

  // 8. Call Sage non-streaming (text doesn't need SSE)
  const response = await anthropicFetch({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const fullText =
    response.content?.[0]?.text || "Something went wrong on my end.";

  // Parse manual entry block if present (same parser as web)
  const parsed = parseManualEntryBlock(fullText);
  let responseText = parsed.conversationalText;
  const manualEntry = parsed.manualEntry;

  // 9. Crisis detection
  if (detectCrisisInUserMessage(messageText)) {
    const sageIncluded988 = responseText.includes("988");
    if (!sageIncluded988) {
      responseText += CRISIS_RESOURCES;
    }

    console.log("[sage-bridge] CRISIS DETECTED", {
      conversation_id: conversationId,
      user_id: userId,
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
          console.error("[sage-bridge] Failed to log safety event:", error);
      });
  }

  // 10. Save Sage's response with channel: "text"
  const { data: savedResponse } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: responseText,
      channel: "text",
    })
    .select("id")
    .single();

  const messageId = savedResponse?.id || null;

  // Save extraction snapshot
  if (messageId && previousExtraction) {
    admin
      .from("messages")
      .update({ extraction_snapshot: previousExtraction })
      .eq("id", messageId)
      .then(({ error }) => {
        if (error && !error.message.includes("extraction_snapshot")) {
          console.error(
            "[sage-bridge] Failed to save extraction snapshot:",
            error
          );
        }
      });
  }

  // 11. Handle checkpoint — save metadata and build confirmation text
  let checkpointText: string | null = null;

  if (manualEntry && messageId) {
    const isPattern = manualEntry.type === "pattern";

    // Save checkpoint metadata on the message (same as web)
    await admin
      .from("messages")
      .update({
        is_checkpoint: true,
        checkpoint_meta: {
          layer: manualEntry.layer,
          type: manualEntry.type,
          name: manualEntry.name,
          status: "pending",
          composed_content: manualEntry.content || null,
          composed_name: manualEntry.name || null,
          changelog: manualEntry.changelog || null,
        },
      })
      .eq("id", messageId);

    // Build the text checkpoint message using the same language as the app
    const question = isPattern ? "Does this resonate?" : "Does this feel right?";
    checkpointText =
      `${question}\n\n` +
      `"${manualEntry.name}"\n` +
      `${manualEntry.content}\n\n` +
      `Reply YES to write to manual, NOT QUITE if it needs refining, or NO to discard.`;

    console.log(
      "[sage-bridge] checkpoint_detected layer=%d type=%s name=%s message_id=%s",
      manualEntry.layer,
      manualEntry.type,
      manualEntry.name,
      messageId
    );
  }

  return { responseText, conversationId, messageId, checkpointText };
}

/**
 * Find the user's most recent active conversation, or create one.
 * Text messages join the existing conversation — no separate sessions.
 */
async function getOrCreateConversation(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ user_id: userId, status: "active" })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[sage-bridge] Failed to create conversation:", error);
    throw new Error("Failed to create conversation");
  }

  return created.id;
}
