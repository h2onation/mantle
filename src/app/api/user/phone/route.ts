import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/messaging/send";
import { normalizePhone } from "@/lib/utils/normalize-phone";
import { generateOtp, hashOtp, otpExpiryFromNow } from "@/lib/phone-otp";
import {
  phoneOtpSendHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

// ── GET: return linked phone (if any) ──────────────────────────────
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("phone_numbers")
    .select("phone, verified, service_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row || !row.verified) {
    return Response.json({ phone: null });
  }

  return Response.json({
    phone: row.phone,
    verified: true,
    serviceType: row.service_type || null,
  });
}

// ── POST: request an OTP for a phone number ──────────────────────────────
//
// This endpoint NEVER sets verified=true. It only generates a code, hashes
// it, stores it on a phone_numbers row owned by the requesting user, and
// sends the raw code to the phone via Linq. Verification happens in
// /api/user/phone/verify after the user submits the code.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { phone_number: rawPhone } = body as { phone_number?: string };

  if (!rawPhone) {
    return Response.json({ error: "Phone number required" }, { status: 400 });
  }

  const phone = normalizePhone(rawPhone);
  if (!/^\+1\d{10}$/.test(phone)) {
    return Response.json({ error: "Invalid US phone number" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. If this phone already belongs to a different verified user, refuse.
  // Do not reveal whose account it is, do not reassign.
  const { data: existingForPhone } = await admin
    .from("phone_numbers")
    .select("user_id, verified")
    .eq("phone", phone)
    .maybeSingle();

  if (
    existingForPhone &&
    existingForPhone.user_id !== user.id &&
    existingForPhone.verified === true
  ) {
    return Response.json(
      {
        error:
          "This phone number is already linked to another account. If this is your number, please contact support.",
      },
      { status: 409 }
    );
  }

  // 2. If the same user already has this phone verified, no-op.
  if (
    existingForPhone &&
    existingForPhone.user_id === user.id &&
    existingForPhone.verified === true
  ) {
    return Response.json({ verified: true, message: "Phone already verified." });
  }

  // 3. Rate limit OTP sends per phone (defense against spamming a victim).
  const limit = await checkLimit(phoneOtpSendHour, phone);
  if (!limit.success) {
    return rateLimitedResponse(limit);
  }

  // 4. Generate OTP, hash it, store on the user's phone row.
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = otpExpiryFromNow();

  // The user's phone_numbers row is keyed by user_id (one row per user).
  // If a row exists for this user we update; otherwise insert. We do NOT
  // touch the verified flag — it stays false until /verify confirms.
  const { data: userRow } = await admin
    .from("phone_numbers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (userRow) {
    const { error: updateError } = await admin
      .from("phone_numbers")
      .update({
        phone,
        verified: false,
        otp_code: otpHash,
        otp_expires_at: expiresAt,
        otp_attempts: 0,
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[user/phone] OTP update failed");
      return Response.json({ error: "Failed to send code" }, { status: 500 });
    }
  } else {
    const { error: insertError } = await admin.from("phone_numbers").insert({
      user_id: user.id,
      phone,
      verified: false,
      otp_code: otpHash,
      otp_expires_at: expiresAt,
      otp_attempts: 0,
    });

    if (insertError) {
      console.error("[user/phone] OTP insert failed");
      return Response.json({ error: "Failed to send code" }, { status: 500 });
    }
  }

  // 5. Send the OTP via the active messaging provider. Keep the message
  //    text terse — no other content.
  const sendResult = await sendMessage({
    to: phone,
    content: `Your mywalnut verification code is: ${otp}. This code expires in 10 minutes.`,
    ownerUserId: user.id,
    contentKind: "otp",
  });
  if (sendResult.status === "FAILED") {
    console.error(
      "[user/phone] OTP send failed provider=%s error=%s",
      sendResult.provider,
      sendResult.errorMessage ?? "unknown"
    );
    return Response.json(
      { error: "Failed to send code. Please try again." },
      { status: 502 }
    );
  }

  return Response.json({
    verified: false,
    message: "Verification code sent.",
  });
}

// ── DELETE: unlink phone number ───────────────────────────────────
export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin
    .from("phone_numbers")
    .update({ verified: false })
    .eq("user_id", user.id);

  return Response.json({ ok: true });
}
