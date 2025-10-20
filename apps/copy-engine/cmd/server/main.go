package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hyperdash/copy-engine/internal/config"
	"github.com/hyperdash/copy-engine/internal/engine"
	"github.com/hyperdash/copy-engine/internal/exchange"
	"github.com/hyperdash/copy-engine/internal/risk"
	"github.com/hyperdash/copy-engine/internal/server"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}

	// Initialize configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize dependencies
	exchangeAdapter := exchange.NewHyperliquidAdapter(cfg.Hyperliquid)
	riskManager := risk.NewManager(cfg.Risk)
	copyEngine := engine.NewEngine(cfg.Engine, exchangeAdapter, riskManager)

	// Start the engine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := copyEngine.Start(ctx); err != nil {
		log.Fatalf("Failed to start copy engine: %v", err)
	}

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	router := server.SetupRouter(copyEngine)

	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("🚀 Copy Trading Engine server running on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create a deadline for shutdown
	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Stop the engine
	if err := copyEngine.Stop(ctx); err != nil {
		log.Printf("Error stopping copy engine: %v", err)
	}

	log.Println("Server exited")
}
