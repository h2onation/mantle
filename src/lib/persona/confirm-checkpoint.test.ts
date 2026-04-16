import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chain supports:
//   .from(table).select(...).eq(...).single() → returns tableResponses[table]
//   .rpc(name, params) → returns rpcResponse (with call logged)
const mockChain: Record<string, unknown> = {};
let callLog: {
  table?: string;
  rpc?: string;
  method: string;
  args?: unknown[];
}[] = [];
let tableResponses: Record<string, { data: unknown; error: unknown }> = {};
let rpcResponse: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};

function resetMockChain() {
  callLog = [];
  tableResponses = {};
  rpcResponse = { data: null, error: null };

  let currentTable = "";

  mockChain.from = vi.fn((table: string) => {
    currentTable = table;
    callLog.push({ table, method: "from" });
    return mockChain;
  });
  mockChain.select = vi.fn((...args: unknown[]) => {
    callLog.push({ table: currentTable, method: "select", args });
    return mockChain;
  });
  mockChain.eq = vi.fn((...args: unknown[]) => {
    callLog.push({ table: currentTable, method: "eq", args });
    return mockChain;
  });
  mockChain.single = vi.fn(() => {
    return Promise.resolve(
      tableResponses[currentTable] || { data: null, error: null }
    );
  });
  mockChain.rpc = vi.fn((name: string, params: unknown) => {
    callLog.push({ rpc: name, method: "rpc", args: [params] });
    return Promise.resolve(rpcResponse);
  });
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockChain,
}));

// Import AFTER mock is set up
import { confirmCheckpoint } from "@/lib/persona/confirm-checkpoint";

beforeEach(() => {
  resetMockChain();
});

function rpcArgs(): Record<string, unknown> | undefined {
  const call = callLog.find(
    (c) => c.rpc === "confirm_checkpoint_write" && c.method === "rpc"
  );
  if (!call) return undefined;
  return (call.args as [Record<string, unknown>])[0];
}

describe("confirmCheckpoint", () => {
  const baseOptions = {
    messageId: "msg-1",
    conversationId: "conv-1",
    userId: "user-1",
  };

  const pendingMessage = {
    content: "Fallback content",
    checkpoint_meta: {
      layer: 1,
      name: "Test name",
      status: "pending",
      composed_content: "Polished composed content",
      composed_name: "Composed name",
      changelog: null,
      composed_summary: null,
      composed_key_words: null,
    },
  };

  it("returns error when the checkpoint message is missing", async () => {
    tableResponses.messages = { data: null, error: { message: "not found" } };
    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint not found.");
    // RPC should NOT be invoked if we couldn't read the message.
    expect(rpcArgs()).toBeUndefined();
  });

  it("returns error when the message has no checkpoint_meta", async () => {
    tableResponses.messages = {
      data: { content: "text", checkpoint_meta: null },
      error: null,
    };
    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint not found.");
    expect(rpcArgs()).toBeUndefined();
  });

  it("passes composed_content to the RPC when present", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    const result = await confirmCheckpoint(baseOptions);

    expect(result.success).toBe(true);
    expect(result.componentId).toBe("entry-1");
    expect(result.wasAlreadyConfirmed).toBe(false);
    const args = rpcArgs();
    expect(args).toBeDefined();
    expect(args!.p_content).toBe("Polished composed content");
    expect(args!.p_name).toBe("Composed name");
    expect(args!.p_layer).toBe(1);
  });

  it("falls back to message.content when composed_content is null", async () => {
    tableResponses.messages = {
      data: {
        content: "Fallback conversational text",
        checkpoint_meta: {
          ...pendingMessage.checkpoint_meta,
          composed_content: null,
          composed_name: null,
        },
      },
      error: null,
    };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint(baseOptions);

    const args = rpcArgs();
    expect(args!.p_content).toBe("Fallback conversational text");
  });

  it("defaults name to 'Untitled' when composed_name and meta.name are both null", async () => {
    tableResponses.messages = {
      data: {
        content: "text",
        checkpoint_meta: {
          ...pendingMessage.checkpoint_meta,
          composed_content: "content",
          composed_name: null,
          name: null,
        },
      },
      error: null,
    };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint(baseOptions);

    const args = rpcArgs();
    expect(args!.p_name).toBe("Untitled");
  });

  it("strips crisis resources from fallback content before passing to RPC", async () => {
    const crisisTail =
      "\n\nIf you're in crisis or need immediate support, please reach out to 988";
    tableResponses.messages = {
      data: {
        content: "Real checkpoint body." + crisisTail,
        checkpoint_meta: {
          ...pendingMessage.checkpoint_meta,
          composed_content: null,
        },
      },
      error: null,
    };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint(baseOptions);

    const args = rpcArgs();
    expect(args!.p_content).toBe("Real checkpoint body.");
    expect(args!.p_content).not.toContain("crisis");
  });

  it("returns idempotent success when RPC reports was_already_confirmed", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: [{ entry_id: "existing-entry", was_already_confirmed: true }],
      error: null,
    };

    const result = await confirmCheckpoint(baseOptions);

    expect(result.success).toBe(true);
    expect(result.componentId).toBe("existing-entry");
    expect(result.wasAlreadyConfirmed).toBe(true);
  });

  it("maps RPC checkpoint_not_found error to user-facing 'Checkpoint not found.'", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: null,
      error: {
        message:
          'P0002: checkpoint_not_found CONTEXT: PL/pgSQL function confirm_checkpoint_write',
      },
    };

    const result = await confirmCheckpoint(baseOptions);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint not found.");
  });

  it("maps RPC checkpoint_not_pending error to 'Checkpoint was rejected or refined.'", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: null,
      error: {
        message: "P0001: checkpoint_not_pending",
      },
    };

    const result = await confirmCheckpoint(baseOptions);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint was rejected or refined.");
  });

  it("returns generic failure on unexpected RPC errors", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: null,
      error: { message: "connection refused" },
    };

    const result = await confirmCheckpoint(baseOptions);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to write entry to manual.");
  });

  it("returns failure when RPC returns no entry id (defensive)", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: [{ entry_id: null, was_already_confirmed: false }],
      error: null,
    };

    const result = await confirmCheckpoint(baseOptions);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to write entry to manual.");
  });

  it("passes composed summary + key_words to the RPC when present", async () => {
    tableResponses.messages = {
      data: {
        content: "text",
        checkpoint_meta: {
          ...pendingMessage.checkpoint_meta,
          composed_summary: "Short summary sentence.",
          composed_key_words: ["alpha", "beta", "gamma"],
        },
      },
      error: null,
    };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint(baseOptions);

    const args = rpcArgs();
    expect(args!.p_summary).toBe("Short summary sentence.");
    expect(args!.p_key_words).toEqual(["alpha", "beta", "gamma"]);
  });

  it("derives summary from content when composed_summary is missing", async () => {
    tableResponses.messages = {
      data: {
        content: "text",
        checkpoint_meta: {
          ...pendingMessage.checkpoint_meta,
          composed_content: "First sentence here. Second sentence follows.",
          composed_summary: null,
        },
      },
      error: null,
    };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint(baseOptions);

    const args = rpcArgs();
    expect(args!.p_summary).toBe("First sentence here.");
  });

  it("passes null for key_words when composed_key_words is empty or missing", async () => {
    tableResponses.messages = {
      data: {
        content: "text",
        checkpoint_meta: {
          ...pendingMessage.checkpoint_meta,
          composed_key_words: [],
        },
      },
      error: null,
    };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint(baseOptions);

    const args = rpcArgs();
    expect(args!.p_key_words).toBeNull();
  });
});
