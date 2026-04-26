package main

import (
	"log"
	"os"

	"github.com/torres/ch-analyser/internal/api"
	"github.com/torres/ch-analyser/internal/config"
)

func main() {
	cfg := config.Load()
	router := api.NewRouter(cfg)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[Torres] ClickHouse Query Analyser starting on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
