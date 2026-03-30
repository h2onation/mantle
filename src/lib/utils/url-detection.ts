/**
 * Detects URLs in a message and separates the user's context from the link.
 * Runs before transcript detection — if a URL is found, we skip the transcript path.
 */

export interface UrlDetection {
  hasUrl: boolean;
  urls: string[];
  userContext: string; // message text with URLs stripped (what the user said alongside the link)
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

const NO_URL: UrlDetection = { hasUrl: false, urls: [], userContext: "" };

export function detectUrls(message: string): UrlDetection {
  if (!message) return NO_URL;

  const matches = message.match(URL_PATTERN);
  if (!matches || matches.length === 0) return NO_URL;

  // Deduplicate
  const urls = Array.from(new Set(matches));

  // Strip URLs from message to get the user's surrounding context
  const userContext = message
    .replace(URL_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { hasUrl: true, urls, userContext };
}
