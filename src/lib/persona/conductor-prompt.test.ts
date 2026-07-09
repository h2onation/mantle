import { describe, it, expect } from "vitest";
import { buildSystemPromptBlocks } from "@/lib/persona/system-prompt";
import {
  CONDUCTOR_PROMPT,
  CONDUCTOR_REQUIRED_FRAGMENTS,
  validateConductorPromptEdit,
} from "@/lib/persona/conductor-prompt";
import { CHECKPOINT_ACTIONS } from "@/lib/persona/config";

// Guard tests for the conductor prompt (the LIVE 1:1 voice). These pin the
// safety layer, the no-Jove-saves contract, the landed markers, and the
// deliberate ABSENCE of cross-domain MECHANICS / Tier-3 blocks the conductor's
// "don't leave a live moment" rule would fight. (Extracted from the retired
// baseline-experiment.test.ts, 2026-07-02.)
describe("conductor variant — guard tests", () => {
  const renderConductor = () => {
    const b = buildSystemPromptBlocks({
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "c",
      isReturningUser: false,
      sessionSummary: null,
      isFirstCheckpoint: true,
      sessionCount: 1,
      turnCount: 1,
      personaModes: ["general"],
      mode: "situation",
      voiceOverrides: {},
    });
    return b.tier1 + b.staticContext + b.dynamic;
  };

  it("carries the 988 crisis clause verbatim (the prompt-side safety layer)", () => {
    const full = renderConductor();
    expect(full).toContain("The one exception — crisis. This never bends.");
    expect(full).toContain("988");
    expect(full).toContain("741741");
    // The non-negotiable-trigger examples from REBUILT_LIMITS #2, verbatim.
    expect(full).toContain("I don't see the point anymore");
    expect(full).toContain("everyone would be better off without me");
  });

  it("v0.6: Jove never triggers saves — no save phrase, no push contract", () => {
    const full = renderConductor();
    // The pull-model redesign: the detector's trigger phrase must be ABSENT
    // from the prompt (the user saves from the reflection bar; Jove-triggered
    // saves were the whack-a-mole failure). If this reappears, the v0.5.1
    // revert block leaked back into the live template.
    expect(full).not.toContain("I want to put something in your Manual");
    expect(full).not.toContain("followed by the entry exactly as you built it together");
    // v0.9: the one-time availability offer replaces the save offer — said
    // once, no lean, entirely theirs to take.
    expect(full).toContain("say once, plainly, that it's there if they want it");
    // Never-announce discipline survives inside "Saying it's available".
    expect(full).toContain("say you're saving, writing, or putting anything down");
    // v0.9: the never-draft rule — nothing about the reflection in the chat.
    expect(full).toContain(
      "You never draft, preview, or describe a reflection inside the conversation"
    );
  });

  it("carries the v0.5 landed markers, after-save rule, and v0.6 cadence/opener guards", () => {
    const full = renderConductor();
    expect(full).toContain("How you know there's more, and when it's landed");
    expect(full).toContain('"Ok" is not landed');
    expect(full).toContain("## After a save");
    expect(full).toContain("Never say nothing was saved");
    // v0.6 additions
    expect(full).toContain("Check only when something CHANGED");
    expect(full).toContain("Never start two turns in a row the same way");
  });

  it("landed line publishes the ---reflection-ready--- marker (the meter's ONLY ready source)", () => {
    const full = renderConductor();
    // The marker instruction must live in "When it's landed" and be scoped to
    // the landed message only. If this clause disappears, the strip can never
    // appear under the conductor — miss direction is late/never, by design.
    expect(full).toContain("---reflection-ready---");
    expect(full).toContain(
      "Use it only on the message where you say it's available, never earlier"
    );
  });

  it("v0.7: the after-save trigger quotes the synthetic save reply verbatim (config coupling)", () => {
    const full = renderConductor();
    // The ONLY save signal Jove ever receives is the confirm route's
    // synthetic reply, replayed as a user turn. The prompt must quote it
    // verbatim — if the config wording ever changes, this fails and forces
    // the prompt to follow (PR3 hallucinated-save incident, 2026-07-07).
    expect(full).toContain(CHECKPOINT_ACTIONS.confirmed.naturalReply);
    // Chat agreement is never a save; the availability line always carries the
    // marker (v0.9 wording: "the line and the words travel together").
    expect(full).toContain("approval and wrapping up are not saves");
    expect(full).toContain(
      "never say it's available without ending that message with the marker"
    );
  });

  it("v0.9: the conductor prompt carries the entry-writing standard", () => {
    const full = renderConductor();
    // Conductor-mode composition reads its writing standard from the prompt
    // itself (the compose call sends only the machine contract) — if this
    // section disappears, pulled entries compose with no spec.
    expect(full).toContain("## Writing the reflection");
    expect(full).toContain("records a recognition that ALREADY HAPPENED");
  });

  it("Step 4: the post-save turn acknowledges and stops — the fork is client-owned", () => {
    const full = renderConductor();
    // The ---chips--- marker was retired 2026-07-08: the three ways forward are
    // rendered by the client (PostSaveFork), not emitted by Jove.
    expect(full).not.toContain("---chips---");
    expect(full).not.toContain("Keep this thread going");
    // Jove acknowledges the save in one line, then stops.
    expect(full).toContain("## After a save");
    expect(full).toContain("Then stop");
    // The save-signal gate stays: no save without the "I saved that to my
    // Manual." message.
    expect(full).toContain("I saved that to my Manual");
  });

  it("contains NO cross-domain / second-instance instruction and no MECHANICS", () => {
    const full = renderConductor();
    // The REBUILT_MECHANICS lines the conductor's "don't leave a live moment"
    // rule would fight — none may appear.
    expect(full).not.toContain("holds anywhere else");
    expect(full).not.toContain("across more than this one moment");
    expect(full).not.toContain("different person or part of life");
    expect(full).not.toContain("MECHANICS — how Manual entries get made");
    // And no Tier-3 blocks (situation opener, guided spine, etc.).
    expect(full).not.toContain("---sections---");
  });
});

