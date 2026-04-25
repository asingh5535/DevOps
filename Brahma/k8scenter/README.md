# KubeVision — Enterprise Kubernetes Management Platform

A full-featured, enterprise-grade Kubernetes UI built with **Go + React + Ant Design**. Manage every aspect of your Kubernetes clusters through a beautiful dark-themed web interface — workloads, networking, storage, RBAC, CRDs, logs, and interactive terminals all in one place.

---

## Screenshots

> Login → Dashboard → Pods → Logs → Terminal → YAML Editor

---

## Features

### Workloads
- **Deployments** — list, scale, restart, YAML edit, delete
- **StatefulSets** — full CRUD
- **DaemonSets** — view and manage
- **Pods** — list, view, delete; real-time log streaming + interactive terminal
- **Jobs / CronJobs** — create, monitor, delete

### Networking
- **Services** — ClusterIP, NodePort, LoadBalancer, ExternalName
- **Ingresses** — TLS, rules, backend routing
- **NetworkPolicies** — ingress/egress rules
- **IngressClasses** — list available classes

### Config & Storage
- **ConfigMaps** — create, view, edit, delete
- **Secrets** — masked values with per-key reveal on demand
- **PersistentVolumes / PersistentVolumeClaims** — full management
- **StorageClasses** — provisioners, reclaim policies

### RBAC
- **ClusterRoles / Roles** — view rules, verbs, resources
- **ClusterRoleBindings / RoleBindings** — subjects, role references
- **ServiceAccounts** — full management

### CRDs
- **CustomResourceDefinitions** — list all CRDs, view schema, check status
- **Custom Resource instances** — browse instances of any CRD dynamically

### Cluster
- **Nodes** — status, roles, capacity, OS info, container runtime
- **Namespaces** — list and namespace switching
- **Events** — real-time event feed, filter by type/resource
- **Dashboard** — cluster-wide overview with pod/node stats

### Developer Features
- **Log Streaming** — real-time WebSocket log tailing per container
- **Interactive Terminal** — exec into pods via xterm.js
- **YAML Editor** — Monaco editor for editing/creating any resource
- **Generic Apply** — apply any YAML directly from the UI

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
│   React 18 + TypeScript + Ant Design 5 + Monaco + xterm  │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP / WebSocket (:8090)
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  Nginx (Port 80 in pod)                  │
│            Static assets  +  /api proxy                  │
└──────────────────────────┬───────────────────────────────┘
                           │ Reverse proxy to backend:8080
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Go Backend (Port 8080 in pod)               │
│       Gin + client-go + JWT auth middleware              │
│       REST endpoints + WebSocket (logs, exec)            │
└──────────────────────────┬───────────────────────────────┘
                           │ Kubernetes API
                           ▼
┌──────────────────────────────────────────────────────────┐
│          Kubernetes Cluster (Docker Desktop kind)        │
│          All calls use user-provided credentials         │
└──────────────────────────────────────────────────────────┘
```

---

## Authentication

KubeVision proxies all Kubernetes API calls using the credentials you provide — it never stores credentials permanently, and all cluster RBAC policies are respected.

| Method | Description |
|--------|-------------|
| **Bearer Token** | Service account or user token + API server URL |
| **Kubeconfig** | Paste your `~/.kube/config` (base64-encoded) |
| **In-Cluster** | When KubeVision itself runs inside a pod |

---

## Running on Docker Desktop Kubernetes (Windows)

Docker Desktop's Kubernetes uses `kindest/node` containers internally. Images built with `docker build` are **not** automatically available to these nodes — they must be loaded explicitly.

### Prerequisites

- Docker Desktop with Kubernetes enabled (Settings → Kubernetes → Enable)
- `kubectl` in PATH

### Step 1 — Deploy (first time or after image changes)

Double-click **`deploy-to-k8s.bat`** or run from a terminal:

```bat
cd Brahma\k8scenter
deploy-to-k8s.bat
```

This script will:
1. Build `kubevision-backend:latest` and `kubevision-frontend:latest`
2. Load both images into every `kindest/node` container (`desktop-control-plane`, `desktop-worker`) using `docker save | docker exec | ctr import`
3. Delete any previous broken namespace
4. Apply `k8s-manifests/full-deploy.yaml`
5. Wait for pods to be ready

### Step 2 — Start port-forwards (every time you want to access the UI)

```bat
start-portforward.bat
```

This exposes:
- `http://localhost:8090` → frontend
- `http://localhost:8091` → backend API (for debugging)

