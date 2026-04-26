package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	chclient "github.com/torres/ch-analyser/internal/clickhouse"
	"github.com/torres/ch-analyser/internal/config"
)

type QueryHandler struct {
	cfg *config.Config
}

func NewQueryHandler(cfg *config.Config) *QueryHandler {
	return &QueryHandler{cfg: cfg}
}

func (h *QueryHandler) findCluster(id string) *config.Cluster {
	for i, cl := range h.cfg.Clusters {
		if cl.ID == id {
			return &h.cfg.Clusters[i]
		}
	}
	return nil
}

func (h *QueryHandler) getClient(c *gin.Context) (*chclient.Client, *config.Cluster, bool) {
	id := c.Param("id")
	cl := h.findCluster(id)
	if cl == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found: " + id})
		return nil, nil, false
	}
	client, err := chclient.NewClient(cl)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "cannot connect to cluster: " + err.Error()})
		return nil, nil, false
	}
	return client, cl, true
}

func intParam(c *gin.Context, key string, def int) int {
	if v := c.Query(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// GET /api/clusters/:id/slow-queries
func (h *QueryHandler) SlowQueries(c *gin.Context) {
	client, _, ok := h.getClient(c)
	if !ok {
		return
	}
	defer client.Close()

	durationMs := intParam(c, "duration_ms", 5000)
	hours := intParam(c, "hours", 24)
	limit := intParam(c, "limit", 50)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	results, err := client.GetSlowQueries(ctx, durationMs, hours, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if results == nil {
		results = []chclient.SlowQuery{}
	}
	c.JSON(http.StatusOK, gin.H{
		"queries":     results,
		"total":       len(results),
		"duration_ms": durationMs,
		"hours":       hours,
	})
}

// GET /api/clusters/:id/full-scans
func (h *QueryHandler) FullScans(c *gin.Context) {
	client, _, ok := h.getClient(c)
	if !ok {
		return
	}
	defer client.Close()

	hours := intParam(c, "hours", 24)
	limit := intParam(c, "limit", 20)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	results, err := client.GetFullScans(ctx, hours, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if results == nil {
		results = []chclient.FullScanQuery{}
	}
	c.JSON(http.StatusOK, gin.H{"queries": results, "total": len(results)})
}

// GET /api/clusters/:id/memory-hogs
func (h *QueryHandler) MemoryHogs(c *gin.Context) {
	client, _, ok := h.getClient(c)
	if !ok {
		return
	}
	defer client.Close()

	hours := intParam(c, "hours", 24)
	limit := intParam(c, "limit", 20)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	results, err := client.GetMemoryHogs(ctx, hours, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if results == nil {
		results = []chclient.MemoryHogQuery{}
	}
	c.JSON(http.StatusOK, gin.H{"queries": results, "total": len(results)})
}

// GET /api/clusters/:id/stats
func (h *QueryHandler) Stats(c *gin.Context) {
	client, cl, ok := h.getClient(c)
	if !ok {
		return
	}
	defer client.Close()

	hours := intParam(c, "hours", 24)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	stats, err := client.GetQueryStats(ctx, hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	stats["cluster_id"] = cl.ID
	stats["cluster_name"] = cl.Name
	stats["hours"] = hours
	c.JSON(http.StatusOK, stats)
}

// POST /api/clusters/:id/explain
func (h *QueryHandler) ExplainQuery(c *gin.Context) {
	client, _, ok := h.getClient(c)
	if !ok {
		return
	}
	defer client.Close()

	var body struct {
		Query string `json:"query" binding:"required"`
		Mode  string `json:"mode"` // plan | indexes | pipeline
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	lines, err := client.ExplainQuery(ctx, body.Query, body.Mode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"lines": lines,
		"mode":  body.Mode,
		"query": body.Query,
	})
}

// POST /api/clusters/:id/query
func (h *QueryHandler) RunQuery(c *gin.Context) {
	client, _, ok := h.getClient(c)
	if !ok {
		return
	}
	defer client.Close()

	var body struct {
		Query string `json:"query" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	rows, cols, err := client.RunQuery(ctx, body.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == nil {
		rows = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{
		"rows":    rows,
		"columns": cols,
		"total":   len(rows),
	})
}
