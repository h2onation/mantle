import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Source-string copy tests — same pattern as onboarding-copy.test.ts.
// Pins the supplied verbatim copy plus the structural contracts the
// modal must keep (dialog accessibility, analytics tracker call,
// POST target, escape handling).
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf-8");

describe("ChatWindowModal — Track A Modal 1", () => {
  const src = read("src/components/modals/ChatWindowModal.tsx");

  it("uses the title 'How this works'", () => {
    expect(src).toContain("How this works");
  });

  it("contains all 4 supplied body paragraphs", () => {
    // Persona name is interpolated via PERSONA_NAME constant; assert
    // surrounding copy without the name.
    expect(src).toContain("This is where you talk to {PERSONA_NAME}.");
    expect(src).toContain("Bring a situation you want help processing or working through.");
    expect(src).toContain("Something specific &mdash;");
    expect(src).toContain("a conflict you are still chewing on");
    expect(src).toContain("a reaction that surprised you");
    expect(src).toContain("a pattern you keep noticing");

    expect(src).toContain("While we talk, {PERSONA_NAME} is pulling out insights you might not see from inside");
    expect(src).toContain("What you confirm gets written to your Manual &mdash;");
    expect(src).toContain("a document about how you operate, authored by you, that builds over time.");

    expect(src).toContain("This takes time, and it is an investment.");
    expect(src).toContain("Start with at least 15 minutes.");
    expect(src).toContain("If now is not that, come back when it is.");

    expect(src).toContain("Nothing gets written without your yes.");
  });

  it("uses 'Got it' as the dismiss button label", () => {
    expect(src).toContain("Got it");
  });

  it("declares dialog accessibility attributes", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-labelledby="chat-window-modal-heading"');
  });

  it("targets modal_progress = 1 on dismissal POST", () => {
    expect(src).toContain("/api/modal-progress");
    expect(src).toContain("target: 1");
  });

  it("fires modal_1_shown analytics on open", () => {
    expect(src).toContain("trackModal1Shown");
    expect(src).toContain("time_since_signup_ms");
  });

  it("handles Escape key for dismissal", () => {
    expect(src).toContain('"Escape"');
  });

  it("traps Tab focus inside the modal (single-button)", () => {
    expect(src).toContain('"Tab"');
  });

  it("locks body scroll while open and restores on close", () => {
    expect(src).toContain('document.body.style.overflow = "hidden"');
    expect(src).toContain("prevOverflow");
  });
});
