export const runtime = "edge";

import { requireAdmin } from "@/lib/admin/verify-admin";
import { LAYERS } from "@/lib/manual/layers";

// Dev-only seed content: one realistic Jove-style sample per SECTION, keyed by
// slug so each stays matched to its section even if display order changes.
const SECTION_CONTENT: Record<string, string> = {
  relationships: `When voices get raised, you go offline. It's not stonewalling — your system shuts down input and you can't get to your own words until later. From the outside it reads as cold or checked-out; inside, you're flooded and protecting yourself the only way that works in the moment.

The people closest to you feel the gap most. You care intensely, but the caring routes through doing — you fix the thing, you remember the detail, you show up — rather than through saying it out loud. So the ones who matter most can end up the least sure of where they stand with you, because the spoken reassurance they're scanning for is the one channel you go quiet on exactly when the stakes are highest.`,

  "work-money": `Under high-stakes pressure — the financial kind especially — something shifts. You go quiet and inward, you research, you try to get solid ground under your feet before you move. From the outside it reads as withdrawal, and by the time you surface there's sometimes already damage to walk back.

What makes this flavor of stress different from ordinary anxiety is that it involves other people's needs on a timeline you can't fully control. The decision can't wait for you to finish processing. You can absorb a lot — being underestimated, a bad stretch — as long as the work still has a path to mattering. The one thing you can't absorb is being asked to misrepresent what you know is true; that's the line that, once crossed, becomes non-negotiable.`,

  "routines-structure": `When plans change, you go still. It looks like resistance. It's recalculation — your system goes offline while the new variables get integrated. Talk to you five minutes later and you're fine; interrupt you in the first thirty seconds and you lose another five.

The systems that hold your day up aren't preferences, they're load-bearing. The morning sequence, the known route, the buffer between things — each one quietly absorbs a cost you'd otherwise pay in the moment. When one collapses, it's not the single change that lands hardest; it's that the scaffolding you were leaning on to handle everything else just went out from under you, and now the rest of the day is heavier than it was an hour ago.`,

  "sensory-burnout": `You don't break at the last thing. You break because the last thing landed on top of everything already there. The stack builds quietly — a too-loud voice, a bright room, a plan that fell through — none of them individually loud enough to name. Then something small hits and the whole column goes.

From the outside it looks like an overreaction to a light switch. From inside, the lights were just what arrived when you were already full. Mid-stack, none of it looks like enough to say something about, so you hold each layer and the next until your body makes the decision your words couldn't. Recovery isn't optional downtime — it's the maintenance that keeps the next day from starting already half-full.`,

  "interests-flow": `When something captures your attention, you can stay with it for hours in a state most people can't access. The noise drops away, time stops mattering, and the work gets a depth that surprises people who only see the scattered version of you.

This is where your best work lives — not in spite of how your mind runs but because of it. The same intensity that costs you in a loud meeting pays off here: you see the whole map, you catch what others miss, you go all the way down. What's worth protecting is the conditions that let you get there — the uninterrupted stretch, the real problem, the permission to disappear into it — because that state is where you're most yourself and most useful at once.`,
};

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { userId, admin } = auth;

  const { layers } = (await request.json()) as { layers: number[] };

  if (!layers || !Array.isArray(layers) || layers.length === 0) {
    return Response.json({ error: "layers array required" }, { status: 400 });
  }

  // Validate picker indices (1-5, one per section in display order).
  const validLayers = layers.filter((l) => l >= 1 && l <= 5);
  if (validLayers.length === 0) {
    return Response.json({ error: "No valid sections (1-5)" }, { status: 400 });
  }

  // Narrowed delete — only removes prior populate-shaped rows (null name).
  // Real confirm-generated entries always have a name from composition, so
  // they're preserved. Previously this wiped ALL of a user's manual_entries,
  // which destroyed real test data whenever the button was clicked.
  await admin
    .from("manual_entries")
    .delete()
    .eq("user_id", userId)
    .is("name", null);

  // Insert one entry per requested section (picker index 1-5 → section slug).
  // New-model rows: section is the structural key, layer is null, content
  // matches the section (keyed by slug).
  const rows = validLayers.map((layer) => {
    const slug = LAYERS[layer - 1]?.slug ?? null;
    return {
      user_id: userId,
      layer: null,
      section: slug,
      tags: [] as string[],
      name: null,
      content: (slug && SECTION_CONTENT[slug]) || `Sample ${slug ?? layer} entry.`,
    };
  });

  const { error } = await admin.from("manual_entries").insert(rows);

  if (error) {
    console.error("[dev-populate] Insert error:", error);
    return Response.json({ error: "Failed to insert components" }, { status: 500 });
  }

  // Mark populated sections as explored in extraction_state (keyed 1-5 by
  // section display order, matching the per-section signal map).
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
    const sectionSignals = state.layers as Record<string, Record<string, unknown>> | undefined;
    if (sectionSignals) {
      for (const layer of validLayers) {
        if (sectionSignals[layer]) {
          sectionSignals[layer].signal = "explored";
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
