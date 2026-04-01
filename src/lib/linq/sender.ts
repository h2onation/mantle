// ---------------------------------------------------------------------------
// Linq API sender — sends messages, typing indicators, and read receipts
// ---------------------------------------------------------------------------

const API_BASE = "https://api.linqapp.com/api/partner/v3";

function getToken(): string {
  const token = process.env.LINQ_API_TOKEN;
  if (!token) throw new Error("LINQ_API_TOKEN is not configured");
  return token;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

interface LinqApiError {
  code?: number;
  message?: string;
  trace_id?: string;
}

async function linqFetch(
  path: string,
  options: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown; traceId?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string>) },
  });

  const traceId = res.headers.get("x-trace-id") ?? undefined;
  let data: unknown = null;

  try {
    data = await res.json();
  } catch {
    // Some endpoints return empty body (typing, read)
  }

  if (!res.ok) {
    const err = data as LinqApiError | null;
    console.error(
      "[linq-sender] API error %d on %s — trace_id=%s error=%j",
      res.status,
      path,
      traceId ?? err?.trace_id ?? "unknown",
      err
    );
  } else {
    console.log(
      "[linq-sender] OK %d on %s — trace_id=%s",
      res.status,
      path,
      traceId ?? "unknown"
    );
  }

  return { ok: res.ok, status: res.status, data, traceId };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a text message to an existing Linq chat.
 * Retries once after 2 seconds on failure.
 */
export async function sendMessage(
  chatId: string,
  text: string
): Promise<{ ok: boolean; messageId?: string; traceId?: string }> {
  let result = await linqFetch(`/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        parts: [{ type: "text", value: text }],
      },
    }),
  });

  // Retry once on failure
  if (!result.ok) {
    console.warn(
      "[linq-sender] Send failed (status=%d), retrying in 2s — chat_id=%s trace_id=%s",
      result.status,
      chatId,
      result.traceId ?? "unknown"
    );
    await delay(2000);
    result = await linqFetch(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        message: {
          parts: [{ type: "text", value: text }],
        },
      }),
    });

    if (!result.ok) {
      console.error(
        "[linq-sender] Send retry also failed — chat_id=%s trace_id=%s",
        chatId,
        result.traceId ?? "unknown"
      );
    }
  }

  // Log full response for debugging
  console.log(
    "[linq-sender] sendMessage response ok=%s status=%d chat_id=%s data=%j",
    result.ok,
    result.status,
    chatId,
    result.data
  );

  const msgData = result.data as Record<string, unknown> | null;
  const messageId = (msgData?.id as string) ?? (msgData?.message_id as string) ?? undefined;
  return {
    ok: result.ok,
    messageId,
    traceId: result.traceId,
  };
}

/**
 * Send typing indicator — auto-stops when a message is sent.
 */
export async function sendTypingIndicator(chatId: string): Promise<void> {
  await linqFetch(`/chats/${chatId}/typing`, { method: "POST" });
}

/**
 * Mark a chat as read.
 */
export async function markAsRead(chatId: string): Promise<void> {
  await linqFetch(`/chats/${chatId}/read`, { method: "POST" });
}

/**
 * Get chat info including participant handles.
 * Used by group detection to identify participants.
 * Retries once after 2 seconds on failure.
 */
export async function getChatInfo(
  chatId: string
): Promise<{ ok: boolean; handles: string[]; isGroup: boolean; traceId?: string }> {
  let result = await linqFetch(`/chats/${chatId}`, { method: "GET" });

  if (!result.ok) {
    console.warn(
      "[linq-sender] getChatInfo failed (status=%d), retrying in 2s — chat_id=%s",
      result.status,
      chatId
    );
    await delay(2000);
    result = await linqFetch(`/chats/${chatId}`, { method: "GET" });
  }

  if (!result.ok) {
    console.error(
      "[linq-sender] getChatInfo retry also failed — chat_id=%s trace_id=%s",
      chatId,
      result.traceId ?? "unknown"
    );
    return { ok: false, handles: [], isGroup: false, traceId: result.traceId };
  }

  const data = result.data as Record<string, unknown> | null;

  // Extract handles array — try multiple possible field locations
  const handlesRaw =
    (data?.handles as string[]) ??
    ((data?.chat as Record<string, unknown>)?.handles as string[]) ??
    (data?.participants as string[]) ??
    [];

  // Also capture owner_handle — Linq sometimes puts the group creator here
  // instead of in the handles array
  const ownerHandle =
    ((data?.owner_handle as Record<string, unknown>)?.handle as string) ??
    (((data?.chat as Record<string, unknown>)?.owner_handle as Record<string, unknown>)?.handle as string) ??
    null;

  const allHandles = [...handlesRaw.map(String)];
  if (ownerHandle && !allHandles.includes(ownerHandle)) {
    allHandles.push(ownerHandle);
  }

  // Detect group flag
  const isGroup =
    (data?.is_group as boolean) ??
    ((data?.chat as Record<string, unknown>)?.is_group as boolean) ??
    allHandles.length > 2;

  return {
    ok: true,
    handles: allHandles,
    isGroup,
    traceId: result.traceId,
  };
}

/**
 * Create a new chat (first message to a phone number).
 * Returns the chat_id for future messages.
 */
export async function createChat(
  toPhone: string,
  initialMessage: string
): Promise<{ ok: boolean; chatId?: string; traceId?: string }> {
  const fromNumber = process.env.LINQ_PHONE_NUMBER;
  if (!fromNumber) throw new Error("LINQ_PHONE_NUMBER is not configured");

  const result = await linqFetch("/chats", {
    method: "POST",
    body: JSON.stringify({
      from: fromNumber,
      to: [toPhone],
      message: {
        parts: [{ type: "text", value: initialMessage }],
      },
    }),
  });

  // Log the full response so we can see Linq's actual format
  console.log(
    "[linq-sender] createChat response ok=%s status=%d data=%j",
    result.ok,
    result.status,
    result.data
  );

  // Try multiple possible field locations for chat_id
  const data = result.data as Record<string, unknown> | null;
  const chatId =
    (data?.chat_id as string) ??
    (data?.id as string) ??
    ((data?.chat as Record<string, unknown>)?.id as string) ??
    ((data?.data as Record<string, unknown>)?.chat_id as string) ??
    ((data?.data as Record<string, unknown>)?.id as string) ??
    undefined;

  if (result.ok && !chatId) {
    console.warn(
      "[linq-sender] createChat succeeded but no chat_id found in response — will capture from first webhook"
    );
  }

  return {
    ok: result.ok,
    chatId,
    traceId: result.traceId,
  };
}
