// Package clickhouse implements the connector.Connector interface against a
// ClickHouse cluster, reading built-in health/performance metrics out of
// system.query_log and system.parts.
package clickhouse

import (
	"context"
	"fmt"

	ch "github.com/ClickHouse/clickhouse-go/v2"

	"github.com/okr-compass/backend/internal/connector"
)

const (
	metricQueryP99Latency  = "clickhouse.query_p99_latency_ms"
	metricQueryErrorRate   = "clickhouse.query_error_rate_pct"
	metricInsertThroughput = "clickhouse.insert_throughput_rows_per_sec"
	metricDiskUsage        = "clickhouse.disk_usage_gb"
)

var metrics = []connector.MetricSpec{
	{Key: metricQueryP99Latency, Name: "Query p99 latency", Description: "99th percentile query duration over the last hour", Unit: "ms"},
	{Key: metricQueryErrorRate, Name: "Query error rate", Description: "Share of queries that raised an exception in the last hour", Unit: "%"},
	{Key: metricInsertThroughput, Name: "Insert throughput", Description: "Average rows written per second over the last hour", Unit: "rows/s"},
	{Key: metricDiskUsage, Name: "Disk usage", Description: "Total bytes on disk across active parts", Unit: "GB"},
}

func init() {
	connector.Register(
		connector.TypeInfo{
			Type:          connector.TypeClickHouse,
			Label:         "ClickHouse",
			DefaultPort:   9000,
			UsesUsername:  true,
			PasswordLabel: "Password",
			Fields: []connector.Field{
				{Key: "database", Label: "Database", Required: false, Placeholder: "default"},
			},
		},
		metrics,
		newClient,
	)
}

type Client struct {
	conn ch.Conn
}

func newClient(cfg connector.ClusterConfig) (connector.Connector, error) {
	database := cfg.Extra["database"]
	if database == "" {
		database = "default"
	}
	conn, err := ch.Open(&ch.Options{
		Addr: []string{fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)},
		Auth: ch.Auth{
			Database: database,
			Username: cfg.Username,
			Password: cfg.Password,
		},
	})
	if err != nil {
		return nil, err
	}
	return &Client{conn: conn}, nil
}

func (c *Client) Type() connector.Type { return connector.TypeClickHouse }

func (c *Client) TestConnection(ctx context.Context) error {
	return c.conn.Ping(ctx)
}

func (c *Client) ListMetrics(ctx context.Context) ([]connector.MetricSpec, error) {
	return metrics, nil
}

func (c *Client) RunMetric(ctx context.Context, metricKey string) (connector.MetricValue, error) {
	var query, unit string
	switch metricKey {
	case metricQueryP99Latency:
		query = `SELECT quantile(0.99)(query_duration_ms) FROM system.query_log WHERE event_time > now() - INTERVAL 1 HOUR AND type = 'QueryFinish'`
		unit = "ms"
	case metricQueryErrorRate:
		query = `SELECT if(count() = 0, 0, countIf(exception != '') / count() * 100) FROM system.query_log WHERE event_time > now() - INTERVAL 1 HOUR`
		unit = "%"
	case metricInsertThroughput:
		query = `SELECT sum(written_rows) / 3600 FROM system.query_log WHERE event_time > now() - INTERVAL 1 HOUR AND query_kind = 'Insert' AND type = 'QueryFinish'`
		unit = "rows/s"
	case metricDiskUsage:
		query = `SELECT sum(bytes_on_disk) / 1e9 FROM system.parts WHERE active`
		unit = "GB"
	default:
		return connector.MetricValue{}, fmt.Errorf("unknown metric key: %s", metricKey)
	}

	row := c.conn.QueryRow(ctx, query)
	var value float64
	if err := row.Scan(&value); err != nil {
		return connector.MetricValue{}, err
	}
	return connector.MetricValue{Value: value, Unit: unit}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}
