import { describe, it, expect } from "vitest";
import {
  DOORS,
  DOOR_INTRO_FIELDS,
  DOOR_INTRO_EYEBROW,
  getDoorIntros,
  introTitleKey,
  introBodyKey,
  isDoorIntroKey,
} from "./door-intros";

// Minimal admin stub: only the persona_voice_overrides select path is used by
// getDoorIntros (via readOverrideRows). Returns the supplied rows.
function fakeAdmin(rows: Array<{ key: string; text_override: string | null; enabled: boolean }>) {
  return {
    from: () => ({
      select: async () => ({ data: rows, error: null }),
    }),
  } as never;
}

describe("door-intros — DOORS", () => {
  it("defines exactly the three intake doors in welcome-card order", () => {
    expect(DOORS.map((d) => d.mode)).toEqual([
      "situation",
      "guided-intake",
      "upload",
    ]);
  });

  it("gives only upload a fixed openerKey — situation and guided-intake open live", () => {
    const byMode = Object.fromEntries(DOORS.map((d) => [d.mode, d]));
    expect(byMode.situation.openerKey).toBeUndefined();
    expect(byMode.upload.openerKey).toBe("upload_opener");
    // Guided-intake's opener is a generated tee-up, not a fixed string.
    expect(byMode["guided-intake"].openerKey).toBeUndefined();
  });

  it("uses underscore slugs (no hyphens) for override keys", () => {
    expect(DOORS.map((d) => d.slug)).toEqual([
      "situation",
      "guided_intake",
      "upload",
    ]);
  });
});

describe("door-intros — DOOR_INTRO_FIELDS", () => {
  it("registers a title + body key per door with non-empty defaults", () => {
    for (const d of DOORS) {
      const tKey = introTitleKey(d.slug);
      const bKey = introBodyKey(d.slug);
      expect(isDoorIntroKey(tKey)).toBe(true);
      expect(isDoorIntroKey(bKey)).toBe(true);
      expect(DOOR_INTRO_FIELDS[tKey].getDefault().length).toBeGreaterThan(0);
      expect(DOOR_INTRO_FIELDS[bKey].getDefault().length).toBeGreaterThan(0);
    }
  });

  it("keeps the 'nothing without your yes' anchor in every default body", () => {
    for (const d of DOORS) {
      expect(DOOR_INTRO_FIELDS[introBodyKey(d.slug)].getDefault()).toContain(
        "Nothing gets written without your yes.",
      );
    }
  });

  it("rejects unknown keys", () => {
    expect(isDoorIntroKey("situation_opener")).toBe(false);
    expect(isDoorIntroKey("nope_intro_title")).toBe(false);
  });
});

describe("door-intros — getDoorIntros resolution", () => {
  it("falls back to code defaults when no rows exist", async () => {
    const intros = await getDoorIntros(fakeAdmin([]));
    expect(intros.situation.eyebrow).toBe(DOOR_INTRO_EYEBROW);
    expect(intros.situation.title).toBe(
      DOOR_INTRO_FIELDS[introTitleKey("situation")].getDefault(),
    );
    expect(intros["guided-intake"].title).toBe("Guided intake");
  });

  it("uses an enabled override and ignores a disabled one", async () => {
    const intros = await getDoorIntros(
      fakeAdmin([
        { key: introTitleKey("situation"), text_override: "Custom title", enabled: true },
        { key: introBodyKey("upload"), text_override: "Disabled body", enabled: false },
      ]),
    );
    expect(intros.situation.title).toBe("Custom title");
    // Disabled → code default.
    expect(intros.upload.body).toBe(
      DOOR_INTRO_FIELDS[introBodyKey("upload")].getDefault(),
    );
  });

  it("ignores an enabled-but-blank override", async () => {
    const intros = await getDoorIntros(
      fakeAdmin([
        { key: introTitleKey("upload"), text_override: "   ", enabled: true },
      ]),
    );
    expect(intros.upload.title).toBe(
      DOOR_INTRO_FIELDS[introTitleKey("upload")].getDefault(),
    );
  });
});
