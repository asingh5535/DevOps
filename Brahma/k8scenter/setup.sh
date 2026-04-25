#!/usr/bin/env bash
set -e

echo "═══════════════════════════════════════════════════════"
echo "   KubeVision — Enterprise Kubernetes Management UI"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Prerequisites check ────────────────────────────────────────────────────────
check_cmd() {
  command -v "$1" &>/dev/null || { echo "ERROR: '$1' not found. Please install it first."; exit 1; }
}

check_cmd docker
check_cmd docker compose 2>/dev/null || check_cmd "docker-compose"
echo "✓ Docker found"

# ── Option: Create kind cluster ─────────────────────────────────────────────
if command -v kind &>/dev/null; then
  read -rp "Create a local kind cluster? [y/N] " CREATE_KIND
  if [[ "$CREATE_KIND" =~ ^[Yy]$ ]]; then
    echo "→ Creating kind cluster 'kubevision-dev'..."
    kind create cluster --config kind-config.yaml
    echo "✓ Kind cluster created"

    # Load kubeconfig
    kind get kubeconfig --name kubevision-dev > /tmp/kubevision-kubeconfig.yaml
    export KUBECONFIG=/tmp/kubevision-kubeconfig.yaml
    echo "✓ KUBECONFIG exported: $KUBECONFIG"

    echo "→ Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=120s
    echo "✓ Cluster ready"
  fi
fi

# ── Build backend Go dependencies ─────────────────────────────────────────────
echo ""
echo "→ Downloading Go dependencies..."
(cd backend && go mod tidy && go mod download)
echo "✓ Go dependencies ready"

# ── Build Docker images ────────────────────────────────────────────────────────
echo ""
echo "→ Building Docker images..."
docker compose build
echo "✓ Images built"

# ── Start services ─────────────────────────────────────────────────────────────
echo ""
echo "→ Starting KubeVision..."
docker compose up -d
echo "✓ KubeVision started"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  KubeVision is running!"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8080"
echo ""
echo "  Login options:"
echo "    • Bearer Token: use your k8s service account token"
echo "    • Kubeconfig:   paste ~/.kube/config content"
echo "    • In-Cluster:   when running inside k8s"
echo ""
echo "  To get a token from kind cluster:"
echo "    kubectl create token default -n default"
echo ""
echo "  API Server URL for kind: https://127.0.0.1:6443"
echo "═══════════════════════════════════════════════════════"
