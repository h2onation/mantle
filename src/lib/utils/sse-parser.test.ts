import { describe, it, expect, vi } from "vitest";
import { parseSSEStream } from "@/lib/utils/sse-parser";

function createMockResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

describe("parseSSEStream", () => {
  describe("basic event parsing", () => {
    it("calls onTextDelta for text_delta events", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const response = createMockResponse([
        'data: {"type":"text_delta","text":"Hello"}\n',
      ]);

      await parseSSEStream(response, { onTextDelta, onMessageComplete });

      expect(onTextDelta).toHaveBeenCalledWith("Hello");
      expect(onTextDelta).toHaveBeenCalledTimes(1);
    });

    it("calls onMessageComplete for message_complete events", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const response = createMockResponse([
        'data: {"type":"message_complete","messageId":"abc","conversationId":"xyz","checkpoint":null,"processingText":"listening..."}\n',
      ]);

      await parseSSEStream(response, { onTextDelta, onMessageComplete });

      expect(onMessageComplete).toHaveBeenCalledWith({
        type: "message_complete",
        messageId: "abc",
        conversationId: "xyz",
        checkpoint: null,
        processingText: "listening...",
      });
      expect(onMessageComplete).toHaveBeenCalledTimes(1);
    });

    it("calls onError for error events", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const onError = vi.fn();
      const response = createMockResponse([
        'data: {"type":"error","message":"Something broke"}\n',
      ]);

      await parseSSEStream(response, {
        onTextDelta,
        onMessageComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith("Something broke");
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple events in a single chunk", () => {
    it("parses two events from one chunk", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const response = createMockResponse([
        'data: {"type":"text_delta","text":"Hello "}\ndata: {"type":"text_delta","text":"world"}\n',
      ]);

      await parseSSEStream(response, { onTextDelta, onMessageComplete });

      expect(onTextDelta).toHaveBeenCalledTimes(2);
      expect(onTextDelta).toHaveBeenNthCalledWith(1, "Hello ");
      expect(onTextDelta).toHaveBeenNthCalledWith(2, "world");
    });
  });

  describe("event split across chunks", () => {
    it("buffers partial lines and parses when complete", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const response = createMockResponse([
        'data: {"type":"text_del',
        'ta","text":"split"}\n',
      ]);

      await parseSSEStream(response, { onTextDelta, onMessageComplete });

      expect(onTextDelta).toHaveBeenCalledWith("split");
      expect(onTextDelta).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("skips lines that don't start with 'data: '", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const response = createMockResponse([
        "\n",
        ": this is a comment\n",
        'data: {"type":"text_delta","text":"kept"}\n',
      ]);

      await parseSSEStream(response, { onTextDelta, onMessageComplete });

      expect(onTextDelta).toHaveBeenCalledTimes(1);
      expect(onTextDelta).toHaveBeenCalledWith("kept");
    });

    it("silently skips malformed JSON without throwing or calling onError", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const onError = vi.fn();
      const response = createMockResponse([
        "data: not-json\n",
        'data: {"type":"text_delta","text":"after"}\n',
      ]);

      await parseSSEStream(response, {
        onTextDelta,
        onMessageComplete,
        onError,
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onTextDelta).toHaveBeenCalledTimes(1);
      expect(onTextDelta).toHaveBeenCalledWith("after");
    });

    it("passes cleanContent in message_complete events", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const response = createMockResponse([
        'data: {"type":"message_complete","messageId":"m1","conversationId":"c1","checkpoint":null,"processingText":"tracking","cleanContent":"stripped text"}\n',
      ]);

      await parseSSEStream(response, { onTextDelta, onMessageComplete });

      expect(onMessageComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanContent: "stripped text",
        })
      );
    });
  });

  describe("stall watchdog (2026-07-01 hung-opener incident)", () => {
    /** A stream that delivers `chunks`, then hangs forever without closing —
     *  the shape of the incident: message delivered, close never arrives. */
    function createHangingResponse(chunks: string[]): Response {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          // Deliberately never controller.close() — the connection hangs.
        },
      });
      return new Response(stream);
    }

    it("resolves { stalled: true } instead of hanging forever", async () => {
      const onMessageComplete = vi.fn();
      const response = createHangingResponse([
        'data: {"type":"message_complete","messageId":"m1","conversationId":"c1","checkpoint":null,"processingText":"listening..."}\n',
      ]);

      const result = await parseSSEStream(
        response,
        { onTextDelta: vi.fn(), onMessageComplete },
        { stallTimeoutMs: 50 }
      );

      // The delivered event still parsed; the hang resolved as a stall.
      expect(onMessageComplete).toHaveBeenCalledTimes(1);
      expect(result.stalled).toBe(true);
    });

    it("a stall does NOT invoke onError (the caller decides)", async () => {
      const onError = vi.fn();
      const response = createHangingResponse([]);

      const result = await parseSSEStream(
        response,
        { onTextDelta: vi.fn(), onMessageComplete: vi.fn(), onError },
        { stallTimeoutMs: 50 }
      );

      expect(result.stalled).toBe(true);
      expect(onError).not.toHaveBeenCalled();
    });

    it("a healthy stream resolves { stalled: false }", async () => {
      const response = createMockResponse([
        'data: {"type":"text_delta","text":"ok"}\n',
      ]);
      const result = await parseSSEStream(
        response,
        { onTextDelta: vi.fn(), onMessageComplete: vi.fn() },
        { stallTimeoutMs: 5000 }
      );
      expect(result.stalled).toBe(false);
    });
  });

  describe("no response body", () => {
    it("calls onError with 'No response body' when body is null", async () => {
      const onTextDelta = vi.fn();
      const onMessageComplete = vi.fn();
      const onError = vi.fn();
      const response = { body: null } as unknown as Response;

      await parseSSEStream(response, {
        onTextDelta,
        onMessageComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith("No response body");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onTextDelta).not.toHaveBeenCalled();
      expect(onMessageComplete).not.toHaveBeenCalled();
    });
  });
});
