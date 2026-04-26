package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	chclient "github.com/torres/ch-analyser/internal/clickhouse"
	"github.com/torres/ch-analyser/internal/config"
)

type ReportHandler struct {
	cfg *config.Config
}

func NewReportHandler(cfg *config.Config) *ReportHandler {
	return &ReportHandler{cfg: cfg}
}

type ClusterReport struct {
	ClusterID   string                  `json:"cluster_id"`
	ClusterName string                  `json:"cluster_name"`
	Status      string                  `json:"status"`
	Stats       map[string]interface{}  `json:"stats,omitempty"`
	SlowQueries []chclient.SlowQuery    `json:"slow_queries,omitempty"`
	FullScans   []chclient.FullScanQuery `json:"full_scans,omitempty"`
	MemoryHogs  []chclient.MemoryHogQuery `json:"memory_hogs,omitempty"`
	Error       string                  `json:"error,omitempty"`
}

// GET /api/reports/daily
func (h *ReportHandler) DailyDigest(c *gin.Context) {
	hours := 24
	var reports []ClusterReport

	for _, cl := range h.cfg.Clusters {
		report := ClusterReport{
			ClusterID:   cl.ID,
			ClusterName: cl.Name,
			Status:      "unreachable",
		}

		client, err := chclient.NewClient(&cl)
		if err != nil {
			report.Error = err.Error()
			reports = append(reports, report)
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		stats, err := client.GetQueryStats(ctx, hours)
		cancel()
		if err != nil {
			client.Close()
			report.Error = err.Error()
			reports = append(reports, report)
			continue
		}

		report.Status = "active"
		report.Stats = stats

		ctx2, cancel2 := context.WithTimeout(context.Background(), 15*time.Second)
		slow, _ := client.GetSlowQueries(ctx2, 5000, hours, 10)
		cancel2()
		if slow != nil {
			report.SlowQueries = slow
		} else {
			report.SlowQueries = []chclient.SlowQuery{}
		}

		ctx3, cancel3 := context.WithTimeout(context.Background(), 15*time.Second)
		memHogs, _ := client.GetMemoryHogs(ctx3, hours, 5)
		cancel3()
		if memHogs != nil {
			report.MemoryHogs = memHogs
		} else {
			report.MemoryHogs = []chclient.MemoryHogQuery{}
		}

		client.Close()
		reports = append(reports, report)
	}

	c.JSON(http.StatusOK, gin.H{
		"generated_at": time.Now().Format(time.RFC3339),
		"period_hours": hours,
		"clusters":     reports,
		"total":        len(reports),
	})
}

// GET /api/reports/schedule
func (h *ReportHandler) Schedule(c *gin.Context) {
	schedule := []map[string]interface{}{
		{
			"report":    "Daily slow query digest",
			"schedule":  "07:00 every day (IST)",
			"clusters":  "All",
			"cron":      "0 7 * * *",
		},
		{
			"report":    "Full table scan alerts",
			"schedule":  "Real-time",
			"clusters":  "K8s",
			"cron":      "realtime",
		},
		{
			"report":    "Standalone host health check",
			"schedule":  "06:00 every day (IST)",
			"clusters":  "Standalone",
			"cron":      "0 6 * * *",
		},
		{
			"report":    "Weekly optimization report",
			"schedule":  "Monday 08:00 (IST)",
			"clusters":  "All",
			"cron":      "0 8 * * 1",
		},
		{
			"report":    "Memory pressure alerts",
			"schedule":  "Real-time",
			"clusters":  "K8s",
			"cron":      "realtime",
		},
	}
	c.JSON(http.StatusOK, gin.H{"schedule": schedule})
}

// GET /api/optimization/patterns
func (h *ReportHandler) OptimizationPatterns(c *gin.Context) {
	patterns := []map[string]interface{}{
		{
			"id":    "full-scan",
			"title": "Full MergeTree scans — no primary key alignment",
			"why":   "WHERE clause columns are not in the ORDER BY key, so ClickHouse reads the entire table.",
			"severity": "critical",
			"bad": `SELECT user_id, count(*) FROM events WHERE country = 'IN' GROUP BY user_id;`,
			"good": `CREATE TABLE events (
    date Date,
    country LowCardinality(String),
    user_id UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (country, date, user_id);`,
		},
		{
			"id":    "prewhere",
			"title": "Missing PREWHERE",
			"why":   "Heavy filters in WHERE do not get early row elimination that PREWHERE provides.",
			"severity": "high",
			"bad": `SELECT user_id, count(*)
FROM events
WHERE date >= toStartOfMonth(now()) AND event_type = 'click'
GROUP BY user_id;`,
			"good": `SELECT user_id, count(*)
FROM events
PREWHERE date >= toStartOfMonth(now())
WHERE event_type = 'click'
GROUP BY user_id;`,
		},
		{
			"id":    "joins",
			"title": "Unoptimized JOINs",
			"why":   "Cross-shard data shuffles when join keys are not co-located.",
			"severity": "high",
			"bad": `SELECT s.*, u.name
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.created_at > now() - INTERVAL 7 DAY;`,
			"good": `SELECT s.session_id, u.name
FROM sessions s
GLOBAL JOIN users u ON s.user_id = u.id
PREWHERE s.created_at > now() - INTERVAL 7 DAY;`,
		},
		{
			"id":    "select-star",
			"title": "SELECT * on wide tables",
			"why":   "All columns are read and decompressed even when only 2–3 are needed.",
			"severity": "medium",
			"bad":  `SELECT * FROM raw_logs WHERE level = 'ERROR' LIMIT 1000;`,
			"good": `SELECT timestamp, message, trace_id
FROM raw_logs
WHERE level = 'ERROR'
LIMIT 1000;`,
		},
		{
			"id":    "ttl",
			"title": "No TTL policy — data bloat",
			"why":   "Tables grow unbounded; old data is never expired, increasing scan time.",
			"severity": "medium",
			"bad":  `-- No TTL set on table`,
			"good": `ALTER TABLE metrics
    MODIFY TTL timestamp + INTERVAL 90 DAY;`,
		},
		{
			"id":    "functions-on-index",
			"title": "Functions on indexed columns",
			"why":   "Wrapping an indexed column in a function breaks partition pruning.",
			"severity": "high",
			"bad":  `SELECT toDate(timestamp), sum(value) FROM metrics GROUP BY 1;`,
			"good": `ALTER TABLE metrics ADD COLUMN event_date Date MATERIALIZED toDate(timestamp);
-- Then query:
SELECT event_date, sum(value) FROM metrics GROUP BY event_date;`,
		},
		{
			"id":    "materialized-views",
			"title": "High-cardinality GROUP BY without materialized views",
			"why":   "Aggregating billions of rows at query time on high-cardinality keys is expensive.",
			"severity": "critical",
			"bad":  `SELECT user_id, count(*) FROM events WHERE date >= today() GROUP BY user_id;`,
			"good": `CREATE MATERIALIZED VIEW events_user_daily_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, user_id)
AS SELECT
    toDate(event_time) AS date,
    user_id,
    count() AS event_count
FROM events
GROUP BY date, user_id;

-- Query the MV instead
SELECT user_id, sum(event_count)
FROM events_user_daily_mv
WHERE date >= toStartOfMonth(today())
GROUP BY user_id ORDER BY sum(event_count) DESC;`,
		},
	}
	c.JSON(http.StatusOK, gin.H{"patterns": patterns, "total": len(patterns)})
}

// GET /api/optimization/checklist
func (h *ReportHandler) OptimizationChecklist(c *gin.Context) {
	items := []map[string]interface{}{
		{"id": 1, "item": "All WHERE filter columns present in ORDER BY key"},
		{"id": 2, "item": "Heavy filters moved to PREWHERE"},
		{"id": 3, "item": "No SELECT * on production queries"},
		{"id": 4, "item": "JOINs use GLOBAL JOIN or co-located shards"},
		{"id": 5, "item": "TTL policy set on all large tables"},
		{"id": 6, "item": "No functions wrapping indexed columns in WHERE"},
		{"id": 7, "item": "High-frequency aggregations backed by materialized views"},
		{"id": 8, "item": "LowCardinality(String) used for low-cardinality string columns"},
		{"id": 9, "item": "Bloom filter skip indexes on string filter columns"},
		{"id": 10, "item": "Partition granularity tuned (default 8192 index_granularity)"},
	}
	c.JSON(http.StatusOK, gin.H{"checklist": items})
}
