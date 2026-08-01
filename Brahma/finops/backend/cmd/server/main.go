package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/finops/backend/internal/handlers"
	"github.com/finops/backend/internal/k8s"
)

func main() {
	clients, err := k8s.NewClients()
	if err != nil {
		log.Fatalf("failed to create k8s clients: %v", err)
	}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.GET("/namespaces", handlers.GetNamespaces(clients))
		api.GET("/pods", handlers.GetPods(clients))
		api.GET("/costs", handlers.GetCostSummary(clients))
		api.GET("/compliance", handlers.GetCompliance(clients))
		api.GET("/quotas", handlers.GetQuotas(clients))

		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("FinOps backend listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
