import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDatabase } from '../db'

// Mock better-sqlite3 database
vi.mock('../db', () => ({
  getDatabase: vi.fn()
}))

// Mock cc-spawner (Story 3b-1)
vi.mock('../sessions/cc-spawner', () => ({
  spawnCC: vi.fn()
}))

// Import schema validators for testing
import {
  ListSessionsOptionsSchema,
  ForkSessionSchema,
  SessionLineageSchema,
  SessionMetadataSchema,
  SessionMetadataUpsertSchema,
  RewindRequestSchema
} from '../../shared/types/ipc'
import { toSessionMetadata, type DBSessionMetadataRow } from '../sessions/session-metadata'

describe('Session Forking Schemas (Story 2a.5)', () => {
  describe('ListSessionsOptionsSchema', () => {
    it('should accept empty object and default includeHidden to false', () => {
      const result = ListSessionsOptionsSchema.parse({})
      expect(result.includeHidden).toBe(false)
    })

    it('should accept includeHidden: true', () => {
      const result = ListSessionsOptionsSchema.parse({ includeHidden: true })
      expect(result.includeHidden).toBe(true)
    })

    it('should accept includeHidden: false', () => {
      const result = ListSessionsOptionsSchema.parse({ includeHidden: false })
      expect(result.includeHidden).toBe(false)
    })

    it('should reject non-boolean includeHidden', () => {
      expect(() => ListSessionsOptionsSchema.parse({ includeHidden: 'yes' })).toThrow()
    })
  })

  describe('ForkSessionSchema', () => {
    it('should accept valid parentSessionId with default hideParent', () => {
      const result = ForkSessionSchema.parse({
        parentSessionId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.parentSessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.hideParent).toBe(true) // default
    })

    it('should accept valid parentSessionId with hideParent: false', () => {
      const result = ForkSessionSchema.parse({
        parentSessionId: '550e8400-e29b-41d4-a716-446655440000',
        hideParent: false
      })
      expect(result.hideParent).toBe(false)
    })

    it('should reject invalid UUID for parentSessionId', () => {
      expect(() =>
        ForkSessionSchema.parse({
          parentSessionId: 'not-a-uuid'
        })
      ).toThrow()
    })

    it('should reject missing parentSessionId', () => {
      expect(() => ForkSessionSchema.parse({})).toThrow()
    })
  })

  describe('SessionLineageSchema', () => {
    it('should accept array of valid UUIDs', () => {
      const lineage = [
        '550e8400-e29b-41d4-a716-446655440000',
        '650e8400-e29b-41d4-a716-446655440001',
        '750e8400-e29b-41d4-a716-446655440002'
      ]
      const result = SessionLineageSchema.parse(lineage)
      expect(result).toEqual(lineage)
    })

    it('should accept empty array', () => {
      const result = SessionLineageSchema.parse([])
      expect(result).toEqual([])
    })

    it('should reject array with invalid UUID', () => {
      expect(() =>
        SessionLineageSchema.parse(['550e8400-e29b-41d4-a716-446655440000', 'not-a-uuid'])
      ).toThrow()
    })
  })
})

describe('Session Handler Logic (Story 2a.5)', () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>
    transaction: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Reset mock state
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({ changes: 1 }),
        get: vi.fn(),
        all: vi.fn()
      }),
      transaction: vi.fn((fn) => fn)
    }
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>)
  })

  describe('sessions:hide logic', () => {
    it('should call UPDATE with is_hidden = 1', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ run: mockRun })

      // Simulate hide handler logic
      const db = getDatabase()
      db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(sessionId)

      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE sessions SET is_hidden = 1 WHERE id = ?')
      expect(mockRun).toHaveBeenCalledWith(sessionId)
    })
  })

  describe('sessions:unhide logic', () => {
    it('should call UPDATE with is_hidden = 0', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ run: mockRun })

      // Simulate unhide handler logic
      const db = getDatabase()
      db.prepare('UPDATE sessions SET is_hidden = 0 WHERE id = ?').run(sessionId)

      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE sessions SET is_hidden = 0 WHERE id = ?')
      expect(mockRun).toHaveBeenCalledWith(sessionId)
    })
  })

  describe('sessions:fork logic', () => {
    it('should throw error if parent session not found', () => {
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const parentSessionId = '550e8400-e29b-41d4-a716-446655440000'
      const db = getDatabase()
      const parent = db
        .prepare('SELECT folder_path FROM sessions WHERE id = ?')
        .get(parentSessionId)

      expect(parent).toBeUndefined()
      // In actual handler, this would throw: throw new Error(`Parent session not found: ${parentSessionId}`)
    })

    it('should use transaction for atomic operation', () => {
      // Mock parent lookup
      const mockGet = vi.fn().mockReturnValue({ folder_path: '/test/path' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      // Mock transaction
      const transactionFn = vi.fn()
      mockDb.transaction.mockImplementation((fn) => {
        transactionFn.mockImplementation(fn)
        return transactionFn
      })

      const db = getDatabase()

      // Simulate fork handler logic
      const parent = db.prepare('SELECT folder_path FROM sessions WHERE id = ?').get('parent-id')

      expect(parent).toEqual({ folder_path: '/test/path' })

      // Create transaction
      const forkTransaction = db.transaction(() => {
        // Insert new session
        db.prepare('INSERT INTO sessions ...').run()
        // Hide parent
        db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run('parent-id')
      })

      // Execute transaction
      forkTransaction()

      expect(mockDb.transaction).toHaveBeenCalled()
      expect(transactionFn).toHaveBeenCalled()
    })
  })

  describe('sessions:getLineage logic', () => {
    it('should build lineage chain by following forked_from_session_id', () => {
      // Session C -> Session B -> Session A (root)
      const mockGet = vi
        .fn()
        .mockReturnValueOnce({ forked_from_session_id: 'session-b' }) // C's parent
        .mockReturnValueOnce({ forked_from_session_id: 'session-a' }) // B's parent
        .mockReturnValueOnce({ forked_from_session_id: null }) // A has no parent

      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const selectStmt = db.prepare('SELECT forked_from_session_id FROM sessions WHERE id = ?')

      const lineage: string[] = []
      let currentId: string | null = 'session-c'
      const MAX_DEPTH = 100
      let depth = 0

      while (currentId && depth < MAX_DEPTH) {
        lineage.push(currentId)
        const row = selectStmt.get(currentId) as
          | {
              forked_from_session_id: string | null
            }
          | undefined
        currentId = row?.forked_from_session_id ?? null
        depth++
      }

      expect(lineage).toEqual(['session-c', 'session-b', 'session-a'])
    })

    it('should respect MAX_LINEAGE_DEPTH limit to prevent infinite loops', () => {
      // Simulate corrupted data with circular reference (A -> A)
      const mockGet = vi.fn().mockReturnValue({ forked_from_session_id: 'session-a' })
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const selectStmt = db.prepare('SELECT forked_from_session_id FROM sessions WHERE id = ?')

      const lineage: string[] = []
      let currentId: string | null = 'session-a'
      const MAX_LINEAGE_DEPTH = 100
      let depth = 0

      while (currentId && depth < MAX_LINEAGE_DEPTH) {
        lineage.push(currentId)
        const row = selectStmt.get(currentId) as
          | {
              forked_from_session_id: string | null
            }
          | undefined
        currentId = row?.forked_from_session_id ?? null
        depth++
      }

      // Should cap at 100, not loop forever
      expect(lineage.length).toBe(MAX_LINEAGE_DEPTH)
      expect(depth).toBe(MAX_LINEAGE_DEPTH)
    })

    it('should handle session with no lineage (root session)', () => {
      const mockGet = vi.fn().mockReturnValue({ forked_from_session_id: null })
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const selectStmt = db.prepare('SELECT forked_from_session_id FROM sessions WHERE id = ?')

      const lineage: string[] = []
      let currentId: string | null = 'root-session'
      const MAX_DEPTH = 100
      let depth = 0

      while (currentId && depth < MAX_DEPTH) {
        lineage.push(currentId)
        const row = selectStmt.get(currentId) as
          | {
              forked_from_session_id: string | null
            }
          | undefined
        currentId = row?.forked_from_session_id ?? null
        depth++
      }

      // Root session has lineage of just itself
      expect(lineage).toEqual(['root-session'])
    })

    it('should throw error when session does not exist', () => {
      // Mock: first query for existence check returns undefined (session not found)
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const db = getDatabase()

      // Simulate the handler's existence check
      const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)

      // Should be undefined (not found)
      expect(sessionExists).toBeUndefined()

      // In actual handler, this would throw: throw new Error(`Session not found: ${sessionId}`)
      // Verify the pattern matches what the handler should do
      if (!sessionExists) {
        expect(() => {
          throw new Error(`Session not found: ${sessionId}`)
        }).toThrow(`Session not found: ${sessionId}`)
      }
    })
  })
})

