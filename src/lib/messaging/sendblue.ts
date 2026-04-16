// Sendblue API client. Server-side only — never import from a client component.
// Prefer the unified sendMessage() in ./send; call this directly only when you
// need Sendblue-specific response fields.

import { assertE164 } from "./phone";

const SENDBLUE_BASE_URL = "https://api.sendblue.com";

export interface SendblueSendResponse {
  accountEmail: string;
  content: string;
  date_created: string;
  date_updated: string;
  error_code: number;
  error_message: string | null;
  from_number: string;
  is_outbound: boolean;
  media_url: string;
  message_handle: string;
  number: string;
  status: string;
  send_style: string;
}

export interface SendblueInboundWebhook {
  accountEmail: string;
  content: string;
  is_outbound: false;
  status: string;
  error_code: number | null;
  error_message: string | null;
  message_handle: string;
  date_sent: string;
  date_updated: string;
  from_number: string;
  number: string;
  to_number: string;
  was_downgraded: boolean | null;
  media_url: string;
  message_type: string;
  group_id: string;
  participants: string[];
  send_style: string;
  opted_out: boolean;
  sendblue_number: string;
  service: string;
}

function getAuthHeaders(): Record<string, string> {
  const keyId = process.env.SENDBLUE_API_KEY_ID;
  const secret = process.env.SENDBLUE_API_SECRET_KEY;
  if (!keyId || !secret) {
    throw new Error("Sendblue credentials not configured");
  }
  return {
    "sb-api-key-id": keyId,
    "sb-api-secret-key": secret,
    "Content-Type": "application/json",
  };
}

export async function sendMessageViaSendblue(params: {
  to: string;
  content: string;
  statusCallback?: string;
}): Promise<SendblueSendResponse> {
  assertE164(params.to);

  const fromNumber = process.env.SENDBLUE_FROM_NUMBER;
  if (!fromNumber) throw new Error("SENDBLUE_FROM_NUMBER not configured");
  assertE164(fromNumber);

  const body: Record<string, unknown> = {
    number: params.to,
    from_number: fromNumber,
    content: params.content,
  };
  if (params.statusCallback) body.status_callback = params.statusCallback;

  const response = await fetch(`${SENDBLUE_BASE_URL}/api/send-message`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  // Always parse the body so we capture error_code / error_message on non-2xx.
  const responseText = await response.text();
  let parsed: SendblueSendResponse | { error_message?: string };
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Sendblue send failed with non-JSON response: ${response.status} ${responseText}`
    );
  }

  if (!response.ok) {
    const errMsg =
      "error_message" in parsed && parsed.error_message
        ? parsed.error_message
        : "unknown";
    throw new Error(`Sendblue send failed: ${response.status} ${errMsg}`);
  }

  return parsed as SendblueSendResponse;
}
