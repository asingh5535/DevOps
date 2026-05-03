#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Phase 3: Deploy Kubecost ==="

echo "[1/3] Adding kubecost Helm repo..."
helm repo add kubecost https://kubecost.github.io/cost-analyzer/ 2>/dev/null || true
helm repo update

echo "[2/3] Installing kubecost/cost-analyzer..."
if helm status kubecost -n kubecost > /dev/null 2>&1; then
  echo "  Upgrading existing kubecost..."
  helm upgrade kubecost kubecost/cost-analyzer \
    --namespace kubecost \
    -f "$ROOT_DIR/helm/kubecost-values.yaml" \
    --wait --timeout=10m
else
  helm install kubecost kubecost/cost-analyzer \
    --namespace kubecost \
    --create-namespace \
    -f "$ROOT_DIR/helm/kubecost-values.yaml" \
    --wait --timeout=10m
fi

echo "[3/3] Verifying deployment..."
kubectl get pods -n kubecost
kubectl get events -n kubecost --sort-by='.lastTimestamp' | tail -10

echo ""
echo "=== Phase 3 Complete ==="
echo "  Kubecost UI: kubectl port-forward svc/kubecost-cost-analyzer 9090:9090 -n kubecost"
echo "  Open:        http://localhost:9090"
