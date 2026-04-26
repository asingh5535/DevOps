package clickhouse

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/torres/ch-analyser/internal/config"
)

type Client struct {
	conn   driver.Conn
	Cluster *config.Cluster
}

func NewClient(cluster *config.Cluster) (*Client, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", cluster.Host, cluster.Port)},
		Auth: clickhouse.Auth{
			Database: cluster.Database,
			Username: cluster.User,
			Password: cluster.Password,
		},
		DialTimeout:     5 * time.Second,
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 10 * time.Minute,
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 30,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("open connection: %w", err)
	}
	return &Client{conn: conn, Cluster: cluster}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	return c.conn.Ping(ctx)
}

func (c *Client) Close() error {
	return c.conn.Close()
}

// ---- Query result types ----

type SlowQuery struct {
	QueryID     string    `json:"query_id" ch:"query_id"`
	User        string    `json:"user" ch:"user"`
	Query       string    `json:"query" ch:"query"`
	EventTime   time.Time `json:"event_time" ch:"event_time"`
	DurationSec float64   `json:"duration_sec" ch:"duration_sec"`
	ReadRows    uint64    `json:"read_rows" ch:"read_rows"`
	ReadSize    string    `json:"read_size" ch:"read_size"`
	Memory      string    `json:"memory" ch:"memory"`
	Exception   string    `json:"exception" ch:"exception"`
}

type FullScanQuery struct {
	Query       string  `json:"query" ch:"query"`
	DurationSec float64 `json:"duration_sec" ch:"duration_sec"`
	ReadRows    uint64  `json:"read_rows" ch:"read_rows"`
	BytesRead   string  `json:"bytes_read" ch:"bytes_read"`
}

type MemoryHogQuery struct {
	QueryID     string  `json:"query_id" ch:"query_id"`
	Query       string  `json:"query" ch:"query"`
	Memory      string  `json:"memory" ch:"memory"`
	DurationSec float64 `json:"duration_sec" ch:"duration_sec"`
}

type ServerInfo struct {
	Hostname string `json:"hostname" ch:"hostname"`
	Version  string `json:"version" ch:"version"`
	Uptime   uint32 `json:"uptime" ch:"uptime"`
}

type ExplainResult struct {
	Explain string `json:"explain" ch:"explain"`
}

// ---- Query methods ----

func (c *Client) GetSlowQueries(ctx context.Context, durationMs int, hours int, limit int) ([]SlowQuery, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			query_id,
			user,
			query,
			event_time,
			query_duration_ms / 1000 AS duration_sec,
			read_rows,
			formatReadableSize(read_bytes) AS read_size,
			formatReadableSize(memory_usage) AS memory,
			exception
		FROM system.query_log
		WHERE
			type = 'QueryFinish'
			AND query_duration_ms > ?
			AND event_time >= now() - INTERVAL ? HOUR
		ORDER BY query_duration_ms DESC
		LIMIT ?`,
		durationMs, hours, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("slow queries: %w", err)
	}
	defer rows.Close()

	var results []SlowQuery
	for rows.Next() {
		var q SlowQuery
		if err := rows.ScanStruct(&q); err != nil {
			continue
		}
		results = append(results, q)
	}
	return results, rows.Err()
}

func (c *Client) GetFullScans(ctx context.Context, hours int, limit int) ([]FullScanQuery, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			query,
			query_duration_ms / 1000 AS duration_sec,
			read_rows,
			formatReadableSize(read_bytes) AS bytes_read
		FROM system.query_log
		WHERE
			type = 'QueryFinish'
			AND read_rows > 100000000
			AND event_time >= now() - INTERVAL ? HOUR
		ORDER BY read_rows DESC
		LIMIT ?`,
		hours, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("full scans: %w", err)
	}
	defer rows.Close()

	var results []FullScanQuery
	for rows.Next() {
		var q FullScanQuery
		if err := rows.ScanStruct(&q); err != nil {
			continue
		}
		results = append(results, q)
	}
	return results, rows.Err()
}

