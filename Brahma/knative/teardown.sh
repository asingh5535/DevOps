#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Knative Demo Teardown ==="
echo "WARNING: This will remove Knative Serving, Kourier, the Knative Operator,"
echo "and the demo Service from your current kubectl context."
read -rp "Continue? (y/N): " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

echo "[1/3] Terraform destroy..."
terraform -chdir="$SCRIPT_DIR/terraform" destroy -auto-approve

echo "[2/3] Cleaning up namespaces (in case of state drift)..."
kubectl delete namespace knative-serving knative-operator --ignore-not-found

echo "[3/3] Removing demo namespace..."
kubectl delete namespace knative-demo --ignore-not-found

echo ""
echo "=== Teardown Complete ==="
