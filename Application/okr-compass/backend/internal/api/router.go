package api

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/okr-compass/backend/internal/api/handlers"
	"github.com/okr-compass/backend/internal/config"
	"github.com/okr-compass/backend/internal/crypto"
	"github.com/okr-compass/backend/internal/middleware"
	"github.com/okr-compass/backend/internal/scheduler"
	"github.com/okr-compass/backend/internal/store"
)

func NewRouter(cfg *config.Config, st *store.Store, box *crypto.Box, evaluator *scheduler.Evaluator) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "okr-compass-backend"})
	})

	authHandler := handlers.NewAuthHandler(cfg.AdminUser, cfg.AdminPassword, cfg.JWTSecret)
	clusterHandler := handlers.NewClusterHandler(st, box)
	connectorHandler := handlers.NewConnectorHandler()
	objectiveHandler := handlers.NewObjectiveHandler(st)
	keyResultHandler := handlers.NewKeyResultHandler(st, evaluator)
	dashboardHandler := handlers.NewDashboardHandler(st)

	api := router.Group("/api")
	{
		api.POST("/auth/login", authHandler.Login)

		protected := api.Group("")
		protected.Use(middleware.RequireAuth(cfg.JWTSecret))
		{
			protected.GET("/connectors/types", connectorHandler.ListTypes)
			protected.GET("/connectors/:type/metrics", connectorHandler.ListMetrics)

			protected.GET("/clusters", clusterHandler.List)
			protected.POST("/clusters", clusterHandler.Create)
			protected.DELETE("/clusters/:id", clusterHandler.Delete)
			protected.POST("/clusters/:id/test", clusterHandler.TestConnection)

			protected.GET("/objectives", objectiveHandler.List)
			protected.POST("/objectives", objectiveHandler.Create)
			protected.GET("/objectives/:id", objectiveHandler.Get)
			protected.PATCH("/objectives/:id", objectiveHandler.Update)
			protected.DELETE("/objectives/:id", objectiveHandler.Delete)
			protected.POST("/objectives/:id/key-results", keyResultHandler.Create)

			protected.DELETE("/key-results/:id", keyResultHandler.Delete)
			protected.POST("/key-results/:id/evaluate", keyResultHandler.Evaluate)
			protected.GET("/key-results/:id/history", keyResultHandler.History)

			protected.GET("/dashboard/summary", dashboardHandler.Summary)
		}
	}

	return router
}
