import { spawn, type ChildProcess } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { processRegistry } from '../process-registry'
import type { SpawnOptions } from './types'
import { createStreamParser, emitToRenderer } from './stream-parser'
import { instanceStateManager } from './instance-state-manager'

/**
 * Debug flag for process lifecycle logging (Story 3b-4)
 * Set DEBUG_PROCESS_LIFECYCLE=1 to enable detailed lifecycle logs
 */
const DEBUG_LIFECYCLE = process.env.DEBUG_PROCESS_LIFECYCLE === '1'

/**
 * Log process lifecycle events when debugging is enabled
 */
function logLifecycle(event: string, data: Record<string, unknown>): void {
  if (DEBUG_LIFECYCLE) {
    console.log(`[process-lifecycle] ${event}`, JSON.stringify(data))
  }
}

/**
 * Check if a session has an active process in the registry (Story 3b-4)
 * @param sessionId - The session ID to check
 * @returns true if there's an active process for this session
 */
export function hasActiveProcess(sessionId: string): boolean {
  return processRegistry.has(sessionId)
}

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
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
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
    cwd: folderPath, // Will fail with ENOENT if folder doesn't exist (Issue #5)
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  // Use temporary registry ID for new sessions
  const registryId = sessionId ?? `pending-${Date.now()}`
  processRegistry.set(registryId, child)

  // Log spawn event (Story 3b-4)
  logLifecycle('SPAWN', { sessionId: registryId, pid: child.pid })

  // Transition state to 'working' (Story 3b-3)
  instanceStateManager.transition(registryId, 'SEND_MESSAGE')

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
    // Transition to error state (Story 3b-3)
    instanceStateManager.transition(registryId, 'PROCESS_ERROR')
    emitToRenderer('stream:end', {
      sessionId: registryId,
      success: false,
      error: `Failed to write to stdin: ${err.message}`
    })
  })

  // Write message and handle backpressure (Issue #1)
  const stdinWriteResult = child.stdin?.write(stdinMessage + '\n', (err) => {
    if (err) {
      console.error('[cc-spawner] stdin write callback error:', err.message)
      processRegistry.delete(registryId)
      // Transition to error state (Story 3b-3)
      instanceStateManager.transition(registryId, 'PROCESS_ERROR')
      emitToRenderer('stream:end', {
        sessionId: registryId,
        success: false,
        error: `Failed to write to stdin: ${err.message}`
      })
    }
  })

  // Check for backpressure - if write returns false, wait for drain
  if (stdinWriteResult === false) {
    child.stdin?.once('drain', () => {
      child.stdin?.end()
    })
  } else {
    child.stdin?.end()
  }

  // Track whether we've captured the real session ID
  let capturedSessionId = sessionId ?? ''

  // Setup stream parser for full NDJSON parsing (Story 3b-2)
  if (child.stdout) {
    const parser = createStreamParser({
      sessionId: capturedSessionId || registryId,
      stdout: child.stdout,
      onSessionIdCaptured: (newSessionId) => {
        // Update registry if session ID changed (new session)
        if (!sessionId && newSessionId) {
          processRegistry.delete(registryId)
          processRegistry.set(newSessionId, child)
          // Transfer state from temp key to real sessionId (Story 3b-3)
          instanceStateManager.transferState(registryId, newSessionId)
          capturedSessionId = newSessionId
        } else if (sessionId) {
          capturedSessionId = sessionId
        }
      }
    })

    parser.on('error', (err) => {
      console.error('[cc-spawner] Parser error:', err.message)
    })
  }

  // Track stderr for error messages (limit to prevent memory exhaustion)
  const MAX_STDERR_BUFFER = 10 * 1024 // 10KB limit
  let stderrBuffer = ''
  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) => {
      const remaining = MAX_STDERR_BUFFER - stderrBuffer.length
      if (remaining > 0) {
        stderrBuffer += chunk.toString().slice(0, remaining)
      }
    })
  }

  // Handle process exit
  child.on('exit', (code, signal) => {
    // Remove from registry - use captured session ID if available, otherwise temp key
    const cleanupKey = capturedSessionId || registryId
    processRegistry.delete(cleanupKey)

    // Log exit event (Story 3b-4)
    logLifecycle('EXIT', { sessionId: cleanupKey, pid: child.pid, code, signal })

    // Transition state based on exit result (Story 3b-3)
    const success = code === 0
    if (success) {
      instanceStateManager.transition(cleanupKey, 'PROCESS_EXIT')
    } else {
      instanceStateManager.transition(cleanupKey, 'PROCESS_ERROR')
    }
    const stderrMessage = stderrBuffer
      ? stderrBuffer.length >= MAX_STDERR_BUFFER
        ? `${stderrBuffer.trim()} ... (truncated)`
        : stderrBuffer.trim()
      : ''
    emitToRenderer('stream:end', {
      sessionId: cleanupKey,
      success,
      error: success
        ? undefined
        : `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}${stderrMessage ? `: ${stderrMessage}` : ''}`,
      aborted: signal === 'SIGTERM' || signal === 'SIGKILL'
    })
  })

  // Handle spawn errors (e.g., ENOENT if claude not installed)
  child.on('error', (err: NodeJS.ErrnoException) => {
    // Remove from registry - use same logic as exit handler for consistency
    const cleanupKey = capturedSessionId || registryId
    processRegistry.delete(cleanupKey)

    // Log error event (Story 3b-4)
    logLifecycle('ERROR', { sessionId: cleanupKey, error: err.message, code: err.code })

    // Transition to error state (Story 3b-3)
    instanceStateManager.transition(cleanupKey, 'PROCESS_ERROR')

    // Provide better error message for missing executable (Issue #6)
    let errorMsg = err.message
    if (err.code === 'ENOENT') {
      errorMsg =
        'Claude Code is not installed or not in PATH. Please install Claude Code and ensure it is available on your system.'
    }

    // Emit stream:end event with error
    emitToRenderer('stream:end', {
      sessionId: cleanupKey,
      success: false,
      error: `Failed to spawn Claude Code: ${errorMsg}`
    })
  })

  return child
}
