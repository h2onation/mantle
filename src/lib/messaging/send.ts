// Unified send interface. Application code should call sendMessage() here
// rather than the provider clients directly.
//
// Routing:
//   - linqGroupChatId present → always routes to Linq's group path. Sendblue
//     has no participant lifecycle events, so group facilitator stays on Linq
//     permanently. See docs/decisions.md for the dual-provider architecture.
//   - Otherwise (1:1) → routes to the provider selected by MESSAGING_PROVIDER.
//
// Error contract: non-throwing. On failure returns { status: 'FAILED', ... }
// with error_message set. This preserves the existing Linq call-site contract
// where `{ ok: false }` is returned on failure. Provider clients may throw;
// this wrapper catches and normalizes.

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveProvider, type MessagingProvider } from "./provider";
import { sendMessageViaSendblue } from "./sendblue";
import { sendMessageViaLinq } from "./linq";

export interface UnifiedSendParams {
  /** E.164 phone number for 1:1 sends. Ignored when linqGroupChatId is set. */
  to: string;
  content: string;
  /** Optional for auditing — stamped on the messaging_events row. */
  ownerUserId?: string;
  /**
   * If present, forces routing to Linq's group path regardless of
   * MESSAGING_PROVIDER. Group primitives are Linq-only.
   */
  linqGroupChatId?: string;
}

export interface UnifiedSendResult {
  providerMessageId: string | null;
  provider: MessagingProvider;
  status: string;
  errorMessage: string | null;
}

export async function sendMessage(
  params: UnifiedSendParams
): Promise<UnifiedSendResult> {
  const admin = createAdminClient();
  const isGroup = !!params.linqGroupChatId;
  // Groups always go to Linq; 1:1 respects the active provider flag.
  const provider: MessagingProvider = isGroup ? "linq" : getActiveProvider();

  try {
    if (provider === "sendblue") {
      const result = await sendMessageViaSendblue({
        to: params.to,
        content: params.content,
      });

      await admin.from("messaging_events").insert({
        direction: "outbound",
        provider: "sendblue",
        provider_message_id: result.message_handle,
        from_number: result.from_number,
        to_number: result.number,
        content: result.content,
        status: result.status,
        error_code: result.error_code ? String(result.error_code) : null,
        error_message: result.error_message,
        raw_payload: result,
        owner_user_id: params.ownerUserId ?? null,
      });

      return {
        providerMessageId: result.message_handle,
        provider: "sendblue",
        status: result.status,
        errorMessage: result.error_message,
      };
    }

    // Linq branch — 1:1 (respects MESSAGING_PROVIDER) or group (always Linq
    // because linqGroupChatId forced the provider above).
    const linqResult = await sendMessageViaLinq({
      to: params.to,
      content: params.content,
      linqGroupChatId: params.linqGroupChatId,
    });

    const status = linqResult.ok ? "SENT" : "FAILED";

    await admin.from("messaging_events").insert({
      direction: "outbound",
      provider: "linq",
      provider_message_id: linqResult.messageId,
      from_number: linqResult.fromNumber,
      to_number: isGroup ? null : params.to,
      content: params.content,
      status,
      error_message: linqResult.errorMessage,
      raw_payload: { traceId: linqResult.traceId },
      owner_user_id: params.ownerUserId ?? null,
    });

    return {
      providerMessageId: linqResult.messageId,
      provider: "linq",
      status,
      errorMessage: linqResult.errorMessage,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await admin.from("messaging_events").insert({
      direction: "outbound",
      provider,
      from_number: null,
      to_number: isGroup ? null : params.to,
      content: params.content,
      status: "FAILED",
      error_message: message,
      owner_user_id: params.ownerUserId ?? null,
    });

    return {
      providerMessageId: null,
      provider,
      status: "FAILED",
      errorMessage: message,
    };
  }
}
