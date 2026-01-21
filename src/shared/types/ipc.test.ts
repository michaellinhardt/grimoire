import { describe, it, expect } from 'vitest'
import { SessionIdSchema, SpawnRequestSchema, SessionSchema, FolderSchema } from './ipc'

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
})
