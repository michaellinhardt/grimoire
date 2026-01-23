---
title: 'Instance State Machine'
slug: '3b-3-instance-state-machine'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - TypeScript 5.9
  - Electron 39.x
  - React 19.x
  - Zustand 5.x
  - Vitest 4.x
files_to_modify:
  - src/main/sessions/types.ts
  - src/main/sessions/cc-spawner.ts
  - src/main/ipc/sessions.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/shared/types/ipc.ts
  - src/renderer/src/features/sessions/components/SessionListItem.tsx
  - src/renderer/src/features/sessions/hooks/useSendMessage.ts
  - src/renderer/src/features/sessions/hooks/useStreamingMessage.ts
code_patterns:
  - Singleton state manager in main process
  - IPC event emission via emitToRenderer
  - Zustand store integration
  - Preload event listeners with cleanup
test_patterns:
  - Vitest with mock functions
  - renderHook for hook testing
  - Mock window.grimoireAPI
  - Mock IPC event handlers
---

# Tech-Spec: Instance State Machine

**Created:** 2026-01-24
**Story Reference:** 3b-3-instance-state-machine.md

## Overview

### Problem Statement

Currently, session state management is scattered across multiple hooks and components:
- `useSendMessage` directly updates tab session state to 'working' via `updateTabSessionState`
- `useStreamingMessage` tracks `isStreaming` separately
- State transitions are implicit and not formally validated
- Error acknowledgement has no formalized flow

This creates race conditions and inconsistent UI state when multiple events occur (spawn error during message send, stream end during working state, etc.).

### Solution

Implement a centralized InstanceStateManager in the main process that:
1. Enforces a formal 3-state machine: `idle` -> `working` -> `idle` (normal) or `idle` -> `working` -> `error` -> `idle` (error flow)
2. Emits `instance:stateChanged` events to all renderer windows on transitions
3. Provides IPC handlers for querying state and acknowledging errors
4. Integrates with cc-spawner to trigger transitions at correct points

### Scope

**In Scope:**
- InstanceStateManager class with state machine logic
- State types and transition events in types.ts
- IPC handlers for getState and acknowledgeError
- Preload API extensions for state events
- Integration with cc-spawner for automatic transitions
- Visual indicator updates in SessionListItem
- Unit tests for all new code

**Out of Scope:**
- Modifying existing streaming display logic (Story 3a-3 handles that)
- Tab state management refactoring (use existing updateTabSessionState)
- Process registry changes (already functional from Story 3b-1)

## Context for Development

### Codebase Patterns

**emitToRenderer Pattern (from src/main/sessions/stream-parser.ts lines 55-60):**
```typescript
export function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}
```

**Singleton Export Pattern:**
```typescript
class Manager {
  private state = new Map<string, State>()
  // methods...
}
export const manager = new Manager()
```

**IPC Handler Pattern (from src/main/ipc/sessions.ts):**
```typescript
ipcMain.handle('sessions:someAction', async (_, data: unknown) => {
  const validated = SomeSchema.parse(data)
  // logic
  return { success: true }
})
```

**Preload Event Listener Pattern (from src/preload/index.ts lines 119-133):**
```typescript
onStreamEnd: (callback: (event: {...}) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: {...}): void =>
    callback(data)
  ipcRenderer.on('stream:end', handler)
  return () => ipcRenderer.removeListener('stream:end', handler)
}
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/main/sessions/stream-parser.ts` | emitToRenderer helper (line 55-60) |
| `src/main/sessions/cc-spawner.ts` | Integration points for state transitions |
| `src/main/sessions/types.ts` | Existing session types (add state types here) |
| `src/main/ipc/sessions.ts` | IPC handlers (add state handlers here) |
| `src/preload/index.ts` | Preload API (add state listeners here) |
| `src/preload/index.d.ts` | Type declarations for GrimoireAPI |
| `src/shared/types/ipc.ts` | Zod schemas for IPC validation |
| `src/renderer/src/shared/store/useUIStore.ts` | SessionState type already defined |
| `src/renderer/src/features/sessions/components/SessionListItem.tsx` | Visual indicators |
| `src/renderer/src/features/sessions/hooks/useSendMessage.ts` | Current state update pattern |
| `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts` | Streaming state management |

### Technical Decisions

1. **State Lives in Main Process:** InstanceStateManager is main-process only. Renderer subscribes via IPC events.

2. **Reuse SessionState Type:** The renderer already has `SessionState = 'idle' | 'working' | 'error'` in useUIStore. Use the same type for consistency.

3. **Transition on stream:end:** Rather than duplicating exit/error handling, the state transition for PROCESS_EXIT/PROCESS_ERROR happens when stream:end is emitted (already covers success/error cases).

4. **State Transfer for New Sessions:** When CC returns the real sessionId via init event, transfer state from temporary key to real sessionId.

5. **Error Acknowledgement Pattern:** Both explicit ACKNOWLEDGE_ERROR and implicit acknowledgement via SEND_MESSAGE work. Sending a new message on error state is common user behavior.

### Discovery Findings

