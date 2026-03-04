import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock anthropicFetch before importing the module
const mockAnthropicFetch = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  anthropicFetch: (...args: unknown[]) => mockAnthropicFetch(...args),
}));

// Mock Supabase admin before importing the module
const mockChain: Record<string, unknown> = {};
let callLog: { table: string; method: string; args?: unknown[] }[] = [];
let tableResponses: Record<string, { data: unknown; error: unknown }> = {};
// Response queue for tests that need ordered responses across multiple table reads
let responseQueue: { data: unknown; error: unknown }[] = [];

function resetMockChain() {
  callLog = [];
  tableResponses = {};
  responseQueue = [];

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
  mockChain.order = vi.fn(() => mockChain);
  mockChain.limit = vi.fn(() => mockChain);
  mockChain.single = vi.fn(() => {
    if (responseQueue.length > 0) {
      return Promise.resolve(responseQueue.shift());
    }
    return Promise.resolve(
      tableResponses[currentTable] || { data: null, error: null }
    );
  });
  // Make the chain thenable for non-.single() queries
  mockChain.then = vi.fn((resolve: (v: unknown) => void) => {
    if (responseQueue.length > 0) {
      return Promise.resolve(responseQueue.shift()).then(resolve);
    }
    return Promise.resolve(
      tableResponses[currentTable] || { data: null, error: null }
    ).then(resolve);
  });
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockChain,
}));

// Import AFTER mock is set up
import { confirmCheckpoint, composeManualEntry } from "@/lib/sage/confirm-checkpoint";

