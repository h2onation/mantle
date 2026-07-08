import { describe, it, expect } from "vitest";
import {
  reflectionMeterFill,
  resolveReflectionMeter,
  buildEntriesSummary,
  buildPromptOptionsFromContext,
  resolveConversationMode,
  type ConversationContext,
} from "@/lib/persona/persona-pipeline";
import type { ExtractionState } from "@/lib/persona/extraction";

function makeExtractionState(
  overrides?: Partial<ExtractionState>
): ExtractionState {
  return {
    language_bank: [],
    depth: "surface",
    current_thread: "",
    checkpoint_gate: {
      distinct_contexts: 0,
    },
    clinical_flag: { active: false, level: "none", note: "" },
    sage_brief: "",
    ...overrides,
  };
}

// ─── Entries-summary builder (Track A Phase 7-High) ────────────────────────
describe("buildEntriesSummary", () => {
  it("uses singular 'has material' when only one layer is populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 2,
        confirmedLayerName: "Some of My Patterns",
        otherLayersWithMaterial: [],
        remainingEmptyCount: 4,
      })
    ).toBe(
      "2 entries. Some of My Patterns has material. 4 still empty."
    );
  });

  it("uses 'X and Y have material' when exactly two layers are populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 3,
        confirmedLayerName: "How I Process Things",
        otherLayersWithMaterial: ["Some of My Patterns"],
        remainingEmptyCount: 3,
      })
    ).toBe(
      "3 entries. How I Process Things and Some of My Patterns have material. 3 still empty."
    );
  });

  it("uses Oxford-comma joining when three or more layers are populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 4,
        confirmedLayerName: "What Helps",
        otherLayersWithMaterial: [
          "Some of My Patterns",
          "How I Process Things",
        ],
        remainingEmptyCount: 2,
      })
    ).toBe(
      "4 entries. What Helps, Some of My Patterns, and How I Process Things have material. 2 still empty."
    );
  });

  it("puts the just-confirmed layer first, then the other layers in input order", () => {
    // The confirmedLayerName always leads so the user sees "their new
    // entry's layer" highlighted in the recap.
    const result = buildEntriesSummary({
      entryCount: 5,
      confirmedLayerName: "My Strengths",
      otherLayersWithMaterial: [
        "Some of My Patterns",
        "How I Process Things",
      ],
      remainingEmptyCount: 2,
    });
    const idx1 = result.indexOf("My Strengths");
    const idx2 = result.indexOf("Some of My Patterns");
    expect(idx1).toBeLessThan(idx2);
  });

  it("handles all five layers populated — zero remaining", () => {
    // Not a special case in the spec; the downstream prompt treats
    // "0 still empty" as valid copy.
    expect(
      buildEntriesSummary({
        entryCount: 5,
        confirmedLayerName: "My Strengths",
        otherLayersWithMaterial: [
          "Some of My Patterns",
          "How I Process Things",
          "What Helps",
          "How I Show Up with People",
        ],
        remainingEmptyCount: 0,
      })
    ).toContain("0 still empty.");
  });
});

// ── Conversation mode → prompt integration ──────────────────────────────────

describe("buildPromptOptionsFromContext — mode field", () => {
  function makeCtx(mode: "situation" | "guided-intake"): ConversationContext {
    return {
      messages: [{ role: "user", content: "test" }],
      manualComponents: [],
      previousExtraction: null,
      sessionSummary: null,
      isReturningUser: false,
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnsSinceCheckpoint: Infinity,
      conversationId: "test-conv",
      turnCount: 1,
      personaModes: ["autistic"],
      reflectionMeterEnabled: false,
      extractionEnabled: true,
      voiceOverrides: {},
      reflectionLanded: false,
      mode,
    };
  }

  it("passes mode through to BuildPromptOptions", () => {
    expect(buildPromptOptionsFromContext(makeCtx("guided-intake")).mode).toBe("guided-intake");
    expect(buildPromptOptionsFromContext(makeCtx("situation")).mode).toBe("situation");
  });

  // ── First-entry orientation flag ──────────────────────────────────────
  // True only on turns where Jove could land the user's FIRST-ever readiness:
  // empty Manual + live meter + readiness not yet landed this conversation.
  it("sets firstEntryEducation only for empty-Manual, meter-on, not-yet-landed turns", () => {
    const base = makeCtx("situation");

    // meter off (text surface / gate off) → never
    expect(buildPromptOptionsFromContext(base).firstEntryEducation).toBe(false);

    // qualifying turn → true
    const qualifying = { ...base, reflectionMeterEnabled: true };
    expect(buildPromptOptionsFromContext(qualifying).firstEntryEducation).toBe(true);

    // readiness already landed this conversation → orientation was delivered
    expect(
      buildPromptOptionsFromContext({ ...qualifying, reflectionLanded: true })
        .firstEntryEducation
    ).toBe(false);

    // Manual has entries → user has seen the moment; never again
    expect(
      buildPromptOptionsFromContext({ ...qualifying, isFirstCheckpoint: false })
        .firstEntryEducation
    ).toBe(false);
  });

  // Removed 2026-07-06: the two "rebuilt prompt renders the GUIDED INTAKE
  // Tier-3 block" tests and the "resolves the voice variant" test. The
  // rebuilt/legacy voice worlds (and the Tier-3 GUIDED INTAKE block) were
  // deleted; the conductor is the sole voice and buildSystemPromptBlocks no
  // longer reads voiceVariant.
});

