import { describe, it, expect } from "vitest";
import { buildTranscript } from "@/lib/persona/generate-summary";

describe("buildTranscript", () => {
  it("labels user messages as 'User'", () => {
    const result = buildTranscript([{ role: "user", content: "Hello" }]);
    expect(result).toBe("User: Hello");
  });

  it("labels assistant messages as 'Sage'", () => {
    const result = buildTranscript([{ role: "assistant", content: "Hi there" }]);
    expect(result).toBe("Sage: Hi there");
  });

  it("labels system messages as 'System'", () => {
    const result = buildTranscript([{ role: "system", content: "[User confirmed the checkpoint]" }]);
    expect(result).toBe("System: [User confirmed the checkpoint]");
  });

  it("joins messages with double newlines", () => {
    const result = buildTranscript([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "How are you" },
    ]);
    expect(result).toBe("User: Hello\n\nSage: Hi\n\nUser: How are you");
  });

  it("returns empty string for empty array", () => {
    const result = buildTranscript([]);
    expect(result).toBe("");
  });
});
