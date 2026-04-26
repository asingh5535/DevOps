package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	chclient "github.com/torres/ch-analyser/internal/clickhouse"
	"github.com/torres/ch-analyser/internal/config"
)

type ClusterHandler struct {
	cfg *config.Config
}

func NewClusterHandler(cfg *config.Config) *ClusterHandler {
	return &ClusterHandler{cfg: cfg}
}

type ClusterStatus struct {
	config.Cluster
	Status     string      `json:"status"`
	Reachable  bool        `json:"reachable"`
	ServerInfo interface{} `json:"server_info,omitempty"`
	Error      string      `json:"error,omitempty"`
	CheckedAt  time.Time   `json:"checked_at"`
}

func (h *ClusterHandler) ListClusters(c *gin.Context) {
	var statuses []ClusterStatus
	for _, cl := range h.cfg.Clusters {
		statuses = append(statuses, ClusterStatus{
			Cluster:   cl,
			Status:    "unknown",
			Reachable: false,
			CheckedAt: time.Now(),
		})
	}
	c.JSON(http.StatusOK, gin.H{"clusters": statuses, "total": len(statuses)})
}

func (h *ClusterHandler) GetClusterHealth(c *gin.Context) {
	id := c.Param("id")
	cl := h.findCluster(id)
	if cl == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found: " + id})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	client, err := chclient.NewClient(cl)
	if err != nil {
		c.JSON(http.StatusOK, ClusterStatus{
			Cluster:   *cl,
			Status:    "unreachable",
			Reachable: false,
			Error:     err.Error(),
			CheckedAt: time.Now(),
		})
		return
	}
	defer client.Close()

	if err := client.Ping(ctx); err != nil {
		c.JSON(http.StatusOK, ClusterStatus{
			Cluster:   *cl,
			Status:    "unreachable",
			Reachable: false,
			Error:     err.Error(),
			CheckedAt: time.Now(),
		})
		return
	}

	info, err := client.GetServerInfo(ctx)
	status := ClusterStatus{
		Cluster:   *cl,
		Status:    "active",
		Reachable: true,
		CheckedAt: time.Now(),
	}
	if err == nil {
		status.ServerInfo = info
	}

	c.JSON(http.StatusOK, status)
}

func (h *ClusterHandler) AddCluster(c *gin.Context) {
	var cl config.Cluster
	if err := c.ShouldBindJSON(&cl); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if cl.Port == 0 {
		cl.Port = 9000
	}
	if cl.Database == "" {
		cl.Database = "default"
	}
	h.cfg.Clusters = append(h.cfg.Clusters, cl)
	c.JSON(http.StatusCreated, gin.H{"cluster": cl, "message": "cluster added"})
}

func (h *ClusterHandler) DeleteCluster(c *gin.Context) {
	id := c.Param("id")
	for i, cl := range h.cfg.Clusters {
		if cl.ID == id {
			h.cfg.Clusters = append(h.cfg.Clusters[:i], h.cfg.Clusters[i+1:]...)
			c.JSON(http.StatusOK, gin.H{"message": "cluster removed"})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found"})
}

func (h *ClusterHandler) findCluster(id string) *config.Cluster {
	for i, cl := range h.cfg.Clusters {
		if cl.ID == id {
			return &h.cfg.Clusters[i]
		}
	}
	return nil
}
