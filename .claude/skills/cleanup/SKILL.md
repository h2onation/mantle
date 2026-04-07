# Branch Cleanup Skill

Purpose: remove merged worktrees and their branches without killing any worktree that currently has an active Claude Code session running against it.

## Active-session detection

Every Claude Code session writes a `.jsonl` transcript to `~/.claude/projects/<slug>/` where `<slug>` is the worktree's absolute path with `/` and `.` both replaced by `-`.

Examples:
- `/Users/jeffwaters/mantle` → `-Users-jeffwaters-mantle`
- `/Users/jeffwaters/mantle/.claude/worktrees/brave-banach` → `-Users-jeffwaters-mantle--claude-worktrees-brave-banach`

A worktree is considered **active** if its slug directory exists AND contains at least one `.jsonl` file modified within the last 2 hours. Active worktrees must be left alone — do not `git worktree remove`, do not delete the branch, do not touch the filesystem under them.

## Procedure

1. `cd /Users/jeffwaters/mantle` (main repo root — never run cleanup from inside a worktree).
2. `git worktree list` and `git branch` to see the full state.
3. `git fetch origin --prune` so the local view of merged branches matches the remote.
4. For each worktree other than the main repo root:
   a. Compute its slug by replacing `/` and `.` with `-` in its absolute path.
   b. Check `~/.claude/projects/<slug>/` for any `.jsonl` file modified in the last 2 hours:
      ```bash
      find ~/.claude/projects/<slug> -name "*.jsonl" -mmin -120 2>/dev/null
      ```
      Non-empty output → **active**. Skip this worktree entirely. Print `SKIP: <path> (active session, last activity <timestamp>)`.
   c. If inactive, verify the branch is merged into main: `git branch --merged main | grep <branch-name>`. If not merged, skip and warn — never delete unmerged work silently.
   d. If merged and inactive, remove the worktree: `git worktree remove <path>`.
   e. `cd /Users/jeffwaters/mantle` to re-anchor (git worktree remove can reset cwd).
   f. Delete the local branch: `git branch -d <branch>`.
   g. If the remote branch still exists and is merged: `git push origin --delete <branch>`.
5. After all worktrees are processed, also delete any merged **branches without worktrees** that are fully merged into main.
6. Run `git worktree list` and `git branch` at the end to show the final state.

## Hard rules

- **Never run `rm -rf`** on any directory containing `.env*` files. Use `git worktree remove` only — it handles cleanup safely.
- **Never delete an unmerged branch.** If `git branch -d` fails because the branch is not fully merged, stop and report it. Do not use `-D`.
- **Never delete the main repo worktree** (`/Users/jeffwaters/mantle`). It's never in the deletion list.
- **Never touch an active worktree's files, branch, or remote branch.** Active = `.jsonl` modified in the last 2 hours.
- **Never delete session directories under `~/.claude/projects/`.** Those belong to Claude Code, not git. They can be left alone even when the worktree they correspond to has been removed.
- If you cannot verify active status (e.g., `find` errors, permissions), treat the worktree as **active** and skip it. Err on the side of leaving things alone.

## Override

If the user says "force cleanup <name>" or similar, skip the 2-hour check for that specific worktree only. Never bypass the merged check — unmerged work is always protected.

## Reporting

At the end, print a summary:
```
CLEANUP SUMMARY
Removed worktrees: [list]
Deleted local branches: [list]
Deleted remote branches: [list]
Skipped (active session): [list with last-activity timestamps]
Skipped (unmerged): [list with reason]
```
