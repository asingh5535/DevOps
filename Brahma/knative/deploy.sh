#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   Knative Serving on Docker Desktop           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

if [[ "${1:-}" != "-y" ]]; then
  echo "This installs cluster-wide CRDs (Knative Operator + Serving) onto your"
  echo "current kubectl context. Run 'terraform -chdir=terraform plan' yourself"
  echo "first if you want to review changes before applying."
  echo ""
  echo "Usage: $0 -y   (confirms you want to apply)"
  exit 1
fi

echo "[1/5] Checking Docker..."
docker info > /dev/null 2>&1 || { echo "ERROR: Docker is not running."; exit 1; }
echo "  Docker OK"

echo "[2/5] Checking kubectl context..."
CURRENT_CTX=$(kubectl config current-context 2>/dev/null || echo "none")
echo "  Current context: $CURRENT_CTX"

if [[ "$CURRENT_CTX" != "docker-desktop" && "$CURRENT_CTX" != "minikube" && "$CURRENT_CTX" != *"kind"* ]]; then
  echo "  WARNING: Unexpected context '$CURRENT_CTX'. Listing available contexts:"
  kubectl config get-contexts
  read -rp "  Proceed anyway? (y/N): " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

echo "[3/5] Terraform init..."
terraform -chdir="$SCRIPT_DIR/terraform" init -input=false

echo "[4/5] Terraform apply..."
terraform -chdir="$SCRIPT_DIR/terraform" apply -auto-approve

echo "[5/5] Waiting for the demo Knative Service to become ready..."
DEMO_NS=$(terraform -chdir="$SCRIPT_DIR/terraform" output -raw demo_namespace 2>/dev/null || echo "knative-demo")
DEMO_SVC=$(terraform -chdir="$SCRIPT_DIR/terraform" output -raw demo_service_name 2>/dev/null || echo "helloworld-go")
kubectl wait --for=condition=Ready "ksvc/$DEMO_SVC" -n "$DEMO_NS" --timeout=180s

DEMO_URL=$(kubectl get ksvc "$DEMO_SVC" -n "$DEMO_NS" -o jsonpath='{.status.url}' 2>/dev/null || echo "")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Deployment Complete!                        ║"
echo "║                                                ║"
echo "║   Demo Service URL: ${DEMO_URL}"
echo "║   (Docker Desktop auto-binds Kourier's        ║"
echo "║    LoadBalancer Service to localhost:80)      ║"
echo "║                                                ║"
echo "║   Watch it scale:                             ║"
echo "║     bash scripts/watch-scaling.sh $DEMO_NS"
echo "╚══════════════════════════════════════════════╝"
