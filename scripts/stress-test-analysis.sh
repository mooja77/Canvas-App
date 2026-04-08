#!/bin/bash
# QualCanvas stress test — measure analysis performance on a large canvas
# Usage: ADMIN_KEY="..." JWT="..." CANVAS_ID="..." bash scripts/stress-test-analysis.sh
#
# Prerequisites: Create a canvas with substantial data first (50+ transcripts, 100+ codes, 1000+ codings)

set -euo pipefail

API="${API_URL:-https://canvas-app-production.up.railway.app/api}"
O="${ORIGIN:-https://qualcanvas.com}"

if [ -z "${JWT:-}" ]; then echo "Error: JWT env var required" >&2; exit 1; fi
if [ -z "${CANVAS_ID:-}" ]; then echo "Error: CANVAS_ID env var required" >&2; exit 1; fi

TYPES="stats wordcloud sentiment cooccurrence codingquery cluster matrix comparison treemap timeline geomap search"

echo "========================================="
echo "QualCanvas Analysis Stress Test"
echo "Canvas: $CANVAS_ID"
echo "Backend: $API"
echo "========================================="
echo ""
printf "%-20s %8s %10s %7s\n" "TYPE" "TIME(ms)" "SIZE(B)" "STATUS"
printf "%-20s %8s %10s %7s\n" "----" "-------" "------" "------"

PASS=0
WARN=0
FAIL=0

for TYPE in $TYPES; do
  # Create node
  NODE_ID=$(curl -s -X POST "$API/canvas/$CANVAS_ID/computed" \
    -H "Authorization: Bearer $JWT" -H "Origin: $O" -H "Content-Type: application/json" \
    -d "{\"nodeType\":\"$TYPE\",\"label\":\"Stress $TYPE\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)

  if [ -z "$NODE_ID" ]; then
    printf "%-20s %8s %10s %7s\n" "$TYPE" "-" "-" "SKIP"
    continue
  fi

  # Time the run
  START_MS=$(date +%s%N | cut -b1-13)
  RESULT=$(curl -s -w "\n%{size_download}" -X POST "$API/canvas/$CANVAS_ID/computed/$NODE_ID/run" \
    -H "Authorization: Bearer $JWT" -H "Origin: $O")
  END_MS=$(date +%s%N | cut -b1-13)

  ELAPSED=$((END_MS - START_MS))
  SIZE=$(echo "$RESULT" | tail -1)
  SUCCESS=$(echo "$RESULT" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',''))" 2>/dev/null || echo "")

  if [ "$SUCCESS" = "True" ]; then
    if [ "$ELAPSED" -gt 30000 ]; then
      STATUS="FAIL"
      FAIL=$((FAIL + 1))
    elif [ "$ELAPSED" -gt 10000 ]; then
      STATUS="WARN"
      WARN=$((WARN + 1))
    else
      STATUS="PASS"
      PASS=$((PASS + 1))
    fi
  else
    STATUS="ERROR"
    FAIL=$((FAIL + 1))
  fi

  printf "%-20s %8d %10s %7s\n" "$TYPE" "$ELAPSED" "$SIZE" "$STATUS"

  # Cleanup
  curl -s -X DELETE "$API/canvas/$CANVAS_ID/computed/$NODE_ID" \
    -H "Authorization: Bearer $JWT" -H "Origin: $O" > /dev/null 2>&1
done

echo ""
echo "========================================="
echo "Results: $PASS PASS, $WARN WARN (>10s), $FAIL FAIL (>30s or error)"
echo "========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
