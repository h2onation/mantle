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
import { confirmCheckpoint, validateHeadline } from "@/lib/persona/confirm-checkpoint";

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

  it("uses editedContent over composed_content when edits are provided", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint({
      ...baseOptions,
      editedContent: "My edited version of the entry.",
    });

    const args = rpcArgs();
    expect(args!.p_content).toBe("My edited version of the entry.");
    expect(args!.p_summary).toBe("My edited version of the entry.");
    expect(args!.p_key_words).toBeNull();
  });

  it("uses editedName over composed_name when edits are provided", async () => {
    tableResponses.messages = { data: pendingMessage, error: null };
    rpcResponse = {
      data: [{ entry_id: "entry-1", was_already_confirmed: false }],
      error: null,
    };

    await confirmCheckpoint({
      ...baseOptions,
      editedName: "My Custom Title",
    });

    const args = rpcArgs();
    expect(args!.p_name).toBe("My Custom Title");
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

// ─── validateHeadline ──────────────────────────────────────────────────────
// Previously unexported + zero coverage (it gates every entry title).
// Exported + tested 2026-06-03 ahead of the user's-word verb carve-out.
describe("validateHeadline", () => {
  // Baseline structural rules (these existed before the carve-out).
  it("passes a clean trigger-shaped headline", () => {
    expect(validateHeadline("I Go Quiet When Someone Waits", false).ok).toBe(true);
  });

  it("fails when the subject is not 'I' (body-part / nominalization as agent)", () => {
    const r = validateHeadline("Stomach Pushes Me to Fix the Call", false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("subject is not 'I'");
  });

  it("now PASSES a behavioral title with no when/before/after trigger (2026-06-16: trigger check removed)", () => {
    const r = validateHeadline("I Reach for More Depth Than I Get Back", false);
    expect(r.ok).toBe(true);
    expect(r.hardFail).toBe(false);
  });

  it("hard-fails a feeling-state subject", () => {
    const r = validateHeadline("I Feel Alone When He Doesn't Reach Back", false);
    expect(r.ok).toBe(false);
    expect(r.hardFail).toBe(true);
    expect(r.reasons.join(" ")).toContain("feeling-state subject");
  });

  it("hard-fails a non-'I' scenario-noun subject (the prod-failure shape)", () => {
    const r = validateHeadline("The Decisions About Him Are Ones I Make Alone", false);
    expect(r.ok).toBe(false);
    expect(r.hardFail).toBe(true);
    expect(r.reasons.join(" ")).toContain("subject is not 'I'");
  });

  it("treats a missing single-example softener as SOFT, not hard (won't trigger a retry)", () => {
    const r = validateHeadline("I Steer Toward Problems When Friends Want to Chat", true);
    expect(r.ok).toBe(false);
    expect(r.hardFail).toBe(false);
    expect(r.reasons.join(" ")).toContain("softener");
  });

  it("fails a banned felt-state verb the user never said", () => {
    const r = validateHeadline("I Disappear When Nobody Needs Me", false, "i feel invisible at parties");
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("abstract/internal verb");
  });

  it("requires a softener on a single-example headline", () => {
    const r = validateHeadline("I Freeze When Asked What I Want", true);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("softener");
  });

  // The carve-out: the user's OWN exact felt-state phrase wins over the ban.
  it("ALLOWS a banned verb when it is the user's exact phrase", () => {
    const r = validateHeadline(
      "I Lose Myself When the Verdict Isn't In",
      false,
      "I'm such a people pleaser. I end up losing myself in the conversation. I lose myself."
    );
    expect(r.reasons.join(" ")).not.toContain("abstract/internal verb");
    expect(r.ok).toBe(true);
  });

  it("STILL bans the same verb when the user did not say it (regression guard)", () => {
    const r = validateHeadline(
      "I Lose Myself When the Verdict Isn't In",
      false,
      "I get nervous in rooms and check what people think of me"
    );
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("abstract/internal verb");
  });

  it("only the user-said verb is exempted, not every banned verb in the title", () => {
    // User said "lose myself" but not "fade"; a title using fade still fails.
    const r = validateHeadline(
      "I Fade When the Room Goes Quiet",
      false,
      "i lose myself around new people"
    );
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("abstract/internal verb");
  });

  it("defaults userText to empty (legacy callers): banned verbs stay banned", () => {
    const r = validateHeadline("I Lose Myself When Nobody Needs Me", false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toContain("abstract/internal verb");
  });
});
