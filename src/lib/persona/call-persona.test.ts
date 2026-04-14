import { describe, it, expect } from "vitest";
import {
  applySlidingWindow,
  mapSystemMessages,
  detectCrisisInUserMessage,
} from "@/lib/persona/call-persona";

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
    expect(detectCrisisInUserMessage("I want to disappear")).toBe(true);
    expect(detectCrisisInUserMessage("life is not worth living")).toBe(true);
    expect(detectCrisisInUserMessage("I'm tired of being alive")).toBe(true);
    expect(detectCrisisInUserMessage("I don't want to exist")).toBe(true);
    expect(detectCrisisInUserMessage("there's no point in living")).toBe(true);
  });

  it("does not false-positive on common relationship distress", () => {
    // These phrases were removed because they trigger on normal conversations
    expect(detectCrisisInUserMessage("I just want to make it stop hurting")).toBe(false);
    expect(detectCrisisInUserMessage("I can't do this anymore with him")).toBe(false);
    expect(detectCrisisInUserMessage("I don't want to be here in this relationship")).toBe(false);
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
    expect(detectCrisisInUserMessage("I dont want to be here anymore")).toBe(true);
    expect(detectCrisisInUserMessage("I don't want to be here anymore")).toBe(true);
    expect(detectCrisisInUserMessage("I dont want to exist")).toBe(true);
    expect(detectCrisisInUserMessage("whats the point of living")).toBe(true);
  });
});

