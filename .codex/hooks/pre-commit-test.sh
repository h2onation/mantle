#!/bin/bash
# Pre-commit hook: Run tests + build and block commit on failure

cd "$CLAUDE_PROJECT_DIR" || exit 2

echo "Running tests..." >&2
TEST_OUTPUT=$(npm run test 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo "Tests failed — commit blocked." >&2
  echo "" >&2
  echo "$TEST_OUTPUT" | tail -30 >&2
  exit 2
fi

echo "Running build check..." >&2
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo "Build failed — commit blocked." >&2
  echo "" >&2
  echo "$BUILD_OUTPUT" | tail -30 >&2
  exit 2
fi

exit 0