// The admin-edit save guard. The whole prompt is one editable document, so
// this validator is the ONLY thing standing between an admin edit and a
// silently broken crisis layer or save path.
describe("validateConductorPromptEdit — the admin save guard", () => {
  it("the shipped prompt passes its own guard (self-consistency)", () => {
    expect(validateConductorPromptEdit(CONDUCTOR_PROMPT)).toBeNull();
  });

  it("every required fragment is genuinely present in the shipped prompt", () => {
    for (const f of CONDUCTOR_REQUIRED_FRAGMENTS) {
      expect(CONDUCTOR_PROMPT).toContain(f.fragment);
    }
  });

  it("rejects an edit that drops a crisis resource, naming it plainly", () => {
    const withoutCrisis = CONDUCTOR_PROMPT.replace(
      "text HOME to 741741",
      "reach out to someone",
    );
    const err = validateConductorPromptEdit(withoutCrisis);
    expect(err).not.toBeNull();
    expect(err).toContain("Crisis Text Line");
    expect(err).toContain("Not saved");
  });

  it("rejects an edit that drops the reflection-ready marker", () => {
    const gutted = CONDUCTOR_PROMPT.replace("---reflection-ready---", "");
    const err = validateConductorPromptEdit(gutted);
    expect(err).not.toBeNull();
    expect(err).toContain("reflection-ready");
  });

  it("accepts a heavy rewrite as long as the protected lines survive", () => {
    const rewrite =
      "You are Jove, totally rewritten.\n" +
      "Crisis: call or text 988, or text HOME to 741741.\n" +
      "End landed turns with ---reflection-ready---.\n" +
      "## Writing the reflection\nTheir words, the settled thing.";
    expect(validateConductorPromptEdit(rewrite)).toBeNull();
  });

  it("rejects an edit that drops the reflection-writing section", () => {
    const gutted = CONDUCTOR_PROMPT.replace(
      "## Writing the reflection",
      "## Writing",
    );
    const err = validateConductorPromptEdit(gutted);
    expect(err).not.toBeNull();
    expect(err).toContain("reflection-writing");
  });
});
