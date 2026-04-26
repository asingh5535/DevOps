# Torres ClickHouse Query Analyser

> Enterprise tool for identifying and fixing slow queries across K8s and standalone ClickHouse clusters.

---

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Cluster inventory with health status, 24h query stats |
| **Slow Queries** | Pull queries from `system.query_log` with configurable thresholds |
| **Full Scans** | Detect queries reading >100M rows (no index usage) |
| **Memory Hogs** | Identify queries consuming >1 GB memory |
| **Query Explain** | Run `EXPLAIN`, `EXPLAIN indexes=1`, `EXPLAIN PIPELINE` side by side |
| **Optimization Guide** | 7 bottleneck patterns with bad/good SQL examples + interactive checklist |
| **Reports** | Daily digest across all clusters, automated schedule reference |
| **Cluster Manager** | Add/remove/health-check clusters dynamically |

---

## Cluster Inventory

| Cluster | Type | Description |
|---------|------|-------------|
| `k8s-prod` | Kubernetes | k8scenter managed — Production |
| `k8s-analytics` | Kubernetes | k8scenter managed — Analytics |
| `k8s-staging` | Kubernetes | k8scenter managed — Degraded |
| `standalone-01` | Bare metal/VM | Direct host |
| `standalone-02` | Bare metal/VM | Direct host |

---

## Quick Start (Docker Compose)

```bash
cd Brahma/clickhouse-query-analyser
docker compose build
docker compose up -d
```

Open **http://localhost:3000**

---

## Development Mode

```bash
# Backend (Go)
cd backend
go mod tidy
go run ./cmd/server

# Frontend (React)
cd frontend
npm install --legacy-peer-deps
npm run dev   # http://localhost:3000 with proxy to :8080
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/api/clusters` | List all clusters |
| `POST` | `/api/clusters` | Add a cluster |
| `DELETE` | `/api/clusters/:id` | Remove a cluster |
| `GET` | `/api/clusters/:id/health` | Check cluster connectivity + version |
| `GET` | `/api/clusters/:id/slow-queries` | Slow queries (`?duration_ms=5000&hours=24&limit=50`) |
| `GET` | `/api/clusters/:id/full-scans` | Full table scans >100M rows |
| `GET` | `/api/clusters/:id/memory-hogs` | Queries >1 GB memory |
| `GET` | `/api/clusters/:id/stats` | 24h query statistics |
| `POST` | `/api/clusters/:id/explain` | EXPLAIN a query (`{"query":"...","mode":"plan|indexes|pipeline"}`) |
| `POST` | `/api/clusters/:id/query` | Run a custom query |
| `GET` | `/api/reports/daily` | Daily digest across all clusters |
| `GET` | `/api/reports/schedule` | Automated report schedule |
| `GET` | `/api/optimization/patterns` | All 7 bottleneck patterns |
| `GET` | `/api/optimization/checklist` | Optimization checklist items |

---

## Connecting to Clusters

### K8s clusters (via k8scenter port-forward)

```bash
kubectl port-forward svc/clickhouse 9000:9000 -n k8scenter
```

Then add cluster with host `localhost`, port `9000`.

### Standalone hosts

Direct connection — add cluster with the host IP/hostname and port `9000`.

---

## Optimization Patterns Covered

1. Full MergeTree scans — no primary key alignment
2. Missing PREWHERE
3. Unoptimized JOINs (use GLOBAL JOIN)
4. SELECT * on wide tables
5. No TTL policy — data bloat
6. Functions on indexed columns breaking partition pruning
7. High-cardinality GROUP BY without materialized views

---

## Automated Report Schedule (IST)

| Report | Schedule | Clusters |
|--------|----------|----------|
| Daily slow query digest | 07:00 every day | All |
| Full table scan alerts | Real-time | K8s |
| Standalone host health | 06:00 every day | Standalone |
| Weekly optimization report | Monday 08:00 | All |
| Memory pressure alerts | Real-time | K8s |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI Library | Ant Design 5 (dark theme) |
| SQL Editor | Monaco Editor |
| State | Zustand |
| HTTP | Axios |
| Backend | Go 1.22, Gin |
| ClickHouse Client | clickhouse-go/v2 |
| Container | Docker + Docker Compose |
