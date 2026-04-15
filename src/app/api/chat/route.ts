export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callPersona } from "@/lib/persona/call-persona";
import {
  chatAuthMinute,
  chatAuthDay,
  chatAnonMinute,
  chatAnonDay,
  checkLimits,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { PERSONA_NAME } from "@/lib/persona/config";

const MAX_MESSAGE_LENGTH = 4000;
const ANON_CHECKPOINT_LIMIT = 2;

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

    const { message, conversationId, explorationContext } = (await request.json()) as {
      message: string | null;
      conversationId: string | null;
      explorationContext?: {
        layerId: number;
        layerName: string;
        type: "entry" | "empty_layer";
        name?: string;
        content: string;
      };
    };

    // 1a. Message length check (cheapest, no external calls)
    if (typeof message === "string" && message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        {
          error:
            "Message is too long. Please keep messages under 4000 characters.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const isAnonymous = user.is_anonymous === true;

    // 1b. Anonymous checkpoint conversion gate (Gate B). Runs before any
    // rate limiter or Anthropic call so a converted-out anonymous user
    // never burns Upstash quota or API tokens.
    if (isAnonymous) {
      const { count } = await admin
        .from("manual_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count ?? 0) >= ANON_CHECKPOINT_LIMIT) {
        return Response.json({
          blocked: true,
          reason: "signup_required",
          message: `You've started building your manual. Create an account to keep what you've built and continue with ${PERSONA_NAME}.`,
        });
      }
    }

    // 1c. Rate limit check (Upstash). Per-minute + per-day; both must pass.
    const limiters = isAnonymous
      ? [chatAnonMinute, chatAnonDay]
      : [chatAuthMinute, chatAuthDay];
    const limitResult = await checkLimits(limiters, user.id);
    if (!limitResult.success) {
      return rateLimitedResponse(limitResult);
    }

    // 2. Create or use existing conversation
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
    const stream = callPersona({
      conversationId: convId,
      userId: user.id,
      message,
      explorationContext,
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