**Current State Flow Analysis:**
1. useSendMessage.ts line 89: `updateTabSessionState(tabId, 'working')` - sets working immediately on send
2. useSendMessage.ts line 109: `updateTabSessionState(tabId, 'idle')` - sets idle on IPC success (but this is premature - CC hasn't responded yet)
3. useSendMessage.ts line 117: `updateTabSessionState(tabId, 'error')` - sets error on IPC failure
4. useStreamingMessage.ts line 122-125: Sets isStreaming=false on stream:end

**Issues with Current Approach:**
- Line 109 sets idle after IPC success, but CC is still processing. The story note says "simulate completion" which is incorrect behavior.
- useSendMessage doesn't listen for stream:end to properly transition back to idle.

**Solution Integration:**
- InstanceStateManager.transition('SEND_MESSAGE') at cc-spawner spawn start
- InstanceStateManager.transition('PROCESS_EXIT' | 'PROCESS_ERROR') at cc-spawner exit/error handlers
- Renderer subscribes to instance:stateChanged and calls updateTabSessionState
- Remove premature idle transition in useSendMessage (line 109)

**Existing Visual Indicators (SessionListItem.tsx lines 58, 70-77):**
```typescript
isWorking && 'border-l-2 border-l-[var(--success)]',
// ...
{isWorking && (
  <span className="flex items-center gap-1 flex-shrink-0">
    <Zap className="w-4 h-4 text-[var(--success)] animate-pulse" />
    <span className="text-[var(--success)] text-xs animate-pulse">...</span>
  </span>
)}
```

The component already accepts `isWorking` prop. Need to add error state indicator.

## Implementation Plan

### Tasks

#### Task 1: Add State Types to Main Process (AC: #1, #6)

**File:** `src/main/sessions/types.ts`

**Action:** Add state machine types at the end of the file (after line 184).

```typescript
// ============================================================
// Instance State Machine Types (Story 3b-3)
// ============================================================

/**
 * Session instance lifecycle states.
 * Matches SessionState in renderer for consistency.
 */
export type InstanceState = 'idle' | 'working' | 'error'

/**
 * State transition events.
 */
export type StateEvent =
  | 'SEND_MESSAGE'      // User sends message -> spawns CC
  | 'PROCESS_EXIT'      // CC exits normally
  | 'PROCESS_ERROR'     // CC exits with error or spawn fails
  | 'ACKNOWLEDGE_ERROR' // User dismisses error

/**
 * Payload for instance:stateChanged IPC event.
 */
export interface InstanceStateChangedEvent {
  sessionId: string
  state: InstanceState
  previousState: InstanceState
}
```

---

#### Task 2: Create InstanceStateManager (AC: #1, #6)

**File:** `src/main/sessions/instance-state-manager.ts` (NEW)

**Action:** Create new file with the state machine implementation.

```typescript
import { emitToRenderer } from './stream-parser'
import type { InstanceState, StateEvent, InstanceStateChangedEvent } from './types'

/**
 * Manages instance state for all sessions.
 * Implements a 3-state machine: idle -> working -> idle (normal)
 * or idle -> working -> error -> idle (error flow).
 *
 * Emits instance:stateChanged events to renderer on all transitions.
 */
class InstanceStateManager {
  private states = new Map<string, InstanceState>()

  /**
   * Get current state for a session.
   * Defaults to 'idle' if session has no state.
   */
  getState(sessionId: string): InstanceState {
    return this.states.get(sessionId) ?? 'idle'
  }

  /**
   * Directly set state for a session (internal use only).
   * Prefer transition() for validated state changes.
   */
  setState(sessionId: string, state: InstanceState): void {
    this.states.set(sessionId, state)
  }

  /**
   * Attempt a state transition based on an event.
   * Invalid transitions are logged and ignored (defensive).
   *
   * @param sessionId - Session UUID
   * @param event - State transition event
   * @returns New state after transition (may be same as current if invalid)
   */
  transition(sessionId: string, event: StateEvent): InstanceState {
    const currentState = this.getState(sessionId)
    const nextState = this.computeNextState(currentState, event)

    if (nextState !== currentState) {
      this.states.set(sessionId, nextState)

      const payload: InstanceStateChangedEvent = {
        sessionId,
        state: nextState,
        previousState: currentState
      }
      emitToRenderer('instance:stateChanged', payload)
    } else if (process.env.DEBUG_STATE_MACHINE) {
      console.debug(
        `[InstanceStateManager] Ignored transition: ${currentState} + ${event} (no change)`
      )
    }

    return nextState
  }

  /**
   * Compute next state based on current state and event.
   * Implements the state machine logic.
   */
  private computeNextState(current: InstanceState, event: StateEvent): InstanceState {
    switch (current) {
      case 'idle':
        if (event === 'SEND_MESSAGE') return 'working'
        return current

      case 'working':
        if (event === 'PROCESS_EXIT') return 'idle'
        if (event === 'PROCESS_ERROR') return 'error'
        return current

      case 'error':
        if (event === 'ACKNOWLEDGE_ERROR') return 'idle'
        if (event === 'SEND_MESSAGE') return 'working' // Implicit ack
        return current

      default:
        return current
    }
  }

  /**
   * Transfer state from one session ID to another.
   * Used when new sessions get their real ID from CC init event.
   */
  transferState(fromId: string, toId: string): void {
    const state = this.states.get(fromId)
    if (state) {
      this.states.delete(fromId)
      this.states.set(toId, state)
      // No event emission needed - the sessionId changed but state didn't
    }
  }

  /**
   * Remove session from state tracking.
   * Call when session is closed/deleted.
   */
  removeSession(sessionId: string): void {
    this.states.delete(sessionId)
  }

  /**
   * Get all sessions currently in a specific state.
   * Useful for debugging.
   */
  getSessionsInState(state: InstanceState): string[] {
    const result: string[] = []
    for (const [sessionId, sessionState] of this.states) {
      if (sessionState === state) {
        result.push(sessionId)
      }
    }
    return result
  }
}

/** Singleton instance */
export const instanceStateManager = new InstanceStateManager()
```

---

#### Task 3: Integrate State Manager with CC Spawner (AC: #2, #3, #4)

**File:** `src/main/sessions/cc-spawner.ts`

**Action:** Add state transitions at spawn, exit, and error points.

**Add import (after line 6):**

```typescript
import { instanceStateManager } from './instance-state-manager'
```

**Add transition at spawn start (after line 68, after registryId assignment):**

```typescript
  // Transition state to 'working' (Story 3b-3)
  instanceStateManager.transition(registryId, 'SEND_MESSAGE')
```

**Update session ID capture callback (inside onSessionIdCaptured, around line 119-127):**

Find the existing code block:
```typescript
onSessionIdCaptured: (newSessionId) => {
  // Update registry if session ID changed (new session)
  if (!sessionId && newSessionId) {
    processRegistry.delete(registryId)
    processRegistry.set(newSessionId, child)
    capturedSessionId = newSessionId
  } else if (sessionId) {
    capturedSessionId = sessionId
  }
}
```

Update to include state transfer:
```typescript
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
```

**Update process exit handler (around line 149-168):**

Find the exit handler and add state transition after processRegistry.delete but before emitToRenderer:

```typescript
// Handle process exit
child.on('exit', (code, signal) => {
  // Remove from registry - use captured session ID if available, otherwise temp key
  const cleanupKey = capturedSessionId || registryId
  processRegistry.delete(cleanupKey)

  // Transition state based on exit result (Story 3b-3)
  const success = code === 0
  if (success) {
    instanceStateManager.transition(cleanupKey, 'PROCESS_EXIT')
  } else {
    instanceStateManager.transition(cleanupKey, 'PROCESS_ERROR')
  }

  // Emit stream:end event (existing code continues...)
```

**Update spawn error handler (around line 172-189):**

Find the error handler and add state transition after processRegistry.delete:

```typescript
// Handle spawn errors (e.g., ENOENT if claude not installed)
child.on('error', (err: NodeJS.ErrnoException) => {
  // Remove from registry - use same logic as exit handler for consistency
  const cleanupKey = capturedSessionId || registryId
  processRegistry.delete(cleanupKey)

  // Transition to error state (Story 3b-3)
  instanceStateManager.transition(cleanupKey, 'PROCESS_ERROR')

  // Provide better error message for missing executable (existing code continues...)
```

---

#### Task 4: Add IPC Handlers for State Queries (AC: #4, #6)

**File:** `src/shared/types/ipc.ts`

**Action:** Add state-related schemas at the end of the file (after AbortResponseSchema, around line 312).

```typescript
// ============================================================
// Instance State Schemas (Story 3b-3)
// ============================================================

/**
 * Request schema for getting instance state.
 */
export const GetInstanceStateSchema = z.object({
  sessionId: z.string().min(1) // Can be pending-{timestamp} for new sessions
})

export type GetInstanceStateRequest = z.infer<typeof GetInstanceStateSchema>

/**
 * Response schema for instance state query.
 */
export const GetInstanceStateResponseSchema = z.object({
  state: z.enum(['idle', 'working', 'error'])
})

export type GetInstanceStateResponse = z.infer<typeof GetInstanceStateResponseSchema>

/**
 * Request schema for acknowledging an error.
 */
export const AcknowledgeErrorSchema = z.object({
  sessionId: z.string().min(1)
})

export type AcknowledgeErrorRequest = z.infer<typeof AcknowledgeErrorSchema>

/**
 * Response schema for error acknowledgement.
 */
export const AcknowledgeErrorResponseSchema = z.object({
  success: z.boolean(),
  newState: z.enum(['idle', 'working', 'error'])
})

export type AcknowledgeErrorResponse = z.infer<typeof AcknowledgeErrorResponseSchema>

/**
 * Instance state changed event schema.
 */
export const InstanceStateChangedEventSchema = z.object({
  sessionId: z.string().min(1),
  state: z.enum(['idle', 'working', 'error']),
  previousState: z.enum(['idle', 'working', 'error'])
})

export type InstanceStateChangedEvent = z.infer<typeof InstanceStateChangedEventSchema>
```

---

#### Task 5: Register IPC Handlers (AC: #4, #6)

**File:** `src/main/ipc/sessions.ts`

**Action:** Add state IPC handlers.

**Add imports (update the existing import from types):**

```typescript
import {
  // ... existing imports ...
  GetInstanceStateSchema,
  AcknowledgeErrorSchema
} from '../../shared/types/ipc'
```

**Add import for instanceStateManager (after other imports):**

```typescript
import { instanceStateManager } from '../sessions/instance-state-manager'
```

**Add handlers at end of registerSessionsIPC (before the closing brace, after sessions:abort handler):**

```typescript
  // Get instance state (Story 3b-3)
  ipcMain.handle('instance:getState', async (_, data: unknown) => {
    const { sessionId } = GetInstanceStateSchema.parse(data)
    const state = instanceStateManager.getState(sessionId)
    return { state }
  })

  // Acknowledge error (Story 3b-3)
  ipcMain.handle('instance:acknowledgeError', async (_, data: unknown) => {
    const { sessionId } = AcknowledgeErrorSchema.parse(data)
    const newState = instanceStateManager.transition(sessionId, 'ACKNOWLEDGE_ERROR')
    return { success: true, newState }
  })
```

---

#### Task 6: Update Preload API (AC: #6)

**File:** `src/preload/index.ts`

**Action:** Add instance state methods to sessions object.

**Add to sessions object (after onStreamInit, around line 144, before closing brace):**

```typescript
    // Instance state methods (Story 3b-3)
    getInstanceState: (sessionId: string): Promise<{ state: 'idle' | 'working' | 'error' }> =>
      ipcRenderer.invoke('instance:getState', { sessionId }),
    acknowledgeError: (
      sessionId: string
    ): Promise<{ success: boolean; newState: 'idle' | 'working' | 'error' }> =>
      ipcRenderer.invoke('instance:acknowledgeError', { sessionId }),
    onInstanceStateChanged: (
      callback: (event: {
        sessionId: string
        state: 'idle' | 'working' | 'error'
        previousState: 'idle' | 'working' | 'error'
      }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          sessionId: string
          state: 'idle' | 'working' | 'error'
          previousState: 'idle' | 'working' | 'error'
        }
      ): void => callback(data)
      ipcRenderer.on('instance:stateChanged', handler)
      return () => ipcRenderer.removeListener('instance:stateChanged', handler)
    }
```

---

#### Task 7: Update Preload Type Declarations (AC: #6)

**File:** `src/preload/index.d.ts`

**Action:** Add instance state method signatures.

**Add to sessions interface (after onStreamInit, around line 74, before closing brace):**

```typescript
    // Instance state methods (Story 3b-3)
    getInstanceState: (sessionId: string) => Promise<{ state: 'idle' | 'working' | 'error' }>
    acknowledgeError: (
      sessionId: string
    ) => Promise<{ success: boolean; newState: 'idle' | 'working' | 'error' }>
    onInstanceStateChanged: (
      callback: (event: {
        sessionId: string
        state: 'idle' | 'working' | 'error'
        previousState: 'idle' | 'working' | 'error'
      }) => void
    ) => () => void
```

---

#### Task 8: Create useInstanceState Hook (AC: #5)

**File:** `src/renderer/src/features/sessions/hooks/useInstanceState.ts` (NEW)

**Action:** Create hook that subscribes to state events.

```typescript
import { useEffect, useCallback } from 'react'
import { useUIStore, type SessionState } from '@renderer/shared/store/useUIStore'

interface UseInstanceStateOptions {
  /** Session ID to track (can be null for new sessions) */
  sessionId: string | null
  /** Tab ID for UI state updates */
  tabId: string
}

interface UseInstanceStateResult {
  /** Current session state */
  state: SessionState
  /** Acknowledge an error and return to idle */
  acknowledgeError: () => Promise<void>
}

/**
 * Hook for tracking instance state changes.
 * Subscribes to instance:stateChanged events and updates tab state.
 * Also fetches initial state on mount to sync with main process.
 *
 * @param options - Session and tab configuration
 * @returns Current state and error acknowledgement function
 */
export function useInstanceState({
  sessionId,
  tabId
}: UseInstanceStateOptions): UseInstanceStateResult {
  const { updateTabSessionState, tabs } = useUIStore()

  // Get current state from tab
  const currentTab = tabs.find((t) => t.id === tabId)
  const state: SessionState = currentTab?.sessionState ?? 'idle'

  // Fetch initial state on mount to sync with main process
  // This handles page refresh scenarios where CC might still be running
  useEffect(() => {
    if (!sessionId) return

    // Fetch current state from main process
    window.grimoireAPI.sessions
      .getInstanceState(sessionId)
      .then((result) => {
        if (result.state !== state) {
          updateTabSessionState(tabId, result.state)
        }
      })
      .catch((error) => {
        console.error('[useInstanceState] Failed to fetch initial state:', error)
      })
  }, [sessionId]) // Only run on mount/sessionId change, not on state change

  // Subscribe to state change events
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = window.grimoireAPI.sessions.onInstanceStateChanged((event) => {
      // Match by sessionId - could be the tab's sessionId or a pending-* temp ID
      if (event.sessionId === sessionId) {
        updateTabSessionState(tabId, event.state)
      }
    })

    return unsubscribe
  }, [sessionId, tabId, updateTabSessionState])

  // Acknowledge error handler
  const acknowledgeError = useCallback(async () => {
    if (!sessionId) return
    try {
      const result = await window.grimoireAPI.sessions.acknowledgeError(sessionId)
      if (result.success) {
        updateTabSessionState(tabId, result.newState)
      }
    } catch (error) {
      console.error('[useInstanceState] Failed to acknowledge error:', error)
    }
  }, [sessionId, tabId, updateTabSessionState])

  return { state, acknowledgeError }
}
```

---

#### Task 9: Update useSendMessage to Use Event-Driven State (AC: #2)

**File:** `src/renderer/src/features/sessions/hooks/useSendMessage.ts`

**Action:** Remove premature state updates, let InstanceStateManager drive state.

**Replace lines 88-109 (the try block with state updates):**

Find this code:
```typescript
      // 2. Update session state to 'working'
      updateTabSessionState(tabId, 'working')

      try {
        // 4. Call IPC to send message
        const result = await window.grimoireAPI.sessions.sendMessage({
          sessionId: actualSessionId,
          message,
          folderPath: resolvedFolderPath,
          isNewSession
        })

        if (result.success) {
          // 5. Confirm the optimistic message
          confirmMessage(actualSessionId, messageId)
          // 5b. For new sessions, update tab with persisted sessionId AFTER IPC success
          if (isNewSession) {
            updateTabSessionId(tabId, actualSessionId)
          }
          // Note: State will be updated to 'idle' when response completes (Story 3a-3)
          // For now, simulate completion
          updateTabSessionState(tabId, 'idle')
        } else {
```

Replace with:
```typescript
      // Note: State transition to 'working' is now handled by InstanceStateManager
      // in cc-spawner when the process spawns. We subscribe via useInstanceState.
      // DO NOT set state here - let the event-driven flow handle it.

      try {
        // 4. Call IPC to send message
        const result = await window.grimoireAPI.sessions.sendMessage({
          sessionId: actualSessionId,
          message,
          folderPath: resolvedFolderPath,
          isNewSession
        })

        if (result.success) {
          // 5. Confirm the optimistic message
          confirmMessage(actualSessionId, messageId)
          // 5b. For new sessions, update tab with persisted sessionId AFTER IPC success
          if (isNewSession) {
            updateTabSessionId(tabId, actualSessionId)
          }
          // Note: State transitions (working -> idle/error) are handled by
          // InstanceStateManager via instance:stateChanged events (Story 3b-3)
        } else {
```

**Remove the manual error state update (lines 117-118):**

Find:
```typescript
          updateTabSessionState(tabId, 'error')
          // Note: Story 3a-3 will handle transition back to 'idle' when user acknowledges error
```

Remove this line. The InstanceStateManager handles error state via PROCESS_ERROR.

**Remove the catch block error state update (around line 125):**

Find:
```typescript
        updateTabSessionState(tabId, 'error')
        // Note: Story 3a-3 will handle transition back to 'idle' when user acknowledges error
```

Remove this line. Let InstanceStateManager handle error transitions.

**Update the dependency array to remove updateTabSessionState:**

The hook no longer calls updateTabSessionState directly for working/idle/error, so remove it from dependencies if no other usage remains.

---

#### Task 10: Update SessionListItem for Error Indicator (AC: #5)

**File:** `src/renderer/src/features/sessions/components/SessionListItem.tsx`

**Action:** Add error state visual indicator.

**Update props interface (around line 16-23):**

Find:
```typescript
interface SessionListItemProps {
  session: SessionWithExists
  isActive: boolean
  isWorking: boolean
  onClick: () => void
  onArchive: () => void
  onUnarchive: () => void
}
```

Replace with:
```typescript
interface SessionListItemProps {
  session: SessionWithExists
  isActive: boolean
  isWorking: boolean
  isError?: boolean
  onClick: () => void
  onArchive: () => void
  onUnarchive: () => void
}
```

**Update component parameters (around line 25-32):**

Find:
```typescript
export function SessionListItem({
  session,
  isActive,
  isWorking,
  onClick,
  onArchive,
  onUnarchive
}: SessionListItemProps): ReactElement {
```

Replace with:
```typescript
export function SessionListItem({
  session,
  isActive,
  isWorking,
  isError = false,
  onClick,
  onArchive,
  onUnarchive
}: SessionListItemProps): ReactElement {
```

**Update className for error state (around line 53-61):**

Find:
```typescript
            isWorking && 'border-l-2 border-l-[var(--success)]',
```

Replace with:
```typescript
            isWorking && 'border-l-2 border-l-[var(--success)]',
            isError && 'border-l-2 border-l-[var(--error)]',
```

**Add error indicator in the icon area (after the isWorking block, around line 78):**

Find:
```typescript
            {isWorking && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <Zap
                  className="w-4 h-4 text-[var(--success)] animate-pulse"
                  aria-label="Session is working"
                />
                <span className="text-[var(--success)] text-xs animate-pulse">...</span>
              </span>
            )}
```

Add after this block:
```typescript
            {isError && (
              <AlertTriangle
                className="w-4 h-4 text-[var(--error)] flex-shrink-0"
                aria-label="Session has error"
              />
            )}
```

Note: AlertTriangle is already imported on line 3.

---

#### Task 11: Export New Hook (AC: #5)

**File:** `src/renderer/src/features/sessions/hooks/index.ts`

**Action:** Add export for useInstanceState hook.

```typescript
export { useInstanceState } from './useInstanceState'
```

---

#### Task 12: Create InstanceStateManager Tests (AC: #1)

**File:** `src/main/sessions/instance-state-manager.test.ts` (NEW)

**Action:** Create unit tests for the state manager.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks
const { mockEmitToRenderer, mockGetAllWindows } = vi.hoisted(() => ({
  mockEmitToRenderer: vi.fn(),
  mockGetAllWindows: vi.fn(() => [])
}))

// Mock dependencies
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: mockGetAllWindows
  }
}))

