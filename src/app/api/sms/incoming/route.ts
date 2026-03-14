import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;
const client = twilio(accountSid, authToken);

export async function POST(request: NextRequest) {
  try {
    // Validate Twilio signature to prevent spoofed requests
    const twilioSignature = request.headers.get("x-twilio-signature") || "";
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://trustthemantle.com"}/api/sms/incoming`;

    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value as string;
    });

    const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);
    if (!isValid) {
      console.error("[sms] Invalid Twilio signature — rejecting request");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const from = params.From;
    const body = params.Body;
    console.log("[sms] Incoming from %s: %s", from, body);

    await client.messages.create({
      body: `Echo: ${body}`,
      from: twilioNumber,
      to: from,
    });

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("[sms] Error:", err);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
