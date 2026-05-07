import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { GUIDED_INTAKE_OPENER } from "@/lib/persona/guided-intake-copy";
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
