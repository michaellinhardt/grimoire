import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChildProcess } from 'child_process'
import { EventEmitter, Readable, Writable } from 'stream'

// Hoisted mock functions
const { spawnMock, mockProcessRegistry } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  mockProcessRegistry: new Map()
}))

// Mock child_process - need to provide all used exports
vi.mock('child_process', () => ({
  spawn: spawnMock,
  // Required for default export compatibility
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

// Mock process-registry with hoisted variable
vi.mock('../process-registry', () => ({
  processRegistry: mockProcessRegistry
}))

import { BrowserWindow } from 'electron'
import { processRegistry } from '../process-registry'
import { spawnCC } from './cc-spawner'

// Reference to spawn mock for assertions
const spawn = spawnMock

describe('cc-spawner', () => {
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

  describe('spawn arguments', () => {
    it('spawns claude with correct base arguments', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '-p',
          '--input-format',
          'stream-json',
          '--output-format',
          'stream-json',
          '--verbose',
          '--replay-user-messages',
          '--dangerously-skip-permissions'
        ]),
        expect.any(Object)
      )
    })

    it('includes --resume flag for existing sessions', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--resume', sessionId]),
        expect.any(Object)
      )
    })

    it('does not include --resume flag for new sessions', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const args = vi.mocked(spawn).mock.calls[0][1] as string[]
      expect(args).not.toContain('--resume')
    })

    it('sets working directory to folderPath', () => {
      spawnCC({ folderPath: '/custom/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: '/custom/path' })
      )
    })
  })

  describe('environment variables', () => {
    it('sets CLAUDE_CONFIG_DIR to userData/.claude', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CLAUDE_CONFIG_DIR: '/mock/userData/.claude'
          })
        })
      )
    })

    it('sets CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING to 1', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1'
          })
        })
      )
    })

    it('preserves existing process.env variables', () => {
      process.env.TEST_VAR = 'test-value'

      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            TEST_VAR: 'test-value'
          })
        })
      )

      delete process.env.TEST_VAR
    })
  })

  describe('stdin message', () => {
    it('writes message in correct JSON format with newline', () => {
      const writeSpy = vi.spyOn(mockStdin, 'write')
      spawnCC({ folderPath: '/test/path', message: 'Hello world' })

      // Write now has a callback for error handling (Issue #1)
      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Hello world' }
        }) + '\n',
        expect.any(Function)
      )
    })

    it('calls stdin.end() after writing message', () => {
      const endSpy = vi.spyOn(mockStdin, 'end')
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(endSpy).toHaveBeenCalled()
    })

    it('handles stdin write errors gracefully', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      // Simulate stdin error
      mockStdin.emit('error', new Error('Write failed'))

      // Should emit stream:end with error
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Failed to write to stdin')
        })
      )
    })
  })

  describe('process registry', () => {
    it('registers process with sessionId for existing sessions', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(processRegistry.has(sessionId)).toBe(true)
      expect(processRegistry.get(sessionId)).toBe(mockChildProcess)
    })

    it('registers process with temporary key for new sessions', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const keys = Array.from(processRegistry.keys())
      expect(keys.length).toBe(1)
      expect(keys[0]).toMatch(/^pending-\d+$/)
    })

    it('removes process from registry on exit', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      expect(processRegistry.has(sessionId)).toBe(true)

      mockChildProcess.emit('exit', 0, null)

      expect(processRegistry.has(sessionId)).toBe(false)
    })

    it('removes process from registry on error', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const key = Array.from(processRegistry.keys())[0]
      expect(processRegistry.has(key)).toBe(true)

      mockChildProcess.emit('error', new Error('Spawn failed'))

      expect(processRegistry.has(key)).toBe(false)
    })
  })

  describe('stream:init event', () => {
    it('emits stream:init when init event received from stdout', async () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      // Simulate init event from CC
      const initEvent = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'captured-session-id',
        tools: ['Read', 'Write']
      })

      // Push data to stdout
      mockStdout.push(initEvent + '\n')
      mockStdout.push(null)

      // Allow event loop to process
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:init',
        expect.objectContaining({
          sessionId: 'captured-session-id',
          tools: ['Read', 'Write']
        })
      )
    })

    it('updates registry key when new session ID captured', async () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const pendingKey = Array.from(processRegistry.keys())[0]
      expect(pendingKey).toMatch(/^pending-/)

      // Simulate init event
      const initEvent = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'captured-session-id',
        tools: []
      })

      mockStdout.push(initEvent + '\n')
      mockStdout.push(null)

      await new Promise((resolve) => setImmediate(resolve))

      expect(processRegistry.has(pendingKey)).toBe(false)
      expect(processRegistry.has('captured-session-id')).toBe(true)
    })
  })

  describe('stream:end event', () => {
    it('emits stream:end with success=true on exit code 0', () => {
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

    it('emits stream:end with error on non-zero exit', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      mockChildProcess.emit('exit', 1, null)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          sessionId,
          success: false,
          error: expect.stringContaining('Process exited with code 1')
        })
      )
    })

    it('emits stream:end with error on spawn failure', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      mockChildProcess.emit('error', new Error('ENOENT: command not found'))

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Failed to spawn Claude Code')
        })
      )
    })

    it('includes stderr in error message', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      // Simulate stderr output
      mockStderr.emit('data', Buffer.from('Error: Something went wrong'))

      mockChildProcess.emit('exit', 1, null)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          error: expect.stringContaining('Something went wrong')
        })
      )
    })

    it('limits stderr buffer to prevent memory exhaustion', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      // Simulate very large stderr output (exceeds 10KB limit)
      const largeOutput = 'X'.repeat(15 * 1024) // 15KB
      mockStderr.emit('data', Buffer.from(largeOutput))

      mockChildProcess.emit('exit', 1, null)

      // The error message should contain stderr but not the full 15KB
      const call = mockWindow.webContents.send.mock.calls.find(
        (c) => c[0] === 'stream:end' && c[1].success === false
      )
      expect(call).toBeDefined()
      const errorMsg = call?.[1]?.error as string
      // Should be truncated to ~10KB (10 * 1024 = 10240 characters max from stderr)
      expect(errorMsg.length).toBeLessThan(15 * 1024)
    })
  })

  describe('return value', () => {
    it('returns the child process', () => {
      const result = spawnCC({ folderPath: '/test/path', message: 'Hello' })
      expect(result).toBe(mockChildProcess)
    })
  })

  describe('platform-specific handling', () => {
    it('uses claude executable name', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith('claude', expect.any(Array), expect.any(Object))
    })
  })

  describe('spawn configuration', () => {
    it('sets correct cwd for child process (Issue #5)', () => {
      spawnCC({ folderPath: '/custom/working/dir', message: 'Hello' })

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/custom/working/dir'
        })
      )
    })
  })

  describe('stdin write backpressure handling', () => {
    it('handles backpressure with drain event (Issue #1)', () => {
      vi.spyOn(mockStdin, 'write').mockReturnValue(false) // Simulate backpressure
      const drainSpy = vi.spyOn(mockStdin, 'once')

      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      expect(drainSpy).toHaveBeenCalledWith('drain', expect.any(Function) as never)
    })
  })

  describe('error messaging', () => {
    it('provides helpful error message when claude executable not found (Issue #6)', () => {
      spawnCC({ folderPath: '/test/path', message: 'Hello' })

      const error = new Error('spawn claude ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      mockChildProcess.emit('error', error)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Claude Code is not installed')
        })
      )
    })

    it('includes truncation indicator when stderr is truncated (Issue #7)', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'
      spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

      // Simulate stderr at max buffer
      const maxOutput = 'X'.repeat(10 * 1024) // Exactly at limit
      mockStderr.emit('data', Buffer.from(maxOutput + 'EXTRA'))

      mockChildProcess.emit('exit', 1, null)

      const call = mockWindow.webContents.send.mock.calls.find(
        (c) => c[0] === 'stream:end' && c[1].success === false
      )
      expect(call?.[1]?.error).toMatch(/\.\.\. \(truncated\)/)
    })
  })
})
