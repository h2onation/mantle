import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  GUIDED_INTAKE_OPENER,
  detectGuidedIntakeOpenerVariant,
} from "@/lib/persona/guided-intake-copy";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("GUIDED_INTAKE_OPENER constant", () => {
  it("starts with the expected opening phrase", () => {
    expect(GUIDED_INTAKE_OPENER).toMatch(/^Pick someone of note/);
  });

  it("ends with the expected closing phrase", () => {
    expect(GUIDED_INTAKE_OPENER).toMatch(/Just someone worth naming\.$/);
  });

  it("is used in system-prompt.ts (not hardcoded)", () => {
    const src = read("src/lib/persona/system-prompt.ts");
    expect(src).toContain("GUIDED_INTAKE_OPENER");
    expect(src).toContain('import { GUIDED_INTAKE_OPENER }');
  });

  it("appears verbatim in the rendered guided-intake prompt", () => {
    const prompt = buildSystemPrompt({
      kind: "oneOnOne",
      mode: "guided-intake",
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
    expect(prompt).toContain(GUIDED_INTAKE_OPENER);
  });

  it("does NOT appear in the situation-mode prompt", () => {
    const prompt = buildSystemPrompt({
      kind: "oneOnOne",
      mode: "situation",
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
    expect(prompt).not.toContain(GUIDED_INTAKE_OPENER);
  });
});

describe("guided intake UI wiring", () => {
  // The three conversation modes (situation / guided-intake / upload) launch
  // from Home's "ways to begin" — mobile via SECONDARY_STARTS, desktop via the
  // triptych. The old in-session 3-card entry screen was retired (ADR-048
  // follow-up); Home is now the single launchpad and MobileSession no longer
  // starts conversations itself.
  const mobileHome = read("src/components/mobile/MobileHome.tsx");
  const desktopHome = read("src/components/desktop/DesktopHome.tsx");
  const mainApp = read("src/components/MainApp.tsx");
  const useChat = read("src/lib/hooks/useChat.ts");

  it("MobileHome surfaces the guided-intake mode", () => {
    expect(mobileHome).toContain('"guided-intake"');
  });

  it("MobileHome launches modes via onStartConversation", () => {
    expect(mobileHome).toContain("onStartConversation");
    expect(mobileHome).toContain('onStartConversation("situation")');
  });

  it("DesktopHome wires Guided to onStartConversation('guided-intake')", () => {
    expect(desktopHome).toContain('onStartConversation("guided-intake")');
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
    expect("Let Jove lead with questions").not.toMatch(/\btherapy\b|\bdiagnos|\bassessment\b/i);
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

describe("detectGuidedIntakeOpenerVariant", () => {
  it("returns 'default' for the literal opener constant", () => {
    expect(detectGuidedIntakeOpenerVariant(GUIDED_INTAKE_OPENER)).toBe("default");
  });

  it("returns 'default' when the default-anchor substring is embedded in a longer turn", () => {
    const msg =
      "Pick someone of note in your life. " +
      "Don't worry about getting it right.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("default");
  });

  it("returns 'widen_scope' when the widen-scope phrase appears", () => {
    const msg =
      "Who did you last have a conversation with that wasn't transactional?";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("widen_scope");
  });

  it("returns 'relationship_to_pattern' when the relationship-to-pattern phrase appears", () => {
    const msg = "Skip the person. What's a relationship where you show up differently?";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("relationship_to_pattern");
  });

  it("returns 'gentle_end' when the gentle-end phrase appears", () => {
    const msg =
      "Doesn't have to happen today. Come back when something surfaces.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("gentle_end");
  });

  it("returns null for a normal deepening turn that has no canonical phrase", () => {
    const msg = "What was happening right before? What set it off?";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(detectGuidedIntakeOpenerVariant("")).toBeNull();
  });

  it("normalizes smart quotes — apostrophe variants still match gentle_end", () => {
    const msg = "Doesn’t have to happen today.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("gentle_end");
  });

  it("ignores leading and trailing whitespace", () => {
    expect(detectGuidedIntakeOpenerVariant("   Skip the person.   ")).toBe(
      "relationship_to_pattern"
    );
  });

  it("is case-insensitive (defensive — model usually preserves case)", () => {
    expect(detectGuidedIntakeOpenerVariant("who did you last have a conversation with that wasn't transactional?")).toBe(
      "widen_scope"
    );
  });

  it("returns the deepest variant when multiple phrases coexist (defensive)", () => {
    const msg =
      "Who did you last have a conversation with that wasn't transactional? Skip the person. Doesn't have to happen today.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("gentle_end");
  });
});

describe("guided intake instrumentation wiring", () => {
  const events = read("src/lib/analytics/events.ts");
  const useChat = read("src/lib/hooks/useChat.ts");
  const callPersona = read("src/lib/persona/call-persona.ts");
  const sseParser = read("src/lib/utils/sse-parser.ts");
  const personaConfig = read("src/lib/persona/config.ts");
  const eventsTest = read("src/lib/analytics/events.test.ts");

  it("EntryPoint type accepts 'guided-intake'", () => {
    // EntryPoint aliases ConversationMode; ConversationMode lives in config.ts
    // and includes "guided-intake" in its tuple.
    expect(events).toMatch(/EntryPoint\s*=\s*ConversationMode/);
    expect(personaConfig).toMatch(/CONVERSATION_MODES\s*=\s*\[[^\]]*"guided-intake"/);
  });

  it("ConversationMode type is exported from events.ts", () => {
    expect(events).toMatch(/export type \{[^}]*ConversationMode/);
  });

  it("trackGuidedIntakeOpenerFired is exported from events.ts", () => {
    expect(events).toContain("export function trackGuidedIntakeOpenerFired");
    expect(events).toContain('"guided_intake_opener_fired"');
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

  it("useChat imports the variant detector from guided-intake-copy", () => {
    expect(useChat).toContain(
      'import { detectGuidedIntakeOpenerVariant } from "@/lib/persona/guided-intake-copy"'
    );
  });

  it("useChat imports trackGuidedIntakeOpenerFired", () => {
    expect(useChat).toContain("trackGuidedIntakeOpenerFired");
  });

  it("useChat tracks conversationMode in a ref (server is authoritative)", () => {
    expect(useChat).toMatch(
      /conversationMode\s*=\s*useRef<ConversationMode>\("situation"\)/
    );
  });

  it("useChat updates conversationMode from message_complete events", () => {
    expect(useChat).toMatch(/conversationMode\.current\s*=\s*eventMode/);
  });

  it("useChat fires opener variant only when mode is guided-intake", () => {
    expect(useChat).toMatch(/eventMode === "guided-intake"/);
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

  it("PII guard test covers the new opener event", () => {
    expect(eventsTest).toContain('event: "guided_intake_opener_fired"');
  });
});
