#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Phase 4: Label Enforcement (OPA Gatekeeper) ==="

echo "[1/4] Adding gatekeeper Helm repo..."
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts 2>/dev/null || true
helm repo update

echo "[2/4] Installing OPA Gatekeeper..."
if helm status gatekeeper -n policy > /dev/null 2>&1; then
  helm upgrade gatekeeper gatekeeper/gatekeeper \
    --namespace policy \
    --set resources.requests.cpu=100m \
    --set resources.requests.memory=256Mi \
    --wait --timeout=5m
else
  helm install gatekeeper gatekeeper/gatekeeper \
    --namespace policy \
    --create-namespace \
    --set resources.requests.cpu=100m \
    --set resources.requests.memory=256Mi \
    --wait --timeout=5m
fi

echo "[3/4] Waiting for Gatekeeper webhooks to be ready..."
kubectl wait --for=condition=Ready pod -l app=gatekeeper -n policy --timeout=120s

echo "[4/4] Applying constraint template and constraints..."
kubectl apply -f "$ROOT_DIR/manifests/constraint-template.yaml"
echo "  Waiting 10s for CRD to register..."
sleep 10
kubectl apply -f "$ROOT_DIR/manifests/label-constraint.yaml"
kubectl apply -f "$ROOT_DIR/manifests/namespace-quota.yaml"

echo ""
echo "=== Phase 4 Complete ==="
kubectl get constraints -A 2>/dev/null || echo "  (No constraints yet — CRD may need a moment to propagate)"
kubectl get pods -n policy
