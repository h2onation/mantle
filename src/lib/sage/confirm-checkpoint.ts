import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { insertCheckpointActionMessage } from "@/lib/sage/sage-pipeline";
import type { ExtractionState } from "@/lib/sage/extraction";
import { LAYER_NAMES } from "@/lib/manual/layers";

// ─── Manual entry composition (Sonnet) ─────────────────────────────────────

interface ComposeManualEntryOptions {
  checkpointText: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  languageBank: { phrase: string; context: string; charge: string }[];
  layer: number;
  type: "component" | "pattern";
  name: string | null;
  existingLayerContent?: { type: string; name: string | null; content: string }[];
}

/**
 * Calls Sonnet to compose a polished manual entry from a checkpoint reflection.
 * Used when Sage didn't produce an inline |||MANUAL_ENTRY||| block (Path B).
 * Returns null on failure — caller should fall back gracefully.
 */
export async function composeManualEntry(
  options: ComposeManualEntryOptions
): Promise<{ content: string; name: string; changelog: string } | null> {
  const {
    checkpointText,
    conversationHistory,
    languageBank,
    layer,
    type,
    name,
    existingLayerContent,
  } = options;

  const chargedLanguage = languageBank
    .filter((e) => e.charge === "high" || e.charge === "medium")
    .slice(-10);

  const languageSection =
    chargedLanguage.length > 0
      ? `\nUSER'S OWN LANGUAGE (use these exact phrases where they carry weight):\n${chargedLanguage.map((e) => `"${e.phrase}" — re: ${e.context}`).join("\n")}\n`
      : "";

  const existingSection =
    existingLayerContent && existingLayerContent.length > 0
      ? `\nEXISTING CONTENT ON THIS LAYER (your entry must account for this):\n${existingLayerContent.map((c) => `[${c.type}${c.name ? ` — "${c.name}"` : ""}]\n${c.content}`).join("\n\n")}\n\nIntegrate with or deepen existing content. If new material contradicts it, name the tension.\n`
      : "";

  // Last 8 messages for context
  const recentHistory = conversationHistory.slice(-8);
  const historyText = recentHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const system = `You compose manual entries for a self-authored behavioral model built by a late-diagnosed autistic adult. You receive a checkpoint reflection from a conversationalist called Sage and the recent conversation. Your job is to distill this into a polished manual entry that reads as a mirror, not a case note.

AUDIENCE VOICE:
The reader is the user themselves, re-reading later. They are often AuDHD, often late-diagnosed, and allergic to language that sounds like a diagnosis. Write to someone who has spent their life being described in the wrong vocabulary and is finally getting to hold a description that sounds like them.

RULES:
- Written in second person ("You...")
- No session references ("you told me," "you came in talking about," "in this conversation"). The entry reads the same six months from now.
- Use the user's exact charged phrases verbatim where they carry weight. Their sensory and system words ("buzzing," "too loud," "shut down," "went offline," "full," "tight," "crashed," "too close," "heavy") carry into the entry without translation. Do not upgrade their vocabulary.
- Grounded in their specific examples and moments. Not abstract.
- Somatic anchor REQUIRED. If the user described a body sensation or system state (anywhere in the conversation), it must appear in the entry. No entry is complete without it. The body is the evidence the mechanism is real.
- Components: 150-250 words. Dense, flowing prose. No bullet points. Every sentence earns its place.
- MINIMUM LENGTH: Components must be at least 150 words. If your draft is shorter, expand with more specific detail from the conversation — concrete examples, mechanism descriptions, body responses. Do not pad with filler.
- Patterns: 80-150 words. Structured around the loop: trigger → body/internal → response → payoff → cost. Even in compressed form, the body must appear somewhere in the chain.
- Talk to them about their life and their body, not about their traits. Not a case note. A mirror.
- No clinical framework names. No "schema," "attachment style," "dysregulation," "sensory processing disorder," "executive dysfunction," "rejection sensitive dysphoria," "avoidance," "trauma response." Describe the behavior and the body instead. "You shut down" not "you dissociate." "A second version of you switches on" not "you mask." "The room got too loud" not "sensory overwhelm."
- No time references. No "right now," "currently," "at this stage," "these days." The entry describes how they operate, period.
- Name the bind. Not just what they do, but why they can't stop, and what doing it costs them.

Also generate a headline name (4-8 words). Flatly descriptive — says what the mechanism IS in behavioral or body terms. Good: 'Second Version Switches On in Rooms,' 'Voice Goes When Pressure Lands,' 'Buzzing That Pulls Focus Away.' Bad: 'The Masking Loop,' 'The Sensory Trap,' 'Rejection Sensitivity.' No metaphors. No clinical labels. Just describe what happens.

Respond with ONLY valid JSON. No markdown. No backticks.
{"content": "The composed narrative...", "name": "The Headline Name", "changelog": "One sentence describing what this adds or changes."}`;

  const userContent = `Layer: ${layer} (${LAYER_NAMES[layer] || "Unknown"})
Type: ${type}
${name ? `Proposed name: "${name}"` : "No name proposed — choose one."}
${languageSection}${existingSection}
RECENT CONVERSATION:
${historyText}

SAGE'S CHECKPOINT REFLECTION:
${checkpointText}

Compose the manual entry.`;

  const response = await anthropicFetch({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const cleaned = rawText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.content || typeof parsed.content !== "string") {
    return null;
  }

  return {
    content: parsed.content,
    name: parsed.name || name || "Untitled",
    changelog: parsed.changelog || `Created Layer ${layer} ${type}.`,
  };
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

    // Use pre-composed content from Sage's manual entry block.
    // Falls back to the conversational checkpoint text if composition wasn't produced.
    // When falling back, strip any crisis resources text that may have been appended
    // by the crisis detection system (prevents contamination of manual entries).
    const CRISIS_RESOURCES_PATTERN =
      "\n\nIf you're in crisis or need immediate support, please reach out to";
    let fallbackContent = message.content;
    if (!meta.composed_content && fallbackContent) {
      const crisisIdx = fallbackContent.indexOf(CRISIS_RESOURCES_PATTERN);
      if (crisisIdx !== -1) {
        fallbackContent = fallbackContent.substring(0, crisisIdx).trimEnd();
      }
    }
    const contentToWrite = meta.composed_content || fallbackContent;
    const nameToWrite = meta.composed_name || meta.name || "Untitled";

    // 2. Check for existing content on this layer
    const { data: existingComponents } = await admin
      .from("manual_components")
      .select("id, layer, type, name, content, created_at")
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
    if (meta.type === "component" && existingComponent) {
      console.warn(
        `[confirmCheckpoint] Blocked duplicate component on layer ${meta.layer}. Existing id=${existingComponent.id}. Forcing to pattern.`
      );
      meta.type = "pattern";
    }

    let componentId: string | null = null;

    if (meta.type === "pattern" && !existingComponent) {
      // Adding a new pattern (layer may have a component but no matching pattern)
      if (existingPatterns.length >= 2) {
        // Max 2 patterns per layer — replace the oldest one
        const oldest = existingPatterns.sort(
          (a, b) => (a.created_at || "").localeCompare(b.created_at || "")
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

    // 4. Insert system message (shared helper — single source of truth)
    await insertCheckpointActionMessage(admin, conversationId, "confirmed");

    return { success: true, componentId: componentId || undefined };
  } catch (err) {
    console.error("[confirmCheckpoint] Error:", err);
    return { success: false, error: "Something went wrong." };
  }
}
