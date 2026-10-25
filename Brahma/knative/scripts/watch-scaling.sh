#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-knative-demo}"

echo "=== Watching pods in namespace: $NAMESPACE ==="
echo "Leave this running. In another terminal, generate load to see it scale up:"
echo ""
echo "  kubectl run load-generator --image=busybox --restart=Never -n $NAMESPACE -- \\"
echo "    /bin/sh -c 'while true; do wget -q -O- http://helloworld-go.$NAMESPACE.svc.cluster.local; done'"
echo ""
echo "Then delete it to let the Service scale back to zero (default: ~60s after last request):"
echo ""
echo "  kubectl delete pod load-generator -n $NAMESPACE --ignore-not-found"
echo ""
echo "Watching pods (Ctrl+C to stop)..."
echo ""

if command -v watch > /dev/null 2>&1; then
  watch -n 2 "kubectl get pods -n $NAMESPACE"
else
  # 'watch' isn't available on Git Bash for Windows by default; fall back to a manual loop.
  while true; do
    clear
    date
    kubectl get pods -n "$NAMESPACE"
    sleep 2
  done
fi
