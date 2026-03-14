import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;

// ── GET: return linked phone (if any) ──────────────────────────────
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
    .select("phone, verified")
    .eq("user_id", user.id)
    .single();

  if (!row) {
    return Response.json({ phone: null });
  }

  return Response.json({ phone: row.phone, verified: row.verified });
}

// ── POST: initiate or verify phone linking ─────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { phone: rawPhone, code } = body as {
    phone?: string;
    code?: string;
  };

  const admin = createAdminClient();

  // ── Verify code ────────────────────────────────────────────────
  if (code) {
    const { data: row } = await admin
      .from("phone_numbers")
      .select("verification_code, code_expires_at")
      .eq("user_id", user.id)
      .single();

    if (!row) {
      return Response.json(
        { error: "No pending verification" },
        { status: 400 }
      );
    }

    if (row.verification_code !== code) {
      return Response.json({ error: "Invalid code" }, { status: 400 });
    }

    if (new Date(row.code_expires_at) < new Date()) {
      return Response.json({ error: "Code expired" }, { status: 400 });
    }

    const { data: updated } = await admin
      .from("phone_numbers")
      .update({
        verified: true,
        linked_at: new Date().toISOString(),
        verification_code: null,
        code_expires_at: null,
      })
      .eq("user_id", user.id)
      .select("phone")
      .single();

    return Response.json({
      ok: true,
      status: "verified",
      phone: updated?.phone,
    });
  }

  // ── Initiate verification ──────────────────────────────────────
  if (!rawPhone) {
    return Response.json(
      { error: "Phone number required" },
      { status: 400 }
    );
  }

  // Normalize: strip spaces/dashes, ensure +1 prefix
  let phone = rawPhone.replace(/[\s\-().]/g, "");
  if (phone.startsWith("1") && !phone.startsWith("+")) {
    phone = "+" + phone;
  } else if (!phone.startsWith("+")) {
    phone = "+1" + phone;
  }

  // Validate basic format
  if (!/^\+1\d{10}$/.test(phone)) {
    return Response.json(
      { error: "Invalid US phone number" },
      { status: 400 }
    );
  }

  const verificationCode = String(
    Math.floor(100000 + Math.random() * 900000)
  );
  const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Check if row exists for this user
  const { data: existing } = await admin
    .from("phone_numbers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await admin
      .from("phone_numbers")
      .update({
        phone,
        verified: false,
        verification_code: verificationCode,
        code_expires_at: codeExpiresAt,
      })
      .eq("user_id", user.id);
  } else {
    await admin.from("phone_numbers").insert({
      user_id: user.id,
      phone,
      verified: false,
      verification_code: verificationCode,
      code_expires_at: codeExpiresAt,
    });
  }

  // Send verification SMS via Twilio
  const client = twilio(accountSid, authToken);
  await client.messages.create({
    body: `Your Mantle code: ${verificationCode}`,
    from: twilioNumber,
    to: phone,
  });

  return Response.json({ ok: true, status: "code_sent" });
}
