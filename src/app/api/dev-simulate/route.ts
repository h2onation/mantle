export const runtime = "edge";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { callSage, mapSystemMessages } from "@/lib/sage/call-sage";
import { confirmCheckpoint } from "@/lib/sage/confirm-checkpoint";
import {
  generateSimulatedUserMessage,
  parseCheckpointIntent,
} from "@/lib/sage/simulate-user";

/**
 * Consume a callSage ReadableStream internally, extracting the full text
 * and the message_complete event data.
 */
async function consumeSageStream(stream: ReadableStream): Promise<{
  fullText: string;
  messageId: string | null;
  checkpoint: {
    isCheckpoint: boolean;
    layer: number;
    type: string;
    name: string | null;
  } | null;
  processingText: string | null;
  cleanContent: string | null;
}> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let messageId: string | null = null;
  let checkpoint: {
    isCheckpoint: boolean;
    layer: number;
    type: string;
    name: string | null;
  } | null = null;
  let processingText: string | null = null;
  let cleanContent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);

      try {
        const event = JSON.parse(data);
        if (event.type === "text_delta") {
          fullText += event.text;
        } else if (event.type === "message_complete") {
          messageId = event.messageId;
          checkpoint = event.checkpoint;
          processingText = event.processingText;
          cleanContent = event.cleanContent || null;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return { fullText, messageId, checkpoint, processingText, cleanContent };
}

export async function POST(request: Request) {
  const { userId, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse body
  let personaDescription = "";
  let checkpointTarget = 1;
  try {
    const body = await request.json();
    if (body.personaDescription && typeof body.personaDescription === "string") {
      personaDescription = body.personaDescription.trim();
    }
    if (
      body.checkpointTarget &&
      typeof body.checkpointTarget === "number" &&
      body.checkpointTarget >= 1
    ) {
      checkpointTarget = body.checkpointTarget;
    }
  } catch {
    // Invalid JSON
  }

  if (!personaDescription) {
    return Response.json(
      { error: "personaDescription is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const encoder = new TextEncoder();

  function emit(
    controller: ReadableStreamDefaultController,
    event: Record<string, unknown>
  ) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 0. Clean slate: delete all existing user data before simulation
        await admin.from("manual_changelog").delete().eq("user_id", userId);
        await admin.from("manual_components").delete().eq("user_id", userId);
        const { data: existingConvs } = await admin
          .from("conversations")
          .select("id")
          .eq("user_id", userId);
        if (existingConvs && existingConvs.length > 0) {
          const convIds = existingConvs.map((c: { id: string }) => c.id);
          await admin.from("messages").delete().in("conversation_id", convIds);
          await admin.from("conversations").delete().eq("user_id", userId);
        }

        // 1. Create conversation
        const { data: conv, error: convError } = await admin
          .from("conversations")
          .insert({ user_id: userId })
          .select("id")
          .single();

        if (convError || !conv) {
          emit(controller, {
            type: "error",
            message: "Failed to create conversation",
          });
          controller.close();
          return;
        }

        const conversationId = conv.id;

        emit(controller, {
          type: "started",
          conversationId,
        });

        // 2. Main simulation loop
        let confirmedCount = 0;
        let turn = 0;
        const MAX_TURNS = 40;

        while (turn < MAX_TURNS && confirmedCount < checkpointTarget) {
          turn++;

          // Read conversation history from DB
          const { data: dbMessages } = await admin
            .from("messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

          const history = mapSystemMessages(
            (dbMessages || []) as { role: string; content: string }[]
          );

          // Generate simulated user message
          const userMessage = await generateSimulatedUserMessage(
            personaDescription,
            history
          );

          // Natural session end: Haiku decided the conversation is over.
          if (userMessage.trim() === "[END]") {
            emit(controller, {
              type: "turn",
              turn,
              conversationId,
              preview: "[END]",
            });
            break;
          }

          emit(controller, {
            type: "turn",
            turn,
            conversationId,
            preview:
              userMessage.length > 80
                ? userMessage.slice(0, 80) + "..."
                : userMessage,
          });

          // Call Sage with the simulated user's message
          const sageStream = callSage({
            conversationId,
            userId: userId,
            message: userMessage,
          });

          const result = await consumeSageStream(sageStream);

          emit(controller, {
            type: "turn_complete",
            turn,
            conversationId,
            hasCheckpoint: !!(result.checkpoint?.isCheckpoint && result.checkpoint.layer),
          });

          // Checkpoint handling
          if (result.checkpoint?.isCheckpoint && result.checkpoint.layer) {
            // Re-read history from DB (now includes this turn's messages)
            const { data: updatedMessages } = await admin
              .from("messages")
              .select("role, content")
              .eq("conversation_id", conversationId)
              .order("created_at", { ascending: true });

            const updatedHistory = mapSystemMessages(
              (updatedMessages || []) as { role: string; content: string }[]
            );

            // Generate checkpoint response from simulated user
            const cpResponse = await generateSimulatedUserMessage(
              personaDescription,
              updatedHistory,
              true // isCheckpointResponse
            );

            // Parse intent
            const action = parseCheckpointIntent(cpResponse);

            if (action === "confirmed") {
              // Confirm: upsert to manual, archive, insert system message
              if (result.messageId) {
                await confirmCheckpoint({
                  messageId: result.messageId,
                  conversationId,
                  userId: userId,
                });
              }
              confirmedCount++;

              // Get Sage's follow-up response
              const followUpStream = callSage({
                conversationId,
                userId: userId,
                message: null,
              });
              await consumeSageStream(followUpStream);
            } else {
              // Reject or refine: update meta, insert system message
              if (result.messageId) {
                const { data: cpMsg } = await admin
                  .from("messages")
                  .select("checkpoint_meta")
                  .eq("id", result.messageId)
                  .single();

                if (cpMsg?.checkpoint_meta) {
                  await admin
                    .from("messages")
                    .update({
                      checkpoint_meta: {
                        ...(cpMsg.checkpoint_meta as Record<string, unknown>),
                        status: action,
                      },
                    })
                    .eq("id", result.messageId);
                }
              }

              // Insert system message
              const systemContent =
                action === "rejected"
                  ? "[User rejected the checkpoint]"
                  : "[User wants to refine the checkpoint]";

              await admin.from("messages").insert({
                conversation_id: conversationId,
                role: "system",
                content: systemContent,
              });

              // Get Sage's follow-up to the rejection/refinement
              const followUpStream = callSage({
                conversationId,
                userId: userId,
                message: null,
              });
              await consumeSageStream(followUpStream);
            }

            emit(controller, {
              type: "checkpoint",
              turn,
              layer: result.checkpoint.layer,
              name: result.checkpoint.name,
              action,
              conversationId,
              checkpointNumber:
                action === "confirmed" ? confirmedCount : confirmedCount,
            });

            if (confirmedCount >= checkpointTarget) break;
          }
        }

        emit(controller, {
          type: "complete",
          conversationId,
          totalTurns: turn,
          totalCheckpoints: confirmedCount,
        });
        controller.close();
      } catch (err) {
        console.error("[dev-simulate] Error:", err);
        emit(controller, {
          type: "error",
          message: err instanceof Error ? err.message : "Simulation failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
