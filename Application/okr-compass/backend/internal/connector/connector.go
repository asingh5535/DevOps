// Package connector defines the plugin interface every supported system
// (ClickHouse, Doris, Dragonfly, Redis, Kubernetes, Flink, MySQL) implements,
// plus a registry so the API/scheduler can build a client from a stored
// cluster record without knowing the concrete type.
package connector

import (
	"context"
	"time"
)

type Type string

const (
	TypeClickHouse Type = "clickhouse"
	TypeDoris      Type = "doris"
	TypeDragonfly  Type = "dragonfly"
	TypeRedis      Type = "redis"
	TypeKubernetes Type = "kubernetes"
	TypeFlink      Type = "flink"
	TypeMySQL      Type = "mysql"
)

// ClusterConfig is the decrypted connection info needed to build a client.
// The API/scheduler build this from a store.Cluster after decrypting credentials
// — the connector package itself never touches storage or encryption.
type ClusterConfig struct {
	Name     string
	Type     Type
	Host     string
	Port     int
	Username string
	Password string // decrypted secret: password, token, or kubeconfig YAML depending on Type
	Extra    map[string]string
}

type MetricSpec struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Unit        string `json:"unit"`
}

type MetricValue struct {
	Value     float64
	Unit      string
	SampledAt time.Time
}

// Connector is the uniform interface every one of the 7 systems implements.
type Connector interface {
	Type() Type
	TestConnection(ctx context.Context) error
	ListMetrics(ctx context.Context) ([]MetricSpec, error)
	RunMetric(ctx context.Context, metricKey string) (MetricValue, error)
	Close() error
}

// Field describes one extra credential/config input the "Add Cluster" UI
// should render for a given connector type, beyond the common host/port/username/password.
type Field struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Required    bool   `json:"required"`
	Secret      bool   `json:"secret"`
	Placeholder string `json:"placeholder"`
}

// TypeInfo describes a connector type for the frontend's dynamic cluster form.
type TypeInfo struct {
	Type            Type    `json:"type"`
	Label           string  `json:"label"`
	DefaultPort     int     `json:"defaultPort"`
	UsesUsername    bool    `json:"usesUsername"`
	PasswordLabel   string  `json:"passwordLabel"`
	Fields          []Field `json:"fields"`
}
