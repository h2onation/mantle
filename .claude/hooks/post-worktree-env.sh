#!/bin/bash
# Symlink .env.local from main repo into newly created worktree.
# Runs as a PostToolUse hook on EnterWorktree.

MAIN_ENV="$CLAUDE_PROJECT_DIR/.env.local"
INPUT=$(cat)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.tool_result.metadata.worktree_path // empty')

# Fallback: if no metadata, check current working directory
if [ -z "$WORKTREE_PATH" ]; then
  WORKTREE_PATH="$PWD"
fi

TARGET_ENV="$WORKTREE_PATH/.env.local"

if [ -f "$MAIN_ENV" ] && [ ! -e "$TARGET_ENV" ]; then
  ln -s "$MAIN_ENV" "$TARGET_ENV" 2>/dev/null
fi
