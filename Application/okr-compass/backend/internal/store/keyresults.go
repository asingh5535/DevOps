package store

import (
	"database/sql"
	"time"
)

func (s *Store) CreateKeyResult(kr *KeyResult) error {
	kr.CreatedAt = time.Now().UTC()
	_, err := s.db.Exec(
		`INSERT INTO key_results (id, objective_id, title, cluster_id, metric_key, comparator, baseline_value, target_value, current_value, unit, progress, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?)`,
		kr.ID, kr.ObjectiveID, kr.Title, kr.ClusterID, kr.MetricKey, kr.Comparator, kr.BaselineValue, kr.TargetValue, kr.Unit, kr.CreatedAt,
	)
	return err
}

const keyResultColumns = `kr.id, kr.objective_id, kr.title, kr.cluster_id, kr.metric_key, kr.comparator, kr.baseline_value, kr.target_value,
	kr.current_value, kr.unit, kr.progress, kr.last_evaluated_at, kr.last_error, kr.created_at, c.name, c.type`

func (s *Store) ListKeyResultsByObjective(objectiveID string) ([]KeyResult, error) {
	rows, err := s.db.Query(
		`SELECT `+keyResultColumns+` FROM key_results kr JOIN clusters c ON c.id = kr.cluster_id WHERE kr.objective_id = ? ORDER BY kr.created_at ASC`,
		objectiveID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanKeyResults(rows)
}

func (s *Store) ListAllKeyResults() ([]KeyResult, error) {
	rows, err := s.db.Query(`SELECT ` + keyResultColumns + ` FROM key_results kr JOIN clusters c ON c.id = kr.cluster_id ORDER BY kr.created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanKeyResults(rows)
}

func (s *Store) GetKeyResult(id string) (*KeyResult, error) {
	row := s.db.QueryRow(`SELECT `+keyResultColumns+` FROM key_results kr JOIN clusters c ON c.id = kr.cluster_id WHERE kr.id = ?`, id)
	kr, err := scanKeyResult(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &kr, nil
}

func (s *Store) DeleteKeyResult(id string) error {
	_, err := s.db.Exec(`DELETE FROM key_results WHERE id = ?`, id)
	return err
}

// UpdateKeyResultEvaluation persists a fresh reading from the scheduler/manual evaluate endpoint.
func (s *Store) UpdateKeyResultEvaluation(id string, currentValue, progress float64, evaluatedAt time.Time, evalErr string) error {
	_, err := s.db.Exec(
		`UPDATE key_results SET current_value = ?, progress = ?, last_evaluated_at = ?, last_error = ? WHERE id = ?`,
		currentValue, progress, evaluatedAt, evalErr, id,
	)
	return err
}

func (s *Store) InsertMetricSample(keyResultID string, value float64, sampledAt time.Time) error {
	_, err := s.db.Exec(`INSERT INTO metric_samples (key_result_id, value, sampled_at) VALUES (?, ?, ?)`, keyResultID, value, sampledAt)
	return err
}

func (s *Store) ListMetricSamples(keyResultID string, limit int) ([]MetricSample, error) {
	if limit <= 0 {
		limit = 200
	}
	rows, err := s.db.Query(
		`SELECT id, key_result_id, value, sampled_at FROM metric_samples WHERE key_result_id = ? ORDER BY sampled_at DESC LIMIT ?`,
		keyResultID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []MetricSample
	for rows.Next() {
		var m MetricSample
		if err := rows.Scan(&m.ID, &m.KeyResultID, &m.Value, &m.SampledAt); err != nil {
			return nil, err
		}
		samples = append(samples, m)
	}
	return samples, rows.Err()
}

func scanKeyResults(rows *sql.Rows) ([]KeyResult, error) {
	var results []KeyResult
	for rows.Next() {
		kr, err := scanKeyResult(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, kr)
	}
	return results, rows.Err()
}

func scanKeyResult(row rowScanner) (KeyResult, error) {
	var kr KeyResult
	var lastEvaluatedAt sql.NullTime
	var lastError sql.NullString
	err := row.Scan(
		&kr.ID, &kr.ObjectiveID, &kr.Title, &kr.ClusterID, &kr.MetricKey, &kr.Comparator,
		&kr.BaselineValue, &kr.TargetValue, &kr.CurrentValue, &kr.Unit, &kr.Progress,
		&lastEvaluatedAt, &lastError, &kr.CreatedAt, &kr.ClusterName, &kr.ConnectorType,
	)
	if err != nil {
		return KeyResult{}, err
	}
	if lastEvaluatedAt.Valid {
		kr.LastEvaluatedAt = &lastEvaluatedAt.Time
	}
	kr.LastError = lastError.String
	return kr, nil
}