describe("reflectionMeterFill (depth-only)", () => {
  it("maps each depth rung to its back-loaded percent", () => {
    // The bar barely moves through storytelling and does its real rising once
    // the WHY is on the table (surface 0 → origin 80).
    expect(reflectionMeterFill("surface")).toBe(0);
    expect(reflectionMeterFill("behavior")).toBe(8);
    expect(reflectionMeterFill("feeling")).toBe(28);
    expect(reflectionMeterFill("mechanism")).toBe(60);
    expect(reflectionMeterFill("origin")).toBe(80);
  });

  it("does NOT reset or recharge after a save — fill follows depth only", () => {
    // The cooldown cap (and its admin dial) were removed 2026-07-08: a session
    // builds toward one reflection, so there is no post-save refill to pace.
    // Depth is monotonic, so a deep thread keeps its fill straight through.
    expect(reflectionMeterFill("mechanism")).toBe(60);
    expect(reflectionMeterFill("origin")).toBe(80);
  });

  it("returns 0 for unknown/empty depth", () => {
    expect(reflectionMeterFill(null)).toBe(0);
    expect(reflectionMeterFill(undefined)).toBe(0);
    expect(reflectionMeterFill("")).toBe(0);
  });
});

// The ONE meter resolution shared by the live SSE emit and the reload-restore
// route (2026-07-02 incident: the two paths disagreed — the bar appeared only
// after a browser reload). Conductor regime: fill is depth-only (the open gate
// is never fed in), `ready` means only "strip visible" past the threshold.
describe("resolveReflectionMeter", () => {
  const base = (over?: Partial<ExtractionState>) =>
    makeExtractionState(over);

  it("hides the meter (null) with no extraction or during crisis", () => {
    expect(
      resolveReflectionMeter({
        extraction: null,
        reflectionLanded: true,
      }),
    ).toBeNull();
    expect(
      resolveReflectionMeter({
        extraction: base({ clinical_flag: { active: true, level: "crisis", note: "" } }),
        reflectionLanded: true,
      }),
    ).toBeNull();
  });

  it("never claims ready without the landed marker — no ready-at-turn-one on a shallow chat", () => {
    const shallow = resolveReflectionMeter({
      extraction: base({ depth: "surface" }),
      reflectionLanded: false,
    });
    expect(shallow).toEqual({ fill: 0, ready: false });
  });

  it("ready comes ONLY from Jove's landed marker — depth never opens the strip", () => {
    // Every extraction-side proxy fired early (depth: mom-run;
    // depth+pattern_engaged: Guerneville run). Ready is Jove's own published
    // landed judgment. Without it, the bar shows the depth journey and caps at
    // 80 — it can never read full.
    for (const depth of ["feeling", "mechanism", "origin"] as const) {
      const unlanded = resolveReflectionMeter({
        extraction: base({ depth }),
        reflectionLanded: false,
      });
      expect(unlanded?.ready).toBe(false);
      expect(unlanded?.fill).toBeLessThanOrEqual(80);
    }
    // Landed → full bar ⇔ strip visible, regardless of depth.
    const landed = resolveReflectionMeter({
      extraction: base({ depth: "feeling" }),
      reflectionLanded: true,
    });
    expect(landed).toEqual({ fill: 100, ready: true });
  });
});

// Parse-only since 2026-07-06: the per-mode-gate fallback was removed (it had
// been dead since the conductor promotion — the requested mode was always
// honored). The mode gates' live job is hiding home-screen doors via
// /api/onboarding-status, not clamping the server-side mode.
describe("resolveConversationMode", () => {
  it("honors the requested mode", () => {
    expect(resolveConversationMode("guided-intake")).toBe("guided-intake");
    expect(resolveConversationMode("upload")).toBe("upload");
    expect(resolveConversationMode("situation")).toBe("situation");
  });

  it("defaults an absent/unknown raw mode to situation", () => {
    expect(resolveConversationMode(undefined)).toBe("situation");
    expect(resolveConversationMode(null)).toBe("situation");
    expect(resolveConversationMode("nonsense")).toBe("situation");
  });
});
