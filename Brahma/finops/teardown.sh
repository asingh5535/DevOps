#!/usr/bin/env bash
set -euo pipefail

echo "=== FinOps Teardown ==="
echo "WARNING: This will remove all FinOps components from the cluster."
read -rp "Continue? (y/N): " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

echo "[1/5] Removing sample apps..."
kubectl delete -f manifests/sample-app.yaml --ignore-not-found

echo "[2/5] Removing policy resources..."
kubectl delete -f manifests/label-constraint.yaml --ignore-not-found
kubectl delete -f manifests/constraint-template.yaml --ignore-not-found
kubectl delete -f manifests/namespace-quota.yaml --ignore-not-found
helm uninstall gatekeeper -n policy 2>/dev/null || true

echo "[3/5] Removing kubecost..."
helm uninstall kubecost -n kubecost 2>/dev/null || true

echo "[4/5] Removing prometheus-stack..."
helm uninstall prometheus-stack -n monitoring 2>/dev/null || true

echo "[5/5] Removing namespaces..."
kubectl delete namespace kubecost monitoring policy applications finops --ignore-not-found

echo ""
echo "=== Teardown Complete ==="
