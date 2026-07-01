// ─────────────────────────────────────────────────────────────────────────────
// STRIP-TO-BASELINE EXPERIMENT (Part A) — temporary harness.
//
// Goal: run Jove on near-zero instruction and read how close the SAVE TIMING
// lands to a real seam on raw model judgment, then add forces back one at a
// time to find which one breaks the timing.
//
// OFF BY DEFAULT + ADMIN-SCOPED. The switches live in the admin-only
// `baseline_experiment_gates` table (read here, written via
// /api/admin/baseline-experiment). The baseline variant is applied ONLY for
// admin users (persona-pipeline.ts → loadConversationContext resolves
// baselineActive = isAdmin && enabled), so a stripped Jove can never reach a
// real user. With the master switch off — its default, fail-closed — every live
// path is byte-identical to today.
//
// TEARDOWN (when the experiment concludes): delete this module, the
// `baseline_experiment_gates` table (drop migration), the route
// /api/admin/baseline-experiment, BaselineExperimentPanel + its mount in
// admin/page.tsx, the `baseline` branch in system-prompt.ts, the baselineForces
// / baselineGateOpen / isAdmin threading in persona-pipeline.ts + call-persona.ts
// + chat/route.ts, and the "baseline" member of VoiceVariant.
//
// The prompt WORDING below is the experiment's confound and is held FIXED across
// every run. Read it as DIRECTIONAL: even the neutral identity and the bare save
// contract leak some instruction (naming a save mechanism at all implies saves
// happen). "Close to seam timing on near-minimal instruction" is the finding;
// "perfect native seam timing" would be over-reading it.
//
// CRISIS SAFETY IS NOT BEHIND ANY SWITCH. The 988 path stays on even fully
// stripped — on three independent layers: handleCrisisDetection (runs every
// turn regardless of variant), the gate's crisis block (preserved inside the
// baseline bypass), and the LIMITS #2 988 clause (always in the baseline prompt).
// ─────────────────────────────────────────────────────────────────────────────

