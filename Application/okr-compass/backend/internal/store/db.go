package store

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS clusters (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	type TEXT NOT NULL,
	host TEXT NOT NULL,
	port INTEGER NOT NULL,
	username TEXT,
	encrypted_credentials TEXT,
	extra_json TEXT,
	created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS objectives (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT,
	owner TEXT,
	team TEXT,
	quarter TEXT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS key_results (
	id TEXT PRIMARY KEY,
	objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	cluster_id TEXT NOT NULL REFERENCES clusters(id),
	metric_key TEXT NOT NULL,
	comparator TEXT NOT NULL,
	baseline_value REAL NOT NULL,
	target_value REAL NOT NULL,
	current_value REAL NOT NULL DEFAULT 0,
	unit TEXT,
	progress REAL NOT NULL DEFAULT 0,
	last_evaluated_at DATETIME,
	last_error TEXT,
	created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_samples (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	key_result_id TEXT NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
	value REAL NOT NULL,
	sampled_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metric_samples_kr ON metric_samples(key_result_id, sampled_at);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results(objective_id);
`

func Open(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // modernc.org/sqlite: single-writer to avoid SQLITE_BUSY under the scheduler + API traffic
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}
