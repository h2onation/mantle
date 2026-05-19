# Evaluate Jove Conversation
Read these files first (in order):
1. src/lib/persona/voice-scaffold.ts (BASE voice — intro paragraphs, voice rules, register, landings, banned phrases, scaffolded sections; canonical source for cross-persona content)
2. src/lib/persona/voice-autistic.ts (AUTISTIC trait delta — somatic-first, mirror-exact-language, masking gap-naming; layered on top of base)
3. src/lib/persona/system-prompt.ts (composeTier2 + Tier 1 + Tier 3 ladder including bootstrap OPENER section)
4. src/lib/persona/confirm-checkpoint.ts (composition rules + headline validator + acknowledgment)
5. src/lib/persona/situation-copy.ts (SITUATION_OPENER constant Jove delivers verbatim on turn 1)
6. src/lib/persona/call-persona.ts (pipeline ordering)
7. .claude/docs/quality-framework.md
Evaluate the transcript below. Run every Part A check, cite exact instructions from source files for violations. Write Part B clinical assessments. Run Part C if user brought a live situation. Run Part D if a named test persona was used. Be adversarial. Do not change any files.
$ARGUMENTS
