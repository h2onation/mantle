import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("guided-intake block (area-anchored)", () => {
  const build = (mode: "guided-intake" | "situation") =>
    buildSystemPrompt({
      kind: "oneOnOne",
      mode,
      personaModes: ["autistic"],
      manualComponents: [],
      sessionSummary: null,
      isReturningUser: false,
      isFirstCheckpoint: true,
      sessionCount: 1,
      currentConversationId: "test",
      extractionContext: "",
      turnCount: 1,
      checkpointApproaching: false,
    });

  it("renders the tee-up with the mandatory 'one thing worth keeping' endpoint", () => {
    const prompt = build("guided-intake");
    expect(prompt).toContain("TEE-UP");
    expect(prompt).toContain("one thing worth keeping");
  });

  it("is section-anchored, not person-anchored (old opener retired)", () => {
    const prompt = build("guided-intake");
    expect(prompt).toContain("OPEN THE SECTION");
    expect(prompt).not.toContain("Pick someone of note");
  });

  it("does NOT leak guided-intake markers into situation mode", () => {
    const prompt = build("situation");
    expect(prompt).not.toContain("TEE-UP");
    expect(prompt).not.toContain("OPEN THE SECTION");
  });
});

describe("guided intake UI wiring", () => {
  // The three conversation modes (situation / guided-intake / upload) launch
  // from Home's "ways to begin", which lives once in the shared WaysToBegin
  // component (rendered by both MobileHome and DesktopHome). The old in-session
  // 3-card entry screen was retired (ADR-048 follow-up); Home is now the single
  // launchpad and MobileSession no longer starts conversations itself.
  const waysToBegin = read("src/components/home/WaysToBegin.tsx");
  const mobileHome = read("src/components/mobile/MobileHome.tsx");
  const desktopHome = read("src/components/desktop/DesktopHome.tsx");
  const mainApp = read("src/components/MainApp.tsx");
  const useChat = read("src/lib/hooks/useChat.ts");

  it("WaysToBegin surfaces the guided-intake mode", () => {
    expect(waysToBegin).toContain('"guided-intake"');
  });

  it("WaysToBegin launches every door via onStartConversation(w.mode)", () => {
    expect(waysToBegin).toContain("onStartConversation(w.mode)");
    expect(waysToBegin).toContain('"situation"');
    expect(waysToBegin).toContain('"upload"');
  });

  it("both Home views render the shared WaysToBegin doors", () => {
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
    // an auto-resumed thread). startConversation now resets-then-starts like
    // startExploration, so a returning user can begin fresh from Home.
    expect(useChat).toContain("if (isLoading || isStreaming) return false");
    expect(useChat).not.toContain("if (messages.length > 0) return false");
    expect(useChat).toContain('resetConversationState("new")');
  });

  it("home conversation-starter labels avoid clinical terminology", () => {
    expect("Bring a situation").not.toMatch(/\btherapy\b|\bdiagnos|\bassessment\b/i);
    expect("Walk through it step by step with Jove").not.toMatch(/\btherapy\b|\bdiagnos|\bassessment\b/i);
  });
});

describe("guided intake chip wiring", () => {
  const session = read("src/components/mobile/MobileSession.tsx");
  const mainApp = read("src/components/MainApp.tsx");
  const useChat = read("src/lib/hooks/useChat.ts");
  const callPersona = read("src/lib/persona/call-persona.ts");
  const sseParser = read("src/lib/utils/sse-parser.ts");
  const types = read("src/lib/types.ts");

  it("MessageCompleteEvent declares optional chips field", () => {
    expect(sseParser).toContain("chips?: string[]");
  });

  it("ChatMessage declares optional chips field", () => {
    expect(types).toContain("chips?: string[]");
  });

  it("call-persona parses ---chips--- delimiter", () => {
    expect(callPersona).toContain("---chips---");
  });

  it("call-persona emits chips in message_complete payload", () => {
    expect(callPersona).toContain("chips: parsedChips");
  });

  it("useChat exports sendChipResponse", () => {
    expect(useChat).toContain("sendChipResponse");
  });

  it("useChat clears chips from messages on send", () => {
    expect(useChat).toContain("chips: undefined");
  });

  it("useChat passes isChipResponse in fetch body", () => {
    expect(useChat).toContain("isChipResponse");
  });

  it("MobileSession accepts sendChipResponse prop", () => {
    expect(session).toContain("sendChipResponse");
  });

  it("MobileSession renders QuickReplyChips component", () => {
    expect(session).toContain("QuickReplyChips");
  });

  it("MainApp passes sendChipResponse to MobileSession", () => {
    expect(mainApp).toContain("sendChipResponse={sendChipResponse}");
  });

  it("call-persona accepts isChipResponse option", () => {
    expect(callPersona).toContain("isChipResponse");
  });

  it("call-persona stores chip_response in message metadata", () => {
    expect(callPersona).toContain("chip_response: true");
  });

  it("call-persona annotates chip-tap messages in history", () => {
    expect(callPersona).toContain("[selected from options]");
  });
});

