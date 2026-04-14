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
 *   2. Regenerate the vCard in public/persona-contact.vcf with the new FN field.
 *   3. Update the static brand copy in public/offline.html (not templated).
 *   4. Review legal copy in src/app/{terms,privacy,sms}/page.tsx
 *      — some references may need legal re-approval.
 *   5. Review user-facing brand copy in public/narrative/*.html (marketing pages).
 *   6. Re-render pitch-video assets (see pitch-video/README).
 *   7. Anthropic prompt cache will invalidate on next request.
 *   8. A few tests in system-prompt.test.ts and generate-summary.test.ts
 *      assert the literal current name — expected to fail and prompt
 *      conscious review; update their assertions to use PERSONA_NAME.
 */
export const PERSONA_NAME = "Sage";

/**
 * Capitalized form for SMS messages, vCard, legal pages.
 * Keep in sync with PERSONA_NAME.
 */
export const PERSONA_NAME_FORMAL = "Sage";
