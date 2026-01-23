---
title: 'Abort and Resume'
slug: '3a-4-abort-and-resume'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - React 19.x
  - TypeScript 5.9
  - Zustand 5.x
  - Zod 4.x
  - Electron IPC
  - lucide-react
files_to_modify:
  - src/shared/types/ipc.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/main/ipc/sessions.ts
  - src/renderer/src/features/sessions/components/ChatInput.tsx
  - src/renderer/src/features/sessions/store/useConversationStore.ts
  - src/renderer/src/features/sessions/components/ConversationView.tsx
  - src/renderer/src/core/shell/MiddlePanelContent.tsx
  - src/renderer/src/features/sessions/hooks/index.ts
files_to_create:
  - src/renderer/src/features/sessions/hooks/useAbortSession.ts
  - src/renderer/src/features/sessions/hooks/useAbortSession.test.ts
  - src/renderer/src/core/shell/MiddlePanelContent.test.tsx
code_patterns:
  - IPC handler with Zod validation
  - Zustand store actions
  - React hook with cleanup
  - Keyboard event handling
test_patterns:
  - Vitest with jsdom
  - @testing-library/react
  - Mock window.grimoireAPI
  - renderHook for hook testing
---

# Tech-Spec: Abort and Resume

**Created:** 2026-01-24
**Story Reference:** 3a-4-abort-and-resume.md

## Overview

### Problem Statement

Users cannot stop Claude Code when it's processing a request. If Claude is taking too long, executing undesired operations, or the user changes their mind, they must wait for the entire process to complete. This lack of control creates frustration and wastes time.

### Solution

Implement abort functionality that:
1. Allows users to stop a running CC process via button click or Escape key
2. Terminates the CC child process cleanly (SIGTERM)
3. Displays an "Aborted" message in the conversation
4. Transitions session state back to idle
5. Allows resuming the conversation with a new message

### Scope

**In Scope:**
- Abort button inlined in ChatInput (stop icon, red styling)
- useAbortSession hook for abort logic
- IPC handler for `sessions:abort`
- addAbortedMessage action in useConversationStore
- Escape key handler for abort
- ConversationView type update for DisplayMessage
- ChatInput integration with abort button props
- Unit tests for hook and ChatInput abort functionality

**Out of Scope:**
- Partial content preservation during abort (deferred to Epic 3b when streaming exists)
- Graceful process shutdown with content finalization (Epic 3b)
- Abort button animations or transitions

## Context for Development

### Codebase Patterns

**IPC Handler Pattern (from src/main/ipc/sessions.ts):**
```typescript
ipcMain.handle('sessions:terminate', async (_, data: unknown) => {
  const { sessionId } = TerminateRequestSchema.parse(data)
  const child = processRegistry.get(sessionId)
  if (!child) return { success: true }
  child.kill('SIGTERM')
  // ... graceful wait and cleanup
  return { success: true }
})
```

**Preload API Pattern (from src/preload/index.ts):**
```typescript
terminate: (sessionId: string): Promise<{ success: boolean }> =>
  ipcRenderer.invoke('sessions:terminate', { sessionId }),
```

**Store Action Pattern (from useConversationStore.ts lines 101-116):**
```typescript
addErrorMessage: (sessionId, errorContent) => {
  const errorMessage: SystemMessage = {
    type: 'system',
    uuid: `error-${crypto.randomUUID()}`,
    content: errorContent,
    timestamp: Date.now(),
    isError: true
  }
  set((state) => {
    const newMessages = new Map(state.messages)
    const sessionMessages = newMessages.get(sessionId) ?? []
    newMessages.set(sessionId, [...sessionMessages, errorMessage])
    return { messages: newMessages }
  })
}
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/main/ipc/sessions.ts` | Existing IPC handlers, terminate pattern (lines 24-45) |
| `src/preload/index.ts` | Preload API pattern (lines 27-28) |
| `src/preload/index.d.ts` | Type declarations for GrimoireAPI |
| `src/shared/types/ipc.ts` | Zod schemas (TerminateRequestSchema pattern) |
| `src/main/process-registry.ts` | Process registry Map |
| `src/renderer/src/features/sessions/components/ChatInput.tsx` | Current input component |
| `src/renderer/src/features/sessions/store/useConversationStore.ts` | SystemMessage pattern |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Message rendering |
| `src/renderer/src/core/shell/MiddlePanelContent.tsx` | ChatInput usage |
| `src/renderer/src/shared/store/useUIStore.ts` | updateTabSessionState |

