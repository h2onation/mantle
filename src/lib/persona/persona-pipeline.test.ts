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
      conductorPromptSha: null,
      reflectionLanded: false,
      mode,
    };
  }

  it("passes mode through to BuildPromptOptions", () => {
    expect(buildPromptOptionsFromContext(makeCtx("guided-intake")).mode).toBe("guided-intake");
    expect(buildPromptOptionsFromContext(makeCtx("situation")).mode).toBe("situation");
  });

  // ── First-entry orientation flag ──────────────────────────────────────
  // (The first-entry orientation is no longer a prompt flag computed here — it
  // moved to a deterministic server-append at the landing turn, tested by
  // shouldAppendFirstEntryEducation in call-persona.test.ts. v0.8.3.)

  // Removed 2026-07-06: the two "rebuilt prompt renders the GUIDED INTAKE
  // Tier-3 block" tests and the "resolves the voice variant" test. The
  // rebuilt/legacy voice worlds (and the Tier-3 GUIDED INTAKE block) were
  // deleted; the conductor is the sole voice and buildSystemPromptBlocks no
  // longer reads voiceVariant.
});

describe("reflectionMeterFill (depth-only)", () => {
  it("maps each depth rung to its back-loaded percent", () => {
    // The bar barely moves through storytelling and does its real rising once
    // the WHY is on the table (surface 0 → mechanism 75; the last quarter is
    // the landed marker).
    expect(reflectionMeterFill("surface")).toBe(0);
    expect(reflectionMeterFill("behavior")).toBe(15);
    expect(reflectionMeterFill("feeling")).toBe(40);
    expect(reflectionMeterFill("mechanism")).toBe(75);
  });

  it("normalizes the removed legacy 'origin' rung to mechanism", () => {
    // "origin" was cut from the ladder 2026-07-09 (Jove never excavates
    // origins, so the rung was unreachable) — but stored extraction states
    // may still carry it. It must render as the top rung, never as 0.
    expect(reflectionMeterFill("origin")).toBe(75);
  });

  it("does NOT reset or recharge after a save — fill follows depth only", () => {
    // The cooldown cap (and its admin dial) were removed 2026-07-08: a session
    // builds toward one reflection, so there is no post-save refill to pace.
    // Depth is monotonic, so a deep thread keeps its fill straight through.
    expect(reflectionMeterFill("mechanism")).toBe(75);
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
    // 75 — it can never read full.
    for (const depth of ["feeling", "mechanism"] as const) {
      const unlanded = resolveReflectionMeter({
        extraction: base({ depth }),
        reflectionLanded: false,
      });
      expect(unlanded?.ready).toBe(false);
      expect(unlanded?.fill).toBeLessThanOrEqual(75);
    }
    // Landed → full bar ⇔ strip visible, regardless of depth.
    const landed = resolveReflectionMeter({
      extraction: base({ depth: "feeling" }),
      reflectionLanded: true,
    });
    expect(landed).toEqual({ fill: 100, ready: true });
  });
});

// Passthrough since the modules cutover (2026-07-15): the stored mode IS the
// module slug, validated against enabled modules at conversation creation by
// /api/chat. Legacy rows keep the retired door values; there is no default
// module, so null/undefined normalize to "" rather than a phantom mode.
describe("resolveConversationMode", () => {
  it("honors the stored slug, including legacy door values", () => {
    expect(resolveConversationMode("guided-intake")).toBe("guided-intake");
    expect(resolveConversationMode("burnout-at-work")).toBe("burnout-at-work");
    expect(resolveConversationMode("situation")).toBe("situation");
  });

  it("normalizes an absent mode to the empty string (never null downstream)", () => {
    expect(resolveConversationMode(undefined)).toBe("");
    expect(resolveConversationMode(null)).toBe("");
  });
});
