export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callSage } from "@/lib/sage/call-sage";
import { confirmCheckpoint } from "@/lib/sage/confirm-checkpoint";

// All 10 pre-scripted messages are available; the simulation loops through
// them all, stopping when the target number of checkpoints is reached.

// Pre-scripted user messages — written to progressively deepen the conversation
// and give the classifier enough signal to detect a pattern checkpoint.
const USER_MESSAGES = [
  // Turn 1: Opening — sets the topic with enough depth
  `I've been noticing something about myself lately that I can't quite figure out. At work, whenever I'm in a meeting and someone challenges my idea, I go completely silent. Not because I don't have a response — I usually do — but something stops me. It happened again yesterday: my team lead questioned a design I'd spent three days on, and instead of walking through my reasoning, I just said "yeah, that's a fair point" and moved on. Later I stayed up until 2am redoing the whole thing alone. My partner says I do something similar at home — if we disagree about something, I'll just drop it in the moment and then quietly do what I was going to do anyway. I want to understand what's actually happening in those moments.`,

  // Turn 2: Responds to Sage's likely first probe about what happens internally
  `Honestly, in that moment with my team lead, there was this flash of heat in my chest — almost like embarrassment, but sharper. Like being caught. Not caught doing something wrong, but caught caring. I think what scared me most wasn't that he'd think my design was bad, but that he'd see how much I'd invested in it. If I defend it and he still rejects it, then he knows it mattered to me and I still lost. But if I just say "fair point" and walk away, I get to keep the appearance of not caring that much. The 2am redo is the real tell, I think — I clearly care deeply, I just can't let anyone see it.`,

  // Turn 3: Goes deeper on the pattern, connects work + home
  `That's a good question. With my partner it's different but also the same? Like last week she wanted to rearrange the living room and I had a really clear sense of how I wanted it, but when she showed me her plan I just said "sure, looks great." Then over the next few days I quietly moved things around when she wasn't home. She noticed and called me out on it. I think in both cases — work and home — there's this belief that if I express what I want directly and get pushback, something bad happens. Not just that I lose the argument, but that the other person sees me as difficult. Demanding. My mom used to say "you're so easy" as a compliment, and I think I've never stopped trying to earn that.`,

  // Turn 4: Names the feeling more precisely, shows emotional honesty
  `You're right, it's not really about the specific design or the furniture layout. It's about being seen as someone who has needs. When I say "fair point" in that meeting, I'm protecting this image of myself as the person who doesn't need anything from anyone. The one who's agreeable, competent, handles things quietly. But there's this growing resentment underneath — I notice it most with my team lead because he actually respects people who push back. The cruel irony is that my strategy of disappearing is the thing that's undermining me. I got passed over for a project lead role last month and I'm pretty sure it's because no one knows what I actually think about anything.`,

  // Turn 5: Connects to origin, vulnerable admission
  `I keep coming back to something from when I was maybe eleven. My parents were going through a rough patch and fighting a lot. I remember one night I asked if we could get pizza for dinner — just a normal kid request — and my dad snapped at me, said "can you not make everything about you right now?" I don't think I asked for anything directly for years after that. I became the kid who never caused problems, never had needs, never took up space. And people loved that version of me. Teachers, friends, my parents after the divorce — everyone kept telling me how mature I was, how easy, how low-maintenance. I think I learned that having visible needs makes you a burden, and being invisible keeps you safe.`,

  // Turn 6: Synthesis moment — realization, naming the pattern
  `Yeah... I think you're onto something. It's not actually conflict avoidance — that's the surface behavior. What I'm actually doing is identity protection. I've built this whole self around being "the easy one" and any moment where I assert a need or defend a position threatens that identity. The silence in meetings, the "fair point," doing the work alone at 2am, rearranging furniture when my partner isn't looking — it's all the same thing. I'm choosing to be invisible because visibility means potentially being seen as difficult, and being difficult means... I guess, being unlovable? That's hard to say out loud. The design thing with my team lead wasn't about the design at all. It was about not wanting him to see me as someone who needs approval.`,

  // Turn 7: Deepening further if needed
  `What strikes me is how automatic it is. I didn't choose to go silent in that meeting — it just happened, like a reflex. The decision to defend myself doesn't even make it to the conscious level. My body just... shuts the channel. And then the rational part of my brain constructs a story about why it's fine: "he had a good point," "it's not worth fighting over," "I can just fix it myself." But now I'm seeing those as coverups for what's actually happening, which is fear. Raw fear that if I'm visible with my needs, I'll be told again that I'm making everything about me.`,

  // Turns 8-10: Additional depth if simulation goes long
  `I think the hardest part is that the strategy actually works in the short term. People do find me easy to work with. My partner doesn't have to deal with conflict. My team lead isn't annoyed. But it's like I'm slowly erasing myself to keep everyone comfortable, and the resentment just builds quietly until it comes out sideways — like the passive furniture rearranging, or staying up until 2am to prove I was right without having to say it. It's exhausting to maintain.`,

  `Something shifted for me just now. I've been describing this pattern as a problem to solve, but I think it's actually been my primary survival strategy for twenty years. No wonder I can't just "stop doing it." It's how I've kept every important relationship intact — or at least, that's what it feels like. The real question isn't "how do I stop going silent" — it's "can I be visible and still be safe?" And I genuinely don't know the answer to that yet.`,

  `When you frame it that way — that I'm trading authenticity for safety — I feel this weird mix of sadness and relief. Sad because I can see how much it's cost me. The project lead role, the distance from my partner, the feeling of being fundamentally unknown by the people closest to me. But relief because at least now I can see the machine running. I'm not broken or weak. I'm running a very sophisticated protection program that made total sense for an eleven-year-old whose dad told him his needs were too much. It just doesn't serve me anymore.`,
];

