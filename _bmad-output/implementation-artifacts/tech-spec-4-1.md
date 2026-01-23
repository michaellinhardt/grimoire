# Tech Spec: Story 4-1 - Loading Screen and Startup Verification

## Overview

This specification details the implementation of the loading screen and startup verification system for Grimoire. The system displays a loading screen on app launch, performs verification checks (Claude Code installation, config directory, authentication), and transitions to the main UI upon success.

**Story Reference:** `/Users/teazyou/dev/grimoire/_bmad-output/implementation-artifacts/story-4-1.md`

---

## Technical Discovery Summary

### Codebase Patterns Identified

1. **IPC Channel Pattern**: All IPC channels use `namespace:action` format (e.g., `sessions:sendMessage`, `dialog:selectFolder`)
2. **Preload Bridge Pattern**: APIs exposed via `window.grimoireAPI.<namespace>.<method>()` in `/Users/teazyou/dev/grimoire/src/preload/index.ts`
3. **Event Emission Pattern**: `emitToRenderer()` function in `/Users/teazyou/dev/grimoire/src/main/sessions/stream-parser.ts` broadcasts to all windows
4. **State Management**: Local React hooks for UI state; Zustand for shared store (e.g., `useUIStore`)
5. **Component Location**: Core UI in `/Users/teazyou/dev/grimoire/src/renderer/src/core/`, features in `/Users/teazyou/dev/grimoire/src/renderer/src/features/`
6. **Styling**: Tailwind CSS with CSS variables in `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css`
7. **Testing**: Vitest with React Testing Library

### Existing Code to Leverage

| Pattern | File | Usage |
|---------|------|-------|
| Event emission | `/Users/teazyou/dev/grimoire/src/main/sessions/stream-parser.ts` | `emitToRenderer()` for broadcasting IPC events |
| Config dir path | `/Users/teazyou/dev/grimoire/src/main/sessions/cc-spawner.ts` | `app.getPath('userData')/.claude` pattern |
| IPC registration | `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts` | Export pattern for IPC handlers |
| App entry | `/Users/teazyou/dev/grimoire/src/renderer/src/App.tsx` | Where loading screen wrapper goes |
| CSS animations | `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css` | Animation keyframes patterns |

---

## Files to Reference

| File Path | Purpose |
|-----------|---------|
| `/Users/teazyou/dev/grimoire/src/main/index.ts` | Main process entry, where verification call is added |
| `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts` | IPC registration exports |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | Context bridge API exposure |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | TypeScript declarations for preload API |
| `/Users/teazyou/dev/grimoire/src/renderer/src/App.tsx` | Renderer entry component |
| `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css` | CSS variables and animations |
| `/Users/teazyou/dev/grimoire/src/main/sessions/stream-parser.ts` | `emitToRenderer()` reference |
| `/Users/teazyou/dev/grimoire/src/main/sessions/cc-spawner.ts` | `CLAUDE_CONFIG_DIR` path reference |

---

## Files to Create

| File Path | Description |
|-----------|-------------|
| `/Users/teazyou/dev/grimoire/src/main/startup-verifier.ts` | Main process verification logic |
| `/Users/teazyou/dev/grimoire/src/main/startup-verifier.test.ts` | Tests for verification logic |
| `/Users/teazyou/dev/grimoire/src/main/ipc/startup.ts` | IPC handlers for startup namespace |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/LoadingScreen.tsx` | Loading screen component |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/LoadingScreen.test.tsx` | Loading screen tests |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/ErrorModal.tsx` | Error modal component |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/ErrorModal.test.tsx` | Error modal tests |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/useAppInit.ts` | Startup verification hook |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/useAppInit.test.ts` | Hook tests |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/index.ts` | Barrel export |

---

## Files to Modify

| File Path | Changes |
|-----------|---------|
| `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts` | Export `registerStartupIPC` |
| `/Users/teazyou/dev/grimoire/src/main/index.ts` | Call `registerStartupIPC()` in `app.whenReady()` |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | Add `startup` namespace to `grimoireAPI` |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | Add TypeScript declarations for startup API |
| `/Users/teazyou/dev/grimoire/src/renderer/src/App.tsx` | Wrap content with loading screen conditional |
| `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css` | Add loading screen animations |

---

## Implementation Tasks

### Task 1: Create startup-verifier.ts [AC2, AC3, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/main/startup-verifier.ts`

