import { describe, it, expect } from "vitest";
import { detectCheckpointInResponse } from "@/lib/persona/detect-checkpoint";

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
});