### Technical Decisions

1. **Abort Schema Reuses Terminate Pattern:** AbortRequestSchema follows same pattern as TerminateRequestSchema (sessionId: z.string().uuid()).

2. **SystemMessage for Abort:** Use existing SystemMessage interface with `isError: false` to distinguish abort from error messages.

3. **DisplayMessage Type in ConversationView:** Change ConversationView messages prop from `ConversationMessage[]` to `DisplayMessage[]` to support system messages.

4. **Graceful Termination:** Send SIGTERM first, wait 500ms, then SIGKILL if still running.

5. **Escape Key at Window Level:** Use window.addEventListener for Escape to work regardless of focus.

## Implementation Plan

### Tasks

#### Task 1: Add Abort Schema to IPC Types (AC: #1)

**File:** `src/shared/types/ipc.ts`

**Action:** Add AbortRequestSchema after SendMessageResponseSchema (around line 202).

```typescript
// ============================================================
// Abort Schemas (Story 3a-4)
// ============================================================

/**
 * Request schema for aborting a running CC process.
 * Note: Can reuse TerminateRequestSchema semantics but keeping separate for clarity.
 */
export const AbortRequestSchema = z.object({
  sessionId: z.string().uuid()
})

export type AbortRequest = z.infer<typeof AbortRequestSchema>

/**
 * Response schema for abort operation
 */
export const AbortResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional()
})

export type AbortResponse = z.infer<typeof AbortResponseSchema>
```

---

#### Task 2: Add Abort IPC Handler in Main Process (AC: #1)

**File:** `src/main/ipc/sessions.ts`

**Action:** Add abort handler after sendMessage handler (around line 345). Import AbortRequestSchema at top.

**Add to imports (line 16):**

```typescript
import {
  TerminateRequestSchema,
  // ... existing imports ...
  SendMessageSchema,
  AbortRequestSchema  // Add this
} from '../../shared/types/ipc'
```

**Add handler after sendMessage handler:**

```typescript
// Abort running CC process (Story 3a-4)
ipcMain.handle('sessions:abort', async (_, data: unknown) => {
  try {
    const { sessionId } = AbortRequestSchema.parse(data)

    const child = processRegistry.get(sessionId)
    if (!child) {
      // No active process - treat as success (idempotent)
      return { success: true }
    }

    // Send SIGTERM for graceful shutdown
    child.kill('SIGTERM')

    // Wait up to 500ms for graceful exit
    const exitPromise = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, 500)
    })

    await Promise.race([exitPromise, timeoutPromise])

    // Force kill if still running
    if (!child.killed) {
      child.kill('SIGKILL')
    }

    // Remove from registry
    processRegistry.delete(sessionId)

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to abort process'
    console.error('[sessions:abort] Error:', errorMessage)
    return { success: false, error: errorMessage }
  }
})
```

---

#### Task 3: Add Abort Method to Preload API (AC: #1)

**File:** `src/preload/index.ts`

**Action:** Add abort method to sessions object (after sendMessage, around line 76).

```typescript
// Abort running process (Story 3a-4)
abort: (data: { sessionId: string }): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('sessions:abort', data),
```

---

#### Task 4: Add Abort Type Declaration (AC: #1)

**File:** `src/preload/index.d.ts`

**Action:** Add abort method type to GrimoireAPI.sessions interface (after sendMessage, around line 47).

```typescript
// Abort method (Story 3a-4)
abort: (data: { sessionId: string }) => Promise<{ success: boolean; error?: string }>
```

---

#### Task 5: Add addAbortedMessage to useConversationStore (AC: #2)

**File:** `src/renderer/src/features/sessions/store/useConversationStore.ts`

**Action:** Add addAbortedMessage action to the store.

**Add to interface (after addErrorMessage on line 38):**

```typescript
/** Add a system aborted message to the conversation */
addAbortedMessage: (sessionId: string) => void
```

**Add implementation after addErrorMessage (after line 116):**

```typescript
addAbortedMessage: (sessionId) => {
  const abortedMessage: SystemMessage = {
    type: 'system',
    uuid: `aborted-${crypto.randomUUID()}`,
    content: 'Response generation was aborted',
    timestamp: Date.now(),
    isError: false
  }

  set((state) => {
    const newMessages = new Map(state.messages)
    const sessionMessages = newMessages.get(sessionId) ?? []
    newMessages.set(sessionId, [...sessionMessages, abortedMessage])
    return { messages: newMessages }
  })
},
```

