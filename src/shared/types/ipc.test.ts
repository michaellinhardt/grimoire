import { describe, it, expect } from 'vitest'
import {
  SessionIdSchema,
  SpawnRequestSchema,
  SessionSchema,
  FolderSchema,
  TerminateRequestSchema,
  DiscoveredSessionSchema,
  ScanResultSchema,
  SyncResultSchema,
  SessionWithExistsSchema,
  SyncRequestSchema,
  SessionMetadataSchema,
  SessionMetadataUpsertSchema,
  RewindRequestSchema
} from './ipc'

describe('IPC Schemas', () => {
  describe('SessionIdSchema', () => {
    it('accepts valid UUID', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000'
      expect(() => SessionIdSchema.parse(validId)).not.toThrow()
    })

    it('rejects invalid UUID', () => {
      expect(() => SessionIdSchema.parse('not-a-uuid')).toThrow()
      expect(() => SessionIdSchema.parse('')).toThrow()
      expect(() => SessionIdSchema.parse(123)).toThrow()
    })
  })

  describe('SpawnRequestSchema', () => {
    it('accepts valid spawn request', () => {
      const validRequest = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Hello, Claude',
        folderPath: '/Users/test/project'
      }
      expect(() => SpawnRequestSchema.parse(validRequest)).not.toThrow()
    })

    it('rejects empty message', () => {
      const invalidRequest = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        message: '',
        folderPath: '/Users/test/project'
      }
      expect(() => SpawnRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('rejects invalid session ID', () => {
      const invalidRequest = {
        sessionId: 'not-a-uuid',
        message: 'Hello',
        folderPath: '/Users/test/project'
      }
      expect(() => SpawnRequestSchema.parse(invalidRequest)).toThrow()
    })
  })

  describe('SessionSchema', () => {
    it('accepts valid session', () => {
      const validSession = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        folderPath: '/Users/test/project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: null,
        archived: false,
        isPinned: false,
        forkedFromSessionId: null,
        isHidden: false
      }
      expect(() => SessionSchema.parse(validSession)).not.toThrow()
    })

    it('rejects session with missing required fields', () => {
      const invalidSession = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      }
      expect(() => SessionSchema.parse(invalidSession)).toThrow()
    })
  })

  describe('FolderSchema', () => {
    it('accepts valid folder', () => {
      const validFolder = {
        path: '/Users/test/project',
        isPinned: false,
        lastAccessedAt: Date.now()
      }
      expect(() => FolderSchema.parse(validFolder)).not.toThrow()
    })

    it('accepts folder with null lastAccessedAt', () => {
      const validFolder = {
        path: '/Users/test/project',
        isPinned: true,
        lastAccessedAt: null
      }
      expect(() => FolderSchema.parse(validFolder)).not.toThrow()
    })
  })

  describe('TerminateRequestSchema', () => {
    it('accepts valid UUID', () => {
      const validRequest = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000'
      }
      expect(() => TerminateRequestSchema.parse(validRequest)).not.toThrow()
    })

    it('rejects non-UUID string', () => {
      const invalidRequest = {
        sessionId: 'not-a-uuid'
      }
      expect(() => TerminateRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('rejects empty string', () => {
      const invalidRequest = {
        sessionId: ''
      }
      expect(() => TerminateRequestSchema.parse(invalidRequest)).toThrow()
    })
  })

  // Story 2a.1 - Session Scanning Schemas
  describe('DiscoveredSessionSchema', () => {
    it('accepts valid discovered session', () => {
      const valid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        filePath: '/path/to/session.jsonl',
        folderPath: '/Users/test/project',
        createdAt: 1700000000000,
        updatedAt: 1700000001000
      }
      expect(() => DiscoveredSessionSchema.parse(valid)).not.toThrow()
    })

    it('rejects non-UUID id', () => {
      const invalid = {
        id: 'not-a-uuid',
        filePath: '/path/to/session.jsonl',
        folderPath: '/Users/test/project',
        createdAt: 1700000000000,
        updatedAt: 1700000001000
      }
      expect(() => DiscoveredSessionSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required fields', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      }
      expect(() => DiscoveredSessionSchema.parse(invalid)).toThrow()
    })
  })

  describe('ScanResultSchema', () => {
    it('accepts valid scan result with sessions', () => {
      const valid = {
        sessions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            filePath: '/path/to/session.jsonl',
            folderPath: '/Users/test/project',
            createdAt: 1700000000000,
            updatedAt: 1700000001000
          }
        ]
      }
      expect(() => ScanResultSchema.parse(valid)).not.toThrow()
    })

    it('accepts empty sessions array', () => {
      const valid = { sessions: [] }
      expect(() => ScanResultSchema.parse(valid)).not.toThrow()
    })

    it('rejects missing sessions array', () => {
      const invalid = {}
      expect(() => ScanResultSchema.parse(invalid)).toThrow()
    })
  })

  describe('SyncResultSchema', () => {
    it('accepts valid sync result', () => {
      const valid = {
        added: 5,
        updated: 3,
        orphaned: 1,
        errors: []
      }
      expect(() => SyncResultSchema.parse(valid)).not.toThrow()
    })

    it('accepts sync result with errors', () => {
      const valid = {
        added: 0,
        updated: 0,
        orphaned: 0,
        errors: ['Error 1', 'Error 2']
      }
      expect(() => SyncResultSchema.parse(valid)).not.toThrow()
    })

    it('rejects missing counts', () => {
      const invalid = {
        added: 5
      }
      expect(() => SyncResultSchema.parse(invalid)).toThrow()
    })

    it('rejects non-number counts', () => {
      const invalid = {
        added: '5',
        updated: 3,
        orphaned: 1,
        errors: []
      }
      expect(() => SyncResultSchema.parse(invalid)).toThrow()
    })
  })

  describe('SyncRequestSchema', () => {
    it('accepts valid sync request', () => {
      const valid = {
        sessions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            filePath: '/path/to/session.jsonl',
            folderPath: '/Users/test/project',
            createdAt: 1700000000000,
            updatedAt: 1700000001000
          }
        ]
      }
      expect(() => SyncRequestSchema.parse(valid)).not.toThrow()
    })

    it('accepts empty sessions array', () => {
      const valid = { sessions: [] }
      expect(() => SyncRequestSchema.parse(valid)).not.toThrow()
    })
  })

  describe('SessionWithExistsSchema', () => {
    it('accepts session with exists flag', () => {
      const valid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        folderPath: '/Users/test/project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: null,
        archived: false,
        isPinned: false,
        forkedFromSessionId: null,
        isHidden: false,
        exists: true
      }
      expect(() => SessionWithExistsSchema.parse(valid)).not.toThrow()
    })

    it('accepts session with exists false (orphaned)', () => {
      const valid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        folderPath: '/nonexistent/path',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: null,
        archived: false,
        isPinned: false,
        forkedFromSessionId: null,
        isHidden: false,
        exists: false
      }
      expect(() => SessionWithExistsSchema.parse(valid)).not.toThrow()
    })

    it('rejects missing exists flag', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        folderPath: '/Users/test/project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: null,
        archived: false,
        isPinned: false,
        forkedFromSessionId: null,
        isHidden: false
      }
      expect(() => SessionWithExistsSchema.parse(invalid)).toThrow()
    })
  })

  // Story 2a.6 - Session Metadata Schemas
  describe('SessionMetadataSchema', () => {
    it('accepts valid metadata', () => {
      const valid = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalCostUsd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updatedAt: Date.now()
      }
      expect(() => SessionMetadataSchema.parse(valid)).not.toThrow()
    })

    it('accepts metadata with null model and updatedAt', () => {
      const valid = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        model: null,
        updatedAt: null
      }
      expect(() => SessionMetadataSchema.parse(valid)).not.toThrow()
    })

    it('rejects non-UUID sessionId', () => {
      expect(() =>
        SessionMetadataSchema.parse({
          sessionId: 'not-a-uuid',
          totalInputTokens: 100,
          totalOutputTokens: 50,
          totalCostUsd: 0.05,
          model: 'claude-sonnet-4-20250514',
          updatedAt: Date.now()
        })
      ).toThrow()
    })

    it('rejects negative token counts', () => {
      expect(() =>
        SessionMetadataSchema.parse({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          totalInputTokens: -100,
          totalOutputTokens: 50,
          totalCostUsd: 0.05,
          model: null,
          updatedAt: null
        })
      ).toThrow()
    })

    it('rejects negative cost', () => {
      expect(() =>
        SessionMetadataSchema.parse({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          totalInputTokens: 100,
          totalOutputTokens: 50,
          totalCostUsd: -0.05,
          model: null,
          updatedAt: null
        })
      ).toThrow()
    })
  })

  describe('SessionMetadataUpsertSchema', () => {
    it('accepts minimal upsert with only sessionId', () => {
      const result = SessionMetadataUpsertSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.inputTokens).toBe(0)
      expect(result.outputTokens).toBe(0)
      expect(result.costUsd).toBe(0)
      expect(result.model).toBeUndefined()
    })

    it('accepts full upsert with all fields', () => {
      const valid = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
        model: 'claude-sonnet-4-20250514'
      }
      expect(() => SessionMetadataUpsertSchema.parse(valid)).not.toThrow()
    })

    it('rejects non-UUID sessionId', () => {
      expect(() =>
        SessionMetadataUpsertSchema.parse({
          sessionId: 'invalid'
        })
      ).toThrow()
    })

    it('rejects negative inputTokens', () => {
      expect(() =>
        SessionMetadataUpsertSchema.parse({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          inputTokens: -100
        })
      ).toThrow()
    })

    it('rejects negative cost', () => {
      expect(() =>
        SessionMetadataUpsertSchema.parse({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          costUsd: -0.01
        })
      ).toThrow()
    })
  })

  // Story 2b.5 - Rewind Request Schema
  describe('RewindRequestSchema', () => {
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000'
    const validCheckpointUuid = '660e8400-e29b-41d4-a716-446655440001'

    it('accepts valid rewind request', () => {
      const valid = {
        sessionId: validSessionId,
        checkpointUuid: validCheckpointUuid,
        newMessage: 'Let me try a different approach'
      }
      const result = RewindRequestSchema.parse(valid)
      expect(result.sessionId).toBe(validSessionId)
      expect(result.checkpointUuid).toBe(validCheckpointUuid)
      expect(result.newMessage).toBe('Let me try a different approach')
    })

    it('trims whitespace from newMessage', () => {
      const valid = {
        sessionId: validSessionId,
        checkpointUuid: validCheckpointUuid,
        newMessage: '  Test message with spaces  '
      }
      const result = RewindRequestSchema.parse(valid)
      expect(result.newMessage).toBe('Test message with spaces')
    })

    it('rejects non-UUID sessionId', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: 'not-a-uuid',
          checkpointUuid: validCheckpointUuid,
          newMessage: 'Test'
        })
      ).toThrow()
    })

    it('rejects non-UUID checkpointUuid', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: 'not-a-uuid',
          newMessage: 'Test'
        })
      ).toThrow()
    })

    it('rejects empty newMessage', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: validCheckpointUuid,
          newMessage: ''
        })
      ).toThrow(/Message cannot be empty/)
    })

    it('rejects whitespace-only newMessage', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: validCheckpointUuid,
          newMessage: '   '
        })
      ).toThrow(/Message cannot be empty/)
    })

    it('rejects missing sessionId', () => {
      expect(() =>
        RewindRequestSchema.parse({
          checkpointUuid: validCheckpointUuid,
          newMessage: 'Test'
        })
      ).toThrow()
    })

    it('rejects missing checkpointUuid', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          newMessage: 'Test'
        })
      ).toThrow()
    })

    it('rejects missing newMessage', () => {
      expect(() =>
        RewindRequestSchema.parse({
          sessionId: validSessionId,
          checkpointUuid: validCheckpointUuid
        })
      ).toThrow()
    })
  })
})
