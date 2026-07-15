#!/bin/bash
# Pre-commit hook: Run linter and fix formatting issues before commit

cd "$CLAUDE_PROJECT_DIR" || exit 2

echo "Running linter..." >&2
OUTPUT=$(npx next lint --fix 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "Linter found issues that could not be auto-fixed — commit blocked." >&2
  echo "" >&2
  echo "$OUTPUT" | tail -30 >&2
  exit 2
fi

exit 0