---

#### Task 6: REMOVED - Abort Button Inlined in ChatInput

**NOTE:** This task was removed because the abort button is inlined directly in ChatInput.tsx (see Task 8). Creating a separate AbortButton component is unnecessary for this story's scope.

---

#### Task 7: Create useAbortSession Hook (AC: #1, #2, #3)

**File:** `src/renderer/src/features/sessions/hooks/useAbortSession.ts`

**Action:** Create new file:

```typescript
import { useState, useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useConversationStore } from '../store/useConversationStore'

interface UseAbortSessionResult {
  /** Function to trigger abort */
  abort: () => Promise<void>
  /** Whether abort is currently in progress */
  isAborting: boolean
}

/**
 * Hook for aborting a running CC session.
 * Handles IPC call, state transitions, and aborted message.
 *
 * @param sessionId - Session ID to abort (null if no session)
 * @param tabId - Tab ID for state updates
 * @returns Abort function and loading state
 */
export function useAbortSession(
  sessionId: string | null,
  tabId: string
): UseAbortSessionResult {
  const [isAborting, setIsAborting] = useState(false)
  const { updateTabSessionState } = useUIStore()
  const { addAbortedMessage } = useConversationStore()

  const abort = useCallback(async () => {
    if (!sessionId || isAborting) return

    setIsAborting(true)

    try {
      const result = await window.grimoireAPI.sessions.abort({ sessionId })

      if (result.success) {
        // Add aborted message to conversation
        addAbortedMessage(sessionId)
        // Transition to idle state
        updateTabSessionState(tabId, 'idle')
      } else {
        // Abort failed - log error but still transition to idle
        console.error('[useAbortSession] Abort failed:', result.error)
        updateTabSessionState(tabId, 'idle')
      }
    } catch (error) {
      console.error('[useAbortSession] Abort error:', error)
      // Even on error, transition to idle (process may have already exited)
      updateTabSessionState(tabId, 'idle')
    } finally {
      setIsAborting(false)
    }
  }, [sessionId, tabId, isAborting, updateTabSessionState, addAbortedMessage])

  return { abort, isAborting }
}
```

---

#### Task 8: Update ChatInput with Abort Integration (AC: #4)

**File:** `src/renderer/src/features/sessions/components/ChatInput.tsx`

**Action:** Update props interface and component to support abort button.

**Update imports (line 10) - REPLACE existing Send import:**

From:
```typescript
import { Send } from 'lucide-react'
```

To:
```typescript
import { Send, Square, Loader2 } from 'lucide-react'
```

**Update interface (replace lines 13-24 - ChatInputProps):**

```typescript
export interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void
  /** Callback when abort button clicked */
  onAbort?: () => void
  /** Disable input during processing */
  disabled?: boolean
  /** Custom placeholder text (derived from hasMessages by default) */
  placeholder?: string
  /** Auto-focus on mount for new sessions */
  autoFocus?: boolean
  /** Whether session has existing messages (for placeholder logic) */
  hasMessages?: boolean
  /** Whether session is currently working (shows abort button) */
  isWorking?: boolean
  /** Whether abort is in progress */
  isAborting?: boolean
}
```

**Update function signature and destructuring (around line 36):**

```typescript
export function ChatInput({
  onSend,
  onAbort,
  disabled = false,
  placeholder,
  autoFocus = false,
  hasMessages = false,
  isWorking = false,
  isAborting = false
}: ChatInputProps): ReactElement {
```

**Replace button JSX (lines 129-142 - the existing send button) with conditional rendering:**

```typescript
{isWorking ? (
  <button
    type="button"
    onClick={onAbort}
    disabled={isAborting || !onAbort}
    title="Stop generation (Esc)"
    className={cn(
      'p-2 rounded-[var(--radius-sm)]',
      'bg-red-500/90 text-white',
      'hover:bg-red-600 transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    )}
    aria-label="Stop generation"
  >
    {isAborting ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <Square className="w-4 h-4 fill-current" />
    )}
  </button>
) : (
  <button
    type="button"
    onClick={handleSend}
    disabled={!canSend}
    className={cn(
      'p-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white',
      'hover:bg-[var(--accent)]/80 transition-colors',
      'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    )}
    aria-label="Send message"
  >
    <Send className="w-4 h-4" />
  </button>
)}
```

