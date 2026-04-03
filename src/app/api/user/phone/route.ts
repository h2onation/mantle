import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createChat } from "@/lib/linq/sender";
import { normalizePhone } from "@/lib/utils/normalize-phone";

export const runtime = "nodejs";

const INITIAL_GREETING =
  "Hey, it's Sage by Mantle. You're connected. Text me anytime something's on your mind. " +
  "I remember everything from our conversations in the app too. " +
  "If something needs more space, I'll let you know. " +
  "Msg frequency varies. Msg & data rates may apply. Reply HELP for info. Reply STOP to disconnect.";

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

// ── POST: link phone number via Linq ──────────────────────────────
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
    return Response.json(
      { error: "Phone number required" },
      { status: 400 }
    );
  }

  // Normalize: strip non-digits, ensure +1 prefix
  const phone = normalizePhone(rawPhone);

  if (!/^\+1\d{10}$/.test(phone)) {
    return Response.json(
      { error: "Invalid US phone number" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Check if this phone is already linked to another user
  const { data: existing } = await admin
    .from("phone_numbers")
    .select("user_id, verified, linq_chat_id")
    .eq("phone", phone)
    .eq("verified", true)
    .maybeSingle();

  if (existing && existing.user_id !== user.id) {
    return Response.json(
      { error: "This phone number is already linked to another account" },
      { status: 409 }
    );
  }

  // If this user already has this phone linked and verified, don't re-send greeting
  if (existing && existing.user_id === user.id) {
    console.log("[user/phone] Phone already linked for user=%s — skipping greeting", user.id);
    return Response.json({
      ok: true,
      phone,
      serviceType: "SMS",
    });
  }

  // Check iMessage capability (non-blocking — store result but don't fail on it)
  let serviceType = "SMS";
  try {
    const capRes = await fetch(
      "https://api.linqapp.com/api/partner/v3/capability/check_imessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.LINQ_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: phone }),
      }
    );
    if (capRes.ok) {
      const capData = (await capRes.json()) as { available?: boolean };
      serviceType = capData.available ? "iMessage" : "SMS";
    }
  } catch (err) {
    console.warn("[user/phone] Capability check failed, defaulting to SMS:", err);
  }

  // Create Linq chat — sends the initial greeting
  const chatResult = await createChat(phone, INITIAL_GREETING);
  if (!chatResult.ok) {
    console.error(
      "[user/phone] Failed to create Linq chat — trace_id=%s",
      chatResult.traceId
    );
    return Response.json(
      { error: "Failed to send greeting. Check your phone number and try again." },
      { status: 502 }
    );
  }

  // chatId may be null if we can't parse it from response — that's OK,
  // the webhook will fill it in when the user texts back
  const linqChatId = chatResult.chatId || null;
  if (!linqChatId) {
    console.warn(
      "[user/phone] Greeting sent but chat_id not in response — will capture from webhook"
    );
  }

  // Upsert phone_numbers record — ALWAYS save even without chat_id
  console.log("[user/phone] Upserting phone for user=%s phone=%s", user.id, phone);

  const { data: existingRow } = await admin
    .from("phone_numbers")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("[user/phone] Existing row for user=%s: %j", user.id, existingRow);

  // Also check if there's a row with this phone but a different user (old anonymous account)
  if (!existingRow) {
    const { data: phoneRow } = await admin
      .from("phone_numbers")
      .select("id, user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (phoneRow) {
      console.log(
        "[user/phone] Found phone row under different user_id=%s, updating to current user=%s",
        phoneRow.user_id,
        user.id
      );
      const { error: updateError } = await admin
        .from("phone_numbers")
        .update({
          user_id: user.id,
          phone,
          verified: true,
          linq_chat_id: linqChatId,
          service_type: serviceType,
          linked_at: new Date().toISOString(),
          verification_code: null,
          code_expires_at: null,
        })
        .eq("id", phoneRow.id);

      if (updateError) {
        console.error("[user/phone] UPDATE (reassign) FAILED:", updateError);
        return Response.json({ error: "Failed to save phone link" }, { status: 500 });
      }
    } else {
      console.log("[user/phone] No existing row — inserting new for user=%s", user.id);
      const { error: insertError } = await admin.from("phone_numbers").insert({
        user_id: user.id,
        phone,
        verified: true,
        linq_chat_id: linqChatId,
        service_type: serviceType,
        linked_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[user/phone] INSERT FAILED:", insertError);
        return Response.json({ error: "Failed to save phone link" }, { status: 500 });
      }
    }
  } else {
    const { error: updateError } = await admin
      .from("phone_numbers")
      .update({
        phone,
        verified: true,
        linq_chat_id: linqChatId,
        service_type: serviceType,
        linked_at: new Date().toISOString(),
        verification_code: null,
        code_expires_at: null,
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[user/phone] UPDATE FAILED:", updateError);
      return Response.json({ error: "Failed to save phone link" }, { status: 500 });
    }
  }

  // Verify the write actually worked
  const { data: verifyRow } = await admin
    .from("phone_numbers")
    .select("phone, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("[user/phone] VERIFY after upsert: %j", verifyRow);

  // Save the initial greeting to messages table so it appears in conversation history
  try {
    // Find or create the user's active conversation
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
      convId = activeConv.id;
    } else {
      const { data: newConv } = await admin
        .from("conversations")
        .insert({ user_id: user.id, status: "active" })
        .select("id")
        .single();
      convId = newConv?.id || null;
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
    // Non-fatal — the greeting was sent, just not logged locally
    console.warn("[user/phone] Failed to save greeting to messages:", err);
  }

  return Response.json({
    ok: true,
    phone,
    serviceType,
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
