const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** A single block of the structured `system` form. Optional `cache_control`
 *  marks the cache breakpoint: Anthropic caches the prompt prefix up to and
 *  including the marked block, so one marker on the largest stable block
 *  covers everything before it as well. Prompt caching is GA (no beta header
 *  needed); `cache_control: { type: "ephemeral" }` requests the default 5
 *  minute cache. */
export type SystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string | SystemBlock[];
  messages: { role: "user" | "assistant"; content: string }[];
  stream?: boolean;
}

/** Token-count breakdown returned by the Messages API. Three of the fields
 *  are cache-related: `input_tokens` is the count AFTER the last cache
 *  breakpoint (uncached portion), `cache_creation_input_tokens` is the
 *  prefix tokens written to cache on a miss, `cache_read_input_tokens` is
 *  the prefix tokens served from cache on a hit. Total processed input is
 *  the sum of all three. */
export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
  usage?: AnthropicUsage;
}

export function extractResponseText(response: AnthropicResponse): string {
  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function anthropicFetch(
  body: AnthropicRequest,
  timeoutMs = 60000
): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, stream: false }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${errBody}`);
    }

    const json = await res.json().catch(() => null);
    if (!json?.content?.[0]) {
      // Log sanitized response metadata so the next occurrence is
      // diagnosable. We never log `content[i].text` — it may echo user
      // phrasing and CLAUDE.md forbids logging user content. Keys,
      // stop_reason, content types/lengths, and any Anthropic-framework
      // error fields are enough to classify refusals, empty-content
      // responses, and gateway errors.
      const j = json as Record<string, unknown> | null;
      const content = Array.isArray(j?.content)
        ? (j!.content as Array<Record<string, unknown>>)
        : null;
      console.error("[anthropic] unexpected_response_shape", {
        keys: j ? Object.keys(j) : null,
        type: j?.type ?? null,
        stop_reason: j?.stop_reason ?? null,
        content_length: content?.length ?? null,
        content_types: content?.map((c) => c?.type ?? null) ?? null,
        error_type:
          (j?.error as Record<string, unknown> | undefined)?.type ?? null,
        error_message:
          (j?.error as Record<string, unknown> | undefined)?.message ?? null,
      });
      throw new Error("Anthropic API returned unexpected response shape");
    }
    return json as AnthropicResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function anthropicStream(
  body: Omit<AnthropicRequest, "stream">,
  timeoutMs = 60000
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal: controller.signal,
  });

  if (!res.ok) {
    clearTimeout(timer);
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${errBody}`);
  }

  // Clear timeout once streaming starts — the connection is alive
  clearTimeout(timer);

  return res.body!;
}

/** Extract usage tokens from a parsed SSE event during a streaming response.
 *  `message_start` carries input + cache token counts in its `message.usage`.
 *  `message_delta` carries the final output_tokens. Callers accumulate both
 *  to get the full picture for telemetry. Returns null if the event doesn't
 *  carry usage info. */
export function parseStreamUsage(event: unknown): AnthropicUsage | null {
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;
  if (e.type === "message_start") {
    const msg = e.message as { usage?: AnthropicUsage } | undefined;
    return msg?.usage ?? null;
  }
  if (e.type === "message_delta") {
    return (e.usage as AnthropicUsage | undefined) ?? null;
  }
  return null;
}
