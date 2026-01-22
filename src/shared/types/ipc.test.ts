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
  SyncRequestSchema
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
})
