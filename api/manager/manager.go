package manager

import (
	"api/database"
	"fmt"
	"os/exec"
	"sync"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

type SessionManager struct {
	Workers map[string]*Worker
	mu      sync.Mutex
}

func CreateSession() *SessionManager {
	return &SessionManager{
		Workers: make(map[string]*Worker),
	}
}

func (sm *SessionManager) GetWorker(phone string) (*Worker, bool) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	w, ok := sm.Workers[phone]
	return w, ok
}

func (sm *SessionManager) StartInstance(phone string, status string) error {
	sm.mu.Lock()

	w, exists := sm.Workers[phone]
	if exists && w.IsRunning {
		sm.mu.Unlock()
		return fmt.Errorf("instance for %s is already running", phone)
	}

	if !exists {
		w = &Worker{
			Phone:  phone,
			Status: status,
		}
		sm.Workers[phone] = w
	}
	sm.mu.Unlock()

	go sm.supervisor(w)

	return nil
}

func (sm *SessionManager) PauseInstance(phone string, pause bool) error {
	sm.mu.Lock()
	w, ok := sm.Workers[phone]
	sm.mu.Unlock()

	if !ok {
		return fmt.Errorf("instance not found")
	}

	w.mu.Lock()
	if pause {
		w.Status = "paused"
		if w.Process != nil && w.Process.Process != nil {
			w.Process.Process.Kill()
		}
	} else {
		w.Status = "starting"
	}
	w.mu.Unlock()

	sm.SaveState(w)
	return nil
}

func (sm *SessionManager) SaveState(w *Worker) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// This looks for a session with the phone number.
	// If found, it updates; if not, it creates.
	err := database.DB.Where(database.Session{Phone: w.Phone}).
		Assign(database.Session{
			Status:      w.Status,
			PairingCode: w.PairingCode,
		}).
		FirstOrCreate(&database.Session{}).Error

	if err != nil {
		fmt.Printf("Error saving state to DB: %v\n", err)
	}
}

func (sm *SessionManager) ResetSession(phone string) error {
	sm.mu.Lock()
	w, ok := sm.Workers[phone]
	sm.mu.Unlock()

	if ok && w.Process != nil && w.Process.Process != nil {
		w.Process.Process.Kill()
	}

	cmd := exec.Command("redis-cli", "DEL", fmt.Sprintf("sessions:%s", phone))
	return cmd.Run()
}

func (sm *SessionManager) SyncSessionState() {
	var sessions []database.Session
	// Load everything that isn't logged out
	database.DB.Where("status != ?", "logged_out").Find(&sessions)

	for _, s := range sessions {
		if s.Status != "paused" {
			// Auto-start active sessions
			sm.StartInstance(s.Phone, "starting")
		} else {
			// Keep paused sessions in memory
			sm.mu.Lock()
			sm.Workers[s.Phone] = &Worker{
				Phone:  s.Phone,
				Status: "paused",
			}
			sm.mu.Unlock()
		}
	}
}

type SystemStats struct {
	CPU    float64 `json:"cpu"`
	Memory float64 `json:"memory"`
	Disk   float64 `json:"disk"`
}

// GetSystemStats collects all stats once
func GetSystemStats() SystemStats {
	c, _ := cpu.Percent(0, false)
	m, _ := mem.VirtualMemory()
	d, _ := disk.Usage("C:\\") // Use "/" for Linux

	var cpuVal float64
	if len(c) > 0 {
		cpuVal = c[0]
	}

	return SystemStats{
		CPU:    cpuVal,
		Memory: m.UsedPercent,
		Disk:   d.UsedPercent,
	}
}
