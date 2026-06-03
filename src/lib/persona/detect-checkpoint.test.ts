import { describe, it, expect } from "vitest";
import {
  detectCheckpointInResponse,
  findCheckpointTransition,
} from "@/lib/persona/detect-checkpoint";

describe("detectCheckpointInResponse", () => {
  it("returns true when the canonical transition line is present", () => {
    expect(
      detectCheckpointInResponse(
        'I want to put something in your Manual.\n\nThere is a thing your system does...\n\nProof-Giving as Protection\n\nWhat would you change or sharpen?'
      ).isCheckpoint
    ).toBe(true);
  });

  it('accepts the "this" variant', () => {
    expect(
      detectCheckpointInResponse(
        'Something is forming.\n\nI want to put this in your Manual.\n\nBody text.'
      ).isCheckpoint
    ).toBe(true);
  });

  it('accepts the "that" variant', () => {
    expect(
      detectCheckpointInResponse(
        'I want to put that in your Manual. Body text follows.'
      ).isCheckpoint
    ).toBe(true);
  });

  it("is case-insensitive on the leading I and the word Manual", () => {
    expect(
      detectCheckpointInResponse("i want to put something in your manual.")
        .isCheckpoint
    ).toBe(true);
  });

  it("returns false when the transition line is absent", () => {
    expect(
      detectCheckpointInResponse(
        "That is interesting. Tell me about a specific moment when that happened."
      ).isCheckpoint
    ).toBe(false);
  });

  it("returns false on empty/null-ish input", () => {
    expect(detectCheckpointInResponse("").isCheckpoint).toBe(false);
    expect(detectCheckpointInResponse(undefined as unknown as string).isCheckpoint).toBe(
      false
    );
  });

  it("matches even without trailing punctuation", () => {
    expect(
      detectCheckpointInResponse(
        "I want to put something in your Manual\n\nBody."
      ).isCheckpoint
    ).toBe(true);
  });

  it("does NOT match unrelated prose that references the Manual", () => {
    expect(
      detectCheckpointInResponse(
        "Your Manual has three entries on Layer Two already."
      ).isCheckpoint
    ).toBe(false);
    expect(
      detectCheckpointInResponse(
        "Earlier you said you wanted to put more thought into your Manual entries."
      ).isCheckpoint
    ).toBe(false);
  });

  it("accepts paraphrased openers the model produces under load", () => {
    // The model drifts on the exact phrasing more often than expected.
    // We accept the common paraphrases so a near-miss still produces a
    // checkpoint rather than a stranded transition line.
    expect(
      detectCheckpointInResponse("I'd like to put something in your Manual.")
        .isCheckpoint
    ).toBe(true);
    expect(
      detectCheckpointInResponse("I'm going to put this in your Manual.")
        .isCheckpoint
    ).toBe(true);
    expect(
      detectCheckpointInResponse("Let me put that in your Manual.")
        .isCheckpoint
    ).toBe(true);
  });

  it("accepts 'into your Manual' as a variant of 'in your Manual'", () => {
    expect(
      detectCheckpointInResponse("I want to put something into your Manual.")
        .isCheckpoint
    ).toBe(true);
    expect(
      detectCheckpointInResponse("I'd like to put this into your Manual.")
        .isCheckpoint
    ).toBe(true);
  });

  // Verb-variant safety net (2026-05-19 audit). Dyslexic-mode run caught
  // Jove using "Let me write this up for your Manual" and similar across
  // every proposal in a 27-turn conversation — none fired the classifier
  // under the original "put"-only regex. Broadened to catch the verb
  // drift ("add", "write up") and prep drift ("to", "for"). The strict
  // canonical phrase is still preferred via system-prompt's contract;
  // this is the safety net, not the front line.
  describe("verb-variant safety net (audit-driven)", () => {
    it.each([
      "Let me write this up for your Manual.",
      "Let me write that up for your Manual.",
      "I want to write this up in your Manual.",
      "I'd like to write this up in your Manual.",
      "Let me write it up for your Manual.",
    ])('matches "write up" verb variant: %s', (text) => {
      expect(detectCheckpointInResponse(text).isCheckpoint).toBe(true);
    });

    it.each([
      "I want to add something to your Manual.",
      "I'd like to add this to your Manual.",
      "I'm going to add that to your Manual.",
      "Let me add this to your Manual.",
      "Let me add something into your Manual.",
    ])('matches "add" verb variant: %s', (text) => {
      expect(detectCheckpointInResponse(text).isCheckpoint).toBe(true);
    });

    // Negative cases — broadened verbs must NOT false-positive on
    // adjacent prose.
    it.each([
      "Earlier you said you wanted to add more detail to your Manual eventually.",
      "Your Manual has room to add more entries.",
      "I noticed you wanted to write your own things into your Manual.",
      "Let me read what you wrote about your Manual.",
    ])("does NOT match adjacent prose: %s", (text) => {
      expect(detectCheckpointInResponse(text).isCheckpoint).toBe(false);
    });
  });

  // findCheckpointTransition is the single source of truth the suppression
  // stripper shares with the detector (one transition contract, no second
  // regex). It returns the match boundary so the stripper can slice there.
  describe("findCheckpointTransition", () => {
    it("returns the match boundary for a transition mid-text", () => {
      const lead = "Here's the shape of it. ";
      const text = `${lead}I want to put this in your Manual. Entry prose.`;
      const m = findCheckpointTransition(text);
      expect(m).not.toBeNull();
      expect(m!.index).toBe(lead.length);
      // Slicing at the boundary leaves exactly the lead-in.
      expect(text.slice(0, m!.index).trim()).toBe("Here's the shape of it.");
    });

    it("returns null when no transition line is present", () => {
      expect(findCheckpointTransition("Walk me through what happened.")).toBeNull();
    });

    it("agrees with detectCheckpointInResponse on the same input (one contract)", () => {
      const samples = [
        "I want to put something in your Manual.",
        "Let me write this up for your Manual.",
        "Walk me through what happened.",
        "Your Manual has room to add more entries.",
      ];
      for (const s of samples) {
        const detected = detectCheckpointInResponse(s).isCheckpoint;
        const found = findCheckpointTransition(s) !== null;
        expect(found).toBe(detected);
      }
    });
  });
});