**Actions:**
1. Create new file at the specified path
2. Import `exec` from `child_process`, `app` from `electron`, `join` from `path`, `existsSync`, `mkdirSync`, `accessSync`, `constants` from `fs`
3. Implement `checkClaudeInstalled()`:
   - Use `exec()` with promisified wrapper
   - On unix: run `which claude`
   - On win32: run `where claude`
   - Return `{ success: boolean, error?: string }`
   - Timeout after 5000ms
4. Implement `checkConfigDirectory()`:
   - Get path: `join(app.getPath('userData'), '.claude')`
   - Check if exists with `existsSync()`
   - If not exists, create with `mkdirSync(path, { recursive: true })`
   - Verify writable with `accessSync(path, constants.W_OK)`
   - Return `{ success: boolean, error?: string }`
5. Implement `checkAuthentication()`:
   - Run `claude --version` with env `CLAUDE_CONFIG_DIR` set
   - Timeout after 5000ms
   - Return `{ success: boolean, error?: string }`
6. Export `runStartupVerification()`:
   - Call checks sequentially: claude -> config -> auth
   - Emit step progress via callback
   - Return `{ success: boolean, failedStep?: 'claude' | 'config' | 'auth', error?: string }`

**Code Structure:**
```typescript
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

function execPromise(command: string, timeout: number, env?: Record<string, string>): Promise<StepResult> {
  // Implementation
}

export async function checkClaudeInstalled(): Promise<StepResult> {
  const command = process.platform === 'win32' ? 'where claude' : 'which claude'
  // Implementation
}

export async function checkConfigDirectory(): Promise<StepResult> {
  const configPath = join(app.getPath('userData'), '.claude')
  // Implementation
}

export async function checkAuthentication(): Promise<StepResult> {
  const configPath = join(app.getPath('userData'), '.claude')
  // Implementation with CLAUDE_CONFIG_DIR env
}

export async function runStartupVerification(onStepComplete?: StepCallback): Promise<VerificationResult> {
  // Sequential execution with step callbacks
}
```

---

### Task 2: Create startup-verifier.test.ts [AC2, AC3, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/main/startup-verifier.test.ts`

**Actions:**
1. Create test file at specified path
2. Mock `child_process.exec`, `electron.app`, `fs` functions
3. Test `checkClaudeInstalled()`:
   - Returns success when claude found in PATH
   - Returns error when claude not found (non-zero exit)
   - Returns error on timeout
4. Test `checkConfigDirectory()`:
   - Returns success when directory exists and writable
   - Creates directory if missing, returns success
   - Returns error if creation fails
   - Returns error if not writable
5. Test `checkAuthentication()`:
   - Returns success when auth valid
   - Returns error on auth failure
6. Test `runStartupVerification()`:
   - Calls all checks sequentially
   - Stops on first failure
   - Returns correct failedStep
   - Invokes step callback for each step

---

### Task 3: Create IPC handlers (startup.ts) [AC2, AC3, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/main/ipc/startup.ts`

**Actions:**
1. Create new file at specified path
2. Import `ipcMain`, `BrowserWindow` from `electron`
3. Import `runStartupVerification` from `../startup-verifier`
4. Create `emitToRenderer()` helper (same pattern as stream-parser.ts)
5. Implement `registerStartupIPC()`:
   - Register `startup:verify` handler:
     - Call `runStartupVerification()` with step callback
     - For each step, emit `startup:stepComplete` with `{ step, success, error? }`
     - On complete, emit `startup:allComplete` with `{ success }`
     - Return verification result

