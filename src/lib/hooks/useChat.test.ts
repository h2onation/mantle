import { describe, it, expect } from "vitest";
import { buildChatMessageFromEvent } from "./useChat";
import type { MessageCompleteEvent } from "@/lib/utils/sse-parser";

// Regression test for the 2026-05-15 trigger-card bug. A pending
// checkpoint streamed live arrived with `checkpoint: {...}` in the SSE
// payload, but the in-memory ChatMessage was being appended with only
// {role, content, id} — dropping `isCheckpoint` and `checkpointMeta`.
// MobileSession's render switch then fell through to plain-bubble
// rendering, the structured proposal text (Layer name, headline,
// validation CTA) appeared inline, and the trigger card never showed.
// This helper now guarantees those fields are set when the event
// carries a checkpoint payload.

function baseEvent(): MessageCompleteEvent {
  return {
    type: "message_complete",
    messageId: "msg-1",
    conversationId: "conv-1",
    checkpoint: null,
    processingText: "",
  };
}

describe("buildChatMessageFromEvent", () => {
  it("returns a plain assistant message when checkpoint is null", () => {
    const result = buildChatMessageFromEvent(
      { ...baseEvent(), checkpoint: null },
      "Hello there."
    );
    expect(result).toEqual({
      role: "assistant",
      content: "Hello there.",
      id: "msg-1",
    });
    expect(result.isCheckpoint).toBeUndefined();
    expect(result.checkpointMeta).toBeUndefined();
  });

  it("sets isCheckpoint=true and checkpointMeta when checkpoint payload present", () => {
    const event: MessageCompleteEvent = {
      ...baseEvent(),
      checkpoint: {
        isCheckpoint: true,
        layer: 2,
        name: "Voice Goes When Pressure Lands",
        refinement_count: 0,
        composed_content: "The polished entry text.",
      },
    };
    const result = buildChatMessageFromEvent(event, "Long reflection here.");
    expect(result.isCheckpoint).toBe(true);
    expect(result.checkpointMeta).toEqual({
      layer: 2,
      name: "Voice Goes When Pressure Lands",
      status: "pending",
      refinement_count: 0,
    });
    expect(result.id).toBe("msg-1");
    expect(result.content).toBe("Long reflection here.");
  });

  it("inherits refinement_count from the checkpoint payload", () => {
    const event: MessageCompleteEvent = {
      ...baseEvent(),
      checkpoint: {
        isCheckpoint: true,
        layer: 1,
        name: "Test",
        refinement_count: 2,
        composed_content: "",
      },
    };
    const result = buildChatMessageFromEvent(event, "x");
    expect(result.checkpointMeta?.refinement_count).toBe(2);
  });

  it("defaults refinement_count to 0 when missing on payload", () => {
    const event: MessageCompleteEvent = {
      ...baseEvent(),
      checkpoint: {
        isCheckpoint: true,
        layer: 1,
        name: null,
        composed_content: "",
      },
    };
    const result = buildChatMessageFromEvent(event, "x");
    expect(result.checkpointMeta?.refinement_count).toBe(0);
  });

  it("status is always 'pending' for newly-streamed checkpoints", () => {
    // The server only emits the checkpoint payload on the create-turn,
    // so by definition status is pending. Historical checkpoints come
    // through DB load with their real status, not through this helper.
    const event: MessageCompleteEvent = {
      ...baseEvent(),
      checkpoint: {
        isCheckpoint: true,
        layer: 3,
        name: "x",
        composed_content: "",
      },
    };
    expect(buildChatMessageFromEvent(event, "x").checkpointMeta?.status).toBe(
      "pending"
    );
  });
});
