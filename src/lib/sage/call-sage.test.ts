import { describe, it, expect } from "vitest";
import {
  applySlidingWindow,
  mapSystemMessages,
  parseManualEntryBlock,
  createDelimiterBuffer,
  detectCrisisInUserMessage,
} from "@/lib/sage/call-sage";

// ── applySlidingWindow ──

describe("applySlidingWindow", () => {
  function makeMessages(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg-${i}`,
    }));
  }

  it("returns all messages when <= 50", () => {
    const msgs = makeMessages(50);
    const result = applySlidingWindow(msgs);
    expect(result).toHaveLength(50);
    expect(result).toEqual(msgs);
  });

  it("returns first 2 + last 48 when exactly 51 messages", () => {
    const msgs = makeMessages(51);
    const result = applySlidingWindow(msgs);
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual(msgs[0]);
    expect(result[1]).toEqual(msgs[1]);
    expect(result[2]).toEqual(msgs[3]); // skips msgs[2]
    expect(result[49]).toEqual(msgs[50]);
  });

  it("returns first 2 + last 48 when 100 messages (total length 50)", () => {
    const msgs = makeMessages(100);
    const result = applySlidingWindow(msgs);
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual(msgs[0]);
    expect(result[1]).toEqual(msgs[1]);
    expect(result[2]).toEqual(msgs[52]); // first of last 48
    expect(result[49]).toEqual(msgs[99]);
  });

  it("handles empty array", () => {
    expect(applySlidingWindow([])).toEqual([]);
  });

  it("does not mutate original array", () => {
    const msgs = makeMessages(60);
    const original = [...msgs];
    applySlidingWindow(msgs);
    expect(msgs).toEqual(original);
    expect(msgs).toHaveLength(60);
  });
});

// ── mapSystemMessages ──

describe("mapSystemMessages", () => {
  it("maps confirmed checkpoint system message to synthetic user message", () => {
    const result = mapSystemMessages([
      { role: "system", content: "[User confirmed the checkpoint]" },
    ]);
    expect(result).toEqual([
      {
        role: "user",
        content: "I confirmed that checkpoint. That resonates.",
      },
    ]);
  });

  it("maps rejected checkpoint system message to synthetic user message", () => {
    const result = mapSystemMessages([
      { role: "system", content: "[User rejected the checkpoint]" },
    ]);
    expect(result).toEqual([
      {
        role: "user",
        content: "That checkpoint didn't land right for me.",
      },
    ]);
  });

  it("maps refine checkpoint system message to synthetic user message", () => {
    const result = mapSystemMessages([
      { role: "system", content: "[User wants to refine the checkpoint]" },
    ]);
    expect(result).toEqual([
      { role: "user", content: "That's close but not quite right." },
    ]);
  });

  it("drops unknown system messages", () => {
    const result = mapSystemMessages([
      { role: "system", content: "[Something unexpected]" },
    ]);
    expect(result).toEqual([]);
  });

  it("passes user and assistant messages through unchanged", () => {
    const input = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];
    const result = mapSystemMessages(input);
    expect(result).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("handles empty array", () => {
    expect(mapSystemMessages([])).toEqual([]);
  });

  it("handles interleaved system + user + assistant messages", () => {
    const result = mapSystemMessages([
      { role: "user", content: "I think so" },
      { role: "assistant", content: "Let me reflect that back" },
      { role: "system", content: "[User confirmed the checkpoint]" },
      { role: "assistant", content: "Great, moving on" },
      { role: "system", content: "[Unknown system event]" },
      { role: "user", content: "Tell me more" },
    ]);
    expect(result).toEqual([
      { role: "user", content: "I think so" },
      { role: "assistant", content: "Let me reflect that back" },
      {
        role: "user",
        content: "I confirmed that checkpoint. That resonates.",
      },
      { role: "assistant", content: "Great, moving on" },
      // unknown system message dropped
      { role: "user", content: "Tell me more" },
    ]);
  });
});

// ── parseManualEntryBlock ──

describe("parseManualEntryBlock", () => {
  it("returns full text as conversationalText when no delimiter present", () => {
    const text = "Here is my response to you.";
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe(text);
    expect(result.manualEntry).toBeNull();
  });

  it("extracts valid JSON between delimiters", () => {
    const json = JSON.stringify({
      layer: 1,
      type: "component",
      name: "Core Drive",
      content: "You are driven by curiosity.",
      changelog: "Initial entry",
    });
    const text = `Here is my response.|||MANUAL_ENTRY|||${json}|||END_MANUAL_ENTRY|||`;
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe("Here is my response.");
    expect(result.manualEntry).toEqual({
      layer: 1,
      type: "component",
      name: "Core Drive",
      content: "You are driven by curiosity.",
      changelog: "Initial entry",
    });
  });

  it("trims conversationalText before the delimiter (trimEnd)", () => {
    const json = JSON.stringify({
      layer: 2,
      type: "pattern",
      name: "Avoidance",
      content: "You tend to avoid conflict.",
      changelog: "First pattern",
    });
    const text = `Here is my response.  \n\n|||MANUAL_ENTRY|||${json}|||END_MANUAL_ENTRY|||`;
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe("Here is my response.");
  });

  it("returns null manualEntry when end delimiter missing", () => {
    const text =
      'Here is my response.|||MANUAL_ENTRY|||{"layer":1,"type":"component"}';
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe("Here is my response.");
    expect(result.manualEntry).toBeNull();
  });

  it("returns null manualEntry when JSON is malformed between delimiters", () => {
    const text =
      "Here is my response.|||MANUAL_ENTRY|||{not valid json|||END_MANUAL_ENTRY|||";
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe("Here is my response.");
    expect(result.manualEntry).toBeNull();
  });

  it("handles delimiter at very start of text (conversationalText is empty string)", () => {
    const json = JSON.stringify({
      layer: 3,
      type: "component",
      name: "Reactions",
      content: "You react strongly to injustice.",
      changelog: "New entry",
    });
    const text = `|||MANUAL_ENTRY|||${json}|||END_MANUAL_ENTRY|||`;
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe("");
    expect(result.manualEntry).not.toBeNull();
    expect(result.manualEntry!.layer).toBe(3);
  });

  it("handles whitespace/newlines around JSON block", () => {
    const json = JSON.stringify({
      layer: 4,
      type: "pattern",
      name: "Control",
      content: "You seek control in uncertain situations.",
      changelog: "Observed pattern",
    });
    const text = `Response text.|||MANUAL_ENTRY|||\n  ${json}  \n|||END_MANUAL_ENTRY|||`;
    const result = parseManualEntryBlock(text);
    expect(result.conversationalText).toBe("Response text.");
    expect(result.manualEntry).toEqual({
      layer: 4,
      type: "pattern",
      name: "Control",
      content: "You seek control in uncertain situations.",
      changelog: "Observed pattern",
    });
  });
});

// ── detectCrisisInUserMessage ──

describe("detectCrisisInUserMessage", () => {
  it("detects direct crisis phrases", () => {
    expect(detectCrisisInUserMessage("I want to kill myself")).toBe(true);
    expect(detectCrisisInUserMessage("I want to hurt myself")).toBe(true);
    expect(detectCrisisInUserMessage("I want to die")).toBe(true);
    expect(detectCrisisInUserMessage("thinking about suicide")).toBe(true);
    expect(detectCrisisInUserMessage("I've been doing self-harm")).toBe(true);
  });

  it("detects indirect crisis phrases", () => {
    expect(detectCrisisInUserMessage("everyone would be better off without me")).toBe(true);
    expect(detectCrisisInUserMessage("there's no point anymore")).toBe(true);
    expect(detectCrisisInUserMessage("I just want to make it stop")).toBe(true);
    expect(detectCrisisInUserMessage("I can't do this anymore")).toBe(true);
    expect(detectCrisisInUserMessage("I want to disappear")).toBe(true);
    expect(detectCrisisInUserMessage("life is not worth living")).toBe(true);
    expect(detectCrisisInUserMessage("I'm tired of being alive")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(detectCrisisInUserMessage("I Want To HURT Myself")).toBe(true);
    expect(detectCrisisInUserMessage("SUICIDE")).toBe(true);
  });

  it("does not trigger on grief or general discussion of death", () => {
    expect(detectCrisisInUserMessage("I've been thinking about death a lot since my grandmother passed")).toBe(false);
    expect(detectCrisisInUserMessage("My dog died last week and I'm sad")).toBe(false);
    expect(detectCrisisInUserMessage("I had a hard day at work")).toBe(false);
  });

  it("detects phrases with contractions and without apostrophes", () => {
    expect(detectCrisisInUserMessage("I dont want to be here")).toBe(true);
    expect(detectCrisisInUserMessage("I don't want to be here")).toBe(true);
    expect(detectCrisisInUserMessage("I cant do this anymore")).toBe(true);
    expect(detectCrisisInUserMessage("whats the point of living")).toBe(true);
  });
});

// ── createDelimiterBuffer ──

describe("createDelimiterBuffer", () => {
  const DELIMITER = "|||MANUAL_ENTRY|||";

  it("passes through text when no delimiter chars present", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    expect(buf.process("Hello world")).toBe("Hello world");
  });

  it("holds back partial delimiter prefix", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    // "|||" is a prefix of "|||MANUAL_ENTRY|||", so it should be held back
    const result = buf.process("Hello|||");
    // "Hello" is safe, "|||" is held back
    expect(result).toBe("Hello");
  });

  it("releases held text when next chunk disproves prefix match", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    buf.process("Hello|||");
    // "xyz" disproves the match — "|||xyz" should be released
    const result = buf.process("xyz");
    expect(result).toBe("|||xyz");
  });

  it("suppresses delimiter and everything after (returns null after delimiter found)", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    const result = buf.process(
      "Before text" + DELIMITER + "after delimiter content"
    );
    expect(result).toBe("Before text");
    // Subsequent calls return null
    expect(buf.process("more text")).toBeNull();
  });

  it("handles delimiter split across two chunks", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    // Split "|||MANUAL_ENTRY|||" into two parts
    const r1 = buf.process("Hello |||MANUAL_");
    // "Hello " is safe, "|||MANUAL_" is a prefix — held back
    expect(r1).toBe("Hello ");

    const r2 = buf.process("ENTRY|||");
    // Full delimiter found — suppress everything
    expect(r2).toBeNull();
    expect(buf.found).toBe(true);
  });

  it("handles delimiter split across three chunks", () => {
    const buf = createDelimiterBuffer(DELIMITER);

    // First chunk: "Hello |||" — "Hello " flushed, "|||" held
    const r1 = buf.process("Hello |||");
    expect(r1).toBe("Hello ");

    // Second chunk: "MANUAL_" — "|||MANUAL_" is still a prefix, held
    const r2 = buf.process("MANUAL_");
    expect(r2).toBeNull();

    // Third chunk: "ENTRY|||" completes the delimiter
    const r3 = buf.process("ENTRY|||");
    expect(r3).toBeNull();
    expect(buf.found).toBe(true);
  });

  it("flush() returns held buffer when stream ends without delimiter found", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    buf.process("Some text|||");
    // "|||" is held as a potential prefix
    const flushed = buf.flush();
    expect(flushed).toBe("|||");
  });

  it("flush() returns null when delimiter was found", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    buf.process("Before" + DELIMITER + "After");
    expect(buf.found).toBe(true);
    expect(buf.flush()).toBeNull();
  });

  it("found property is false initially, true after delimiter detected", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    expect(buf.found).toBe(false);

    buf.process("no delimiter here");
    expect(buf.found).toBe(false);

    buf.process("now " + DELIMITER + " found");
    expect(buf.found).toBe(true);
  });

  it("accumulates multiple safe chunks correctly", () => {
    const buf = createDelimiterBuffer(DELIMITER);
    const r1 = buf.process("Hello ");
    const r2 = buf.process("world");
    expect(r1).toBe("Hello ");
    expect(r2).toBe("world");
  });

  it("real-world scenario: response with manual entry split into word-level chunks", () => {
    const fullText =
      'Here is my response.|||MANUAL_ENTRY|||{"layer":1,"type":"component","name":"Drive","content":"Curiosity","changelog":"init"}|||END_MANUAL_ENTRY|||';
    // Split into ~8-char chunks to simulate realistic streaming
    const chunks = [];
    let current = "";
    for (const char of fullText) {
      current += char;
      // Flush roughly every 5-10 chars to simulate streaming
      if (current.length >= 8) {
        chunks.push(current);
        current = "";
      }
    }
    if (current) chunks.push(current);

    const buf = createDelimiterBuffer(DELIMITER);
    let output = "";

    for (const chunk of chunks) {
      const safe = buf.process(chunk);
      if (safe) output += safe;
    }

    const remaining = buf.flush();
    if (remaining) output += remaining;

    expect(buf.found).toBe(true);
    expect(output).toBe("Here is my response.");
  });
});
