#!/bin/bash
# Pre-commit hook: Remind to update docs if significant files changed

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Get staged files
STAGED=$(git diff --cached --name-only 2>/dev/null)

if [ -z "$STAGED" ]; then
  exit 0
fi

# Check if any significant source files are staged (not just docs/config)
SRC_CHANGES=$(echo "$STAGED" | grep -E '^src/|^supabase/' | head -1)

if [ -z "$SRC_CHANGES" ]; then
  exit 0
fi

# Check if CLAUDE.md or DRIFT_LOG.md is already being committed
DOCS_INCLUDED=$(echo "$STAGED" | grep -E 'CLAUDE\.md|DRIFT_LOG\.md' | head -1)

if [ -n "$DOCS_INCLUDED" ]; then
  exit 0
fi

# Source files changed but no docs — output a reminder (non-blocking)
cat <<'CONTEXT'
{
  "additionalContext": "Source files are being committed but CLAUDE.md and .claude/DRIFT_LOG.md are not staged. Consider whether these changes affect documented behavior (API routes, architecture, UI, features, dead features, env vars, known issues). If so, update the docs and include them in this commit. If the changes are minor (bug fix, small tweak), no doc update needed — proceed."
}
CONTEXT

exit 0
