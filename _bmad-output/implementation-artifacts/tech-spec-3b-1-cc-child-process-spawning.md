---
title: 'CC Child Process Spawning'
slug: '3b-1-cc-child-process-spawning'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Node.js child_process
  - Electron main process
  - TypeScript 5.9
  - Zod 4.x
  - Electron IPC
files_to_modify:
  - src/main/ipc/sessions.ts
  - src/main/process-registry.ts
  - src/shared/types/ipc.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/main/sessions/types.ts
files_to_create:
  - src/main/sessions/cc-spawner.ts
  - src/main/sessions/cc-spawner.test.ts
code_patterns:
  - Child process spawn with environment variables
  - IPC handler integration
  - Process registry management
  - NDJSON stdin message format
test_patterns:
  - Vitest with node environment
  - Mock child_process.spawn
  - Mock Electron app module
---

# Tech-Spec: CC Child Process Spawning

**Created:** 2026-01-24
**Story Reference:** 3b-1-cc-child-process-spawning.md

## Overview

### Problem Statement

Grimoire needs to spawn Claude Code (CC) child processes to handle user messages. The current implementation has a TODO placeholder in the `sessions:sendMessage` IPC handler. Without proper process spawning, users cannot interact with Claude Code through Grimoire.

### Solution

Implement CC child process spawning that:
1. Spawns CC with correct CLI arguments (`-p --input-format stream-json --output-format stream-json --verbose --replay-user-messages --dangerously-skip-permissions`)
2. Sets environment variables for isolation (`CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING`)
3. Sends user messages via stdin in JSON format
4. Registers processes in the registry for lifecycle management
5. Passes `--resume <sessionId>` for existing sessions
6. Captures session ID from the init event and emits `stream:init` to renderer

### Scope

**In Scope:**
- `cc-spawner.ts` module with `spawnCC` function
- Environment variable configuration (CLAUDE_CONFIG_DIR, CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING)
- stdin message formatting and delivery
- Process registry integration
- Session ID capture from init event (basic parsing)
- `stream:init` and `stream:end` IPC event emission
- Platform-specific executable path resolution
- Integration with `sessions:sendMessage` handler
- Unit tests for spawn utility

**Out of Scope:**
- Full NDJSON stream parsing (Story 3b-2)
- Metadata persistence from stream events (Story 3b-2)
- Checkpoint storage (Story 3b-2)
- Instance state machine (Story 3b-3)
- Request-response lifecycle coordination (Story 3b-4)

## Context for Development

### Codebase Patterns

**Process Registry Pattern (from src/main/process-registry.ts):**
```typescript
import type { ChildProcess } from 'child_process'

export const processRegistry = new Map<string, ChildProcess>()
```

**IPC Handler Pattern (from src/main/ipc/sessions.ts lines 312-345):**
```typescript
ipcMain.handle('sessions:sendMessage', async (_, data: unknown) => {
  try {
    const { sessionId, message, folderPath, isNewSession } = SendMessageSchema.parse(data)
    // ... database operations ...
    // TODO: Story 3b-1 will implement actual CC child process spawning
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
    console.error('[sessions:sendMessage] Error:', errorMessage)
    return { success: false, error: errorMessage }
  }
})
```

**Process Termination Pattern (from src/main/ipc/sessions.ts lines 348-386):**
```typescript
// Abort running CC process (Story 3a-4)
ipcMain.handle('sessions:abort', async (_, data: unknown) => {
  try {
    const { sessionId } = AbortRequestSchema.parse(data)
    const child = processRegistry.get(sessionId)
    if (!child) {
      return { success: true }
    }
    child.kill('SIGTERM')
    // ... wait and cleanup ...
    processRegistry.delete(sessionId)
    return { success: true }
  } catch (error) {
    // ... error handling ...
  }
})
```

**Stream Event Types (from src/shared/types/ipc.ts lines 234-272):**
```typescript
export const StreamChunkEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.literal('text'),
  content: z.string(),
  uuid: z.string().uuid().optional()
})

export const StreamEndEventSchema = z.object({
  sessionId: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
  aborted: z.boolean().optional(),
  totalTokens: z.object({
    input: z.number(),
    output: z.number()
  }).optional(),
  costUsd: z.number().optional()
})
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/main/process-registry.ts` | Process registry Map (lines 1-16) |
| `src/main/ipc/sessions.ts` | sendMessage handler, abort pattern (lines 312-386) |
| `src/main/index.ts` | App initialization, before-quit cleanup (lines 90-109) |
| `src/shared/types/ipc.ts` | Stream event schemas (lines 234-272) |
| `src/preload/index.ts` | Stream event listeners pattern (lines 88-133) |
| `src/main/sessions/types.ts` | Existing session types (SystemInitEvent at lines 54-65) |