vi.mock('./stream-parser', () => ({
  emitToRenderer: mockEmitToRenderer
}))

// Import after mocks
import { instanceStateManager } from './instance-state-manager'

describe('InstanceStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear internal state by removing all tracked sessions
    // Note: In production, sessions are never removed unless explicitly done
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getState', () => {
    it('returns idle for unknown session', () => {
      const state = instanceStateManager.getState('unknown-session')
      expect(state).toBe('idle')
    })

    it('returns current state for tracked session', () => {
      instanceStateManager.setState('test-session', 'working')
      const state = instanceStateManager.getState('test-session')
      expect(state).toBe('working')
    })
  })

  describe('transition', () => {
    describe('idle state transitions', () => {
      it('transitions from idle to working on SEND_MESSAGE', () => {
        const sessionId = 'idle-to-working-' + Date.now()
        instanceStateManager.setState(sessionId, 'idle')

        const newState = instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

        expect(newState).toBe('working')
        expect(instanceStateManager.getState(sessionId)).toBe('working')
      })

      it('stays idle on PROCESS_EXIT', () => {
        const sessionId = 'idle-stay-' + Date.now()
        instanceStateManager.setState(sessionId, 'idle')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_EXIT')

        expect(newState).toBe('idle')
      })

      it('stays idle on ACKNOWLEDGE_ERROR', () => {
        const sessionId = 'idle-ack-' + Date.now()
        instanceStateManager.setState(sessionId, 'idle')

        const newState = instanceStateManager.transition(sessionId, 'ACKNOWLEDGE_ERROR')

        expect(newState).toBe('idle')
      })
    })

    describe('working state transitions', () => {
      it('transitions from working to idle on PROCESS_EXIT', () => {
        const sessionId = 'working-to-idle-' + Date.now()
        instanceStateManager.setState(sessionId, 'working')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_EXIT')

        expect(newState).toBe('idle')
      })

      it('transitions from working to error on PROCESS_ERROR', () => {
        const sessionId = 'working-to-error-' + Date.now()
        instanceStateManager.setState(sessionId, 'working')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_ERROR')

        expect(newState).toBe('error')
      })

      it('stays working on SEND_MESSAGE (edge case)', () => {
        const sessionId = 'working-stay-' + Date.now()
        instanceStateManager.setState(sessionId, 'working')

        const newState = instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

        expect(newState).toBe('working')
      })
    })

    describe('error state transitions', () => {
      it('transitions from error to idle on ACKNOWLEDGE_ERROR', () => {
        const sessionId = 'error-to-idle-' + Date.now()
        instanceStateManager.setState(sessionId, 'error')

        const newState = instanceStateManager.transition(sessionId, 'ACKNOWLEDGE_ERROR')

        expect(newState).toBe('idle')
      })

      it('transitions from error to working on SEND_MESSAGE (implicit ack)', () => {
        const sessionId = 'error-to-working-' + Date.now()
        instanceStateManager.setState(sessionId, 'error')

        const newState = instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

        expect(newState).toBe('working')
      })

      it('stays error on PROCESS_EXIT', () => {
        const sessionId = 'error-stay-' + Date.now()
        instanceStateManager.setState(sessionId, 'error')

        const newState = instanceStateManager.transition(sessionId, 'PROCESS_EXIT')

        expect(newState).toBe('error')
      })
    })
  })

  describe('event emission', () => {
    it('emits instance:stateChanged on valid transition', () => {
      const sessionId = 'emit-test-' + Date.now()
      instanceStateManager.setState(sessionId, 'idle')

      instanceStateManager.transition(sessionId, 'SEND_MESSAGE')

      expect(mockEmitToRenderer).toHaveBeenCalledWith('instance:stateChanged', {
        sessionId,
        state: 'working',
        previousState: 'idle'
      })
    })

    it('does not emit event when state does not change', () => {
      const sessionId = 'no-emit-test-' + Date.now()
      instanceStateManager.setState(sessionId, 'idle')

      instanceStateManager.transition(sessionId, 'PROCESS_EXIT') // Invalid transition

      expect(mockEmitToRenderer).not.toHaveBeenCalled()
    })
  })

  describe('transferState', () => {
    it('transfers state from temp ID to real ID', () => {
      const tempId = 'pending-123456'
      const realId = 'real-session-uuid'
      instanceStateManager.setState(tempId, 'working')

      instanceStateManager.transferState(tempId, realId)

      expect(instanceStateManager.getState(tempId)).toBe('idle') // Default for unknown
      expect(instanceStateManager.getState(realId)).toBe('working')
    })

    it('handles transfer when source has no state', () => {
      const tempId = 'nonexistent-temp'
      const realId = 'real-session-uuid'

      // Should not throw
      instanceStateManager.transferState(tempId, realId)

      expect(instanceStateManager.getState(realId)).toBe('idle')
    })
  })

  describe('removeSession', () => {
    it('removes session from tracking', () => {
      const sessionId = 'remove-test-' + Date.now()
      instanceStateManager.setState(sessionId, 'error')

      instanceStateManager.removeSession(sessionId)

      expect(instanceStateManager.getState(sessionId)).toBe('idle') // Default
    })
  })
})
```

---

#### Task 13: Create useInstanceState Hook Tests (AC: #5)

**File:** `src/renderer/src/features/sessions/hooks/useInstanceState.test.ts` (NEW)

**Action:** Create hook tests.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useInstanceState } from './useInstanceState'
import { useUIStore } from '@renderer/shared/store/useUIStore'

describe('useInstanceState', () => {
  const sessionId = 'test-session-123'
  const tabId = 'tab-1'
  let mockOnInstanceStateChanged: ReturnType<typeof vi.fn>
  let mockAcknowledgeError: ReturnType<typeof vi.fn>
  let mockGetInstanceState: ReturnType<typeof vi.fn>
  let stateChangeCallback: ((event: unknown) => void) | null = null

  beforeEach(() => {
    // Reset store
    useUIStore.setState({
      tabs: [
        {
          id: tabId,
          type: 'session',
          title: 'Test Session',
          sessionId,
          sessionState: 'idle'
        }
      ],
      activeTabId: tabId
    })

    // Setup mocks
    mockOnInstanceStateChanged = vi.fn((cb) => {
      stateChangeCallback = cb
      return vi.fn() // cleanup function
    })
    mockAcknowledgeError = vi.fn().mockResolvedValue({ success: true, newState: 'idle' })
    mockGetInstanceState = vi.fn().mockResolvedValue({ state: 'idle' })

    window.grimoireAPI = {
      sessions: {
        onInstanceStateChanged: mockOnInstanceStateChanged,
        acknowledgeError: mockAcknowledgeError,
        getInstanceState: mockGetInstanceState
      }
    } as unknown as typeof window.grimoireAPI
  })

  afterEach(() => {
    stateChangeCallback = null
  })

  it('returns current state from tab', () => {
    const { result } = renderHook(() => useInstanceState({ sessionId, tabId }))
    expect(result.current.state).toBe('idle')
  })

  it('fetches initial state on mount', async () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))

    await waitFor(() => {
      expect(mockGetInstanceState).toHaveBeenCalledWith(sessionId)
    })
  })

  it('syncs state from main process on mount when different', async () => {
    // Main process has 'working' state but tab has 'idle'
    mockGetInstanceState.mockResolvedValue({ state: 'working' })

    renderHook(() => useInstanceState({ sessionId, tabId }))

    await waitFor(() => {
      const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
      expect(tab?.sessionState).toBe('working')
    })
  })

  it('subscribes to state change events', () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))
    expect(mockOnInstanceStateChanged).toHaveBeenCalled()
  })

  it('updates tab state on state change event', () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))

    act(() => {
      stateChangeCallback?.({
        sessionId,
        state: 'working',
        previousState: 'idle'
      })
    })

    const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
    expect(tab?.sessionState).toBe('working')
  })

  it('ignores events for different session', () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))

    act(() => {
      stateChangeCallback?.({
        sessionId: 'other-session',
        state: 'error',
        previousState: 'idle'
      })
    })

    const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
    expect(tab?.sessionState).toBe('idle') // Unchanged
  })

  it('acknowledges error via IPC', async () => {
    const { result } = renderHook(() => useInstanceState({ sessionId, tabId }))

    await act(async () => {
      await result.current.acknowledgeError()
    })

    expect(mockAcknowledgeError).toHaveBeenCalledWith(sessionId)
  })

  it('updates state after error acknowledgement', async () => {
    // Set initial error state
    useUIStore.setState({
      tabs: [
        {
          id: tabId,
          type: 'session',
          title: 'Test Session',
          sessionId,
          sessionState: 'error'
        }
      ]
    })

    const { result } = renderHook(() => useInstanceState({ sessionId, tabId }))

    await act(async () => {
      await result.current.acknowledgeError()
    })

    const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
    expect(tab?.sessionState).toBe('idle')
  })

  it('cleans up subscription on unmount', () => {
    const cleanup = vi.fn()
    mockOnInstanceStateChanged.mockReturnValue(cleanup)

    const { unmount } = renderHook(() => useInstanceState({ sessionId, tabId }))
    unmount()

    expect(cleanup).toHaveBeenCalled()
  })

  it('does not subscribe when sessionId is null', () => {
    renderHook(() => useInstanceState({ sessionId: null, tabId }))
    expect(mockOnInstanceStateChanged).not.toHaveBeenCalled()
  })

  it('does not fetch initial state when sessionId is null', () => {
    renderHook(() => useInstanceState({ sessionId: null, tabId }))
    expect(mockGetInstanceState).not.toHaveBeenCalled()
  })
})
```

