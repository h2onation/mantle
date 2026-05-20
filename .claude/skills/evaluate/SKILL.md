# Evaluate Jove Conversation
Read these files first (in order):
1. src/lib/persona/voice-scaffold.ts (BASE voice — intro paragraphs, voice rules, register, landings, banned phrases, scaffolded sections; canonical source for cross-persona content)
2. src/lib/persona/voice-autistic.ts (AUTISTIC trait delta — concrete-substitution for emotional questions, literal sensory language, masking gap-naming, autism phantom-baseline social form; layered on top of base when autistic mode is active)
3. src/lib/persona/voice-adhd.ts (ADHD trait delta — knowing-doing gap, interest-as-mechanism, ADHD phantom-baseline care-as-execution form; layered on top of base when adhd mode is active. Users stack autistic + adhd for AuDHD)
4. src/lib/persona/voice-dyslexic.ts (DYSLEXIC trait delta — short-sentence cadence, visual register, dyslexic phantom-baseline medium/format form shipping as HYPOTHESIS; layered on top of base when dyslexic mode is active)
5. src/lib/persona/system-prompt.ts (composeTier2 + Tier 1 constitutional rules including Rule 4 handoff rule + Tier 3 ladder including bootstrap OPENER section)
6. src/lib/persona/confirm-checkpoint.ts (composition rules + headline validator + acknowledgment)
7. src/lib/persona/situation-copy.ts (SITUATION_OPENER constant Jove delivers verbatim on turn 1)
8. src/lib/persona/call-persona.ts (pipeline ordering)
9. .claude/docs/quality-framework.md
Evaluate the transcript below. Run every Part A check, cite exact instructions from source files for violations. Apply the NEW-MOVE TAG per turn per the framework's taxonomy (list — multiple tags allowed per turn). Write Part B clinical assessments. Run Part C if user brought a live situation. Run Part D if a named test persona was used. Be adversarial. Do not change any files.
$ARGUMENTS