---

#### Task 9: Update MiddlePanelContent with Abort Integration (AC: #4, #5)

**File:** `src/renderer/src/core/shell/MiddlePanelContent.tsx`

**Action:** Integrate useAbortSession hook and pass props to ChatInput.

**Add import (after existing imports):**

```typescript
import { useAbortSession } from '@renderer/features/sessions/hooks/useAbortSession'
```

**Add hook call (after useSendMessage, around line 46):**

```typescript
// Setup abort session hook (Story 3a-4)
const { abort, isAborting } = useAbortSession(
  activeTab?.sessionId ?? null,
  activeTab?.id ?? ''
)
```

**Update ChatInput props (replace lines 76-81):**

```typescript
<ChatInput
  onSend={sendMessage}
  onAbort={abort}
  autoFocus={false}
  hasMessages={displayMessages.length > 0}
  disabled={activeTab.sessionState === 'working'}
  isWorking={activeTab.sessionState === 'working'}
  isAborting={isAborting}
/>
```

---

#### Task 10: Add Keyboard Shortcut Handler (AC: #5)

**File:** `src/renderer/src/core/shell/MiddlePanelContent.tsx`

**Action:** Add useEffect for Escape key handling (after the abort hook).

**Update import (line 1) - ADD useEffect to existing import:**

From:
```typescript
import { useMemo } from 'react'
```

To:
```typescript
import { useMemo, useEffect } from 'react'
```

**Add keyboard handler effect (after the abort hook call):**

```typescript
// Escape key handler for abort (Story 3a-4)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (
      e.key === 'Escape' &&
      activeTab?.sessionState === 'working' &&
      !isAborting &&
      activeTab?.sessionId
    ) {
      abort()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [activeTab?.sessionState, activeTab?.sessionId, isAborting, abort])
```

---

#### Task 11: Update ConversationView for DisplayMessage Type (AC: #2)

**File:** `src/renderer/src/features/sessions/components/ConversationView.tsx`

**Action:** Update type to accept DisplayMessage and render system messages.

**Step 11.1: Update imports (line 14) - ADD DisplayMessage and SystemMessage:**

From:
```typescript
import type { ConversationMessage, SubAgentBlock } from './types'
```

To:
```typescript
import type { ConversationMessage, SubAgentBlock } from './types'
import type { DisplayMessage, SystemMessage } from '../store/useConversationStore'
```

**Step 11.2: Update interface (line 18) - Change messages type:**

From:
```typescript
messages: ConversationMessage[]
```

To:
```typescript
messages: DisplayMessage[]
```

**Step 11.3: Add type guard helper (after imports, before component function, around line 28):**

```typescript
// Type guard for system messages (abort/error) - Story 3a-4
function isSystemMessage(msg: DisplayMessage): msg is SystemMessage {
  return msg.type === 'system'
}
```

**Step 11.4: Update message rendering (lines 274-367) - Add system message check at start of map:**

The messages.map block currently starts at line 274. Insert system message handling as the FIRST check inside the map callback:

Find this code (line 274-279):
```typescript
              {messages.map((msg, index) => {
                // Check if message has tool use blocks or sub-agent blocks (assistant messages only)
                const hasTools =
                  msg.role === 'assistant' && msg.toolUseBlocks && msg.toolUseBlocks.length > 0
                const hasSubAgents =
                  msg.role === 'assistant' && msg.subAgentBlocks && msg.subAgentBlocks.length > 0
```

Replace with:
```typescript
              {messages.map((msg, index) => {
                // Handle system messages first (abort/error) - Story 3a-4
                if (isSystemMessage(msg)) {
                  return (
                    <div
                      key={msg.uuid}
                      data-message-uuid={msg.uuid}
                      className={cn(
                        'flex justify-center py-2',
                        highlightedUuid === msg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
                      )}
                      ref={(el) => {
                        if (el) messageRefs.current.set(msg.uuid, el)
                      }}
                    >
                      <span
                        className={cn(
                          'text-sm italic px-3 py-1 rounded-full',
                          msg.isError
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-[var(--text-muted)] bg-[var(--bg-hover)]'
                        )}
                      >
                        {msg.content}
                      </span>
                    </div>
                  )
                }

                // Cast to ConversationMessage after type guard check
                const convMsg = msg as ConversationMessage

                // Check if message has tool use blocks or sub-agent blocks (assistant messages only)
                const hasTools =
                  convMsg.role === 'assistant' && convMsg.toolUseBlocks && convMsg.toolUseBlocks.length > 0
                const hasSubAgents =
                  convMsg.role === 'assistant' && convMsg.subAgentBlocks && convMsg.subAgentBlocks.length > 0
```

