import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock data
const testDbDir = path.join(os.tmpdir(), '.grimoire')
interface MockDatabase {
  dbPath: string
}
let mockDbInstance: MockDatabase | null = null
let execCalls: string[] = []
let pragmaCalls: { name: string; value?: unknown }[] = []

// Mock modules before importing the module under test
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') {
        return os.tmpdir()
      }
      return ''
    })
  }
}))

vi.mock('better-sqlite3', () => {
  return {
    default: class MockDatabaseConstructor {
      dbPath: string
      constructor(dbPath: string) {
        this.dbPath = dbPath
        // Simulate creating directory
        if (!fs.existsSync(path.dirname(dbPath))) {
          fs.mkdirSync(path.dirname(dbPath), { recursive: true })
        }
        mockDbInstance = this as unknown as MockDatabase
      }
      pragma(name: string, options?: { simple?: boolean }): unknown {
        pragmaCalls.push({ name, value: options })
        if (name === 'user_version' && options?.simple) {
          return 0
        }
        return undefined
      }
      exec(sql: string): void {
        execCalls.push(sql)
      }
      close(): void {
        // no-op
      }
    }
  }
})

vi.mock('../shared/db/schema.sql?raw', () => ({
  default: `-- Mock schema matching production structure (see src/shared/db/schema.sql)
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
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_file_edits_file_path ON file_edits(file_path);
CREATE INDEX IF NOT EXISTS idx_file_edits_session_id ON file_edits(session_id);
  `
}))

describe('Database Initialization', () => {
  beforeEach(() => {
    // Reset mocks
    mockDbInstance = null
    execCalls = []
    pragmaCalls = []
    vi.resetModules()

    // Clean up test directory
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true })
    }
  })

  it('creates database directory if it does not exist', async () => {
    const { initDatabase, closeDatabase } = await import('./db')
    initDatabase()
    expect(fs.existsSync(testDbDir)).toBe(true)
    closeDatabase()
  })

  it('initializes database at correct path', async () => {
    const { initDatabase, closeDatabase } = await import('./db')
    initDatabase()
    expect(mockDbInstance?.dbPath).toBe(path.join(testDbDir, 'grimoire.db'))
    closeDatabase()
  })

  it('checks user_version pragma on initialization', async () => {
    const { initDatabase, closeDatabase } = await import('./db')
    initDatabase()
    expect(pragmaCalls.some((c) => c.name === 'user_version')).toBe(true)
    closeDatabase()
  })

  it('executes schema when version differs', async () => {
    const { initDatabase, closeDatabase } = await import('./db')
    initDatabase()
    // Should have executed DROP and CREATE statements
    expect(execCalls.length).toBeGreaterThan(0)
    closeDatabase()
  })

  it('sets user_version after schema execution', async () => {
    const { initDatabase, closeDatabase } = await import('./db')
    initDatabase()
    // Should have set user_version = 1
    expect(pragmaCalls.some((c) => c.name.includes('user_version = 1'))).toBe(true)
    closeDatabase()
  })

  it('returns same instance on multiple calls', async () => {
    const { initDatabase, closeDatabase } = await import('./db')
    const db1 = initDatabase()
    const db2 = initDatabase()
    expect(db1).toBe(db2)
    closeDatabase()
  })

  it('getDatabase throws if not initialized', async () => {
    const { getDatabase } = await import('./db')
    expect(() => getDatabase()).toThrow('Database not initialized')
  })
})
