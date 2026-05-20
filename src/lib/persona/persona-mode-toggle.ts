import type { PersonaMode } from "@/lib/persona/system-prompt";

export const PERSONA_MODES = ["autistic", "adhd", "dyslexic", "general"] as const;

export function isPersonaMode(value: unknown): value is PersonaMode {
  return (
    typeof value === "string" &&
    (PERSONA_MODES as readonly string[]).includes(value)
  );
}

// "general" is exclusive — selecting it clears all neurotype modes and vice versa.
// The three neurotype modes (autistic, adhd, dyslexic) can combine freely.
export function togglePersonaMode(
  current: PersonaMode[],
  picked: PersonaMode
): PersonaMode[] {
  if (picked === "general") {
    return current.includes("general") ? [] : ["general"];
  }
  const without = current.filter((m) => m !== picked && m !== "general");
  if (current.includes(picked)) return without;
  return [...without, picked];
}
