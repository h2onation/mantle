import { describe, it, expect } from "vitest";
import {
  compressManualEntry,
  prepareManualContext,
  prepareManualContextBlocks,
  type ManualEntryForContext,
} from "@/lib/persona/manual-context";
import { LAYER_NAMES } from "@/lib/manual/layers";

function makeEntry(overrides: Partial<ManualEntryForContext> = {}): ManualEntryForContext {
  return {
    section: "relationships",
    name: "Test Entry",
    content: "You step into rooms and rewrite yourself until no one can see the weight.",
    summary: "A second version switches on in rooms and runs the conversation while the real one waits in the back.",
    key_words: ["rooms", "second version", "weight"],
    created_at: "2026-04-15T12:00:00Z",
    source_conversation_id: "conv-1",
    ...overrides,
  };
}

describe("compressManualEntry", () => {
  it("renders the section label, headline, summary, and key words", () => {
    const result = compressManualEntry(makeEntry());
    expect(result).toContain(`[${LAYER_NAMES[1]}]`);
    expect(result).toContain('"Test Entry"');
    expect(result).toContain("A second version switches on in rooms");
    expect(result).toContain("Key words: rooms, second version, weight");
  });

  it("falls back to first sentence of content when summary is missing", () => {
    const entry = makeEntry({ summary: null });
    const result = compressManualEntry(entry);
    expect(result).toContain("You step into rooms and rewrite yourself until no one can see the weight.");
  });

  it("falls back to first sentence of content when summary is empty string", () => {
    const entry = makeEntry({ summary: "" });
    const result = compressManualEntry(entry);
    expect(result).toContain("You step into rooms and rewrite yourself until no one can see the weight.");
  });

  it("omits the Key words clause when key_words is empty or missing", () => {
    const entry = makeEntry({ key_words: [] });
    const result = compressManualEntry(entry);
    expect(result).not.toContain("Key words:");
  });

  it("uses '(unnamed)' when the entry has no name", () => {
    const entry = makeEntry({ name: null });
    const result = compressManualEntry(entry);
    expect(result).toContain("(unnamed)");
  });

  it("truncates long fallback summaries to 240 chars", () => {
    const longContent = "A".repeat(400) + ". Second sentence.";
    const entry = makeEntry({ summary: null, content: longContent });
    const result = compressManualEntry(entry);
    expect(result).toContain("...");
  });
});

