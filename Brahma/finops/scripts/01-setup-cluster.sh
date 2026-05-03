#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Phase 1: Local Cluster Setup ==="

echo "[1/4] Checking Docker..."
docker info > /dev/null 2>&1 || { echo "ERROR: Docker is not running."; exit 1; }
echo "  Docker OK"

echo "[2/4] Checking kubectl context..."
CURRENT_CTX=$(kubectl config current-context 2>/dev/null || echo "none")
echo "  Current context: $CURRENT_CTX"

if [[ "$CURRENT_CTX" != "docker-desktop" && "$CURRENT_CTX" != "minikube" && "$CURRENT_CTX" != *"kind"* ]]; then
  echo "  WARNING: Unexpected context '$CURRENT_CTX'. Listing available contexts:"
  kubectl config get-contexts
  read -rp "  Proceed anyway? (y/N): " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

echo "[3/4] Verifying cluster health..."
kubectl get nodes
kubectl cluster-info

echo "[4/4] Creating namespaces and labels..."
kubectl apply -f "$ROOT_DIR/manifests/namespaces.yaml"

kubectl label namespace applications \
  env=local team=platform cost-center=dev001 managed-by=manual \
  --overwrite

kubectl label namespace monitoring \
  env=local team=sre cost-center=infra001 managed-by=helm \
  --overwrite

kubectl label namespace kubecost \
  env=local team=platform cost-center=infra001 managed-by=helm \
  --overwrite

kubectl label namespace policy \
  env=local team=platform cost-center=infra001 managed-by=helm \
  --overwrite

echo ""
echo "=== Phase 1 Complete ==="
kubectl get namespaces --show-labels
