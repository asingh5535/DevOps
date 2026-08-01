// Package mysql implements the connector.Connector interface against a
// MySQL (or MySQL-protocol-compatible) server using SHOW GLOBAL STATUS /
// SHOW SLAVE STATUS for built-in health metrics.
package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"

	_ "github.com/go-sql-driver/mysql"

	"github.com/okr-compass/backend/internal/connector"
)

const (
	metricSlowQueryRate     = "mysql.slow_query_rate_pct"
	metricReplicationLag    = "mysql.replication_lag_seconds"
	metricConnectionsUsed   = "mysql.connections_used_pct"
	metricBufferPoolHitRate = "mysql.innodb_buffer_pool_hit_rate_pct"
)

var metrics = []connector.MetricSpec{
	{Key: metricSlowQueryRate, Name: "Slow query rate", Description: "Share of queries flagged slow since server start", Unit: "%"},
	{Key: metricReplicationLag, Name: "Replication lag", Description: "Seconds behind master (0 if not a replica)", Unit: "s"},
	{Key: metricConnectionsUsed, Name: "Connections used", Description: "Active connections as a share of max_connections", Unit: "%"},
	{Key: metricBufferPoolHitRate, Name: "InnoDB buffer pool hit rate", Description: "Share of reads served from the buffer pool", Unit: "%"},
}

func init() {
	connector.Register(
		connector.TypeInfo{
			Type:          connector.TypeMySQL,
			Label:         "MySQL",
			DefaultPort:   3306,
			UsesUsername:  true,
			PasswordLabel: "Password",
			Fields: []connector.Field{
				{Key: "database", Label: "Database", Required: false, Placeholder: "mysql"},
			},
		},
		metrics,
		newClient,
	)
}

type Client struct {
	db *sql.DB
}

func newClient(cfg connector.ClusterConfig) (connector.Connector, error) {
	database := cfg.Extra["database"]
	if database == "" {
		database = "mysql"
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&timeout=5s", cfg.Username, cfg.Password, cfg.Host, cfg.Port, database)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(2)
	return &Client{db: db}, nil
}

func (c *Client) Type() connector.Type { return connector.TypeMySQL }

func (c *Client) TestConnection(ctx context.Context) error {
	return c.db.PingContext(ctx)
}

func (c *Client) ListMetrics(ctx context.Context) ([]connector.MetricSpec, error) {
	return metrics, nil
}

func (c *Client) RunMetric(ctx context.Context, metricKey string) (connector.MetricValue, error) {
	switch metricKey {
	case metricSlowQueryRate:
		status, err := c.globalStatus(ctx, "Slow_queries", "Questions")
		if err != nil {
			return connector.MetricValue{}, err
		}
		questions := status["Questions"]
		if questions == 0 {
			return connector.MetricValue{Value: 0, Unit: "%"}, nil
		}
		return connector.MetricValue{Value: status["Slow_queries"] / questions * 100, Unit: "%"}, nil

	case metricReplicationLag:
		lag, err := c.replicationLagSeconds(ctx)
		if err != nil {
			return connector.MetricValue{}, err
		}
		return connector.MetricValue{Value: lag, Unit: "s"}, nil

	case metricConnectionsUsed:
		status, err := c.globalStatus(ctx, "Threads_connected")
		if err != nil {
			return connector.MetricValue{}, err
		}
		maxConn, err := c.globalVariable(ctx, "max_connections")
		if err != nil {
			return connector.MetricValue{}, err
		}
		if maxConn == 0 {
			return connector.MetricValue{Value: 0, Unit: "%"}, nil
		}
		return connector.MetricValue{Value: status["Threads_connected"] / maxConn * 100, Unit: "%"}, nil

	case metricBufferPoolHitRate:
		status, err := c.globalStatus(ctx, "Innodb_buffer_pool_read_requests", "Innodb_buffer_pool_reads")
		if err != nil {
			return connector.MetricValue{}, err
		}
		requests := status["Innodb_buffer_pool_read_requests"]
		if requests == 0 {
			return connector.MetricValue{Value: 100, Unit: "%"}, nil
		}
		hitRate := (1 - status["Innodb_buffer_pool_reads"]/requests) * 100
		return connector.MetricValue{Value: hitRate, Unit: "%"}, nil

	default:
		return connector.MetricValue{}, fmt.Errorf("unknown metric key: %s", metricKey)
	}
}

func (c *Client) globalStatus(ctx context.Context, keys ...string) (map[string]float64, error) {
	rows, err := c.db.QueryContext(ctx, "SHOW GLOBAL STATUS")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	wanted := make(map[string]bool, len(keys))
	for _, k := range keys {
		wanted[k] = true
	}

	result := make(map[string]float64, len(keys))
	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		if wanted[name] {
			result[name], _ = strconv.ParseFloat(value, 64)
		}
	}
	return result, rows.Err()
}

func (c *Client) globalVariable(ctx context.Context, key string) (float64, error) {
	row := c.db.QueryRowContext(ctx, "SHOW GLOBAL VARIABLES LIKE ?", key)
	var name, value string
	if err := row.Scan(&name, &value); err != nil {
		return 0, err
	}
	v, _ := strconv.ParseFloat(value, 64)
	return v, nil
}

// replicationLagSeconds returns 0 (not an error) when the server isn't a replica,
// since "no lag" is the correct signal for a KR measuring a standalone/primary instance.
func (c *Client) replicationLagSeconds(ctx context.Context) (float64, error) {
	rows, err := c.db.QueryContext(ctx, "SHOW SLAVE STATUS")
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return 0, err
	}
	if !rows.Next() {
		return 0, nil
	}

	values := make([]sql.RawBytes, len(cols))
	scanArgs := make([]any, len(cols))
	for i := range values {
		scanArgs[i] = &values[i]
	}
	if err := rows.Scan(scanArgs...); err != nil {
		return 0, err
	}
	for i, col := range cols {
		if col == "Seconds_Behind_Master" && values[i] != nil {
			lag, _ := strconv.ParseFloat(string(values[i]), 64)
			return lag, nil
		}
	}
	return 0, nil
}

func (c *Client) Close() error {
	return c.db.Close()
}
