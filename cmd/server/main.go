package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
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
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s %v", r.RemoteAddr, r.Method, r.URL.Path, time.Since(start))
	})
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
