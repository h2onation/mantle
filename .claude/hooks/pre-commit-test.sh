#!/bin/bash
# Pre-commit hook: Run build (includes type checking) and block commit on failure
# This project has no test suite — build is the closest verification step.

cd "$CLAUDE_PROJECT_DIR" || exit 2

echo "Running build check..." >&2
OUTPUT=$(npm run build 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "Build failed — commit blocked." >&2
  echo "" >&2
  echo "$OUTPUT" | tail -30 >&2
  exit 2
fi

exit 0
