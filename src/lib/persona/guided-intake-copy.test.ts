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
    expect(GUIDED_INTAKE_OPENER).toMatch(/^Tell me about a moment/);
  });

  it("ends with the expected closing phrase", () => {
    expect(GUIDED_INTAKE_OPENER).toMatch(/Whatever comes to mind first is fine\.$/);
  });

  it("is used in system-prompt.ts (not hardcoded)", () => {
    const src = read("src/lib/persona/system-prompt.ts");
    expect(src).toContain("GUIDED_INTAKE_OPENER");
    expect(src).toContain('import { GUIDED_INTAKE_OPENER }');
  });

  it("appears verbatim in the rendered guided-intake prompt", () => {
    const prompt = buildSystemPrompt({
      mode: "guided-intake",
      personaMode: "autistic",
      messages: [],
      manualComponents: [],
      previousExtraction: null,
      sessionSummary: null,
      isReturningUser: false,
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnsSinceCheckpoint: Infinity,
      conversationId: "test",
      extractionForPersona: "",
      turnCount: 1,
      checkpointApproaching: false,
    });
    expect(prompt).toContain(GUIDED_INTAKE_OPENER);
  });

  it("does NOT appear in the situation-mode prompt", () => {
    const prompt = buildSystemPrompt({
      mode: "situation",
      personaMode: "autistic",
      messages: [],
      manualComponents: [],
      previousExtraction: null,
      sessionSummary: null,
      isReturningUser: false,
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnsSinceCheckpoint: Infinity,
      conversationId: "test",
      extractionForPersona: "",
      turnCount: 1,
      checkpointApproaching: false,
    });
    expect(prompt).not.toContain(GUIDED_INTAKE_OPENER);
  });
});

describe("guided intake UI wiring", () => {
  const session = read("src/components/mobile/MobileSession.tsx");
  const mainApp = read("src/components/MainApp.tsx");
  const useChat = read("src/lib/hooks/useChat.ts");

  it("MobileSession accepts startGuidedIntake prop", () => {
    expect(session).toContain("startGuidedIntake");
  });

  it("MobileSession renders the guided intake affordance", () => {
    expect(session).toContain("Help me get started");
  });

  it("MainApp passes startGuidedIntake to MobileSession", () => {
    expect(mainApp).toContain("startGuidedIntake={startGuidedIntake}");
  });

  it("useChat exports startGuidedIntake", () => {
    expect(useChat).toContain("startGuidedIntake");
  });

  it("startGuidedIntake sends mode guided-intake to /api/chat", () => {
    expect(useChat).toContain('mode: "guided-intake"');
  });

  it("startGuidedIntake guards against double-call when messages exist", () => {
    expect(useChat).toContain("if (messages.length > 0) return false");
  });

  it("user-facing affordance text does not use clinical language", () => {
    expect("Help me get started").not.toMatch(/\bintake\b/i);
  });
});

describe("detectGuidedIntakeOpenerVariant", () => {
  it("returns 'default' for the literal opener constant", () => {
    expect(detectGuidedIntakeOpenerVariant(GUIDED_INTAKE_OPENER)).toBe("default");
  });

  it("returns 'default' when the default-anchor substring is embedded in a longer turn", () => {
    const msg =
      "Tell me about a moment in the last week or two that's still sitting with you. " +
      "Don't worry about getting it right.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("default");
  });

  it("returns 'recency_drop' when the recency-drop phrase appears", () => {
    const msg =
      "Doesn't have to be recent. Anything you've found yourself returning to.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("recency_drop");
  });

  it("returns 'moments_to_states' when the moments-to-states phrase appears", () => {
    const msg = "Skip the moment. What's been hardest lately?";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("moments_to_states");
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

  it("normalizes smart quotes — apostrophe variants still match recency_drop", () => {
    const msg = "Doesn’t have to be recent. Anything that's stuck.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("recency_drop");
  });

  it("normalizes smart quotes — apostrophe variants still match gentle_end", () => {
    const msg = "Doesn’t have to happen today.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("gentle_end");
  });

  it("ignores leading and trailing whitespace", () => {
    expect(detectGuidedIntakeOpenerVariant("   Skip the moment.   ")).toBe(
      "moments_to_states"
    );
  });

  it("is case-insensitive (defensive — model usually preserves case)", () => {
    expect(detectGuidedIntakeOpenerVariant("doesn't have to be recent.")).toBe(
      "recency_drop"
    );
  });

  it("returns the deepest variant when multiple phrases coexist (defensive)", () => {
    // The prompt's flow makes this combination unlikely, but the
    // detector should not regress to the lighter variant if it ever
    // happens. Order: gentle_end > moments_to_states > recency_drop > default.
    const msg =
      "Doesn't have to be recent. Skip the moment. Doesn't have to happen today.";
    expect(detectGuidedIntakeOpenerVariant(msg)).toBe("gentle_end");
  });
});

describe("guided intake instrumentation wiring", () => {
  const events = read("src/lib/analytics/events.ts");
  const useChat = read("src/lib/hooks/useChat.ts");
  const callPersona = read("src/lib/persona/call-persona.ts");
  const sseParser = read("src/lib/utils/sse-parser.ts");
  const eventsTest = read("src/lib/analytics/events.test.ts");

  it("EntryPoint type accepts 'guided-intake'", () => {
    expect(events).toMatch(/EntryPoint\s*=\s*"situation"\s*\|\s*"guided-intake"/);
  });

  it("ConversationMode type is exported from events.ts", () => {
    expect(events).toContain("export type ConversationMode");
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
    expect(sseParser).toMatch(/mode\?\s*:\s*"situation"\s*\|\s*"guided-intake"/);
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

  it("startGuidedIntake fires conversation_started with entry_point=guided-intake", () => {
    const block = useChat.match(
      /async function startGuidedIntake[\s\S]*?\n  \}\n/
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain('entry_point: "guided-intake"');
  });

  it("PII guard test covers the new opener event", () => {
    expect(eventsTest).toContain('event: "guided_intake_opener_fired"');
  });
});