**Step 11.5: Update ALL remaining `msg` references to `convMsg` in the map callback:**

After the type guard, change all occurrences of `msg` to `convMsg` in the rendering logic:
- Line 286: `msg.toolUseBlocks` -> `convMsg.toolUseBlocks`
- Line 289: `msg.toolUseBlocks` -> `convMsg.toolUseBlocks`
- Line 293: `msg.uuid` -> `convMsg.uuid`
- Line 297: `msg.uuid` -> `convMsg.uuid`
- Line 300: `msg.uuid` -> `convMsg.uuid`
- Line 304: `msg.content` -> `convMsg.content`
- Line 308: `msg.timestamp` -> `convMsg.timestamp`
- Line 316: `msg.toolResults` -> `convMsg.toolResults`
- Line 322: `msg.subAgentBlocks` -> `convMsg.subAgentBlocks`
- Line 332: `msg.content` -> `convMsg.content`
- Line 334: `msg.timestamp` -> `convMsg.timestamp`
- Line 344: `msg.uuid` -> `convMsg.uuid`
- Line 348: `msg.uuid` -> `convMsg.uuid`
- Line 351: `msg.uuid` -> `convMsg.uuid`
- Line 355: `msg.role` -> `convMsg.role`
- Line 356: `msg.content` -> `convMsg.content`
- Line 357: `msg.timestamp` -> `convMsg.timestamp`
- Line 359: `msg.role` -> `convMsg.role`
- Line 361: `msg.uuid` -> `convMsg.uuid`

**NOTE:** This is a significant refactor. Consider using find-and-replace within the messages.map callback scope only.

---

#### Task 12: Update MiddlePanelContent Cast Removal (AC: #2)

**File:** `src/renderer/src/core/shell/MiddlePanelContent.tsx`

**Action:** Remove the type cast now that ConversationView accepts DisplayMessage[].

**Step 12.1: Remove unused import (line 17):**

Remove this line entirely (ConversationMessage is no longer needed after Task 11):
```typescript
import type { ConversationMessage } from '@renderer/features/sessions/components/types'
```

**Step 12.2: Update line 68 - Remove type cast:**

From:
```typescript
messages={displayMessages as ConversationMessage[]}
```
To:
```typescript
messages={displayMessages}
```

**NOTE:** This task MUST be done after Task 11 (ConversationView type change) or TypeScript will error.

---

#### Task 13: Update Hook Exports (AC: #1-6)

**File:** `src/renderer/src/features/sessions/hooks/index.ts`

**Action:** Add export for useAbortSession at the end of the file.

Current content:
```typescript
export { useSendMessage } from './useSendMessage'
export { useTimelineEvents } from './useTimelineEvents'
export { useActiveTimelineEvent } from './useActiveTimelineEvent'
```

Add this line:
```typescript
export { useAbortSession } from './useAbortSession'
```

**NOTE:** AbortButton component was removed (Task 6) - no component export needed.

---

#### Task 14: REMOVED - AbortButton Tests Not Needed

**NOTE:** This task was removed because Task 6 (AbortButton component) was removed. The abort button is inlined in ChatInput.tsx, and tests for abort button functionality are covered in Task 16 (ChatInput tests).

---

#### Task 15: Create useAbortSession Tests (AC: #1, #2, #3)

**File:** `src/renderer/src/features/sessions/hooks/useAbortSession.test.ts`

**Action:** Create new test file:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAbortSession } from './useAbortSession'

// Mock stores
const mockUpdateTabSessionState = vi.fn()
const mockAddAbortedMessage = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: () => ({
    updateTabSessionState: mockUpdateTabSessionState
  })
}))

vi.mock('../store/useConversationStore', () => ({
  useConversationStore: () => ({
    addAbortedMessage: mockAddAbortedMessage
  })
}))

