#!/usr/bin/env bash
set -euo pipefail

echo "=== Phase 6: Validation & Audit ==="

echo ""
echo "--- Cluster Nodes ---"
kubectl get nodes -o wide

echo ""
echo "--- Namespace Overview ---"
kubectl get namespaces --show-labels

echo ""
echo "--- Monitoring Stack ---"
kubectl get pods -n monitoring --show-labels
echo "Events:"
kubectl get events -n monitoring --sort-by='.lastTimestamp' | tail -5

echo ""
echo "--- Kubecost ---"
kubectl get pods -n kubecost
echo "Events:"
kubectl get events -n kubecost --sort-by='.lastTimestamp' | tail -5

echo ""
echo "--- Policy (Gatekeeper) ---"
kubectl get pods -n policy
kubectl get constraints -A 2>/dev/null || echo "  No constraints found (Gatekeeper may still be starting)"

echo ""
echo "--- Applications ---"
kubectl get deployments -n applications --show-labels
kubectl get pods -n applications

echo ""
echo "--- Resource Quotas ---"
kubectl describe resourcequota -n applications 2>/dev/null || echo "  No quota in applications namespace"

echo ""
echo "--- Label Compliance Audit ---"
echo "Deployments missing 'team' label:"
kubectl get deployments -A -o json | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
missing = [(d['metadata']['namespace'], d['metadata']['name'])
           for d in data['items']
           if 'team' not in d['metadata'].get('labels', {})]
if missing:
    for ns, name in missing:
        print(f'  MISSING: {ns}/{name}')
else:
    print('  All deployments have team label')
" 2>/dev/null || echo "  (python3 not available — skipping JSON audit)"

echo ""
echo "Deployments missing 'cost-center' label:"
kubectl get deployments -A -o json | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
missing = [(d['metadata']['namespace'], d['metadata']['name'])
           for d in data['items']
           if 'cost-center' not in d['metadata'].get('labels', {})]
if missing:
    for ns, name in missing:
        print(f'  MISSING: {ns}/{name}')
else:
    print('  All deployments have cost-center label')
" 2>/dev/null || echo "  (python3 not available — skipping JSON audit)"

echo ""
echo "=== Validation Complete ==="
