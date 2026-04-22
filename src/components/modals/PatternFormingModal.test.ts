import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Source-string copy tests — same pattern as ChatWindowModal.test.ts
// and onboarding-copy.test.ts.
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf-8");

describe("PatternFormingModal — Track A Modal 2", () => {
  const src = read("src/components/modals/PatternFormingModal.tsx");

  it("uses the title 'Something is taking shape'", () => {
    expect(src).toContain("Something is taking shape");
  });

  it("contains all 3 supplied body paragraphs (with snippet injection)", () => {
    expect(src).toContain("I am seeing a pattern around {displayedSnippet}.");
    expect(src).toContain("Let&rsquo;s keep going so I can get it right.");

    expect(src).toContain("You are roughly halfway to your first entry.");
    expect(src).toContain("A few more turns and I will propose a piece for your Manual.");
    expect(src).toContain("You will see it on a card and decide whether it fits.");

    expect(src).toContain("Honest expression produces sharper reflections than careful writing.");
    expect(src).toContain("Typos, tangents, going long &mdash; none of it matters.");
    expect(src).toContain("You can dictate if typing is slowing you down.");
  });

  it("uses 'Keep going' as the dismiss button label", () => {
    expect(src).toContain("Keep going");
  });

  it("declares dialog accessibility attributes", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-labelledby="pattern-forming-modal-heading"');
  });

  it("targets modal_progress = 2 on dismissal POST", () => {
    expect(src).toContain("/api/modal-progress");
    expect(src).toContain("target: 2");
  });

  it("fires modal_2_shown analytics on open", () => {
    expect(src).toContain("trackModal2Shown");
    expect(src).toContain("time_since_signup_ms");
  });

  it("handles Escape and Tab keys", () => {
    expect(src).toContain('"Escape"');
    expect(src).toContain('"Tab"');
  });

  it("snapshots the snippet on first open and renders the snapshot, not the live prop", () => {
    // Snapshot pattern: capture once into local state, do not re-render
    // when the prop shifts mid-open.
    expect(src).toContain("snapshotSnippet");
    expect(src).toContain("setSnapshotSnippet(patternSnippet)");
    expect(src).toContain("displayedSnippet");
  });

  it("locks body scroll while open and restores on close", () => {
    expect(src).toContain('document.body.style.overflow = "hidden"');
    expect(src).toContain("prevOverflow");
  });
});
