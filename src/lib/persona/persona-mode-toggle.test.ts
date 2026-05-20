import { describe, it, expect } from "vitest";
import {
  togglePersonaMode,
  isPersonaMode,
  PERSONA_MODES,
} from "./persona-mode-toggle";

describe("togglePersonaMode", () => {
  it("adds a neurotype mode when not present", () => {
    expect(togglePersonaMode(["autistic"], "adhd")).toEqual([
      "autistic",
      "adhd",
    ]);
  });

  it("removes a neurotype mode when already present", () => {
    expect(togglePersonaMode(["autistic", "adhd"], "adhd")).toEqual([
      "autistic",
    ]);
  });

  it("clears all neurotype modes when general is picked", () => {
    expect(togglePersonaMode(["autistic", "adhd"], "general")).toEqual([
      "general",
    ]);
  });

  it("clears general when a neurotype is picked", () => {
    expect(togglePersonaMode(["general"], "dyslexic")).toEqual(["dyslexic"]);
  });

  it("removes general when general is toggled while selected", () => {
    expect(togglePersonaMode(["general"], "general")).toEqual([]);
  });

  it("supports combining all three neurotype modes", () => {
    let result: ReturnType<typeof togglePersonaMode> = [];
    result = togglePersonaMode(result, "autistic");
    result = togglePersonaMode(result, "adhd");
    result = togglePersonaMode(result, "dyslexic");
    expect(result.sort()).toEqual(["adhd", "autistic", "dyslexic"]);
  });
});

describe("isPersonaMode", () => {
  it("accepts known values", () => {
    for (const m of PERSONA_MODES) {
      expect(isPersonaMode(m)).toBe(true);
    }
  });

  it("rejects unknown strings and non-strings", () => {
    expect(isPersonaMode("audhd")).toBe(false);
    expect(isPersonaMode("")).toBe(false);
    expect(isPersonaMode(null)).toBe(false);
    expect(isPersonaMode(42)).toBe(false);
    expect(isPersonaMode(undefined)).toBe(false);
  });
});
