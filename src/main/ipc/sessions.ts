import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import {
  TerminateRequestSchema,
  ScanResultSchema,
  SyncRequestSchema,
  SessionListSchema,
  SessionIdSchema,
  CreateSessionSchema,
  ListSessionsOptionsSchema,
  ForkSessionSchema,
  SessionLineageSchema,
  SessionMetadataSchema,
  SessionMetadataUpsertSchema,
  RewindRequestSchema,
  SendMessageSchema,
  AbortRequestSchema,
  GetInstanceStateSchema,
  AcknowledgeErrorSchema,
  HasActiveProcessSchema
} from '../../shared/types/ipc'
import { toSessionMetadata, type DBSessionMetadataRow } from '../sessions/session-metadata'
import { processRegistry } from '../process-registry'
import { scanClaudeConfigDir, syncSessionsToDatabase, listSessions } from '../sessions'
import { spawnCC, hasActiveProcess } from '../sessions/cc-spawner'
import { instanceStateManager } from '../sessions/instance-state-manager'
import { getDatabase } from '../db'

export function registerSessionsIPC(): void {
  ipcMain.handle('sessions:terminate', async (_, data: unknown) => {
    // Validate at IPC boundary (AR10)
    const { sessionId } = TerminateRequestSchema.parse(data)

    const child = processRegistry.get(sessionId)
    if (!child) return { success: true }

    child.kill('SIGTERM')

    // Wait up to 5s for graceful exit
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 5000))
    ])

    if (!child.killed) {
      child.kill('SIGKILL')
    }

    processRegistry.delete(sessionId)
    return { success: true }
  })

  // Session scanning handlers (Story 2a.1)
  ipcMain.handle('sessions:scan', async () => {
    const discovered = await scanClaudeConfigDir()
    return ScanResultSchema.parse({ sessions: discovered })
  })

  ipcMain.handle('sessions:sync', async (_, data: unknown) => {
    const { sessions } = SyncRequestSchema.parse(data)
    const result = await syncSessionsToDatabase(sessions)
    return result
  })

  ipcMain.handle('sessions:list', async (_, data?: unknown) => {
    const options = data ? ListSessionsOptionsSchema.parse(data) : undefined
    const sessions = await listSessions(options)
    return SessionListSchema.parse(sessions)
  })

  // Update last accessed timestamp (Story 2a.2)
  ipcMain.handle('sessions:updateLastAccessed', async (_, data: unknown) => {
    // Validate sessionId at IPC boundary - SessionIdSchema is z.string().uuid()
    // The preload passes the sessionId string directly, so data IS the string
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    const now = Date.now()
    db.prepare('UPDATE sessions SET last_accessed_at = ? WHERE id = ?').run(now, sessionId)
    return { success: true }
  })

  // Get active processes - session IDs with running child processes (Story 2a.2)
  ipcMain.handle('sessions:getActiveProcesses', () => {
    // processRegistry is Map<sessionId, ChildProcess>
    // Return array of session IDs with active processes
    return Array.from(processRegistry.keys())
  })

  // Archive session (Story 2a.3)
  ipcMain.handle('sessions:archive', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    db.prepare('UPDATE sessions SET archived = 1 WHERE id = ?').run(sessionId)
    return { success: true }
  })

  // Unarchive session (Story 2a.3)
  ipcMain.handle('sessions:unarchive', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    db.prepare('UPDATE sessions SET archived = 0 WHERE id = ?').run(sessionId)
    return { success: true }
  })

  // Create new session (Story 2a.3)
  ipcMain.handle('sessions:create', async (_, data: unknown) => {
    const { folderPath } = CreateSessionSchema.parse(data)
    const sessionId = randomUUID()
    const now = Date.now()
    const db = getDatabase()

    db.prepare(
      `
      INSERT INTO sessions (id, folder_path, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `
    ).run(sessionId, folderPath, now, now)

    return { sessionId }
  })

  // Hide session (Story 2a.5)
  ipcMain.handle('sessions:hide', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(sessionId)
    return { success: true }
  })

  // Unhide session (Story 2a.5)
  ipcMain.handle('sessions:unhide', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    db.prepare('UPDATE sessions SET is_hidden = 0 WHERE id = ?').run(sessionId)
    return { success: true }
  })

  // Fork session with atomic transaction (Story 2a.5)
  ipcMain.handle('sessions:fork', async (_, data: unknown) => {
    const { parentSessionId, hideParent = true } = ForkSessionSchema.parse(data)
    const db = getDatabase()

    // Validate parent exists
    const parent = db
      .prepare('SELECT folder_path FROM sessions WHERE id = ?')
      .get(parentSessionId) as { folder_path: string } | undefined

    if (!parent) {
      throw new Error(`Parent session not found: ${parentSessionId}`)
    }

    const newSessionId = randomUUID()
    const now = Date.now()

    // Atomic transaction: insert child + optionally hide parent
    const forkTransaction = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO sessions (id, folder_path, created_at, updated_at, forked_from_session_id)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(newSessionId, parent.folder_path, now, now, parentSessionId)

      if (hideParent) {
        db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(parentSessionId)
      }
    })

    forkTransaction()

    return { sessionId: newSessionId }
  })

  // Get session lineage chain (Story 2a.5)
  // Maximum depth to prevent infinite loops on corrupted data (circular references)
  const MAX_LINEAGE_DEPTH = 100

  ipcMain.handle('sessions:getLineage', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()

    // First, validate that the session exists
    const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId) as
      | { id: string }
      | undefined

    if (!sessionExists) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const lineage: string[] = []
    let currentId: string | null = sessionId
    let depth = 0

    const selectStmt = db.prepare('SELECT forked_from_session_id FROM sessions WHERE id = ?')

    while (currentId && depth < MAX_LINEAGE_DEPTH) {
      lineage.push(currentId)
      const row = selectStmt.get(currentId) as { forked_from_session_id: string | null } | undefined
      currentId = row?.forked_from_session_id ?? null
      depth++
    }

    return SessionLineageSchema.parse(lineage)
  })

  // Get metadata for a session (Story 2a.6)
  ipcMain.handle('sessions:getMetadata', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()

    const row = db
      .prepare(
        `
      SELECT session_id, total_input_tokens, total_output_tokens,
             total_cost_usd, model, updated_at
      FROM session_metadata
      WHERE session_id = ?
    `
      )
      .get(sessionId) as DBSessionMetadataRow | undefined

    if (!row) return null
    return SessionMetadataSchema.parse(toSessionMetadata(row))
  })

  // Upsert metadata - creates or updates with incremental values (Story 2a.6)
  ipcMain.handle('sessions:upsertMetadata', async (_, data: unknown) => {
    const input = SessionMetadataUpsertSchema.parse(data)
    const db = getDatabase()
    const now = Date.now()

    // Use transaction for atomicity (FK validation + upsert)
    const upsertTransaction = db.transaction(() => {
      // Validate session exists (FK constraint)
      const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(input.sessionId)
      if (!sessionExists) {
        throw new Error(`Session not found: ${input.sessionId}`)
      }

      // UPSERT - increment existing values or create new record
      // Note: Tokens/cost are ADDED to existing values (cumulative tracking)
      //       Model uses COALESCE - only updates if new value provided (preserves existing)
      db.prepare(
        `
        INSERT INTO session_metadata (session_id, total_input_tokens, total_output_tokens, total_cost_usd, model, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          total_input_tokens = total_input_tokens + excluded.total_input_tokens,
          total_output_tokens = total_output_tokens + excluded.total_output_tokens,
          total_cost_usd = total_cost_usd + excluded.total_cost_usd,
          model = COALESCE(excluded.model, model),
          updated_at = excluded.updated_at
      `
      ).run(
        input.sessionId,
        input.inputTokens,
        input.outputTokens,
        input.costUsd,
        input.model ?? null,
        now
      )
    })

    upsertTransaction()
    return { success: true }
  })

  // Rewind conversation from checkpoint (Story 2b.5)
  // Creates a forked session with rewind context for Epic 3b CC spawn
  ipcMain.handle('sessions:rewind', async (_, data: unknown) => {
    const { sessionId, checkpointUuid, newMessage } = RewindRequestSchema.parse(data)
    const db = getDatabase()

    // Validate parent session exists
    const parent = db.prepare('SELECT folder_path FROM sessions WHERE id = ?').get(sessionId) as
      | { folder_path: string }
      | undefined

    if (!parent) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const newSessionId = randomUUID()
    const now = Date.now()

    // Atomic transaction: create fork + store rewind context + hide parent
    const rewindTransaction = db.transaction(() => {
      // Create forked session entry (similar to sessions:fork)
      db.prepare(
        `
        INSERT INTO sessions (id, folder_path, created_at, updated_at, forked_from_session_id)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(newSessionId, parent.folder_path, now, now, sessionId)

      // Store rewind context for Epic 3b (checkpoint UUID + new message)
      db.prepare(
        `
        INSERT INTO rewind_context (session_id, checkpoint_uuid, new_message, created_at)
        VALUES (?, ?, ?, ?)
      `
      ).run(newSessionId, checkpointUuid, newMessage, now)

      // Hide parent session (consistent with fork behavior)
      db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(sessionId)
    })

    rewindTransaction()

    return { sessionId: newSessionId }
  })

  // Send message to session (Story 3a.2 + Story 3b-1)
  // Spawns CC and handles session ID assignment:
  // - Existing sessions: use provided sessionId
  // - New sessions: let CC assign sessionId via init event (Story 3b-2 updates DB)
  ipcMain.handle('sessions:sendMessage', async (_, data: unknown) => {
    try {
      const { sessionId, message, folderPath, isNewSession } = SendMessageSchema.parse(data)
      const db = getDatabase()
      const now = Date.now()

      // Concurrent request guard (Story 3b-4 AC#4)
      // Block if session already has an active process running
      if (!isNewSession && hasActiveProcess(sessionId)) {
        console.warn(`[sessions:sendMessage] Concurrent request blocked for ${sessionId}`)
        return {
          success: false,
          error: 'A response is still being generated. Please wait or abort the current request.'
        }
      }

      if (!isNewSession) {
        // Update last accessed timestamp for existing session
        db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId)
      }
      // NOTE: For new sessions, we do NOT create a DB entry here.
      // CC will assign the real sessionId via init event.
      // Story 3b-2 (stream parser) will update the DB when init event is received.
      // The renderer UUID is temporary and serves only to match stream events.

      // Spawn CC child process (Story 3b-1)
      try {
        spawnCC({
          sessionId: isNewSession ? undefined : sessionId,
          folderPath,
          message
        })

        if (process.env.DEBUG_SEND_MESSAGE) {
          console.debug(`[sendMessage] Spawned CC: sessionId=${sessionId}, isNew=${isNewSession}`)
        }

        return { success: true }
      } catch (spawnError) {
        const spawnErrorMsg =
          spawnError instanceof Error ? spawnError.message : 'Failed to spawn CC'
        console.error('[sessions:sendMessage] Spawn error:', spawnErrorMsg)
        return { success: false, error: spawnErrorMsg }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      console.error('[sessions:sendMessage] Error:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  // Abort running CC process (Story 3a-4)
  ipcMain.handle('sessions:abort', async (_, data: unknown) => {
    try {
      const { sessionId } = AbortRequestSchema.parse(data)

      const child = processRegistry.get(sessionId)
      if (!child) {
        // No active process - treat as success (idempotent)
        return { success: true }
      }

      // Send SIGTERM for graceful shutdown
      child.kill('SIGTERM')

      // Wait up to 500ms for graceful exit
      const exitPromise = new Promise<void>((resolve) => {
        child.once('exit', () => resolve())
      })

      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, 500)
      })

      await Promise.race([exitPromise, timeoutPromise])

      // Force kill if still running
      if (!child.killed) {
        child.kill('SIGKILL')
      }

      // Remove from registry
      processRegistry.delete(sessionId)

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to abort process'
      console.error('[sessions:abort] Error:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  // Get instance state (Story 3b-3)
  ipcMain.handle('instance:getState', async (_, data: unknown) => {
    const { sessionId } = GetInstanceStateSchema.parse(data)
    const state = instanceStateManager.getState(sessionId)
    return { state }
  })

  // Acknowledge error (Story 3b-3)
  ipcMain.handle('instance:acknowledgeError', async (_, data: unknown) => {
    const { sessionId } = AcknowledgeErrorSchema.parse(data)
    const newState = instanceStateManager.transition(sessionId, 'ACKNOWLEDGE_ERROR')
    return { success: true, newState }
  })

  // Check if session has active process (Story 3b-4)
  ipcMain.handle('sessions:hasActiveProcess', async (_, data: unknown) => {
    const { sessionId } = HasActiveProcessSchema.parse(data)
    return { active: hasActiveProcess(sessionId) }
  })
}
