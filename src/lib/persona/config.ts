/**
 * User-facing display name for the AI persona.
 *
 * Change this one value to rename the AI everywhere in the UI.
 * Internal code uses "persona" as the technical identifier — this
 * constant is the public-facing label rendered to users.
 *
 * Currently "Sage" during transition. Target: "mywalnut" (the AI
 * collapses into the platform identity — no separate persona name)
 * once all user-facing strings are wired through this constant.
 *
 * Rebrand checklist when changing this value:
 *   1. Update PERSONA_NAME and PERSONA_NAME_FORMAL below.
 *   2. Regenerate the vCard in public/ with the new FN field.
 *   3. Review legal copy in src/app/{terms,privacy,sms}/page.tsx
 *      — some references may need legal re-approval.
 *   4. Re-render pitch-video assets (see pitch-video/README).
 *   5. Anthropic prompt cache will invalidate on next request.
 */
export const PERSONA_NAME = "Sage";

/**
 * Capitalized form for SMS messages, vCard, legal pages.
 * Keep in sync with PERSONA_NAME.
 */
export const PERSONA_NAME_FORMAL = "Sage";