**Code Structure:**
```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { runStartupVerification, type VerificationResult } from '../startup-verifier'

function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}

export function registerStartupIPC(): void {
  ipcMain.handle('startup:verify', async (): Promise<VerificationResult> => {
    const result = await runStartupVerification((step, success, error) => {
      emitToRenderer('startup:stepComplete', { step, success, error })
    })

    emitToRenderer('startup:allComplete', { success: result.success })
    return result
  })
}
```

---

### Task 4: Update IPC index.ts

**File:** `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts`

**Actions:**
1. Add import: `export { registerStartupIPC } from './startup'`

**Before:**
```typescript
export { registerSessionsIPC } from './sessions'
export { registerDialogIPC } from './dialog'
export { registerShellIPC } from './shell'
```

**After:**
```typescript
export { registerSessionsIPC } from './sessions'
export { registerDialogIPC } from './dialog'
export { registerShellIPC } from './shell'
export { registerStartupIPC } from './startup'
```

---

### Task 5: Update main process index.ts

**File:** `/Users/teazyou/dev/grimoire/src/main/index.ts`

**Actions:**
1. Add `registerStartupIPC` to import from `./ipc`
2. Call `registerStartupIPC()` after other IPC registrations in `app.whenReady()`

**Change in import:**
```typescript
import { registerSessionsIPC, registerDialogIPC, registerShellIPC, registerStartupIPC } from './ipc'
```

**Change in whenReady:**
```typescript
app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerSessionsIPC()
  registerDialogIPC()
  registerShellIPC()
  registerStartupIPC()  // Add this line

  // ... rest unchanged
})
```

---

### Task 6: Update preload/index.ts [AC2, AC3, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/preload/index.ts`

**Actions:**
1. Add `startup` namespace to `grimoireAPI` object
2. Expose `verify` method that invokes `startup:verify`
3. Expose event listeners for `startup:stepComplete` and `startup:allComplete`

**Code to add (inside grimoireAPI object, after `shell` namespace):**
```typescript
// Startup verification (Story 4-1)
startup: {
  verify: (): Promise<{ success: boolean; failedStep?: string; error?: string }> =>
    ipcRenderer.invoke('startup:verify'),
  onStepComplete: (
    callback: (data: { step: string; success: boolean; error?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { step: string; success: boolean; error?: string }
    ): void => callback(data)
    ipcRenderer.on('startup:stepComplete', handler)
    return () => ipcRenderer.removeListener('startup:stepComplete', handler)
  },
  onAllComplete: (callback: (data: { success: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { success: boolean }): void =>
      callback(data)
    ipcRenderer.on('startup:allComplete', handler)
    return () => ipcRenderer.removeListener('startup:allComplete', handler)
  }
}
```

---

### Task 7: Update preload/index.d.ts

**File:** `/Users/teazyou/dev/grimoire/src/preload/index.d.ts`

**Actions:**
1. Add `startup` namespace interface to `GrimoireAPI`

**Code to add (inside GrimoireAPI interface):**
```typescript
// Startup verification (Story 4-1)
startup: {
  verify: () => Promise<{ success: boolean; failedStep?: string; error?: string }>
  onStepComplete: (
    callback: (data: { step: string; success: boolean; error?: string }) => void
  ) => () => void
  onAllComplete: (callback: (data: { success: boolean }) => void) => () => void
}
```

---

### Task 8: Add CSS animations [AC1, AC5]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css`

**Actions:**
1. Add loading screen pulse animation keyframes
2. Add fade-out transition class
3. Add logo pulse class

**Code to append:**
```css
/* ========================================
 * Story 4-1: Loading Screen Animations
 * ======================================== */

/* Logo pulse animation - subtle scale/opacity pulse */
@keyframes logo-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.02);
  }
}

.loading-logo-pulse {
  animation: logo-pulse 2s ease-in-out infinite;
}

/* Loading screen fade-out transition */
.loading-screen-fade-out {
  animation: loading-fade-out 200ms ease-out forwards;
}

@keyframes loading-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
    visibility: hidden;
  }
}
```