---

#### Task 14: Update cc-spawner Tests (AC: #2, #3, #4)

**File:** `src/main/sessions/cc-spawner.test.ts`

**Action:** Add tests for state manager integration.

**Add hoisted mock for instanceStateManager (after existing hoisted mocks, around line 7):**

```typescript
const { mockInstanceStateManager } = vi.hoisted(() => ({
  mockInstanceStateManager: {
    transition: vi.fn().mockReturnValue('working'),
    transferState: vi.fn()
  }
}))
```

**Add mock for instance-state-manager (after other vi.mock calls, around line 30):**

```typescript
vi.mock('./instance-state-manager', () => ({
  instanceStateManager: mockInstanceStateManager
}))
```

**Add new describe block for state manager integration (after existing describe blocks):**

```typescript
describe('instance state manager integration', () => {
  beforeEach(() => {
    mockInstanceStateManager.transition.mockClear()
    mockInstanceStateManager.transferState.mockClear()
  })

  it('transitions to working on spawn', () => {
    spawnCC({ folderPath: '/test/path', message: 'Hello' })

    expect(mockInstanceStateManager.transition).toHaveBeenCalledWith(
      expect.stringMatching(/^pending-\d+$/),
      'SEND_MESSAGE'
    )
  })

  it('transitions to working with sessionId for existing sessions', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

    expect(mockInstanceStateManager.transition).toHaveBeenCalledWith(sessionId, 'SEND_MESSAGE')
  })

  it('transitions to idle on successful exit', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

    mockChildProcess.emit('exit', 0, null)

    expect(mockInstanceStateManager.transition).toHaveBeenCalledWith(sessionId, 'PROCESS_EXIT')
  })

  it('transitions to error on non-zero exit', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    spawnCC({ sessionId, folderPath: '/test/path', message: 'Hello' })

    mockChildProcess.emit('exit', 1, null)

    expect(mockInstanceStateManager.transition).toHaveBeenCalledWith(sessionId, 'PROCESS_ERROR')
  })

  it('transitions to error on spawn error', () => {
    spawnCC({ folderPath: '/test/path', message: 'Hello' })

    mockChildProcess.emit('error', new Error('Spawn failed'))

    expect(mockInstanceStateManager.transition).toHaveBeenCalledWith(
      expect.stringMatching(/^pending-\d+$/),
      'PROCESS_ERROR'
    )
  })

  it('transfers state on new session ID capture', async () => {
    spawnCC({ folderPath: '/test/path', message: 'Hello' })

    // Get the pending key used
    const pendingKey = mockInstanceStateManager.transition.mock.calls[0][0]

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

    expect(mockInstanceStateManager.transferState).toHaveBeenCalledWith(
      pendingKey,
      'captured-session-id'
    )
  })
})
```

