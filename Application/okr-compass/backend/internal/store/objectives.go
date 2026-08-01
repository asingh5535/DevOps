package store

import (
	"database/sql"
	"time"
)

func (s *Store) CreateObjective(o *Objective) error {
	now := time.Now().UTC()
	o.CreatedAt, o.UpdatedAt = now, now
	_, err := s.db.Exec(
		`INSERT INTO objectives (id, title, description, owner, team, quarter, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		o.ID, o.Title, o.Description, o.Owner, o.Team, o.Quarter, o.CreatedAt, o.UpdatedAt,
	)
	return err
}

func (s *Store) ListObjectives() ([]Objective, error) {
	rows, err := s.db.Query(`SELECT id, title, description, owner, team, quarter, created_at, updated_at FROM objectives ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var objectives []Objective
	for rows.Next() {
		var o Objective
		if err := rows.Scan(&o.ID, &o.Title, &o.Description, &o.Owner, &o.Team, &o.Quarter, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		objectives = append(objectives, o)
	}
	return objectives, rows.Err()
}

func (s *Store) GetObjective(id string) (*Objective, error) {
	row := s.db.QueryRow(`SELECT id, title, description, owner, team, quarter, created_at, updated_at FROM objectives WHERE id = ?`, id)
	var o Objective
	err := row.Scan(&o.ID, &o.Title, &o.Description, &o.Owner, &o.Team, &o.Quarter, &o.CreatedAt, &o.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *Store) UpdateObjective(o *Objective) error {
	o.UpdatedAt = time.Now().UTC()
	_, err := s.db.Exec(
		`UPDATE objectives SET title = ?, description = ?, owner = ?, team = ?, quarter = ?, updated_at = ? WHERE id = ?`,
		o.Title, o.Description, o.Owner, o.Team, o.Quarter, o.UpdatedAt, o.ID,
	)
	return err
}

func (s *Store) DeleteObjective(id string) error {
	_, err := s.db.Exec(`DELETE FROM objectives WHERE id = ?`, id)
	return err
}
