import { describe, it, expect } from "vitest";
import {
  flipRolesForSimulation,
  parseCheckpointIntent,
  snapToOption,
} from "./simulate-user";

describe("flipRolesForSimulation", () => {
  it("returns a prompt message when history is empty", () => {
    const result = flipRolesForSimulation([]);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("Begin the conversation");
  });

  it("flips user to assistant", () => {
    const result = flipRolesForSimulation([
      { role: "user", content: "I've been thinking..." },
    ]);
    expect(result).toEqual([
      { role: "assistant", content: "I've been thinking..." },
    ]);
  });

  it("flips assistant to user", () => {
    const result = flipRolesForSimulation([
      { role: "assistant", content: "Tell me more about that." },
    ]);
    expect(result).toEqual([
      { role: "user", content: "Tell me more about that." },
    ]);
  });

  it("flips alternating history correctly", () => {
    const result = flipRolesForSimulation([
      { role: "user", content: "msg1" },
      { role: "assistant", content: "msg2" },
      { role: "user", content: "msg3" },
      { role: "assistant", content: "msg4" },
    ]);
    expect(result).toEqual([
      { role: "assistant", content: "msg1" },
      { role: "user", content: "msg2" },
      { role: "assistant", content: "msg3" },
      { role: "user", content: "msg4" },
    ]);
  });

  it("preserves message content exactly", () => {
    const content = "Some complex message with 'quotes' and\nnewlines";
    const result = flipRolesForSimulation([
      { role: "user", content },
    ]);
    expect(result[0].content).toBe(content);
  });
});

describe("parseCheckpointIntent", () => {
  it("returns confirmed for affirmative responses", () => {
    expect(parseCheckpointIntent("Yeah, that's exactly right. That captures it perfectly.")).toBe("confirmed");
    expect(parseCheckpointIntent("That lands. Spot on.")).toBe("confirmed");
    expect(parseCheckpointIntent("Yes, write that to my manual.")).toBe("confirmed");
  });

  it("returns rejected for rejection signals", () => {
    expect(parseCheckpointIntent("I don't think that's right. It misses the real issue.")).toBe("rejected");
    expect(parseCheckpointIntent("That doesn't fit what I was saying.")).toBe("rejected");
    expect(parseCheckpointIntent("No, that's not it at all.")).toBe("rejected");
    expect(parseCheckpointIntent("That's wrong. Way off base.")).toBe("rejected");
    expect(parseCheckpointIntent("I don't see it that way.")).toBe("rejected");
  });

  it("returns refined for refinement signals", () => {
    expect(parseCheckpointIntent("It's close but not quite right.")).toBe("refined");
    expect(parseCheckpointIntent("Almost. The name doesn't feel right though.")).toBe("refined");
    expect(parseCheckpointIntent("Part of it resonates but needs tweaking.")).toBe("refined");
    expect(parseCheckpointIntent("Mostly right but I'd adjust the framing.")).toBe("refined");
  });

  it("is case insensitive", () => {
    expect(parseCheckpointIntent("THAT DOESN'T FIT")).toBe("rejected");
    expect(parseCheckpointIntent("IT'S CLOSE BUT needs work")).toBe("refined");
    expect(parseCheckpointIntent("YES THAT LANDS")).toBe("confirmed");
  });

  it("prioritizes rejection over refinement", () => {
    // "close but" would match refine, but "doesn't fit" matches reject first
    expect(parseCheckpointIntent("It's close but doesn't fit the core issue")).toBe("rejected");
  });

  it("defaults to confirmed when no signals match", () => {
    expect(parseCheckpointIntent("Hmm, interesting reflection.")).toBe("confirmed");
    expect(parseCheckpointIntent("I think you've captured something there.")).toBe("confirmed");
    expect(parseCheckpointIntent("")).toBe("confirmed");
  });
});

describe("snapToOption", () => {
  const options = ["Relationships", "Work and career", "Sensory and burnout"];

  it("returns the reply unchanged when there are no options", () => {
    expect(snapToOption("anything at all", [])).toBe("anything at all");
  });

  it("matches an exact option", () => {
    expect(snapToOption("Work and career", options)).toBe("Work and career");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(snapToOption("  Relationships \n", options)).toBe("Relationships");
  });

  it("matches case-insensitively", () => {
    expect(snapToOption("sensory and burnout", options)).toBe(
      "Sensory and burnout"
    );
  });

  it("snaps a wrapped reply to the option it contains", () => {
    expect(
      snapToOption("I'd go with Work and career, I think", options)
    ).toBe("Work and career");
  });

  it("falls back to the first option when nothing matches", () => {
    expect(snapToOption("none of these really", options)).toBe(
      "Relationships"
    );
  });
});
