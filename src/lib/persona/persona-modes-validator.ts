import {
  PERSONA_MODES,
  isPersonaMode,
} from "@/lib/persona/persona-mode-toggle";
import type { PersonaMode } from "@/lib/persona/system-prompt";

export interface ValidationOk {
  ok: true;
  value: PersonaMode[];
}

export interface ValidationErr {
  ok: false;
  error: string;
}

/**
 * Validate a persona_modes payload coming in over HTTP. Rules:
 *   - must be an array
 *   - non-empty
 *   - every element is a known PersonaMode (autistic | adhd | dyslexic | general)
 *   - "general" is exclusive — cannot combine with any neurotype mode
 *
 * Returns the normalized (deduped) array on success so the caller can
 * persist it directly without worrying about duplicate elements.
 *
 * Lives in a non-route file because Next.js Route exports are restricted
 * to handler functions + a few config fields; this validator is consumed
 * by `src/app/api/user/persona-modes/route.ts` and exercised directly by
 * its test.
 */
export function validatePersonaModes(
  input: unknown,
): ValidationOk | ValidationErr {
  if (!Array.isArray(input)) {
    return { ok: false, error: "persona_modes must be an array" };
  }
  if (input.length === 0) {
    return { ok: false, error: "persona_modes must have at least one element" };
  }
  if (!input.every(isPersonaMode)) {
    return {
      ok: false,
      error: `every persona_modes element must be one of: ${PERSONA_MODES.join(", ")}`,
    };
  }
  const unique = Array.from(new Set(input as PersonaMode[]));
  if (unique.includes("general") && unique.length > 1) {
    return {
      ok: false,
      error: "\"general\" cannot combine with any other persona mode",
    };
  }
  return { ok: true, value: unique };
}
