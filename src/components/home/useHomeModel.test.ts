import { describe, it, expect } from "vitest";
import {
  greetingFor,
  dateLineFor,
  resolveRealName,
  selectHeroConv,
} from "@/components/home/useHomeModel";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";

// selectHeroConv only reads id + is_text_channel; build minimal stand-ins.
function conv(
  id: string,
  isText = false,
): ConversationSummaryItem {
  return { id, is_text_channel: isText } as unknown as ConversationSummaryItem;
}

describe("greetingFor", () => {
  it("buckets the time of day", () => {
    expect(greetingFor(null, new Date("2026-06-18T08:00:00"))).toBe("Good morning.");
    expect(greetingFor(null, new Date("2026-06-18T13:00:00"))).toBe("Good afternoon.");
    expect(greetingFor(null, new Date("2026-06-18T20:00:00"))).toBe("Good evening.");
  });

  it("appends the name when present", () => {
    expect(greetingFor("Jeff", new Date("2026-06-18T20:00:00"))).toBe(
      "Good evening, Jeff.",
    );
  });

  it("uses the noon and 6pm boundaries", () => {
    expect(greetingFor(null, new Date("2026-06-18T11:59:00"))).toContain("morning");
    expect(greetingFor(null, new Date("2026-06-18T12:00:00"))).toContain("afternoon");
    expect(greetingFor(null, new Date("2026-06-18T17:59:00"))).toContain("afternoon");
    expect(greetingFor(null, new Date("2026-06-18T18:00:00"))).toContain("evening");
  });
});

describe("dateLineFor", () => {
  it("formats weekday · month day", () => {
    // Constructed in local time (not an ISO string) so the assertion is
    // timezone-independent. 2026-06-18 is a Thursday.
    expect(dateLineFor(new Date(2026, 5, 18, 12))).toBe("Thursday · June 18");
  });
});

describe("resolveRealName", () => {
  it("treats the 'User' placeholder and empties as no name", () => {
    expect(resolveRealName("User")).toBeNull();
    expect(resolveRealName(null)).toBeNull();
    expect(resolveRealName(undefined)).toBeNull();
    expect(resolveRealName("")).toBeNull();
  });

  it("keeps a real name", () => {
    expect(resolveRealName("Jeff")).toBe("Jeff");
  });
});

describe("selectHeroConv", () => {
  it("prefers the active conversation when restorable", () => {
    const list = [conv("a"), conv("b"), conv("c")];
    expect(selectHeroConv(list, "b")?.id).toBe("b");
  });

  it("falls back to the most-recent restorable thread", () => {
    const list = [conv("a"), conv("b")];
    expect(selectHeroConv(list, null)?.id).toBe("a");
  });

  it("excludes text channels from selection", () => {
    const list = [conv("text", true), conv("real")];
    // active id points at a text channel → not restorable → fall back to first restorable
    expect(selectHeroConv(list, "text")?.id).toBe("real");
  });

  it("returns null when there is nothing restorable", () => {
    expect(selectHeroConv([], null)).toBeNull();
    expect(selectHeroConv([conv("t1", true)], "t1")).toBeNull();
  });
});
