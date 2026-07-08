import type { ConversationMode } from "@/lib/persona/config";

// The former `checkpoint` payload field was removed 2026-07-06: the pull
// model composes entries via /api/checkpoint/compose (the reflection meter),
// so a live stream never proposes a checkpoint — the server had been sending
// checkpoint: null on every event since the push path was deleted.
export interface MessageCompleteEvent {
  messageId: string;
  conversationId: string;
  processingText: string;
  cleanContent?: string;
  promptAuth?: boolean;
  // Conversation mode at the time this message was emitted. Carried for
  // analytics so the client can attach mode to checkpoint and session-end
  // events without a separate fetch. Optional for backward compatibility
  // (treated as "situation" when missing).
  mode?: ConversationMode;
  // Guided-intake section picker trigger (tee-up turn). The five sections come
  // from layers.ts client-side; this boolean is just the "show it now" signal.
  sections?: boolean;
  // Guided-intake live-situation handoff: render the one-tap action that starts
  // a fresh situation conversation. Set only after the user accepts the offer.
  startSituationOffer?: boolean;
  // Reflection meter (user-pulled model). One nullable field: { fill, ready }
  // drives the meter. fill (0–100) is a CAPTURE-PROGRESS value computed
  // server-side — it resets after a save (the cooldown) and rebuilds, capped by
  // depth. ready = completion (drives the ready strip). null HIDES the meter and
  // clears any latched readiness (crisis). Absent (undefined) when the gate is off.
  reflectionMeter?: { fill: number; ready: boolean } | null;
}

interface SSECallbacks {
  onTextDelta: (text: string) => void;
  onMessageComplete: (data: MessageCompleteEvent) => void;
  onError?: (error: string) => void;
}

/** How long a stream may go with ZERO bytes before we treat it as hung.
 *  Generous on purpose: first-token latency on a cold turn can run 10–30s and
 *  the checkpoint split-delivery has a multi-second silent gap while the entry
 *  composes server-side. A healthy stream never goes a full minute silent; a
 *  hung one (dropped connection the browser never surfaces, proxy buffering)
 *  goes silent forever, leaving isStreaming stuck true until reload. Generic
 *  transport insurance only — the 2026-07-01 "locked composer" incident this
 *  was originally built for turned out to be a 0px textarea in ChatInput
 *  (fixed 2026-07-02), not a hung stream. */
const STALL_TIMEOUT_MS = 60_000;

export async function parseSSEStream(
  response: Response,
  callbacks: SSECallbacks,
  opts?: { stallTimeoutMs?: number }
): Promise<{ stalled: boolean }> {
  if (!response.body) {
    callbacks.onError?.("No response body");
    return { stalled: false };
  }

  const stallMs = opts?.stallTimeoutMs ?? STALL_TIMEOUT_MS;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stalled = false;

  // reader.read() with a no-bytes watchdog. Resolves "stall" if nothing
  // arrives within stallMs, so a hung connection can't suspend the caller
  // forever. The timer resets on every read (it races each read call).
  const readWithStallGuard = async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<"stall">((resolve) => {
          timeoutId = setTimeout(() => resolve("stall"), stallMs);
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    while (true) {
      const result = await readWithStallGuard();
      if (result === "stall") {
        stalled = true;
        // Best-effort teardown of the dead connection. The caller decides
        // whether this is an error (stalled mid-message) or a silent recovery
        // (the message already completed; only the close never arrived).
        try {
          await reader.cancel();
        } catch {
          // Connection already dead — nothing to release.
        }
        break;
      }
      const { done, value } = result;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "text_delta") {
            callbacks.onTextDelta(event.text);
          } else if (event.type === "message_complete") {
            callbacks.onMessageComplete(event);
          } else if (event.type === "error") {
            callbacks.onError?.(event.message || event.error || "Something went wrong.");
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } catch {
    callbacks.onError?.("Connection lost. Try again.");
  }

  return { stalled };
}
