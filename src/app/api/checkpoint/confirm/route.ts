export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callSage } from "@/lib/sage/call-sage";

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { messageId, action, conversationId } = (await request.json()) as {
    messageId: string;
    action: "confirmed" | "rejected" | "refined";
    conversationId: string;
  };

  // 2. Load and verify the message
  const { data: msg, error: msgError } = await admin
    .from("messages")
    .select("id, conversation_id, content, is_checkpoint, checkpoint_meta")
    .eq("id", messageId)
    .single();

  if (msgError || !msg) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Verify conversation belongs to this user
  const { data: conv } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", msg.conversation_id)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!msg.is_checkpoint) {
    return Response.json(
      { error: "Message is not a checkpoint" },
      { status: 400 }
    );
  }

  // 3. Update checkpoint_meta.status
  const updatedMeta = { ...msg.checkpoint_meta, status: action };
  const { error: metaUpdateError } = await admin
    .from("messages")
    .update({ checkpoint_meta: updatedMeta })
    .eq("id", messageId);

  if (metaUpdateError) {
    console.error("[confirm] Error updating checkpoint_meta:", metaUpdateError);
  }

  // 4. Handle action
  let systemContent: string;

  if (action === "confirmed") {
    const { layer, type, name } = msg.checkpoint_meta as {
      layer: number;
      type: "component" | "pattern";
      name: string | null;
      status: string;
    };

    // Normalize name
    const normalizedName = name ? name.toLowerCase().trim() : null;

    // Save to manual_components (select-then-insert/update for partial indexes)
    const componentType = type === "component" ? "component" : "pattern";

    let existingQuery = admin
      .from("manual_components")
      .select("id")
      .eq("user_id", user.id)
      .eq("layer", layer)
      .eq("type", componentType);

    if (componentType === "pattern") {
      existingQuery = normalizedName
        ? existingQuery.eq("name", normalizedName)
        : existingQuery.is("name", null);
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) {
      console.error("[confirm] Error checking existing component:", existingError);
    }

    if (existing) {
      const { error: updateError } = await admin
        .from("manual_components")
        .update({
          content: msg.content,
          source_message_id: messageId,
          name: normalizedName,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[confirm] Error updating manual_components:", updateError);
      }
    } else {
      const { error: insertError } = await admin.from("manual_components").insert({
        user_id: user.id,
        layer,
        type: componentType,
        name: normalizedName,
        content: msg.content,
        source_message_id: messageId,
      });

      if (insertError) {
        console.error("[confirm] Error inserting manual_components:", insertError);
      }
    }

    systemContent = "[User confirmed the checkpoint]";
  } else if (action === "rejected") {
    systemContent = "[User rejected the checkpoint]";
  } else {
    systemContent = "[User wants to refine the checkpoint]";
  }

  // 5. Insert system message
  await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "system",
    content: systemContent,
  });

  // 6. Call Sage and return streaming response
  const stream = callSage({
    conversationId,
    userId: user.id,
    message: null,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
