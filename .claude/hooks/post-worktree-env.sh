#!/bin/bash
# Symlink .env.local from main repo into newly created worktree.
# Runs as a PostToolUse hook on EnterWorktree.

MAIN_ENV="$CLAUDE_PROJECT_DIR/.env.local"
INPUT=$(cat)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.tool_result.metadata.worktree_path // empty')

# Refuse to fall back to $PWD — at hook time it's typically still the main
# repo, which silently no-ops because main already has its own .env.local.
if [ -z "$WORKTREE_PATH" ]; then
  echo "post-worktree-env: no worktree_path in tool metadata; SessionStart hook will catch it next time" >&2
  exit 0
fi

TARGET_ENV="$WORKTREE_PATH/.env.local"

if [ ! -f "$MAIN_ENV" ]; then
  echo "post-worktree-env: main .env.local missing at $MAIN_ENV" >&2
  exit 0
fi

if [ -e "$TARGET_ENV" ]; then
  exit 0
fi

if ln -s "$MAIN_ENV" "$TARGET_ENV"; then
  echo "post-worktree-env: linked .env.local into $WORKTREE_PATH" >&2
else
  echo "post-worktree-env: failed to create symlink at $TARGET_ENV" >&2
fi
