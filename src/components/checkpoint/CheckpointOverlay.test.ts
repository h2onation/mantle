import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Source-string contract tests pinning the regression-critical
// behaviors of the post-confirm auto-close path. Same pattern as
// ChatWindowModal.test.ts — the unit-test environment is node without
// jsdom/RTL, so we pin the source shape rather than mount the component.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("CheckpointOverlay — post-confirm dismissal hardening", () => {
  const src = read("src/components/checkpoint/CheckpointOverlay.tsx");

  it("captures onClose in a ref so the auto-close timer survives parent re-renders", () => {
    // The parent (MobileSession) passes onClose as an inline arrow
    // function. During the post-confirm stream the parent re-renders
    // many times — if the timer effect depended on onClose directly,
    // every render would clearTimeout+setTimeout and the 1600ms window
    // would never elapse, stranding the confirmed cover on screen.
    expect(src).toContain("const onCloseRef = useRef(onClose)");
    expect(src).toMatch(/onCloseRef\.current\s*=\s*onClose/);
  });

  it("calls onCloseRef.current() inside the success setTimeout, not onClose", () => {
    expect(src).toContain("setTimeout(() => onCloseRef.current(), 1600)");
    expect(src).not.toContain("setTimeout(() => onClose(), 1600)");
  });

  it("excludes onClose from the deps of the confirmStatus-driven effect", () => {
    // The effect body lives inline; scan the file for the success-
    // timer block and assert its dependency array is [confirmStatus, open].
    const match = src.match(
      /confirmStatus === "success"[\s\S]*?\}, \[([^\]]+)\]/
    );
    expect(match, "could not locate confirmStatus effect deps").toBeTruthy();
    const deps = match![1].trim();
    expect(deps).not.toMatch(/\bonClose\b/);
    expect(deps).toContain("confirmStatus");
    expect(deps).toContain("open");
  });

  it("Escape key dismisses the overlay in every phase, not just actions", () => {
    // The previous version gated dismissal on `phase === "actions"`,
    // which left a user stranded if the confirmed cover got stuck for
    // any reason. The new handler always closes on Escape.
    expect(src).not.toMatch(/phase === "actions"\) onClose\(\)/);
    // Inline arrow inside the Escape handler must call onCloseRef directly.
    const handlerMatch = src.match(
      /e\.key === "Escape"[\s\S]{0,200}?onCloseRef\.current\(\)/
    );
    expect(handlerMatch, "Escape handler should invoke onCloseRef.current()").toBeTruthy();
  });

  it("Escape effect does not depend on onClose or phase", () => {
    // After the fix the Escape handler reads onClose through the ref and
    // does not gate on phase, so its dependency array shrinks to [open].
    const match = src.match(
      /e\.key === "Escape"[\s\S]*?\}, \[([^\]]+)\]\);/
    );
    expect(match, "could not locate Escape effect deps").toBeTruthy();
    const deps = match![1].trim();
    expect(deps).not.toMatch(/\bonClose\b/);
    expect(deps).not.toMatch(/\bphase\b/);
  });

  it("still locks body scroll on open and restores on close", () => {
    // Unchanged behavior; pin so a future refactor doesn't drop it.
    expect(src).toContain('document.body.style.overflow = "hidden"');
  });
});
