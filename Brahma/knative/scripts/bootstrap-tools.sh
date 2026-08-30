#!/usr/bin/env bash
set -euo pipefail

echo "=== Knative Demo: Tool Bootstrap Check ==="
MISSING=0

echo "[1/3] Checking Docker Desktop..."
if ! docker info > /dev/null 2>&1; then
  echo "  MISSING: Docker is not running."
  echo "  -> Open Docker Desktop -> Settings -> Kubernetes -> Enable Kubernetes -> Apply & Restart"
  MISSING=1
else
  echo "  Docker OK"
fi

echo "[2/3] Checking Helm..."
if ! command -v helm > /dev/null 2>&1; then
  echo "  MISSING: helm is not on PATH."
  echo "  -> winget install Helm.Helm"
  MISSING=1
else
  echo "  Helm OK ($(helm version --short 2>/dev/null))"
fi

echo "[3/3] Checking Terraform..."
if ! command -v terraform > /dev/null 2>&1; then
  echo "  MISSING: terraform is not on PATH."
  echo "  -> winget install Hashicorp.Terraform"
  MISSING=1
else
  echo "  Terraform OK ($(terraform version -json 2>/dev/null | grep -o '"terraform_version":"[^"]*"' || terraform version | head -1))"
fi

echo ""
if [[ "$MISSING" -eq 1 ]]; then
  echo "One or more prerequisites are missing. Install/start them as noted above,"
  echo "then re-run this script before running deploy.sh."
  exit 1
fi

echo "All prerequisites present."