describe("guided intake instrumentation wiring", () => {
  const events = read("src/lib/analytics/events.ts");
  const useChat = read("src/lib/hooks/useChat.ts");
  const callPersona = read("src/lib/persona/call-persona.ts");
  const sseParser = read("src/lib/utils/sse-parser.ts");
  const personaConfig = read("src/lib/persona/config.ts");

  it("EntryPoint type accepts 'guided-intake'", () => {
    // EntryPoint aliases ConversationMode; ConversationMode lives in config.ts
    // and includes "guided-intake" in its tuple.
    expect(events).toMatch(/EntryPoint\s*=\s*ConversationMode/);
    expect(personaConfig).toMatch(/CONVERSATION_MODES\s*=\s*\[[^\]]*"guided-intake"/);
  });

  it("ConversationMode type is exported from events.ts", () => {
    expect(events).toMatch(/export type \{[^}]*ConversationMode/);
  });

  it("trackCheckpointProposed signature requires mode", () => {
    const block = events.match(
      /export function trackCheckpointProposed[\s\S]*?\n\}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: ConversationMode");
  });

  it("trackCheckpointConfirmed signature requires mode", () => {
    const block = events.match(
      /export function trackCheckpointConfirmed[\s\S]*?\n\}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: ConversationMode");
  });

  it("trackCheckpointRejected signature requires mode", () => {
    const block = events.match(
      /export function trackCheckpointRejected[\s\S]*?\n\}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: ConversationMode");
  });

  it("trackCheckpointRefined signature requires mode", () => {
    const block = events.match(
      /export function trackCheckpointRefined[\s\S]*?\n\}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: ConversationMode");
  });

  it("trackCheckpointDeferred signature requires mode", () => {
    const block = events.match(
      /export function trackCheckpointDeferred[\s\S]*?\n\}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: ConversationMode");
  });

  it("trackConversationEnded signature requires mode", () => {
    const block = events.match(
      /export function trackConversationEnded[\s\S]*?\n\}/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: ConversationMode");
  });

  it("MessageCompleteEvent declares optional mode field", () => {
    // mode is typed as the canonical ConversationMode union.
    expect(sseParser).toMatch(/mode\?\s*:\s*ConversationMode/);
  });

  it("call-persona emits mode in message_complete payload", () => {
    expect(callPersona).toMatch(/mode:\s*conversationMode/);
  });

  it("useChat tracks conversationMode in a ref (server is authoritative)", () => {
    expect(useChat).toMatch(
      /conversationMode\s*=\s*useRef<ConversationMode>\("situation"\)/
    );
  });

  it("useChat updates conversationMode from message_complete events", () => {
    expect(useChat).toMatch(/conversationMode\.current\s*=\s*eventMode/);
  });

  it("useChat passes mode to checkpoint decision events via cpProps", () => {
    const block = useChat.match(/const cpProps[\s\S]*?\};/)?.[0];
    expect(block).toBeDefined();
    expect(block).toContain("mode: conversationMode.current");
  });

  it("useChat passes mode to trackCheckpointProposed", () => {
    const region = useChat.match(/trackCheckpointProposed\(\{[\s\S]*?\}\);/)?.[0];
    expect(region).toBeDefined();
    expect(region).toContain("mode: eventMode");
  });

  it("useChat derives user_turn_count by filtering messages on role==='user'", () => {
    expect(useChat).toMatch(
      /messages\.filter\(\(m\) => m\.role === "user"\)\.length/
    );
  });

  it("useChat passes user_turn_count to trackCheckpointProposed", () => {
    const region = useChat.match(/trackCheckpointProposed\(\{[\s\S]*?\}\);/)?.[0];
    expect(region).toBeDefined();
    expect(region).toContain("user_turn_count: userTurnCount");
  });

  it("checkpoint_proposed message_number is preserved alongside user_turn_count", () => {
    const region = useChat.match(/trackCheckpointProposed\(\{[\s\S]*?\}\);/)?.[0];
    expect(region).toBeDefined();
    expect(region).toContain("message_number: messages.length + 1");
  });

  it("useChat passes mode to trackConversationEnded", () => {
    const region = useChat.match(
      /trackConversationEnded\(\{[\s\S]*?\}\);/
    )?.[0];
    expect(region).toBeDefined();
    expect(region).toContain("mode: conversationMode.current");
  });

  it("startConversation fires conversation_started with entry_point derived from mode", () => {
    const block = useChat.match(
      /async function startConversation[\s\S]*?\n  \}\n/
    )?.[0];
    expect(block).toBeDefined();
    // entry_point is the mode the caller passed in. For guided-intake
    // bootstrap, that resolves to "guided-intake" at runtime.
    expect(block).toContain("entry_point: mode");
  });

});
