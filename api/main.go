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

func main() {
	// Optimize GC to reduce blocking and ensure smooth process management
	// Set GC percent to 200 to reduce GC frequency and blocking pauses
	debug.SetGCPercent(200)
	
	// Set a soft memory limit (e.g., 1GB) to prevent aggressive GC under memory pressure
	// This helps maintain predictable performance even with multiple instances
	debug.SetMemoryLimit(1024 * 1024 * 1024) // 1GB soft limit

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
