-- Whatsaly Main Database Schema
-- This file defines the core tables managed by the Go server

-- Sessions table - tracks all WhatsApp sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 4,
    user_info TEXT,
    created_at INTEGER NOT NULL
);

-- Create index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phone_number);

-- Activity settings table - stores per-session activity settings
CREATE TABLE IF NOT EXISTS activity_settings (
    session_id TEXT PRIMARY KEY,
    auto_read_messages INTEGER NOT NULL DEFAULT 0,
    auto_recover_deleted_messages INTEGER NOT NULL DEFAULT 0,
    auto_antispam INTEGER NOT NULL DEFAULT 0,
    auto_typing INTEGER NOT NULL DEFAULT 0,
    auto_recording INTEGER NOT NULL DEFAULT 0,
    auto_reject_calls INTEGER NOT NULL DEFAULT 0,
    auto_always_online INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Groups cache table - stores group metadata
CREATE TABLE IF NOT EXISTS groups_cache (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_groups_session ON groups_cache(session_id);

-- Contacts table - stores contact LID mappings
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    lid TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_session ON contacts(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique ON contacts(session_id, phone_number);

-- Auth data table - stores Baileys auth state per session
CREATE TABLE IF NOT EXISTS auth_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_session_name ON auth_data(session_id, name);

-- Messages cache table - stores recent messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    msg TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

-- Sudo users table - stores sudo permissions
CREATE TABLE IF NOT EXISTS sudo_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    lid TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sudo_unique ON sudo_users(session_id, phone_number);

-- Banned users table
CREATE TABLE IF NOT EXISTS banned_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    lid TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_unique ON banned_users(session_id, phone_number);

-- Mode settings table
CREATE TABLE IF NOT EXISTS mode_settings (
    session_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'public',
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Prefix settings table
CREATE TABLE IF NOT EXISTS prefix_settings (
    session_id TEXT PRIMARY KEY,
    prefix TEXT NOT NULL DEFAULT '.',
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Alive message table
CREATE TABLE IF NOT EXISTS alive_settings (
    session_id TEXT PRIMARY KEY,
    alive_message TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- AFK settings table
CREATE TABLE IF NOT EXISTS afk_settings (
    session_id TEXT PRIMARY KEY,
    status INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    time INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Filter rules table
CREATE TABLE IF NOT EXISTS filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    trigger_word TEXT NOT NULL,
    reply TEXT,
    status INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_filter_unique ON filters(session_id, trigger_word);

-- Mention settings table
CREATE TABLE IF NOT EXISTS mention_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'text',
    data TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mention_unique ON mention_settings(session_id, group_id);

-- Sticker mappings table
CREATE TABLE IF NOT EXISTS stickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sticker_unique ON stickers(session_id, name);

-- BGM table
CREATE TABLE IF NOT EXISTS bgm (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    trigger_word TEXT NOT NULL,
    audio_data TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bgm_unique ON bgm(session_id, trigger_word);

-- Antilink settings table
CREATE TABLE IF NOT EXISTS antilink_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    mode INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_antilink_unique ON antilink_settings(session_id, group_id);

-- Antidelete settings table
CREATE TABLE IF NOT EXISTS antidelete_settings (
    session_id TEXT PRIMARY KEY,
    active INTEGER NOT NULL DEFAULT 0,
    mode TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Group events settings table
CREATE TABLE IF NOT EXISTS group_event_settings (
    session_id TEXT PRIMARY KEY,
    status INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
