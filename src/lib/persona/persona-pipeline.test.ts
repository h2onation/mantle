import { describe, it, expect } from "vitest";
import {
  reflectionMeterFill,
  resolveReflectionMeter,
  computeInheritedRefinementCount,
  buildEntriesSummary,
  buildPromptOptionsFromContext,
  resolveConversationMode,
  type ConversationContext,
} from "@/lib/persona/persona-pipeline";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { CHECKPOINT_TUNING_DEFAULTS } from "@/lib/persona/checkpoint-tuning";
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

// ─── Refinement-count chain inheritance (Track A Phase 7-Mid) ──────────────
describe("computeInheritedRefinementCount", () => {
  it("returns 0 when there is no previous checkpoint", () => {
    expect(computeInheritedRefinementCount(null)).toBe(0);
  });

  it("returns 0 when previous status is confirmed (chain broken)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "confirmed",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous status is rejected (chain broken)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "rejected",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous status is pending (defensive — not a chain state)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "pending",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous count is undefined (legacy meta rows pre-Phase-7-Mid)", () => {
    expect(
      computeInheritedRefinementCount({ status: "refined" })
    ).toBe(0);
  });

  it("inherits the previous count when previous status is refined", () => {
    expect(
      computeInheritedRefinementCount({
        status: "refined",
        refinement_count: 1,
      })
    ).toBe(1);
  });

  // The case Phase 7-Mid spec called out explicitly to document via
  // a test name. Naming this case "across distinct entries" makes the
  // intent searchable in the codebase: yes, a fresh entry inherits
  // the chain count, and yes, that is intended behavior.
  it("refinement count inherits across distinct entries when chain is unbroken", () => {
    // Setup: the user refined two prior entries about an entirely
    // different topic (call them E1 about topic A, then E2 about topic
    // A again, both refined). Server now composes E3, which happens
    // to be about topic B (a fresh emerging pattern). The chain rule
    // is structural — it looks only at the previous checkpoint's
    // status, not at semantic similarity. Because E2 was refined with
    // count=2, E3 inherits count=2 even though it is about a
    // different topic.
    //
    // Result: the user sees the refinement-ceiling card UI on E3's
    // first attempt. They can accept E3 as-is or let it go.
    //
    // This is intended behavior. Detecting "same pattern" semantically
    // would require fuzzy LLM judgment we do not have. In practice,
    // refinements happen rapidly enough that an unbroken chain is the
    // right proxy for "the user has already pushed back twice and
    // would rather move on than refine a third time." If a user does
    // hit this case across genuinely distinct topics, hitting "Let it
    // go" on E3 breaks the chain (next entry starts fresh at 0).
    const e2RefinedMeta = {
      status: "refined" as const,
      refinement_count: 2,
    };
    expect(computeInheritedRefinementCount(e2RefinedMeta)).toBe(2);
  });
});

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
      checkpointTuning: CHECKPOINT_TUNING_DEFAULTS,
      conductorActive: false,
      reflectionLanded: false,
      mode,
    };
  }

  it("passes mode through to BuildPromptOptions", () => {
    expect(buildPromptOptionsFromContext(makeCtx("guided-intake")).mode).toBe("guided-intake");
    expect(buildPromptOptionsFromContext(makeCtx("situation")).mode).toBe("situation");
  });

  // The guided-intake Tier-3 spine renders only under the rebuilt/legacy voice
  // (rollback), not the live conductor — so these two pin the rollback voice's
  // mode wiring by forcing voiceVariant: "rebuilt".
  it("guided-intake context produces a rebuilt prompt with GUIDED INTAKE block", () => {
    const opts = { ...buildPromptOptionsFromContext(makeCtx("guided-intake")), voiceVariant: "rebuilt" as const };
    const prompt = buildSystemPrompt(opts);
    expect(prompt).toContain("GUIDED INTAKE");
    expect(prompt).toContain("The user opened this mode to be led");
  });

  it("situation context produces a rebuilt prompt WITHOUT GUIDED INTAKE block", () => {
    const opts = { ...buildPromptOptionsFromContext(makeCtx("situation")), voiceVariant: "rebuilt" as const };
    const prompt = buildSystemPrompt(opts);
    expect(prompt).not.toContain("GUIDED INTAKE");
  });

  // Post-promotion (2026-07-02) the live voice is the conductor, so the variant
  // resolves to "conductor" for live traffic. Rollback is LIVE_VOICE_VARIANT.
  it("resolves the voice variant to the live conductor voice", () => {
    expect(buildPromptOptionsFromContext(makeCtx("situation")).voiceVariant).toBe("conductor");
  });
});

