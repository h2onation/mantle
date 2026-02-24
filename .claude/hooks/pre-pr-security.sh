#!/bin/bash
# Pre-PR hook: Security scan before opening a pull request
# Checks for: leaked secrets, .env files staged, hardcoded keys, suspicious patterns

cd "$CLAUDE_PROJECT_DIR" || exit 2

ISSUES=""

# Check for .env files in git
ENV_FILES=$(git ls-files --cached --others --exclude-standard | grep -E '\.env($|\.)' 2>/dev/null)
if [ -n "$ENV_FILES" ]; then
  ISSUES="$ISSUES\n[SECRET] .env file(s) tracked or unignored:\n$ENV_FILES\n"
fi

# Check for hardcoded API keys / secrets in staged or tracked files
# Patterns: common secret formats (base64 long strings after key assignments, etc.)
SUSPECT=$(git grep -n -E '(SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|api_key|secret_key|password)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{20,}' -- ':!*.lock' ':!node_modules' ':!.claude' 2>/dev/null)
if [ -n "$SUSPECT" ]; then
  ISSUES="$ISSUES\n[SECRET] Possible hardcoded secrets:\n$SUSPECT\n"
fi

# Check for console.log with sensitive-looking data
CONSOLE_SECRETS=$(git grep -n -E 'console\.(log|info|debug)\(.*([Kk]ey|[Tt]oken|[Ss]ecret|[Pp]assword)' -- '*.ts' '*.tsx' ':!node_modules' 2>/dev/null)
if [ -n "$CONSOLE_SECRETS" ]; then
  ISSUES="$ISSUES\n[LEAK] Console logging potentially sensitive data:\n$CONSOLE_SECRETS\n"
fi

# Check for TODO/FIXME security notes
SEC_TODOS=$(git grep -n -iE '(TODO|FIXME|HACK|XXX).*(security|auth|token|secret|vuln)' -- '*.ts' '*.tsx' ':!node_modules' 2>/dev/null)
if [ -n "$SEC_TODOS" ]; then
  ISSUES="$ISSUES\n[NOTE] Security-related TODOs:\n$SEC_TODOS\n"
fi

# Check npm audit
AUDIT=$(npm audit --json 2>/dev/null)
VULN_COUNT=$(echo "$AUDIT" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null)
CRIT_COUNT=$(echo "$AUDIT" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null)

if [ "$VULN_COUNT" != "0" ] && [ "$VULN_COUNT" != "null" ]; then
  ISSUES="$ISSUES\n[VULN] npm audit: $VULN_COUNT high severity vulnerabilities\n"
fi
if [ "$CRIT_COUNT" != "0" ] && [ "$CRIT_COUNT" != "null" ]; then
  ISSUES="$ISSUES\n[VULN] npm audit: $CRIT_COUNT critical severity vulnerabilities\n"
fi

if [ -n "$ISSUES" ]; then
  echo "Security scan found issues:" >&2
  echo -e "$ISSUES" >&2
  echo "" >&2
  echo "Review these before opening the PR." >&2
  # Exit 2 to block if critical, otherwise just warn
  if echo -e "$ISSUES" | grep -q '\[SECRET\]'; then
    exit 2
  fi
fi

exit 0
