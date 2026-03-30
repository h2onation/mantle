import { describe, it, expect } from "vitest";
import { extractTextFromHtml } from "@/lib/utils/fetch-url-content";

describe("extractTextFromHtml", () => {
  it("extracts title from HTML", () => {
    const html = "<html><head><title>Test Article</title></head><body><p>Content</p></body></html>";
    const result = extractTextFromHtml(html);
    expect(result.title).toBe("Test Article");
  });

  it("strips script and style tags", () => {
    const html = `
      <html><body>
        <script>alert('x')</script>
        <style>.foo { color: red }</style>
        <p>Visible content here</p>
      </body></html>
    `;
    const result = extractTextFromHtml(html);
    expect(result.text).toContain("Visible content here");
    expect(result.text).not.toContain("alert");
    expect(result.text).not.toContain("color: red");
  });

  it("strips nav, header, footer, aside", () => {
    const html = `
      <html><body>
        <nav>Navigation links</nav>
        <header>Site Header</header>
        <article><p>Article content that matters</p></article>
        <footer>Copyright 2024</footer>
        <aside>Sidebar ad</aside>
      </body></html>
    `;
    const result = extractTextFromHtml(html);
    expect(result.text).toContain("Article content that matters");
    expect(result.text).not.toContain("Navigation links");
    expect(result.text).not.toContain("Site Header");
    expect(result.text).not.toContain("Copyright 2024");
    expect(result.text).not.toContain("Sidebar ad");
  });

  it("converts block elements to newlines", () => {
    const html = "<p>First paragraph</p><p>Second paragraph</p>";
    const result = extractTextFromHtml(html);
    expect(result.text).toContain("First paragraph\nSecond paragraph");
  });

  it("decodes HTML entities", () => {
    const html = "<p>Tom &amp; Jerry said &quot;hello&quot;</p>";
    const result = extractTextFromHtml(html);
    expect(result.text).toContain('Tom & Jerry said "hello"');
  });

  it("truncates long content", () => {
    // Generate content with > 3000 words
    const words = Array(3500).fill("word").join(" ");
    const html = `<p>${words}</p>`;
    const result = extractTextFromHtml(html);
    expect(result.text).toContain("[Content truncated]");
    // Should be roughly 3000 words
    const resultWords = result.text.split(/\s+/).length;
    expect(resultWords).toBeLessThan(3100);
  });

  it("handles empty title gracefully", () => {
    const html = "<html><body><p>No title here</p></body></html>";
    const result = extractTextFromHtml(html);
    expect(result.title).toBe("");
  });

  it("collapses excessive whitespace", () => {
    const html = "<p>   Too   many   spaces   </p><p>   More   spaces   </p>";
    const result = extractTextFromHtml(html);
    expect(result.text).toBe("Too many spaces\nMore spaces");
  });
});