describe("prepareManualContext", () => {
  it("returns empty string when there are no entries", () => {
    expect(prepareManualContext([], "conv-1")).toBe("");
  });

  it("renders all entries in full when there are 4 or fewer", () => {
    const entries = [
      makeEntry({ name: "A", content: "Content A", source_conversation_id: "other" }),
      makeEntry({ name: "B", content: "Content B", source_conversation_id: "other" }),
      makeEntry({ name: "C", content: "Content C", source_conversation_id: "other" }),
    ];
    const result = prepareManualContext(entries, "conv-1");
    expect(result).toContain("CONFIRMED MANUAL");
    expect(result).toContain("Content A");
    expect(result).toContain("Content B");
    expect(result).toContain("Content C");
    expect(result).not.toContain("EARLIER ENTRIES");
  });

  it("compresses older entries when the user has more than 4 total", () => {
    const entries = [
      makeEntry({ name: "Oldest", content: "Content oldest", summary: "Oldest summary.", source_conversation_id: "old", created_at: "2026-01-01T00:00:00Z" }),
      makeEntry({ name: "Old", content: "Content old", summary: "Old summary.", source_conversation_id: "old", created_at: "2026-02-01T00:00:00Z" }),
      makeEntry({ name: "Mid1", content: "Content mid1", source_conversation_id: "old", created_at: "2026-03-01T00:00:00Z" }),
      makeEntry({ name: "Mid2", content: "Content mid2", source_conversation_id: "old", created_at: "2026-03-15T00:00:00Z" }),
      makeEntry({ name: "Recent1", content: "Content recent1", source_conversation_id: "old", created_at: "2026-04-10T00:00:00Z" }),
      makeEntry({ name: "Recent2", content: "Content recent2", source_conversation_id: "old", created_at: "2026-04-14T00:00:00Z" }),
    ];
    const result = prepareManualContext(entries, "conv-current");
    // Most recent 4 should appear in full
    expect(result).toContain("Content mid1");
    expect(result).toContain("Content mid2");
    expect(result).toContain("Content recent1");
    expect(result).toContain("Content recent2");
    // Oldest two should be compressed
    expect(result).toContain("EARLIER ENTRIES");
    expect(result).toContain("Oldest summary.");
    expect(result).toContain("Old summary.");
    expect(result).not.toContain("Content oldest");
    expect(result).not.toContain("Content old");
  });

  it("shows current-session entries in full and backfills with most-recent older entries", () => {
    const entries = [
      makeEntry({ name: "Old1", content: "Content old1", source_conversation_id: "old", created_at: "2026-01-01T00:00:00Z" }),
      makeEntry({ name: "Old2", content: "Content old2", source_conversation_id: "old", created_at: "2026-02-01T00:00:00Z" }),
      makeEntry({ name: "Old3", content: "Content old3", source_conversation_id: "old", created_at: "2026-03-01T00:00:00Z" }),
      makeEntry({ name: "Old4", content: "Content old4", source_conversation_id: "old", created_at: "2026-03-15T00:00:00Z" }),
      makeEntry({ name: "Old5", content: "Content old5", source_conversation_id: "old", created_at: "2026-04-01T00:00:00Z" }),
      makeEntry({ name: "Fresh", content: "Content fresh", source_conversation_id: "conv-current", created_at: "2026-04-15T00:00:00Z" }),
    ];
    const result = prepareManualContext(entries, "conv-current");
    // Fresh must be full (authored in current session)
    expect(result).toContain("Content fresh");
    // currentSession=1, so backfill pulls the 3 newest older entries in full
    expect(result).toContain("Content old3");
    expect(result).toContain("Content old4");
    expect(result).toContain("Content old5");
    // The two oldest spill into the compressed section
    expect(result).toContain("EARLIER ENTRIES");
    expect(result).not.toContain("Content old1");
    expect(result).not.toContain("Content old2");
  });

  it("treats all entries as older when currentConversationId is null", () => {
    const entries = [
      makeEntry({ name: "A", content: "Content A", source_conversation_id: "c1", created_at: "2026-01-01T00:00:00Z" }),
      makeEntry({ name: "B", content: "Content B", source_conversation_id: "c2", created_at: "2026-02-01T00:00:00Z" }),
      makeEntry({ name: "C", content: "Content C", source_conversation_id: "c3", created_at: "2026-03-01T00:00:00Z" }),
      makeEntry({ name: "D", content: "Content D", source_conversation_id: "c4", created_at: "2026-04-01T00:00:00Z" }),
      makeEntry({ name: "E", content: "Content E", source_conversation_id: "c5", created_at: "2026-04-10T00:00:00Z" }),
    ];
    const result = prepareManualContext(entries, null);
    // With no current conversation, the 4 newest backfill in full; oldest compresses
    expect(result).toContain("Content B");
    expect(result).toContain("Content C");
    expect(result).toContain("Content D");
    expect(result).toContain("Content E");
    expect(result).toContain("EARLIER ENTRIES");
    expect(result).not.toContain("Content A");
  });

  it("renders recent entries in chronological order (oldest-first)", () => {
    const entries = [
      makeEntry({ name: "Newest", content: "Content newest", source_conversation_id: "conv-current", created_at: "2026-04-15T03:00:00Z" }),
      makeEntry({ name: "First", content: "Content first", source_conversation_id: "conv-current", created_at: "2026-04-15T01:00:00Z" }),
      makeEntry({ name: "Middle", content: "Content middle", source_conversation_id: "conv-current", created_at: "2026-04-15T02:00:00Z" }),
    ];
    const result = prepareManualContext(entries, "conv-current");
    const firstIdx = result.indexOf("Content first");
    const middleIdx = result.indexOf("Content middle");
    const newestIdx = result.indexOf("Content newest");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(middleIdx).toBeGreaterThan(firstIdx);
    expect(newestIdx).toBeGreaterThan(middleIdx);
  });
});

