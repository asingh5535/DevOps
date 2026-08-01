# Built-in Metrics Reference

Every metric below is available from the Key Result builder once a cluster of
the matching type is registered (`GET /api/connectors/:type/metrics` serves
this same list to the UI at runtime, so this page and the app can never
drift on the *set* of metrics — only on the prose descriptions here).

`Key` is the exact `metricKey` a Key Result stores and evaluates against.
`Typical comparator` is a suggestion for the Key Result builder's
lt/lte/gt/gte field, not a constraint — pick whichever direction matches your
Objective.

All metrics were verified against real instances of each system; see the
[main README](../README.md#quick-start-docker-compose) for how to register a
cluster, and the "Data source" column below if you need to adjust a query or
metric name for your own cluster's version (particularly relevant for Doris,
see its section).

## ClickHouse

| Key | Name | Unit | Typical comparator | Description | Data source |
|---|---|---|---|---|---|
| `clickhouse.query_p99_latency_ms` | Query p99 latency | ms | lower is better | 99th percentile query duration over the last hour | `quantile(0.99)(query_duration_ms)` from `system.query_log` |
| `clickhouse.query_error_rate_pct` | Query error rate | % | lower is better | Share of queries that raised an exception in the last hour | `countIf(exception != '') / count()` from `system.query_log` |
| `clickhouse.insert_throughput_rows_per_sec` | Insert throughput | rows/s | higher is better | Average rows written per second over the last hour | `sum(written_rows) / 3600` from `system.query_log` where `query_kind = 'Insert'` |
| `clickhouse.disk_usage_gb` | Disk usage | GB | lower is better | Total bytes on disk across active parts | `sum(bytes_on_disk)` from `system.parts` where `active` |

## MySQL

