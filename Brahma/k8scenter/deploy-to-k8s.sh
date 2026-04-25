#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     KubeVision / k8scenter — Deploy to Kubernetes   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────
echo "► Checking prerequisites..."
command -v docker  >/dev/null || { echo "ERROR: docker not found"; exit 1; }
command -v kubectl >/dev/null || { echo "ERROR: kubectl not found"; exit 1; }

kubectl cluster-info >/dev/null 2>&1 || {
  echo ""
  echo "ERROR: Cannot reach Kubernetes cluster."
  echo "  → Open Docker Desktop → Settings → Kubernetes → Enable Kubernetes → Apply & Restart"
  echo "  → Wait ~2 minutes, then re-run this script"
  exit 1
}

echo "  ✓ Docker running"
echo "  ✓ Kubernetes cluster reachable: $(kubectl config current-context)"
echo ""

# ── 2. Build Docker images ─────────────────────────────────────────────────────
echo "► Building backend image (kubevision-backend:latest)..."
docker build -t kubevision-backend:latest ./backend
echo "  ✓ Backend image built"
echo ""

echo "► Building frontend image (kubevision-frontend:latest)..."
docker build -t kubevision-frontend:latest ./frontend
echo "  ✓ Frontend image built"
echo ""

# ── 3. Load images into Docker Desktop cluster if needed ─────────────────────
# Docker Desktop shares the host Docker daemon, so images are already available.
# If using kind, uncomment the lines below:
# kind load docker-image kubevision-backend:latest --name <your-cluster-name>
# kind load docker-image kubevision-frontend:latest --name <your-cluster-name>

# ── 4. Deploy to Kubernetes ───────────────────────────────────────────────────
echo "► Deploying to Kubernetes..."
kubectl apply -f k8s-manifests/full-deploy.yaml
echo "  ✓ Manifests applied"
echo ""

# ── 5. Wait for pods to be ready ─────────────────────────────────────────────
echo "► Waiting for pods to become ready..."
kubectl rollout status deployment/k8scenter-backend  -n k8scenter --timeout=120s
kubectl rollout status deployment/k8scenter-frontend -n k8scenter --timeout=120s
echo ""

# ── 6. Get a login token ─────────────────────────────────────────────────────
echo "► Generating login token for k8scenter..."
TOKEN=$(kubectl create token k8scenter-backend -n k8scenter --duration=24h 2>/dev/null || \
        kubectl -n k8scenter get secret \
          $(kubectl -n k8scenter get sa/k8scenter-backend -o jsonpath='{.secrets[0].name}' 2>/dev/null) \
          -o jsonpath='{.data.token}' 2>/dev/null | base64 -d 2>/dev/null || \
        kubectl create token default -n default --duration=24h 2>/dev/null)

# ── 7. Get API server URL ─────────────────────────────────────────────────────
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# ── 8. Print connection info ──────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  k8scenter is LIVE!                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  Open your browser:  http://localhost:30080                  ║"
echo "║                                                              ║"
echo "║  Login with:                                                 ║"
echo "║    Auth Type  : Bearer Token                                 ║"
echo "║    Server URL : $API_SERVER"
echo "║                                                              ║"
echo "║  Token (copy this):                                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "$TOKEN"
echo ""
echo "  Pods status:"
kubectl get pods -n k8scenter
echo ""
