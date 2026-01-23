import { app } from 'electron'
import { readdir, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { join, basename, dirname } from 'path'
import type { DiscoveredSession, SessionWithExists, SyncResult } from '../../shared/types/ipc'
import { getDatabase } from '../db'

/**
 * Recursively walks a directory, yielding all .jsonl files
 * Excludes 'subagents' directories at any depth
 */
async function* walkDirectory(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    // Log warning for permission or other errors (excluding ENOENT which is expected for missing dirs)
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') {
      console.warn(`Cannot read directory ${dir}: ${err.message}`)
    }
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      // Skip subagents directories at any depth
      if (entry.name === 'subagents') {
        continue
      }
      yield* walkDirectory(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      yield fullPath
    }
  }
}

/**
 * Decode folder path from URL-encoded format
 * Claude Code encodes paths by:
 * 1. URL-encoding special characters (including forward slashes as %2F)
 * 2. Replacing any remaining slashes with dashes
 * 3. Prepending a dash
 *
 * e.g., "-Users-teazyou-dev-grimoire" -> "/Users/teazyou/dev/grimoire"
 *
 * For paths with literal hyphens, Claude Code uses URL encoding:
 * e.g., "-Users-teazyou-my%2Dproject" -> "/Users/teazyou/my-project"
 *
 * Decoding process:
 * 1. Remove leading dash
 * 2. URL decode to restore special characters (including %2D -> -)
 * 3. Replace remaining dashes with slashes
 * 4. Prepend leading slash
 */
function decodeFolderPath(encodedPath: string): string {
  // Remove leading dash
  const withoutLeadingDash = encodedPath.slice(1)

  // URL decode first to restore %2D -> - and other encoded chars
  // This handles paths that contained literal hyphens (encoded as %2D)
  const urlDecoded = decodeURIComponent(withoutLeadingDash)

  // Now replace remaining dashes with slashes (these were path separators)
  const withSlashes = urlDecoded.replace(/-/g, '/')

  // Prepend leading slash
  return '/' + withSlashes
}

/**
 * Extract session ID from init message or filename
 */
async function extractSessionId(filePath: string): Promise<string | null> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        // Init message has type: 'system', subtype: 'init', session_id: string
        if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
          return event.session_id
        }
        // If first line isn't init, use filename (UUID without extension)
        const filename = basename(filePath, '.jsonl')
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (uuidRegex.test(filename)) {
          return filename
        }
        return null
      } catch {
        // Malformed JSON - skip this file
        console.warn(`Malformed JSON in ${filePath}`)
        return null
      }
    }
  } finally {
    rl.close()
  }

  // Empty file
  return null
}

/**
 * Extract session metadata from a .jsonl file
 */
export async function extractSessionMetadata(filePath: string): Promise<DiscoveredSession | null> {
  try {
    const sessionId = await extractSessionId(filePath)
    if (!sessionId) {
      console.warn(`Could not extract session ID from ${filePath}`)
      return null
    }

    // Get file stats for timestamps
    const fileStat = await stat(filePath)

    // Derive folder path from projects path structure
    // Path format: .../projects/-Users-teazyou-dev-grimoire/<uuid>.jsonl
    const projectDir = dirname(filePath)
    const encodedFolderName = basename(projectDir)

    // Decode the folder path
    const folderPath = decodeFolderPath(encodedFolderName)

    return {
      id: sessionId,
      filePath,
      folderPath,
      createdAt: Math.floor(fileStat.birthtimeMs),
      updatedAt: Math.floor(fileStat.mtimeMs)
    }
  } catch (error) {
    console.warn(`Error extracting metadata from ${filePath}:`, error)
    return null
  }
}

/**
 * Scan CLAUDE_CONFIG_DIR/projects for all session files
 * Returns array of discovered sessions with metadata
 */
export async function scanClaudeConfigDir(): Promise<DiscoveredSession[]> {
  const claudeConfigDir = join(app.getPath('userData'), '.claude')
  const projectsDir = join(claudeConfigDir, 'projects')

  const discovered: DiscoveredSession[] = []

  for await (const filePath of walkDirectory(projectsDir)) {
    const metadata = await extractSessionMetadata(filePath)
    if (metadata) {
      discovered.push(metadata)
    }
  }

  return discovered
}

/**
 * DB row type (snake_case) for sessions table
 */
