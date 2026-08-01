# OKR Compass — Metric-driven Engineering OKRs

OKR Compass tracks engineering-team Objectives and Key Results where each Key
Result is bound to a **live metric** pulled directly from your infrastructure —
ClickHouse, Apache Doris, Dragonfly, Redis, Kubernetes, Flink, and MySQL — instead
of being updated by hand. Register a cluster once, pick a built-in metric, set a
baseline/target, and progress is recalculated automatically on a schedule.

## Architecture

```
okr-compass/
├── backend/                    Go 1.22 API (gin) + background evaluator
│   ├── cmd/server/main.go      Entrypoint — wires config, store, connectors, scheduler, router
│   └── internal/
│       ├── connector/          The plugin interface + one subpackage per system
│       │   ├── clickhouse/     ├── doris/   ├── redisfamily/ (Redis + Dragonfly)
│       │   ├── kubernetes/     ├── flink/   └── mysql/
│       ├── store/              SQLite persistence (clusters, objectives, key results, metric samples)
│       ├── crypto/             AES-256-GCM encryption for stored cluster credentials
│       ├── scheduler/          Periodic + on-demand Key Result evaluation
│       ├── middleware/         JWT auth guard
│       └── api/                gin router + REST handlers
└── frontend/                   React 18 + TypeScript + Vite + Ant Design 5
    └── src/{pages,components,services,store,types}
```

### The connector plugin model

Every system implements one interface:

```go
type Connector interface {
    Type() Type
    TestConnection(ctx context.Context) error
    ListMetrics(ctx context.Context) ([]MetricSpec, error)
    RunMetric(ctx context.Context, metricKey string) (MetricValue, error)
    Close() error
}
```

Each subpackage registers itself in `init()` — adding an 8th system means writing
one new `internal/connector/<system>/client.go` and blank-importing it from
`cmd/server/main.go`; nothing else in the API, scheduler, or UI needs to change,
since the "Add Cluster" form and Key Result metric picker are both driven off the
registry at runtime (`GET /api/connectors/types`, `GET /api/connectors/:type/metrics`).

### How a Key Result gets evaluated

1. A Key Result stores: which cluster, which `metricKey`, a comparator
   (`lt`/`lte`/`gt`/`gte`), a baseline value, and a target value.
2. Every `EVAL_INTERVAL_MINUTES` (default 5), the scheduler loads each Key
   Result's cluster, decrypts its credentials, builds a connector, and calls
   `RunMetric`.
3. The reading is stored as a `metric_samples` row (for the trend sparkline) and
   progress is recomputed: `clamp((baseline - current) / (baseline - target), 0, 1)`
   for "lower is better" comparators, inverted for "higher is better" ones.
4. The same evaluation path backs the "Evaluate now" button and runs once
   immediately when a Key Result is first created.

## Built-in metrics per system

| System | Example built-in metrics |
|---|---|
| ClickHouse | query p99 latency, query error rate, insert throughput, disk usage |
| Doris | FE query latency, connection total, tablet count, max compaction score (scraped from the FE's Prometheus `/metrics`; raw metric names vary by version — adjust in `internal/connector/doris/client.go` if yours differ) |
| Dragonfly / Redis | hit rate, used memory, ops/sec, evicted keys, connected clients |
| Kubernetes | pod restart total, CrashLoopBackOff pod count, deployment rollout success rate, node ready rate |
| Flink | running jobs, checkpoint failure rate, average job uptime, TaskManager count |
| MySQL | slow query rate, replication lag, connections used, InnoDB buffer pool hit rate |

## Quick Start (Docker Compose)

```bash
cd Application/okr-compass
cp .env.example .env   # edit ADMIN_PASSWORD, JWT_SECRET, ENCRYPTION_KEY before any real use
docker compose up --build
```

- Frontend: http://localhost:3010
- Backend API: http://localhost:8095/api (health check at `/health`)
- Log in with `ADMIN_USER` / `ADMIN_PASSWORD` from `.env` (defaults: `admin` / `changeme`)

Cluster metadata and OKR data persist in a Docker volume (`okr-compass-data`)
backing a SQLite file at `/data/okr.db` inside the backend container — no
separate database service to run.

### Adding a cluster

From the **Clusters** page, click **Add Cluster**, pick a connector type, and
fill in the fields the form asks for (they're driven by each connector's
`TypeInfo`, e.g. Kubernetes asks for an auth type + kubeconfig or token, Doris
asks for an optional metrics path). Click **Test** after saving to confirm
connectivity before binding a Key Result to it. Credentials are AES-256-GCM
encrypted at rest using `ENCRYPTION_KEY` and are never returned by the API.

### Building an OKR

1. **Objectives** → **New Objective** — title, description, owner, team, quarter.
2. Open the objective → **Add Key Result** — pick a registered cluster, pick one
   of its built-in metrics, choose a comparator, and set baseline/target values.
3. Progress fills in immediately (first evaluation runs synchronously) and then
   refreshes automatically every `EVAL_INTERVAL_MINUTES`.

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/api/auth/login` | Returns a JWT for `ADMIN_USER`/`ADMIN_PASSWORD` |
| GET/POST | `/api/clusters` | List / register a cluster |
| POST | `/api/clusters/:id/test` | Test connectivity for a saved cluster |
| DELETE | `/api/clusters/:id` | Remove a cluster |
| GET | `/api/connectors/types` | Registered connector types + their form fields |
| GET | `/api/connectors/:type/metrics` | Built-in metrics for a connector type |
| GET/POST | `/api/objectives` | List / create objectives |
| GET/PATCH/DELETE | `/api/objectives/:id` | Read, update, or delete one objective |
| POST | `/api/objectives/:id/key-results` | Add a Key Result to an objective |
| DELETE | `/api/key-results/:id` | Remove a Key Result |
| POST | `/api/key-results/:id/evaluate` | Evaluate a Key Result immediately |
| GET | `/api/key-results/:id/history` | Metric sample history for the trend chart |
| GET | `/api/dashboard/summary` | Org rollup: progress by team/quarter, at-risk Key Results |

All `/api/*` routes except `/api/auth/login` require `Authorization: Bearer <token>`.

## Tech Stack

- **Backend**: Go 1.22, gin, clickhouse-go/v2, go-sql-driver/mysql, go-redis/v9,
  client-go, golang-jwt/v5, modernc.org/sqlite (pure Go, no CGO)
- **Frontend**: React 18, TypeScript, Vite, Ant Design 5, axios, zustand, react-router-dom
- **Storage**: embedded SQLite (no separate DB service)
- **Deploy**: Docker Compose — `backend` (host port 8095) + `frontend` (host port 3010)

## Local development (without Docker)

```bash
# Backend
cd backend
go mod tidy
ADMIN_PASSWORD=devpass ENCRYPTION_KEY=dev-insecure-32-byte-key-change! go run ./cmd/server

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api to http://localhost:8080, see vite.config.ts
```
