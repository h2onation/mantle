export const runtime = "edge";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/admin/verify-admin";

// Realistic Sage-style narratives for each layer, ~150-200 words each.
const LAYER_CONTENT: Record<number, string> = {
  1: `There's a through-line in everything you've described — the late nights, the solo problem-solving, the way you instinctively pull back when someone tries to help. It's not stubbornness. It's a deep, structural need for autonomy.

You need to know you can handle things yourself. Not as a preference — as a requirement for feeling safe. When someone offers help, part of you hears it as evidence that you're not managing, and that feels intolerable. So you pre-empt it. You over-prepare, you stay up late, you carry things alone — not because you enjoy it, but because dependence feels like the precursor to being let down.

The origin is clear: you learned early that relying on others was unreliable. The people who were supposed to catch you didn't, and you adapted by becoming someone who never needs catching. It's an elegant solution for a kid. But for an adult trying to build real partnerships — at work, at home — it creates a ceiling. You can go far alone, but you can't go far together.`,

  2: `You see yourself as the competent one. The person who holds it together, who doesn't crack, who other people lean on. And that identity isn't wrong — you are capable, you do hold things together. But it's become a cage you built yourself.

The problem isn't the capability. It's that you've made it load-bearing for your self-worth. If you're not the strong one, who are you? If you need help, does that mean you've failed? There's a binary operating underneath: strong equals worthy, vulnerable equals weak. And you've been running from the weak side so long that you've forgotten it's not actually a threat.

What I notice is that the people around you would welcome the unguarded version. Your partner has practically begged for it. But you keep presenting the curated self — the one who has answers, who stays calm, who never asks for what they need — because somewhere you decided that the real version isn't enough. That belief is the oldest thing in your system, and it's the one doing the most damage.`,

  3: `Your reaction system has a very specific signature: freeze, retreat, reconstruct alone. It's a three-part sequence that fires before you have any conscious say in it.

First, the freeze. Someone challenges you, raises the stakes, or asks you to be visible with what you care about — and your body goes still. Not calm. Locked. You described it as "the words just disappear." That's not a thinking failure. It's a protection response. Your system is scanning for danger before your mind catches up.

Then the retreat. You concede, you agree, you say "fair point" or "sure, whatever you think." The retreat isn't agreement — it's a cover story. It buys you time to get out of the exposed position.

Then the underground work. The 2am redesigns. The quiet furniture rearranging. The email you draft alone at midnight. This is where the real you operates — with full intensity, full investment, full conviction. But nobody sees it, because the whole point is to care without witnesses.

The cost is that people experience you as either passive or sneaky, when you're actually neither. You're just running a protection program that routes all your genuine engagement through a private channel.`,

  4: `You think in systems. Before you act, you need to see the full map — every angle, every consequence, every way it could go wrong. That's not anxiety (though it can feel like it). It's how your mind actually works. You're a scenario-builder.

The strength of this is real: you catch things other people miss, you plan for contingencies, you rarely get blindsided. The cost is equally real: you take too long to act, you exhaust yourself running simulations of conversations that may never happen, and you sometimes mistake preparation for progress. You've spent hours planning how to raise something with your partner, rehearsing responses to their responses, and then never actually saying anything — because by the time you've mapped the whole conversation, the moment has passed.

There's also a decision pattern worth naming: you delay choices until you feel certain, but certainty never arrives, so the delay becomes the decision. You stay in jobs too long, tolerate situations past their expiry, and frame inaction as patience when it's actually avoidance of the discomfort of choosing wrong.`,

  5: `The way others experience you is fundamentally different from how you experience yourself. Inside, you're intense, opinionated, emotionally invested. Outside, you're easy, flexible, low-maintenance. That gap is the central tension in almost every relationship you have.

You've built a relational style around making other people comfortable. You read the room before you enter it. You adjust your opinions to reduce friction. You perform agreement to keep the peace, then quietly correct the outcome when no one's watching. Your partner called it out with the furniture. Your team lead experiences it as disengagement. Neither of them is seeing the real you — they're seeing the version you've decided is safe to show.

The deeper pattern is this: you treat closeness as something you earn through compliance, not something you build through honesty. So the people closest to you are actually the farthest from knowing you. The more someone matters, the more carefully you curate what they see. And the loneliness that creates — the feeling of being surrounded by people who love a version of you that isn't quite real — that's the price you're paying for safety.`,
};

export async function POST(request: Request) {
  const { userId, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { layers } = (await request.json()) as { layers: number[] };

  if (!layers || !Array.isArray(layers) || layers.length === 0) {
    return Response.json({ error: "layers array required" }, { status: 400 });
  }

  // Validate layer numbers
  const validLayers = layers.filter((l) => l >= 1 && l <= 5);
  if (validLayers.length === 0) {
    return Response.json({ error: "No valid layers (1-5)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Narrowed delete — only removes prior populate-shaped rows (null name).
  // Real confirm-generated entries always have a name from composition, so
  // they're preserved. Previously this wiped ALL of a user's manual_entries,
  // which destroyed real test data whenever the button was clicked.
  await admin
    .from("manual_entries")
    .delete()
    .eq("user_id", userId)
    .is("name", null);

  // Insert one entry per requested layer
  const rows = validLayers.map((layer) => ({
    user_id: userId,
    layer,
    name: null,
    content: LAYER_CONTENT[layer] || `Layer ${layer} content placeholder.`,
  }));

  const { error } = await admin.from("manual_entries").insert(rows);

  if (error) {
    console.error("[dev-populate] Insert error:", error);
    return Response.json({ error: "Failed to insert components" }, { status: 500 });
  }

  // Mark populated layers as explored in extraction_state
  const { data: activeConv } = await admin
    .from("conversations")
    .select("id, extraction_state")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (activeConv?.extraction_state) {
    const state = activeConv.extraction_state as Record<string, unknown>;
    const layers = state.layers as Record<string, Record<string, unknown>> | undefined;
    if (layers) {
      for (const layer of validLayers) {
        if (layers[layer]) {
          layers[layer].signal = "explored";
        }
      }
      await admin
        .from("conversations")
        .update({ extraction_state: state })
        .eq("id", activeConv.id);
    }
  }

  return Response.json({ ok: true, count: validLayers.length });
}
