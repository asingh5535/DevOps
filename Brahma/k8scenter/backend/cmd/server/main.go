package main

import (
	"log"
	"os"

	"github.com/kubevision/backend/internal/api"
	"github.com/kubevision/backend/internal/config"
)

func main() {
	cfg := config.Load()

	log.Printf("Starting KubeVision API Server on :%s", cfg.Port)
	log.Printf("Environment: %s", cfg.Env)

	router := api.NewRouter(cfg)

	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
		os.Exit(1)
	}
}
