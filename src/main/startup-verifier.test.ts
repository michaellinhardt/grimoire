import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'

// Hoisted mock functions
const { execMock, existsSyncMock, mkdirSyncMock, accessSyncMock, mockGetPath } = vi.hoisted(() => ({
  execMock: vi.fn(),
  existsSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  accessSyncMock: vi.fn(),
  mockGetPath: vi.fn().mockReturnValue('/mock/userData')
}))

// Mock electron app before importing the module
vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath
  }
}))

// Mock child_process
vi.mock('child_process', () => ({
  exec: execMock,
  default: { exec: execMock }
}))

// Mock fs
vi.mock('fs', () => {
  const mocked = {
    existsSync: existsSyncMock,
    mkdirSync: mkdirSyncMock,
    accessSync: accessSyncMock,
    constants: { W_OK: 2 }
  }
  return {
    ...mocked,
    default: mocked
  }
})

// Import after mocks are set up
import {
  checkClaudeInstalled,
  checkConfigDirectory,
  checkAuthentication,
  runStartupVerification
} from './startup-verifier'

describe('startup-verifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('checkClaudeInstalled', () => {
    it('returns success when claude is found in PATH', async () => {
      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, '/usr/local/bin/claude', '')
        }
        return { on: vi.fn() }
      })

      const result = await checkClaudeInstalled()

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns error when claude is not found', async () => {
      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Command failed: which claude'), '', 'not found')
        }
        return { on: vi.fn() }
      })

      const result = await checkClaudeInstalled()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Claude Code CLI not found in PATH')
    })

    it('uses correct command for current platform', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, '/usr/local/bin/claude', '')
        }
        return { on: vi.fn() }
      })

      await checkClaudeInstalled()

      // On darwin/linux, should use 'which'
      expect(execMock).toHaveBeenCalledWith('which claude', expect.anything(), expect.any(Function))

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })
  })

  describe('checkConfigDirectory', () => {
    it('returns success when directory exists and is writable', () => {
      existsSyncMock.mockReturnValue(true)
      accessSyncMock.mockReturnValue(undefined)

      const result = checkConfigDirectory()

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('creates directory if missing and returns success', () => {
      existsSyncMock.mockReturnValue(false)
      mkdirSyncMock.mockReturnValue(undefined)
      accessSyncMock.mockReturnValue(undefined)

      const result = checkConfigDirectory()

      expect(result.success).toBe(true)
      expect(mkdirSyncMock).toHaveBeenCalledWith(join('/mock/userData', '.claude'), {
        recursive: true
      })
    })

    it('returns error if directory creation fails', () => {
      existsSyncMock.mockReturnValue(false)
      mkdirSyncMock.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = checkConfigDirectory()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
    })

    it('returns error if directory is not writable', () => {
      existsSyncMock.mockReturnValue(true)
      accessSyncMock.mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      const result = checkConfigDirectory()

      expect(result.success).toBe(false)
      expect(result.error).toBe('EACCES: permission denied')
    })
  })

  describe('checkAuthentication', () => {
    it('returns success when auth is valid', async () => {
      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'claude version 1.0.0', '')
        }
        return { on: vi.fn() }
      })

      const result = await checkAuthentication()

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns error on auth failure', async () => {
      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Authentication required'), '', 'error')
        }
        return { on: vi.fn() }
      })

      const result = await checkAuthentication()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Authentication verification failed')
    })

    it('sets CLAUDE_CONFIG_DIR environment variable', async () => {
      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'claude version 1.0.0', '')
        }
        return { on: vi.fn() }
      })

      await checkAuthentication()

      expect(execMock).toHaveBeenCalledWith(
        'claude --version',
        expect.objectContaining({
          env: expect.objectContaining({
            CLAUDE_CONFIG_DIR: join('/mock/userData', '.claude')
          })
        }),
        expect.any(Function)
      )
    })
  })

  describe('runStartupVerification', () => {
    it('calls all checks sequentially when all pass', async () => {
      // Mock claude check
      execMock
        .mockImplementationOnce((_cmd, _opts, callback) => {
          if (typeof callback === 'function') {
            callback(null, '/usr/local/bin/claude', '')
          }
          return { on: vi.fn() }
        })
        // Mock auth check
        .mockImplementationOnce((_cmd, _opts, callback) => {
          if (typeof callback === 'function') {
            callback(null, 'claude version 1.0.0', '')
          }
          return { on: vi.fn() }
        })

      // Mock config check
      existsSyncMock.mockReturnValue(true)
      accessSyncMock.mockReturnValue(undefined)

      const stepCallback = vi.fn()
      const result = await runStartupVerification(stepCallback)

      expect(result.success).toBe(true)
      expect(stepCallback).toHaveBeenCalledTimes(3)
      expect(stepCallback).toHaveBeenCalledWith('claude', true, undefined)
      expect(stepCallback).toHaveBeenCalledWith('config', true, undefined)
      expect(stepCallback).toHaveBeenCalledWith('auth', true, undefined)
    })

    it('stops on first failure and returns failed step', async () => {
      // Mock claude check to fail
      execMock.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('not found'), '', '')
        }
        return { on: vi.fn() }
      })

      const stepCallback = vi.fn()
      const result = await runStartupVerification(stepCallback)

      expect(result.success).toBe(false)
      expect(result.failedStep).toBe('claude')
      expect(stepCallback).toHaveBeenCalledTimes(1)
      expect(stepCallback).toHaveBeenCalledWith(
        'claude',
        false,
        'Claude Code CLI not found in PATH'
      )
    })

    it('returns config failure when config check fails', async () => {
      // Mock claude check to pass
      execMock.mockImplementationOnce((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, '/usr/local/bin/claude', '')
        }
        return { on: vi.fn() }
      })

      // Mock config check to fail
      existsSyncMock.mockReturnValue(false)
      mkdirSyncMock.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const stepCallback = vi.fn()
      const result = await runStartupVerification(stepCallback)

      expect(result.success).toBe(false)
      expect(result.failedStep).toBe('config')
    })

    it('invokes step callback for each completed step', async () => {
      execMock
        .mockImplementationOnce((_cmd, _opts, callback) => {
          if (typeof callback === 'function') {
            callback(null, '/usr/local/bin/claude', '')
          }
          return { on: vi.fn() }
        })
        .mockImplementationOnce((_cmd, _opts, callback) => {
          if (typeof callback === 'function') {
            callback(null, 'claude version 1.0.0', '')
          }
          return { on: vi.fn() }
        })

      existsSyncMock.mockReturnValue(true)
      accessSyncMock.mockReturnValue(undefined)

      const stepCallback = vi.fn()
      await runStartupVerification(stepCallback)

      expect(stepCallback).toHaveBeenNthCalledWith(1, 'claude', true, undefined)
      expect(stepCallback).toHaveBeenNthCalledWith(2, 'config', true, undefined)
      expect(stepCallback).toHaveBeenNthCalledWith(3, 'auth', true, undefined)
    })
  })
})
