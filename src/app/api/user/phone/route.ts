import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/messaging/send";
import { normalizePhone } from "@/lib/utils/normalize-phone";
import { generateOtp, hashOtp, otpExpiryFromNow } from "@/lib/phone-otp";
import { BRAND } from "@/lib/brand";
import {
  phoneOtpSendHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

// ── GET: return linked phone (if any) ──────────────────────────────
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

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
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

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

  // 4. Generate OTP, hash it.
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = otpExpiryFromNow();

  // 5. Send the OTP FIRST — before writing anything to the row. If the send
  //    fails we must NOT have already overwritten the user's row, or switching
  //    to a new number and hitting a transient send failure would downgrade
  //    their existing verified link to verified=false with a code that never
  //    arrived. So: send, bail on failure, persist only on success.
  const sendResult = await sendMessage({
    to: phone,
    content: `Your ${BRAND.name} verification code is: ${otp}. This code expires in 10 minutes.`,
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

  // 6. Persist the code on the user's row. phone_numbers is one row per user
  //    (enforced by phone_numbers_user_id_key UNIQUE). otp_attempts resets to 0
  //    so a user who burned the cap on a previous code can recover with a new
  //    one. verified stays false — promotion happens in /verify.
  const otpPatch = {
    phone,
    verified: false,
    otp_code: otpHash,
    otp_expires_at: expiresAt,
    otp_attempts: 0,
  };

  const { data: userRow } = await admin
    .from("phone_numbers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let persistError: { code?: string; message?: string } | null = null;
  if (userRow) {
    persistError = (
      await admin.from("phone_numbers").update(otpPatch).eq("user_id", user.id)
    ).error;
  } else {
    const insertResult = await admin
      .from("phone_numbers")
      .insert({ user_id: user.id, ...otpPatch });
    if (insertResult.error?.code === "23505") {
      // A concurrent send already created this user's row (user_id is UNIQUE).
      // Fall back to update so we neither 500 nor leave a duplicate row.
      persistError = (
        await admin.from("phone_numbers").update(otpPatch).eq("user_id", user.id)
      ).error;
    } else {
      persistError = insertResult.error;
    }
  }

  if (persistError) {
    // Never log the full error — its `details` can carry the raw phone on a
    // unique-constraint violation (e.g. "Key (phone)=(+1...) already exists").
    console.error("[user/phone] OTP persist failed", {
      code: persistError.code,
      message: persistError.message,
    });
    return Response.json({ error: "Failed to send code" }, { status: 500 });
  }

  return Response.json({
    verified: false,
    message: "Verification code sent.",
  });
}

// ── DELETE: unlink phone number ───────────────────────────────────
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const admin = createAdminClient();
  await admin
    .from("phone_numbers")
    .update({ verified: false })
    .eq("user_id", user.id);

  return Response.json({ ok: true });
}
