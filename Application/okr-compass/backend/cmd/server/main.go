package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/okr-compass/backend/internal/api"
	"github.com/okr-compass/backend/internal/config"
	"github.com/okr-compass/backend/internal/crypto"
	"github.com/okr-compass/backend/internal/scheduler"
	"github.com/okr-compass/backend/internal/store"

	// Blank-imported so each connector's init() registers itself with the
	// connector registry — this is the entire wiring needed to add a new system.
	_ "github.com/okr-compass/backend/internal/connector/clickhouse"
	_ "github.com/okr-compass/backend/internal/connector/doris"
	_ "github.com/okr-compass/backend/internal/connector/flink"
	_ "github.com/okr-compass/backend/internal/connector/kubernetes"
	_ "github.com/okr-compass/backend/internal/connector/mysql"
	_ "github.com/okr-compass/backend/internal/connector/redisfamily"
)

func main() {
	cfg := config.Load()

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	box, err := crypto.New(cfg.EncryptionKey)
	if err != nil {
		log.Fatalf("init encryption: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	evaluator := scheduler.New(st, box, cfg.EvalIntervalMinutes)
	go evaluator.Run(ctx)

	router := api.NewRouter(cfg, st, box, evaluator)

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		<-ctx.Done()
		log.Println("shutting down...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	log.Printf("okr-compass backend listening on :%s (eval interval: %dm)", cfg.Port, cfg.EvalIntervalMinutes)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
