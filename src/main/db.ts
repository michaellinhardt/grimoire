import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'
import fs from 'fs'

const DB_VERSION = 1

const SCHEMA = `
-- VERSION: 1
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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
`

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const grimoireDir = path.join(app.getPath('home'), '.grimoire')

  if (!fs.existsSync(grimoireDir)) {
    fs.mkdirSync(grimoireDir, { recursive: true })
  }

  const dbPath = path.join(grimoireDir, 'grimoire.db')
  db = new Database(dbPath)

  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion !== DB_VERSION) {
    console.log(
      `Database schema changed (${currentVersion} -> ${DB_VERSION}). Recreating database.`
    )

    db.exec('DROP TABLE IF EXISTS file_edits')
    db.exec('DROP TABLE IF EXISTS session_metadata')
    db.exec('DROP TABLE IF EXISTS sessions')
    db.exec('DROP TABLE IF EXISTS folders')
    db.exec('DROP TABLE IF EXISTS settings')

    db.exec(SCHEMA)
    db.pragma(`user_version = ${DB_VERSION}`)
  }

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
