#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASS="${GRAFANA_PASS:-localadmin123}"

echo "=== Phase 5: Grafana Dashboard Setup ==="

echo "[1/3] Deploying sample compliant app..."
kubectl apply -f "$ROOT_DIR/manifests/sample-app.yaml"
kubectl rollout status deployment/sample-api -n applications --timeout=60s
kubectl rollout status deployment/sample-frontend -n applications --timeout=60s

echo "[2/3] Checking Grafana connectivity at $GRAFANA_URL ..."
for i in $(seq 1 10); do
  if curl -sf -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    echo "  Grafana is reachable"
    break
  fi
  echo "  Waiting for Grafana ($i/10)..."
  sleep 5
done

echo "[3/3] Uploading dashboards via Grafana API..."

for dash_file in "$ROOT_DIR/grafana/dashboards/"*.json; do
  dash_title=$(python3 -c "import json,sys; d=json.load(open('$dash_file')); print(d.get('title','unknown'))" 2>/dev/null || basename "$dash_file")
  echo "  Uploading: $dash_title"

  payload=$(python3 -c "
import json, sys
with open('$dash_file') as f:
    dash = json.load(f)
print(json.dumps({'dashboard': dash, 'overwrite': True, 'folderId': 0}))
" 2>/dev/null)

  if [[ -n "$payload" ]]; then
    curl -sf \
      -H 'Content-Type: application/json' \
      -u "$GRAFANA_USER:$GRAFANA_PASS" \
      -X POST "$GRAFANA_URL/api/dashboards/db" \
      -d "$payload" | python3 -c "import json,sys; r=json.load(sys.stdin); print('  -> Status:', r.get('status','unknown'))" 2>/dev/null || \
      echo "  -> Dashboard upload attempted (check Grafana manually)"
  fi
done

echo ""
echo "=== Phase 5 Complete ==="
echo "  Grafana Dashboards: $GRAFANA_URL/dashboards"