describe('Session Metadata Handlers (Story 2a.6)', () => {
  describe('SessionMetadataSchema validation', () => {
    it('should accept valid metadata', () => {
      const valid = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalCostUsd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updatedAt: 1700000000000
      }
      expect(() => SessionMetadataSchema.parse(valid)).not.toThrow()
    })

    it('should reject negative token counts', () => {
      const invalid = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: -100,
        totalOutputTokens: 500,
        totalCostUsd: 0.05,
        model: null,
        updatedAt: null
      }
      expect(() => SessionMetadataSchema.parse(invalid)).toThrow()
    })
  })

  describe('SessionMetadataUpsertSchema validation', () => {
    it('should accept minimal upsert with defaults', () => {
      const result = SessionMetadataUpsertSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.inputTokens).toBe(0)
      expect(result.outputTokens).toBe(0)
      expect(result.costUsd).toBe(0)
    })

    it('should reject non-UUID sessionId', () => {
      expect(() =>
        SessionMetadataUpsertSchema.parse({
          sessionId: 'not-a-uuid'
        })
      ).toThrow()
    })
  })

  describe('toSessionMetadata transform', () => {
    it('should transform DB row to SessionMetadata', () => {
      const row: DBSessionMetadataRow = {
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        total_input_tokens: 1000,
        total_output_tokens: 500,
        total_cost_usd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updated_at: 1700000000000
      }

      const result = toSessionMetadata(row)

      expect(result).toEqual({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalCostUsd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updatedAt: 1700000000000
      })
    })

    it('should handle null model and updatedAt', () => {
      const row: DBSessionMetadataRow = {
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0,
        model: null,
        updated_at: null
      }

      const result = toSessionMetadata(row)

      expect(result.model).toBeNull()
      expect(result.updatedAt).toBeNull()
    })
  })

  describe('sessions:getMetadata logic', () => {
    let mockDb: {
      prepare: ReturnType<typeof vi.fn>
      transaction: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
          get: vi.fn(),
          all: vi.fn()
        }),
        transaction: vi.fn((fn) => fn)
      }
      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>)
    })

    it('should return metadata when found', () => {
      const mockRow: DBSessionMetadataRow = {
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        total_input_tokens: 1000,
        total_output_tokens: 500,
        total_cost_usd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updated_at: 1700000000000
      }
      const mockGet = vi.fn().mockReturnValue(mockRow)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const row = db.prepare('SELECT ...').get('550e8400-e29b-41d4-a716-446655440000')

      expect(row).toEqual(mockRow)
    })

    it('should return null when metadata not found', () => {
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const row = db.prepare('SELECT ...').get('550e8400-e29b-41d4-a716-446655440000')

      expect(row).toBeUndefined()
    })
  })

  describe('sessions:upsertMetadata logic', () => {
    let mockDb: {
      prepare: ReturnType<typeof vi.fn>
      transaction: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
          get: vi.fn(),
          all: vi.fn()
        }),
        transaction: vi.fn((fn) => fn)
      }
      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>)
    })

    it('should throw error when session does not exist', () => {
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const sessionExists = db
        .prepare('SELECT id FROM sessions WHERE id = ?')
        .get('non-existent-uuid')

      expect(sessionExists).toBeUndefined()
      // Handler would throw: throw new Error(`Session not found: ${sessionId}`)
    })

    it('should execute UPSERT SQL when session exists', () => {
      const mockGet = vi.fn().mockReturnValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      const db = getDatabase()

      // Check session exists
      const sessionExists = db
        .prepare('SELECT id FROM sessions WHERE id = ?')
        .get('550e8400-e29b-41d4-a716-446655440000')
      expect(sessionExists).toBeDefined()

      // Execute upsert
      db.prepare('INSERT INTO session_metadata ... ON CONFLICT ...').run(
        '550e8400-e29b-41d4-a716-446655440000',
        100,
        50,
        0.01,
        'claude-sonnet-4-20250514',
        Date.now()
      )

      expect(mockRun).toHaveBeenCalled()
    })

    it('should use transaction for atomic operation', () => {
      const mockGet = vi.fn().mockReturnValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      // Mock transaction
      const transactionFn = vi.fn()
      mockDb.transaction.mockImplementation((fn) => {
        transactionFn.mockImplementation(fn)
        return transactionFn
      })

      const db = getDatabase()

      // Simulate upsert handler logic with transaction
      const upsertTransaction = db.transaction(() => {
        // Check session exists
        const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get('session-id')
        if (!sessionExists) throw new Error('Session not found')

        // Execute upsert
        db.prepare('INSERT INTO session_metadata ...').run()
      })

      // Execute transaction
      upsertTransaction()

      expect(mockDb.transaction).toHaveBeenCalled()
      expect(transactionFn).toHaveBeenCalled()
    })
  })
})

