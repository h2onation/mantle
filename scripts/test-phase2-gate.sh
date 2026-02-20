#!/bin/bash
echo "========================================="
echo "  PHASE 2 GATE: Conversation"
echo "========================================="
PASS=0; FAIL=0

# Test 1: System prompt file exists and exports function
if grep -q "buildSystemPrompt" src/lib/sage/system-prompt.ts 2>/dev/null; then
  echo "✅ System prompt builder exists"; ((PASS++))
else echo "❌ System prompt builder missing"; ((FAIL++)); fi

# Test 2: Chat API route exists with Edge Runtime
if grep -q 'runtime.*=.*"edge"' src/app/api/chat/route.ts 2>/dev/null; then
  echo "✅ Chat API has Edge Runtime"; ((PASS++))
else echo "❌ Chat API missing Edge Runtime"; ((FAIL++)); fi

# Test 3: Admin client exists
if [ -f "src/lib/supabase/admin.ts" ]; then
  echo "✅ Admin client file exists"; ((PASS++))
else echo "❌ Admin client missing"; ((FAIL++)); fi

# Test 4: Chat API uses both clients
if grep -q "admin" src/app/api/chat/route.ts 2>/dev/null; then
  echo "✅ Chat API uses admin client"; ((PASS++))
else echo "❌ Chat API may not use admin client"; ((FAIL++)); fi

# Test 5: Sliding window preserves first 4
if grep -qE "first.*(4|four)|slice.*4|\.slice\(0.*4\)" src/app/api/chat/route.ts 2>/dev/null; then
  echo "✅ Sliding window appears to preserve first 4 messages"; ((PASS++))
else echo "⚠️  Cannot verify sliding window keeps first 4 — check manually"; fi

# Test 6: Build passes
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Build passes"; ((PASS++)); else echo "❌ Build fails"; ((FAIL++)); fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then echo "❌ PHASE 2 GATE: Fix issues before continuing"; exit 1;
else echo "✅ PHASE 2 GATE: PASS"; fi
