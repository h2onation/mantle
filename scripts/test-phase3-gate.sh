#!/bin/bash
echo "========================================="
echo "  PHASE 3 GATE: Checkpoints"
echo "========================================="
PASS=0; FAIL=0

# Test 1: Classifier exists
if [ -f "src/lib/sage/classifier.ts" ]; then echo "✅ Classifier exists"; ((PASS++)); else echo "❌ Classifier missing"; ((FAIL++)); fi

# Test 2: Chat API has streaming
if grep -q "text/event-stream" src/app/api/chat/route.ts 2>/dev/null; then
  echo "✅ Chat API streams SSE"; ((PASS++))
else echo "❌ Chat API not streaming"; ((FAIL++)); fi

# Test 3: Checkpoint confirm route exists with Edge Runtime
if [ -f "src/app/api/checkpoint/confirm/route.ts" ] && grep -q "edge" src/app/api/checkpoint/confirm/route.ts; then
  echo "✅ Checkpoint confirm route exists with Edge Runtime"; ((PASS++))
else echo "❌ Checkpoint confirm route missing or no Edge Runtime"; ((FAIL++)); fi

# Test 4: Manual API exists
if [ -f "src/app/api/manual/route.ts" ]; then echo "✅ Manual API exists"; ((PASS++)); else echo "❌ Manual API missing"; ((FAIL++)); fi

# Test 5: Three-column layout
if [ -f "src/components/layout/AppLayout.tsx" ]; then echo "✅ AppLayout exists"; ((PASS++)); else echo "❌ AppLayout missing"; ((FAIL++)); fi

# Test 6: Left nav
if [ -f "src/components/layout/LeftNav.tsx" ]; then echo "✅ LeftNav exists"; ((PASS++)); else echo "❌ LeftNav missing"; ((FAIL++)); fi

# Test 7: Checkpoint card
if [ -f "src/components/context/CheckpointCard.tsx" ]; then echo "✅ CheckpointCard exists"; ((PASS++)); else echo "❌ CheckpointCard missing"; ((FAIL++)); fi

# Test 8: Name normalization on confirm
if grep -qi "lowercase\|toLowerCase\|lower()" src/app/api/checkpoint/confirm/route.ts 2>/dev/null; then
  echo "✅ Pattern name normalization present"; ((PASS++))
else echo "⚠️  Pattern name may not be normalized — check manually"; fi

# Test 9: Build
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Build passes"; ((PASS++)); else echo "❌ Build fails"; ((FAIL++)); fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then echo "❌ PHASE 3 GATE: Fix issues"; exit 1;
else echo "✅ PHASE 3 GATE: PASS"; fi