### Technical Decisions

1. **Spawn Utility as Separate Module:** Create `cc-spawner.ts` for better testability and separation of concerns.

2. **Environment Variable Isolation:** Use `app.getPath('userData')` for CLAUDE_CONFIG_DIR to ensure Grimoire sessions are isolated from CLI CC sessions.

3. **Stdin Message Format:** Send user message as JSON with newline, matching CC's stream-json input format.

4. **Session ID Handling:** For new sessions, use temporary registry key until init event provides real session ID.

5. **Basic Init Parsing:** Parse only the first line (init event) in this story; full parsing in Story 3b-2.

6. **Event Emission to All Windows:** Use `BrowserWindow.getAllWindows()` to emit to all renderer windows.

## Implementation Plan

### Tasks

#### Task 1: Add SpawnOptions Interface to Types (AC: #1-5)

**File:** `src/main/sessions/types.ts`

**Action:** Add SpawnOptions interface at the end of the file (after line 91).

```typescript
// ============================================================
// CC Spawner Types (Story 3b-1)
// ============================================================

/**
 * Options for spawning a CC child process.
 */
export interface SpawnOptions {
  /** Session UUID (undefined for new sessions) */
  sessionId?: string
  /** Working directory for the CC process */
  folderPath: string
  /** User message to send via stdin */
  message: string
}
```

---

#### Task 2: Add StreamInitEventSchema to IPC Types (AC: #4)

**File:** `src/shared/types/ipc.ts`

**Action:** Add StreamInitEventSchema after StreamEndEventSchema (around line 273).

```typescript
/**
 * Stream init event - session initialized with tools list
 * Emitted when CC starts and sends the init system message
 */
export const StreamInitEventSchema = z.object({
  sessionId: z.string().uuid(),
  tools: z.array(z.unknown()).optional()
})

export type StreamInitEvent = z.infer<typeof StreamInitEventSchema>
```

**Note:** Ensure this is exported in the module by adding it to any export statements if needed (the file currently auto-exports all types via z.infer).

---

#### Task 3: Add onStreamInit Listener to Preload (AC: #4)

**File:** `src/preload/index.ts`

**Action:** Add onStreamInit method to sessions object (after onStreamEnd, around line 133).

```typescript
// Stream init event listener (Story 3b-1)
onStreamInit: (
  callback: (event: { sessionId: string; tools?: unknown[] }) => void
): (() => void) => {
  const handler = (
    _event: Electron.IpcRendererEvent,
    data: { sessionId: string; tools?: unknown[] }
  ): void => callback(data)
  ipcRenderer.on('stream:init', handler)
  return () => ipcRenderer.removeListener('stream:init', handler)
},
```

---

#### Task 4: Add onStreamInit Type Declaration (AC: #4)

**File:** `src/preload/index.d.ts`

**Action:** Add onStreamInit method type to GrimoireAPI.sessions interface (after onStreamEnd, around line 70).

Find this code:
```typescript
    onStreamEnd: (
      callback: (event: {
        sessionId: string
        success: boolean
        error?: string
        aborted?: boolean
      }) => void
    ) => () => void
  }
  dialog: {
```

Replace with:
```typescript
    onStreamEnd: (
      callback: (event: {
        sessionId: string
        success: boolean
        error?: string
        aborted?: boolean
      }) => void
    ) => () => void
    // Stream init event listener (Story 3b-1)
    onStreamInit: (callback: (event: { sessionId: string; tools?: unknown[] }) => void) => () => void
  }
  dialog: {
```

---

#### Task 5: Create CC Spawner Utility (AC: #1, #2, #3)

**File:** `src/main/sessions/cc-spawner.ts`

**Action:** Create new file with the following content:

