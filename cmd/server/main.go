package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"whatsaly/internal/api"
	"whatsaly/internal/datastore"
	"whatsaly/internal/processmanager"
	"whatsaly/internal/websocket"

	gorillaWs "github.com/gorilla/websocket"
)

const bunBackendPort = processmanager.BunBackendPort

var serverStartTime = time.Now()
var requestCount uint64
var successCount uint64
var errorCount uint64
var latencySum uint64
var latencyCount uint64

var upgrader = gorillaWs.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func main() {
	store := datastore.GetStore()
	hub := websocket.NewHub()
	go hub.Run()

	bunManager := processmanager.NewBunJSManager("server.ts")
	if err := bunManager.Start(); err != nil {
		log.Printf("Warning: Failed to start BunJS process: %v", err)
	}

	waitForBunServer()

	bunBackendURL := "http://127.0.0.1:" + bunBackendPort
	handlers := api.NewHandlers(store, hub, bunBackendURL)

	staticFs := http.FileServer(http.Dir("./public"))
	mux := http.NewServeMux()

	mux.HandleFunc("/ws/stats", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}
		client := websocket.NewClient(hub, conn)
		hub.Register(client)
		go client.WritePump()
		go client.ReadPump()
	})

	mux.HandleFunc("/api/process/status", bunManager.HandleGetStatusHTTP)
	mux.HandleFunc("/api/process/restart", bunManager.HandleRestartHTTP)

	mux.HandleFunc("/api/go/events", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "SSE not supported", http.StatusInternalServerError)
			return
		}

		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		sendEvent := func() {
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			const bytesToMB = 1024 * 1024

			avgLatency := uint64(0)
			if lc := atomic.LoadUint64(&latencyCount); lc > 0 {
				avgLatency = atomic.LoadUint64(&latencySum) / lc
			}

			data := map[string]interface{}{
				"memory": map[string]interface{}{
					"alloc":     m.Alloc / bytesToMB,
					"heapAlloc": m.HeapAlloc / bytesToMB,
					"heapSys":   m.HeapSys / bytesToMB,
					"numGC":     m.NumGC,
				},
				"goroutines": runtime.NumGoroutine(),
				"cpus":       runtime.NumCPU(),
				"goVersion":  runtime.Version(),
				"platform":   runtime.GOOS,
				"arch":       runtime.GOARCH,
				"uptime":     int64(time.Since(serverStartTime).Seconds()),
				"network": map[string]interface{}{
					"requests": atomic.LoadUint64(&requestCount),
					"success":  atomic.LoadUint64(&successCount),
					"errors":   atomic.LoadUint64(&errorCount),
					"latency":  avgLatency,
				},
				"process": map[string]interface{}{
					"status":    string(bunManager.GetStatus()),
					"lastError": bunManager.GetLastError(),
				},
			}

			jsonBytes, _ := json.Marshal(data)
			fmt.Fprintf(w, "data: %s\n\n", jsonBytes)
			flusher.Flush()
		}

		sendEvent()

		for {
			select {
			case <-ticker.C:
				sendEvent()
			case <-r.Context().Done():
				return
			}
		}
	})

	mux.HandleFunc("/api/go/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"server":    "go",
			"bunStatus": string(bunManager.GetStatus()),
			"wsClients": hub.ClientCount(),
		})
	})

	mux.HandleFunc("/api/go/system-stats", func(w http.ResponseWriter, r *http.Request) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		const bytesToMB = 1024 * 1024
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"memory": map[string]interface{}{
				"alloc":     m.Alloc / bytesToMB,
				"heapAlloc": m.HeapAlloc / bytesToMB,
				"heapSys":   m.HeapSys / bytesToMB,
				"numGC":     m.NumGC,
			},
			"goroutines": runtime.NumGoroutine(),
			"cpus":       runtime.NumCPU(),
			"goVersion":  runtime.Version(),
			"platform":   runtime.GOOS,
			"arch":       runtime.GOARCH,
			"uptime":     int64(time.Since(serverStartTime).Seconds()),
		})
	})

	mux.HandleFunc("/api/bun/push/session", handlers.HandleBunPushSession)
	mux.HandleFunc("/api/bun/push/stats", handlers.HandleBunPushStats)

	mux.HandleFunc("/api/sessions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.HandleGetSessions(w, r)
		case http.MethodPost:
			handlers.HandleCreateSession(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/sessions/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, "/settings") {
			switch r.Method {
			case http.MethodGet:
				handlers.HandleGetSettings(w, r)
			case http.MethodPut:
				handlers.HandleUpdateSettings(w, r)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}
		if strings.HasSuffix(path, "/pause") {
			handlers.HandlePauseSession(w, r)
			return
		}
		if strings.HasSuffix(path, "/resume") {
			handlers.HandleResumeSession(w, r)
			return
		}
		switch r.Method {
		case http.MethodGet:
			handlers.HandleGetSession(w, r)
		case http.MethodDelete:
			handlers.HandleDeleteSession(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/stats", handlers.HandleGetStats)
	mux.HandleFunc("/api/stats/full", handlers.HandleGetFullStats)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "server": "go"})
	})

	mux.HandleFunc("/favicon.png", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/favicon.png")
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			http.ServeFile(w, r, "./public/index.html")
			return
		}
		if strings.HasSuffix(path, ".html") {
			http.ServeFile(w, r, "./public"+path)
			return
		}
		filePath := "./public" + path
		if _, err := os.Stat(filePath); err == nil {
			staticFs.ServeHTTP(w, r)
			return
		}
		if !strings.Contains(path, ".") {
			htmlPath := "./public" + path + ".html"
			if _, err := os.Stat(htmlPath); err == nil {
				http.ServeFile(w, r, htmlPath)
				return
			}
		}
		http.ServeFile(w, r, "./public/index.html")
	})

	handler := recoveryMiddleware(loggingMiddleware(corsMiddleware(mux)))

	server := &http.Server{Addr: ":8000", Handler: handler}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-quit
		log.Println("Shutting down server...")
		if err := bunManager.Stop(); err != nil {
			log.Printf("Error stopping BunJS: %v", err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down server: %v", err)
		}
	}()

	log.Println("Go server starting on port 8000")
	log.Println("Frontend: Go serves static files + WebSocket")
	log.Println("Backend: Bun pushes data to Go via HTTP")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}

func waitForBunServer() {
	for i := 0; i < 60; i++ {
		resp, err := http.Get("http://127.0.0.1:" + bunBackendPort + "/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				log.Println("Bun backend ready")
				return
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	log.Println("Warning: Bun backend may not be ready")
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/go/events") || strings.HasPrefix(r.URL.Path, "/ws") {
			next.ServeHTTP(w, r)
			return
		}
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		duration := time.Since(start)
		atomic.AddUint64(&requestCount, 1)
		atomic.AddUint64(&latencySum, uint64(duration.Milliseconds()))
		atomic.AddUint64(&latencyCount, 1)
		if sw.status >= 200 && sw.status < 400 {
			atomic.AddUint64(&successCount, 1)
		} else {
			atomic.AddUint64(&errorCount, 1)
		}
		log.Printf("%s %s %s %d %v", r.RemoteAddr, r.Method, r.URL.Path, sw.status, duration)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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
				log.Printf("Panic: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
