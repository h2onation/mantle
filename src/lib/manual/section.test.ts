import { describe, it, expect } from "vitest";
import { sectionName, formatLayerEyebrow } from "./layers";
import { buildLayers } from "@/components/mobile/manual/layer-definitions";
import type { ManualEntry } from "@/lib/types";

describe("sectionName — display name for a section slug", () => {
  it("returns the display name for a known slug", () => {
    expect(sectionName("relationships")).toBe("Relationships");
    expect(sectionName("work-money")).toBe("Work and career");
  });

  it("falls back without throwing for null/unknown", () => {
    expect(sectionName(null)).toBe("Section");
    expect(formatLayerEyebrow("__nope__")).toBe("Suggested Entry");
  });
});

describe("buildLayers — every entry homes on one of the five sections", () => {
  const entries: ManualEntry[] = [
    { id: "r1", section: "relationships", name: "R", content: "...", layer: null },
    { id: "w1", section: "work-money", name: "W", content: "...", layer: null },
  ];

  it("groups entries by section and produces exactly five sections", () => {
    const layers = buildLayers(entries);
    expect(layers).toHaveLength(5);
    expect(layers.find((l) => l.slug === "relationships")?.entries.map((e) => e.id)).toContain("r1");
    expect(layers.find((l) => l.slug === "work-money")?.entries.map((e) => e.id)).toContain("w1");
  });

  it("never produces a sixth (held) group", () => {
    const layers = buildLayers(entries);
    const slugs = layers.map((l) => l.slug);
    expect(slugs).toEqual([
      "relationships",
      "work-money",
      "routines-structure",
      "sensory-burnout",
      "interests-flow",
    ]);
  });

  it("drops a stray null/unknown-section entry rather than resurrecting a sixth group", () => {
    const stray: ManualEntry = { id: "x1", section: null, name: "Stray", content: "...", layer: 2 };
    const layers = buildLayers([entries[0], stray]);
    expect(layers).toHaveLength(5);
    expect(layers.flatMap((l) => l.entries.map((e) => e.id))).not.toContain("x1");
  });

  it("is pure display — does not mutate the entries it groups", () => {
    const frozen = Object.freeze({ ...entries[0] });
    expect(() => buildLayers([frozen])).not.toThrow();
    expect(frozen.section).toBe("relationships");
  });
});