```typescript
import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { processRegistry } from '../process-registry'
import type { SpawnOptions } from './types'

/**
 * Finds the claude executable path.
 * Handles platform-specific executable naming and common install locations.
 */
function findClaudeExecutable(): string {
  // On Windows, the executable may have .cmd or .exe extension
  if (process.platform === 'win32') {
    // Windows: npm installs as .cmd, but spawn handles PATH lookup
    // Return 'claude' and let shell: false handle it (Windows spawn auto-resolves .cmd/.exe)
    return 'claude'
  }

  // On macOS/Linux, spawn will search PATH for 'claude'
  // Common paths: /usr/local/bin/claude, ~/.npm/bin/claude, ~/.local/bin/claude
  // We rely on PATH being set correctly; if not found, spawn will emit 'error' event
  return 'claude'
}

/**
 * Emits an event to all renderer windows.
 */
function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}

/**
 * Spawns a Claude Code child process with the correct configuration.
 *
 * @param options - Spawn configuration
 * @returns The spawned child process
 */
export function spawnCC(options: SpawnOptions): ChildProcess {
  const { sessionId, folderPath, message } = options

  // Build CLI arguments
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--replay-user-messages',
    '--dangerously-skip-permissions'
  ]

  // Add --resume for existing sessions
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  // Configure environment for isolation
  const env = {
    ...process.env,
    CLAUDE_CONFIG_DIR: join(app.getPath('userData'), '.claude'),
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1'
  }

  // Spawn the process
  const executable = findClaudeExecutable()
  const child = spawn(executable, args, {
    cwd: folderPath,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  // Use temporary registry ID for new sessions
  const registryId = sessionId ?? `pending-${Date.now()}`
  processRegistry.set(registryId, child)

  // Send user message via stdin with error handling
  const stdinMessage = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: message }
  })

  // Handle potential stdin write errors
  child.stdin?.on('error', (err) => {
    console.error('[cc-spawner] stdin write error:', err.message)
    // Process will likely fail anyway, but cleanup just in case
    processRegistry.delete(registryId)
    emitToRenderer('stream:end', {
      sessionId: registryId,
      success: false,
      error: `Failed to write to stdin: ${err.message}`
    })
  })

  child.stdin?.write(stdinMessage + '\n')
  child.stdin?.end()

  // Track whether we've captured the real session ID
  let capturedSessionId = sessionId ?? ''
  let initReceived = false

  // Setup stdout readline for init event capture
  if (child.stdout) {
    const rl = createInterface({
      input: child.stdout,
      crlfDelay: Infinity
    })

    rl.on('line', (line) => {
      // Only parse the first line for init event (full parsing in Story 3b-2)
      if (!initReceived) {
        try {
          const event = JSON.parse(line)
          if (event.type === 'system' && event.subtype === 'init') {
            initReceived = true
            const newSessionId = event.session_id

            // Update registry if session ID changed (new session)
            if (!sessionId && newSessionId) {
              processRegistry.delete(registryId)
              processRegistry.set(newSessionId, child)
              capturedSessionId = newSessionId
            } else if (sessionId) {
              capturedSessionId = sessionId
            }

            // Emit stream:init event to renderer
            emitToRenderer('stream:init', {
              sessionId: capturedSessionId,
              tools: event.tools ?? []
            })
          }
        } catch {
          // Ignore parse errors for non-JSON lines
        }
      }
    })
  }

  // Track stderr for error messages
  let stderrBuffer = ''
  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
    })
  }

  // Handle process exit
  child.on('exit', (code, signal) => {
    // Remove from registry
    if (capturedSessionId) {
      processRegistry.delete(capturedSessionId)
    } else {
      processRegistry.delete(registryId)
    }

    // Emit stream:end event
    const success = code === 0
    emitToRenderer('stream:end', {
      sessionId: capturedSessionId || registryId,
      success,
      error: success ? undefined : `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}${stderrBuffer ? `: ${stderrBuffer.trim()}` : ''}`
    })
  })

  // Handle spawn errors (e.g., ENOENT if claude not installed)
  child.on('error', (err) => {
    // Remove from registry
    processRegistry.delete(registryId)

    // Emit stream:end event with error
    emitToRenderer('stream:end', {
      sessionId: capturedSessionId || registryId,
      success: false,
      error: `Failed to spawn Claude Code: ${err.message}`
    })
  })

  return child
}
```

---

#### Task 6: Update sendMessage Handler to Use Spawner (AC: #1-5)

**File:** `src/main/ipc/sessions.ts`

**Action:** Update the sendMessage handler to call spawnCC after database operations.

**Step 6.1: Add import at top of file (after existing imports, around line 22):**

```typescript
import { spawnCC } from '../sessions/cc-spawner'
```

**Step 6.2: Replace the TODO comment and return statement in sendMessage handler.**

Find this code (lines 333-339):
```typescript
      // TODO: Story 3b-1 will implement actual CC child process spawning
      // For now, just acknowledge the message was received
      if (process.env.DEBUG_SEND_MESSAGE) {
        console.debug(
          `[sendMessage] Received: sessionId=${sessionId}, message=${message.substring(0, 50)}...`
        )
      }

      return { success: true }
```

