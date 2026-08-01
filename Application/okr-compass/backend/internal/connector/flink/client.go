// Package flink implements the connector.Connector interface against a
// Flink JobManager's REST API — no SDK exists for Go, so this is a plain
// HTTP client against /jobs, /jobs/:id/checkpoints and /taskmanagers.
package flink

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/okr-compass/backend/internal/connector"
)

const (
	metricRunningJobs        = "flink.running_jobs_count"
	metricCheckpointFailRate = "flink.checkpoint_failure_rate_pct"
	metricAvgUptime          = "flink.avg_uptime_minutes"
	metricTaskManagerCount   = "flink.taskmanager_count"
)

var metrics = []connector.MetricSpec{
	{Key: metricRunningJobs, Name: "Running jobs", Description: "Number of jobs currently in RUNNING state", Unit: "jobs"},
	{Key: metricCheckpointFailRate, Name: "Checkpoint failure rate", Description: "Failed checkpoints as a share of total, across running jobs", Unit: "%"},
	{Key: metricAvgUptime, Name: "Average job uptime", Description: "Average uptime across running jobs", Unit: "min"},
	{Key: metricTaskManagerCount, Name: "TaskManager count", Description: "Number of registered TaskManagers", Unit: "nodes"},
}

func init() {
	connector.Register(
		connector.TypeInfo{Type: connector.TypeFlink, Label: "Flink", DefaultPort: 8081, Fields: nil},
		metrics,
		newClient,
	)
}

type Client struct {
	baseURL string
	http    *http.Client
}

func newClient(cfg connector.ClusterConfig) (connector.Connector, error) {
	return &Client{
		baseURL: fmt.Sprintf("http://%s:%d", cfg.Host, cfg.Port),
		http:    &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (c *Client) Type() connector.Type { return connector.TypeFlink }

func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.getJSON(ctx, "/overview", &struct{}{})
	return err
}

func (c *Client) ListMetrics(ctx context.Context) ([]connector.MetricSpec, error) {
	return metrics, nil
}

type jobsResponse struct {
	Jobs []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	} `json:"jobs"`
}

type jobOverview struct {
	Jobs []struct {
		ID     string `json:"jid"`
		State  string `json:"state"`
		Uptime int64  `json:"duration"` // ms
	} `json:"jobs"`
}

type checkpointsResponse struct {
	Counts struct {
		Total    int `json:"total"`
		Failed   int `json:"failed"`
		Complete int `json:"completed"`
	} `json:"counts"`
}

type taskManagersResponse struct {
	TaskManagers []struct {
		ID string `json:"id"`
	} `json:"taskmanagers"`
}

func (c *Client) RunMetric(ctx context.Context, metricKey string) (connector.MetricValue, error) {
	switch metricKey {
	case metricRunningJobs:
		var jobs jobsResponse
		if _, err := c.getJSON(ctx, "/jobs", &jobs); err != nil {
			return connector.MetricValue{}, err
		}
		count := 0
		for _, j := range jobs.Jobs {
			if j.Status == "RUNNING" {
				count++
			}
		}
		return connector.MetricValue{Value: float64(count), Unit: "jobs"}, nil

	case metricAvgUptime:
		var overview jobOverview
		if _, err := c.getJSON(ctx, "/jobs/overview", &overview); err != nil {
			return connector.MetricValue{}, err
		}
		var total float64
		var n int
		for _, j := range overview.Jobs {
			if j.State == "RUNNING" {
				total += float64(j.Uptime) / 1000 / 60
				n++
			}
		}
		if n == 0 {
			return connector.MetricValue{Value: 0, Unit: "min"}, nil
		}
		return connector.MetricValue{Value: total / float64(n), Unit: "min"}, nil

	case metricCheckpointFailRate:
		var jobs jobsResponse
		if _, err := c.getJSON(ctx, "/jobs", &jobs); err != nil {
			return connector.MetricValue{}, err
		}
		var totalCP, failedCP int
		for _, j := range jobs.Jobs {
			if j.Status != "RUNNING" {
				continue
			}
			var cp checkpointsResponse
			if _, err := c.getJSON(ctx, fmt.Sprintf("/jobs/%s/checkpoints", j.ID), &cp); err != nil {
				continue // best-effort across jobs
			}
			totalCP += cp.Counts.Total
			failedCP += cp.Counts.Failed
		}
		if totalCP == 0 {
			return connector.MetricValue{Value: 0, Unit: "%"}, nil
		}
		return connector.MetricValue{Value: float64(failedCP) / float64(totalCP) * 100, Unit: "%"}, nil

	case metricTaskManagerCount:
		var tms taskManagersResponse
		if _, err := c.getJSON(ctx, "/taskmanagers", &tms); err != nil {
			return connector.MetricValue{}, err
		}
		return connector.MetricValue{Value: float64(len(tms.TaskManagers)), Unit: "nodes"}, nil

	default:
		return connector.MetricValue{}, fmt.Errorf("unknown metric key: %s", metricKey)
	}
}

func (c *Client) getJSON(ctx context.Context, path string, out any) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return resp, fmt.Errorf("flink API %s returned status %d", path, resp.StatusCode)
	}
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return resp, err
		}
	}
	return resp, nil
}

func (c *Client) Close() error { return nil }
