import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

// Module-launch wiring — source-pin coverage for the modules cutover
// (2026-07-15). Modules (founder-authored rows) replaced the three fixed
// doors; Home renders enabled modules and every conversation starts inside
// one. This file replaced guided-intake-copy.test.ts, whose premise (a fixed
// guided-intake door with a section picker) was retired with the cutover.

describe("module launch wiring", () => {
  const waysToBegin = read("src/components/home/WaysToBegin.tsx");
  const mobileHome = read("src/components/mobile/MobileHome.tsx");
  const desktopHome = read("src/components/desktop/DesktopHome.tsx");
  const mainApp = read("src/components/MainApp.tsx");
  const useChat = read("src/lib/hooks/useChat.ts");

  it("WaysToBegin renders modules and launches by slug", () => {
    expect(waysToBegin).toContain("modules.map");
    expect(waysToBegin).toContain("onStartConversation(m.slug)");
    // The hardcoded door registry is gone.
    expect(waysToBegin).not.toContain('"guided-intake"');
    expect(waysToBegin).not.toContain("DOORS");
  });

  it("both Home views render the shared WaysToBegin module cards", () => {
    expect(mobileHome).toContain("<WaysToBegin");
    expect(desktopHome).toContain("<WaysToBegin");
  });

  it("MainApp passes onStartConversation to the Home views", () => {
    expect(mainApp).toContain("onStartConversation={handleStartConversation}");
  });

  it("useChat exports startConversation", () => {
    expect(useChat).toContain("function startConversation");
    expect(useChat).toContain("startConversation,");
  });

  it("startConversation bootstrap sends message=null with the mode flag", () => {
    expect(useChat).toContain("message: null");
    expect(useChat).toContain("mode,");
  });

  it("startConversation guards re-entry by in-flight state, then resets before starting", () => {
    // Double-fire protection is the in-flight guard (set synchronously on the
    // first call). The old `messages.length > 0` guard was REMOVED — it
    // silently no-op'd every Home start for returning users (who always have
    // an auto-resumed thread). startConversation resets-then-starts like
    // startExploration, so a returning user can begin fresh from Home.
    expect(useChat).toContain("if (isLoading || isStreaming) return false");
    expect(useChat).not.toContain("if (messages.length > 0) return false");
    expect(useChat).toContain('resetConversationState("new")');
  });
});

describe("module instrumentation wiring", () => {
  const events = read("src/lib/analytics/events.ts");
  const useChat = read("src/lib/hooks/useChat.ts");
  const callPersona = read("src/lib/persona/call-persona.ts");
  const sseParser = read("src/lib/utils/sse-parser.ts");

  it("EntryPoint aliases ConversationMode (the open module-slug type)", () => {
    expect(events).toMatch(/EntryPoint\s*=\s*ConversationMode/);
  });

  it("ConversationMode type is exported from events.ts", () => {
    expect(events).toMatch(/export type \{[^}]*ConversationMode/);
  });

  for (const fn of [
    "trackCheckpointProposed",
    "trackCheckpointConfirmed",
    "trackCheckpointRejected",
    "trackCheckpointRefined",
    "trackConversationEnded",
  ]) {
    it(`${fn} signature requires mode`, () => {
      const block = events.match(
        new RegExp(`export function ${fn}[\\s\\S]*?\\n\\}`)
      )?.[0];
      expect(block).toBeDefined();
      expect(block).toContain("mode: ConversationMode");
    });
  }

  it("MessageCompleteEvent declares optional mode field", () => {
    expect(sseParser).toMatch(/mode\?\s*:\s*ConversationMode/);
  });

  it("call-persona emits mode in message_complete payload", () => {
    expect(callPersona).toMatch(/mode:\s*conversationMode/);
  });

  it("useChat tracks conversationMode in a ref (server is authoritative)", () => {
    expect(useChat).toMatch(/conversationMode\s*=\s*useRef<ConversationMode>/);
  });

  it("useChat updates conversationMode from message_complete events", () => {
    expect(useChat).toMatch(/conversationMode\.current\s*=\s*eventMode/);
  });

  it("useChat passes mode to checkpoint decision events via cpProps", () => {
    const block = useChat.match(/const cpProps[\s\S]*?\};/)?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: conversationMode.current");
  });

  it("useChat passes mode + user_turn_count to trackCheckpointProposed (pull path)", () => {
    const region = useChat.match(/trackCheckpointProposed\(\{[\s\S]*?\}\);/)?.[0];
    expect(region).toBeDefined();
    expect(region).toContain("mode: conversationMode.current");
    expect(region).toContain("user_turn_count:");
    expect(region).toContain("message_number: messages.length + 1");
  });

  it("useChat derives user_turn_count by filtering messages on role==='user'", () => {
    expect(useChat).toMatch(
      /messages\.filter\(\(m\) => m\.role === "user"\)\.length/
    );
  });

  it("useChat passes mode to trackConversationEnded", () => {
    const region = useChat.match(/trackConversationEnded\(\{[\s\S]*?\}\);/)?.[0];
    expect(region).toBeDefined();
    expect(region).toContain("mode: conversationMode.current");
  });

  it("startConversation fires conversation_started with entry_point derived from mode", () => {
    const block = useChat.match(
      /async function startConversation[\s\S]*?\n  \}\n/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("entry_point: mode");
  });
});

describe("retired section-picker plumbing stays retired", () => {
  const callPersona = read("src/lib/persona/call-persona.ts");
  const uiMarkers = read("src/lib/persona/ui-markers.ts");
  const types = read("src/lib/types.ts");

  it("call-persona no longer parses the guided-intake markers", () => {
    // The only ACTIVE marker is ---reflection-ready---. If a stale live
    // prompt still emits a retired marker, stripDefunctMarkers is the floor
    // that keeps it off screen.
    expect(callPersona).not.toContain('"---sections---"');
    expect(callPersona).not.toContain('"---start-situation---"');
    expect(callPersona).toContain("---reflection-ready---");
    expect(callPersona).toContain("stripDefunctMarkers");
  });

  it("the defunct-marker floor still strips any bare ---word--- line", () => {
    expect(uiMarkers).toContain("stripDefunctMarkers");
  });

  it("ChatMessage no longer carries the picker flags", () => {
    expect(types).not.toContain("showSections");
    expect(types).not.toContain("offerStartSituation");
  });
});

describe("post-save fork keeps the shared tile control", () => {
  it("PostSaveFork renders SelectionTile styled by .mw-seltile", () => {
    const fork = read("src/components/mobile/PostSaveFork.tsx");
    const tile = read("src/components/mobile/SelectionTile.tsx");
    const css = read("src/app/globals.css");
    expect(fork).toContain("SelectionTile");
    expect(tile).toContain("mw-seltile");
    expect(css).toContain(".mw-seltile");
    expect(css).toContain("border-radius: var(--session-bubble-radius)");
  });
});