describe('useAbortSession', () => {
  const mockSessionId = 'test-session-123'
  const mockTabId = 'test-tab-456'
  let mockAbort: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockAbort = vi.fn().mockResolvedValue({ success: true })
    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          abort: mockAbort
        }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes with isAborting false', () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))
    expect(result.current.isAborting).toBe(false)
  })

  it('calls IPC abort method with session ID', async () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockAbort).toHaveBeenCalledWith({ sessionId: mockSessionId })
  })

  it('does nothing when sessionId is null', async () => {
    const { result } = renderHook(() => useAbortSession(null, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockAbort).not.toHaveBeenCalled()
  })

  it('adds aborted message on success', async () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockAddAbortedMessage).toHaveBeenCalledWith(mockSessionId)
  })

  it('transitions session state to idle on success', async () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockUpdateTabSessionState).toHaveBeenCalledWith(mockTabId, 'idle')
  })

  it('transitions to idle even on abort failure', async () => {
    mockAbort.mockResolvedValue({ success: false, error: 'Process not found' })
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockUpdateTabSessionState).toHaveBeenCalledWith(mockTabId, 'idle')
  })

  it('handles IPC errors gracefully', async () => {
    mockAbort.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    // Should still transition to idle
    expect(mockUpdateTabSessionState).toHaveBeenCalledWith(mockTabId, 'idle')
  })

  it('sets isAborting during abort operation', async () => {
    let resolveAbort: (value: { success: boolean }) => void
    mockAbort.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAbort = resolve
        })
    )

    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    act(() => {
      result.current.abort()
    })

    expect(result.current.isAborting).toBe(true)

    await act(async () => {
      resolveAbort!({ success: true })
    })

    await waitFor(() => {
      expect(result.current.isAborting).toBe(false)
    })
  })

  it('prevents concurrent abort calls', async () => {
    let resolveAbort: (value: { success: boolean }) => void
    mockAbort.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAbort = resolve
        })
    )

    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    act(() => {
      result.current.abort()
      result.current.abort() // Second call should be ignored
    })

    expect(mockAbort).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAbort!({ success: true })
    })
  })
})
```

---

#### Task 16: Update ChatInput Tests (AC: #4)

**File:** `src/renderer/src/features/sessions/components/ChatInput.test.tsx`

**Action:** Add tests for abort button functionality.

```typescript
// Add to existing test file