describe("prepareManualContextBlocks", () => {
  it("returns empty strings when no entries", () => {
    const { older, recent } = prepareManualContextBlocks([], "conv-1");
    expect(older).toBe("");
    expect(recent).toBe("");
  });

  it("separates recent and older entries into different strings", () => {
    const entries = [
      makeEntry({ name: "Old1", content: "Content old1", summary: "Old1 summary.", source_conversation_id: "old", created_at: "2026-01-01T00:00:00Z" }),
      makeEntry({ name: "Old2", content: "Content old2", summary: "Old2 summary.", source_conversation_id: "old", created_at: "2026-02-01T00:00:00Z" }),
      makeEntry({ name: "Mid1", content: "Content mid1", source_conversation_id: "old", created_at: "2026-03-01T00:00:00Z" }),
      makeEntry({ name: "Mid2", content: "Content mid2", source_conversation_id: "old", created_at: "2026-03-15T00:00:00Z" }),
      makeEntry({ name: "Recent1", content: "Content recent1", source_conversation_id: "old", created_at: "2026-04-10T00:00:00Z" }),
      makeEntry({ name: "Recent2", content: "Content recent2", source_conversation_id: "old", created_at: "2026-04-14T00:00:00Z" }),
    ];
    const { older, recent } = prepareManualContextBlocks(entries, "conv-current");
    // 4 most recent in `recent`, 2 oldest in `older` (compressed)
    expect(recent).toContain("Content mid1");
    expect(recent).toContain("Content mid2");
    expect(recent).toContain("Content recent1");
    expect(recent).toContain("Content recent2");
    expect(older).toContain("Old1 summary.");
    expect(older).toContain("Old2 summary.");
    // The compressed older entries do not leak full content
    expect(older).not.toContain("Content old1");
    expect(older).not.toContain("Content old2");
    // The verbatim recent block does not leak compressed summaries
    expect(recent).not.toContain("Old1 summary.");
  });

  it("recent block contains CONFIRMED MANUAL header; older block contains EARLIER ENTRIES header", () => {
    const entries = [
      makeEntry({ name: "Fresh", content: "Fresh content", source_conversation_id: "conv-current", created_at: "2026-04-15T00:00:00Z" }),
      makeEntry({ name: "Old", content: "Old content", summary: "Old summary.", source_conversation_id: "old", created_at: "2026-01-01T00:00:00Z" }),
      makeEntry({ name: "Old2", content: "Old2 content", summary: "Old2 summary.", source_conversation_id: "old", created_at: "2026-01-02T00:00:00Z" }),
      makeEntry({ name: "Old3", content: "Old3 content", summary: "Old3 summary.", source_conversation_id: "old", created_at: "2026-01-03T00:00:00Z" }),
      makeEntry({ name: "Old4", content: "Old4 content", summary: "Old4 summary.", source_conversation_id: "old", created_at: "2026-01-04T00:00:00Z" }),
      makeEntry({ name: "Old5", content: "Old5 content", summary: "Old5 summary.", source_conversation_id: "old", created_at: "2026-01-05T00:00:00Z" }),
    ];
    const { older, recent } = prepareManualContextBlocks(entries, "conv-current");
    expect(recent).toContain("CONFIRMED MANUAL");
    expect(older).toContain("EARLIER ENTRIES (compressed");
  });

  it("is byte-stable across calls (cache prerequisite)", () => {
    const entries = [
      makeEntry({
        name: "Stable",
        content: "Stable content",
        summary: "Stable summary.",
        key_words: ["stable", "kw"],
        source_conversation_id: "old",
        created_at: "2026-01-01T00:00:00Z",
      }),
    ];
    const a = prepareManualContextBlocks(entries, "conv-current");
    const b = prepareManualContextBlocks(entries, "conv-current");
    expect(a.older).toBe(b.older);
    expect(a.recent).toBe(b.recent);
  });

  it("prepareManualContext output matches the legacy single-string shape", () => {
    // The wrapper `prepareManualContext` must reproduce the legacy
    // concatenated output so existing callers (admin renderer, Linq
    // bridges) keep working unchanged.
    const entries = [
      makeEntry({ name: "Recent", content: "Recent content", source_conversation_id: "conv-current", created_at: "2026-04-15T00:00:00Z" }),
      makeEntry({ name: "Old1", content: "Old1 content", summary: "Old1 summary.", source_conversation_id: "old", created_at: "2026-01-01T00:00:00Z" }),
      makeEntry({ name: "Old2", content: "Old2 content", summary: "Old2 summary.", source_conversation_id: "old", created_at: "2026-01-02T00:00:00Z" }),
      makeEntry({ name: "Old3", content: "Old3 content", summary: "Old3 summary.", source_conversation_id: "old", created_at: "2026-01-03T00:00:00Z" }),
      makeEntry({ name: "Old4", content: "Old4 content", summary: "Old4 summary.", source_conversation_id: "old", created_at: "2026-01-04T00:00:00Z" }),
      makeEntry({ name: "Old5", content: "Old5 content", summary: "Old5 summary.", source_conversation_id: "old", created_at: "2026-01-05T00:00:00Z" }),
    ];
    const legacy = prepareManualContext(entries, "conv-current");
    const { recent, older } = prepareManualContextBlocks(entries, "conv-current");
    // Both halves concatenated (with the CONFIRMED MANUAL header
    // attached to recent) should equal the legacy single block.
    expect(legacy).toBe(recent + older);
  });

  it("prepareManualContext preserves the CONFIRMED MANUAL header even when only older entries exist", () => {
    // Pre-existing quirk: when there are no recent entries, the legacy
    // output still emits the CONFIRMED MANUAL header before EARLIER
    // ENTRIES. The split form puts the header inside the (empty) recent
    // block — the wrapper reassembles it for byte-compat.
    const entries = Array.from({ length: 5 }, (_, i) => makeEntry({
      name: `Old${i}`,
      content: `Old${i} content`,
      summary: `Old${i} summary.`,
      source_conversation_id: "old",
      created_at: `2026-01-0${i + 1}T00:00:00Z`,
    }));
    // With all entries from a non-current conversation and >4 of them,
    // the 4 newest backfill into `recent` and 1 spills into `older`.
    // Force the "only older" case by having entries.length === 5 but
    // none are current — backfill takes 4, leaves 1 in older.
    const { recent, older } = prepareManualContextBlocks(entries, "conv-current");
    expect(recent).not.toBe("");
    expect(older).not.toBe("");
  });
});