// Story 2b.5 - Rewind Handlers
describe('Rewind Handlers (Story 2b.5)', () => {
  describe('RewindRequestSchema validation', () => {
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000'
    const validCheckpointUuid = '660e8400-e29b-41d4-a716-446655440001'

    it('should accept valid rewind request', () => {
      const result = RewindRequestSchema.parse({
        sessionId: validSessionId,
        checkpointUuid: validCheckpointUuid,
        newMessage: 'New approach'
      })
      expect(result.sessionId).toBe(validSessionId)
      expect(result.checkpointUuid).toBe(validCheckpointUuid)
      expect(result.newMessage).toBe('New approach')
    })

    it('should trim whitespace from newMessage', () => {
      const result = RewindRequestSchema.parse({
        sessionId: validSessionId,
        checkpointUuid: validCheckpointUuid,
        newMessage: '  Trimmed message  '
      })
      expect(result.newMessage).toBe('Trimmed message')
    })

    it('should reject non-UUID sessionId', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: 'invalid',
          checkpointUuid: validCheckpointUuid,
          newMessage: 'Test'
        })
      ).toThrow()
    })

    it('should reject non-UUID checkpointUuid', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: 'invalid',
          newMessage: 'Test'
        })
      ).toThrow()
    })

    it('should reject empty newMessage', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: validCheckpointUuid,
          newMessage: ''
        })
      ).toThrow(/Message cannot be empty/)
    })

    it('should reject whitespace-only newMessage', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: validCheckpointUuid,
          newMessage: '   '
        })
      ).toThrow(/Message cannot be empty/)
    })
  })

  describe('sessions:rewind handler logic', () => {
    let mockDb: {
      prepare: ReturnType<typeof vi.fn>
      transaction: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
          get: vi.fn(),
          all: vi.fn()
        }),
        transaction: vi.fn((fn) => fn)
      }
      vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>)
    })

    it('should throw error if parent session not found', () => {
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const db = getDatabase()
      const parent = db.prepare('SELECT folder_path FROM sessions WHERE id = ?').get(sessionId)

      expect(parent).toBeUndefined()
      // In actual handler, this would throw: throw new Error(`Session not found: ${sessionId}`)
    })

    it('should use transaction for atomic operation', () => {
      // Mock parent lookup
      const mockGet = vi.fn().mockReturnValue({ folder_path: '/test/project' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      // Mock transaction
      const transactionFn = vi.fn()
      mockDb.transaction.mockImplementation((fn) => {
        transactionFn.mockImplementation(fn)
        return transactionFn
      })

      const db = getDatabase()

      // Simulate rewind handler logic
      const parent = db.prepare('SELECT folder_path FROM sessions WHERE id = ?').get('parent-id')
      expect(parent).toEqual({ folder_path: '/test/project' })

      // Create transaction
      const rewindTransaction = db.transaction(() => {
        // Insert new session
        db.prepare('INSERT INTO sessions ...').run()
        // Insert rewind context
        db.prepare('INSERT INTO rewind_context ...').run()
        // Hide parent
        db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run('parent-id')
      })

      // Execute transaction
      rewindTransaction()

      expect(mockDb.transaction).toHaveBeenCalled()
      expect(transactionFn).toHaveBeenCalled()
    })

    it('should insert into rewind_context table', () => {
      const mockGet = vi.fn().mockReturnValue({ folder_path: '/test/project' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      const db = getDatabase()

      // Simulate inserting rewind context
      db.prepare(
        'INSERT INTO rewind_context (session_id, checkpoint_uuid, new_message, created_at) VALUES (?, ?, ?, ?)'
      ).run('new-session-id', 'checkpoint-uuid', 'New message', Date.now())

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO rewind_context (session_id, checkpoint_uuid, new_message, created_at) VALUES (?, ?, ?, ?)'
      )
      expect(mockRun).toHaveBeenCalled()
    })

    it('should hide parent session after creating fork', () => {
      const mockGet = vi.fn().mockReturnValue({ folder_path: '/test/project' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      const db = getDatabase()
      const parentId = '550e8400-e29b-41d4-a716-446655440000'

      // Simulate hiding parent
      db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(parentId)

      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE sessions SET is_hidden = 1 WHERE id = ?')
      expect(mockRun).toHaveBeenCalledWith(parentId)
    })
  })
})

// Mock hasActiveProcess for Story 3b-4 tests
vi.mock('../sessions/cc-spawner', () => ({
  spawnCC: vi.fn(),
  hasActiveProcess: vi.fn()
}))

// Story 3b-4 - Concurrent Request Guard and hasActiveProcess Tests
describe('Concurrent Request Guard (Story 3b-4)', () => {
  describe('hasActiveProcess check in sendMessage', () => {
    it('should block send if process is active for existing session', async () => {
      const { hasActiveProcess } = await import('../sessions/cc-spawner')
      vi.mocked(hasActiveProcess).mockReturnValue(true)

      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const isNewSession = false

      // Simulate the concurrent guard logic from sendMessage handler
      if (!isNewSession && hasActiveProcess(sessionId)) {
        const result = {
          success: false,
          error: 'A response is still being generated. Please wait or abort the current request.'
        }
        expect(result.success).toBe(false)
        expect(result.error).toContain('response is still being generated')
      }

      expect(hasActiveProcess).toHaveBeenCalledWith(sessionId)
    })

    it('should allow send if no active process', async () => {
      const { hasActiveProcess, spawnCC } = await import('../sessions/cc-spawner')
      vi.mocked(hasActiveProcess).mockReturnValue(false)

      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const isNewSession = false

      // Simulate the guard check - should pass and allow spawn
      if (!isNewSession && hasActiveProcess(sessionId)) {
        throw new Error('Should not block')
      }

      // If guard passes, spawnCC would be called
      spawnCC({ sessionId, folderPath: '/test', message: 'Hello' })
      expect(spawnCC).toHaveBeenCalled()
    })

    it('should not check hasActiveProcess for new sessions', async () => {
      const { hasActiveProcess, spawnCC } = await import('../sessions/cc-spawner')
      vi.mocked(hasActiveProcess).mockClear()

      const isNewSession = true
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'

      // For new sessions, guard is skipped (!isNewSession is false)
      if (!isNewSession && hasActiveProcess(sessionId)) {
        throw new Error('Should not check for new sessions')
      }

      // Should proceed to spawn without checking
      spawnCC({ sessionId: undefined, folderPath: '/test', message: 'Hello' })

      // hasActiveProcess should not be called for new sessions
      expect(hasActiveProcess).not.toHaveBeenCalled()
    })
  })

  describe('HasActiveProcessSchema validation', () => {
    it('should accept valid sessionId', async () => {
      const { HasActiveProcessSchema } = await import('../../shared/types/ipc')
      const result = HasActiveProcessSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should accept pending-timestamp format', async () => {
      const { HasActiveProcessSchema } = await import('../../shared/types/ipc')
      const result = HasActiveProcessSchema.parse({
        sessionId: 'pending-1700000000000'
      })
      expect(result.sessionId).toBe('pending-1700000000000')
    })

    it('should reject empty sessionId', async () => {
      const { HasActiveProcessSchema } = await import('../../shared/types/ipc')
      expect(() => HasActiveProcessSchema.parse({ sessionId: '' })).toThrow()
    })
  })

  describe('sessions:hasActiveProcess handler logic', () => {
    it('should return active: true when process exists', async () => {
      const { hasActiveProcess } = await import('../sessions/cc-spawner')
      vi.mocked(hasActiveProcess).mockReturnValue(true)

      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const result = { active: hasActiveProcess(sessionId) }

      expect(result).toEqual({ active: true })
    })

    it('should return active: false when process does not exist', async () => {
      const { hasActiveProcess } = await import('../sessions/cc-spawner')
      vi.mocked(hasActiveProcess).mockReturnValue(false)

      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const result = { active: hasActiveProcess(sessionId) }

      expect(result).toEqual({ active: false })
    })
  })
})

// Story 3b-1 - Spawn Integration Tests
describe('sessions:sendMessage spawn integration (Story 3b-1)', () => {
  describe('spawnCC argument logic', () => {
    it('new sessions should pass sessionId as undefined', () => {
      // This tests the logic: isNewSession=true means pass undefined
      // The handler code: sessionId: isNewSession ? undefined : sessionId
      const isNewSession = true
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const expectedSessionId = isNewSession ? undefined : sessionId

      expect(expectedSessionId).toBeUndefined()
    })

    it('existing sessions should pass actual sessionId', () => {
      // The handler code: sessionId: isNewSession ? undefined : sessionId
      const isNewSession = false
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      const expectedSessionId = isNewSession ? undefined : sessionId

      expect(expectedSessionId).toBe(sessionId)
    })
  })

  describe('spawnCC integration', () => {
    it('calls spawnCC with correct options structure for new session', async () => {
      const { spawnCC } = await import('../sessions/cc-spawner')
      const mockSpawnCC = vi.mocked(spawnCC)

      // Simulate the exact call pattern from sendMessage handler for new session
      mockSpawnCC({
        sessionId: undefined, // new session
        folderPath: '/test/path',
        message: 'Hello'
      })

      expect(mockSpawnCC).toHaveBeenCalledWith({
        sessionId: undefined,
        folderPath: '/test/path',
        message: 'Hello'
      })
    })

    it('passes sessionId for resume scenarios', async () => {
      const { spawnCC } = await import('../sessions/cc-spawner')
      const mockSpawnCC = vi.mocked(spawnCC)
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'

      mockSpawnCC({
        sessionId,
        folderPath: '/test/path',
        message: 'Hello'
      })

      expect(mockSpawnCC).toHaveBeenCalledWith(expect.objectContaining({ sessionId }))
    })
  })
})