---

#### Task 15: Run Validation (AC: #1-6)

**Action:** Run `npm run validate` to ensure all tests pass and types check.

```bash
npm run validate
```

### Acceptance Criteria

**AC1: 3-State Machine Implementation (AR15)**
- **Given** the 3-state instance machine
- **When** a session instance changes state
- **Then** transitions follow: Idle -> Working -> Idle (normal flow)
- **And** Error state can be reached from Working: Idle -> Working -> Error -> Idle
- **Verified by:** InstanceStateManager.computeNextState logic and unit tests

**AC2: State transition on message send (FR55)**
- **Given** the user sends a message
- **When** the message is sent
- **Then** a new CC child process is spawned
- **And** the session transitions to Working state
- **And** the UI shows green indicator with animation
- **Verified by:** instanceStateManager.transition('SEND_MESSAGE') in cc-spawner, SessionListItem isWorking prop

**AC3: State transition on completion**
- **Given** CC completes processing
- **When** the response is fully received
- **Then** the child process exits naturally
- **And** the session transitions to Idle state
- **And** no idle process remains running
- **Verified by:** instanceStateManager.transition('PROCESS_EXIT') in cc-spawner exit handler

**AC4: Error state handling (FR67)**
- **Given** CC fails to spawn
- **When** an error occurs
- **Then** the session transitions to Error state
- **And** an actionable error message is displayed in the conversation (via stream:end error)
- **And** the error includes a retry option (SEND_MESSAGE implicitly acks error)
- **And** the session returns to Idle after error is acknowledged
- **Verified by:** instanceStateManager.transition('PROCESS_ERROR') and 'ACKNOWLEDGE_ERROR' handlers