func (c *Client) GetMemoryHogs(ctx context.Context, hours int, limit int) ([]MemoryHogQuery, error) {
	rows, err := c.conn.Query(ctx, `
		SELECT
			query_id,
			query,
			formatReadableSize(memory_usage) AS memory,
			query_duration_ms / 1000 AS duration_sec
		FROM system.query_log
		WHERE
			type = 'QueryFinish'
			AND memory_usage > 1073741824
			AND event_time >= now() - INTERVAL ? HOUR
		ORDER BY memory_usage DESC
		LIMIT ?`,
		hours, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("memory hogs: %w", err)
	}
	defer rows.Close()

	var results []MemoryHogQuery
	for rows.Next() {
		var q MemoryHogQuery
		if err := rows.ScanStruct(&q); err != nil {
			continue
		}
		results = append(results, q)
	}
	return results, rows.Err()
}

func (c *Client) ExplainQuery(ctx context.Context, query string, mode string) ([]string, error) {
	var explainSQL string
	switch mode {
	case "indexes":
		explainSQL = "EXPLAIN indexes = 1 " + query
	case "pipeline":
		explainSQL = "EXPLAIN PIPELINE " + query
	default:
		explainSQL = "EXPLAIN " + query
	}

	rows, err := c.conn.Query(ctx, explainSQL)
	if err != nil {
		return nil, fmt.Errorf("explain: %w", err)
	}
	defer rows.Close()

	var lines []string
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			continue
		}
		lines = append(lines, line)
	}
	return lines, rows.Err()
}

func (c *Client) RunQuery(ctx context.Context, query string) ([]map[string]interface{}, []string, error) {
	rows, err := c.conn.Query(ctx, query)
	if err != nil {
		return nil, nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	cols := rows.Columns()
	var results []map[string]interface{}

	for rows.Next() {
		vals := make([]interface{}, len(cols))
		valPtrs := make([]interface{}, len(cols))
		for i := range vals {
			valPtrs[i] = &vals[i]
		}
		if err := rows.Scan(valPtrs...); err != nil {
			continue
		}
		row := make(map[string]interface{})
		for i, col := range cols {
			row[col] = vals[i]
		}
		results = append(results, row)
	}
	return results, cols, rows.Err()
}

func (c *Client) GetServerInfo(ctx context.Context) (*ServerInfo, error) {
	row := c.conn.QueryRow(ctx, `SELECT hostname(), version(), uptime()`)
	var info ServerInfo
	if err := row.Scan(&info.Hostname, &info.Version, &info.Uptime); err != nil {
		return nil, fmt.Errorf("server info: %w", err)
	}
	return &info, nil
}

func (c *Client) GetQueryStats(ctx context.Context, hours int) (map[string]interface{}, error) {
	row := c.conn.QueryRow(ctx, `
		SELECT
			count()                                          AS total_queries,
			countIf(query_duration_ms > 5000)               AS slow_queries,
			countIf(read_rows > 100000000)                  AS full_scans,
			countIf(memory_usage > 1073741824)              AS memory_hogs,
			round(avg(query_duration_ms) / 1000, 2)         AS avg_duration_sec,
			round(max(query_duration_ms) / 1000, 2)         AS max_duration_sec
		FROM system.query_log
		WHERE type = 'QueryFinish'
		  AND event_time >= now() - INTERVAL ? HOUR`,
		hours,
	)

	var total, slow, scans, memHogs uint64
	var avgDur, maxDur float64
	if err := row.Scan(&total, &slow, &scans, &memHogs, &avgDur, &maxDur); err != nil {
		return nil, fmt.Errorf("query stats: %w", err)
	}

	return map[string]interface{}{
		"total_queries":    total,
		"slow_queries":     slow,
		"full_scans":       scans,
		"memory_hogs":      memHogs,
		"avg_duration_sec": avgDur,
		"max_duration_sec": maxDur,
	}, nil
}
