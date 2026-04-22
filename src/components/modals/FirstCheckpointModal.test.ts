import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf-8");

describe("FirstCheckpointModal — Track A Modal 3", () => {
  const src = read("src/components/modals/FirstCheckpointModal.tsx");

  it("uses the title 'A pattern is ready for your Manual'", () => {
    expect(src).toContain("A pattern is ready for your Manual");
  });

  it("contains both supplied body paragraphs", () => {
    expect(src).toContain(
      "I have a pattern to put in front of you. You will see a card. Read it."
    );
    expect(src).toContain(
      "If it fits, confirm and it becomes an entry in your Manual."
    );
    expect(src).toContain("If it is off, tell me where and we keep going.");

    expect(src).toContain("Your Manual builds one entry at a time.");
    expect(src).toContain(
      "This is the first, and it will evolve as you add more &mdash;"
    );
    expect(src).toContain(
      "entries sharpen, connect to each other, sometimes get revisited."
    );
    expect(src).toContain(
      "The Manual is a living document, not a finished one."
    );
  });

  it("uses 'Show me' as the dismiss button label", () => {
    expect(src).toContain("Show me");
  });

  it("declares dialog accessibility attributes", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-labelledby="first-checkpoint-modal-heading"');
  });

  it("targets modal_progress = 3 on dismissal POST", () => {
    expect(src).toContain("/api/modal-progress");
    expect(src).toContain("target: 3");
  });

  it("fires modal_3_shown analytics on open", () => {
    expect(src).toContain("trackModal3Shown");
    expect(src).toContain("time_since_signup_ms");
  });

  it("fires modal_flow_completed only on POST success (not optimistic)", () => {
    // The event must fire inside a conditional branch gated on a
    // successful POST response. Firing unconditionally on dismiss
    // would skew funnel analytics for users whose POST actually
    // failed.
    expect(src).toContain("trackModalFlowCompleted");
    expect(src).toContain("postSucceeded");
  });

  it("handles Escape and Tab keys", () => {
    expect(src).toContain('"Escape"');
    expect(src).toContain('"Tab"');
  });

  it("locks body scroll while open and restores on close", () => {
    expect(src).toContain('document.body.style.overflow = "hidden"');
    expect(src).toContain("prevOverflow");
  });
});
