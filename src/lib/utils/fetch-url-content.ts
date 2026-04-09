/**
 * Fetches a URL and extracts readable text content.
 * Designed for Edge runtime — uses plain fetch API with AbortController timeout.
 * No external dependencies.
 */

export interface FetchedContent {
  success: boolean;
  title?: string;
  text?: string;
  error?: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_WORDS = 3000;

/**
 * Strips HTML tags and extracts readable text.
 * Lightweight regex approach — not a full parser, but good enough
 * for Sage to understand what an article is about.
 */
export function extractTextFromHtml(html: string): {
  title: string;
  text: string;
} {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s+/g, " ").trim()
    : "";

  // Remove script, style, nav, header, footer, and aside blocks
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // Convert block elements to newlines
  cleaned = cleaned.replace(/<\/(p|div|h[1-6]|li|br|tr|blockquote)[^>]*>/gi, "\n");
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");

  // Collapse whitespace and empty lines
  cleaned = cleaned
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // Truncate to MAX_WORDS
  const words = cleaned.split(/\s+/);
  if (words.length > MAX_WORDS) {
    cleaned = words.slice(0, MAX_WORDS).join(" ") + "\n\n[Content truncated]";
  }

  return { title, text: cleaned };
}

export async function fetchUrlContent(url: string): Promise<FetchedContent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MywalnutBot/1.0; +https://mywalnut.app)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        return { success: false, error: "blocked" };
      }
      if (res.status === 404) {
        return { success: false, error: "not_found" };
      }
      return { success: false, error: `http_${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      return { success: false, error: "unsupported_content_type" };
    }

    const body = await res.text();
    if (!body || body.length < 100) {
      return { success: false, error: "empty_content" };
    }

    // Plain text — no HTML parsing needed
    if (contentType.includes("text/plain")) {
      const words = body.split(/\s+/);
      const text =
        words.length > MAX_WORDS
          ? words.slice(0, MAX_WORDS).join(" ") + "\n\n[Content truncated]"
          : body;
      return { success: true, title: "", text };
    }

    const { title, text } = extractTextFromHtml(body);

    if (!text || text.length < 50) {
      return { success: false, error: "no_readable_content" };
    }

    return { success: true, title, text };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, error: "timeout" };
    }
    return { success: false, error: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}
