package main

import (
	"api/database"
	"api/manager"
	"api/routes"
	"log"
	"os"
	"runtime/debug"

	"bufio"
	"bytes"
	"strings"

	"github.com/gofiber/fiber/v2"
)

const (
	// memoryLimitBytes sets a 1GB soft memory limit for the GC
	// This prevents aggressive GC under memory pressure while allowing
	// the application to use system memory efficiently
	memoryLimitBytes = 1024 * 1024 * 1024 // 1 GB
)

func main() {
	// Optimize GC to reduce blocking and ensure smooth process management
	//
	// SetGCPercent(200) reduces GC frequency by allowing the heap to grow
	// to 2x the live set before triggering a collection. This trades increased
	// memory usage for reduced GC blocking pauses.
	//
	// Trade-offs:
	// - Reduces GC frequency and blocking pauses (improves responsiveness)
	// - Increases memory usage (heap can grow to 2x before collection)
	// - Adjust this value if memory is constrained or if more frequent GC is needed
	debug.SetGCPercent(200)
	
	// SetMemoryLimit sets a soft limit to prevent aggressive GC under memory pressure
	// This helps maintain predictable performance even when managing multiple WhatsApp instances
	// The GC will be more aggressive as the application approaches this limit
	debug.SetMemoryLimit(memoryLimitBytes)

	database.InitDB()

	sm := manager.NewSessionManager()
	sm.SyncFromDB()

	app := fiber.New()
	routes.RegisterRoutes(app, sm)

	env, _ := os.ReadFile("../.env")
	port, ok := parseEnv(env)["PORT"]
	if !ok {
		port = "8080"
	}

	log.Fatal(app.Listen(":" + port))
}

func parseEnv(buffer []byte) map[string]string {
	env := make(map[string]string)
	scanner := bufio.NewScanner(bytes.NewReader(buffer))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		env[key] = val
	}

	return env
}
