---
name: replay-monitor
description: Replay the Phase 0 shadow monitor over a pasted transcript and report what it reads at each user turn. Use it to sanity-check monitor behavior before prompt changes or scoring-threshold shifts. Invoke with `/replay-monitor` followed by a transcript in USER:/JOVE: format. Flags — `--full-history` bypasses the 8-message window; `--compare` runs both windowed and full-history side-by-side with a divergence table. Read-only against the runtime — never writes to `monitor_reads`, never edits engine code, never commits the saved transcript.
---

# Replay Monitor

Run the Phase 0 shadow monitor (`runMonitor` in `src/lib/persona/monitor.ts`) over a transcript Jeff pastes inline, and report what the monitor reads at each user turn.

The user is non-technical. They will type `/replay-monitor` followed by either:
- A pasted transcript (USER:/JOVE: format, multi-line, possibly with `#` comments), or
- A flag-only line like `--full-history` or `--compare` followed by a pasted transcript.

Your job:

1. **Pull the transcript and flags out of `$ARGUMENTS`.** Anything that starts with `--` is a flag. Everything else is the transcript body. Recognized flags:
   - `--full-history` — bypass the 8-message window
   - `--compare` — run both windowed and full-history, with a divergence table
   - (no flag) — default behavior, matches production exactly

2. **Save the transcript to a file.** Use this exact path so each run is preserved and never overwrites another: `scripts/transcripts/replay-$(date +%Y%m%d-%H%M%S).txt`. Use the Write tool. Do not modify the transcript text — keep `USER:` / `JOVE:` / blank lines / `#` comments as the user pasted them. If the user's paste does NOT contain a `USER:` or `JOVE:` prefix, stop and tell them their transcript needs at least one `USER:` line and one `JOVE:` line to be valid (point at `scripts/transcripts/example.txt` as a reference).

3. **Run the harness via Bash.** Always from the repo root, always with the env file:
   ```
   npx tsx --env-file=.env.local scripts/replay-monitor.ts <the-path-you-just-saved> [flags]
   ```
   This will make one Opus call per user turn (per pass if `--compare`). Don't ask for permission — Jeff invoked the skill, that is permission. Capture stdout AND stderr. The progress lines on stderr show "[replay] turn N/M ... done" — useful for the user to see progress, especially on long transcripts.

4. **Render the result in chat.** Paste the harness output verbatim in a fenced block. Then below the block, add a short read of what jumped out (one or two sentences — direction slope across turns, any rupture firings, anything that doesn't match what you'd expect from eyeballing the transcript). The point is the user came here for a verdict, not just raw numbers.

5. **If the harness errors,** show the error verbatim, identify which of the three common failures it is (missing ANTHROPIC_API_KEY, missing prefix in transcript, file path issue), and tell the user the one-line fix. The harness is mature — most errors trace to one of those three.

6. **What you do NOT do:**
   - Do not write to `public.monitor_reads`. The harness already doesn't; just don't add a step that does.
   - Do not commit the saved transcript file or any other changes. Saved transcripts stay in the worktree as artifacts of the run.
   - Do not edit `src/lib/persona/monitor.ts` or any engine code. This skill is read-only against the runtime.
   - Do not strip or "clean up" the transcript. If the user pasted leading whitespace, comments, oddly-formatted turns, pass it through and let the harness's parser complain if it's malformed. The user's transcript is the input we're testing against.

Confirmation Jeff expects on every run (state at the bottom of your reply, one line each):
- Monitor model: Opus (`claude-opus-4-7`) per `src/lib/persona/config.ts`.
- Harness uses the real `runMonitor()` from `src/lib/persona/monitor.ts`.
- No live data touched. Output is stdout/chat only.

$ARGUMENTS
