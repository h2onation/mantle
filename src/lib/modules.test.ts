import { describe, it, expect } from "vitest";
import {
  getModules,
  getEnabledModules,
  getModule,
  isValidModuleSlug,
  validateModuleBrief,
} from "./modules";

type Row = Record<string, unknown>;

// Minimal admin stub for the modules select paths. Supports the two query
// shapes the lib uses: list (order().order()) and single (eq().maybeSingle()).
function fakeAdmin(rows: Row[], opts?: { error?: boolean }) {
  const result = opts?.error
    ? { data: null, error: { message: "boom" } }
    : { data: rows, error: null };
  return {
    from: () => ({
      select: () => ({
        order: () => ({
          order: async () => result,
        }),
        eq: (_col: string, slug: string) => ({
          maybeSingle: async () =>
            opts?.error
              ? { data: null, error: { message: "boom" } }
              : { data: rows.find((r) => r.slug === slug) ?? null, error: null },
        }),
      }),
    }),
  } as never;
}

function row(overrides: Row = {}): Row {
  return {
    slug: "burnout",
    name: "Burnout at work",
    description: "When work drains more than it gives.",
    cue: "Begin",
    icon: "chat",
    intro_title: null,
    intro_body: null,
    opener_text: null,
    brief: null,
    enabled: true,
    sort_order: 0,
    updated_at: "2026-07-15T00:00:00Z",
    ...overrides,
  };
}

describe("modules — slug validation", () => {
  it("accepts lowercase slugs with digits, hyphens, underscores", () => {
    expect(isValidModuleSlug("burnout")).toBe(true);
    expect(isValidModuleSlug("work-money")).toBe(true);
    expect(isValidModuleSlug("guided_intake")).toBe(true);
    expect(isValidModuleSlug("a1")).toBe(true);
  });

  it("rejects uppercase, spaces, leading separators, non-strings, over-length", () => {
    expect(isValidModuleSlug("Burnout")).toBe(false);
    expect(isValidModuleSlug("two words")).toBe(false);
    expect(isValidModuleSlug("-lead")).toBe(false);
    expect(isValidModuleSlug("")).toBe(false);
    expect(isValidModuleSlug(null)).toBe(false);
    expect(isValidModuleSlug(42)).toBe(false);
    expect(isValidModuleSlug("a".repeat(65))).toBe(false);
  });
});

describe("modules — reads", () => {
  it("maps rows to Module shape", async () => {
    const mods = await getModules(fakeAdmin([row()]));
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({
      slug: "burnout",
      name: "Burnout at work",
      cue: "Begin",
      icon: "chat",
      openerText: null,
      brief: null,
      enabled: true,
      sortOrder: 0,
    });
  });

  it("fails safe to an empty list on error — blank module set is a real state", async () => {
    expect(await getModules(fakeAdmin([], { error: true }))).toEqual([]);
    expect(await getModules(fakeAdmin([]))).toEqual([]);
  });

  it("getEnabledModules filters disabled modules (door hides, section survives elsewhere)", async () => {
    const mods = await getEnabledModules(
      fakeAdmin([row(), row({ slug: "retired", enabled: false })]),
    );
    expect(mods.map((m) => m.slug)).toEqual(["burnout"]);
  });

  it("getModule returns disabled modules too, and null for unknown/invalid slugs", async () => {
    const admin = fakeAdmin([row({ slug: "retired", enabled: false })]);
    expect((await getModule(admin, "retired"))?.enabled).toBe(false);
    expect(await getModule(admin, "nope")).toBeNull();
    expect(await getModule(admin, "NOT A SLUG")).toBeNull();
  });
});

describe("modules — brief save guard (validateModuleBrief)", () => {
  it("empty/null is valid (means: no extra steering)", () => {
    expect(validateModuleBrief(null)).toBeNull();
    expect(validateModuleBrief("")).toBeNull();
    expect(validateModuleBrief("   ")).toBeNull();
  });

  it("plain prose passes — including prose that mentions dashes mid-sentence", () => {
    expect(
      validateModuleBrief(
        "This module is about sensory load — what drains, what restores. Listen for recovery patterns.",
      ),
    ).toBeNull();
  });

  it("rejects a standalone ---marker--- line — markers are code-owned machinery", () => {
    const err = validateModuleBrief(
      "Listen for burnout.\n---reflection-ready---\nThen offer to save.",
    );
    expect(err).toBeTruthy();
    expect(err).toContain("marker");
    expect(validateModuleBrief("---sections---")).toBeTruthy();
  });
});