interface DBSessionRow {
  id: string
  folder_path: string
  created_at: number
  updated_at: number
  last_accessed_at: number | null
  archived: number
  is_pinned: number
  forked_from_session_id: string | null
  is_hidden: number
}

/**
 * Transform DB row (snake_case) to Session type (camelCase)
 * CRITICAL: Include ALL fields from SessionSchema
 */
function toSession(row: DBSessionRow): SessionWithExists {
  return {
    id: row.id,
    folderPath: row.folder_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    archived: Boolean(row.archived),
    isPinned: Boolean(row.is_pinned),
    forkedFromSessionId: row.forked_from_session_id,
    isHidden: Boolean(row.is_hidden),
    exists: true // Will be updated when checking folder existence
  }
}

/**
 * Sync discovered sessions to database
 * - Insert new sessions
 * - Update existing sessions (updated_at timestamp)
 * Returns sync result with counts
 */
export async function syncSessionsToDatabase(discovered: DiscoveredSession[]): Promise<SyncResult> {
  const db = getDatabase()

  const result: SyncResult = {
    added: 0,
    updated: 0,
    orphaned: 0,
    errors: []
  }

  // Use transaction for bulk operations
  const insertStmt = db.prepare(`
    INSERT INTO sessions (id, folder_path, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `)

  const updateStmt = db.prepare(`
    UPDATE sessions SET updated_at = ? WHERE id = ?
  `)

  const selectStmt = db.prepare(`SELECT id FROM sessions WHERE id = ?`)

  const transaction = db.transaction(() => {
    for (const session of discovered) {
      try {
        const existing = selectStmt.get(session.id) as { id: string } | undefined
        if (existing) {
          updateStmt.run(session.updatedAt, session.id)
          result.updated++
        } else {
          insertStmt.run(session.id, session.folderPath, session.createdAt, session.updatedAt)
          result.added++
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push(`Error processing session ${session.id}: ${errorMessage}`)
      }
    }
  })

  try {
    transaction()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    result.errors.push(`Transaction error: ${errorMessage}`)
  }

  // Count orphaned sessions (session file no longer exists in .claude folder)
  // Note: This is checked at runtime, not stored in DB
  // We count sessions whose file_path no longer exists (if we tracked file_path in DB)
  // For now, we check folder_path as proxy - if project folder doesn't exist,
  // session is likely orphaned (though this isn't perfect)
  // A more robust solution would track file_path in DB or re-scan on sync
  const allDbSessions = db.prepare('SELECT id FROM sessions').all() as { id: string }[]
  const discoveredIds = new Set(discovered.map((s) => s.id))
  for (const row of allDbSessions) {
    // Session in DB but not found in scan = orphaned
    if (!discoveredIds.has(row.id)) {
      result.orphaned++
    }
  }

  return result
}

/**
 * List all sessions from database with runtime folder existence check
 * Uses async fs.access for non-blocking folder existence checks
 * @param options - Optional settings for filtering
 * @param options.includeHidden - If true, include hidden sessions (default: false)
 */
export async function listSessions(options?: {
  includeHidden?: boolean
}): Promise<SessionWithExists[]> {
  const db = getDatabase()
  const includeHidden = options?.includeHidden ?? false

  // Use separate prepared statements - avoid string interpolation for SQL
  const rows = includeHidden
    ? (db
        .prepare(
          `SELECT id, folder_path, created_at, updated_at, last_accessed_at,
              archived, is_pinned, forked_from_session_id, is_hidden
       FROM sessions
       ORDER BY updated_at DESC`
        )
        .all() as DBSessionRow[])
    : (db
        .prepare(
          `SELECT id, folder_path, created_at, updated_at, last_accessed_at,
              archived, is_pinned, forked_from_session_id, is_hidden
       FROM sessions
       WHERE is_hidden = 0
       ORDER BY updated_at DESC`
        )
        .all() as DBSessionRow[])

  // Check folder existence asynchronously to avoid blocking event loop
  const sessionsWithExists = await Promise.all(
    rows.map(async (row) => {
      const session = toSession(row)
      // Async existence check for orphan detection
      session.exists = await checkFolderExists(session.folderPath)
      return session
    })
  )

  return sessionsWithExists
}

/**
 * Async folder existence check (non-blocking)
 */
async function checkFolderExists(folderPath: string): Promise<boolean> {
  try {
    await stat(folderPath)
    return true
  } catch {
    return false
  }
}