Replace with:
```typescript
      // Spawn CC child process (Story 3b-1)
      try {
        spawnCC({
          sessionId: isNewSession ? undefined : sessionId,
          folderPath,
          message
        })

        if (process.env.DEBUG_SEND_MESSAGE) {
          console.debug(
            `[sendMessage] Spawned CC: sessionId=${sessionId}, isNew=${isNewSession}`
          )
        }

        return { success: true }
      } catch (spawnError) {
        const spawnErrorMsg = spawnError instanceof Error ? spawnError.message : 'Failed to spawn CC'
        console.error('[sessions:sendMessage] Spawn error:', spawnErrorMsg)
        return { success: false, error: spawnErrorMsg }
      }
```

---

#### Task 7: Export cc-spawner from Sessions Index (AC: #1-5)

**File:** `src/main/sessions/index.ts`

**Action:** Add export for cc-spawner at the end of the file.

Current content (check actual file):
```typescript
export { scanClaudeConfigDir, syncSessionsToDatabase, listSessions } from './session-scanner'
// ... other exports
```

Add this line:
```typescript
export { spawnCC } from './cc-spawner'
```

---

#### Task 8: Create CC Spawner Unit Tests (AC: #1-5)

**File:** `src/main/sessions/cc-spawner.test.ts`

**Action:** Create new test file:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChildProcess } from 'child_process'
import { EventEmitter, Readable, Writable } from 'stream'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
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
  processRegistry: new Map()
}))

import { spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { processRegistry } from '../process-registry'
import { spawnCC } from './cc-spawner'

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
      write: vi.fn((chunk, encoding, callback) => {
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
    mockChildProcess.pid = 12345
    mockChildProcess.killed = false

    vi.mocked(spawn).mockReturnValue(mockChildProcess as ChildProcess)

    // Setup mock window
    mockWindow = { webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow])
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
          '--input-format', 'stream-json',
          '--output-format', 'stream-json',
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

      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Hello world' }
        }) + '\n'
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
        session_id: 'new-session-id',
        tools: ['Read', 'Write']
      })

      // Push data to stdout
      mockStdout.push(initEvent + '\n')
      mockStdout.push(null)

      // Allow event loop to process
      await new Promise(resolve => setImmediate(resolve))

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:init',
        expect.objectContaining({
          sessionId: 'new-session-id',
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

      await new Promise(resolve => setImmediate(resolve))

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
  })

  describe('return value', () => {
    it('returns the child process', () => {
      const result = spawnCC({ folderPath: '/test/path', message: 'Hello' })
      expect(result).toBe(mockChildProcess)
    })
  })
})
```

---

#### Task 9: Update sessions.ts IPC Handler Tests (AC: #1-5)

**File:** `src/main/ipc/sessions.test.ts`

**Action:** Add tests for sendMessage spawn integration. If this file doesn't exist, create it. If it exists, add the sendMessage describe block.

**Note:** These tests verify the logic that the sendMessage handler should use when calling spawnCC. The key behavior to test:
- For new sessions (isNewSession=true): pass `sessionId: undefined` to spawnCC
- For existing sessions (isNewSession=false): pass the actual `sessionId` to spawnCC

First check if the file exists. If not, create with this content. If it exists, add the sendMessage describe block:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock cc-spawner
vi.mock('../sessions/cc-spawner', () => ({
  spawnCC: vi.fn()
}))

// Mock database
vi.mock('../db', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn()
    }))
  }))
}))

import { spawnCC } from '../sessions/cc-spawner'

describe('sessions:sendMessage spawn integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    it('calls spawnCC with correct options structure', () => {
      const mockSpawnCC = vi.mocked(spawnCC)

      // Simulate the exact call pattern from sendMessage handler
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

    it('passes sessionId for resume scenarios', () => {
      const mockSpawnCC = vi.mocked(spawnCC)
      const sessionId = '550e8400-e29b-41d4-a716-446655440000'

      mockSpawnCC({
        sessionId,
        folderPath: '/test/path',
        message: 'Hello'
      })

      expect(mockSpawnCC).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId })
      )
    })
  })
})
```

---

#### Task 10: Run Validation (AC: #1-5)

**Action:** Run `npm run validate` to ensure all tests pass and types check.

```bash
npm run validate
```

### Acceptance Criteria

**AC1: CLAUDE_CONFIG_DIR environment variable (FR61)**
- **Given** the user sends a message to a session
- **When** CC needs to be spawned
- **Then** the child process is created with CLAUDE_CONFIG_DIR environment variable set to `app.getPath('userData')/.claude`
- **And** CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1 is set for rewind support
- **And** this provides isolation from other CC instances

