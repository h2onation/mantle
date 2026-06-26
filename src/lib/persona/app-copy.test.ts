import { describe, it, expect } from "vitest";
import {
  APP_COPY_FIELDS,
  APP_COPY_DEFAULTS,
  resolveAppCopy,
  isAppCopyKey,
  type AppCopy,
} from "@/lib/persona/app-copy";
import type { OverrideRow } from "@/lib/persona/voice-overrides";

// Collect every leaf string in a resolved AppCopy, so a test can assert a
// sentinel override surfaced somewhere without hard-coding the nesting.
function flatten(copy: AppCopy): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(copy);
  return out;
}

const row = (over: Partial<OverrideRow>): OverrideRow => ({
  text_override: null,
  enabled: false,
  ...over,
});

describe("app-copy resolver", () => {
  it("empty rows resolve to the all-defaults object", () => {
    expect(resolveAppCopy(new Map())).toEqual(APP_COPY_DEFAULTS);
  });

  it("a disabled row falls back to the code default", () => {
    const m = new Map<string, OverrideRow>([
      ["door_guided_title", row({ text_override: "Custom", enabled: false })],
    ]);
    expect(resolveAppCopy(m).doors["guided-intake"].title).toBe(
      APP_COPY_FIELDS.door_guided_title.getDefault(),
    );
  });

  it("an enabled but blank row falls back to the code default", () => {
    const m = new Map<string, OverrideRow>([
      ["door_guided_title", row({ text_override: "   ", enabled: true })],
    ]);
    expect(resolveAppCopy(m).doors["guided-intake"].title).toBe("Guided");
  });

  it("an enabled, non-blank row overrides the default", () => {
    const m = new Map<string, OverrideRow>([
      ["seed_begin_button", row({ text_override: "Let’s go", enabled: true })],
    ]);
    expect(resolveAppCopy(m).seed.beginButton).toBe("Let’s go");
  });

  it("every registered key is wired into the resolved object", () => {
    // Catches a key added to the registry but forgotten in resolveAppCopy.
    for (const key of Object.keys(APP_COPY_FIELDS)) {
      const sentinel = `__sentinel_${key}__`;
      const m = new Map<string, OverrideRow>([
        [key, row({ text_override: sentinel, enabled: true })],
      ]);
      expect(flatten(resolveAppCopy(m))).toContain(sentinel);
    }
  });

  it("isAppCopyKey accepts registered keys and rejects everything else", () => {
    expect(isAppCopyKey("door_guided_title")).toBe(true);
    expect(isAppCopyKey("seed_body1")).toBe(true);
    // A voice-override key is NOT an app-copy key (separate registries).
    expect(isAppCopyKey("rebuilt_character")).toBe(false);
    expect(isAppCopyKey("nope")).toBe(false);
    expect(isAppCopyKey(123)).toBe(false);
  });

  it("default entry-door copy carries no clinical framing", () => {
    const doorText = Object.values(APP_COPY_DEFAULTS.doors)
      .flatMap((d) => [d.title, d.desc, d.cue])
      .join(" ");
    expect(doorText).not.toMatch(
      /\btherapy\b|\bdiagnos|\bassessment\b|\bdisorder\b/i,
    );
  });
});
