import { useMemo } from "react";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ManualEntry } from "@/lib/types";

// The single source of truth for everything the Home surfaces derive from the
// raw session/manual data. Both MobileHome and DesktopHome consume this — the
// greeting bucket, the resume-thread selection, and the layer/started counts
// live here once, never copy-pasted into two layouts.

export interface HomeModelInput {
  firstName?: string | null;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  entries: ManualEntry[];
}

export interface HomeModel {
  /** The display name to greet by, or null when we only have the placeholder. */
  realName: string | null;
  greeting: string;
  dateLine: string;
  /** The conversation to offer "pick up where you left off", or null. */
  heroConv: ConversationSummaryItem | null;
  heroSnippet: string;
  /** Confirmed-entry count per module slug — the count badge on Home's
   *  module cards. */
  entryCounts: Record<string, number>;
}

// Pure helpers — exported so they can be unit-tested without rendering.

export function greetingFor(name: string | null, now: Date): string {
  const h = now.getHours();
  const tod = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${tod}${name ? `, ${name}` : ""}.`;
}

export function dateLineFor(now: Date): string {
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${weekday} · ${monthDay}`;
}

// "User" is the placeholder name; treat it as no name so we don't greet
// someone by a stub.
export function resolveRealName(firstName?: string | null): string | null {
  return firstName && firstName !== "User" ? firstName : null;
}

// The resume hero offers the active conversation if it's restorable, else the
// most-recent restorable thread. Text channels aren't restorable in-app.
export function selectHeroConv(
  conversations: ConversationSummaryItem[],
  activeConversationId: string | null,
): ConversationSummaryItem | null {
  const restorable = conversations.filter((c) => !c.is_text_channel);
  return (
    restorable.find((c) => c.id === activeConversationId) ?? restorable[0] ?? null
  );
}

export function useHomeModel({
  firstName,
  conversations,
  activeConversationId,
  entries,
}: HomeModelInput): HomeModel {
  const realName = resolveRealName(firstName);
  const heroConv = selectHeroConv(conversations, activeConversationId);
  // The conversation title is a short, user-facing label. We deliberately do
  // NOT use sessionSummary here — that's a verbose, third-person internal
  // summary ("The user brought a pattern of…") meant for prompt context.
  const heroSnippet =
    heroConv?.title || heroConv?.preview || "Pick up where you left off.";

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      if (e.section) counts[e.section] = (counts[e.section] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const now = new Date();
  return {
    realName,
    greeting: greetingFor(realName, now),
    dateLine: dateLineFor(now),
    heroConv,
    heroSnippet,
    entryCounts,
  };
}