**AC2: Session ID argument for resume (FR62, FR66)**
- **Given** a session has an existing ID (isNewSession=false)
- **When** spawning CC for that session
- **Then** the --resume argument is passed with the session UUID
- **And** CC resumes the existing conversation

**AC3: User message via stdin (FR63)**
- **Given** the user sends a message
- **When** CC is spawned
- **Then** the spawn uses `-p --input-format stream-json --output-format stream-json --verbose --replay-user-messages --dangerously-skip-permissions`
- **And** the user message is sent via stdin as JSON `{ "type": "user", "message": { "role": "user", "content": "<message>" } }`
- **And** stdin is closed after sending the message

**AC4: Session ID captured from stream (FR56, FR65, FR67c)**
- **Given** CC is spawned
- **When** the init event arrives on stdout
- **Then** the session ID is captured from the init event's `session_id` field
- **And** the process registry is updated with the captured session ID
- **And** `stream:init` event is emitted to renderer with sessionId and tools

**AC5: New session spawning**
- **Given** the user sends a message to a new session (no sessionId, isNewSession=true)
- **When** CC spawns without --resume
- **Then** the session ID is captured from the init event
- **And** the process registry key is updated from temporary to real session ID

## Additional Context

### Dependencies

**Required Stories (Upstream):**
- Story 3a-2 (Message Send Flow): Provides sendMessage IPC handler - COMPLETED
- Story 3a-3 (Response Streaming Display): Provides stream event types - COMPLETED
- Story 3a-4 (Abort and Resume): Provides process termination patterns - COMPLETED

**This Story Provides:**
- Child process spawning with correct arguments and environment
- Process registry integration
- Stream event emission foundation (stream:init, stream:end)

**Downstream Stories:**
- Story 3b-2 (NDJSON Stream Parser): Will expand stream parsing to handle all event types
- Story 3b-3 (Instance State Machine): Will formalize process states
- Story 3b-4 (Request-Response Model): Will manage full process lifecycle

### Testing Strategy

1. **Unit Tests (cc-spawner.test.ts):**
   - Test spawn arguments for new/existing sessions
   - Test environment variable configuration
   - Test stdin message formatting
   - Test process registry operations
   - Test stream:init event emission
   - Test stream:end event emission (success/error)
   - Test spawn error handling

2. **Integration Tests (sessions.test.ts):**
   - Test sendMessage calls spawnCC with correct options
   - Mock cc-spawner to verify integration

3. **Manual Testing:**
   - Start Grimoire with a session
   - Send a message and verify CC spawns
   - Check process registry contains the session
   - Verify stream:init event received
   - Verify stream:end event on completion

### Notes

**Stdin Message Format:**
```json
{ "type": "user", "message": { "role": "user", "content": "user message here" } }
```

**Init Event Format (from CC):**
```json
{ "type": "system", "subtype": "init", "session_id": "uuid-here", "tools": [...] }
```

**Process Registry Lifecycle:**
1. New session: Register with `pending-{timestamp}` key
2. On init event: Update key to real session ID
3. On exit/error: Remove from registry

**Error Handling Strategy:**
- ENOENT: CC not installed - emit stream:end with clear error
- Non-zero exit: Include exit code and stderr in error message
- All errors transition session back to idle state (handled by renderer)

### File Checklist

Files to CREATE:
- [ ] `src/main/sessions/cc-spawner.ts` - CC spawn utility
- [ ] `src/main/sessions/cc-spawner.test.ts` - Unit tests

Files to MODIFY:
- [ ] `src/main/sessions/types.ts` - Add SpawnOptions interface
- [ ] `src/shared/types/ipc.ts` - Add StreamInitEventSchema
- [ ] `src/preload/index.ts` - Add onStreamInit listener
- [ ] `src/preload/index.d.ts` - Add onStreamInit type
- [ ] `src/main/ipc/sessions.ts` - Integrate spawnCC in sendMessage handler
- [ ] `src/main/sessions/index.ts` - Export cc-spawner

### Implementation Order

Execute tasks in this order to respect dependencies:

1. **Types First:**
   - Task 1: Add SpawnOptions to types.ts
   - Task 2: Add StreamInitEventSchema to ipc.ts

2. **Preload Layer:**
   - Task 3: Add onStreamInit to preload/index.ts
   - Task 4: Add onStreamInit type declaration

3. **Core Implementation:**
   - Task 5: Create cc-spawner.ts

4. **Integration:**
   - Task 6: Update sendMessage handler
   - Task 7: Export from sessions/index.ts

5. **Tests:**
   - Task 8: Create cc-spawner unit tests
   - Task 9: Add integration tests

6. **Validation:**
   - Task 10: Run npm run validate
