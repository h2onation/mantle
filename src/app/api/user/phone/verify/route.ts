import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
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
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

const INITIAL_GREETING =
  `Hey, it's ${PERSONA_NAME_FORMAL} by ${BRAND.name}. You're connected. Text me anytime something's on your mind. ` +
  "I remember everything from our conversations in the app too. " +
  "If something needs more space, I'll let you know. " +
  "Msg frequency varies. Msg & data rates may apply. Reply HELP for info. Reply STOP to disconnect.";

// ── POST: verify a phone OTP ─────────────────────────────────────────────
//
// This is the ONLY endpoint that ever sets phone_numbers.verified = true.
// On success it also kicks off the Linq chat with the Jove greeting that
// used to live in POST /api/user/phone.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

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

  // Rate-limit verify attempts per phone (Upstash). Burst protection
  // layered on top of the per-row otp_attempts counter below. Requires
  // Upstash env vars; fails open if they are missing.
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

  // Per-row attempts cap (restored 2026-05-19 reversing ADR-038's removal).
  // Once a phone has burned OTP_MAX_ATTEMPTS wrong codes against the
  // current OTP, refuse all further submissions until a fresh code is
  // sent — the send route resets the counter to 0 as part of issuing a
  // new code. Counter falls back to 0 for legacy rows that predate the
  // 20260519000000 migration.
  const currentAttempts = (row.otp_attempts as number | null) ?? 0;
  if (currentAttempts >= OTP_MAX_ATTEMPTS) {
    return Response.json(
      {
        error: "too_many_attempts",
        message:
          "Too many incorrect attempts on this code. Request a new code to try again.",
      },
      { status: 429 }
    );
  }

  const submittedHash = hashOtp(code);
  if (submittedHash !== row.otp_code) {
    // Wrong code — increment attempts so the next failure path can
    // enforce the cap. Best-effort; a failed increment shouldn't change
    // the response (the user still typed the wrong code).
    const { error: incError } = await admin
      .from("phone_numbers")
      .update({ otp_attempts: currentAttempts + 1 })
      .eq("id", row.id);
    if (incError) {
      console.error("[user/phone/verify] otp_attempts increment failed", {
        message: incError.message,
      });
    }
    return Response.json(
      { error: "Incorrect code. Please try again." },
      { status: 400 }
    );
  }

  // Code matches. Promote the row to verified, clear OTP fields, and
  // reset the attempts counter so a future re-link starts from zero.
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
    console.error("[user/phone/verify] Failed to mark row verified", {
      message: promoteError.message,
      details: promoteError,
    });
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
      contentKind: "system",
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