/**
 * Consume a callSage ReadableStream internally, extracting the full text
 * and the message_complete event data.
 */
async function consumeSageStream(stream: ReadableStream): Promise<{
  fullText: string;
  messageId: string | null;
  checkpoint: { isCheckpoint: boolean; layer: number; type: string; name: string | null } | null;
  processingText: string | null;
  cleanContent: string | null;
}> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let messageId: string | null = null;
  let checkpoint: { isCheckpoint: boolean; layer: number; type: string; name: string | null } | null = null;
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional body param: how many checkpoints to reach before stopping.
  // The simulation auto-confirms all checkpoints before the Nth one,
  // then stops at the Nth checkpoint for manual action.
  let targetCheckpoints = 1;
  try {
    const body = await request.json();
    if (body.checkpoints && typeof body.checkpoints === "number" && body.checkpoints >= 1) {
      targetCheckpoints = body.checkpoints;
    }
  } catch {
    // No body or invalid JSON — use default
  }

  const admin = createAdminClient();
  const encoder = new TextEncoder();

  function emit(
    controller: ReadableStreamDefaultController,
    event: Record<string, unknown>
  ) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Create conversation
        const { data: conv, error: convError } = await admin
          .from("conversations")
          .insert({ user_id: user!.id })
          .select("id")
          .single();

        if (convError || !conv) {
          emit(controller, { type: "error", message: "Failed to create conversation" });
          controller.close();
          return;
        }

        const conversationId = conv.id;

        // Emit started event immediately so client can switch tabs
        emit(controller, {
          type: "started",
          conversationId,
        });

        // 2. Loop through pre-scripted messages, counting checkpoints
        let checkpointCount = 0;

        for (let turn = 1; turn <= USER_MESSAGES.length; turn++) {
          const userMessage = USER_MESSAGES[turn - 1];

          emit(controller, {
            type: "turn",
            turn,
            conversationId,
            preview: userMessage.slice(0, 80) + "...",
          });

          // Call Sage
          const sageStream = callSage({
            conversationId,
            userId: user!.id,
            message: userMessage,
          });

          const result = await consumeSageStream(sageStream);

          emit(controller, {
            type: "turn_complete",
            turn,
            conversationId,
            processingText: result.processingText,
            hasCheckpoint: !!result.checkpoint,
          });

          // Check for checkpoint
          if (result.checkpoint?.isCheckpoint && result.checkpoint.layer) {
            checkpointCount++;

            if (checkpointCount >= targetCheckpoints) {
              // Target reached — stop here for manual action
              emit(controller, {
                type: "checkpoint",
                turn,
                layer: result.checkpoint.layer,
                name: result.checkpoint.name,
                conversationId,
                checkpointNumber: checkpointCount,
              });
              emit(controller, {
                type: "complete",
                conversationId,
                totalTurns: turn,
                totalCheckpoints: checkpointCount,
              });
              controller.close();
              return;
            }

            // Auto-confirm this checkpoint and continue
            emit(controller, {
              type: "checkpoint_auto_confirmed",
              turn,
              layer: result.checkpoint.layer,
              name: result.checkpoint.name,
              checkpointNumber: checkpointCount,
            });

            // Use confirmCheckpoint utility (handles composed content,
            // changelog archiving, pattern support, and system message)
            if (result.messageId) {
              await confirmCheckpoint({
                messageId: result.messageId,
                conversationId,
                userId: user!.id,
              });
            }
          }
        }

        // Hit max messages without reaching target checkpoints
        emit(controller, {
          type: "complete",
          conversationId,
          totalTurns: USER_MESSAGES.length,
          totalCheckpoints: checkpointCount,
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
