#!/usr/bin/env bash
# Build FaceFusion, load it into Docker Desktop's kind nodes and deploy to Kubernetes.
# Run from Git Bash / WSL - the docker save | ctr import pipe silently fails under Windows CMD.
set -euo pipefail

IMAGE="facefusion:3.9.1"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Checking cluster"
kubectl cluster-info >/dev/null

echo "==> Building $IMAGE (first build takes several minutes)"
docker build -t "$IMAGE" "$DIR"

echo "==> Loading image into kind nodes"
for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'); do
  echo "    -> $node"
  docker save "$IMAGE" | docker exec -i "$node" ctr -n k8s.io images import -
done

echo "==> Applying manifests"
kubectl apply -f "$DIR/k8s/deepfake.yaml"

echo "==> Waiting for rollout (first start downloads models, can take 10+ minutes)"
kubectl -n llm rollout status deploy/facefusion --timeout=25m

echo
echo "Done. Open the UI with:"
echo "  kubectl -n llm port-forward svc/facefusion 7860:7860"
echo "  then browse to http://localhost:7860"
