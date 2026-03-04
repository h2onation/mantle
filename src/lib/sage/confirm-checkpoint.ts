import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import type { ExtractionState } from "@/lib/sage/extraction";

// ─── Manual entry composition (Path B fallback) ──────────────────────────────
// When Sage doesn't produce a |||MANUAL_ENTRY||| block but the classifier
// flags a checkpoint, this function composes a proper manual entry from
// the conversational checkpoint text + conversation context.

const COMPOSITION_SYSTEM = `You compose manual entries for a behavioral model called a User Manual. You receive a checkpoint reflection delivered in conversation, conversation context, and the user's own language.

Transform the conversational checkpoint into a polished manual entry.

COMPOSITION VOICE
Talk to them about their life, not about their traits. A manual entry is not a case note. It's a mirror.

WRONG: "You have a strong need for validation rooted in a family system where judgment was constant."
RIGHT: "You grew up in a house where people got judged for falling short. You learned to want their approval and to hide anything they could judge in the same motion."

Five principles:
1. Talk to them, not about them. Every sentence about what they're living through, doing, experiencing. Not traits.
2. Name the bind. "You can't stop doing X because the alternative is worse, and doing X costs you the thing you want."
3. Land the cost in their specific life. Not abstract erosion — their situation, their words.
4. The "so what" must be explicit. Name what they can't get the way they're currently chasing it.
5. Use their exact words from the language bank. Their words > your paraphrase.

RULES:
- Written in second person ("You...")
- No session references ("you told me," "in this conversation")
- Components: 150-250 words. Dense, flowing prose. No bullet points.
- Patterns: 80-150 words. Trigger → experience → response → cost.
- Use the user's charged phrases where they carry weight

Respond with ONLY the JSON block. No other text:

|||MANUAL_ENTRY|||
{"layer": N, "type": "component", "name": "The Name", "content": "The composed narrative...", "changelog": "What this captures."}
|||END_MANUAL_ENTRY|||`;

const LAYER_NAMES: Record<number, string> = {
  1: "What Drives You",
  2: "Your Self Perception",
  3: "Your Reaction System",
  4: "How You Operate",
  5: "Your Relationship to Others",
};