describe("reflectionMeterFill (capture-progress)", () => {
  const COOLDOWN = 5;

  it("is full when the gate has passed (capturable)", () => {
    expect(reflectionMeterFill("mechanism", 10, true, COOLDOWN)).toBe(100);
    // gate passed wins even with 0 turns / shallow depth
    expect(reflectionMeterFill("surface", 0, true, COOLDOWN)).toBe(100);
  });

  it("RESETS to 0 right after a save (turnsSinceCheckpoint 0), even when deep", () => {
    expect(reflectionMeterFill("mechanism", 0, false, COOLDOWN)).toBe(0);
  });

  it("ramps back up over the cooldown, capped by depth", () => {
    // deep thread, mechanism depth = 60 (back-loaded curve); cooldown cap
    // rises 20/40/60/80/100
    expect(reflectionMeterFill("mechanism", 1, false, COOLDOWN)).toBe(20);
    expect(reflectionMeterFill("mechanism", 3, false, COOLDOWN)).toBe(60);
    // once the cooldown has fully elapsed, the depth cap (60) takes over
    expect(reflectionMeterFill("mechanism", 5, false, COOLDOWN)).toBe(60);
    expect(reflectionMeterFill("mechanism", 9, false, COOLDOWN)).toBe(60);
  });

  it("stays at zero for a new shallow thread regardless of cooldown (back-loaded curve)", () => {
    expect(reflectionMeterFill("surface", 9, false, COOLDOWN)).toBe(0);
  });

  it("has no cooldown cap when there is no prior checkpoint (Infinity)", () => {
    expect(reflectionMeterFill("mechanism", Infinity, false, COOLDOWN)).toBe(60);
    expect(reflectionMeterFill("surface", Infinity, false, COOLDOWN)).toBe(0);
  });

  it("returns 0 for unknown/empty depth when not ready", () => {
    expect(reflectionMeterFill(null, Infinity, false, COOLDOWN)).toBe(0);
    expect(reflectionMeterFill(undefined, Infinity, false, COOLDOWN)).toBe(0);
  });
});

// The ONE meter resolution shared by the live SSE emit and the reload-restore
// route (2026-07-02 incident: the two paths disagreed — the bar appeared only
// after a browser reload). Conductor regime: fill is depth-only (the open gate
// is never fed in), `ready` means only "strip visible" past the threshold.
describe("resolveReflectionMeter", () => {
  const COOLDOWN = 5;
  const base = (over?: Partial<ExtractionState>) =>
    makeExtractionState(over);

  it("hides the meter (null) with no extraction or during crisis", () => {
    expect(
      resolveReflectionMeter({
        extraction: null,
        turnsSinceCheckpoint: 5,
        cooldownTurns: COOLDOWN,
        reflectionLanded: true,
      }),
    ).toBeNull();
    expect(
      resolveReflectionMeter({
        extraction: base({ clinical_flag: { active: true, level: "crisis", note: "" } }),
        turnsSinceCheckpoint: 5,
        cooldownTurns: COOLDOWN,
        reflectionLanded: true,
      }),
    ).toBeNull();
  });

  it("never claims ready without the landed marker — no ready-at-turn-one on a shallow chat", () => {
    const shallow = resolveReflectionMeter({
      extraction: base({ depth: "surface" }),
      turnsSinceCheckpoint: Infinity,
      cooldownTurns: COOLDOWN,
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
        turnsSinceCheckpoint: Infinity,
        cooldownTurns: COOLDOWN,
        reflectionLanded: false,
      });
      expect(unlanded?.ready).toBe(false);
      expect(unlanded?.fill).toBeLessThanOrEqual(80);
    }
    // Landed → full bar ⇔ strip visible, regardless of depth.
    const landed = resolveReflectionMeter({
      extraction: base({ depth: "feeling" }),
      turnsSinceCheckpoint: Infinity,
      cooldownTurns: COOLDOWN,
      reflectionLanded: true,
    });
    expect(landed).toEqual({ fill: 100, ready: true });
  });
});

