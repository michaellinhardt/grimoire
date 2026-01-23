import { exec } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, accessSync, constants } from 'fs'

export type VerificationStep = 'claude' | 'config' | 'auth'

export interface StepResult {
  success: boolean
  error?: string
}

export interface VerificationResult {
  success: boolean
  failedStep?: VerificationStep
  error?: string
}

export type StepCallback = (step: string, success: boolean, error?: string) => void

/**
 * Default timeout for exec commands (5 seconds per story spec)
 */
const EXEC_TIMEOUT_MS = 5000

/**
 * Executes a shell command with timeout and returns a promise.
 */
function execPromise(
  command: string,
  timeout: number,
  env?: Record<string, string>
): Promise<StepResult> {
  return new Promise((resolve) => {
    let hasResolved = false
    let timeoutHandle: NodeJS.Timeout | null = null

    const cleanup = (): void => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }

    const childProcess = exec(
      command,
      {
        timeout,
        env: env ? { ...process.env, ...env } : process.env
      },
      (error) => {
        if (hasResolved) return
        hasResolved = true
        cleanup()
        if (error) {
          resolve({
            success: false,
            error: error.message
          })
        } else {
          resolve({ success: true })
        }
      }
    )

    // Handle timeout and error events
    childProcess.on('error', (err) => {
      if (hasResolved) return
      hasResolved = true
      cleanup()
      resolve({
        success: false,
        error: err.message
      })
    })

    // Add a safety timeout in case exec timeout doesn't fire
    timeoutHandle = setTimeout(() => {
      if (hasResolved) return
      hasResolved = true
      cleanup()
      childProcess.kill('SIGTERM')
      resolve({
        success: false,
        error: `Command timeout after ${timeout}ms`
      })
    }, timeout + 500) // Add 500ms buffer for exec's own timeout
  })
}

/**
 * Checks if Claude Code CLI is installed and available in PATH.
 * Uses `which` on Unix/macOS, `where` on Windows.
 */
export async function checkClaudeInstalled(): Promise<StepResult> {
  const command = process.platform === 'win32' ? 'where claude' : 'which claude'

  try {
    const result = await execPromise(command, EXEC_TIMEOUT_MS)
    if (!result.success) {
      return {
        success: false,
        error: 'Claude Code CLI not found in PATH'
      }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error checking Claude installation'
    }
  }
}

/**
 * Checks if the config directory exists and is writable.
 * Creates the directory if it doesn't exist.
 * Path: app.getPath('userData')/.claude
 */
export function checkConfigDirectory(): StepResult {
  try {
    const configPath = join(app.getPath('userData'), '.claude')

    // Create directory if it doesn't exist
    if (!existsSync(configPath)) {
      mkdirSync(configPath, { recursive: true })
    }

    // Verify directory is writable
    accessSync(configPath, constants.W_OK)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to access or create configuration directory'
    }
  }
}

/**
 * Checks Claude Code authentication by running `claude --version`.
 * Sets CLAUDE_CONFIG_DIR to our custom config path.
 */
export async function checkAuthentication(): Promise<StepResult> {
  const configPath = join(app.getPath('userData'), '.claude')

  try {
    const result = await execPromise('claude --version', EXEC_TIMEOUT_MS, {
      CLAUDE_CONFIG_DIR: configPath
    })

    if (!result.success) {
      return {
        success: false,
        error: 'Authentication verification failed'
      }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error checking authentication'
    }
  }
}

/**
 * Runs the full startup verification sequence.
 * Executes checks sequentially: claude -> config -> auth
 * Calls onStepComplete callback for each step.
 */
export async function runStartupVerification(
  onStepComplete?: StepCallback
): Promise<VerificationResult> {
  // Step 1: Check Claude installation
  const claudeResult = await checkClaudeInstalled()
  onStepComplete?.('claude', claudeResult.success, claudeResult.error)

  if (!claudeResult.success) {
    return {
      success: false,
      failedStep: 'claude',
      error: claudeResult.error
    }
  }

  // Step 2: Check config directory
  const configResult = checkConfigDirectory()
  onStepComplete?.('config', configResult.success, configResult.error)

  if (!configResult.success) {
    return {
      success: false,
      failedStep: 'config',
      error: configResult.error
    }
  }

  // Step 3: Check authentication
  const authResult = await checkAuthentication()
  onStepComplete?.('auth', authResult.success, authResult.error)

  if (!authResult.success) {
    return {
      success: false,
      failedStep: 'auth',
      error: authResult.error
    }
  }

  return { success: true }
}