export async function composeManualEntry(options: {
  checkpointText: string;
  conversationHistory: { role: string; content: string }[];
  languageBank: { phrase: string; context: string; charge: string }[];
  layer: number;
  type: "component" | "pattern";
}): Promise<{ content: string; name: string; changelog: string } | null> {
  const { checkpointText, conversationHistory, languageBank, layer, type } = options;

  let userContent = `CHECKPOINT REFLECTION (what Sage said to the user):\n${checkpointText}\n\n`;

  if (conversationHistory.length > 0) {
    userContent += "CONVERSATION CONTEXT (recent messages):\n";
    for (const msg of conversationHistory) {
      userContent += `${msg.role}: ${msg.content}\n\n`;
    }
  }

  if (languageBank.length > 0) {
    userContent += "USER'S OWN LANGUAGE (use these phrases):\n";
    for (const entry of languageBank) {
      userContent += `"${entry.phrase}" [${entry.charge}] — re: ${entry.context}\n`;
    }
    userContent += "\n";
  }

  userContent += `TARGET: Layer ${layer} (${LAYER_NAMES[layer] || "Unknown"}), type: ${type}\n`;
  userContent += "Compose the manual entry now.";

  try {
    const response = await anthropicFetch({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: COMPOSITION_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";

    const entryDelimiter = "|||MANUAL_ENTRY|||";
    const endDelimiter = "|||END_MANUAL_ENTRY|||";
    const entryStart = rawText.indexOf(entryDelimiter);
    const jsonEnd = rawText.indexOf(endDelimiter);

    if (entryStart === -1 || jsonEnd === -1) {
      console.error("[composeManualEntry] No manual entry block in response");
      return null;
    }

    const jsonStr = rawText.substring(entryStart + entryDelimiter.length, jsonEnd).trim();
    const parsed = JSON.parse(jsonStr);

    return {
      content: parsed.content,
      name: parsed.name || "Untitled",
      changelog: parsed.changelog || "Composed from checkpoint reflection.",
    };
  } catch (err) {
    console.error("[composeManualEntry] Failed:", err);
    return null;
  }
}

interface ConfirmCheckpointOptions {
  messageId: string;
  conversationId: string;
  userId: string;
}

export async function confirmCheckpoint({
  messageId,
  conversationId,
  userId,
}: ConfirmCheckpointOptions): Promise<{
  success: boolean;
  error?: string;
  componentId?: string;
}> {
  const admin = createAdminClient();

  try {
    // 1. Load the message with checkpoint data
    const { data: message, error: msgError } = await admin
      .from("messages")
      .select("content, checkpoint_meta")
      .eq("id", messageId)
      .single();

    if (msgError || !message?.checkpoint_meta) {
      return { success: false, error: "Checkpoint not found." };
    }

    const meta = message.checkpoint_meta as {
      layer: number;
      type: "component" | "pattern";
      name: string | null;
      status: string;
      composed_content: string | null;
      composed_name: string | null;
      changelog: string | null;
    };

    if (meta.status !== "pending") {
      return { success: false, error: "Checkpoint already resolved." };
    }

    // Use pre-composed content from Sage's manual entry block (Path A).
    // When composed_content is null (Path B — classifier detected checkpoint but
    // Sage didn't compose), make a follow-up API call to compose a proper entry.
    let contentToWrite = meta.composed_content;
    let nameToWrite = meta.composed_name || meta.name || "Untitled";

    if (!contentToWrite) {
      // Path B: compose entry via follow-up API call
      const [historyResult, extractionResult] = await Promise.all([
        admin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(10),
        admin
          .from("conversations")
          .select("extraction_state")
          .eq("id", conversationId)
          .single(),
      ]);

      const history = historyResult.data || [];
      const extractionState = extractionResult.data?.extraction_state as ExtractionState | null;
      const languageBank = extractionState?.language_bank || [];

      const composed = await composeManualEntry({
        checkpointText: message.content,
        conversationHistory: history,
        languageBank,
        layer: meta.layer,
        type: meta.type,
      });

      if (composed) {
        contentToWrite = composed.content;
        nameToWrite = composed.name;
        meta.changelog = composed.changelog;
        meta.composed_content = composed.content;
        meta.composed_name = composed.name;
      } else {
        // Last resort fallback: strip crisis resources and use message content
        const CRISIS_RESOURCES_PATTERN =
          "\n\nIf you're in crisis or need immediate support, please reach out to";
        let fallback = message.content;
        const crisisIdx = fallback.indexOf(CRISIS_RESOURCES_PATTERN);
        if (crisisIdx !== -1) {
          fallback = fallback.substring(0, crisisIdx).trimEnd();
        }
        contentToWrite = fallback;
        console.warn("[confirmCheckpoint] Composition failed, falling back to message content");
      }
    }

    // 2. Check for existing content on this layer
    const { data: existingComponents } = await admin
      .from("manual_components")
      .select("id, layer, type, name, content")
      .eq("user_id", userId)
      .eq("layer", meta.layer);

    const existingComponent = (existingComponents || []).find(
      (c) => c.type === meta.type
    );
    const existingPatterns = (existingComponents || []).filter(
      (c) => c.type === "pattern"
    );

    // Safety net: reject second component on same layer.
    // The call-sage hard guard should prevent this, but defend in depth.
    let forcedToPattern = false;
    if (meta.type === "component" && existingComponent) {
      console.warn(
        `[confirmCheckpoint] Blocked duplicate component on layer ${meta.layer}. Existing id=${existingComponent.id}. Forcing to pattern.`
      );
      meta.type = "pattern";
      forcedToPattern = true;
    }

    let componentId: string | null = null;

    if (forcedToPattern || (meta.type === "pattern" && !existingComponent)) {
      // Adding a new pattern (layer may have a component but no matching pattern)
      if (existingPatterns.length >= 2) {
        // Max 2 patterns per layer — replace the oldest one
        const oldest = existingPatterns.sort(
          (a, b) => a.id.localeCompare(b.id)
        )[0];

        // Archive before replacing
        if (meta.changelog) {
          await admin.from("manual_changelog").insert({
            user_id: userId,
            component_id: oldest.id,
            layer: oldest.layer,
            type: oldest.type,
            name: oldest.name,
            previous_content: oldest.content,
            new_content: contentToWrite,
            change_description: meta.changelog,
            conversation_id: conversationId,
          });
        }

        await admin
          .from("manual_components")
          .update({
            name: nameToWrite,
            content: contentToWrite,
            source_message_id: messageId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", oldest.id);

        componentId = oldest.id;
      } else {
        // Room for a new pattern
        const { data: newComp } = await admin
          .from("manual_components")
          .insert({
            user_id: userId,
            layer: meta.layer,
            type: "pattern",
            name: nameToWrite,
            content: contentToWrite,
            source_message_id: messageId,
          })
          .select("id")
          .single();

        componentId = newComp?.id || null;
      }
    } else if (existingComponent) {
      // Replacing existing component or pattern — archive first
      if (meta.changelog) {
        await admin.from("manual_changelog").insert({
          user_id: userId,
          component_id: existingComponent.id,
          layer: existingComponent.layer,
          type: existingComponent.type,
          name: existingComponent.name,
          previous_content: existingComponent.content,
          new_content: contentToWrite,
          change_description: meta.changelog,
          conversation_id: conversationId,
        });
      }

      await admin
        .from("manual_components")
        .update({
          name: nameToWrite,
          content: contentToWrite,
          source_message_id: messageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingComponent.id);

      componentId = existingComponent.id;
    } else {
      // Fresh layer, create new
      const { data: newComp } = await admin
        .from("manual_components")
        .insert({
          user_id: userId,
          layer: meta.layer,
          type: meta.type,
          name: nameToWrite,
          content: contentToWrite,
          source_message_id: messageId,
        })
        .select("id")
        .single();

      componentId = newComp?.id || null;
    }

    // 3. Update checkpoint status
    await admin
      .from("messages")
      .update({
        checkpoint_meta: { ...meta, status: "confirmed" },
      })
      .eq("id", messageId);

    // 3b. Update extraction state based on checkpoint type
    const { data: convData } = await admin
      .from("conversations")
      .select("extraction_state")
      .eq("id", conversationId)
      .single();

    if (convData?.extraction_state) {
      const extractionState = convData.extraction_state as ExtractionState;

      if (meta.type === "component") {
        // After component confirmation, flip discovery_mode to "pattern"
        // so extraction layer starts looking for patterns on this layer.
        const layer = extractionState.layers[meta.layer];
        if (layer) {
          layer.discovery_mode = "pattern";
          layer.signal = "explored";
        }
      } else if (meta.type === "pattern") {
        // After pattern confirmation, archive chain_elements to confirmed_patterns
        // and reset pattern_tracking for the next pattern.
        if (extractionState.pattern_tracking?.active) {
          const cp = {
            layer: meta.layer,
            name: nameToWrite,
            chain_elements: extractionState.pattern_tracking.chain_elements || [],
          };
          if (!extractionState.confirmed_patterns) {
            extractionState.confirmed_patterns = [];
          }
          extractionState.confirmed_patterns.push(cp);

          // Reset pattern_tracking
          extractionState.pattern_tracking = {
            active: false,
            layer: null,
            label: "",
            chain_elements: [],
            recurrence_count: 0,
          };
        }
      }

      await admin
        .from("conversations")
        .update({ extraction_state: extractionState })
        .eq("id", conversationId);
    }

    // 4. Insert system message
    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "system",
      content: "[User confirmed the checkpoint]",
    });

    return { success: true, componentId: componentId || undefined };
  } catch (err) {
    console.error("[confirmCheckpoint] Error:", err);
    return { success: false, error: "Something went wrong." };
  }
}
