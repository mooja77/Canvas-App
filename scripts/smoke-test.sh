#!/bin/bash
# QualCanvas post-deploy smoke test
# Usage: bash scripts/smoke-test.sh [URL]
# Verifies frontend serves correctly and API is reachable

set -e
URL="${1:-https://qualcanvas.com}"
BACKEND="https://canvas-app-production.up.railway.app"
PASS=0
FAIL=0

check() {
  local name="$1" result="$2"
  if [ "$result" = "ok" ]; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name ($result)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke testing $URL ..."
echo ""

# 1. Landing page loads
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
[ "$HTTP" = "200" ] && check "Landing page" "ok" || check "Landing page" "HTTP $HTTP"

# 2. Login page loads
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$URL/login")
[ "$HTTP" = "200" ] && check "Login page" "ok" || check "Login page" "HTTP $HTTP"

# 3. JS bundle contains Railway API URL
BUNDLE=$(curl -s "$URL" | grep -o 'assets/index-[^"]*\.js' | head -1)
if [ -z "$BUNDLE" ]; then
  check "JS bundle exists" "no bundle found in HTML"
else
  curl -s "$URL/$BUNDLE" | grep -q "canvas-app-production" \
    && check "API URL in bundle" "ok" \
    || check "API URL in bundle" "Railway URL missing from $BUNDLE"
fi

# 4. Backend health check
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/health")
[ "$HTTP" = "200" ] && check "Backend /health" "ok" || check "Backend /health" "HTTP $HTTP"

# 5. Backend ready check
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/ready")
[ "$HTTP" = "200" ] && check "Backend /ready" "ok" || check "Backend /ready" "HTTP $HTTP"

# 6. CORS headers present
CORS=$(curl -s -I -X OPTIONS "$BACKEND/api/auth" \
  -H "Origin: $URL" \
  -H "Access-Control-Request-Method: POST" 2>&1 | grep -i "access-control-allow-origin" | head -1)
[ -n "$CORS" ] && check "CORS headers" "ok" || check "CORS headers" "no ACAO header"

# 7. 404 page works (SPA fallback)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$URL/nonexistent-test-page")
[ "$HTTP" = "200" ] && check "SPA fallback (404)" "ok" || check "SPA fallback (404)" "HTTP $HTTP"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