**AC5: Visual indicator updates (UX10)**
- **Given** the session state changes
- **When** the state transitions
- **Then** the session list item shows the correct visual indicator:
  - Idle: No special indicator
  - Working: Green color bar + lightning icon + animated dots
  - Error: Red color bar + warning icon
- **Verified by:** SessionListItem isWorking and isError props

**AC6: Main process state tracking**
- **Given** the main process manages session state
- **When** a session's CC process status changes
- **Then** the state is tracked in-memory via an InstanceStateManager
- **And** state change events are emitted to all renderer windows
- **And** the processRegistry reflects current process state
- **Verified by:** InstanceStateManager singleton, emitToRenderer calls, cc-spawner integration

## Additional Context

### Dependencies

**Required Stories (Upstream):**
- Story 3b-1 (CC Child Process Spawning): Provides spawn infrastructure - COMPLETED
- Story 3b-2 (NDJSON Stream Parser): Provides stream:end events - COMPLETED

**This Story Provides:**
- Formalized state machine for process lifecycle
- Central state management for all sessions
- Visual indicator infrastructure
- IPC API for state queries and error acknowledgement

**Dependent Stories (Downstream):**
- Story 3b-4 (Request-Response Model): Uses state machine for lifecycle coordination

### Testing Strategy

1. **Unit Tests (instance-state-manager.test.ts):**
   - All state transitions
   - Invalid transition handling
   - Event emission
   - State transfer for new sessions

