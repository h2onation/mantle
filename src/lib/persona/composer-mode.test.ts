import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getComposerMode,
  normalizeComposerMode,
  DEFAULT_COMPOSER_MODE,
} from "@/lib/persona/composer-mode";

// A minimal admin-client stub: only the persona_voice_overrides read path used
// by getComposerMode. Returns whatever `row` is set to.
function makeAdmin(row: { text_override: string | null; enabled: boolean } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row }),
        }),
      }),
    }),
    // getComposerMode's throw path
    _throws: false,
  } as never;
}

function makeThrowingAdmin() {
  return {
    from: () => {
      throw new Error("db down");
    },
  } as never;
}

describe("normalizeComposerMode", () => {
  it("accepts the three valid modes, case/space-insensitive", () => {
    expect(normalizeComposerMode("composer")).toBe("composer");
    expect(normalizeComposerMode(" Conductor ")).toBe("conductor");
    expect(normalizeComposerMode("COMPARE")).toBe("compare");
  });
  it("rejects anything else", () => {
    expect(normalizeComposerMode("classic")).toBeNull();
    expect(normalizeComposerMode("")).toBeNull();
    expect(normalizeComposerMode(null)).toBeNull();
    expect(normalizeComposerMode(3)).toBeNull();
  });
});

describe("getComposerMode resolution order", () => {
  const prev = process.env.COMPOSER_MODE;
  beforeEach(() => {
    delete process.env.COMPOSER_MODE;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.COMPOSER_MODE;
    else process.env.COMPOSER_MODE = prev;
    vi.restoreAllMocks();
  });

  it("uses an enabled admin-toggle row first", async () => {
    const mode = await getComposerMode(makeAdmin({ text_override: "compare", enabled: true }));
    expect(mode).toBe("compare");
  });

  it("ignores a disabled row and falls back to env", async () => {
    process.env.COMPOSER_MODE = "conductor";
    const mode = await getComposerMode(makeAdmin({ text_override: "compare", enabled: false }));
    expect(mode).toBe("conductor");
  });

  it("ignores an enabled row with an invalid value, falls back to env", async () => {
    process.env.COMPOSER_MODE = "compare";
    const mode = await getComposerMode(makeAdmin({ text_override: "bogus", enabled: true }));
    expect(mode).toBe("compare");
  });

  it("falls back to the default when no row and no env", async () => {
    const mode = await getComposerMode(makeAdmin(null));
    expect(mode).toBe(DEFAULT_COMPOSER_MODE);
    expect(mode).toBe("composer");
  });

  it("fails safe to env/default on a DB error", async () => {
    process.env.COMPOSER_MODE = "conductor";
    const mode = await getComposerMode(makeThrowingAdmin());
    expect(mode).toBe("conductor");
  });
});
