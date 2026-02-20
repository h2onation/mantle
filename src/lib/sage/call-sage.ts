import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { classifyResponse } from "@/lib/sage/classifier";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface CallSageOptions {
  conversationId: string;
  userId: string;
  message: string | null;
}

export function callSage({
  conversationId,
  userId,
  message,
}: CallSageOptions): ReadableStream {
  const admin = createAdminClient();
  const convId = conversationId;

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // 1. Save user message if present
        let savedUserMessageId: string | null = null;
        if (message !== null) {
          const { data: savedMsg, error: msgError } = await admin
            .from("messages")
            .insert({
              conversation_id: convId,
              role: "user",
              content: message,
            })
            .select("id")
            .single();

          if (msgError || !savedMsg) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: "Failed to save message" })}\n\n`
              )
            );
            controller.close();
            return;
          }
          savedUserMessageId = savedMsg.id;
        }

        // 2. Load conversation history
        const { data: dbMessages } = await admin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        const history: { role: "user" | "assistant"; content: string }[] = [];
        if (dbMessages) {
          for (const msg of dbMessages) {
            if (msg.role === "system") {
              if (msg.content === "[User confirmed the checkpoint]") {
                history.push({
                  role: "user",
                  content: "I confirmed that checkpoint. That resonates.",
                });
              } else if (msg.content === "[User rejected the checkpoint]") {
                history.push({
                  role: "user",
                  content: "That checkpoint didn't land right for me.",
                });
              } else if (
                msg.content === "[User wants to refine the checkpoint]"
              ) {
                history.push({
                  role: "user",
                  content: "That's close but not quite right.",
                });
              }
            } else {
              history.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            }
          }
        }

        // 3. Apply sliding window: keep first 4 + last 46 if over 50
        let messages = history;
        if (messages.length > 50) {
          const first4 = messages.slice(0, 4);
          const last46 = messages.slice(-46);
          messages = [...first4, ...last46];
        }

        // If no messages (Sage speaks first), send synthetic opener
        if (messages.length === 0) {
          messages = [
            { role: "user", content: "[New session — deliver entry sequence]" },
          ];
        }

        // 4. Load manual components (user-level)
        const { data: manualComponents } = await admin
          .from("manual_components")
          .select("layer, type, name, content")
          .eq("user_id", userId);

        // 5. Check returning user status
        const isReturningUser =
          (manualComponents && manualComponents.length > 0) || false;

        let sessionSummary: string | null = null;
        let calibrationRatings: string | null = null;

        if (isReturningUser) {
          const { data: conv } = await admin
            .from("conversations")
            .select("summary, calibration_ratings")
            .eq("id", convId)
            .single();

          if (conv) {
            sessionSummary = conv.summary;
            calibrationRatings = conv.calibration_ratings;
          }
        }

        // 6. Build system prompt
        const systemPrompt = buildSystemPrompt(
          manualComponents || [],
          isReturningUser,
          sessionSummary,
          calibrationRatings
        );

        // 7. Stream Anthropic response
        let fullText = "";

        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text_delta", text })}\n\n`
              )
            );
          }
        }

        // 8. Save Sage's response
        const { data: savedResponse } = await admin
          .from("messages")
          .insert({
            conversation_id: convId,
            role: "assistant",
            content: fullText,
          })
          .select("id")
          .single();

        const messageId = savedResponse?.id || null;

        // 9. Run classifier
        const last4 = history.slice(-4);
        const recentText = last4
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n\n");

        const classification = await classifyResponse(fullText, recentText);

        // 10. Update message with checkpoint and processing text
        if (messageId) {
          const updateData: Record<string, unknown> = {
            processing_text: classification.processingText,
          };

          if (classification.isCheckpoint) {
            updateData.is_checkpoint = true;
            updateData.checkpoint_meta = {
              layer: classification.layer,
              type: classification.type,
              name: classification.name,
              status: "pending",
            };
          }

          await admin.from("messages").update(updateData).eq("id", messageId);
        }

        // 11. Check calibration ratings (user's first message)
        if (savedUserMessageId) {
          const { count } = await admin
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", convId)
            .eq("role", "user");

          if (count === 1) {
            await admin
              .from("conversations")
              .update({ calibration_ratings: message })
              .eq("id", convId);
          }
        }

        // 12. Emit final event
        const checkpoint = classification.isCheckpoint
          ? {
              isCheckpoint: true,
              layer: classification.layer,
              type: classification.type,
              name: classification.name,
            }
          : null;

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "message_complete",
              messageId,
              conversationId: convId,
              checkpoint,
              processingText: classification.processingText,
            })}\n\n`
          )
        );

        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              error: err instanceof Error ? err.message : "Unknown error",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });
}