| Key | Name | Unit | Typical comparator | Description | Data source |
|---|---|---|---|---|---|
| `mysql.slow_query_rate_pct` | Slow query rate | % | lower is better | Share of queries flagged slow since server start | `Slow_queries / Questions` from `SHOW GLOBAL STATUS` |
| `mysql.replication_lag_seconds` | Replication lag | s | lower is better | Seconds behind the source (0 if this server isn't a replica) | `Seconds_Behind_Source` from `SHOW REPLICA STATUS` (falls back to `SHOW SLAVE STATUS` / `Seconds_Behind_Master` on MySQL < 8.0.22) |
| `mysql.connections_used_pct` | Connections used | % | lower is better | Active connections as a share of `max_connections` | `Threads_connected` (`SHOW GLOBAL STATUS`) ÷ `max_connections` (`SHOW GLOBAL VARIABLES`) |
| `mysql.innodb_buffer_pool_hit_rate_pct` | InnoDB buffer pool hit rate | % | higher is better | Share of reads served from the buffer pool | `1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)` from `SHOW GLOBAL STATUS` |

## Redis

| Key | Name | Unit | Typical comparator | Description | Data source |
|---|---|---|---|---|---|
| `redis.hit_rate_pct` | Keyspace hit rate | % | higher is better | Share of lookups served from cache since start | `keyspace_hits / (keyspace_hits + keyspace_misses)` from `INFO` |
| `redis.used_memory_mb` | Used memory | MB | lower is better | Memory currently used by the dataset | `used_memory` from `INFO` |
| `redis.ops_per_sec` | Ops per second | ops/s | context-dependent | Instantaneous commands processed per second | `instantaneous_ops_per_sec` from `INFO` |
| `redis.evicted_keys_total` | Evicted keys | keys | lower is better | Total keys evicted due to `maxmemory` since start | `evicted_keys` from `INFO` |
| `redis.connected_clients` | Connected clients | clients | context-dependent | Number of client connections currently open | `connected_clients` from `INFO` |

## Dragonfly

Dragonfly speaks the Redis protocol, so it shares Redis's implementation and
metric set — only the key prefix differs (`dragonfly.*` instead of
`redis.*`), each resolved against the same `INFO` fields:

| Key | Name | Unit | Typical comparator |
|---|---|---|---|
| `dragonfly.hit_rate_pct` | Keyspace hit rate | % | higher is better |
| `dragonfly.used_memory_mb` | Used memory | MB | lower is better |
| `dragonfly.ops_per_sec` | Ops per second | ops/s | context-dependent |
| `dragonfly.evicted_keys_total` | Evicted keys | keys | lower is better |
| `dragonfly.connected_clients` | Connected clients | clients | context-dependent |

## Kubernetes

| Key | Name | Unit | Typical comparator | Description | Data source |
|---|---|---|---|---|---|
| `kubernetes.pod_restart_total` | Pod restart total | restarts | lower is better | Sum of container restart counts across pods (scoped to the cluster's configured namespace, or all namespaces if blank) | Sum of `status.containerStatuses[].restartCount` over `Pods` |
| `kubernetes.crashloop_pod_count` | CrashLoopBackOff pods | pods | lower is better | Pods with at least one container in `CrashLoopBackOff` | `status.containerStatuses[].state.waiting.reason == "CrashLoopBackOff"` over `Pods` |
| `kubernetes.deployment_rollout_success_pct` | Deployment rollout success rate | % | higher is better | Deployments fully available (`updatedReplicas == replicas == availableReplicas`) vs. total | `Deployments` status fields |
| `kubernetes.node_ready_pct` | Node ready rate | % | higher is better | Nodes reporting the `Ready` condition `True` vs. total nodes | `Nodes` status conditions |

## Flink

All Flink metrics come from the JobManager's REST API (no SDK — plain HTTP).

| Key | Name | Unit | Typical comparator | Description | Data source |
|---|---|---|---|---|---|
| `flink.running_jobs_count` | Running jobs | jobs | context-dependent | Number of jobs currently in `RUNNING` state | `GET /jobs` |
| `flink.checkpoint_failure_rate_pct` | Checkpoint failure rate | % | lower is better | Failed checkpoints as a share of total, aggregated across all running jobs | `GET /jobs/:id/checkpoints` per running job |
| `flink.avg_uptime_minutes` | Average job uptime | min | higher is better | Average uptime across running jobs | `GET /jobs/overview` |
| `flink.taskmanager_count` | TaskManager count | nodes | context-dependent | Number of registered TaskManagers | `GET /taskmanagers` |

## Doris

Scraped from the Frontend's Prometheus text endpoint (`FE :8030/metrics` by
default; configurable per-cluster via the "Metrics path" field). **Metric
names are version-sensitive** — the table below was verified against
`apache/doris:doris-all-in-one-2.1.0`; if a metric comes back "not found" on
your cluster, `curl http://<fe-host>:8030/metrics` and check the real name,
then update `internal/connector/doris/client.go`'s `metricRawNames` map.

| Key | Name | Unit | Typical comparator | Description | Raw Prometheus metric |
|---|---|---|---|---|---|
| `doris.query_latency_ms` | Query latency | ms | lower is better | FE-reported p99 query latency | `doris_fe_query_latency_ms{quantile="0.99"}` — this is a Prometheus **summary** emitted as multiple lines (one per quantile: 0.75/0.95/0.98/0.99/0.999); the lookup pins the `quantile="0.99"` label explicitly rather than taking whichever line appears first |
| `doris.connection_total` | Connection total | conns | lower is better | Total client connections currently open on the FE | `doris_fe_connection_total` |
| `doris.tablet_num` | Tablet count | tablets | context-dependent | Tablets tracked by the FE for one backend (first backend reported, if multiple) | `doris_fe_tablet_num{backend="..."}` |
| `doris.compaction_score_max` | Max compaction score | score | lower is better | Highest tablet compaction score across all backends, reported via FE | `doris_fe_max_tablet_compaction_score` |