describe('abort button', () => {
  it('shows abort button when isWorking is true', () => {
    render(
      <ChatInput onSend={vi.fn()} onAbort={vi.fn()} isWorking={true} />
    )
    expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument()
  })

  it('shows send button when isWorking is false', () => {
    render(
      <ChatInput onSend={vi.fn()} onAbort={vi.fn()} isWorking={false} />
    )
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('calls onAbort when abort button clicked', () => {
    const handleAbort = vi.fn()
    render(
      <ChatInput onSend={vi.fn()} onAbort={handleAbort} isWorking={true} />
    )

    fireEvent.click(screen.getByRole('button', { name: /stop generation/i }))

    expect(handleAbort).toHaveBeenCalledTimes(1)
  })

  it('shows spinner when isAborting is true', () => {
    const { container } = render(
      <ChatInput onSend={vi.fn()} onAbort={vi.fn()} isWorking={true} isAborting={true} />
    )
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('disables abort button when isAborting is true', () => {
    render(
      <ChatInput onSend={vi.fn()} onAbort={vi.fn()} isWorking={true} isAborting={true} />
    )
    expect(screen.getByRole('button', { name: /stop generation/i })).toBeDisabled()
  })
})
```

---

#### Task 17: Add Keyboard Shortcut Test (AC: #5)

**File:** `src/renderer/src/core/shell/MiddlePanelContent.test.tsx`

**Action:** Add test for Escape key handler. Create this file if it doesn't exist, or add to existing test file.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { MiddlePanelContent } from './MiddlePanelContent'

// Mock stores and hooks
const mockAbort = vi.fn()
const mockSendMessage = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

vi.mock('@renderer/features/sessions/store/useSessionStore', () => ({
  useSessionStore: vi.fn(() => ({ sessions: [] })),
  selectSessionById: vi.fn()
}))

vi.mock('@renderer/features/sessions/store/useConversationStore', () => ({
  useConversationStore: vi.fn(() => ({ getMessages: () => [] }))
}))

vi.mock('@renderer/features/sessions/hooks/useSendMessage', () => ({
  useSendMessage: () => ({ sendMessage: mockSendMessage })
}))

vi.mock('@renderer/features/sessions/hooks/useAbortSession', () => ({
  useAbortSession: () => ({ abort: mockAbort, isAborting: false })
}))

// Import after mocks
import { useUIStore } from '@renderer/shared/store/useUIStore'

describe('keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers abort on Escape when session is working', async () => {
    // Setup: activeTab in 'working' state
    vi.mocked(useUIStore).mockReturnValue({
      tabs: [{
        id: 'tab-1',
        sessionId: 'session-123',
        sessionState: 'working',
        type: 'session'
      }],
      activeTabId: 'tab-1'
    } as ReturnType<typeof useUIStore>)

    render(<MiddlePanelContent />)

    // Trigger Escape key
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(mockAbort).toHaveBeenCalledTimes(1)
  })

  it('does not trigger abort on Escape when session is idle', async () => {
    // Setup: activeTab in 'idle' state
    vi.mocked(useUIStore).mockReturnValue({
      tabs: [{
        id: 'tab-1',
        sessionId: 'session-123',
        sessionState: 'idle',
        type: 'session'
      }],
      activeTabId: 'tab-1'
    } as ReturnType<typeof useUIStore>)

    render(<MiddlePanelContent />)

    // Trigger Escape key
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(mockAbort).not.toHaveBeenCalled()
  })

  it('does not trigger abort when isAborting is true', async () => {
    // Setup: activeTab in 'working' state but already aborting
    vi.mocked(useUIStore).mockReturnValue({
      tabs: [{
        id: 'tab-1',
        sessionId: 'session-123',
        sessionState: 'working',
        type: 'session'
      }],
      activeTabId: 'tab-1'
    } as ReturnType<typeof useUIStore>)

    // Override abort hook to show isAborting=true
    vi.mock('@renderer/features/sessions/hooks/useAbortSession', () => ({
      useAbortSession: () => ({ abort: mockAbort, isAborting: true })
    }))

    render(<MiddlePanelContent />)

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(mockAbort).not.toHaveBeenCalled()
  })
})
```

**NOTE:** This test file may need adjustments based on the actual mock setup patterns used elsewhere in the codebase. Check existing test files for the preferred mocking approach.

---

#### Task 18: Run Validation (AC: #1-6)

**Action:** Run `npm run validate` to ensure all tests pass and types check.

```bash
npm run validate
```

### Acceptance Criteria

**AC1: Abort terminates CC process (FR57)**
- **Given** CC is processing a request (sessionState='working')
- **When** the user clicks the abort button
- **Then** `sessions:abort` IPC is called with sessionId
- **And** the running CC process is terminated (SIGTERM then SIGKILL)
- **And** process is removed from processRegistry
- **And** streaming stops immediately (process killed)

**AC2: Aborted message displayed (FR58)**
- **Given** a process is aborted
- **When** the abort completes successfully
- **Then** addAbortedMessage adds SystemMessage with content "Response generation was aborted"
- **And** the message has distinct styling (muted text, italic, rounded pill background)
- **And** the session state transitions to 'idle' via updateTabSessionState

**AC3: Resume aborted session (FR59)**
- **Given** a session was aborted (sessionState='idle', aborted message visible)
- **When** the user types a new message and sends
- **Then** useSendMessage handles the send normally
- **And** a new CC process spawns with the session ID
- **And** conversation continues from where it was aborted (CC handles context)

**AC4: Abort button visibility**
- **Given** the chat input component renders
- **When** sessionState is 'working' (isWorking=true)
- **Then** the abort button (red, stop icon) is shown
- **And** when sessionState is 'idle' (isWorking=false)
- **Then** the send button is shown instead
- **And** button sizes are consistent (no layout shift)

**AC5: Keyboard shortcut for abort**
- **Given** CC is processing (sessionState is 'working')
- **When** the user presses Escape key
- **Then** the abort action is triggered
- **And** behavior matches clicking the abort button
- **And** Escape does nothing when sessionState is 'idle'

**AC6: Partial content preserved on abort (DEFERRED)**
- **Given** response was streaming (requires Story 3a-3)
- **When** user aborts mid-stream
- **Then** any content received before abort is preserved
- **NOTE:** This AC is DEFERRED until Epic 3b provides streaming infrastructure
- **MVP:** Abort message appears even without partial content

## Additional Context

### Dependencies

**Required Stories (Upstream):**
- Story 3a-2 (Message Send Flow): Provides useSendMessage hook and session state management - COMPLETED

**Partial Dependency (Not Blocking):**
- Story 3a-3 (Response Streaming Display): Provides useStreamingMessage hook
- Impact: AC6 (partial content preservation) cannot be fully implemented until Story 3a-3 completes
- MVP: Abort works without partial content preservation

**This Story Provides:**
- Complete user control over CC processes
- Clean abort/resume workflow
- Foundation for process lifecycle management

### Testing Strategy

1. **Unit Tests (Components):**
   - AbortButton: visibility, click handling, loading state
   - ChatInput: abort/send button switching, callback handling

2. **Hook Tests:**
   - useAbortSession: IPC calls, state transitions, error handling
   - Mock window.grimoireAPI.sessions.abort

3. **Integration Tests (Manual):**
   - Full abort flow: click abort -> process killed -> message appears -> state idle
   - Keyboard shortcut: Escape key triggers abort
   - Resume: send new message after abort

### Notes

**Process Kill Strategy:**
1. Send SIGTERM first (graceful)
2. Wait 500ms for process to exit
3. Send SIGKILL if still running (force)
4. Always remove from processRegistry

**Idempotent Abort:**
If no process exists for sessionId, abort returns success=true (idempotent operation).

**Error Handling:**
Even if abort IPC fails, the session transitions to 'idle' state. This prevents the user from being stuck in 'working' state if the process crashed or already exited.

**Type System Change:**
Changing ConversationView from `ConversationMessage[]` to `DisplayMessage[]` is a breaking change. All callers must be updated. MiddlePanelContent is the only current caller and requires removing the type cast.

### File Checklist

Files to CREATE:
- [ ] `src/renderer/src/features/sessions/hooks/useAbortSession.ts`
- [ ] `src/renderer/src/features/sessions/hooks/useAbortSession.test.ts`
- [ ] `src/renderer/src/core/shell/MiddlePanelContent.test.tsx` - Keyboard shortcut tests

Files to MODIFY:
- [ ] `src/shared/types/ipc.ts` - Add AbortRequestSchema, AbortResponseSchema
- [ ] `src/preload/index.ts` - Add abort method to sessions
- [ ] `src/preload/index.d.ts` - Add abort type declaration
- [ ] `src/main/ipc/sessions.ts` - Add sessions:abort handler
- [ ] `src/renderer/src/features/sessions/components/ChatInput.tsx` - Add abort props and button swap
- [ ] `src/renderer/src/features/sessions/store/useConversationStore.ts` - Add addAbortedMessage
- [ ] `src/renderer/src/features/sessions/components/ConversationView.tsx` - Change to DisplayMessage[], render system messages
- [ ] `src/renderer/src/core/shell/MiddlePanelContent.tsx` - Add useAbortSession, Escape handler, update ChatInput props, remove type cast
- [ ] `src/renderer/src/features/sessions/hooks/index.ts` - Export useAbortSession
- [ ] `src/renderer/src/features/sessions/components/ChatInput.test.tsx` - Add abort button tests

Files REMOVED from spec (not needed):
- ~~`src/renderer/src/features/sessions/components/AbortButton.tsx`~~ - Inlined in ChatInput
- ~~`src/renderer/src/features/sessions/components/AbortButton.test.tsx`~~ - Tests in ChatInput.test.tsx
- ~~`src/renderer/src/features/sessions/components/index.ts`~~ - No AbortButton export needed

### Implementation Order

Execute tasks in this order to respect dependencies:

1. **IPC Layer (Backend First):**
   - Task 1: Add Abort Schema to ipc.ts
   - Task 2: Add IPC Handler to sessions.ts
   - Task 3: Add Preload API to index.ts
   - Task 4: Add Type Declaration to index.d.ts

2. **Store Layer:**
   - Task 5: Add addAbortedMessage to useConversationStore

3. **UI Components (Bottom Up):**
   - ~~Task 6: REMOVED~~ (AbortButton inlined in ChatInput)
   - Task 7: Create useAbortSession hook
   - Task 8: Update ChatInput with abort button inline
   - Task 11: Update ConversationView for DisplayMessage type

4. **Integration:**
   - Task 9: Update MiddlePanelContent with useAbortSession
   - Task 10: Add Keyboard Handler (Escape key)
   - Task 12: Remove type cast in MiddlePanelContent

5. **Exports:**
   - Task 13: Export useAbortSession from hooks/index.ts

6. **Tests:**
   - ~~Task 14: REMOVED~~ (AbortButton tests not needed)
   - Task 15: useAbortSession tests
   - Task 16: ChatInput abort button tests
   - Task 17: Keyboard shortcut tests

7. **Validation:**
   - Task 18: Run npm run validate
