import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'
import fs from 'fs'
import SCHEMA from '../shared/db/schema.sql?raw'

const DB_VERSION = 1

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
    console.warn(
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
