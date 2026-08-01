package store

import (
	"database/sql"
	"encoding/json"
	"time"
)

func (s *Store) CreateCluster(c *Cluster) error {
	extraJSON, err := json.Marshal(c.Extra)
	if err != nil {
		return err
	}
	c.ExtraJSON = string(extraJSON)
	c.CreatedAt = time.Now().UTC()
	_, err = s.db.Exec(
		`INSERT INTO clusters (id, name, type, host, port, username, encrypted_credentials, extra_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Name, c.Type, c.Host, c.Port, c.Username, c.EncryptedCredentials, c.ExtraJSON, c.CreatedAt,
	)
	return err
}

func (s *Store) ListClusters() ([]Cluster, error) {
	rows, err := s.db.Query(`SELECT id, name, type, host, port, username, encrypted_credentials, extra_json, created_at FROM clusters ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clusters []Cluster
	for rows.Next() {
		c, err := scanCluster(rows)
		if err != nil {
			return nil, err
		}
		clusters = append(clusters, c)
	}
	return clusters, rows.Err()
}

func (s *Store) GetCluster(id string) (*Cluster, error) {
	row := s.db.QueryRow(`SELECT id, name, type, host, port, username, encrypted_credentials, extra_json, created_at FROM clusters WHERE id = ?`, id)
	c, err := scanCluster(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) DeleteCluster(id string) error {
	_, err := s.db.Exec(`DELETE FROM clusters WHERE id = ?`, id)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanCluster(row rowScanner) (Cluster, error) {
	var c Cluster
	if err := row.Scan(&c.ID, &c.Name, &c.Type, &c.Host, &c.Port, &c.Username, &c.EncryptedCredentials, &c.ExtraJSON, &c.CreatedAt); err != nil {
		return Cluster{}, err
	}
	if c.ExtraJSON != "" {
		_ = json.Unmarshal([]byte(c.ExtraJSON), &c.Extra)
	}
	return c, nil
}
