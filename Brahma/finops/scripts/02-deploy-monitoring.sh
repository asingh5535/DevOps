#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Phase 2: Deploy Prometheus + Grafana ==="

echo "[1/3] Adding Helm repos..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo update

echo "[2/3] Installing kube-prometheus-stack..."
if helm status prometheus-stack -n monitoring > /dev/null 2>&1; then
  echo "  Upgrading existing prometheus-stack..."
  helm upgrade prometheus-stack prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    -f "$ROOT_DIR/helm/prometheus-values.yaml" \
    --wait --timeout=10m
else
  helm install prometheus-stack prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --create-namespace \
    -f "$ROOT_DIR/helm/prometheus-values.yaml" \
    --wait --timeout=10m
fi

echo "[3/3] Verifying deployment..."
kubectl get pods -n monitoring
kubectl get events -n monitoring --sort-by='.lastTimestamp' | tail -10

echo ""
echo "=== Phase 2 Complete ==="
echo "  Grafana: kubectl port-forward svc/prometheus-stack-grafana 3000:80 -n monitoring"
echo "  Login:   admin / localadmin123"
