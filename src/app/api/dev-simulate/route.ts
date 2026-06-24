export const runtime = "edge";

import { requireAdmin } from "@/lib/admin/verify-admin";
import { callPersona, mapSystemMessages } from "@/lib/persona/call-persona";
import { generateSimulatedUserMessage } from "@/lib/persona/simulate-user";
import { parseSSEStream } from "@/lib/utils/sse-parser";
import {
  CONVERSATION_MODES,
  type ConversationMode,
} from "@/lib/persona/config";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import { isPersonaMode } from "@/lib/persona/persona-mode-toggle";

/**
 * Consume a callPersona ReadableStream internally, extracting the full text
 * and the message_complete event data.
 */
async function consumePersonaStream(stream: ReadableStream): Promise<{
  fullText: string;
  messageId: string | null;
  checkpoint: {
    isCheckpoint: boolean;
    section: string | null;
    tags?: string[];
    name: string | null;
  } | null;
  processingText: string | null;
  cleanContent: string | null;
}> {
  let fullText = "";
  let messageId: string | null = null;
  let checkpoint: {
    isCheckpoint: boolean;
    section: string | null;
    tags?: string[];
    name: string | null;
  } | null = null;
  let processingText: string | null = null;
  let cleanContent: string | null = null;
  let streamError: string | null = null;

  await parseSSEStream(new Response(stream), {
    onTextDelta: (text) => {
      fullText += text;
    },
    onMessageComplete: (event) => {
      messageId = event.messageId;
      checkpoint = event.checkpoint;
      processingText = event.processingText;
      cleanContent = event.cleanContent || null;
    },
    onError: (msg) => {
      streamError = msg;
    },
  });

  if (streamError) throw new Error(streamError);
  return { fullText, messageId, checkpoint, processingText, cleanContent };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { userId, admin } = auth;

  // Parse body. `checkpointTarget` is accepted for backwards compatibility
  // with the client but ignored — the simulation now always exits at the first
  // checkpoint and leaves it in `status: "pending"` so the user can drive the
  // real confirm UI themselves.
  let simulatedUserDescription = "";
  let personaModesOverride: PersonaMode[] | undefined;
  let intakeMode: ConversationMode | undefined;
  try {
    const body = await request.json();
    if (body.simulatedUserDescription && typeof body.simulatedUserDescription === "string") {
      simulatedUserDescription = body.simulatedUserDescription.trim();
    }
    if (Array.isArray(body.personaModes)) {
      if (!body.personaModes.every(isPersonaMode)) {
        return Response.json(
          { error: "personaModes contains invalid value" },
          { status: 400 }
        );
      }
      if (body.personaModes.length > 0) {
        personaModesOverride = body.personaModes as PersonaMode[];
      }
    }
    if (typeof body.mode === "string") {
      if (!(CONVERSATION_MODES as readonly string[]).includes(body.mode)) {
        return Response.json(
          { error: "mode must be one of: " + CONVERSATION_MODES.join(", ") },
          { status: 400 }
        );
      }
      intakeMode = body.mode as ConversationMode;
    }
  } catch {
    // Invalid JSON
  }

  if (!simulatedUserDescription) {
    return Response.json(
      { error: "simulatedUserDescription is required" },
      { status: 400 }
    );
  }

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
        // 1. Create a fresh conversation for the simulation. Existing manual
        //    entries, changelog, messages, and other conversations are left
        //    untouched — use /api/dev-reset if you need a clean-slate wipe.
        const { data: conv, error: convError } = await admin
          .from("conversations")
          .insert({
            user_id: userId,
            ...(intakeMode ? { mode: intakeMode } : {}),
          })
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

        // 2. Main simulation loop — runs until the first checkpoint fires,
        //    then exits with that checkpoint left in `status: "pending"`.
        //    Previously this auto-confirmed via confirmCheckpoint() and looped
        //    until N checkpoints were confirmed; that made dev-simulate a
        //    test-harness shortcut that bypassed the real /api/checkpoint/confirm
        //    path (and caused "Checkpoint already resolved" 500s when the user
        //    then tried to confirm manually through the UI).
        let turn = 0;
        let checkpointReached = false;
        const MAX_TURNS = 40;

        while (turn < MAX_TURNS && !checkpointReached) {
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
            simulatedUserDescription,
            history
          );

          // Natural session end: Haiku decided the conversation is over.
          // Lenient detection — Haiku sometimes includes [END] at the tail
          // of a longer goodbye line ("I will. Thanks. [END]"). Exact-match
          // would miss those and the loop would keep running, eventually
          // breaking character into an acknowledgment loop ("Standing by."
          // / "👋"). Substring catches both forms.
          if (userMessage.includes("[END]")) {
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

          // Call Jove with the simulated user's message
          const personaStream = callPersona({
            conversationId,
            userId: userId,
            message: userMessage,
            personaModesOverride,
          });

          const result = await consumePersonaStream(personaStream);

          emit(controller, {
            type: "turn_complete",
            turn,
            conversationId,
            hasCheckpoint: !!result.checkpoint?.isCheckpoint,
          });

          // Checkpoint reached — stop the simulation and hand off to the user.
          // The checkpoint message is left with status: "pending" (set by
          // callPersona), so the real UI confirm button drives the rest.
          if (result.checkpoint?.isCheckpoint) {
            emit(controller, {
              type: "checkpoint",
              turn,
              section: result.checkpoint.section,
              name: result.checkpoint.name,
              action: "pending",
              conversationId,
              checkpointNumber: 1,
            });
            checkpointReached = true;
          }
        }

        emit(controller, {
          type: "complete",
          conversationId,
          totalTurns: turn,
          totalCheckpoints: checkpointReached ? 1 : 0,
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
