# Evaluate Jove Conversation

Read these files first (in order):
1. **The prompt actually in force — pull it, don't assume it.** The founder live-edits Jove's prompt from the admin "Tuning" page; the override usually differs from the code constant. Query `persona_voice_overrides` (key `conductor_prompt`, read-only) — if a row is enabled, THAT text is the prompt the transcript was produced under; score against it. `src/lib/persona/conductor-prompt.ts` (`CONDUCTOR_PROMPT`, sole voice since 2026-07-02; ADR-052) is the permanent floor and version history, not necessarily the live text. Scoring a transcript against the wrong prompt text produces false violations.
2. docs/reference/conductor-scoring.md — the scoring rubric. Apply **Part 1 (core rubric) in full**: number the turns, compute the three mechanical signals, score all six dimensions with turn citations, and produce the Step 3 verdict. Pull in Part 2 expansion modules only when the question at hand needs them (e.g., E1 if judging `---reflection-ready---` timing, E2 if a composed entry is available, E3 if a rupture occurred).

Rules:
- Be adversarial. An uncited score is invalid.
- The user is the author: never credit Jove for steering, concluding for the user, or hunting for an entry.
- Transcripts dated before 2026-07-02 were produced by deleted voice architectures (tiers, rebuilt/legacy). Score them against the current rubric for calibration value, but do not treat rubric misses as violations of instructions Jove didn't have.
- Do not change any files. Read-only.
- If the evaluation surfaces a prompt-change candidate, LOG it as a classified note (recurring failure / red line / taste) in your report — never edit the conductor prompt.

$ARGUMENTS
