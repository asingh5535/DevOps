#!/usr/bin/env bash
set -euo pipefail

echo "=== FinOps Port-Forward Helper ==="
echo "Starting all port-forwards in background..."

# Grafana
kubectl port-forward svc/prometheus-stack-grafana 3000:80 -n monitoring &
PF_GRAFANA=$!
echo "  Grafana     -> http://localhost:3000  (admin/localadmin123)"

# Kubecost
kubectl port-forward svc/kubecost-cost-analyzer 9090:9090 -n kubecost &
PF_KUBECOST=$!
echo "  Kubecost    -> http://localhost:9090"

# Prometheus
kubectl port-forward svc/prometheus-stack-kube-prom-prometheus 9091:9090 -n monitoring &
PF_PROM=$!
echo "  Prometheus  -> http://localhost:9091"

# FinOps UI backend
kubectl port-forward svc/finops-backend 8080:8080 -n finops &
PF_BACKEND=$!
echo "  FinOps API  -> http://localhost:8080"

# FinOps UI frontend
kubectl port-forward svc/finops-frontend 5173:80 -n finops &
PF_FRONTEND=$!
echo "  FinOps UI   -> http://localhost:5173"

echo ""
echo "Press Ctrl+C to stop all port-forwards"

cleanup() {
  echo ""
  echo "Stopping port-forwards..."
  kill $PF_GRAFANA $PF_KUBECOST $PF_PROM $PF_BACKEND $PF_FRONTEND 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

wait
