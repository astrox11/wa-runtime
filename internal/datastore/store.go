package datastore

import (
	"sync"
	"time"
)

type SessionStatus string

const (
	StatusConnected    SessionStatus = "connected"
	StatusDisconnected SessionStatus = "disconnected"
	StatusPairing      SessionStatus = "pairing"
	StatusPaused       SessionStatus = "paused"
	StatusInactive     SessionStatus = "inactive"
)

type UserInfo struct {
	Name   string `json:"name,omitempty"`
	Status string `json:"status,omitempty"`
}

type Session struct {
	ID          string        `json:"id"`
	PhoneNumber string        `json:"phone_number"`
	Status      SessionStatus `json:"status"`
	UserInfo    *UserInfo     `json:"user_info,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
	PairingCode string        `json:"pairing_code,omitempty"`
}

type SessionStats struct {
	MessagesReceived int `json:"messagesReceived"`
	MessagesSent     int `json:"messagesSent"`
}

type OverallStats struct {
	TotalSessions  int    `json:"totalSessions"`
	ActiveSessions int    `json:"activeSessions"`
	TotalMessages  int    `json:"totalMessages"`
	Version        string `json:"version"`
}

type ActivitySettings struct {
	AutoAlwaysOnline bool `json:"auto_always_online"`
	AutoTyping       bool `json:"auto_typing"`
	AutoReadMessages bool `json:"auto_read_messages"`
	AutoRejectCalls  bool `json:"auto_reject_calls"`
}

type Store struct {
	sessions     map[string]*Session
	sessionStats map[string]*SessionStats
	settings     map[string]*ActivitySettings
	overallStats *OverallStats
	mu           sync.RWMutex
}

var instance *Store
var once sync.Once

func GetStore() *Store {
	once.Do(func() {
		instance = &Store{
			sessions:     make(map[string]*Session),
			sessionStats: make(map[string]*SessionStats),
			settings:     make(map[string]*ActivitySettings),
			overallStats: &OverallStats{Version: "1.0.0"},
		}
	})
	return instance
}

func (s *Store) SetSession(session *Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
	if _, exists := s.settings[session.ID]; !exists {
		s.settings[session.ID] = &ActivitySettings{}
	}
}

func (s *Store) GetSession(id string) *Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessions[id]
}

func (s *Store) DeleteSession(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
	delete(s.sessionStats, id)
	delete(s.settings, id)
}

func (s *Store) GetAllSessions() []*Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessions := make([]*Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		sessions = append(sessions, session)
	}
	return sessions
}

func (s *Store) SetSessionStats(id string, stats *SessionStats) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessionStats[id] = stats
}

func (s *Store) GetSessionStats(id string) *SessionStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessionStats[id]
}

func (s *Store) SetOverallStats(stats *OverallStats) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.overallStats = stats
}

func (s *Store) GetOverallStats() *OverallStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.overallStats
}

func (s *Store) GetActivitySettings(id string) *ActivitySettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if settings, exists := s.settings[id]; exists {
		return settings
	}
	return &ActivitySettings{}
}

func (s *Store) SetActivitySettings(id string, settings *ActivitySettings) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings[id] = settings
}

func (s *Store) UpdateActivitySettings(id string, updates map[string]bool) *ActivitySettings {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.settings[id]; !exists {
		s.settings[id] = &ActivitySettings{}
	}

	settings := s.settings[id]
	for key, value := range updates {
		switch key {
		case "auto_always_online":
			settings.AutoAlwaysOnline = value
		case "auto_typing":
			settings.AutoTyping = value
		case "auto_read_messages":
			settings.AutoReadMessages = value
		case "auto_reject_calls":
			settings.AutoRejectCalls = value
		}
	}

	return settings
}
