// Linq wrapper for the unified messaging interface.
//
// Responsibilities:
//   - Adapt Linq's chat_id-based API to the unified {to, content} shape.
//   - Encapsulate the phone -> linq_chat_id lookup and first-message
//     createChat fallback that previously lived at each call site.
//   - Preserve Linq's non-throwing contract: returns {ok: false, ...} on
//     failure rather than throwing. Every call site assumed this.
//
// Groups: when linqGroupChatId is set, the wrapper sends straight to that
// chat id. No phone lookup, no createChat. Groups remain Linq-only per
// decisions.md.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessage as linqSendMessage,
  createChat as linqCreateChat,
} from "@/lib/linq/sender";
import { assertE164 } from "./phone";

export interface LinqSendResult {
  ok: boolean;
  messageId: string | null;
  traceId: string | null;
  fromNumber: string | null;
  errorMessage: string | null;
}

export async function sendMessageViaLinq(params: {
  to: string;
  content: string;
  linqGroupChatId?: string;
}): Promise<LinqSendResult> {
  const fromNumber = process.env.LINQ_PHONE_NUMBER ?? null;

  // Group path: send directly to the group chat_id.
  if (params.linqGroupChatId) {
    try {
      const result = await linqSendMessage(
        params.linqGroupChatId,
        params.content
      );
      return {
        ok: result.ok,
        messageId: result.messageId ?? null,
        traceId: result.traceId ?? null,
        fromNumber,
        errorMessage: result.ok
          ? null
          : "Linq group send returned {ok: false}",
      };
    } catch (err) {
      return {
        ok: false,
        messageId: null,
        traceId: null,
        fromNumber,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 1:1 path. E.164 required — every upstream caller normalizes, but we
  // guard at the boundary so a regression surfaces as {ok: false}, not a
  // 400 from Linq with an opaque message.
  try {
    assertE164(params.to);
  } catch (err) {
    return {
      ok: false,
      messageId: null,
      traceId: null,
      fromNumber,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("phone_numbers")
    .select("id, linq_chat_id")
    .eq("phone", params.to)
    .maybeSingle();

  // Existing chat — send via chat_id.
  if (row?.linq_chat_id) {
    try {
      const result = await linqSendMessage(row.linq_chat_id, params.content);
      return {
        ok: result.ok,
        messageId: result.messageId ?? null,
        traceId: result.traceId ?? null,
        fromNumber,
        errorMessage: result.ok ? null : "Linq send returned {ok: false}",
      };
    } catch (err) {
      return {
        ok: false,
        messageId: null,
        traceId: null,
        fromNumber,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // First message to this number — createChat.
  try {
    const createResult = await linqCreateChat(params.to, params.content);

    // If this is a known user row, persist the chat_id so subsequent sends
    // use the fast path. Unknown-number sends (no row) just send and move on.
    if (createResult.ok && createResult.chatId && row?.id) {
      await admin
        .from("phone_numbers")
        .update({ linq_chat_id: createResult.chatId })
        .eq("id", row.id);
    }

    // createChat returns a chat_id (conversation identifier), not a message
    // id. Use null for the audit provider_message_id since collapsing chat_id
    // into that column would break the (provider, provider_message_id) index.
    return {
      ok: createResult.ok,
      messageId: null,
      traceId: createResult.traceId ?? null,
      fromNumber,
      errorMessage: createResult.ok
        ? null
        : "Linq createChat returned {ok: false}",
    };
  } catch (err) {
    return {
      ok: false,
      messageId: null,
      traceId: null,
      fromNumber,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
