export const runtime = "edge";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
  const { message, conversationId } = (await request.json()) as {
    message: string | null;
    conversationId: string | null;
  };

  // 2. Create or use existing conversation
  let convId = conversationId;
  if (!convId) {
    const { data: conv, error: convError } = await admin
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id")
      .single();

    if (convError || !conv) {
      return Response.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }
    convId = conv.id;
  }

  // 3. Save user message if present
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
      return Response.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }
    savedUserMessageId = savedMsg.id;
  }

  // 4. Load conversation history
  const { data: dbMessages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  const history: { role: "user" | "assistant"; content: string }[] = [];
  if (dbMessages) {
    for (const msg of dbMessages) {
      if (msg.role === "system") {
        // Convert system checkpoint messages to user messages
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
        } else if (msg.content === "[User wants to refine the checkpoint]") {
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

  // Apply sliding window: keep first 4 + last 46 if over 50
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

  // 5. Load manual components (user-level)
  const { data: manualComponents } = await admin
    .from("manual_components")
    .select("layer, type, name, content")
    .eq("user_id", user.id);

  // 6. Check returning user status
  const isReturningUser = (manualComponents && manualComponents.length > 0) || false;

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

  // 7. Build system prompt
  const systemPrompt = buildSystemPrompt(
    manualComponents || [],
    isReturningUser,
    sessionSummary,
    calibrationRatings
  );

  // 8. Call Anthropic API
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // 9. Save Sage's response
  const { data: savedResponse } = await admin
    .from("messages")
    .insert({
      conversation_id: convId,
      role: "assistant",
      content: responseText,
    })
    .select("id")
    .single();

  // 10. Check if this was the user's first message (calibration ratings)
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

  // 11. Return response
  return Response.json({
    message: responseText,
    conversationId: convId,
    messageId: savedResponse?.id || null,
  });
}
