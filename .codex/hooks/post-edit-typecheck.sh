#!/bin/bash
# Post-edit hook: Run TypeScript type check after file edits
# Only runs on .ts/.tsx files

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip non-TypeScript files
if [[ -n "$FILE_PATH" && ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

OUTPUT=$(npx tsc --noEmit 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  ERROR_COUNT=$(echo "$OUTPUT" | grep -c "error TS")
  echo "TypeScript type check found $ERROR_COUNT error(s):" >&2
  echo "" >&2
  echo "$OUTPUT" | grep "error TS" | head -20 >&2
  # Don't exit 2 — this is informational, not blocking
  exit 0
fi

exit 0
