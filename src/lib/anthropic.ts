const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  stream?: boolean;
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
}

export async function anthropicFetch(
  body: AnthropicRequest,
  timeoutMs = 60000
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
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

    return (await res.json()) as AnthropicResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function anthropicStream(
  body: Omit<AnthropicRequest, "stream">,
  timeoutMs = 60000
): Promise<ReadableStream<Uint8Array>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
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
