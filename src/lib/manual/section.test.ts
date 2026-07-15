import { describe, it, expect } from "vitest";
import { sectionName, formatLayerEyebrow } from "./layers";
import { buildModuleGroups } from "@/components/mobile/manual/layer-definitions";
import type { HomeModule } from "@/lib/modules";
import type { ManualEntry } from "@/lib/types";

describe("sectionName — display name for a section slug", () => {
  it("returns the display name for a legacy five-section slug", () => {
    expect(sectionName("relationships")).toBe("Relationships");
    expect(sectionName("work-money")).toBe("Work and career");
  });

  it("humanizes an unknown module slug instead of throwing", () => {
    expect(sectionName("burnout-at-work")).toBe("Burnout at work");
    expect(sectionName(null)).toBe("Section");
    expect(formatLayerEyebrow("burnout-at-work")).toBe("Burnout at work");
  });
});

const mod = (slug: string, over: Partial<HomeModule> = {}): HomeModule => ({
  slug,
  name: slug,
  description: "about " + slug,
  cue: "Begin",
  icon: "chat",
  introTitle: null,
  introBody: null,
  enabled: true,
  ...over,
});

describe("buildModuleGroups — the Manual groups by modules", () => {
  const entries: ManualEntry[] = [
    { id: "b1", section: "burnout", name: "B", content: "...", layer: null },
    { id: "r1", section: "retired-mod", name: "R", content: "...", layer: null },
  ];

  it("one group per module, in module order; entries file by section slug", () => {
    const groups = buildModuleGroups([mod("burnout"), mod("evenings")], entries);
    expect(groups.map((g) => g.slug)).toEqual(["burnout", "evenings"]);
    expect(groups[0].entries.map((e) => e.id)).toEqual(["b1"]);
    expect(groups[1].entries).toEqual([]); // enabled + empty still renders
  });

  it("a DISABLED module renders only while it still holds entries — nothing orphans", () => {
    const groups = buildModuleGroups(
      [mod("burnout"), mod("retired-mod", { enabled: false }), mod("retired-empty", { enabled: false })],
      entries,
    );
    expect(groups.map((g) => g.slug)).toEqual(["burnout", "retired-mod"]);
    expect(groups.find((g) => g.slug === "retired-mod")?.enabled).toBe(false);
  });

  it("an entry whose module row is gone simply doesn't render (guard)", () => {
    const groups = buildModuleGroups([mod("burnout")], entries);
    expect(groups.flatMap((g) => g.entries.map((e) => e.id))).not.toContain("r1");
  });

  it("is pure display — does not mutate the entries it groups", () => {
    const frozen = Object.freeze({ ...entries[0] });
    expect(() => buildModuleGroups([mod("burnout")], [frozen])).not.toThrow();
    expect(frozen.section).toBe("burnout");
  });
});
