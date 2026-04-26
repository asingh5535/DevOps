package api

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/torres/ch-analyser/internal/api/handlers"
	"github.com/torres/ch-analyser/internal/config"
)

func NewRouter(cfg *config.Config) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "torres-ch-analyser",
			"status":  "ok",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	clusterH := handlers.NewClusterHandler(cfg)
	queryH := handlers.NewQueryHandler(cfg)
	reportH := handlers.NewReportHandler(cfg)

	api := r.Group("/api")
	{
		// Clusters
		api.GET("/clusters", clusterH.ListClusters)
		api.POST("/clusters", clusterH.AddCluster)
		api.DELETE("/clusters/:id", clusterH.DeleteCluster)
		api.GET("/clusters/:id/health", clusterH.GetClusterHealth)

		// Queries per cluster
		api.GET("/clusters/:id/slow-queries", queryH.SlowQueries)
		api.GET("/clusters/:id/full-scans", queryH.FullScans)
		api.GET("/clusters/:id/memory-hogs", queryH.MemoryHogs)
		api.GET("/clusters/:id/stats", queryH.Stats)
		api.POST("/clusters/:id/explain", queryH.ExplainQuery)
		api.POST("/clusters/:id/query", queryH.RunQuery)

		// Reports
		api.GET("/reports/daily", reportH.DailyDigest)
		api.GET("/reports/schedule", reportH.Schedule)

		// Optimization
		api.GET("/optimization/patterns", reportH.OptimizationPatterns)
		api.GET("/optimization/checklist", reportH.OptimizationChecklist)
	}

	return r
}
