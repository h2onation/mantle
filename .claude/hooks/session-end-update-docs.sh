#!/bin/bash
# Session-end hook: Remind Claude to update CLAUDE.md if significant changes were made
# This runs as a Stop hook — it outputs context that Claude will see

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Check if there are uncommitted changes or recent commits in this session
CHANGES=$(git diff --stat HEAD~3 2>/dev/null | tail -5)
UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -10)

if [ -z "$CHANGES" ] && [ -z "$UNCOMMITTED" ]; then
  exit 0
fi

# Output context for Claude to act on
cat <<'CONTEXT'
{
  "additionalContext": "IMPORTANT: Before ending, check if any significant changes were made this session (new features, DB changes, architectural decisions, new API routes, new files, removed features). If so, update CLAUDE.md to reflect what was built, replacing outdated sections rather than appending. Add a Drift Log entry with today's date and a summary of changes."
}
CONTEXT

exit 0
