#!/bin/bash
# Ensure the current worktree has a .env.local symlink to the main repo's .env.local.
# Runs as a SessionStart hook so every session self-heals, regardless of how the
# worktree was created (EnterWorktree tool, raw `git worktree add`, etc.).

set -e

MAIN_ENV="$CLAUDE_PROJECT_DIR/.env.local"
CWD="$PWD"

# Only act inside a worktree under .claude/worktrees/. Skip the main repo and
# anything outside the project.
case "$CWD" in
  "$CLAUDE_PROJECT_DIR"/.claude/worktrees/*) ;;
  *) exit 0 ;;
esac

TARGET_ENV="$CWD/.env.local"

# Already symlinked or already a real file — nothing to do.
if [ -e "$TARGET_ENV" ]; then
  exit 0
fi

if [ ! -f "$MAIN_ENV" ]; then
  echo "session-start-env: main .env.local not found at $MAIN_ENV" >&2
  exit 0
fi

if ln -s "$MAIN_ENV" "$TARGET_ENV"; then
  echo "session-start-env: linked .env.local into $CWD" >&2
else
  echo "session-start-env: failed to create symlink at $TARGET_ENV" >&2
fi
