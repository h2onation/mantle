import { describe, it, expect } from "vitest";
import { firstNameFrom } from "./name";

describe("firstNameFrom", () => {
  it("returns the first whitespace-separated token", () => {
    expect(firstNameFrom("Jeff Waters")).toBe("Jeff");
  });

  it("handles single-word names", () => {
    expect(firstNameFrom("Jeff")).toBe("Jeff");
  });

  it("handles multiple middle/last names", () => {
    expect(firstNameFrom("Mary Jane Watson Parker")).toBe("Mary");
  });

  it("collapses multiple spaces", () => {
    expect(firstNameFrom("  Jeff   Waters  ")).toBe("Jeff");
  });

  it("falls back to 'User' for null", () => {
    expect(firstNameFrom(null)).toBe("User");
  });

  it("falls back to 'User' for undefined", () => {
    expect(firstNameFrom(undefined)).toBe("User");
  });

  it("falls back to 'User' for empty string", () => {
    expect(firstNameFrom("")).toBe("User");
  });

  it("falls back to 'User' for whitespace-only string", () => {
    expect(firstNameFrom("   ")).toBe("User");
  });

  it("preserves diacritics and non-ASCII", () => {
    expect(firstNameFrom("Müller Smith")).toBe("Müller");
    expect(firstNameFrom("张 伟")).toBe("张");
  });

  it("preserves hyphenated first names", () => {
    expect(firstNameFrom("Mary-Jane Watson")).toBe("Mary-Jane");
  });
});