---

### Task 9: Create LoadingScreen component [AC1, AC6]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/LoadingScreen.tsx`

**Actions:**
1. Create component with full-screen dark background
2. Center Grimoire logo text with pulse animation
3. Display current step text below logo in muted color
4. Support fade-out animation when transitioning
5. Show ErrorModal when in error state

**Code:**
```typescript
import type { ReactElement } from 'react'
import { ErrorModal } from './ErrorModal'

interface LoadingScreenProps {
  status: 'loading' | 'error' | 'ready'
  currentStep: string
  errorMessage: string | null
  errorType: 'claude' | 'config' | 'auth' | null
  onRetry: () => void
  onQuit: () => void
  fadeOut?: boolean
}

export function LoadingScreen({
  status,
  currentStep,
  errorMessage,
  errorType,
  onRetry,
  onQuit,
  fadeOut = false
}: LoadingScreenProps): ReactElement {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-base)] ${
        fadeOut ? 'loading-screen-fade-out' : ''
      }`}
      data-testid="loading-screen"
    >
      {/* Logo */}
      <h1
        className="text-4xl font-bold text-[var(--accent)] loading-logo-pulse mb-4"
        data-testid="loading-logo"
      >
        Grimoire
      </h1>

      {/* Current step text */}
      <p
        className="text-sm text-[var(--text-muted)]"
        data-testid="loading-step"
      >
        {currentStep}
      </p>

      {/* Error Modal */}
      {status === 'error' && errorMessage && errorType && (
        <ErrorModal
          errorType={errorType}
          errorMessage={errorMessage}
          onRetry={onRetry}
          onQuit={onQuit}
        />
      )}
    </div>
  )
}
```

---

### Task 10: Create LoadingScreen.test.tsx [AC1, AC6]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/LoadingScreen.test.tsx`

**Actions:**
1. Test renders logo
2. Test renders current step text
3. Test shows ErrorModal when status is error
4. Test applies fade-out class when fadeOut prop is true
5. Test onRetry and onQuit callbacks passed to ErrorModal

**Code:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingScreen } from './LoadingScreen'

describe('LoadingScreen', () => {
  const defaultProps = {
    status: 'loading' as const,
    currentStep: 'Initializing...',
    errorMessage: null,
    errorType: null,
    onRetry: vi.fn(),
    onQuit: vi.fn()
  }

  it('renders the Grimoire logo', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.getByTestId('loading-logo')).toHaveTextContent('Grimoire')
  })

  it('renders the current step text', () => {
    render(<LoadingScreen {...defaultProps} currentStep="Checking Claude Code..." />)
    expect(screen.getByTestId('loading-step')).toHaveTextContent('Checking Claude Code...')
  })

  it('applies pulse animation to logo', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.getByTestId('loading-logo')).toHaveClass('loading-logo-pulse')
  })

  it('shows ErrorModal when status is error', () => {
    render(
      <LoadingScreen
        {...defaultProps}
        status="error"
        errorMessage="Claude not found"
        errorType="claude"
      />
    )
    expect(screen.getByTestId('error-modal')).toBeInTheDocument()
  })

  it('does not show ErrorModal when status is loading', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument()
  })

  it('applies fade-out class when fadeOut is true', () => {
    render(<LoadingScreen {...defaultProps} fadeOut={true} />)
    expect(screen.getByTestId('loading-screen')).toHaveClass('loading-screen-fade-out')
  })

  it('does not apply fade-out class by default', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.getByTestId('loading-screen')).not.toHaveClass('loading-screen-fade-out')
  })
})
```

---

### Task 11: Create ErrorModal component [AC2, AC3, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/ErrorModal.tsx`

