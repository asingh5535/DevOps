// Package redisfamily implements the connector.Connector interface for both
// Redis and Dragonfly, since Dragonfly speaks the Redis wire protocol and
// exposes the same INFO command — one client, two registered types.
package redisfamily

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"

	"github.com/okr-compass/backend/internal/connector"
)

const (
	metricHitRate         = "redis.hit_rate_pct"
	metricUsedMemory      = "redis.used_memory_mb"
	metricOpsPerSecond    = "redis.ops_per_sec"
	metricEvictedKeys     = "redis.evicted_keys_total"
	metricConnectedClient = "redis.connected_clients"
)

var metrics = []connector.MetricSpec{
	{Key: metricHitRate, Name: "Keyspace hit rate", Description: "Share of lookups served from cache since start", Unit: "%"},
	{Key: metricUsedMemory, Name: "Used memory", Description: "Memory currently used by the dataset", Unit: "MB"},
	{Key: metricOpsPerSecond, Name: "Ops per second", Description: "Instantaneous commands processed per second", Unit: "ops/s"},
	{Key: metricEvictedKeys, Name: "Evicted keys", Description: "Total keys evicted due to maxmemory since start", Unit: "keys"},
	{Key: metricConnectedClient, Name: "Connected clients", Description: "Number of client connections currently open", Unit: "clients"},
}

func init() {
	fields := []connector.Field{
		{Key: "tls", Label: "Use TLS", Required: false},
	}
	connector.Register(
		connector.TypeInfo{Type: connector.TypeRedis, Label: "Redis", DefaultPort: 6379, PasswordLabel: "Password (optional)", Fields: fields},
		metrics,
		func(cfg connector.ClusterConfig) (connector.Connector, error) { return newClient(cfg, connector.TypeRedis) },
	)
	connector.Register(
		connector.TypeInfo{Type: connector.TypeDragonfly, Label: "Dragonfly", DefaultPort: 6379, PasswordLabel: "Password (optional)", Fields: fields},
		metrics,
		func(cfg connector.ClusterConfig) (connector.Connector, error) { return newClient(cfg, connector.TypeDragonfly) },
	)
}

type Client struct {
	rdb      *redis.Client
	connType connector.Type
}

func newClient(cfg connector.ClusterConfig, t connector.Type) (connector.Connector, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
	})
	return &Client{rdb: rdb, connType: t}, nil
}

func (c *Client) Type() connector.Type { return c.connType }

func (c *Client) TestConnection(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func (c *Client) ListMetrics(ctx context.Context) ([]connector.MetricSpec, error) {
	return metrics, nil
}

func (c *Client) RunMetric(ctx context.Context, metricKey string) (connector.MetricValue, error) {
	info, err := c.rdb.Info(ctx).Result()
	if err != nil {
		return connector.MetricValue{}, err
	}
	fields := parseInfo(info)

	switch metricKey {
	case metricHitRate:
		hits := fields["keyspace_hits"]
		misses := fields["keyspace_misses"]
		total := hits + misses
		if total == 0 {
			return connector.MetricValue{Value: 0, Unit: "%"}, nil
		}
		return connector.MetricValue{Value: hits / total * 100, Unit: "%"}, nil
	case metricUsedMemory:
		return connector.MetricValue{Value: fields["used_memory"] / 1e6, Unit: "MB"}, nil
	case metricOpsPerSecond:
		return connector.MetricValue{Value: fields["instantaneous_ops_per_sec"], Unit: "ops/s"}, nil
	case metricEvictedKeys:
		return connector.MetricValue{Value: fields["evicted_keys"], Unit: "keys"}, nil
	case metricConnectedClient:
		return connector.MetricValue{Value: fields["connected_clients"], Unit: "clients"}, nil
	default:
		return connector.MetricValue{}, fmt.Errorf("unknown metric key: %s", metricKey)
	}
}

func parseInfo(raw string) map[string]float64 {
	result := make(map[string]float64)
	for _, line := range strings.Split(raw, "\r\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		if v, err := strconv.ParseFloat(parts[1], 64); err == nil {
			result[parts[0]] = v
		}
	}
	return result
}

func (c *Client) Close() error {
	return c.rdb.Close()
}
