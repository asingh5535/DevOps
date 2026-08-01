# FinOps — Local Kubernetes Cost & Tagging Platform

A full-stack FinOps management application for local Kubernetes clusters (Docker Desktop / Kind / Minikube).

## Architecture

```
Brahma/finops/
├── backend/          Go API — reads K8s API, calculates costs, checks compliance
├── frontend/         React + Ant Design UI — dashboards, charts, tables
├── helm/             Prometheus stack & Kubecost Helm values
├── manifests/        Namespaces, OPA policies, quotas, sample apps, FinOps UI
├── grafana/          Grafana dashboard JSONs + provisioning config
├── scripts/          Phase scripts (01–06)
├── deploy.sh         Run all 6 phases
└── teardown.sh       Full cleanup
```

## Prerequisites

| Tool | Version |
|------|---------|
| Docker Desktop (K8s enabled) or Kind | latest |
| kubectl | ≥ 1.28 |
| Helm | ≥ 3.14 |
| Go | ≥ 1.22 |
| Node.js | ≥ 20 |

## Quick Start

### Option A — Docker Compose (UI only, no cluster deploy)

```bash
# Start the Go backend + React frontend
docker compose up --build

# Open http://localhost:5173
```

> The backend reads your local `~/.kube/config` automatically.

### Option B — Full K8s Deploy (all 6 phases)

```bash
# Verify cluster context first
kubectl config get-contexts
kubectl config use-context docker-desktop

# Deploy everything
chmod +x deploy.sh scripts/*.sh
bash deploy.sh

# Start port-forwards
bash scripts/port-forward.sh
```

Run individual phases:
```bash
bash deploy.sh 1   # Namespaces + labels
bash deploy.sh 2   # Prometheus + Grafana
bash deploy.sh 3   # Kubecost
bash deploy.sh 4   # OPA Gatekeeper policies
bash deploy.sh 5   # Sample apps + Grafana dashboards
bash deploy.sh 6   # Validation audit
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| FinOps UI | http://localhost:5173 | — |
| FinOps API | http://localhost:8080 | — |
| Grafana | http://localhost:3000 | admin / localadmin123 |
| Kubecost | http://localhost:9090 | — |
| Prometheus | http://localhost:9091 | — |

## FinOps UI Pages

| Page | Description |
|------|-------------|
| **Overview** | KPI cards, monthly cost by team, pie by cost-center, non-compliant deployments |
| **Cost Analysis** | Breakdown by team / namespace / cost-center with bar charts and table |
| **Label Compliance** | Deployment compliance table, gauge, missing label report |
| **Resources** | All pods with CPU/memory requests/limits, resource quotas |
| **Namespaces** | Namespace label inventory, compliance status |

## Cost Model (Simulated)

| Resource | Rate | Monthly (730h) |
|----------|------|----------------|
| CPU | $0.048/vCPU-hour | $35.04/vCPU |
| Memory | $0.006/GB-hour | $4.38/GB |

## Required Labels

All Deployments, StatefulSets, and DaemonSets in the `applications` namespace must have:

```
app: <service-name>
team: <team-name>
env: local | staging | prod
cost-center: <cost-center-id>
```

Missing labels are flagged by OPA Gatekeeper (warn mode) and shown in the FinOps UI.

## Grafana Dashboards

Two auto-provisioned dashboards under the **FinOps** folder:

1. **Local K8s Resource Usage** — CPU/memory time series, cost by team, quota utilisation
2. **Label Compliance — Local** — compliance gauge, missing label tables, trend over time

## API Reference

```
GET /api/namespaces          All namespaces with label compliance
GET /api/pods?namespace=X    Pod inventory with resource info
GET /api/costs               Cost summary (by team, namespace, cost-center)
GET /api/compliance          Deployment label compliance report
GET /api/quotas?namespace=X  ResourceQuota status
GET /api/health              Health check
```

## Teardown

```bash
bash teardown.sh
```

## Execution Rules

1. Always verify `kubectl config current-context` before deploying
2. Use `--dry-run=client` to preview resource changes
3. Never apply Gatekeeper constraints to `kube-system`
4. All workloads must have CPU/memory limits set
5. Use port-forward for UI access — no NodePort exposure
6. Label every resource at creation time
7. Wait for Gatekeeper `Ready` before applying constraints
8. Check `kubectl get events -n <namespace>` after each deploy
