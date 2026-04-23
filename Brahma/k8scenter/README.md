# KubeVision — Enterprise Kubernetes Management Platform

A full-featured, enterprise-grade Kubernetes UI built with Go + React + Ant Design. Manage every aspect of your Kubernetes clusters through a beautiful, dark-themed web interface.

## Features

### Workloads
- **Deployments** — list, scale, restart, YAML edit, delete
- **StatefulSets** — full CRUD
- **DaemonSets** — view and manage
- **ReplicaSets** — read
- **Pods** — list, view, delete; inline log streaming + interactive terminal
- **Jobs** — create, monitor, delete
- **CronJobs** — schedule management

### Networking
- **Services** — all types (ClusterIP, NodePort, LoadBalancer, ExternalName)
- **Ingresses** — TLS, rules, backend routing
- **NetworkPolicies** — view ingress/egress rules
- **IngressClasses** — list available classes

### Config & Storage
- **ConfigMaps** — create, view keys/data, edit, delete
- **Secrets** — list with masked values, reveal individual keys on demand
- **PersistentVolumes** — cluster-wide PV management
- **PersistentVolumeClaims** — namespace-scoped PVC management
- **StorageClasses** — provisioners, reclaim policies

### RBAC
- **ClusterRoles** — view rules, verbs, resources
- **Roles** — namespace-scoped role management
- **ClusterRoleBindings** — subjects, role references
- **RoleBindings** — namespace-scoped bindings
- **ServiceAccounts** — full management

### CRDs
- **CustomResourceDefinitions** — list all CRDs, view schema, check status
- **Custom Resource instances** — browse instances of any CRD dynamically

### Cluster
- **Nodes** — status, roles, capacity, OS info, runtime
- **Namespaces** — list and namespace switching
- **Events** — real-time event feed, filter by type/resource
- **Dashboard** — cluster-wide overview with pod/node stats

### Developer Features
- **Log Streaming** — real-time WebSocket log tailing per container
- **Interactive Terminal** — exec into pods via xterm.js
- **YAML Editor** — Monaco editor for editing/creating any resource
- **Generic Apply** — apply any YAML directly

## Authentication

KubeVision proxies all Kubernetes API calls using the credentials YOU provide — it never stores credentials permanently, and all RBAC policies from your cluster are respected.

| Method | Description |
|--------|-------------|
| **Bearer Token** | Service account or user token + API server URL |
| **Kubeconfig** | Paste your `~/.kube/config` content |
| **In-Cluster** | When KubeVision itself runs inside a pod |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                             │
│  React + TypeScript + Ant Design 5 + Monaco + xterm.js  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/WebSocket
                        ▼
┌─────────────────────────────────────────────────────────┐
│               Nginx (Port 3000)                         │
│         Static assets + /api proxy                      │
└───────────────────────┬─────────────────────────────────┘
                        │ Reverse proxy
                        ▼
┌─────────────────────────────────────────────────────────┐
│           Go Backend (Port 8080)                        │
│    Gin + client-go + JWT auth middleware               │
│    Handles REST + WebSocket (logs, exec)               │
└───────────────────────┬─────────────────────────────────┘
                        │ Kubernetes API
                        ▼
┌─────────────────────────────────────────────────────────┐
│         Kubernetes Cluster (kind / Docker Desktop)      │
│         All calls use user-provided credentials         │
└─────────────────────────────────────────────────────────┘
```

## Quick Start (Docker + kind)

### Prerequisites
- Docker Desktop with Kubernetes enabled OR [kind](https://kind.sigs.k8s.io/)
- Go 1.22+
- Node.js 20+

### 1. Create local cluster (optional)

```bash
# Install kind
# Windows: choco install kind
# macOS: brew install kind

kind create cluster --config kind-config.yaml
```

### 2. Get your token (for login)

```bash
# For Docker Desktop Kubernetes:
kubectl config view --raw --minify | grep token

# For kind — create a token:
kubectl create serviceaccount kubevision-admin -n default
kubectl create clusterrolebinding kubevision-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=default:kubevision-admin
kubectl create token kubevision-admin -n default
```

### 3. Build and start

```bash
cd KubeVision

# Download Go deps
cd backend && go mod tidy && cd ..

# Build & run with Docker Compose
docker compose build
docker compose up -d
```

### 4. Access the UI

Open **http://localhost:3000**

Log in with:
- **Server URL**: `https://127.0.0.1:6443` (kind) or `https://kubernetes.docker.internal:6443` (Docker Desktop)
- **Token**: from step 2

## Development Mode

```bash
# Hot-reload frontend + backend
docker compose -f docker-compose.dev.yml up
```

## Makefile Commands

```bash
make help          # Show all commands
make build         # Build Docker images
make up            # Start services
make down          # Stop services
make dev           # Dev mode with hot reload
make logs          # Tail all logs
make setup-kind    # Create kind cluster
make token         # Get a service account token
make deploy        # Deploy KubeVision to current cluster
make apply-rbac    # Apply RBAC for in-cluster deployment
```

## In-Cluster Deployment

```bash
# Apply RBAC first
kubectl apply -f k8s-manifests/rbac.yaml

# Build and push images
docker build -t your-registry/kubevision-backend:latest ./backend
docker build -t your-registry/kubevision-frontend:latest ./frontend
docker push your-registry/kubevision-backend:latest
docker push your-registry/kubevision-frontend:latest

# Update image references in deployment.yaml then:
kubectl apply -f k8s-manifests/deployment.yaml

# Add to /etc/hosts (or configure DNS):
# <ingress-ip> kubevision.local

# Access at http://kubevision.local
```

## Security

- JWT tokens expire after 24 hours
- Kubernetes credentials are stored in JWT claims (signed, not encrypted — use HTTPS in production)
- Secret values are masked by default; individual key reveal requires explicit user action
- All write operations are gated by your cluster's RBAC policies
- The backend service account has only read permissions by default

## Stack

| Component | Technology |
|-----------|-----------|
| Frontend  | React 18, TypeScript, Vite |
| UI Library | Ant Design 5 (dark theme) |
| Code Editor | Monaco Editor |
| Terminal | xterm.js |
| State | Zustand |
| HTTP | Axios |
| Backend | Go 1.22, Gin |
| K8s Client | client-go, dynamic client, apiextensions |
| Auth | JWT (HS256) |
| Realtime | WebSocket (gorilla/websocket) |
| Container | Docker + Docker Compose |
| Local K8s | kind |