describe("resolveConversationMode", () => {
  const ALL_ON = { situation: true, guidedIntake: true, upload: true };

  it("returns the requested mode when its gate is on", () => {
    expect(resolveConversationMode("guided-intake", ALL_ON)).toBe("guided-intake");
    expect(resolveConversationMode("upload", ALL_ON)).toBe("upload");
    expect(resolveConversationMode("situation", ALL_ON)).toBe("situation");
  });

  it("defaults an absent/unknown raw mode to situation when situation is on", () => {
    expect(resolveConversationMode(undefined, ALL_ON)).toBe("situation");
    expect(resolveConversationMode(null, ALL_ON)).toBe("situation");
    expect(resolveConversationMode("nonsense", ALL_ON)).toBe("situation");
  });

  it("falls a disabled optional mode back to situation while situation is on (legacy behavior)", () => {
    expect(
      resolveConversationMode("guided-intake", { situation: true, guidedIntake: false, upload: true })
    ).toBe("situation");
    expect(
      resolveConversationMode("upload", { situation: true, guidedIntake: true, upload: false })
    ).toBe("situation");
  });

  it("honorRequested honors the requested mode even when its gate is off (baseline experiment)", () => {
    const ALL_OFF = { situation: false, guidedIntake: false, upload: false };
    // Situation with the situation gate off would normally fall back; baseline
    // honors it so the admin can run the pilot in Situation regardless.
    expect(resolveConversationMode("situation", ALL_OFF, true)).toBe("situation");
    expect(resolveConversationMode("guided-intake", ALL_OFF, true)).toBe(
      "guided-intake",
    );
    // Default (honorRequested=false) still falls back — unchanged for real users.
    expect(resolveConversationMode("situation", ALL_OFF)).toBe("situation"); // hard floor
    expect(resolveConversationMode("guided-intake", ALL_OFF)).toBe("situation");
  });

  it("guided-solo: situation off → every request resolves to guided", () => {
    const guidedSolo = { situation: false, guidedIntake: true, upload: false };
    expect(resolveConversationMode("situation", guidedSolo)).toBe("guided-intake");
    expect(resolveConversationMode(undefined, guidedSolo)).toBe("guided-intake");
    expect(resolveConversationMode("guided-intake", guidedSolo)).toBe("guided-intake");
    expect(resolveConversationMode("upload", guidedSolo)).toBe("guided-intake");
  });

  it("upload-solo: situation + guided off → everything resolves to upload", () => {
    const uploadSolo = { situation: false, guidedIntake: false, upload: true };
    expect(resolveConversationMode("situation", uploadSolo)).toBe("upload");
    expect(resolveConversationMode("guided-intake", uploadSolo)).toBe("upload");
    expect(resolveConversationMode("upload", uploadSolo)).toBe("upload");
  });

  it("every gate off → situation is the ultimate hard floor (never mode-less)", () => {
    const allOff = { situation: false, guidedIntake: false, upload: false };
    expect(resolveConversationMode("guided-intake", allOff)).toBe("situation");
    expect(resolveConversationMode("upload", allOff)).toBe("situation");
    expect(resolveConversationMode(undefined, allOff)).toBe("situation");
  });
});
