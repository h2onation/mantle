#!/bin/bash
echo "========================================="
echo "  PHASE 1 GATE: Foundation"
echo "========================================="
PASS=0
FAIL=0

# Test 1: Project builds without errors
echo ""
echo "Test 1: Build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Project builds"; ((PASS++)); else echo "❌ Build fails"; ((FAIL++)); fi

# Test 2: Required files exist
echo ""
echo "Test 2: File structure..."
FILES=(
  "src/lib/supabase/client.ts"
  "src/lib/supabase/server.ts"
  "src/lib/supabase/admin.ts"
  "middleware.ts"
  "src/app/login/page.tsx"
  "src/app/auth/callback/route.ts"
  "src/app/page.tsx"
  "src/app/layout.tsx"
  "supabase/schema.sql"
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then echo "  ✅ $f"; ((PASS++)); else echo "  ❌ $f missing"; ((FAIL++)); fi
done

# Test 3: Environment variables set
echo ""
echo "Test 3: Environment..."
source .env.local 2>/dev/null
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ "$NEXT_PUBLIC_SUPABASE_URL" != "your-supabase-url" ]; then
  echo "  ✅ Supabase URL set"; ((PASS++))
else echo "  ❌ Supabase URL not set"; ((FAIL++)); fi
if [ -n "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "your-anthropic-api-key" ]; then
  echo "  ✅ Anthropic key set"; ((PASS++))
else echo "  ❌ Anthropic key not set"; ((FAIL++)); fi

# Test 4: Admin client exists and uses service role
echo ""
echo "Test 4: Admin client..."
if grep -q "SUPABASE_SERVICE_ROLE_KEY" src/lib/supabase/admin.ts 2>/dev/null; then
  echo "  ✅ Admin client uses service role key"; ((PASS++))
else echo "  ❌ Admin client missing or doesn't use service role key"; ((FAIL++)); fi

# Test 5: Dev server starts
echo ""
echo "Test 5: Dev server..."
npm run dev > /dev/null 2>&1 &
DEV_PID=$!
sleep 10
RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null)
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
if [ "$RESULT" = "200" ]; then echo "  ✅ Dev server responds"; ((PASS++)); else echo "  ❌ Dev server failed (HTTP $RESULT)"; ((FAIL++)); fi

echo ""
echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================="
if [ $FAIL -gt 0 ]; then echo "❌ PHASE 1 GATE: FAIL — fix issues before continuing"; exit 1;
else echo "✅ PHASE 1 GATE: PASS — commit and move to Phase 2"; fi
