import { describe, it, expect } from "vitest";
import {
  evaluateGate,
  scoreMessage,
  GATE_MIN_MESSAGES,
  GATE_NUDGE_MESSAGES,
  GATE_COOLDOWN_MS,
} from "./group-gate";

describe("scoreMessage", () => {
  it("scores emotional keywords", () => {
    expect(scoreMessage("I feel insecure about this")).toBeGreaterThanOrEqual(3);
    expect(scoreMessage("I'm worried about what happened")).toBeGreaterThanOrEqual(3);
    expect(scoreMessage("That was frustrating")).toBeGreaterThanOrEqual(3);
    expect(scoreMessage("I feel embarrassed")).toBeGreaterThanOrEqual(3);
  });

  it("scores engagement bids", () => {
    expect(scoreMessage("what do you think")).toBeGreaterThanOrEqual(3);
    expect(scoreMessage("thoughts?")).toBeGreaterThanOrEqual(3);
    expect(scoreMessage("does that make sense")).toBeGreaterThanOrEqual(3);
    expect(scoreMessage("I don't know")).toBeGreaterThanOrEqual(3);
  });

  it("scores long questions (40+ chars with ?)", () => {
    const longQ = "Do you think this is something I should be concerned about?";
    expect(scoreMessage(longQ)).toBeGreaterThanOrEqual(3);
  });

  it("scores message length", () => {
    const medium = "x".repeat(80);
    const long = "x".repeat(200);
    expect(scoreMessage(medium)).toBe(1);
    expect(scoreMessage(long)).toBe(2);
  });

  it("does not score short bland messages", () => {
    expect(scoreMessage("ok cool")).toBe(0);
    expect(scoreMessage("yeah")).toBe(0);
    expect(scoreMessage("haha nice")).toBe(0);
  });

  it("stacks multiple signals", () => {
    const emotional_question =
      "I feel really worried about this whole situation, what do you think?";
    // emotional (+3) + bid (+3) = 6
    expect(scoreMessage(emotional_question)).toBeGreaterThanOrEqual(6);
  });
});

describe("evaluateGate", () => {
  // Helper: a date N ms ago
  const ago = (ms: number) => new Date(Date.now() - ms);

  describe("direct address", () => {
    it("always sends on 'sage' regardless of counter or cooldown", () => {
      const result = evaluateGate("hey sage", 0, ago(1000));
      expect(result.decision).toBe("SEND_TO_SAGE");
      expect(result.reason).toBe("direct_address");
    });

    it("sends on 'Sage' case-insensitive", () => {
      expect(evaluateGate("Sage what do you think", 0).decision).toBe("SEND_TO_SAGE");
    });
  });

  describe("short messages", () => {
    it("skips messages under 5 chars", () => {
      expect(evaluateGate("ok", 5).decision).toBe("SKIP");
      expect(evaluateGate("lol", 5).reason).toBe("short_message");
    });
  });

  describe("cooldown", () => {
    it("skips when Sage spoke less than 30s ago", () => {
      const result = evaluateGate(
        "I feel really worried about everything",
        2,
        ago(5000) // 5s ago
      );
      expect(result.decision).toBe("SKIP");
      expect(result.reason).toBe("cooldown");
    });

    it("allows scoring when cooldown has expired", () => {
      const result = evaluateGate(
        "I feel really worried about everything",
        2,
        ago(GATE_COOLDOWN_MS + 1000)
      );
      expect(result.decision).toBe("SEND_TO_SAGE");
    });

    it("allows scoring when no lastSageSpokeAt (null)", () => {
      const result = evaluateGate(
        "I feel really worried about everything",
        2,
        null
      );
      expect(result.decision).toBe("SEND_TO_SAGE");
    });
  });

  describe("high score punches through counter", () => {
    it("sends on emotional keyword even at counter=1", () => {
      const result = evaluateGate(
        "I feel insecure about my technical ability",
        1
      );
      expect(result.decision).toBe("SEND_TO_SAGE");
      expect(result.reason).toBe("high_score");
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it("sends on engagement bid even at counter=1", () => {
      const result = evaluateGate("what do you think about that", 1);
      expect(result.decision).toBe("SEND_TO_SAGE");
      expect(result.reason).toBe("high_score");
    });
  });

  describe("counter as safety net", () => {
    it("skips bland message at counter=1", () => {
      const result = evaluateGate("yeah that happened to me too", 1);
      expect(result.decision).toBe("SKIP");
      expect(result.reason).toBe("low_score");
    });

    it("sends bland-but-long message once counter >= GATE_MIN_MESSAGES", () => {
      const bland = "Yeah I mean that is something I have been thinking about for a while now and I am not really sure";
      const result = evaluateGate(bland, GATE_MIN_MESSAGES);
      expect(result.decision).toBe("SEND_TO_SAGE");
      expect(result.reason).toBe("eligible_score");
    });

    it("auto-sends with nudge at GATE_NUDGE_MESSAGES", () => {
      const result = evaluateGate("yeah ok", GATE_NUDGE_MESSAGES);
      expect(result.decision).toBe("SEND_TO_SAGE");
      expect(result.reason).toBe("nudge");
      expect(result.addNudgeHint).toBe(true);
    });
  });

  describe("real conversation examples", () => {
    it("responds to vulnerability disclosure", () => {
      const result = evaluateGate(
        "He will be building his manual at some point, but right now we will just be using mine to discuss my insecurities about my technical ability",
        2
      );
      expect(result.decision).toBe("SEND_TO_SAGE");
    });

    it("responds to 'what do you think'", () => {
      const result = evaluateGate("What do you think", 2);
      expect(result.decision).toBe("SEND_TO_SAGE");
    });

    it("skips 'evan!'", () => {
      const result = evaluateGate("evan!", 1);
      expect(result.decision).toBe("SKIP");
    });

    it("skips plain banter", () => {
      const result = evaluateGate("haha totally", 1);
      expect(result.decision).toBe("SKIP");
    });
  });
});
