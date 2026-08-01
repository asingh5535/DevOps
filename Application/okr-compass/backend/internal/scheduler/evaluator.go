// Package scheduler periodically re-evaluates every Key Result by calling
// its bound connector's RunMetric, recording a history sample, and
// recomputing progress toward the target. The same EvaluateOne path backs
// both the background ticker and the manual "evaluate now" API endpoint.
package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/okr-compass/backend/internal/connector"
	"github.com/okr-compass/backend/internal/crypto"
	"github.com/okr-compass/backend/internal/store"
)

type Evaluator struct {
	store    *store.Store
	box      *crypto.Box
	interval time.Duration
}

func New(st *store.Store, box *crypto.Box, intervalMinutes int) *Evaluator {
	return &Evaluator{store: st, box: box, interval: time.Duration(intervalMinutes) * time.Minute}
}

// Run blocks, evaluating all key results immediately and then on every tick,
// until ctx is cancelled. Intended to be launched with `go evaluator.Run(ctx)`.
func (e *Evaluator) Run(ctx context.Context) {
	e.evaluateAll(ctx)

	ticker := time.NewTicker(e.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.evaluateAll(ctx)
		}
	}
}

func (e *Evaluator) evaluateAll(ctx context.Context) {
	keyResults, err := e.store.ListAllKeyResults()
	if err != nil {
		log.Printf("scheduler: list key results: %v", err)
		return
	}
	for i := range keyResults {
		if err := e.EvaluateOne(ctx, &keyResults[i]); err != nil {
			log.Printf("scheduler: evaluate key result %s: %v", keyResults[i].ID, err)
		}
	}
}

// EvaluateOne fetches the KR's cluster, decrypts its credentials, builds a
// connector, runs the bound metric, and persists the reading + progress.
// Connector/credential errors are recorded on the KR (LastError) rather than
// silently dropped, so the UI can surface a broken cluster.
func (e *Evaluator) EvaluateOne(ctx context.Context, kr *store.KeyResult) error {
	cluster, err := e.store.GetCluster(kr.ClusterID)
	if err != nil {
		return fmt.Errorf("load cluster: %w", err)
	}
	if cluster == nil {
		recordErr := "bound cluster no longer exists"
		_ = e.store.UpdateKeyResultEvaluation(kr.ID, kr.CurrentValue, kr.Progress, time.Now().UTC(), recordErr)
		return fmt.Errorf(recordErr)
	}

	password, err := e.box.Decrypt(cluster.EncryptedCredentials)
	if err != nil {
		return fmt.Errorf("decrypt credentials: %w", err)
	}

	conn, err := connector.Build(connector.ClusterConfig{
		Name:     cluster.Name,
		Type:     connector.Type(cluster.Type),
		Host:     cluster.Host,
		Port:     cluster.Port,
		Username: cluster.Username,
		Password: password,
		Extra:    cluster.Extra,
	})
	if err != nil {
		_ = e.store.UpdateKeyResultEvaluation(kr.ID, kr.CurrentValue, kr.Progress, time.Now().UTC(), err.Error())
		return err
	}
	defer conn.Close()

	runCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	metricValue, err := conn.RunMetric(runCtx, kr.MetricKey)
	now := time.Now().UTC()
	if err != nil {
		_ = e.store.UpdateKeyResultEvaluation(kr.ID, kr.CurrentValue, kr.Progress, now, err.Error())
		return err
	}

	progress := computeProgress(kr.Comparator, kr.BaselineValue, kr.TargetValue, metricValue.Value)
	if err := e.store.UpdateKeyResultEvaluation(kr.ID, metricValue.Value, progress, now, ""); err != nil {
		return fmt.Errorf("persist evaluation: %w", err)
	}
	return e.store.InsertMetricSample(kr.ID, metricValue.Value, now)
}

// computeProgress maps the current reading onto [0, 100] between baseline and target.
// "lt"/"lte" comparators mean lower is better (e.g. latency); "gt"/"gte" mean higher is better (e.g. hit rate).
func computeProgress(comparator string, baseline, target, current float64) float64 {
	var raw float64
	switch comparator {
	case "lt", "lte":
		if baseline == target {
			raw = 100
		} else {
			raw = (baseline - current) / (baseline - target) * 100
		}
	default: // "gt", "gte"
		if target == baseline {
			raw = 100
		} else {
			raw = (current - baseline) / (target - baseline) * 100
		}
	}
	if raw < 0 {
		return 0
	}
	if raw > 100 {
		return 100
	}
	return raw
}
