#!/bin/bash
echo "========================================="
echo "  PHASE 5 GATE: Error Handling"
echo "========================================="
PASS=0; FAIL=0

# Test 1: Shared Anthropic helper exists
if [ -f "src/lib/anthropic.ts" ]; then echo "✅ anthropic.ts exists"; ((PASS++)); else echo "❌ anthropic.ts missing"; ((FAIL++)); fi

# Test 2: SDK removed from call-sage
if grep -q "anthropic-ai/sdk" src/lib/sage/call-sage.ts 2>/dev/null; then
  echo "❌ call-sage still imports SDK"; ((FAIL++))
else echo "✅ call-sage uses raw fetch"; ((PASS++)); fi

# Test 3: SDK removed from classifier
if grep -q "anthropic-ai/sdk" src/lib/sage/classifier.ts 2>/dev/null; then
  echo "❌ classifier still imports SDK"; ((FAIL++))
else echo "✅ classifier uses raw fetch"; ((PASS++)); fi

# Test 4: SDK removed from summary route
if grep -q "anthropic-ai/sdk" src/app/api/session/summary/route.ts 2>/dev/null; then
  echo "❌ summary route still imports SDK"; ((FAIL++))
else echo "✅ summary route uses raw fetch"; ((PASS++)); fi

# Test 5: call-sage has emitError helper
if grep -q "emitError" src/lib/sage/call-sage.ts 2>/dev/null; then
  echo "✅ call-sage has emitError helper"; ((PASS++))
else echo "❌ call-sage missing emitError helper"; ((FAIL++)); fi

# Test 6: call-sage has timeout handling
if grep -q "AbortError" src/lib/sage/call-sage.ts 2>/dev/null; then
  echo "✅ call-sage handles timeout"; ((PASS++))
else echo "❌ call-sage missing timeout handling"; ((FAIL++)); fi

# Test 7: classifier has JSON parse fallback logging
if grep -q "JSON parse failed" src/lib/sage/classifier.ts 2>/dev/null; then
  echo "✅ classifier logs parse failures"; ((PASS++))
else echo "❌ classifier missing parse failure logging"; ((FAIL++)); fi

# Test 8: SSE parser handles both message and error fields
if grep -q "event.message || event.error" src/lib/utils/sse-parser.ts 2>/dev/null; then
  echo "✅ SSE parser handles message+error fields"; ((PASS++))
else echo "❌ SSE parser missing dual field handling"; ((FAIL++)); fi

# Test 9: useChat has errorMessage state
if grep -q "errorMessage" src/lib/hooks/useChat.ts 2>/dev/null; then
  echo "✅ useChat has errorMessage state"; ((PASS++))
else echo "❌ useChat missing errorMessage state"; ((FAIL++)); fi

# Test 10: useChat has retryLastMessage
if grep -q "retryLastMessage" src/lib/hooks/useChat.ts 2>/dev/null; then
  echo "✅ useChat has retryLastMessage"; ((PASS++))
else echo "❌ useChat missing retryLastMessage"; ((FAIL++)); fi

# Test 11: useChat has checkpointError state
if grep -q "checkpointError" src/lib/hooks/useChat.ts 2>/dev/null; then
  echo "✅ useChat has checkpointError state"; ((PASS++))
else echo "❌ useChat missing checkpointError state"; ((FAIL++)); fi

# Test 12: useChat handles 401 redirect
if grep -q "status === 401" src/lib/hooks/useChat.ts 2>/dev/null; then
  echo "✅ useChat handles 401 redirect"; ((PASS++))
else echo "❌ useChat missing 401 handling"; ((FAIL++)); fi

# Test 13: ChatPane accepts errorMessage prop
if grep -q "errorMessage" src/components/layout/ChatPane.tsx 2>/dev/null; then
  echo "✅ ChatPane has errorMessage prop"; ((PASS++))
else echo "❌ ChatPane missing errorMessage prop"; ((FAIL++)); fi

# Test 14: ChatPane has Retry button
if grep -q "Retry" src/components/layout/ChatPane.tsx 2>/dev/null; then
  echo "✅ ChatPane has Retry button"; ((PASS++))
else echo "❌ ChatPane missing Retry button"; ((FAIL++)); fi

# Test 15: CheckpointCard accepts error prop
if grep -q "error" src/components/context/CheckpointCard.tsx 2>/dev/null; then
  echo "✅ CheckpointCard has error prop"; ((PASS++))
else echo "❌ CheckpointCard missing error prop"; ((FAIL++)); fi

# Test 16: Build passes
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Build passes"; ((PASS++)); else echo "❌ Build fails"; ((FAIL++)); fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then echo "❌ PHASE 5 GATE: Fix issues"; exit 1;
else echo "✅ PHASE 5 GATE: PASS"; fi
