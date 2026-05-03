#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   FinOps Local K8s — Full Deploy             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

PHASES="${1:-all}"

run_phase() {
  local script="$1"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bash "$SCRIPT_DIR/scripts/$script"
}

case "$PHASES" in
  1) run_phase "01-setup-cluster.sh" ;;
  2) run_phase "02-deploy-monitoring.sh" ;;
  3) run_phase "03-deploy-kubecost.sh" ;;
  4) run_phase "04-deploy-policy.sh" ;;
  5) run_phase "05-setup-dashboards.sh" ;;
  6) run_phase "06-validate.sh" ;;
  all)
    run_phase "01-setup-cluster.sh"
    run_phase "02-deploy-monitoring.sh"
    run_phase "03-deploy-kubecost.sh"
    run_phase "04-deploy-policy.sh"
    run_phase "05-setup-dashboards.sh"
    run_phase "06-validate.sh"
    ;;
  *)
    echo "Usage: $0 [1|2|3|4|5|6|all]"
    echo "  1 = Cluster setup & namespaces"
    echo "  2 = Prometheus + Grafana"
    echo "  3 = Kubecost"
    echo "  4 = OPA Gatekeeper (label policy)"
    echo "  5 = Sample apps + Grafana dashboards"
    echo "  6 = Validation & audit"
    echo "  all = Run all phases (default)"
    exit 1
    ;;
esac

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Deployment Complete!                        ║"
echo "║                                               ║"
echo "║   Run port-forwards:                          ║"
echo "║     bash scripts/port-forward.sh              ║"
echo "║                                               ║"
echo "║   FinOps UI   -> http://localhost:5173         ║"
echo "║   Grafana     -> http://localhost:3000         ║"
echo "║   Kubecost    -> http://localhost:9090         ║"
echo "╚══════════════════════════════════════════════╝"
