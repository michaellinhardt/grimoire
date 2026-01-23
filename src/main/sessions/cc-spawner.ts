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
  let capturedSessionId = sessionId ?? null
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
              sessionId: capturedSessionId || registryId,
              tools: event.tools ?? []
            })
          }
        } catch {
          // Ignore parse errors for non-JSON lines
        }
      }
    })

    rl.on('error', (err) => {
      console.error('[cc-spawner] readline error:', err.message)
      // Continue - process will handle cleanup on exit
    })

    // Cleanup readline on process exit to prevent fd leaks
    child.on('exit', () => {
      rl.close()
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

    // Emit stream:end event
    const success = code === 0
    emitToRenderer('stream:end', {
      sessionId: cleanupKey,
      success,
      error: success
        ? undefined
        : `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}${stderrBuffer ? `: ${stderrBuffer.trim()}` : ''}`
    })
  })

  // Handle spawn errors (e.g., ENOENT if claude not installed)
  child.on('error', (err) => {
    // Remove from registry - use same logic as exit handler for consistency
    const cleanupKey = capturedSessionId || registryId
    processRegistry.delete(cleanupKey)

    // Emit stream:end event with error
    emitToRenderer('stream:end', {
      sessionId: cleanupKey,
      success: false,
      error: `Failed to spawn Claude Code: ${err.message}`
    })
  })

  return child
}