**Actions:**
1. Create modal with dark overlay
2. Display error message with instructions based on errorType
3. Add Retry button
4. Add Quit button
5. Instructions per error type:
   - claude: "Claude Code is not installed or not in PATH. Please install from https://claude.ai/download"
   - config: "Failed to initialize configuration directory. Please check permissions."
   - auth: "Authentication required. Please run 'claude' in terminal to authenticate."

**Code:**
```typescript
import type { ReactElement } from 'react'

interface ErrorModalProps {
  errorType: 'claude' | 'config' | 'auth'
  errorMessage: string
  onRetry: () => void
  onQuit: () => void
}

const ERROR_INSTRUCTIONS: Record<'claude' | 'config' | 'auth', string> = {
  claude: 'Claude Code is not installed or not in PATH. Please install from https://claude.ai/download',
  config: 'Failed to initialize configuration directory. Please check permissions.',
  auth: "Authentication required. Please run 'claude' in terminal to authenticate."
}

export function ErrorModal({
  errorType,
  errorMessage,
  onRetry,
  onQuit
}: ErrorModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="error-modal"
    >
      <div className="bg-[var(--bg-elevated)] rounded-lg p-6 max-w-md mx-4 shadow-xl border border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--error)] mb-2">
          Startup Error
        </h2>

        <p className="text-[var(--text-primary)] mb-4" data-testid="error-message">
          {errorMessage}
        </p>

        <p className="text-sm text-[var(--text-muted)] mb-6" data-testid="error-instructions">
          {ERROR_INSTRUCTIONS[errorType]}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onQuit}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            data-testid="quit-button"
          >
            Quit
          </button>
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 12: Create ErrorModal.test.tsx [AC2, AC3, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/ErrorModal.test.tsx`

**Actions:**
1. Test renders error message
2. Test renders correct instructions for each error type
3. Test Retry button calls onRetry
4. Test Quit button calls onQuit

**Code:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorModal } from './ErrorModal'

