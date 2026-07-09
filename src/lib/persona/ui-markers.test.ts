import { describe, it, expect } from "vitest";
import {
  stripTrailingMarker,
  stripDefunctMarkers,
  RETIRED_MARKERS,
} from "@/lib/persona/ui-markers";

const SECTIONS = "---sections---";
const SITUATION = "---start-situation---";

describe("stripTrailingMarker", () => {
  it("strips a marker on its own line at the end of the message", () => {
    const r = stripTrailingMarker(`Where do you want to start?\n${SECTIONS}`, SECTIONS);
    expect(r.present).toBe(true);
    expect(r.text).toBe("Where do you want to start?");
  });

  it("strips trailing whitespace/newlines after the marker too", () => {
    const r = stripTrailingMarker(`Pick one.\n${SECTIONS}\n\n  `, SECTIONS);
    expect(r.present).toBe(true);
    expect(r.text).toBe("Pick one.");
  });

  it("treats the marker as the entire message", () => {
    const r = stripTrailingMarker(SECTIONS, SECTIONS);
    expect(r.present).toBe(true);
    expect(r.text).toBe("");
  });

  // The core regression guard (senior review, 2026-06-24): a bare indexOf would
  // truncate this message at the token and fire a spurious affordance.
  it("does NOT fire or truncate when the token appears in prose mid-message", () => {
    const input = `I noticed how you put ${SITUATION} in your message.`;
    const r = stripTrailingMarker(input, SITUATION);
    expect(r.present).toBe(false);
    expect(r.text).toBe(input);
  });

  it("does NOT fire when the token is glued to the tail of a word (not its own line)", () => {
    const input = `take this somewhere${SITUATION}`;
    const r = stripTrailingMarker(input, SITUATION);
    expect(r.present).toBe(false);
    expect(r.text).toBe(input);
  });

  it("returns present=false and unchanged text when the marker is absent", () => {
    const input = "just a normal reply.";
    const r = stripTrailingMarker(input, SECTIONS);
    expect(r.present).toBe(false);
    expect(r.text).toBe(input);
  });

  it("strips stacked trailing markers when applied in sequence (either order)", () => {
    // call-persona loops over both markers, so a (prompt-forbidden) double
    // emission still strips clean rather than leaking a raw token to chat/DB.
    let text = `Done.\n${SECTIONS}\n${SITUATION}`;
    let sawSections = false;
    let sawSituation = false;
    for (let stripped = true; stripped; ) {
      stripped = false;
      const a = stripTrailingMarker(text, SECTIONS);
      if (a.present) { sawSections = true; text = a.text; stripped = true; }
      const b = stripTrailingMarker(text, SITUATION);
      if (b.present) { sawSituation = true; text = b.text; stripped = true; }
    }
    expect(sawSections).toBe(true);
    expect(sawSituation).toBe(true);
    expect(text).toBe("Done.");
  });
});

describe("stripDefunctMarkers", () => {
  it("strips a retired ---chips--- marker AND its trailing payload lines", () => {
    // The exact regression: a stale prompt made Jove emit the retired chips
    // block after the save acknowledgment; with the parser gone it rendered raw.
    const input = [
      "Entry has been saved in your Manual.",
      "",
      "---chips---",
      "Start somewhere new",
      "Keep this thread going",
      "Take a break",
    ].join("\n");
    expect(stripDefunctMarkers(input)).toBe(
      "Entry has been saved in your Manual."
    );
  });

  it("drops a stray/hallucinated bare marker line without cutting real prose after it", () => {
    const input = "Here's a thought.\n---mystery---\nAnd here's the rest.";
    expect(stripDefunctMarkers(input)).toBe(
      "Here's a thought.\nAnd here's the rest."
    );
  });

  it("leaves ordinary prose untouched (no marker present)", () => {
    const input = "No markers here — just an em dash and a plain reply.";
    expect(stripDefunctMarkers(input)).toBe(input);
  });

  it("does not treat inline --- inside a sentence as a marker", () => {
    const input = "The pattern is self-reinforcing --- it feeds itself.";
    expect(stripDefunctMarkers(input)).toBe(input);
  });

  it("keeps ---chips--- in the retired registry (coupling guard)", () => {
    // If a marker is retired in code, it must be in this list or it leaks.
    expect(RETIRED_MARKERS).toContain("---chips---");
  });
});
