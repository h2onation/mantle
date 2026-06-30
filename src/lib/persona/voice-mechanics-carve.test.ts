import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REBUILT_MECHANICS, MECHANICS_PARTS } from "@/lib/persona/voice-scaffold";

// Byte-identical guard for the REBUILT_MECHANICS carve (strip-to-baseline
// experiment, Part A). The fixture holds the EXACT bytes of the live constant
// captured BEFORE the carve. If the reassembled constant ever diverges from
// those bytes, the live rebuilt voice has changed — this test fails and the
// carve is not safe to ship.
describe("REBUILT_MECHANICS carve", () => {
  const frozen: string = JSON.parse(
    readFileSync(
      resolve(__dirname, "__fixtures__/rebuilt-mechanics.snapshot.json"),
      "utf8",
    ),
  );

  it("reassembles byte-identical to the pre-carve snapshot", () => {
    expect(REBUILT_MECHANICS).toBe(frozen);
  });

  it("every part is a verbatim substring of the assembled constant", () => {
    for (const [name, part] of Object.entries(MECHANICS_PARTS)) {
      expect(REBUILT_MECHANICS.includes(part), `part "${name}" not found`).toBe(
        true,
      );
    }
  });
});
