import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Source-string structural tests — same pattern as the other modal tests.
// DoorIntroModal is presentational (copy comes from the Intake doors admin
// panel via props), so we pin the structural contracts rather than copy.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("DoorIntroModal — per-door intro", () => {
  const src = read("src/components/modals/DoorIntroModal.tsx");

  it("renders the per-door copy from props (eyebrow, title, body)", () => {
    expect(src).toContain("{eyebrow}");
    expect(src).toContain("{cleanTitle}");
    // Body is split into paragraphs and mapped.
    expect(src).toContain("paragraphs.map");
  });

  it("splits the body on blank lines into paragraphs", () => {
    expect(src).toContain("body.split(/\\n\\s*\\n/)");
  });

  it("keeps the actionable dismiss button", () => {
    expect(src).toContain("Got it ›");
    expect(src).toContain("onClick={onDismiss}");
  });

  it("is an accessible labelled dialog", () => {
    expect(src).toContain('ariaLabelledBy="door-intro-modal-heading"');
    expect(src).toContain('id="door-intro-modal-heading"');
  });

  it("traps Tab on the single button and dismisses on the Modal's onClose", () => {
    expect(src).toContain('e.key === "Tab"');
    expect(src).toContain("onClose={onDismiss}");
  });

  it("does not hardcode door copy (it is admin-editable)", () => {
    // The old global modal hardcoded its body; this one must not.
    expect(src).not.toContain("This is where you talk to");
  });
});