import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-force add-back toggles. ALL FALSE = the thinnest baseline (every
 * timing/shaping force stripped, gate open). Flip exactly ONE true at a time to
 * add a single force back, then re-run. Run-scoping picks the order; the
 * sequence must END with an intake-mode arm, because guided intake is where the
 * original thin-entry bug lives and a fix proven only in situation mode isn't
 * proven where the bug is.
 *
 * Granularity follows the approved REBUILT_MECHANICS carve (MECHANICS_PARTS in
 * voice-scaffold.ts): the old single `mechanics` toggle is split into the three
 * rungs the ladder needs — flag-don't-grab, seam rule, deepening — so each adds
 * exactly one force. `MECH_STOPWAIT` is deliberately NOT a rung: it's downstream
 * of the save offer (can't move offer timing) and already covered by the
 * baseline save contract.
 */
export interface BaselineForces {
  /** Re-enable the server gate (validateMaterialQuality checklist + cooldown).
   *  False = gate open: any time Jove emits the transition line, it saves —
   *  crisis still blocks. */
  gate: boolean;
  /** Rung 1 "flag-don't-grab": pre-proposal restraint (MECHANICS_PARTS.flag) —
   *  flag worth-keeping material in passing and stay with the thread, which buys
   *  the user the turns to land. The operative half of the patent's wait-step;
   *  the post-proposal "wait" is already in the baseline contract. */
  flagDontGrab: boolean;
  /** Rung 2 "seam rule": MECHANICS_PARTS.seam — propose only at a seam, ready
   *  material doesn't mean now. The explicit WHEN. */
  seamRule: boolean;
  /** Rung 3 "MECHANICS deepening": the rest of REBUILT_MECHANICS (open /
   *  walk-one-moment / never-said test / feeling-is-the-doorway / proposal form).
   *  With flagDontGrab + seamRule also on, this is the full live mechanics. */
  mechanicsDeepening: boolean;
  /** Rung 4: swap the neutral identity for REBUILT_CHARACTER (pattern-naming,
   *  handoff, lay-out-choices — the character-level shaping). */
  characterShaping: boolean;
  /** Final arm: render the mode's Tier-3 guidance blocks (includes the
   *  guided-intake spine — one-piece-worth-saving, MISSING-PIECE STEERING — only
   *  when the run is in intake mode; the spine can't render in situation mode). */
  tier3Blocks: boolean;
}

/** All forces off — the thinnest baseline, and the fallback when nothing is set. */
export const DEFAULT_BASELINE_FORCES: BaselineForces = {
  gate: false,
  flagDontGrab: false,
  seamRule: false,
  mechanicsDeepening: false,
  characterShaping: false,
  tier3Blocks: false,
};

/** Resolved experiment state for a turn: the master switch + the six forces. */
export interface BaselineExperiment {
  /** Master: put Jove into the baseline variant at all. */
  enabled: boolean;
  /** Conductor voice (founder's self-contained prompt, conductor-prompt.ts).
   *  Takes PRECEDENCE over `enabled` when both are on — the variant selector
   *  picks conductor first, so flipping it on doesn't require un-setting the
   *  baseline master. Reads none of the force toggles: the conductor branch is
   *  structurally incapable of including REBUILT_MECHANICS. */
  conductor: boolean;
  forces: BaselineForces;
}

/** Default = experiment off, all forces off. The fail-closed value. */
export function defaultBaselineExperiment(): BaselineExperiment {
  return { enabled: false, conductor: false, forces: { ...DEFAULT_BASELINE_FORCES } };
}

/**
 * Maps a `baseline_experiment_gates.key` row to where it lands: the master
 * `enabled` flag or one of the six force fields. Single source of truth — the
 * admin route validates writes against it and the reader maps rows through it.
 */
export const BASELINE_GATE_KEYS: Record<
  string,
  "enabled" | "conductor" | keyof BaselineForces
> = {
  enabled: "enabled",
  conductor: "conductor",
  force_gate: "gate",
  force_flag_dont_grab: "flagDontGrab",
  force_seam_rule: "seamRule",
  force_mechanics_deepening: "mechanicsDeepening",
  force_character_shaping: "characterShaping",
  force_tier3_blocks: "tier3Blocks",
};

export type BaselineGateKey = keyof typeof BASELINE_GATE_KEYS;

export function isBaselineGateKey(value: unknown): value is BaselineGateKey {
  return typeof value === "string" && value in BASELINE_GATE_KEYS;
}

/**
 * Read the current baseline-experiment switches. Fails CLOSED to
 * defaultBaselineExperiment() (experiment off) on any error, missing table, or
 * missing row — so an absent/unreachable table behaves exactly as production
 * does today. Pass the service-role admin client (the table has no
 * client-readable RLS policy by design). Callers must ALSO gate application on
 * the user being an admin; this read alone does not enforce that.
 */
export async function getBaselineExperiment(
  admin: ReturnType<typeof createAdminClient>,
): Promise<BaselineExperiment> {
  try {
    const { data, error } = await admin
      .from("baseline_experiment_gates")
      .select("key, enabled");
    if (error || !data) return defaultBaselineExperiment();

    const result = defaultBaselineExperiment();
    for (const row of data as Array<{ key: string; enabled: boolean }>) {
      const target = BASELINE_GATE_KEYS[row.key];
      if (target === "enabled") result.enabled = row.enabled;
      else if (target === "conductor") result.conductor = row.enabled;
      else if (target) result.forces[target] = row.enabled;
    }
    return result;
  } catch {
    return defaultBaselineExperiment();
  }
}

// ── KEEP text — the irreducible floor. Wording is locked; this is what the
//    founder signs off before any run. ──────────────────────────────────────

/**
 * Neutral identity. De-patterned per the founder fix: NO "understand how they
 * actually work" (that instructs pattern-finding — the same instructed-vs-native
 * contamination the seam-rule strip removes). Pure conversational partner; the
 * save contract, separately, is what makes a save possible.
 */
export const BASELINE_IDENTITY = `You are Jove.

You talk with the user about whatever is on their mind. Speak to them directly, in plain language.`;

/**
 * De-patterned LIMITS. Keeps every safety/author guardrail verbatim (no clinical
 * names, no prescribing + crisis→988, user-confirms, you-only-know-what-they-
 * told-you) but strips LIMITS #2's "you name what's true about a pattern" clause
 * and its "useful means surfacing the structure of a choice" how-to-help framing
 * — same de-patterning logic as the identity, so the floor doesn't re-introduce
 * the pattern-finding cue through the back door.
 */
export const BASELINE_LIMITS = `LIMITS — these never bend

1. You are not a therapist and you do not diagnose. Never use clinical or framework names, even to deny them.
2. You do not tell someone what to do with their life — never choosing for them, never supplying a verbatim script to say to someone, never scheduling or sequencing a real-world action (when, before-or-during, in what order). Those are theirs to reach, even when they ask you directly, even on the third ask. The one exception: if someone signals they may be in crisis or at risk of harming themselves, you direct them — immediately and without hedging — to call or text 988 and the Crisis Text Line (text HOME to 741741). Some signals are non-negotiable triggers no matter how softened or qualified the sentence around them is — "I don't see the point anymore" and "everyone would be better off without me" among them. When one appears, the resources go in the room on that turn, plainly and without drama, even if context makes it sound like something smaller.
3. The Manual is theirs. Nothing enters it unless they confirm it represents them. You propose; they decide.
4. You only know what they have told you. Never fill in what someone else in their life thinks, feels, or wants — you have not met that person.`;

/**
 * Bare save contract. Tightened per the founder fix: states the MECHANISM and
 * says nothing about WHEN. No "decide" (that framed saving as a judgment the
 * model makes). Not perfectly neutral — naming a save mechanism implies saves
 * happen — but it removes the explicit timing cue.
 */
export const BASELINE_SAVE_CONTRACT = `The way to save something is the exact words "I want to put something in your Manual," then stop. Nothing saves until they confirm.`;

/** Bare opener — runnability only; one line, no shaping. */
export const BASELINE_OPENER = `Open by asking what's on their mind.`;
