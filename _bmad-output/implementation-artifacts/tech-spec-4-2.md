# Tech Spec: Story 4-2 - Offline Mode and Status Indication

## Overview

This specification details the implementation of offline mode support for Grimoire. The system monitors network connectivity, displays a status indicator, allows read-only operations offline, and blocks CC spawning with clear error messages when offline.

**Story Reference:** `/Users/teazyou/dev/grimoire/_bmad-output/implementation-artifacts/story-4-2.md`

---

## Technical Discovery Summary

### Codebase Patterns Identified

1. **IPC Channel Pattern**: All IPC channels use `namespace:action` format (e.g., `sessions:sendMessage`, `network:getStatus`)
2. **Preload Bridge Pattern**: APIs exposed via `window.grimoireAPI.<namespace>.<method>()` in `/Users/teazyou/dev/grimoire/src/preload/index.ts`
3. **Event Emission Pattern**: `emitToRenderer()` function in `/Users/teazyou/dev/grimoire/src/main/sessions/stream-parser.ts` broadcasts to all windows
4. **Zustand Store Pattern**: Shared state via stores in `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/`
5. **Shared Hooks Location**: `/Users/teazyou/dev/grimoire/src/renderer/src/shared/hooks/` (currently empty with .gitkeep)
6. **Ribbon Layout**: Navigation in `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/Ribbon.tsx` with tooltip pattern
7. **ChatInput Disabled States**: Already handles disabled via props, has working state handling

### Existing Code to Leverage

| Pattern | File | Usage |
|---------|------|-------|
| Event emission | `/Users/teazyou/dev/grimoire/src/main/sessions/stream-parser.ts` | `emitToRenderer()` for broadcasting network events |
| CC spawner error handling | `/Users/teazyou/dev/grimoire/src/main/sessions/cc-spawner.ts` | Error event emission pattern |
| IPC registration | `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts` | Export pattern for IPC handlers |
| Tooltip pattern | `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/Ribbon.tsx` | `@radix-ui/react-tooltip` usage |
| cn utility | `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/cn.ts` | Tailwind class merging |

---

## Files to Reference

| File Path | Purpose |
|-----------|---------|
| `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts` | IPC registration exports |
| `/Users/teazyou/dev/grimoire/src/main/index.ts` | Main process entry for network monitor init |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | Context bridge API exposure |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | TypeScript declarations for preload API |
| `/Users/teazyou/dev/grimoire/src/main/sessions/cc-spawner.ts` | CC spawn logic to add network check |
| `/Users/teazyou/dev/grimoire/src/main/sessions/stream-parser.ts` | `emitToRenderer()` reference |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.tsx` | Add offline disabled state |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/Ribbon.tsx` | Add network indicator |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/Shell.tsx` | Alternative location for network indicator |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` | Zustand store pattern reference |

---

## Files to Create

| File Path | Description |
|-----------|-------------|
| `/Users/teazyou/dev/grimoire/src/main/network-monitor.ts` | Network status monitoring in main process |
| `/Users/teazyou/dev/grimoire/src/main/network-monitor.test.ts` | Tests for network monitor |
| `/Users/teazyou/dev/grimoire/src/main/ipc/network.ts` | IPC handlers for network namespace |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/hooks/useNetworkStatus.ts` | Network status React hook |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/hooks/useNetworkStatus.test.ts` | Hook tests |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/components/NetworkIndicator.tsx` | Network status indicator component |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/components/NetworkIndicator.test.tsx` | Indicator tests |

---

## Files to Modify

| File Path | Changes |
|-----------|---------|
| `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts` | Export `registerNetworkIPC` |
| `/Users/teazyou/dev/grimoire/src/main/index.ts` | Import and call `registerNetworkIPC()`, start network monitoring |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | Add `network` namespace to `grimoireAPI` |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | Add TypeScript declarations for network API |
| `/Users/teazyou/dev/grimoire/src/main/sessions/cc-spawner.ts` | Add online check before spawn |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.tsx` | Disable send when offline |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/Ribbon.tsx` | Add NetworkIndicator at bottom |

