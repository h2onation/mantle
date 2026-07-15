import { describe, it, expect } from "vitest";
import {
  getModules,
  getEnabledModules,
  getModule,
  isValidModuleSlug,
  resolveModulePrompt,
  validateModulePrompt,
} from "./modules";
import {
  CONDUCTOR_PROMPT,
  CONDUCTOR_REQUIRED_FRAGMENTS,
} from "@/lib/persona/conductor-prompt";

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
    custom_prompt: null,
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
      customPrompt: null,
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

describe("modules — voice ladder (resolveModulePrompt)", () => {
  it("custom prompt wins when set", () => {
    expect(resolveModulePrompt("CUSTOM", "OVERRIDE")).toBe("CUSTOM");
  });

  it("falls to the admin conductor override when custom is null/blank", () => {
    expect(resolveModulePrompt(null, "OVERRIDE")).toBe("OVERRIDE");
    expect(resolveModulePrompt("   ", "OVERRIDE")).toBe("OVERRIDE");
  });

  it("falls to the code conductor when neither is set — never an empty prompt", () => {
    expect(resolveModulePrompt(null, null)).toBe(CONDUCTOR_PROMPT);
    expect(resolveModulePrompt("", "  ")).toBe(CONDUCTOR_PROMPT);
  });
});

describe("modules — custom prompt save guard", () => {
  it("empty/null is valid (means: run the shared conductor)", () => {
    expect(validateModulePrompt(null)).toBeNull();
    expect(validateModulePrompt("")).toBeNull();
    expect(validateModulePrompt("   ")).toBeNull();
  });

  it("a prompt carrying every required fragment passes", () => {
    const text = CONDUCTOR_REQUIRED_FRAGMENTS.map((f) => f.fragment).join("\n");
    expect(validateModulePrompt(text)).toBeNull();
  });

  it("rejects a prompt that drops the crisis lines or reflection markers — same guard as the conductor", () => {
    const err = validateModulePrompt("You are Jove. Be helpful.");
    expect(err).toBeTruthy();
    expect(err).toContain("988");
    expect(err).toContain("---reflection-ready---");
  });

  it("the full conductor prompt itself passes (start-from-conductor path)", () => {
    expect(validateModulePrompt(CONDUCTOR_PROMPT)).toBeNull();
  });
});
