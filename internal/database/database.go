package database

import (
	"database/sql"
	"embed"
	"log"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed sql/schema.sql
var schemaFS embed.FS

type Database struct {
	db *sql.DB
	mu sync.RWMutex
}

var instance *Database
var once sync.Once

func GetDatabase() *Database {
	once.Do(func() {
		db, err := sql.Open("sqlite", "whatsaly.db?_journal=WAL&_busy_timeout=5000")
		if err != nil {
			log.Fatalf("Failed to open database: %v", err)
		}

		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
		db.SetConnMaxLifetime(time.Hour)

		instance = &Database{db: db}
		if err := instance.initSchema(); err != nil {
			log.Fatalf("Failed to initialize schema: %v", err)
		}
	})
	return instance
}

func (d *Database) initSchema() error {
	schema, err := schemaFS.ReadFile("sql/schema.sql")
	if err != nil {
		return err
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	_, err = d.db.Exec(string(schema))
	return err
}

func (d *Database) Close() error {
	return d.db.Close()
}

type Session struct {
	ID          string      `json:"id"`
	PhoneNumber string      `json:"phone_number"`
	Status      int         `json:"status"`
	UserInfo    *string     `json:"user_info,omitempty"`
	CreatedAt   int64       `json:"created_at"`
}

type ActivitySettings struct {
	SessionID                    string `json:"session_id"`
	AutoReadMessages             bool   `json:"auto_read_messages"`
	AutoRecoverDeletedMessages   bool   `json:"auto_recover_deleted_messages"`
	AutoAntispam                 bool   `json:"auto_antispam"`
	AutoTyping                   bool   `json:"auto_typing"`
	AutoRecording                bool   `json:"auto_recording"`
	AutoRejectCalls              bool   `json:"auto_reject_calls"`
	AutoAlwaysOnline             bool   `json:"auto_always_online"`
}

func (d *Database) CreateSession(id, phoneNumber string, status int) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec(
		"INSERT OR REPLACE INTO sessions (id, phone_number, status, created_at) VALUES (?, ?, ?, ?)",
		id, phoneNumber, status, time.Now().UnixMilli(),
	)
	if err != nil {
		return err
	}

	_, err = d.db.Exec(
		"INSERT OR IGNORE INTO activity_settings (session_id) VALUES (?)",
		id,
	)
	return err
}

func (d *Database) GetSession(idOrPhone string) (*Session, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	row := d.db.QueryRow(
		"SELECT id, phone_number, status, user_info, created_at FROM sessions WHERE id = ? OR phone_number = ?",
		idOrPhone, idOrPhone,
	)

	var s Session
	err := row.Scan(&s.ID, &s.PhoneNumber, &s.Status, &s.UserInfo, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (d *Database) GetAllSessions() ([]Session, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.db.Query("SELECT id, phone_number, status, user_info, created_at FROM sessions")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(&s.ID, &s.PhoneNumber, &s.Status, &s.UserInfo, &s.CreatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func (d *Database) UpdateSessionStatus(id string, status int) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("UPDATE sessions SET status = ? WHERE id = ?", status, id)
	return err
}

func (d *Database) UpdateSessionUserInfo(id string, userInfo string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("UPDATE sessions SET user_info = ? WHERE id = ?", userInfo, id)
	return err
}

func (d *Database) DeleteSession(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("DELETE FROM sessions WHERE id = ?", id)
	return err
}

func (d *Database) GetActivitySettings(sessionID string) (*ActivitySettings, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	row := d.db.QueryRow(
		`SELECT session_id, auto_read_messages, auto_recover_deleted_messages, auto_antispam, 
		        auto_typing, auto_recording, auto_reject_calls, auto_always_online 
		 FROM activity_settings WHERE session_id = ?`,
		sessionID,
	)

	var s ActivitySettings
	err := row.Scan(
		&s.SessionID, &s.AutoReadMessages, &s.AutoRecoverDeletedMessages,
		&s.AutoAntispam, &s.AutoTyping, &s.AutoRecording,
		&s.AutoRejectCalls, &s.AutoAlwaysOnline,
	)
	if err == sql.ErrNoRows {
		return &ActivitySettings{SessionID: sessionID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (d *Database) UpdateActivitySettings(sessionID string, settings map[string]bool) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	current, err := d.GetActivitySettingsUnlocked(sessionID)
	if err != nil {
		current = &ActivitySettings{SessionID: sessionID}
	}

	for key, value := range settings {
		switch key {
		case "auto_read_messages":
			current.AutoReadMessages = value
		case "auto_recover_deleted_messages":
			current.AutoRecoverDeletedMessages = value
		case "auto_antispam":
			current.AutoAntispam = value
		case "auto_typing":
			current.AutoTyping = value
		case "auto_recording":
			current.AutoRecording = value
		case "auto_reject_calls":
			current.AutoRejectCalls = value
		case "auto_always_online":
			current.AutoAlwaysOnline = value
		}
	}

	_, err = d.db.Exec(
		`INSERT OR REPLACE INTO activity_settings 
		 (session_id, auto_read_messages, auto_recover_deleted_messages, auto_antispam, 
		  auto_typing, auto_recording, auto_reject_calls, auto_always_online) 
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		sessionID, current.AutoReadMessages, current.AutoRecoverDeletedMessages,
		current.AutoAntispam, current.AutoTyping, current.AutoRecording,
		current.AutoRejectCalls, current.AutoAlwaysOnline,
	)
	return err
}

func (d *Database) GetActivitySettingsUnlocked(sessionID string) (*ActivitySettings, error) {
	row := d.db.QueryRow(
		`SELECT session_id, auto_read_messages, auto_recover_deleted_messages, auto_antispam, 
		        auto_typing, auto_recording, auto_reject_calls, auto_always_online 
		 FROM activity_settings WHERE session_id = ?`,
		sessionID,
	)

	var s ActivitySettings
	err := row.Scan(
		&s.SessionID, &s.AutoReadMessages, &s.AutoRecoverDeletedMessages,
		&s.AutoAntispam, &s.AutoTyping, &s.AutoRecording,
		&s.AutoRejectCalls, &s.AutoAlwaysOnline,
	)
	if err == sql.ErrNoRows {
		return &ActivitySettings{SessionID: sessionID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (d *Database) SaveAuthData(sessionID, name, data string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec(
		"INSERT OR REPLACE INTO auth_data (session_id, name, data) VALUES (?, ?, ?)",
		sessionID, name, data,
	)
	return err
}

func (d *Database) GetAuthData(sessionID, name string) (string, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var data string
	err := d.db.QueryRow(
		"SELECT data FROM auth_data WHERE session_id = ? AND name = ?",
		sessionID, name,
	).Scan(&data)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return data, err
}

func (d *Database) GetAllAuthData(sessionID string) (map[string]string, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.db.Query("SELECT name, data FROM auth_data WHERE session_id = ?", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var name, data string
		if err := rows.Scan(&name, &data); err != nil {
			return nil, err
		}
		result[name] = data
	}
	return result, rows.Err()
}

func (d *Database) DeleteAuthData(sessionID string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec("DELETE FROM auth_data WHERE session_id = ?", sessionID)
	return err
}

func (d *Database) AddContact(sessionID, phoneNumber, lid string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec(
		"INSERT OR REPLACE INTO contacts (session_id, phone_number, lid, created_at) VALUES (?, ?, ?, ?)",
		sessionID, phoneNumber, lid, time.Now().UnixMilli(),
	)
	return err
}

func (d *Database) GetContact(sessionID, phoneNumber string) (string, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var lid string
	err := d.db.QueryRow(
		"SELECT lid FROM contacts WHERE session_id = ? AND phone_number = ?",
		sessionID, phoneNumber,
	).Scan(&lid)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return lid, err
}

func (d *Database) SaveGroupsCache(sessionID string, groups string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.db.Exec(
		"INSERT OR REPLACE INTO groups_cache (id, session_id, data, updated_at) VALUES (?, ?, ?, ?)",
		sessionID+"_all", sessionID, groups, time.Now().UnixMilli(),
	)
	return err
}

func (d *Database) GetGroupsCache(sessionID string) (string, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var data string
	err := d.db.QueryRow(
		"SELECT data FROM groups_cache WHERE session_id = ? AND id = ?",
		sessionID, sessionID+"_all",
	).Scan(&data)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return data, err
}

func (d *Database) Exec(query string, args ...interface{}) (sql.Result, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.db.Exec(query, args...)
}

func (d *Database) Query(query string, args ...interface{}) (*sql.Rows, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.db.Query(query, args...)
}

func (d *Database) QueryRow(query string, args ...interface{}) *sql.Row {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.db.QueryRow(query, args...)
}