---

## Implementation Tasks

### Task 1: Create network-monitor.ts [AC3, AC5]

**File:** `/Users/teazyou/dev/grimoire/src/main/network-monitor.ts`

**Actions:**
1. Create new file at the specified path
2. Import `net` from `electron`, `BrowserWindow` from `electron`
3. Create `emitToRenderer()` helper (same as stream-parser pattern)
4. Create cached `_isOnline` state variable, default `true`
5. Implement `isOnline()` function returning cached state
6. Implement `startNetworkMonitoring()`:
   - Initialize with current `net.isOnline()` value
   - Set up interval (5 seconds) to poll `net.isOnline()`
   - On status change, update cache and emit `network:statusChanged`
7. Export both functions

**Code:**
```typescript
import { net, BrowserWindow } from 'electron'

/**
 * Cached network status - defaults to true (assume online until proven otherwise)
 */
let _isOnline = true

/**
 * Polling interval handle for cleanup
 */
let pollInterval: NodeJS.Timeout | null = null

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
 * Returns the cached network status.
 * Safe to call synchronously from anywhere in the main process.
 */
export function isOnline(): boolean {
  return _isOnline
}

/**
 * Starts network status monitoring.
 * Polls every 5 seconds and emits 'network:statusChanged' on transitions.
 * Should be called once during app initialization.
 */
export function startNetworkMonitoring(): void {
  // Initialize with current status
  _isOnline = net.isOnline()

  // Clear any existing interval (safety for dev hot-reload)
  if (pollInterval) {
    clearInterval(pollInterval)
  }

  // Poll every 5 seconds
  pollInterval = setInterval(() => {
    const newStatus = net.isOnline()
    if (newStatus !== _isOnline) {
      _isOnline = newStatus
      emitToRenderer('network:statusChanged', { online: newStatus })
      console.log(`[network-monitor] Status changed: ${newStatus ? 'online' : 'offline'}`)
    }
  }, 5000)
}

/**
 * Stops network monitoring (for testing/cleanup).
 */
export function stopNetworkMonitoring(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}
```

---

### Task 2: Create network-monitor.test.ts [AC3, AC5]

**File:** `/Users/teazyou/dev/grimoire/src/main/network-monitor.test.ts`

**Actions:**
1. Create test file at specified path
2. Mock `electron` module (`net.isOnline`, `BrowserWindow.getAllWindows`)
3. Test `isOnline()` returns true by default
4. Test `isOnline()` returns current cached state
5. Test `startNetworkMonitoring()` initializes with current state
6. Test status change emits event
7. Test `stopNetworkMonitoring()` clears interval

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockNetIsOnline = vi.fn()
const mockSend = vi.fn()
const mockGetAllWindows = vi.fn()

vi.mock('electron', () => ({
  net: {
    isOnline: () => mockNetIsOnline()
  },
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows()
  }
}))

import { isOnline, startNetworkMonitoring, stopNetworkMonitoring } from './network-monitor'

