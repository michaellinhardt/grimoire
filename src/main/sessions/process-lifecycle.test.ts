/**
 * Process Lifecycle Integration Tests (Story 3b-4)
 *
 * Tests the complete request-response process lifecycle:
 * - Process spawns on sendMessage
 * - Process exits naturally after response
 * - Concurrent request blocking
 * - Session resume with --resume flag
 * - Process registry accuracy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChildProcess } from 'child_process'
import { EventEmitter, Readable, Writable } from 'stream'

// Hoisted mock functions
const { spawnMock, mockProcessRegistry, mockInstanceStateManager, mockDatabase } = vi.hoisted(
  () => ({
    spawnMock: vi.fn(),
    mockProcessRegistry: new Map(),
    mockInstanceStateManager: {
      transition: vi.fn().mockReturnValue('working'),
      transferState: vi.fn()
    },
    mockDatabase: {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn()
      })
    }
  })
)

// Mock child_process
vi.mock('child_process', () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock }
}))

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData')
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock process-registry
vi.mock('../process-registry', () => ({
  processRegistry: mockProcessRegistry
}))

// Mock instance-state-manager
vi.mock('./instance-state-manager', () => ({
  instanceStateManager: mockInstanceStateManager
}))

// Mock database
vi.mock('../db', () => ({
  getDatabase: vi.fn(() => mockDatabase)
}))

import { BrowserWindow } from 'electron'
import { processRegistry } from '../process-registry'
import { spawnCC, hasActiveProcess } from './cc-spawner'

describe('Process Lifecycle (Story 3b-4)', () => {
  let mockChildProcess: Partial<ChildProcess> & EventEmitter
  let mockStdin: Writable
  let mockStdout: Readable
  let mockStderr: Readable
  let mockWindow: { webContents: { send: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.clearAllMocks()
    processRegistry.clear()

    // Create mock streams
    mockStdin = new Writable({
      write: vi.fn((_chunk, _encoding, callback) => {
        callback()
      })
    })
    mockStdout = new Readable({ read: vi.fn() })
    mockStderr = new Readable({ read: vi.fn() })

    // Create mock child process
    mockChildProcess = new EventEmitter() as Partial<ChildProcess> & EventEmitter
    mockChildProcess.stdin = mockStdin
    mockChildProcess.stdout = mockStdout
    mockChildProcess.stderr = mockStderr
    Object.defineProperty(mockChildProcess, 'pid', { value: 12345, writable: true })
    Object.defineProperty(mockChildProcess, 'killed', { value: false, writable: true })

    spawnMock.mockReturnValue(mockChildProcess as ChildProcess)

    // Setup mock window
    mockWindow = { webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
      mockWindow as unknown as Electron.BrowserWindow
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AC1: Fresh process per message', () => {
    it('spawns a new process when sendMessage triggers', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(spawnMock).toHaveBeenCalledTimes(1)
      expect(processRegistry.size).toBe(1)
    })

    it('process runs to completion and exits naturally', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(processRegistry.has(sessionId)).toBe(true)

      // Simulate process exit (natural completion)
      mockChildProcess.emit('exit', 0, null)

      expect(processRegistry.has(sessionId)).toBe(false)
    })

    it('no idle process remains running after response', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const key = Array.from(processRegistry.keys())[0]
      expect(processRegistry.size).toBe(1)

      // Simulate process exit
      mockChildProcess.emit('exit', 0, null)

      expect(processRegistry.size).toBe(0)
      expect(processRegistry.has(key)).toBe(false)
    })
  })

  describe('AC2: Natural process exit on completion', () => {
    it('session returns to Idle state on completion', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      mockChildProcess.emit('exit', 0, null)

      // Should transition to idle via PROCESS_EXIT action
      expect(mockInstanceStateManager.transition).toHaveBeenCalledWith(sessionId, 'PROCESS_EXIT')
    })

    it('emits stream:end on process completion', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      mockChildProcess.emit('exit', 0, null)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          sessionId,
          success: true
        })
      )
    })

    it('next message will spawn a fresh process', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'

      // First message
      spawnCC({ sessionId, folderPath: '/test/path', message: 'First' })
      expect(spawnMock).toHaveBeenCalledTimes(1)

      // Complete the first message
      mockChildProcess.emit('exit', 0, null)
      expect(processRegistry.size).toBe(0)

      // Create a new mock for the second spawn
      const mockChildProcess2 = new EventEmitter() as Partial<ChildProcess> & EventEmitter
      const mockStdin2 = new Writable({
        write: vi.fn((_chunk, _encoding, callback) => callback())
      })
      mockChildProcess2.stdin = mockStdin2
      mockChildProcess2.stdout = new Readable({ read: vi.fn() })
      mockChildProcess2.stderr = new Readable({ read: vi.fn() })
      Object.defineProperty(mockChildProcess2, 'pid', { value: 12346, writable: true })
      Object.defineProperty(mockChildProcess2, 'killed', { value: false, writable: true })
      spawnMock.mockReturnValue(mockChildProcess2 as ChildProcess)

      // Second message - should spawn fresh process
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Second' })
      expect(spawnMock).toHaveBeenCalledTimes(2)
      expect(processRegistry.size).toBe(1)
    })
  })

  describe('AC3: Session resume with fresh process', () => {
    it('passes --resume flag for existing sessions', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Resume test' })

      expect(spawnMock).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--resume', sessionId]),
        expect.any(Object)
      )
    })

    it('does not pass --resume flag for new sessions', () => {
      spawnCC({ folderPath: '/test/path', message: 'New session' })

      const args = spawnMock.mock.calls[0][1] as string[]
      expect(args).not.toContain('--resume')
    })

    it('CC resumes conversation context automatically with sessionId', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Continue' })

      // Verify correct arguments were passed
      const callArgs = spawnMock.mock.calls[0]
      const args = callArgs[1] as string[]
      const resumeIndex = args.indexOf('--resume')
      expect(resumeIndex).toBeGreaterThan(-1)
      expect(args[resumeIndex + 1]).toBe(sessionId)
    })
  })

  describe('AC4: Concurrent request guard', () => {
    it('hasActiveProcess returns true when process is running', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(hasActiveProcess(sessionId)).toBe(true)
    })

    it('hasActiveProcess returns false after process exits', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      mockChildProcess.emit('exit', 0, null)

      expect(hasActiveProcess(sessionId)).toBe(false)
    })

    it('hasActiveProcess returns false for unknown session', () => {
      expect(hasActiveProcess('unknown-session-id')).toBe(false)
    })
  })

  describe('AC5: Process cleanup on app quit', () => {
    // Note: Full shutdown tests require integration testing with the main process
    // These tests verify the processRegistry cleanup behavior

    it('processRegistry tracks all active processes', () => {
      const session1 = '550e8400-e29b-41d4-a716-446655440001'
      const session2 = '550e8400-e29b-41d4-a716-446655440002'

      spawnCC({ sessionId: session1, folderPath: '/test/path', message: 'Hello 1' })

      // Create new mock for second spawn
      const mockChild2 = new EventEmitter() as Partial<ChildProcess> & EventEmitter
      mockChild2.stdin = new Writable({
        write: vi.fn((_chunk, _encoding, callback) => callback())
      })
      mockChild2.stdout = new Readable({ read: vi.fn() })
      mockChild2.stderr = new Readable({ read: vi.fn() })
      Object.defineProperty(mockChild2, 'pid', { value: 12346, writable: true })
      Object.defineProperty(mockChild2, 'killed', { value: false, writable: true })
      spawnMock.mockReturnValue(mockChild2 as ChildProcess)

      spawnCC({ sessionId: session2, folderPath: '/test/path', message: 'Hello 2' })

      expect(processRegistry.size).toBe(2)
      expect(processRegistry.has(session1)).toBe(true)
      expect(processRegistry.has(session2)).toBe(true)
    })

    it('processes can be iterated for cleanup', () => {
      const session1 = '550e8400-e29b-41d4-a716-446655440001'
      spawnCC({ sessionId: session1, folderPath: '/test/path', message: 'Hello' })

      const entries = Array.from(processRegistry.entries())
      expect(entries.length).toBe(1)
      expect(entries[0][0]).toBe(session1)
      expect(entries[0][1]).toBe(mockChildProcess)
    })
  })

  describe('AC6: Process registry accuracy', () => {
    it('processRegistry is updated immediately on normal exit', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(processRegistry.has(sessionId)).toBe(true)

      mockChildProcess.emit('exit', 0, null)

      expect(processRegistry.has(sessionId)).toBe(false)
    })

    it('processRegistry is updated immediately on error exit', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const key = Array.from(processRegistry.keys())[0]
      expect(processRegistry.has(key)).toBe(true)

      mockChildProcess.emit('error', new Error('Spawn failed'))

      expect(processRegistry.has(key)).toBe(false)
    })

    it('processRegistry is updated on non-zero exit code', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(processRegistry.has(sessionId)).toBe(true)

      mockChildProcess.emit('exit', 1, null)

      expect(processRegistry.has(sessionId)).toBe(false)
    })

    it('sessions:getActiveProcesses returns accurate data', () => {
      const session1 = '550e8400-e29b-41d4-a716-446655440001'
      spawnCC({ sessionId: session1, folderPath: '/test/path', message: 'Hello' })

      // This simulates what sessions:getActiveProcesses returns
      const activeProcesses = Array.from(processRegistry.keys())
      expect(activeProcesses).toContain(session1)

      mockChildProcess.emit('exit', 0, null)

      const afterExit = Array.from(processRegistry.keys())
      expect(afterExit).not.toContain(session1)
    })
  })

  describe('State transfer for new sessions', () => {
    it('old temp key is deleted when real sessionId is captured', async () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const tempKey = Array.from(processRegistry.keys())[0]
      expect(tempKey).toMatch(/^pending-/)
      expect(processRegistry.has(tempKey)).toBe(true)

      // Simulate init event with real session ID
      const initEvent = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'real-session-id',
        tools: []
      })

      mockStdout.push(initEvent + '\n')
      mockStdout.push(null)

      await new Promise((resolve) => setImmediate(resolve))

      // Temp key should be deleted
      expect(processRegistry.has(tempKey)).toBe(false)
      // Real key should be present
      expect(processRegistry.has('real-session-id')).toBe(true)
    })

    it('no duplicate entries exist after state transfer', async () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const tempKey = Array.from(processRegistry.keys())[0]
      expect(processRegistry.size).toBe(1)

      // Simulate init event
      const initEvent = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'real-session-id',
        tools: []
      })

      mockStdout.push(initEvent + '\n')
      mockStdout.push(null)

      await new Promise((resolve) => setImmediate(resolve))

      // Should still have exactly one entry
      expect(processRegistry.size).toBe(1)
      expect(Array.from(processRegistry.keys())).not.toContain(tempKey)
      expect(processRegistry.has('real-session-id')).toBe(true)
    })
  })
})
