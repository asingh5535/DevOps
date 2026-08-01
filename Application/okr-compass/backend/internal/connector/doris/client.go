// Package doris implements the connector.Connector interface against Apache
// Doris by scraping the Frontend's Prometheus text endpoint (FE /metrics,
// default port 8030). Doris exposes no other stable API for these figures,
// and metric names can shift slightly across versions — treat the built-in
// keys below as a starting point and adjust via the raw metric name if your
// cluster differs (see README).
package doris

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/okr-compass/backend/internal/connector"
)

const (
	metricQueryLatency    = "doris.query_latency_ms"
	metricConnectionTotal = "doris.connection_total"
	metricTabletNum       = "doris.tablet_num"
	metricCompactionScore = "doris.compaction_score_max"
)

// doris_fe_query_latency_ms is a Prometheus summary (verified against a real
// Doris 2.1 FE), exposed as multiple lines with a "quantile" label
// (0.75/0.95/0.98/0.99/0.999) rather than one gauge value — the lookup key
// must include the label to get p99 specifically, or scraping would
// silently return whichever quantile line happens to appear first in the
// response. doris_fe_max_tablet_compaction_score (not
// doris_fe_max_compaction_score) is the real gauge name for compaction score.
var metricRawNames = map[string]string{
	metricQueryLatency:    `doris_fe_query_latency_ms{quantile="0.99"}`,
	metricConnectionTotal: "doris_fe_connection_total",
	metricTabletNum:       "doris_fe_tablet_num",
	metricCompactionScore: "doris_fe_max_tablet_compaction_score",
}

var metrics = []connector.MetricSpec{
	{Key: metricQueryLatency, Name: "Query latency", Description: "FE-reported query latency gauge (raw metric: doris_fe_query_latency_ms)", Unit: "ms"},
	{Key: metricConnectionTotal, Name: "Connection total", Description: "Total client connections currently open on the FE", Unit: "conns"},
	{Key: metricTabletNum, Name: "Tablet count", Description: "Total tablets tracked by the FE", Unit: "tablets"},
	{Key: metricCompactionScore, Name: "Max compaction score", Description: "Highest compaction score across BEs, reported via FE", Unit: "score"},
}

func init() {
	connector.Register(
		connector.TypeInfo{
			Type:        connector.TypeDoris,
			Label:       "Doris",
			DefaultPort: 8030,
			Fields: []connector.Field{
				{Key: "metricsPath", Label: "Metrics path", Required: false, Placeholder: "/metrics"},
			},
		},
		metrics,
		newClient,
	)
}

type Client struct {
	baseURL string
	http    *http.Client
}

func newClient(cfg connector.ClusterConfig) (connector.Connector, error) {
	path := cfg.Extra["metricsPath"]
	if path == "" {
		path = "/metrics"
	}
	return &Client{
		baseURL: fmt.Sprintf("http://%s:%d%s", cfg.Host, cfg.Port, path),
		http:    &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (c *Client) Type() connector.Type { return connector.TypeDoris }

func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.scrape(ctx)
	return err
}

func (c *Client) ListMetrics(ctx context.Context) ([]connector.MetricSpec, error) {
	return metrics, nil
}

func (c *Client) RunMetric(ctx context.Context, metricKey string) (connector.MetricValue, error) {
	rawName, ok := metricRawNames[metricKey]
	if !ok {
		return connector.MetricValue{}, fmt.Errorf("unknown metric key: %s", metricKey)
	}
	samples, err := c.scrape(ctx)
	if err != nil {
		return connector.MetricValue{}, err
	}
	value, found := samples[rawName]
	if !found {
		return connector.MetricValue{}, fmt.Errorf("metric %q not found on this Doris cluster's /metrics endpoint (naming may differ by version)", rawName)
	}
	return connector.MetricValue{Value: value}, nil
}

// scrape does a minimal Prometheus text-exposition parse: "name{labels} value" or "name value".
// Each sample is indexed twice: once under its exact "name{labels}" text (so
// callers can pin a specific label combination, e.g. a quantile), and once
// under the bare name keeping the first occurrence seen (good enough for
// simple FE-scoped gauges/counters that carry no meaningful labels here).
func (c *Client) scrape(ctx context.Context) (map[string]float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("doris metrics endpoint returned status %d", resp.StatusCode)
	}

	samples := make(map[string]float64)
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := fields[0]
		value, err := strconv.ParseFloat(fields[len(fields)-1], 64)
		if err != nil {
			continue
		}
		samples[key] = value // exact "name{labels}" — later duplicate lines (rare) win, fine for our purposes

		bareName := key
		if idx := strings.IndexByte(bareName, '{'); idx != -1 {
			bareName = bareName[:idx]
		}
		if _, exists := samples[bareName]; !exists {
			samples[bareName] = value
		}
	}
	return samples, scanner.Err()
}

func (c *Client) Close() error { return nil }
