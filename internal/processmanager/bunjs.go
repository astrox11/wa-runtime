package processmanager

import (
	"bufio"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"

	"github.com/gofiber/fiber/v2"
)

// ProcessStatus represents the possible states of the BunJS process
type ProcessStatus string

const (
	StatusStopped ProcessStatus = "stopped"
	StatusRunning ProcessStatus = "running"
	StatusCrashed ProcessStatus = "crashed"
	StatusError   ProcessStatus = "error"
)

// BunJSManager manages the BunJS process
type BunJSManager struct {
	cmd        *exec.Cmd
	scriptPath string
	status     ProcessStatus
	lastError  string
	mu         sync.RWMutex
}

// NewBunJSManager creates a new BunJS process manager
func NewBunJSManager(scriptPath string) *BunJSManager {
	return &BunJSManager{
		scriptPath: scriptPath,
		status:     StatusStopped,
	}
}

// Start starts the BunJS process
func (m *BunJSManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status == StatusRunning && m.cmd != nil && m.cmd.Process != nil {
		log.Println("[BunJS] Process already running")
		return nil
	}

	// Check if script file exists
	if _, err := os.Stat(m.scriptPath); os.IsNotExist(err) {
		m.status = StatusError
		m.lastError = "Script file not found: " + m.scriptPath
		log.Printf("[BunJS ERROR] %s", m.lastError)
		return err
	}

	m.cmd = exec.Command("bun", "run", m.scriptPath)

	// Setup stdout pipe
	stdout, err := m.cmd.StdoutPipe()
	if err != nil {
		m.status = StatusError
		m.lastError = "Failed to create stdout pipe: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		return err
	}

	// Setup stderr pipe
	stderr, err := m.cmd.StderrPipe()
	if err != nil {
		m.status = StatusError
		m.lastError = "Failed to create stderr pipe: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		return err
	}

	// Start the process
	if err := m.cmd.Start(); err != nil {
		m.status = StatusError
		m.lastError = "Failed to start process: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		return err
	}

	m.status = StatusRunning
	m.lastError = ""
	log.Printf("[BunJS] Process started with PID: %d", m.cmd.Process.Pid)

	// Read stdout in goroutine
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			log.Printf("[BunJS] %s", scanner.Text())
		}
	}()

	// Read stderr in goroutine
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			log.Printf("[BunJS ERROR] %s", scanner.Text())
		}
	}()

	// Monitor process in goroutine
	go func() {
		cmd := m.cmd // Capture current cmd
		err := cmd.Wait()
		m.mu.Lock()
		defer m.mu.Unlock()

		// Only update status if this is still the active cmd
		if m.cmd != cmd {
			return // Process was stopped/restarted, don't update status
		}

		if err != nil {
			m.status = StatusCrashed
			m.lastError = "Process exited with error: " + err.Error()
			log.Printf("[BunJS ERROR] %s", m.lastError)
		} else {
			m.status = StatusStopped
			log.Println("[BunJS] Process exited normally")
		}
	}()

	return nil
}

// Stop stops the BunJS process
func (m *BunJSManager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cmd == nil || m.cmd.Process == nil {
		m.status = StatusStopped
		return nil
	}

	log.Println("[BunJS] Stopping process...")
	proc := m.cmd.Process
	m.cmd = nil // Clear the cmd so monitoring goroutine doesn't update status
	
	if err := proc.Kill(); err != nil {
		m.lastError = "Failed to kill process: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		return err
	}

	// Wait for the process to exit (ignore error since we killed it)
	_, _ = proc.Wait()

	m.status = StatusStopped
	m.lastError = ""
	log.Println("[BunJS] Process stopped")
	return nil
}

// Restart restarts the BunJS process
func (m *BunJSManager) Restart() error {
	log.Println("[BunJS] Restarting process...")
	if err := m.Stop(); err != nil {
		return err
	}
	return m.Start()
}

// GetStatus returns the current process status
func (m *BunJSManager) GetStatus() ProcessStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

// GetLastError returns the last error message
func (m *BunJSManager) GetLastError() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lastError
}

// StatusResponse represents the process status API response
type StatusResponse struct {
	Status    ProcessStatus `json:"status"`
	LastError string        `json:"lastError,omitempty"`
}

// HandleGetStatus returns the current process status (Fiber handler)
func (m *BunJSManager) HandleGetStatus(c *fiber.Ctx) error {
	return c.JSON(StatusResponse{
		Status:    m.GetStatus(),
		LastError: m.GetLastError(),
	})
}

// HandleRestart restarts the BunJS process (Fiber handler)
func (m *BunJSManager) HandleRestart(c *fiber.Ctx) error {
	if err := m.Restart(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to restart process: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Process restarted successfully",
		"status":  m.GetStatus(),
	})
}

// HandleGetStatusHTTP returns the current process status (net/http handler)
func (m *BunJSManager) HandleGetStatusHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(StatusResponse{
		Status:    m.GetStatus(),
		LastError: m.GetLastError(),
	})
}

// HandleRestartHTTP restarts the BunJS process (net/http handler)
func (m *BunJSManager) HandleRestartHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := m.Restart(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Failed to restart process: " + err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Process restarted successfully",
		"status":  m.GetStatus(),
	})
}

// SetupRoutes configures process manager routes (Fiber)
func (m *BunJSManager) SetupRoutes(app *fiber.App) {
	api := app.Group("/api/process")

	api.Get("/status", m.HandleGetStatus)
	api.Post("/restart", m.HandleRestart)
}
