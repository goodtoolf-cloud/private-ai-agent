-- FILE: cf-backend/schema.sql
-- Run with: npm run db:init (local) or npm run db:init:remote (production)

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  model_used TEXT DEFAULT 'auto',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  confidence REAL,
  sources_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  content_summary TEXT,
  is_knowledge_base INTEGER DEFAULT 0,
  trust_level INTEGER DEFAULT 2,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_id TEXT REFERENCES uploaded_files(id),
  trust_level INTEGER DEFAULT 2,
  chunk_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  last_updated INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS monitor_alerts (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  query TEXT NOT NULL,
  interval_minutes INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  last_check INTEGER,
  last_result TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS alert_notifications (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES monitor_alerts(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS generated_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  r2_key TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_alert ON alert_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON alert_notifications(is_read);