describe('ErrorModal', () => {
  const defaultProps = {
    errorType: 'claude' as const,
    errorMessage: 'Claude not found',
    onRetry: vi.fn(),
    onQuit: vi.fn()
  }

  it('renders error message', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByTestId('error-message')).toHaveTextContent('Claude not found')
  })

  it('shows claude installation instructions for claude error', () => {
    render(<ErrorModal {...defaultProps} errorType="claude" />)
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('not installed')
  })

  it('shows config instructions for config error', () => {
    render(<ErrorModal {...defaultProps} errorType="config" />)
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('configuration directory')
  })

  it('shows auth instructions for auth error', () => {
    render(<ErrorModal {...defaultProps} errorType="auth" />)
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('Authentication required')
  })

  it('calls onRetry when Retry button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorModal {...defaultProps} onRetry={onRetry} />)
    fireEvent.click(screen.getByTestId('retry-button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onQuit when Quit button clicked', () => {
    const onQuit = vi.fn()
    render(<ErrorModal {...defaultProps} onQuit={onQuit} />)
    fireEvent.click(screen.getByTestId('quit-button'))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})
```

---

### Task 13: Create useAppInit hook [AC5, AC6]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/useAppInit.ts`

**Actions:**
1. Create hook that manages startup state
2. Call `window.grimoireAPI.startup.verify()` on mount
3. Listen for `startup:stepComplete` events
4. Map step names to display text
5. Transition to 'ready' on success, 'error' on failure
6. Track startup time for performance validation
7. Provide retry function

**Code:**
```typescript
import { useState, useEffect, useCallback, useRef } from 'react'

interface StartupState {
  status: 'loading' | 'error' | 'ready'
  currentStep: string
  errorMessage: string | null
  errorType: 'claude' | 'config' | 'auth' | null
}

const STEP_DISPLAY_TEXT: Record<string, string> = {
  claude: 'Checking Claude Code...',
  config: 'Verifying configuration...',
  auth: 'Checking authentication...',
  complete: 'Ready'
}

export function useAppInit(): StartupState & { retry: () => void } {
  const [state, setState] = useState<StartupState>({
    status: 'loading',
    currentStep: 'Initializing...',
    errorMessage: null,
    errorType: null
  })

  const startTimeRef = useRef<number>(Date.now())
  const hasStartedRef = useRef(false)

  const runVerification = useCallback(async () => {
    setState({
      status: 'loading',
      currentStep: 'Initializing...',
      errorMessage: null,
      errorType: null
    })
    startTimeRef.current = Date.now()

    try {
      const result = await window.grimoireAPI.startup.verify()

      if (result.success) {
        const elapsed = Date.now() - startTimeRef.current
        console.log(`[useAppInit] Startup completed in ${elapsed}ms`)
        setState((prev) => ({
          ...prev,
          status: 'ready',
          currentStep: 'Ready'
        }))
      } else {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.error || 'Startup verification failed',
          errorType: result.failedStep as 'claude' | 'config' | 'auth' | null
        }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: null
      }))
    }
  }, [])

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    // Subscribe to step completion events
    const unsubscribeStep = window.grimoireAPI.startup.onStepComplete((data) => {
      if (data.success) {
        setState((prev) => ({
          ...prev,
          currentStep: STEP_DISPLAY_TEXT[data.step] || data.step
        }))
      }
    })

    // Run verification
    runVerification()

    return () => {
      unsubscribeStep()
    }
  }, [runVerification])

  const retry = useCallback(() => {
    hasStartedRef.current = false
    runVerification()
  }, [runVerification])

  return { ...state, retry }
}
```

---

### Task 14: Create useAppInit.test.ts [AC5, AC6]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/useAppInit.test.ts`

**Actions:**
1. Mock `window.grimoireAPI.startup`
2. Test initial state is loading
3. Test updates step on stepComplete events
4. Test transitions to ready on success
5. Test transitions to error with message on failure
6. Test retry function restarts verification

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAppInit } from './useAppInit'

describe('useAppInit', () => {
  let mockVerify: ReturnType<typeof vi.fn>
  let mockOnStepComplete: ReturnType<typeof vi.fn>
  let stepCallbacks: Array<(data: { step: string; success: boolean; error?: string }) => void>

  beforeEach(() => {
    stepCallbacks = []
    mockVerify = vi.fn()
    mockOnStepComplete = vi.fn((callback) => {
      stepCallbacks.push(callback)
      return () => {
        const idx = stepCallbacks.indexOf(callback)
        if (idx > -1) stepCallbacks.splice(idx, 1)
      }
    })

    window.grimoireAPI = {
      ...window.grimoireAPI,
      startup: {
        verify: mockVerify,
        onStepComplete: mockOnStepComplete,
        onAllComplete: vi.fn(() => () => {})
      }
    } as typeof window.grimoireAPI
  })

  it('starts with loading status', () => {
    mockVerify.mockReturnValue(new Promise(() => {})) // Never resolves
    const { result } = renderHook(() => useAppInit())
    expect(result.current.status).toBe('loading')
    expect(result.current.currentStep).toBe('Initializing...')
  })

  it('transitions to ready on successful verification', async () => {
    mockVerify.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.currentStep).toBe('Ready')
  })

  it('transitions to error on failed verification', async () => {
    mockVerify.mockResolvedValue({
      success: false,
      failedStep: 'claude',
      error: 'Claude not found'
    })
    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.errorMessage).toBe('Claude not found')
    expect(result.current.errorType).toBe('claude')
  })

  it('updates current step on stepComplete events', async () => {
    mockVerify.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAppInit())

    act(() => {
      stepCallbacks.forEach((cb) => cb({ step: 'claude', success: true }))
    })

    expect(result.current.currentStep).toBe('Checking Claude Code...')
  })

  it('retry function restarts verification', async () => {
    mockVerify.mockResolvedValueOnce({ success: false, failedStep: 'claude', error: 'Failed' })
    mockVerify.mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(mockVerify).toHaveBeenCalledTimes(2)
  })
})
```

---

### Task 15: Create barrel export

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/index.ts`