describe('network-monitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNetIsOnline.mockReturnValue(true)
    mockGetAllWindows.mockReturnValue([{ webContents: { send: mockSend } }])
    mockSend.mockClear()
  })

  afterEach(() => {
    stopNetworkMonitoring()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('isOnline', () => {
    it('returns true by default', () => {
      expect(isOnline()).toBe(true)
    })
  })

  describe('startNetworkMonitoring', () => {
    it('initializes with current network state', () => {
      mockNetIsOnline.mockReturnValue(false)
      startNetworkMonitoring()
      expect(isOnline()).toBe(false)
    })

    it('emits event when status changes to offline', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()

      // Change to offline
      mockNetIsOnline.mockReturnValue(false)
      vi.advanceTimersByTime(5000)

      expect(mockSend).toHaveBeenCalledWith('network:statusChanged', { online: false })
    })

    it('emits event when status changes to online', () => {
      mockNetIsOnline.mockReturnValue(false)
      startNetworkMonitoring()

      // Change to online
      mockNetIsOnline.mockReturnValue(true)
      vi.advanceTimersByTime(5000)

      expect(mockSend).toHaveBeenCalledWith('network:statusChanged', { online: true })
    })

    it('does not emit event when status unchanged', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()

      // Keep online
      vi.advanceTimersByTime(5000)
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('stopNetworkMonitoring', () => {
    it('stops polling', () => {
      startNetworkMonitoring()
      stopNetworkMonitoring()

      mockNetIsOnline.mockReturnValue(false)
      vi.advanceTimersByTime(5000)

      // No event should be emitted after stop
      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
```

---

### Task 3: Create IPC handlers (network.ts) [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/main/ipc/network.ts`

**Actions:**
1. Create new file at specified path
2. Import `ipcMain` from `electron`
3. Import `isOnline` from `../network-monitor`
4. Implement `registerNetworkIPC()`:
   - Register `network:getStatus` handler returning `{ online: boolean }`
5. Export the function

**Code:**
```typescript
import { ipcMain } from 'electron'
import { isOnline } from '../network-monitor'

export function registerNetworkIPC(): void {
  ipcMain.handle('network:getStatus', () => {
    return { online: isOnline() }
  })
}
```

---

### Task 4: Update IPC index.ts

**File:** `/Users/teazyou/dev/grimoire/src/main/ipc/index.ts`

**Actions:**
1. Add export for `registerNetworkIPC`

**Before:**
```typescript
export { registerSessionsIPC } from './sessions'
export { registerDialogIPC } from './dialog'
export { registerShellIPC } from './shell'
export { registerStartupIPC } from './startup'
```

**After:**
```typescript
export { registerSessionsIPC } from './sessions'
export { registerDialogIPC } from './dialog'
export { registerShellIPC } from './shell'
export { registerStartupIPC } from './startup'
export { registerNetworkIPC } from './network'
```

---

### Task 5: Update main process index.ts

**File:** `/Users/teazyou/dev/grimoire/src/main/index.ts`

**Actions:**
1. Add import for `registerNetworkIPC` from `./ipc`
2. Add import for `startNetworkMonitoring` from `./network-monitor`
3. Call `registerNetworkIPC()` after other IPC registrations
4. Call `startNetworkMonitoring()` after IPC registration

**Change in imports:**
```typescript
import { registerSessionsIPC, registerDialogIPC, registerShellIPC, registerStartupIPC, registerNetworkIPC } from './ipc'
import { startNetworkMonitoring } from './network-monitor'
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
  registerStartupIPC()
  registerNetworkIPC()  // Add this line

  // Start network monitoring
  startNetworkMonitoring()  // Add this line

  // ... rest unchanged
})
```

---

### Task 6: Update preload/index.ts [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/preload/index.ts`

**Actions:**
1. Add `network` namespace to `grimoireAPI` object
2. Expose `getStatus` method that invokes `network:getStatus`
3. Expose event listener for `network:statusChanged`

**Code to add (inside grimoireAPI object, after `shell` namespace, before closing brace):**
```typescript
// Network status (Story 4-2)
network: {
  getStatus: (): Promise<{ online: boolean }> => ipcRenderer.invoke('network:getStatus'),
  onStatusChanged: (callback: (data: { online: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { online: boolean }): void =>
      callback(data)
    ipcRenderer.on('network:statusChanged', handler)
    return () => ipcRenderer.removeListener('network:statusChanged', handler)
  }
}
```

---

### Task 7: Update preload/index.d.ts

**File:** `/Users/teazyou/dev/grimoire/src/preload/index.d.ts`

**Actions:**
1. Add `network` namespace interface to `GrimoireAPI`

**Code to add (inside GrimoireAPI interface, after `shell` namespace):**
```typescript
// Network status (Story 4-2)
network: {
  getStatus: () => Promise<{ online: boolean }>
  onStatusChanged: (callback: (data: { online: boolean }) => void) => () => void
}
```

---

### Task 8: Create useNetworkStatus hook [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/shared/hooks/useNetworkStatus.ts`

**Actions:**
1. Create new file at specified path (remove .gitkeep if present)
2. Query initial status on mount
3. Listen for status change events
4. Clean up listener on unmount
5. Return `{ online: boolean, lastChecked: number }`

**Code:**
```typescript
import { useState, useEffect } from 'react'

interface NetworkStatus {
  online: boolean
  lastChecked: number
}

/**
 * Hook that provides current network connectivity status.
 * Queries initial status from main process and subscribes to changes.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    online: true, // Optimistic default
    lastChecked: Date.now()
  })

  useEffect(() => {
    // Query initial status
    window.grimoireAPI.network.getStatus().then((result) => {
      setStatus({
        online: result.online,
        lastChecked: Date.now()
      })
    })

    // Subscribe to changes
    const unsubscribe = window.grimoireAPI.network.onStatusChanged((data) => {
      setStatus({
        online: data.online,
        lastChecked: Date.now()
      })
    })

    return unsubscribe
  }, [])

  return status
}
```

---

### Task 9: Create useNetworkStatus.test.ts [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/shared/hooks/useNetworkStatus.test.ts`

**Actions:**
1. Create test file at specified path
2. Mock `window.grimoireAPI.network`
3. Test returns optimistic default initially
4. Test updates with initial status from IPC
5. Test updates on statusChanged events
6. Test cleans up listener on unmount

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  let mockGetStatus: ReturnType<typeof vi.fn>
  let mockOnStatusChanged: ReturnType<typeof vi.fn>
  let statusCallbacks: Array<(data: { online: boolean }) => void>

  beforeEach(() => {
    statusCallbacks = []
    mockGetStatus = vi.fn().mockResolvedValue({ online: true })
    mockOnStatusChanged = vi.fn((callback) => {
      statusCallbacks.push(callback)
      return () => {
        const idx = statusCallbacks.indexOf(callback)
        if (idx > -1) statusCallbacks.splice(idx, 1)
      }
    })

    window.grimoireAPI = {
      ...window.grimoireAPI,
      network: {
        getStatus: mockGetStatus,
        onStatusChanged: mockOnStatusChanged
      }
    } as typeof window.grimoireAPI
  })

  it('returns optimistic online default', () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.online).toBe(true)
  })

  it('updates with initial status from IPC', async () => {
    mockGetStatus.mockResolvedValue({ online: false })
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(result.current.online).toBe(false)
    })
  })

  it('updates on statusChanged events', async () => {
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(mockOnStatusChanged).toHaveBeenCalled()
    })

    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: false }))
    })

    expect(result.current.online).toBe(false)
  })

  it('cleans up listener on unmount', async () => {
    const { unmount } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(statusCallbacks.length).toBe(1)
    })

    unmount()

    expect(statusCallbacks.length).toBe(0)
  })

  it('updates lastChecked timestamp', async () => {
    const { result } = renderHook(() => useNetworkStatus())
    const initialTime = result.current.lastChecked

    await waitFor(() => {
      expect(mockOnStatusChanged).toHaveBeenCalled()
    })

    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: false }))
    })

    expect(result.current.lastChecked).toBeGreaterThanOrEqual(initialTime)
  })
})
```

---

### Task 10: Create NetworkIndicator component [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/shared/components/NetworkIndicator.tsx`

