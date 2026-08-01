package store

import "time"

type Cluster struct {
	ID                    string    `json:"id"`
	Name                  string    `json:"name"`
	Type                  string    `json:"type"`
	Host                  string    `json:"host"`
	Port                  int       `json:"port"`
	Username              string    `json:"username"`
	EncryptedCredentials  string    `json:"-"`
	ExtraJSON             string    `json:"-"`
	Extra                 map[string]string `json:"extra"`
	CreatedAt             time.Time `json:"createdAt"`
}

type Objective struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Owner       string    `json:"owner"`
	Team        string    `json:"team"`
	Quarter     string    `json:"quarter"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	KeyResults  []KeyResult `json:"keyResults,omitempty"`
}

type KeyResult struct {
	ID              string     `json:"id"`
	ObjectiveID     string     `json:"objectiveId"`
	Title           string     `json:"title"`
	ClusterID       string     `json:"clusterId"`
	ClusterName     string     `json:"clusterName,omitempty"`
	ConnectorType   string     `json:"connectorType,omitempty"`
	MetricKey       string     `json:"metricKey"`
	Comparator      string     `json:"comparator"`
	BaselineValue   float64    `json:"baselineValue"`
	TargetValue     float64    `json:"targetValue"`
	CurrentValue    float64    `json:"currentValue"`
	Unit            string     `json:"unit"`
	Progress        float64    `json:"progress"`
	LastEvaluatedAt *time.Time `json:"lastEvaluatedAt,omitempty"`
	LastError       string     `json:"lastError,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
}

type MetricSample struct {
	ID          int64     `json:"id"`
	KeyResultID string    `json:"keyResultId"`
	Value       float64   `json:"value"`
	SampledAt   time.Time `json:"sampledAt"`
}
