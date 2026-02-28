import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase admin before importing the module
const mockChain: Record<string, unknown> = {};
let callLog: { table: string; method: string; args?: unknown[] }[] = [];
let tableResponses: Record<string, { data: unknown; error: unknown }> = {};

function resetMockChain() {
  callLog = [];
  tableResponses = {};

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
  mockChain.insert = vi.fn((data: unknown) => {
    callLog.push({ table: currentTable, method: "insert", args: [data] });
    return mockChain;
  });
  mockChain.update = vi.fn((data: unknown) => {
    callLog.push({ table: currentTable, method: "update", args: [data] });
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
  // Make the chain thenable for non-.single() queries
  mockChain.then = vi.fn((resolve: (v: unknown) => void) => {
    return Promise.resolve(
      tableResponses[currentTable] || { data: null, error: null }
    ).then(resolve);
  });
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockChain,
}));

// Import AFTER mock is set up
import { confirmCheckpoint } from "@/lib/sage/confirm-checkpoint";

beforeEach(() => {
  resetMockChain();
});

describe("confirmCheckpoint", () => {
  const baseOptions = {
    messageId: "msg-1",
    conversationId: "conv-1",
    userId: "user-1",
  };

  it("returns error when checkpoint not found", async () => {
    tableResponses.messages = { data: null, error: { message: "not found" } };
    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint not found.");
  });

  it("returns error when checkpoint already resolved", async () => {
    tableResponses.messages = {
      data: {
        content: "Some text",
        checkpoint_meta: {
          layer: 1,
          type: "component",
          name: "Test",
          status: "confirmed",
          composed_content: null,
          composed_name: null,
          changelog: null,
        },
      },
      error: null,
    };
    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint already resolved.");
  });

  it("uses composed_content over message.content when present", async () => {
    tableResponses.messages = {
      data: {
        content: "Fallback text",
        checkpoint_meta: {
          layer: 1,
          type: "component",
          name: "Test",
          status: "pending",
          composed_content: "Polished manual entry",
          composed_name: "Composed Name",
          changelog: null,
        },
      },
      error: null,
    };
    tableResponses.manual_components = { data: [], error: null };

    await confirmCheckpoint(baseOptions);

    // Find the insert call to manual_components
    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.content).toBe("Polished manual entry");
    expect(insertData.name).toBe("Composed Name");
  });

  it("falls back to message.content when composed_content is null", async () => {
    tableResponses.messages = {
      data: {
        content: "Conversational checkpoint text",
        checkpoint_meta: {
          layer: 2,
          type: "component",
          name: "Fallback Name",
          status: "pending",
          composed_content: null,
          composed_name: null,
          changelog: null,
        },
      },
      error: null,
    };
    tableResponses.manual_components = { data: [], error: null };

    await confirmCheckpoint(baseOptions);

    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.content).toBe("Conversational checkpoint text");
  });

  it("defaults name to 'Untitled' when both composed_name and meta.name are null", async () => {
    tableResponses.messages = {
      data: {
        content: "Some text",
        checkpoint_meta: {
          layer: 1,
          type: "component",
          name: null,
          status: "pending",
          composed_content: "Content",
          composed_name: null,
          changelog: null,
        },
      },
      error: null,
    };
    tableResponses.manual_components = { data: [], error: null };

    await confirmCheckpoint(baseOptions);

    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.name).toBe("Untitled");
  });

  it("inserts new component for fresh layer", async () => {
    tableResponses.messages = {
      data: {
        content: "Text",
        checkpoint_meta: {
          layer: 3,
          type: "component",
          name: "New Component",
          status: "pending",
          composed_content: "Fresh content",
          composed_name: "New Component",
          changelog: null,
        },
      },
      error: null,
    };
    tableResponses.manual_components = { data: [], error: null };

    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(true);

    // Should insert to manual_components (not update)
    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.layer).toBe(3);
    expect(insertData.type).toBe("component");
  });

  it("updates checkpoint_meta status to confirmed", async () => {
    tableResponses.messages = {
      data: {
        content: "Text",
        checkpoint_meta: {
          layer: 1,
          type: "component",
          name: "Test",
          status: "pending",
          composed_content: "Content",
          composed_name: "Test",
          changelog: null,
        },
      },
      error: null,
    };
    tableResponses.manual_components = { data: [], error: null };

    await confirmCheckpoint(baseOptions);

    // Find the update to messages table that sets status to confirmed
    const updateCalls = callLog.filter(
      (c) => c.table === "messages" && c.method === "update"
    );
    const statusUpdate = updateCalls.find((c) => {
      const data = (c.args as [Record<string, unknown>])[0];
      return (
        data.checkpoint_meta &&
        (data.checkpoint_meta as Record<string, unknown>).status === "confirmed"
      );
    });
    expect(statusUpdate).toBeDefined();
  });

  it("inserts system message after confirmation", async () => {
    tableResponses.messages = {
      data: {
        content: "Text",
        checkpoint_meta: {
          layer: 1,
          type: "component",
          name: "Test",
          status: "pending",
          composed_content: "Content",
          composed_name: "Test",
          changelog: null,
        },
      },
      error: null,
    };
    tableResponses.manual_components = { data: [], error: null };

    await confirmCheckpoint(baseOptions);

    // Find system message insert
    const systemMsgInsert = callLog.find((c) => {
      if (c.table !== "messages" || c.method !== "insert") return false;
      const data = (c.args as [Record<string, unknown>])[0];
      return data.role === "system";
    });
    expect(systemMsgInsert).toBeDefined();
    const data = (systemMsgInsert!.args as [Record<string, unknown>])[0];
    expect(data.content).toBe("[User confirmed the checkpoint]");
  });
});
