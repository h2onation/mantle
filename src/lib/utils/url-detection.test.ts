import { describe, it, expect } from "vitest";
import { detectUrls } from "@/lib/utils/url-detection";

describe("detectUrls", () => {
  it("returns no URL for normal message", () => {
    const result = detectUrls("I had a fight with my partner last night");
    expect(result.hasUrl).toBe(false);
    expect(result.urls).toEqual([]);
  });

  it("detects a single URL", () => {
    const result = detectUrls("https://example.com/article");
    expect(result.hasUrl).toBe(true);
    expect(result.urls).toEqual(["https://example.com/article"]);
    expect(result.userContext).toBe("");
  });

  it("detects URL with surrounding context", () => {
    const result = detectUrls(
      "this really hit me https://example.com/article check it out"
    );
    expect(result.hasUrl).toBe(true);
    expect(result.urls).toEqual(["https://example.com/article"]);
    expect(result.userContext).toBe("this really hit me check it out");
  });

  it("detects multiple URLs", () => {
    const result = detectUrls(
      "https://example.com/one and also https://example.com/two"
    );
    expect(result.hasUrl).toBe(true);
    expect(result.urls).toHaveLength(2);
  });

  it("deduplicates repeated URLs", () => {
    const result = detectUrls(
      "https://example.com/article - https://example.com/article"
    );
    expect(result.urls).toHaveLength(1);
  });

  it("handles http URLs", () => {
    const result = detectUrls("http://example.com/page");
    expect(result.hasUrl).toBe(true);
  });

  it("handles URLs with query params and fragments", () => {
    const result = detectUrls(
      "https://example.com/article?utm_source=twitter&id=123#section-2"
    );
    expect(result.hasUrl).toBe(true);
    expect(result.urls[0]).toContain("utm_source");
    expect(result.urls[0]).toContain("#section-2");
  });

  it("returns empty for null/empty input", () => {
    expect(detectUrls("").hasUrl).toBe(false);
  });

  it("does not match partial URLs without protocol", () => {
    const result = detectUrls("check out example.com/article");
    expect(result.hasUrl).toBe(false);
  });
});
