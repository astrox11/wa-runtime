package processmanager

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

const BunBackendPort = "8001"

type ProcessStatus string

const (
	StatusStopped ProcessStatus = "stopped"
	StatusRunning ProcessStatus = "running"
	StatusCrashed ProcessStatus = "crashed"
	StatusError   ProcessStatus = "error"
)

type BunJSManager struct {
	cmd        *exec.Cmd
	scriptPath string
	status     ProcessStatus
	lastError  string
	mu         sync.RWMutex
	logs       []string
	logsMu     sync.RWMutex
}

const maxLogEntries = 1000

func NewBunJSManager(scriptPath string) *BunJSManager {
	return &BunJSManager{
		scriptPath: scriptPath,
		status:     StatusStopped,
		logs:       make([]string, 0, maxLogEntries),
	}
}

func (m *BunJSManager) addLog(line string) {
	m.logsMu.Lock()
	defer m.logsMu.Unlock()
	timestamp := time.Now().Format("15:04:05")
	m.logs = append(m.logs, timestamp+" "+line)
	if len(m.logs) > maxLogEntries {
		m.logs = m.logs[len(m.logs)-maxLogEntries:]
	}
}

func (m *BunJSManager) GetLogs() []string {
	m.logsMu.RLock()
	defer m.logsMu.RUnlock()
	result := make([]string, len(m.logs))
	copy(result, m.logs)
	return result
}

func (m *BunJSManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.status == StatusRunning && m.cmd != nil && m.cmd.Process != nil {
		log.Println("[BunJS] Process already running")
		return nil
	}

	if _, err := os.Stat(m.scriptPath); os.IsNotExist(err) {
		m.status = StatusError
		m.lastError = "Script file not found: " + m.scriptPath
		log.Printf("[BunJS ERROR] %s", m.lastError)
		return err
	}

	m.cmd = exec.Command("bun", "run", m.scriptPath)
	m.cmd.Env = append(os.Environ(), "API_PORT="+BunBackendPort, "HOST=127.0.0.1")

	stdout, err := m.cmd.StdoutPipe()
	if err != nil {
		m.status = StatusError
		m.lastError = "Failed to create stdout pipe: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		m.addLog("[ERROR] " + m.lastError)
		return err
	}

	stderr, err := m.cmd.StderrPipe()
	if err != nil {
		m.status = StatusError
		m.lastError = "Failed to create stderr pipe: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		m.addLog("[ERROR] " + m.lastError)
		return err
	}

	if err := m.cmd.Start(); err != nil {
		m.status = StatusError
		m.lastError = "Failed to start process: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		m.addLog("[ERROR] " + m.lastError)
		return err
	}

	m.status = StatusRunning
	m.lastError = ""
	log.Printf("[BunJS] Process started with PID: %d", m.cmd.Process.Pid)
	m.addLog("[INFO] Process started with PID: " + fmt.Sprintf("%d", m.cmd.Process.Pid))

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			text := scanner.Text()
			log.Printf("[BunJS] %s", text)
			m.addLog("[OUT] " + text)
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			text := scanner.Text()
			log.Printf("[BunJS ERROR] %s", text)
			m.addLog("[ERR] " + text)
		}
	}()

	go func() {
		cmd := m.cmd
		err := cmd.Wait()
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.cmd != cmd {
			return
		}
		if err != nil {
			m.status = StatusCrashed
			m.lastError = "Process exited with error: " + err.Error()
			log.Printf("[BunJS ERROR] %s", m.lastError)
			m.addLog("[ERROR] " + m.lastError)
		} else {
			m.status = StatusStopped
			log.Println("[BunJS] Process exited normally")
		}
	}()

	return nil
}

func (m *BunJSManager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cmd == nil || m.cmd.Process == nil {
		m.status = StatusStopped
		return nil
	}

	log.Println("[BunJS] Stopping process...")
	m.addLog("[INFO] Stopping process...")
	proc := m.cmd.Process
	m.cmd = nil

	if err := proc.Kill(); err != nil {
		m.lastError = "Failed to kill process: " + err.Error()
		log.Printf("[BunJS ERROR] %s", m.lastError)
		m.addLog("[ERROR] " + m.lastError)
		return err
	}

	_, _ = proc.Wait()
	m.status = StatusStopped
	m.lastError = ""
	log.Println("[BunJS] Process stopped")
	m.addLog("[INFO] Process stopped")
	return nil
}

func (m *BunJSManager) waitForPortFree() {
	log.Printf("[BunJS] Waiting for port %s to be released...", BunBackendPort)
	m.addLog("[INFO] Waiting for port " + BunBackendPort + " to be released...")

	if runtime.GOOS == "windows" {
		time.Sleep(2 * time.Second)
	}

	maxAttempts := 100
	for i := 0; i < maxAttempts; i++ {
		conn, err := net.DialTimeout("tcp", "127.0.0.1:"+BunBackendPort, 100*time.Millisecond)
		if err != nil {
			log.Printf("[BunJS] Port %s is now free", BunBackendPort)
			m.addLog("[INFO] Port " + BunBackendPort + " is now free")
			return
		}
		conn.Close()
		time.Sleep(100 * time.Millisecond)
	}
	log.Printf("[BunJS] Warning: Port %s may still be in use after waiting", BunBackendPort)
	m.addLog("[WARN] Port " + BunBackendPort + " may still be in use after waiting")
}

func (m *BunJSManager) Restart() error {
	log.Println("[BunJS] Restarting process...")
	m.addLog("[INFO] Restarting process...")
	if err := m.Stop(); err != nil {
		return err
	}
	m.waitForPortFree()
	return m.Start()
}

func (m *BunJSManager) GetStatus() ProcessStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *BunJSManager) GetLastError() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lastError
}

type StatusResponse struct {
	Status    ProcessStatus `json:"status"`
	LastError string        `json:"lastError,omitempty"`
}

func (m *BunJSManager) HandleGetStatus(c *fiber.Ctx) error {
	return c.JSON(StatusResponse{
		Status:    m.GetStatus(),
		LastError: m.GetLastError(),
	})
}

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

func (m *BunJSManager) SetupRoutes(app *fiber.App) {
	api := app.Group("/api/process")
	api.Get("/status", m.HandleGetStatus)
	api.Post("/restart", m.HandleRestart)
}
