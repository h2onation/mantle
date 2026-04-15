---
name: wrap
description: Wrap a session with summary, decision log entries, loose ends, memory review, and next-session starter.
---

Wrap up the current session. Produce a structured summary for the user.

## Steps

1. **Session summary**: Write 2-4 sentences describing what we accomplished this session. Be specific — name features, fixes, files changed. Not a changelog, a narrative.

2. **Decision log entries**: List any decisions made this session that should go in the decision log. Use this exact format for each:

   | Date | Bucket | Decision | Why | What It Replaced |
   |------|--------|----------|-----|-----------------|
   | YYYY-MM-DD | Category | What we decided | Why we decided it | What was there before |

   Bucket categories: Jove Quality, Product + Design, Narrative + Strategy, Infra + Architecture, Business Ops + Legal.
   If no decisions were made this session, say "None."

3. **Loose ends**: List anything unfinished, deferred, or flagged during the session. Include:
   - Work started but not shipped
   - Bugs noticed but not fixed
   - Ideas discussed but not built
   - Branches or worktrees left open
   If nothing, say "Clean."

4. **Memories saved**: List any memories written to the memory system during this session (file name + one-line description). If none were saved, say "None."

5. **Next session starter**: Write 1-2 sentences that future-me can read cold to pick up where we left off. What's the most important thing to do next? What context would be lost without this note?

## Format

Output all five sections with clear headers. Keep it scannable — no walls of text.
