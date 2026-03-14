---
name: evaluate
description: Evaluate a Sage conversation transcript against the quality framework.
---
Read these files first (in order):
1. src/lib/sage/system-prompt.ts
2. src/lib/sage/confirm-checkpoint.ts
3. src/lib/sage/call-sage.ts
4. .claude/docs/quality-framework.md
Evaluate the transcript below. Run every Part A check, cite exact instructions from source files for violations. Write Part B clinical assessments. Run Part C if user brought a live situation. Run Part D if a named test persona was used. Be adversarial. Do not change any files.
$ARGUMENTS
