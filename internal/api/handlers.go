package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"whatsaly/internal/datastore"
	"whatsaly/internal/websocket"
)

type Handlers struct {
	store      *datastore.Store
	hub        *websocket.Hub
	bunBackend string
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func NewHandlers(store *datastore.Store, hub *websocket.Hub, bunBackend string) *Handlers {
	return &Handlers{
		store:      store,
		hub:        hub,
		bunBackend: bunBackend,
	}
}

func (h *Handlers) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handlers) HandleGetSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	sessions := h.store.GetAllSessions()
	h.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: sessions})
}

func (h *Handlers) HandleGetSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	id = strings.Split(id, "/")[0]

	session := h.store.GetSession(id)
	if session == nil {
		h.writeJSON(w, http.StatusNotFound, APIResponse{Success: false, Error: "Session not found"})
		return
	}

	h.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: session})
}

func (h *Handlers) HandleCreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	resp, err := http.Post(h.bunBackend+"/api/sessions", "application/json", r.Body)
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func (h *Handlers) HandleDeleteSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/sessions/")

	req, _ := http.NewRequest(http.MethodDelete, h.bunBackend+"/api/sessions/"+id, nil)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	h.store.DeleteSession(id)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func (h *Handlers) HandlePauseSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	id := strings.TrimSuffix(path, "/pause")

	req, _ := http.NewRequest(http.MethodPost, h.bunBackend+"/api/sessions/"+id+"/pause", nil)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func (h *Handlers) HandleResumeSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	id := strings.TrimSuffix(path, "/resume")

	req, _ := http.NewRequest(http.MethodPost, h.bunBackend+"/api/sessions/"+id+"/resume", nil)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func (h *Handlers) HandleGetStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	stats := h.store.GetOverallStats()
	h.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: stats})
}

func (h *Handlers) HandleGetFullStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	sessions := h.store.GetAllSessions()
	stats := h.store.GetOverallStats()

	sessionData := make([]map[string]interface{}, 0, len(sessions))
	for _, s := range sessions {
		sessionStats := h.store.GetSessionStats(s.ID)
		data := map[string]interface{}{
			"id":           s.ID,
			"phone_number": s.PhoneNumber,
			"status":       s.Status,
			"user_info":    s.UserInfo,
			"created_at":   s.CreatedAt,
		}
		if sessionStats != nil {
			data["stats"] = sessionStats
		}
		sessionData = append(sessionData, data)
	}

	result := map[string]interface{}{
		"totalSessions":  stats.TotalSessions,
		"activeSessions": stats.ActiveSessions,
		"totalMessages":  stats.TotalMessages,
		"sessions":       sessionData,
	}

	h.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: result})
}

func (h *Handlers) HandleGetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	id := strings.TrimSuffix(path, "/settings")

	settings := h.store.GetActivitySettings(id)
	h.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: settings})
}

func (h *Handlers) HandleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	id := strings.TrimSuffix(path, "/settings")

	var updates map[string]bool
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		h.writeJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	settings := h.store.UpdateActivitySettings(id, updates)
	h.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: settings})
}

func (h *Handlers) HandleBunPushSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	var session datastore.Session
	if err := json.NewDecoder(r.Body).Decode(&session); err != nil {
		h.writeJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	h.store.SetSession(&session)

	h.broadcastStats()

	h.writeJSON(w, http.StatusOK, APIResponse{Success: true})
}

func (h *Handlers) HandleBunPushStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	var payload struct {
		Overall  *datastore.OverallStats           `json:"overall"`
		Sessions []map[string]interface{}          `json:"sessions"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.writeJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	if payload.Overall != nil {
		h.store.SetOverallStats(payload.Overall)
	}

	for _, s := range payload.Sessions {
		session := &datastore.Session{
			ID:          getString(s, "id"),
			PhoneNumber: getString(s, "phone_number"),
			Status:      datastore.SessionStatus(getString(s, "status")),
		}

		if ui, ok := s["user_info"].(map[string]interface{}); ok {
			session.UserInfo = &datastore.UserInfo{
				Name: getString(ui, "name"),
			}
		}

		if createdAt, ok := s["created_at"].(string); ok {
			if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
				session.CreatedAt = t
			}
		}

		h.store.SetSession(session)

		if stats, ok := s["stats"].(map[string]interface{}); ok {
			sessionStats := &datastore.SessionStats{
				MessagesReceived: getInt(stats, "messagesReceived"),
				MessagesSent:     getInt(stats, "messagesSent"),
			}
			h.store.SetSessionStats(session.ID, sessionStats)
		}
	}

	h.broadcastStats()

	h.writeJSON(w, http.StatusOK, APIResponse{Success: true})
}

func (h *Handlers) broadcastStats() {
	sessions := h.store.GetAllSessions()
	stats := h.store.GetOverallStats()

	sessionData := make([]map[string]interface{}, 0, len(sessions))
	for _, s := range sessions {
		sessionStats := h.store.GetSessionStats(s.ID)
		data := map[string]interface{}{
			"id":           s.ID,
			"phone_number": s.PhoneNumber,
			"status":       s.Status,
			"user_info":    s.UserInfo,
			"created_at":   s.CreatedAt,
		}
		if sessionStats != nil {
			data["stats"] = sessionStats
		}
		sessionData = append(sessionData, data)
	}

	message := map[string]interface{}{
		"type": "stats",
		"data": map[string]interface{}{
			"totalSessions":  stats.TotalSessions,
			"activeSessions": stats.ActiveSessions,
			"totalMessages":  stats.TotalMessages,
			"sessions":       sessionData,
		},
	}

	h.hub.Broadcast(message)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	return 0
}

func (h *Handlers) HandleGetGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := r.URL.Path
	id := strings.TrimPrefix(path, "/api/sessions/")
	id = strings.TrimSuffix(id, "/groups")

	resp, err := http.Get(h.bunBackend + "/api/sessions/" + id + "/groups")
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func (h *Handlers) HandleGetGroupMetadata(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := r.URL.Path
	parts := strings.Split(strings.TrimPrefix(path, "/api/sessions/"), "/")
	if len(parts) < 3 {
		h.writeJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid path"})
		return
	}
	sessionId := parts[0]
	groupId := parts[2]

	resp, err := http.Get(h.bunBackend + "/api/sessions/" + sessionId + "/groups/" + groupId + "/metadata")
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func (h *Handlers) HandleGroupAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method not allowed"})
		return
	}

	path := r.URL.Path
	parts := strings.Split(strings.TrimPrefix(path, "/api/sessions/"), "/")
	if len(parts) < 3 {
		h.writeJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid path"})
		return
	}
	sessionId := parts[0]
	groupId := parts[2]

	req, err := http.NewRequest(http.MethodPost, h.bunBackend+"/api/sessions/"+sessionId+"/groups/"+groupId+"/action", r.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create request"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, APIResponse{Success: false, Error: "Backend unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read response"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
