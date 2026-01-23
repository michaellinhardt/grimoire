-- VERSION: 2
-- IMPORTANT: Bump version number when modifying this file

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  folder_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  archived INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  forked_from_session_id TEXT,
  is_hidden INTEGER DEFAULT 0,
  FOREIGN KEY (forked_from_session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS session_metadata (
  session_id TEXT PRIMARY KEY,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  model TEXT,
  updated_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS folders (
  path TEXT PRIMARY KEY,
  is_pinned INTEGER DEFAULT 0,
  last_accessed_at INTEGER
);

CREATE TABLE IF NOT EXISTS file_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  tool_type TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_file_edits_file_path ON file_edits(file_path);
CREATE INDEX IF NOT EXISTS idx_file_edits_session_id ON file_edits(session_id);

-- Index for session_metadata time-based queries (Story 2a.6)
CREATE INDEX IF NOT EXISTS idx_session_metadata_updated_at ON session_metadata(updated_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

-- Rewind context storage for Epic 3b CC spawn (Story 2b.5)
-- Stores checkpoint UUID and new message for sessions created via rewind
-- Data is consumed when CC is spawned with --checkpoint flag
CREATE TABLE IF NOT EXISTS rewind_context (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  checkpoint_uuid TEXT NOT NULL,
  new_message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
