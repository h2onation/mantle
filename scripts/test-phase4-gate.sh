#!/bin/bash
echo "========================================="
echo "  PHASE 4 GATE: Persistence"
echo "========================================="
PASS=0; FAIL=0

if [ -f "src/app/api/session/summary/route.ts" ]; then echo "✅ Summary API exists"; ((PASS++)); else echo "❌ Missing"; ((FAIL++)); fi
if [ -f "src/components/context/ManualView.tsx" ]; then echo "✅ ManualView exists"; ((PASS++)); else echo "❌ Missing"; ((FAIL++)); fi

npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Build passes"; ((PASS++)); else echo "❌ Build fails"; ((FAIL++)); fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then echo "❌ PHASE 4 GATE: Fix issues"; exit 1;
else echo "✅ PHASE 4 GATE: PASS"; fi