**Actions:**
1. Create new directory `src/renderer/src/shared/components/` if needed
2. Create component file
3. Import `useNetworkStatus` hook
4. Import Tooltip from radix-ui
5. Render small dot indicator:
   - Online: green dot, low opacity, no animation
   - Offline: red dot, pulse animation
6. Wrap with tooltip showing status text

**Code:**
```typescript
import type { ReactElement } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { cn } from '../utils/cn'

/**
 * Small network status indicator.
 * Subtle when online (green, muted), attention-grabbing when offline (red, pulsing).
 */
export function NetworkIndicator(): ReactElement {
  const { online } = useNetworkStatus()

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors cursor-default',
            online ? 'bg-[var(--success)]/50' : 'bg-[var(--error)] animate-pulse'
          )}
          role="status"
          aria-label={online ? 'Online' : 'Offline'}
          data-testid="network-indicator"
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] z-50"
        >
          {online ? 'Online' : 'Offline - Some features unavailable'}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
```

---

### Task 11: Create NetworkIndicator.test.tsx [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/shared/components/NetworkIndicator.test.tsx`

**Actions:**
1. Create test file at specified path
2. Mock `useNetworkStatus` hook
3. Test shows green indicator when online
4. Test shows red indicator when offline
5. Test has correct aria-label