### Step 3 — Get a login token

```bat
kubectl create token k8scenter-backend -n k8scenter --duration=24h
```

### Step 4 — Open the UI

Navigate to **http://localhost:8090** and log in:

| Field | Value |
|-------|-------|
| Auth Type | `Bearer Token` |
| Server URL | `https://kubernetes.default.svc` |
| Token | *(output from Step 3)* |

> **Important:** Use `https://kubernetes.default.svc` as the Server URL — NOT `https://127.0.0.1:xxxx`.
> The backend runs inside the cluster and must reach the API server via the in-cluster DNS name.

---

## Running with Docker Compose (local dev)

```bash
# Build and start
docker compose build
docker compose up -d

# Access at http://localhost:3000
# Use https://host.docker.internal:6443 as Server URL
```

For hot-reload development:

```bash
docker compose -f docker-compose.dev.yml up
```

---

## Running with kind (alternative to Docker Desktop Kubernetes)

```bash
# Create cluster
kind create cluster --config kind-config.yaml

# Load images into kind nodes
kind load docker-image kubevision-backend:latest
kind load docker-image kubevision-frontend:latest

# Deploy
kubectl apply -f k8s-manifests/full-deploy.yaml

# Port-forward
kubectl port-forward svc/frontend 8090:80 -n k8scenter &

# Get token
kubectl create token k8scenter-backend -n k8scenter --duration=24h
```

---

## Makefile Commands

```bash
make help          # Show all commands
make build         # Build Docker images
make up            # Start with Docker Compose
make down          # Stop services
make dev           # Dev mode with hot reload
make logs          # Tail all logs
make deploy        # Deploy to current Kubernetes cluster
make token         # Get a service account token
```

---

## File Structure

```
k8scenter/
├── backend/                    # Go API server
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── api/
│   │   │   ├── handlers/       # auth, workloads, services, crds, rbac, logs, exec
│   │   │   └── router.go
│   │   ├── k8s/client.go       # Kubernetes client factory
│   │   └── middleware/auth.go  # JWT middleware
│   ├── Dockerfile
│   └── go.mod
├── frontend/                   # React + TypeScript UI
│   ├── src/
│   │   ├── pages/              # Dashboard, Pods, Deployments, Services, etc.
│   │   ├── components/         # Shared components
│   │   ├── store/              # Zustand state
│   │   └── api/                # Axios API client
│   ├── Dockerfile
│   └── package.json
├── k8s-manifests/
│   └── full-deploy.yaml        # Namespace, RBAC, Deployments, Services
├── deploy-to-k8s.bat           # Windows: build + load into kind + deploy
├── deploy-to-k8s.sh            # Bash: same for git-bash / WSL / Linux / macOS
├── start-portforward.bat       # Windows: expose localhost:8090 and :8091
├── docker-compose.yml          # Local dev via Docker Compose
├── docker-compose.dev.yml      # Hot-reload dev mode
├── kind-config.yaml            # kind cluster config (2-node)
└── Makefile
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI Library | Ant Design 5 (dark theme) |
| Code Editor | Monaco Editor |
| Terminal | xterm.js |
| State | Zustand |
| HTTP Client | Axios |
| Backend | Go 1.22, Gin |
| Kubernetes Client | client-go, dynamic client, apiextensions-apiserver |
| Auth | JWT (HS256, 24h expiry) |
| Realtime | WebSocket (gorilla/websocket) — logs + exec |
| Container | Docker + Docker Compose |
| Local Kubernetes | Docker Desktop (kind-based) |

---

## Security Notes

- JWT tokens expire after 24 hours
- Kubernetes credentials are stored inside JWT claims (signed, not encrypted — use HTTPS in production)
- Secret values are masked by default; individual key reveal requires an explicit user action
- All write operations are gated by your cluster's RBAC policies
- The `k8scenter-backend` service account has `ClusterRole` with full access — scope this down for production use
