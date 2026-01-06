package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whatsaly/internal/api"
	"whatsaly/internal/processmanager"
	"whatsaly/internal/websocket"
)

func main() {
	// Create and run WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Initialize BunJS process manager
	bunManager := processmanager.NewBunJSManager("js_runtime/whatsapp_client.js")
	if err := bunManager.Start(); err != nil {
		log.Printf("Warning: Failed to start BunJS process: %v", err)
	}

	// Create HTTP mux
	mux := http.NewServeMux()

	// WebSocket route
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.HandleWebSocket(hub, w, r)
	})

	// API routes
	mux.HandleFunc("/api/login", api.HandleLoginHTTP)
	mux.HandleFunc("/api/users", api.HandleUsersHTTP)
	mux.HandleFunc("/api/messages", api.HandleMessagesHTTP)

	// Process manager routes
	mux.HandleFunc("/api/process/status", bunManager.HandleGetStatusHTTP)
	mux.HandleFunc("/api/process/restart", bunManager.HandleRestartHTTP)

	// Static file serving
	fs := http.FileServer(http.Dir("./public"))
	mux.Handle("/", fs)

	// Create middleware chain
	handler := recoveryMiddleware(loggingMiddleware(corsMiddleware(mux)))

	// Create HTTP server
	server := &http.Server{
		Addr:    ":8000",
		Handler: handler,
	}

	// Graceful shutdown handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-quit
		log.Println("Shutting down server...")

		// Stop BunJS process
		if err := bunManager.Stop(); err != nil {
			log.Printf("Error stopping BunJS process: %v", err)
		}

		// Shutdown WebSocket hub
		hub.Shutdown()

		// Shutdown HTTP server with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down server: %v", err)
		}
	}()

	// Start server
	log.Println("Starting server on port 8000...")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// Middleware functions
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s | %s | %s | %v", r.RemoteAddr, r.Method, r.URL.Path, time.Since(start))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic recovered: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
