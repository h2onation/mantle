import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/messaging/send";
import { normalizePhone } from "@/lib/utils/normalize-phone";
import { hashOtp, isExpired, OTP_MAX_ATTEMPTS } from "@/lib/phone-otp";
import {
  phoneOtpVerifyTenMin,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { PERSONA_NAME_FORMAL } from "@/lib/persona/config";

export const runtime = "nodejs";

const INITIAL_GREETING =
  `Hey, it's ${PERSONA_NAME_FORMAL} by mywalnut. You're connected. Text me anytime something's on your mind. ` +
  "I remember everything from our conversations in the app too. " +
  "If something needs more space, I'll let you know. " +
  "Msg frequency varies. Msg & data rates may apply. Reply HELP for info. Reply STOP to disconnect.";

// ── POST: verify a phone OTP ─────────────────────────────────────────────
//
// This is the ONLY endpoint that ever sets phone_numbers.verified = true.
// On success it also kicks off the Linq chat with the Sage greeting that
// used to live in POST /api/user/phone.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { phone?: string; code?: string };
  const rawPhone = body.phone;
  const code = body.code;

  if (!rawPhone || !code) {
    return Response.json(
      { error: "Phone and code required" },
      { status: 400 }
    );
  }

  const phone = normalizePhone(rawPhone);

  // Defense in depth: rate-limit verify attempts per phone (in addition to
  // the per-row otp_attempts counter, which can only enforce within a single
  // OTP lifetime).
  const limit = await checkLimit(phoneOtpVerifyTenMin, phone);
  if (!limit.success) {
    return rateLimitedResponse(limit);
  }

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("phone_numbers")
    .select("id, otp_code, otp_expires_at, otp_attempts, verified")
    .eq("user_id", user.id)
    .eq("phone", phone)
    .maybeSingle();

  if (!row) {
    return Response.json({ error: "No code request found" }, { status: 404 });
  }

  if (isExpired(row.otp_expires_at as string | null)) {
    return Response.json(
      { error: "Code expired. Please request a new one." },
      { status: 410 }
    );
  }

  const attempts = (row.otp_attempts as number | null) ?? 0;
  if (attempts >= OTP_MAX_ATTEMPTS) {
    return Response.json(
      { error: "Too many attempts. Please request a new code." },
      { status: 429 }
    );
  }

  const submittedHash = hashOtp(code);
  if (submittedHash !== row.otp_code) {
    await admin
      .from("phone_numbers")
      .update({ otp_attempts: attempts + 1 })
      .eq("id", row.id);
    return Response.json(
      { error: "Incorrect code. Please try again." },
      { status: 400 }
    );
  }

  // Code matches. Promote the row to verified and clear OTP fields.
  // verified=true is set ONLY here, after successful OTP confirmation.
  const { error: promoteError } = await admin
    .from("phone_numbers")
    .update({
      verified: true,
      otp_code: null,
      otp_expires_at: null,
      otp_attempts: 0,
      linked_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (promoteError) {
    console.error("[user/phone/verify] Failed to mark row verified");
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }

  // Send the greeting now that the user has proven they own the phone.
  // Failure here is non-fatal — the link is still valid, the user just won't
  // get the welcome text. The Linq wrapper persists linq_chat_id on first
  // send internally; no caller-side store-back needed.
  try {
    await sendMessage({
      to: phone,
      content: INITIAL_GREETING,
      ownerUserId: user.id,
    });

    // Save the greeting to messages so it appears in the user's history.
    let convId: string | null = null;
    const { data: activeConv } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeConv) {
      convId = activeConv.id as string;
    } else {
      const { data: newConv } = await admin
        .from("conversations")
        .insert({ user_id: user.id, status: "active" })
        .select("id")
        .single();
      convId = (newConv?.id as string) || null;
    }

    if (convId) {
      await admin.from("messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: INITIAL_GREETING,
        channel: "text",
      });
    }
  } catch (err) {
    console.warn("[user/phone/verify] Post-verify greeting setup failed:", err);
  }

  return Response.json({ verified: true });
}
