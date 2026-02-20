export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callSage } from "@/lib/sage/call-sage";

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, conversationId } = (await request.json()) as {
      message: string | null;
      conversationId: string | null;
    };

    // 2. Create or use existing conversation
    const admin = createAdminClient();
    let convId: string = conversationId || "";
    if (!convId) {
      // Ensure profile exists (FK target for conversations)
      await admin
        .from("profiles")
        .upsert(
          { id: user.id, display_name: user.email?.split("@")[0] || "User" },
          { onConflict: "id", ignoreDuplicates: true }
        );

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

    // 3. Stream response
    const stream = callSage({
      conversationId: convId,
      userId: user.id,
      message,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
