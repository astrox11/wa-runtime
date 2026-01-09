package manager

import (
	"os/exec"
	"sync"
	"time"
)

type Worker struct {
	Phone       string
	Process     *exec.Cmd
	PairingCode string
	IsRunning   bool
	Status      string
	mu          sync.RWMutex
}

func (w *Worker) GetData() map[string]any {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return map[string]any{
		"phone":        w.Phone,
		"status":       w.Status,
		"pairing_code": w.PairingCode,
		"is_running":   w.IsRunning,
	}
}

func (w *Worker) GetStatus() string {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Status
}

func (sm *SessionManager) supervisor(w *Worker) {
	for {
		w.mu.RLock()
		status := w.Status
		w.mu.RUnlock()

		if status == "logged_out" {
			break
		}

		if status == "paused" {
			time.Sleep(2 * time.Second)
			continue
		}

		cmd := exec.Command("bun", "run", "./dist/index.js", w.Phone)
		cmd.Dir = "../core"
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}
		w.Process = cmd

		if err := cmd.Start(); err != nil {
			time.Sleep(5 * time.Second)
			continue
		}

		w.mu.Lock()
		w.IsRunning = true
		w.mu.Unlock()

		// IMPORTANT: Wrap ExtractStreams in a goroutine so it doesn't
		// block the supervisor from hitting cmd.Wait() or the next loop
		go sm.ExtractStreams(w, stdout)

		// Wait for the process to exit (either crash or killed by pause)
		cmd.Wait()

		w.mu.Lock()
		w.IsRunning = false
		w.mu.Unlock()

		time.Sleep(2 * time.Second) // Small cooldown before restarting
	}
}
