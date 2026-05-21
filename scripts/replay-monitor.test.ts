import { describe, it, expect } from "vitest";
import {
  parsePlainTextTranscript,
  parseJsonTranscript,
  buildSlices,
} from "./replay-monitor";

describe("parsePlainTextTranscript", () => {
  it("parses USER and JOVE prefixes into a flat message list", () => {
    const input = `USER: hello
JOVE: hi
USER: again`;
    expect(parsePlainTextTranscript(input)).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "again" },
    ]);
  });

  it("accepts ASSISTANT: as a synonym for JOVE:", () => {
    const input = `USER: a
ASSISTANT: b`;
    expect(parsePlainTextTranscript(input)).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
  });

  it("preserves multi-line turns with blank lines inside", () => {
    const input = `USER: first paragraph.

second paragraph still part of the same turn.

JOVE: reply.`;
    const messages = parsePlainTextTranscript(input);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe(
      "first paragraph.\n\nsecond paragraph still part of the same turn."
    );
    expect(messages[1].content).toBe("reply.");
  });

  it("strips comment lines but keeps them from ending a turn", () => {
    const input = `# header comment
USER: line one
# inline comment — should be stripped but not end the turn
line two
JOVE: reply`;
    const messages = parsePlainTextTranscript(input);
    expect(messages[0].content).toBe("line one\nline two");
    expect(messages[1].content).toBe("reply");
  });

  it("is case-insensitive on the prefix", () => {
    const input = `user: a
jove: b`;
    expect(parsePlainTextTranscript(input).map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("throws when content appears before the first prefix", () => {
    expect(() =>
      parsePlainTextTranscript("hello\nUSER: a")
    ).toThrow(/before first/);
  });

  it("throws on an empty turn (prefix with no body)", () => {
    expect(() =>
      parsePlainTextTranscript("USER:\nJOVE: reply")
    ).toThrow(/empty/);
  });

  it("ignores trailing blank lines at end of file", () => {
    const input = `USER: a

`;
    expect(parsePlainTextTranscript(input)).toEqual([
      { role: "user", content: "a" },
    ]);
  });
});

describe("parseJsonTranscript", () => {
  it("parses a valid happy-path JSON array", () => {
    const json = JSON.stringify([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
    expect(parseJsonTranscript(json)).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseJsonTranscript("{ not json")).toThrow(/parse/);
  });

  it("throws when the root is not an array", () => {
    expect(() => parseJsonTranscript('{"role": "user"}')).toThrow(/array/);
  });

  it("throws when an entry has an unknown role", () => {
    const json = JSON.stringify([{ role: "system", content: "x" }]);
    expect(() => parseJsonTranscript(json)).toThrow(/role/);
  });

  it("throws when content is empty or non-string", () => {
    expect(() =>
      parseJsonTranscript(JSON.stringify([{ role: "user", content: "" }]))
    ).toThrow(/content/);
    expect(() =>
      parseJsonTranscript(JSON.stringify([{ role: "user", content: 42 }]))
    ).toThrow(/content/);
  });
});

describe("buildSlices", () => {
  it("returns one slice per user turn, cumulative through that turn", () => {
    const messages = [
      { role: "user" as const, content: "u1" },
      { role: "assistant" as const, content: "a1" },
      { role: "user" as const, content: "u2" },
      { role: "assistant" as const, content: "a2" },
      { role: "user" as const, content: "u3" },
    ];
    const slices = buildSlices(messages);
    expect(slices).toHaveLength(3);
    expect(slices[0].slice).toEqual(messages.slice(0, 1));
    expect(slices[1].slice).toEqual(messages.slice(0, 3));
    expect(slices[2].slice).toEqual(messages.slice(0, 5));
    expect(slices.map((s) => s.userMessageIndex)).toEqual([0, 2, 4]);
  });

  it("handles a transcript that opens with an assistant turn", () => {
    const messages = [
      { role: "assistant" as const, content: "opener" },
      { role: "user" as const, content: "u1" },
      { role: "assistant" as const, content: "a1" },
      { role: "user" as const, content: "u2" },
    ];
    const slices = buildSlices(messages);
    expect(slices).toHaveLength(2);
    expect(slices[0].slice).toEqual(messages.slice(0, 2));
    expect(slices[1].slice).toEqual(messages.slice(0, 4));
  });

  it("returns empty when there are no user turns", () => {
    const messages = [
      { role: "assistant" as const, content: "opener" },
    ];
    expect(buildSlices(messages)).toEqual([]);
  });
});