**Actions:**
1. Export LoadingScreen, ErrorModal, useAppInit

**Code:**
```typescript
export { LoadingScreen } from './LoadingScreen'
export { ErrorModal } from './ErrorModal'
export { useAppInit } from './useAppInit'
```

---

### Task 16: Update App.tsx [AC1, AC5]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/App.tsx`

**Actions:**
1. Import `LoadingScreen` and `useAppInit` from `./core/loading`
2. Use `useAppInit` hook to get startup state
3. Show `LoadingScreen` when status is 'loading' or 'error'
4. Show main UI (Shell) when status is 'ready'
5. Add fade-out state for smooth transition
6. Handle quit by calling `window.close()`

**Updated Code:**
```typescript
import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Shell } from './core/shell'
import { LoadingScreen, useAppInit } from './core/loading'

function App(): ReactElement {
  const { status, currentStep, errorMessage, errorType, retry } = useAppInit()
  const [showLoading, setShowLoading] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (status === 'ready') {
      // Start fade-out animation
      setFadeOut(true)
      // Hide loading screen after animation completes (200ms)
      const timer = setTimeout(() => {
        setShowLoading(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [status])

  const handleQuit = (): void => {
    window.close()
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      {showLoading && (
        <LoadingScreen
          status={status}
          currentStep={currentStep}
          errorMessage={errorMessage}
          errorType={errorType}
          onRetry={retry}
          onQuit={handleQuit}
          fadeOut={fadeOut}
        />
      )}
      {!showLoading && <Shell />}
    </Tooltip.Provider>
  )
}

export default App
```

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| None | N/A | This story has no dependencies on other stories |

---

## Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|---------------|
| `/Users/teazyou/dev/grimoire/src/main/startup-verifier.test.ts` | Verification functions with mocked child_process and fs |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/LoadingScreen.test.tsx` | Component rendering, animation classes |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/ErrorModal.test.tsx` | Error display, button callbacks |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/loading/useAppInit.test.ts` | Hook state transitions, IPC integration |

### Integration Tests

- Full startup flow with mocked IPC can be tested via App.tsx test
- Manual testing: launch app with/without claude installed

### Test Commands

```bash
# Run all tests
npm run test

# Run validation (typecheck + test + lint)
npm run validate
```

---

## Performance Considerations

- **NFR1 Compliance:** Total startup < 3 seconds
- Each verification step has 5 second timeout to prevent hangs
- Claude check may be slow on first run (PATH resolution)
- Fade-out animation is 200ms (AC5)

---

## Scope Boundaries

### In Scope
- Loading screen with logo and step text
- Claude Code installation check
- Config directory verification and creation
- Authentication check
- Error modal with retry/quit
- Smooth transition to main UI

### Out of Scope
- Actual Grimoire logo image (text placeholder used)
- Custom authentication flow (uses CLI auth)
- Detailed error logging/telemetry
- Offline mode handling

---

## Checklist Verification

- [x] ACTIONABLE: Every task has clear file path AND specific action
- [x] LOGICAL: Tasks ordered by dependency (main process first, then IPC, then preload, then renderer)
- [x] TESTABLE: All ACs use Given/When/Then format in story file
- [x] COMPLETE: No placeholders, no "TBD", no "TODO"
- [x] SELF-CONTAINED: A fresh agent can implement without reading conversation history
- [x] Files to Reference table is populated with real paths
- [x] Codebase Patterns section matches actual project patterns
- [x] Implementation tasks are numbered and sequenced
- [x] Dependencies section lists any required prior work
- [x] Testing Strategy specifies test types and locations
- [x] No task requires "figure out" or "research" - all decided upfront
- [x] No ambiguous instructions that could be interpreted multiple ways
- [x] Scope boundaries are explicit (what NOT to do)

CHECKLIST COMPLETED: YES
