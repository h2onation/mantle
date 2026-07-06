import { describe, it, expect, vi } from "vitest";
import {
  buildChatMessageFromEvent,
  createStartGuard,
  pendingCheckpointFromMessages,
  type StartGuard,
} from "./useChat";
import type { MessageCompleteEvent } from "@/lib/utils/sse-parser";

// A streamed message_complete always becomes a plain assistant bubble —
// capture is pull-only, so the event carries no checkpoint payload (the
// field was removed 2026-07-06). Checkpoint messages enter via the
// compose/confirm path and DB reload, never this helper.

function baseEvent(): MessageCompleteEvent {
  return {
    messageId: "msg-1",
    conversationId: "conv-1",
    processingText: "",
  };
}

describe("buildChatMessageFromEvent", () => {
  it("returns a plain assistant message", () => {
    const result = buildChatMessageFromEvent(baseEvent(), "Hello there.");
    expect(result).toEqual({
      role: "assistant",
      content: "Hello there.",
      id: "msg-1",
    });
    expect(result.isCheckpoint).toBeUndefined();
    expect(result.checkpointMeta).toBeUndefined();
  });
});

// Regression tests for the session-resume dead-end (flow-review #A): a user
// who closed the app while a checkpoint proposal was on screen came back to an
// inert card with no confirm/reject/refine affordance, because the resume path
// never re-derived the active checkpoint. This helper is the shared source of
// truth for every conversation-load path: resume, loadConversation, and
// switchConversation (the drawer picker, which had the same dead-end bug).
describe("pendingCheckpointFromMessages", () => {
  it("returns null for an empty message list", () => {
    expect(pendingCheckpointFromMessages([])).toBeNull();
  });

  it("returns null when the last message is not a checkpoint", () => {
    expect(
      pendingCheckpointFromMessages([
        { id: "m1", content: "hi", is_checkpoint: false, checkpoint_meta: null },
      ])
    ).toBeNull();
  });

  it("returns null when the last checkpoint is already resolved (status != pending)", () => {
    expect(
      pendingCheckpointFromMessages([
        {
          id: "m1",
          content: "reflection",
          is_checkpoint: true,
          checkpoint_meta: { section: "work-money", name: "X", status: "confirmed" },
        },
      ])
    ).toBeNull();
  });

  it("re-activates a pending checkpoint on the last message (prefers composed name)", () => {
    const result = pendingCheckpointFromMessages([
      { id: "earlier", content: "...", is_checkpoint: false },
      {
        id: "m2",
        content: "the reflection text",
        is_checkpoint: true,
        checkpoint_meta: {
          section: "routines-structure",
          name: "Raw name",
          composed_name: "Polished Name",
          composed_content: "polished entry",
          status: "pending",
        },
      },
    ]);
    expect(result).toEqual({
      messageId: "m2",
      section: "routines-structure",
      tags: [],
      name: "Polished Name",
      content: "the reflection text",
      composedContent: "polished entry",
    });
  });

  // Drawer-switch regression (2026-06-12): switchConversation selects rows
  // with a `channel` column that the resume path doesn't carry. The helper
  // must tolerate that shape and still re-activate the pending proposal.
  it("re-activates a pending checkpoint from drawer-switch rows (extra channel field)", () => {
    const result = pendingCheckpointFromMessages([
      { id: "m1", content: "hi", is_checkpoint: false, channel: null },
      {
        id: "m2",
        content: "the reflection text",
        is_checkpoint: true,
        channel: "app",
        checkpoint_meta: {
          section: "work-money",
          name: "Raw name",
          composed_name: "Polished Name",
          composed_content: "polished entry",
          status: "pending",
        },
      },
    ]);
    expect(result).toEqual({
      messageId: "m2",
      section: "work-money",
      tags: [],
      name: "Polished Name",
      content: "the reflection text",
      composedContent: "polished entry",
    });
  });

  it("falls back to the raw name and null composedContent when composed fields are absent", () => {
    const result = pendingCheckpointFromMessages([
      {
        id: "m3",
        content: "c",
        is_checkpoint: true,
        checkpoint_meta: { section: "relationships", name: "Raw", status: "pending" },
      },
    ]);
    expect(result?.name).toBe("Raw");
    expect(result?.composedContent).toBeNull();
  });
});

// Regression test for the same-tick double-start race (2026-06-26). The three
// conversation-start paths in useChat (startConversation / startExploration /
// startNewSession) guarded re-entry with `if (isLoading || isStreaming)`, which
// reads React STATE — not visible within the same render tick. A sub-frame
// double-tap on a start control could fire two calls in one tick; both read a
// stale `false` and both proceeded, creating two conversations / two POST
// /api/chat. The fix backs the guard with a synchronous ref (createStartGuard).
//
// The hook can't be rendered here (vitest runs in node env, no jsdom), so these
// tests exercise the real guard primitive through `guardedStart` — a faithful
// replica of the hook's usage: acquire synchronously before the await, release
// in finally. The fetch count is a direct consequence of how many acquisitions
// succeed, so asserting "exactly one fetch" proves the same-tick window is shut.
describe("createStartGuard (same-tick double-start guard)", () => {
  async function guardedStart(
    guard: StartGuard,
    fetchSpy: () => Promise<void>
  ): Promise<boolean> {
    if (!guard.tryAcquire()) return false;
    try {
      await fetchSpy();
      return true;
    } finally {
      guard.release();
    }
  }

  it("admits exactly one of two synchronous acquisitions until released", () => {
    const guard = createStartGuard();
    expect(guard.tryAcquire()).toBe(true);
    expect(guard.tryAcquire()).toBe(false);
    guard.release();
    expect(guard.tryAcquire()).toBe(true);
  });

  it("two starts fired in the same tick issue exactly one fetch", async () => {
    const guard = createStartGuard();
    const fetchSpy = vi.fn(async () => {});

    // Both invoked synchronously — the second runs while the first is suspended
    // at its await, before any state could update. Only one fetch must fire.
    const results = await Promise.all([
      guardedStart(guard, fetchSpy),
      guardedStart(guard, fetchSpy),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("permits a fresh start after the in-flight one completes (release is not a deadlock)", async () => {
    const guard = createStartGuard();
    const fetchSpy = vi.fn(async () => {});

    expect(await guardedStart(guard, fetchSpy)).toBe(true);
    expect(await guardedStart(guard, fetchSpy)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("releases even when the guarded work throws", async () => {
    const guard = createStartGuard();
    await expect(
      guardedStart(guard, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    // A stuck lock here would permanently block every future start.
    expect(guard.tryAcquire()).toBe(true);
  });
});