beforeEach(() => {
  resetMockChain();
  mockAnthropicFetch.mockReset();
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
    // Should NOT call anthropicFetch when composed_content is present
    expect(mockAnthropicFetch).not.toHaveBeenCalled();
  });

  it("composes entry via API when composed_content is null (Path B)", async () => {
    // Use response queue for ordered multi-table reads
    responseQueue = [
      // 1. Load checkpoint message
      {
        data: {
          content: "I see a pattern in how you handle conflict. You retreat into silence...",
          checkpoint_meta: {
            layer: 3,
            type: "component",
            name: "The Retreat",
            status: "pending",
            composed_content: null,
            composed_name: null,
            changelog: null,
          },
        },
        error: null,
      },
      // 2. Load conversation history (Promise.all result 1)
      {
        data: [
          { role: "user", content: "When my partner criticizes me I just shut down" },
          { role: "assistant", content: "Tell me more about what shutting down looks like." },
        ],
        error: null,
      },
      // 3. Load extraction state (Promise.all result 2)
      {
        data: {
          extraction_state: {
            language_bank: [
              { phrase: "just shut down", context: "conflict response", charge: "high" },
            ],
          },
        },
        error: null,
      },
      // 4. Load existing manual_components
      { data: [], error: null },
      // 5. Insert into manual_components
      { data: { id: "comp-1" }, error: null },
      // 6. Update checkpoint status (messages.update)
      { data: null, error: null },
      // 7. Load extraction state for post-confirm update
      { data: { extraction_state: { layers: { 3: { signal: "explored", discovery_mode: "component" } } } }, error: null },
      // 8. Update extraction state
      { data: null, error: null },
      // 9. Insert system message
      { data: null, error: null },
    ];

    // Mock the composition API call
    mockAnthropicFetch.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: '|||MANUAL_ENTRY|||\n{"layer": 3, "type": "component", "name": "The Retreat", "content": "When conflict arrives, you disappear. Not physically — you go quiet. Your partner raises something and the words leave you. You described it as shutting down, and that is exactly what it is: a system-level shutdown that routes all your real responses underground.", "changelog": "Created Layer 3 component: retreat as conflict response."}\n|||END_MANUAL_ENTRY|||',
      }],
    });

    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(true);

    // Verify anthropicFetch was called for composition
    expect(mockAnthropicFetch).toHaveBeenCalledTimes(1);

    // Verify the composed content was written (not the raw conversation text)
    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.content).toContain("When conflict arrives, you disappear");
    expect(insertData.content).not.toContain("I see a pattern"); // Not the raw checkpoint text
  });

  it("falls back to message.content when composition API fails", async () => {
    responseQueue = [
      // 1. Load checkpoint message
      {
        data: {
          content: "Raw checkpoint conversation text",
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
      },
      // 2. Conversation history
      { data: [], error: null },
      // 3. Extraction state
      { data: { extraction_state: null }, error: null },
      // 4. Existing components
      { data: [], error: null },
      // 5. Insert manual_components
      { data: { id: "comp-1" }, error: null },
      // 6. Update checkpoint status
      { data: null, error: null },
      // 7. Load extraction state for post-confirm
      { data: { extraction_state: null }, error: null },
      // 8. Update extraction state
      { data: null, error: null },
      // 9. System message
      { data: null, error: null },
    ];

    // Mock API failure
    mockAnthropicFetch.mockRejectedValueOnce(new Error("API timeout"));

    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(true);

    // Should fall back to message.content
    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.content).toBe("Raw checkpoint conversation text");
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

  it("forces duplicate component to pattern and inserts new row (not overwriting component)", async () => {
    // Simulate: layer 2 already has a component, and a new "component" checkpoint arrives
    responseQueue = [
      // 1. Load checkpoint message (meta.type = "component")
      {
        data: {
          content: "Second observation about self-perception",
          checkpoint_meta: {
            layer: 2,
            type: "component",
            name: "Second Component",
            status: "pending",
            composed_content: "Composed pattern content",
            composed_name: "Forced Pattern Name",
            changelog: "Should become a pattern",
          },
        },
        error: null,
      },
      // 2. Load existing manual_components for layer 2 (has a component already)
      {
        data: [
          { id: "existing-comp-1", layer: 2, type: "component", name: "original component", content: "Original layer 2 content" },
        ],
        error: null,
      },
      // 3. Insert new pattern (not update!)
      { data: { id: "new-pattern-1" }, error: null },
      // 4. Update checkpoint status
      { data: null, error: null },
      // 5. Load extraction state
      { data: { extraction_state: { layers: { 2: { signal: "explored", discovery_mode: "pattern" } }, pattern_tracking: { active: false } } }, error: null },
      // 6. Update extraction state
      { data: null, error: null },
      // 7. System message
      { data: null, error: null },
    ];

    const result = await confirmCheckpoint(baseOptions);
    expect(result.success).toBe(true);

    // Should INSERT a new pattern, not UPDATE the existing component
    const insertCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "insert"
    );
    expect(insertCall).toBeDefined();
    const insertData = (insertCall!.args as [Record<string, unknown>])[0];
    expect(insertData.type).toBe("pattern"); // Forced from "component" to "pattern"
    expect(insertData.content).toBe("Composed pattern content");

    // Should NOT have any update to manual_components (component should be untouched)
    const updateCall = callLog.find(
      (c) => c.table === "manual_components" && c.method === "update"
    );
    expect(updateCall).toBeUndefined();
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

describe("composeManualEntry", () => {
  it("parses a valid composition response", async () => {
    mockAnthropicFetch.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: '|||MANUAL_ENTRY|||\n{"layer": 1, "type": "component", "name": "The Shield", "content": "You protect yourself by never asking for what you need.", "changelog": "Created Layer 1 component."}\n|||END_MANUAL_ENTRY|||',
      }],
    });

    const result = await composeManualEntry({
      checkpointText: "Some checkpoint text",
      conversationHistory: [{ role: "user", content: "test" }],
      languageBank: [{ phrase: "never ask", context: "needs", charge: "high" }],
      layer: 1,
      type: "component",
    });

    expect(result).not.toBeNull();
    expect(result!.content).toBe("You protect yourself by never asking for what you need.");
    expect(result!.name).toBe("The Shield");
    expect(result!.changelog).toBe("Created Layer 1 component.");
  });

  it("returns null when API response has no manual entry block", async () => {
    mockAnthropicFetch.mockResolvedValueOnce({
      content: [{ type: "text", text: "Some random text without delimiters" }],
    });

    const result = await composeManualEntry({
      checkpointText: "test",
      conversationHistory: [],
      languageBank: [],
      layer: 1,
      type: "component",
    });

    expect(result).toBeNull();
  });

  it("returns null when API call fails", async () => {
    mockAnthropicFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await composeManualEntry({
      checkpointText: "test",
      conversationHistory: [],
      languageBank: [],
      layer: 1,
      type: "component",
    });

    expect(result).toBeNull();
  });
});
