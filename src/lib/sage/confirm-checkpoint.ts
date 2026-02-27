import { createAdminClient } from "@/lib/supabase/admin";

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
    const contentToWrite = meta.composed_content || message.content;
    const nameToWrite = meta.composed_name || meta.name || "Untitled";

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

    let componentId: string | null = null;

    if (meta.type === "pattern" && !existingComponent) {
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