**Code:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { NetworkIndicator } from './NetworkIndicator'

// Mock the hook
vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn()
}))

import { useNetworkStatus } from '../hooks/useNetworkStatus'

const mockUseNetworkStatus = vi.mocked(useNetworkStatus)

// Wrapper with Tooltip.Provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>
}

describe('NetworkIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows green indicator when online', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    const indicator = screen.getByTestId('network-indicator')
    expect(indicator).toHaveClass('bg-[var(--success)]/50')
    expect(indicator).not.toHaveClass('animate-pulse')
  })

  it('shows red pulsing indicator when offline', () => {
    mockUseNetworkStatus.mockReturnValue({ online: false, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    const indicator = screen.getByTestId('network-indicator')
    expect(indicator).toHaveClass('bg-[var(--error)]')
    expect(indicator).toHaveClass('animate-pulse')
  })

  it('has correct aria-label when online', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })

  it('has correct aria-label when offline', () => {
    mockUseNetworkStatus.mockReturnValue({ online: false, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    expect(screen.getByLabelText('Offline')).toBeInTheDocument()
  })
})
```

---

### Task 12: Add network check to CC spawner [AC2, AC4]

**File:** `/Users/teazyou/dev/grimoire/src/main/sessions/cc-spawner.ts`

**Actions:**
1. Add import: `import { isOnline } from '../network-monitor'`
2. At the start of `spawnCC()` function (after destructuring options), add network check
3. If offline, emit error event and throw error (caller already handles exceptions)

**Add import at top of file:**
```typescript
import { isOnline } from '../network-monitor'
```

**Code to insert after line 58 in spawnCC (after `const { sessionId, folderPath, message } = options`):**
```typescript
// Network check (Story 4-2 AC4)
if (!isOnline()) {
  const errorId = sessionId ?? `pending-${Date.now()}`
  instanceStateManager.transition(errorId, 'PROCESS_ERROR')
  emitToRenderer('stream:end', {
    sessionId: errorId,
    success: false,
    error: 'Internet connection required to use Claude Code. Please check your network connection and try again.'
  })
  throw new Error('Internet connection required to use Claude Code')
}
```

---

### Task 13: Update ChatInput for offline state [AC2]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.tsx`

**Actions:**
1. Add import for `useNetworkStatus` hook
2. Call hook inside component
3. Add `isOffline` derived boolean
4. Modify `canSend` to also check online status
5. Add title attribute to send button showing offline message
6. Optionally show subtle offline text below input

**Changes:**

**Add import:**
```typescript
import { useNetworkStatus } from '@renderer/shared/hooks/useNetworkStatus'
```

**Inside component, after useState:**
```typescript
const { online } = useNetworkStatus()
const isOffline = !online
```

**Modify canSend calculation:**
```typescript
const canSend = value.trim().length > 0 && !disabled && online
```

**Modify send button (the non-working state button) to show offline tooltip:**
```typescript
<button
  type="button"
  onClick={handleSend}
  disabled={!canSend}
  title={isOffline ? 'Internet required to send messages' : undefined}
  className={cn(
    // ... existing classes
  )}
  aria-label={isOffline ? 'Send message (offline)' : 'Send message'}
>
  <Send className="w-4 h-4" />
</button>
```

---

### Task 14: Update ChatInput.test.tsx [AC2]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.test.tsx`

**Actions:**
1. Add mock for `useNetworkStatus` hook
2. Add tests for offline behavior:
   - Send button disabled when offline
   - Button shows offline title when offline
   - Button re-enables when online

**Add mock at top of test file:**
```typescript
vi.mock('@renderer/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn()
}))

import { useNetworkStatus } from '@renderer/shared/hooks/useNetworkStatus'
const mockUseNetworkStatus = vi.mocked(useNetworkStatus)
```

**Add to beforeEach:**
```typescript
mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
```

**Add new test cases:**
```typescript
describe('offline behavior (Story 4-2)', () => {
  it('disables send button when offline', () => {
    mockUseNetworkStatus.mockReturnValue({ online: false, lastChecked: Date.now() })
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test message' } })

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('shows offline tooltip on send button when offline', () => {
    mockUseNetworkStatus.mockReturnValue({ online: false, lastChecked: Date.now() })
    render(<ChatInput onSend={vi.fn()} />)

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toHaveAttribute('title', 'Internet required to send messages')
  })

  it('enables send button when online', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<ChatInput onSend={vi.fn()} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test message' } })

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).not.toBeDisabled()
  })
})
```

---

### Task 15: Integrate NetworkIndicator into Ribbon [AC3]

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/Ribbon.tsx`

**Actions:**
1. Import `NetworkIndicator` component
2. Add to bottom of ribbon (before closing div)
3. Use `mt-auto` to push to bottom, with padding

**Add import:**
```typescript
import { NetworkIndicator } from '@renderer/shared/components/NetworkIndicator'
```

**Update Ribbon component return (add NetworkIndicator at bottom):**
```typescript
return (
  <div
    className="w-12 flex flex-col items-center py-2 gap-1 bg-[var(--bg-base)] border-r border-[var(--border)]"
    role="navigation"
    aria-label="Main navigation"
    onKeyDown={handleKeyDown}
  >
    <RibbonButton
      icon={<MessagesSquare size={20} />}
      label="Sessions"
      active={activeSection === 'sessions'}
      onClick={() => setActiveSection('sessions')}
    />
    <RibbonButton
      icon={<Settings size={20} />}
      label="Settings"
      active={activeSection === 'settings'}
      disabled
      onClick={() => setActiveSection('settings')}
    />
    {/* Network status indicator - pushed to bottom */}
    <div className="mt-auto pb-2">
      <NetworkIndicator />
    </div>
  </div>
)
```

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 4-1 | Required | Startup verification must be complete (sets up startup flow) |
| Epic 1 (Shell) | Complete | Shell/Ribbon layout exists |
| Epic 3a (ChatInput) | Complete | ChatInput has disabled state patterns |

---

## Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|---------------|
| `/Users/teazyou/dev/grimoire/src/main/network-monitor.test.ts` | Network monitoring with mocked electron.net |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/hooks/useNetworkStatus.test.ts` | Hook state management with mocked IPC |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/components/NetworkIndicator.test.tsx` | Component rendering, accessibility |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.test.tsx` | Offline disabled behavior (add tests) |

### Integration Tests

- Manual testing: Disable network and verify indicator changes
- Manual testing: Verify send blocked when offline with error message
- CC spawner error path tested via existing process-lifecycle tests

### Test Commands

```bash
# Run all tests
npm run test

# Run validation (typecheck + test + lint)
npm run validate
```

---

## Performance Considerations

- Network polling interval: 5 seconds (balance between responsiveness and CPU)
- `net.isOnline()` is efficient (Electron built-in)
- Cached status prevents repeated IPC calls
- No performance impact on offline read operations

---

## Scope Boundaries

### In Scope
- Network status monitoring in main process
- NetworkIndicator component in Ribbon
- CC spawn blocked when offline with error
- ChatInput disabled when offline
- Read-only operations work offline (session list, conversation viewing)

### Out of Scope
- Detailed offline caching of remote data
- Reconnection strategies or retry queues
- Network quality indicators (bandwidth, latency)
- Per-request timeout handling
- Sync operations when coming back online

---

## Graceful Degradation Notes

- All database operations work offline (SQLite is local)
- Session list loads from local database without network
- Conversation files read from local CLAUDE_CONFIG_DIR
- Only CC spawn/send operations require network
- Running CC processes continue until they complete or fail (CC handles its own network)

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
