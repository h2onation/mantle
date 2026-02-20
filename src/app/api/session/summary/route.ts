export const runtime = "edge";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = (await request.json()) as {
    conversationId: string;
  };

  const admin = createAdminClient();

  // Verify conversation belongs to this user
  const { data: conv } = await admin
    .from("conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Load all messages
  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) {
    return Response.json({ summary: "" });
  }

  // Format as readable transcript
  const transcript = messages
    .map((m) => {
      const label =
        m.role === "user" ? "User" : m.role === "assistant" ? "Sage" : "System";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");

  // Generate summary via Haiku
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system:
      "Summarize this conversation between a user and Sage (an AI building behavioral models). Focus on: topics explored, what the user revealed, checkpoints confirmed, what was left unresolved. Keep under 300 words. This summary will be injected into Sage's context next session.",
    messages: [{ role: "user", content: transcript }],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save to conversation
  await admin
    .from("conversations")
    .update({ summary })
    .eq("id", conversationId);

  return Response.json({ summary });
}
