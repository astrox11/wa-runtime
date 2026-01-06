package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whatsaly/internal/processmanager"

	"github.com/gorilla/websocket"
)

const (
	bunBackendPort = "8001" // Internal port where Bun server runs
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

func main() {
	// Initialize BunJS process manager to run the main server.ts
	bunManager := processmanager.NewBunJSManager("server.ts")
	if err := bunManager.Start(); err != nil {
		log.Printf("Warning: Failed to start BunJS process: %v", err)
	}

	// Wait for Bun server to be ready
	waitForBunServer()

	// Create reverse proxy for Bun backend
	bunBackendURL, _ := url.Parse("http://127.0.0.1:" + bunBackendPort)
	proxy := httputil.NewSingleHostReverseProxy(bunBackendURL)

	// Customize the proxy director to handle errors gracefully
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = bunBackendURL.Host
	}

	// Handle proxy errors
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("Proxy error: %v", err)
		http.Error(w, "Backend unavailable. Bun process may be starting or crashed.", http.StatusBadGateway)
	}

	// Create HTTP mux
	mux := http.NewServeMux()

	// WebSocket proxy for /ws/stats
	mux.HandleFunc("/ws/stats", func(w http.ResponseWriter, r *http.Request) {
		proxyWebSocket(w, r)
	})

	// Process manager routes (handled by Go)
	mux.HandleFunc("/api/process/status", bunManager.HandleGetStatusHTTP)
	mux.HandleFunc("/api/process/restart", bunManager.HandleRestartHTTP)

	// Go server health check
	mux.HandleFunc("/api/go/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","server":"go","bunStatus":"` + string(bunManager.GetStatus()) + `"}`))
	})

	// All other routes - proxy to Bun backend
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})

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

		// Shutdown HTTP server with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down server: %v", err)
		}
	}()

	// Start server
	log.Println("Starting Go proxy server on port 8000...")
	log.Println("Bun backend running on internal port " + bunBackendPort)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// waitForBunServer waits for the Bun server to be ready
func waitForBunServer() {
	maxRetries := 60 // 30 seconds max wait
	for i := 0; i < maxRetries; i++ {
		resp, err := http.Get("http://127.0.0.1:" + bunBackendPort + "/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				log.Println("Bun backend is ready")
				return
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	log.Println("Warning: Bun backend may not be ready, continuing anyway...")
}

// proxyWebSocket handles WebSocket proxying to Bun backend
func proxyWebSocket(w http.ResponseWriter, r *http.Request) {
	// Connect to backend WebSocket
	backendWsURL := "ws://127.0.0.1:" + bunBackendPort + r.URL.Path
	if r.URL.RawQuery != "" {
		backendWsURL += "?" + r.URL.RawQuery
	}

	backendConn, _, err := websocket.DefaultDialer.Dial(backendWsURL, nil)
	if err != nil {
		log.Printf("Failed to connect to backend WebSocket: %v", err)
		http.Error(w, "Failed to connect to backend", http.StatusBadGateway)
		return
	}
	defer backendConn.Close()

	// Upgrade client connection
	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade client WebSocket: %v", err)
		return
	}
	defer clientConn.Close()

	// Bidirectional proxy
	errChan := make(chan error, 2)

	// Client -> Backend
	go func() {
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			if err := backendConn.WriteMessage(messageType, message); err != nil {
				errChan <- err
				return
			}
		}
	}()

	// Backend -> Client
	go func() {
		for {
			messageType, message, err := backendConn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				errChan <- err
				return
			}
		}
	}()

	// Wait for error (connection close)
	<-errChan
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
