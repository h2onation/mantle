import { describe, it, expect } from "vitest";
import { sectionForEntry, HELD_SECTION, sectionName, formatLayerEyebrow } from "./layers";
import { buildLayers } from "@/components/mobile/manual/layer-definitions";
import type { ManualEntry } from "@/lib/types";

// Step 3 checkpoint #1 — the no-write-back guard. Rendering a parked
// (NULL-section) entry must NEVER persist a section back to it. sectionForEntry
// is a pure display helper; grouping must not mutate the data.
describe("sectionForEntry — pure display, no write-back", () => {
  it("returns HELD_SECTION for a null-section entry WITHOUT mutating it", () => {
    const entry = Object.freeze({ section: null, name: "x", content: "y" });
    expect(sectionForEntry(entry)).toBe(HELD_SECTION);
    expect(entry.section).toBeNull(); // untouched
  });

  it("returns the slug for a homed entry", () => {
    expect(sectionForEntry({ section: "relationships" })).toBe("relationships");
  });

  it("HELD_SECTION is a sentinel, never a real section slug", () => {
    expect(sectionName(HELD_SECTION)).toBe(HELD_SECTION); // not a known section name
    expect(formatLayerEyebrow(HELD_SECTION)).toBe("Suggested Entry"); // unknown slug → fallback
  });
});

describe("buildLayers — parked entries land in the held group; section stays null", () => {
  const entries: ManualEntry[] = [
    { id: "r1", section: "relationships", name: "R", content: "...", layer: null },
    { id: "p1", section: null, name: "Parked self-pattern", content: "...", layer: 2 },
  ];

  it("groups by section and gathers NULL-section entries into the held group", () => {
    const layers = buildLayers(entries);
    const rel = layers.find((l) => l.slug === "relationships");
    const held = layers.find((l) => l.slug === HELD_SECTION);
    expect(rel?.entries.map((e) => e.id)).toContain("r1");
    expect(held?.isHeld).toBe(true);
    expect(held?.entries.map((e) => e.id)).toContain("p1");
  });

  it("does NOT write a section back to the parked entry (no-write-back guard)", () => {
    buildLayers(entries);
    expect(entries[1].section).toBeNull(); // still parked in the data
  });

  it("omits the held group entirely when no entries are parked", () => {
    const layers = buildLayers([entries[0]]);
    expect(layers.find((l) => l.slug === HELD_SECTION)).toBeUndefined();
  });
});