2. **Integration Tests (cc-spawner.test.ts):**
   - Mock instanceStateManager
   - Verify transitions called at correct points
   - Verify state transfer on session ID capture

3. **Hook Tests (useInstanceState.test.ts):**
   - Mock IPC listeners
   - Test state updates on events
   - Test cleanup on unmount

### Notes

**State Machine Diagram:**
```
     SEND_MESSAGE          PROCESS_EXIT
Idle ────────────> Working ────────────> Idle
                      │
                      │ PROCESS_ERROR
                      ▼
                    Error
                      │
                      │ ACKNOWLEDGE_ERROR or SEND_MESSAGE
                      ▼
                    Idle or Working
```

**Event Channel Name:**
- `instance:stateChanged` - Main process emits state change events

**Preload Thin Layer:**
The preload API only wraps IPC calls. All validation happens in main process IPC handlers.

### File Checklist

Files to CREATE:
- [ ] `src/main/sessions/instance-state-manager.ts`
- [ ] `src/main/sessions/instance-state-manager.test.ts`
- [ ] `src/renderer/src/features/sessions/hooks/useInstanceState.ts`
- [ ] `src/renderer/src/features/sessions/hooks/useInstanceState.test.ts`

Files to MODIFY:
- [ ] `src/main/sessions/types.ts` - Add state types
- [ ] `src/main/sessions/cc-spawner.ts` - Integrate state manager
- [ ] `src/main/sessions/cc-spawner.test.ts` - Add state manager tests
- [ ] `src/main/ipc/sessions.ts` - Add state IPC handlers
- [ ] `src/shared/types/ipc.ts` - Add state schemas
- [ ] `src/preload/index.ts` - Add state methods
- [ ] `src/preload/index.d.ts` - Add state types
- [ ] `src/renderer/src/features/sessions/components/SessionListItem.tsx` - Add error indicator
- [ ] `src/renderer/src/features/sessions/hooks/useSendMessage.ts` - Remove manual state updates
- [ ] `src/renderer/src/features/sessions/hooks/index.ts` - Export new hook

---

CHECKLIST COMPLETED: YES

## Checklist Verification

### READY FOR DEVELOPMENT STANDARD:
- [x] ACTIONABLE: Every task has clear file path AND specific action
- [x] LOGICAL: Tasks ordered by dependency (types first, then manager, then integration, then renderer)
- [x] TESTABLE: All ACs use Given/When/Then format
- [x] COMPLETE: No placeholders, no "TBD", no "TODO"
- [x] SELF-CONTAINED: A fresh agent can implement without reading conversation history

### SPECIFIC CHECKS:
- [x] Files to Reference table is populated with real paths
- [x] Codebase Patterns section matches actual project patterns
- [x] Implementation tasks are numbered and sequenced
- [x] Dependencies section lists any required prior work
- [x] Testing Strategy specifies test types and locations

### DISASTER PREVENTION:
- [x] No task requires "figure out" or "research" - all decided upfront
- [x] No ambiguous instructions that could be interpreted multiple ways
- [x] Scope boundaries are explicit (what NOT to do)
