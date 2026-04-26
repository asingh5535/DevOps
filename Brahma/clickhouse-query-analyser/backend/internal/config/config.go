package config

import (
	"encoding/json"
	"log"
	"os"
)

type ClusterType string

const (
	ClusterTypeK8s        ClusterType = "kubernetes"
	ClusterTypeStandalone ClusterType = "standalone"
)

type Cluster struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Type         ClusterType `json:"type"`
	Host         string      `json:"host"`
	Port         int         `json:"port"`
	User         string      `json:"user"`
	Password     string      `json:"password"`
	Database     string      `json:"database"`
	K8sNamespace string      `json:"k8s_namespace,omitempty"`
	K8sService   string      `json:"k8s_service,omitempty"`
	Description  string      `json:"description,omitempty"`
}

type Config struct {
	Clusters []Cluster `json:"clusters"`
}

func Load() *Config {
	// Try to load from file first
	if data, err := os.ReadFile("clusters.json"); err == nil {
		var cfg Config
		if err := json.Unmarshal(data, &cfg); err == nil {
			log.Printf("[config] Loaded %d clusters from clusters.json", len(cfg.Clusters))
			return &cfg
		}
	}

	// Default cluster definitions matching the spec
	return &Config{
		Clusters: []Cluster{
			{
				ID:           "k8s-prod",
				Name:         "k8s-prod",
				Type:         ClusterTypeK8s,
				Host:         "clickhouse.k8scenter.svc.cluster.local",
				Port:         9000,
				User:         "default",
				Password:     "",
				Database:     "default",
				K8sNamespace: "k8scenter",
				K8sService:   "clickhouse",
				Description:  "Production K8s cluster — k8scenter managed",
			},
			{
				ID:           "k8s-analytics",
				Name:         "k8s-analytics",
				Type:         ClusterTypeK8s,
				Host:         "clickhouse-analytics.k8scenter.svc.cluster.local",
				Port:         9000,
				User:         "default",
				Password:     "",
				Database:     "default",
				K8sNamespace: "k8scenter",
				K8sService:   "clickhouse-analytics",
				Description:  "Analytics K8s cluster — k8scenter managed",
			},
			{
				ID:           "k8s-staging",
				Name:         "k8s-staging",
				Type:         ClusterTypeK8s,
				Host:         "clickhouse-staging.k8scenter.svc.cluster.local",
				Port:         9000,
				User:         "default",
				Password:     "",
				Database:     "default",
				K8sNamespace: "k8scenter",
				K8sService:   "clickhouse-staging",
				Description:  "Staging K8s cluster — Degraded",
			},
			{
				ID:          "standalone-01",
				Name:        "standalone-01",
				Type:        ClusterTypeStandalone,
				Host:        "standalone-01.torres.internal",
				Port:        9000,
				User:        "default",
				Password:    "",
				Database:    "default",
				Description: "Bare metal / VM — Direct host",
			},
			{
				ID:          "standalone-02",
				Name:        "standalone-02",
				Type:        ClusterTypeStandalone,
				Host:        "standalone-02.torres.internal",
				Port:        9000,
				User:        "default",
				Password:    "",
				Database:    "default",
				Description: "Bare metal / VM — Direct host",
			},
		},
	}
}
