---
title: 'Response Streaming Display'
slug: '3a-3-response-streaming-display'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - React 19.x
  - TypeScript 5.9
  - Zustand 5.x
  - Radix UI ScrollArea
  - CSS animations
files_to_modify:
  - src/shared/types/ipc.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/renderer/src/features/sessions/components/ConversationView.tsx
  - src/renderer/src/features/sessions/store/useConversationStore.ts
  - src/renderer/src/features/sessions/components/index.ts
  - src/renderer/src/features/sessions/hooks/index.ts
code_patterns:
  - IPC event listeners with cleanup functions
  - Zustand store with immutable updates
  - CSS keyframe animations
  - React useEffect cleanup
test_patterns:
  - Vitest with jsdom
  - @testing-library/react
  - Mock window.grimoireAPI
  - renderHook for hook testing
---

# Tech-Spec: Response Streaming Display

**Created:** 2026-01-24
**Story Reference:** 3a-3-response-streaming-display.md

## Overview

### Problem Statement

Users currently cannot see Claude's responses as they stream in - they must wait for the entire response before seeing any content. This creates a poor user experience where long responses feel unresponsive and users cannot follow Claude's thinking process in real-time.

### Solution

Implement real-time response streaming display with:
1. Character-by-character content rendering with cursor animation
2. Smart auto-scroll that follows new content but respects user scroll position
3. "Jump to latest" indicator when user scrolls away during streaming
4. Tool call cards displayed inline as they arrive
5. Clean state transitions when streaming completes

### Scope

**In Scope:**
- StreamingMessageBubble component with cursor animation
- useStreamingMessage hook for IPC event handling
- JumpToLatestButton component for scroll control
- Streaming event type definitions in shared/types/ipc.ts
- Preload API extensions for streaming events
- ConversationView integration with streaming components
- useConversationStore streaming state management
- Unit tests for all new components and hooks

**Out of Scope:**
- Main process event emission (Epic 3b responsibility)
- NDJSON stream parsing (Story 3b-2)
- Actual CC process spawning (Story 3b-1)
- Token cost calculation during streaming

## Context for Development

### Codebase Patterns

**IPC Event Listener Pattern (from src/preload/index.ts lines 78-84):**
```typescript
onMetadataUpdated: (callback: (data: SessionMetadataLike) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionMetadataLike): void =>
    callback(data)
  ipcRenderer.on('sessions:metadataUpdated', handler)
  return () => ipcRenderer.removeListener('sessions:metadataUpdated', handler)
}
```

**Zustand Store Pattern (from useConversationStore.ts):**
- Use `set((state) => ...)` for immutable updates
- Use `new Map(state.messages)` to create copies of Map objects
- Export selectors as separate functions

**CSS Variables (from project-context.md):**
- `var(--text-muted)` for muted text
- `var(--text-primary)` for primary text
- `var(--accent)` for accent color
- `var(--bg-hover)` for hover backgrounds
- `var(--radius-sm)` for border radius

**Component Return Type:**
- Components must return `ReactElement` type

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/preload/index.ts` | Pattern for IPC event listeners (lines 78-84) |
| `src/preload/index.d.ts` | Type declarations for GrimoireAPI |
| `src/shared/types/ipc.ts` | Zod schemas and TypeScript types |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Target for streaming integration |
| `src/renderer/src/features/sessions/components/MessageBubble.tsx` | Base styling reference |
| `src/renderer/src/features/sessions/components/ToolCallCard.tsx` | Tool display reference |
| `src/renderer/src/features/sessions/components/ThinkingIndicator.tsx` | Loading state reference |
| `src/renderer/src/features/sessions/store/useConversationStore.ts` | Message state management |
| `src/renderer/src/features/sessions/components/types.ts` | Message type definitions |
| `src/renderer/src/shared/store/useUIStore.ts` | SessionState type, updateTabSessionState |

### Technical Decisions

1. **Streaming State in useConversationStore:** Add streaming state as `Record<string, StreamingState | null>` (not Map) for Zustand reactivity.

2. **Event Cleanup Pattern:** All IPC listeners MUST return cleanup functions for React useEffect unmount.

3. **Auto-scroll Threshold:** Use 100px threshold for "near bottom" detection (existing pattern in ConversationView).

4. **CSS Animation for Cursor:** Use CSS `@keyframes` for blinking cursor - no JavaScript animation.

5. **Tool Cards During Streaming:** Render pending tools with `result={null}` - existing ToolCallCard handles this gracefully.

## Implementation Plan

### Tasks

#### Task 1: Define Streaming Event Types (AC: #1, #5)

**File:** `src/shared/types/ipc.ts`

**Action:** Add streaming event schemas and types after the existing SendMessageResponseSchema (around line 202).

```typescript
// ============================================================
// Streaming Event Schemas (Story 3a-3)
// ============================================================

/**
 * Stream chunk event - text content arriving during streaming
 */
export const StreamChunkEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.literal('text'),
  content: z.string(),
  uuid: z.string().uuid().optional()
})

export type StreamChunkEvent = z.infer<typeof StreamChunkEventSchema>

/**
 * Stream tool event - tool call or result during streaming
 */
export const StreamToolEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['tool_use', 'tool_result']),
  toolUse: z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.unknown())
  }).optional(),
  toolResult: z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.string(),
    is_error: z.boolean().optional()
  }).optional()
})

export type StreamToolEvent = z.infer<typeof StreamToolEventSchema>

/**
 * Stream end event - streaming completed or failed
 */
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

export type StreamEndEvent = z.infer<typeof StreamEndEventSchema>
```

---

#### Task 2: Update Preload API for Streaming Events (AC: #1)

**File:** `src/preload/index.ts`

**Action:** Add streaming event listeners to the `sessions` object (after line 84, before the closing brace).

```typescript
// Streaming event listeners (Story 3a-3)
onStreamChunk: (callback: (event: { sessionId: string; type: 'text'; content: string; uuid?: string }) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; type: 'text'; content: string; uuid?: string }): void =>
    callback(data)
  ipcRenderer.on('stream:chunk', handler)
  return () => ipcRenderer.removeListener('stream:chunk', handler)
},
onStreamTool: (callback: (event: { sessionId: string; type: 'tool_use' | 'tool_result'; toolUse?: unknown; toolResult?: unknown }) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; type: 'tool_use' | 'tool_result'; toolUse?: unknown; toolResult?: unknown }): void =>
    callback(data)
  ipcRenderer.on('stream:tool', handler)
  return () => ipcRenderer.removeListener('stream:tool', handler)
},
onStreamEnd: (callback: (event: { sessionId: string; success: boolean; error?: string; aborted?: boolean }) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; success: boolean; error?: string; aborted?: boolean }): void =>
    callback(data)
  ipcRenderer.on('stream:end', handler)
  return () => ipcRenderer.removeListener('stream:end', handler)
}
```

---

#### Task 3: Update Preload Type Declarations (AC: #1)

**File:** `src/preload/index.d.ts`

**Action:** Add streaming method types to GrimoireAPI.sessions interface (after line 48, before closing brace).

```typescript
// Streaming event listeners (Story 3a-3)
onStreamChunk: (callback: (event: { sessionId: string; type: 'text'; content: string; uuid?: string }) => void) => () => void
onStreamTool: (callback: (event: { sessionId: string; type: 'tool_use' | 'tool_result'; toolUse?: unknown; toolResult?: unknown }) => void) => () => void
onStreamEnd: (callback: (event: { sessionId: string; success: boolean; error?: string; aborted?: boolean }) => void) => () => void
```

---

#### Task 4: Create StreamingMessageBubble Component (AC: #1, #4)

**File:** `src/renderer/src/features/sessions/components/StreamingMessageBubble.tsx`

**Action:** Create new file with the following content:

```typescript
import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'

export interface StreamingMessageBubbleProps {
  /** Current streamed content */
  content: string
  /** Whether streaming is active */
  isStreaming: boolean
  /** Optional timestamp for display */
  timestamp?: number
}

/**
 * Message bubble for displaying streaming assistant responses.
 * Shows blinking cursor while streaming is active.
 */
export function StreamingMessageBubble({
  content,
  isStreaming
}: StreamingMessageBubbleProps): ReactElement {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[80%] rounded-[var(--radius-sm)] px-3 py-2',
          'bg-[var(--bg-hover)] text-[var(--text-primary)]',
          'text-sm whitespace-pre-wrap break-words',
          'min-h-[40px]'
        )}
      >
        <span>{content}</span>
        {isStreaming && (
          <span
            className="inline-block w-[2px] h-[1em] bg-[var(--text-primary)] ml-[1px] align-middle animate-cursor-blink"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
```

**CSS Addition:** Add to `src/renderer/src/assets/main.css` (after the existing animations section):

```css
/* ========================================
 * Story 3a-3: Streaming Cursor Animation
 * ======================================== */

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

.animate-cursor-blink {
  animation: cursor-blink 1s step-end infinite;
}
```

---

#### Task 5: Create useStreamingMessage Hook (AC: #1, #5)

**File:** `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts`

**Action:** Create new file:

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { ToolUseBlock, ToolResultBlock } from '../components/types'

interface StreamingState {
  content: string
  isStreaming: boolean
  pendingToolCalls: ToolUseBlock[]
  completedToolCalls: Array<{ call: ToolUseBlock; result: ToolResultBlock }>
  error: string | null
}

interface UseStreamingMessageResult extends StreamingState {
  /** Reset streaming state for new stream */
  reset: () => void
}

/**
 * Hook for managing streaming message state.
 * Subscribes to IPC streaming events and accumulates content.
 *
 * @param sessionId - Session ID to listen for streaming events
 * @returns Streaming state and control functions
 */
export function useStreamingMessage(sessionId: string | null): UseStreamingMessageResult {
  const [state, setState] = useState<StreamingState>({
    content: '',
    isStreaming: false,
    pendingToolCalls: [],
    completedToolCalls: [],
    error: null
  })

  const reset = useCallback(() => {
    setState({
      content: '',
      isStreaming: false,
      pendingToolCalls: [],
      completedToolCalls: [],
      error: null
    })
  }, [])

  useEffect(() => {
    if (!sessionId) return

    // Subscribe to chunk events
    const unsubChunk = window.grimoireAPI.sessions.onStreamChunk((event) => {
      if (event.sessionId !== sessionId) return
      setState((prev) => ({
        ...prev,
        content: prev.content + event.content,
        isStreaming: true
      }))
    })

    // Subscribe to tool events
    const unsubTool = window.grimoireAPI.sessions.onStreamTool((event) => {
      if (event.sessionId !== sessionId) return

      if (event.type === 'tool_use' && event.toolUse) {
        const toolUse = event.toolUse as ToolUseBlock
        setState((prev) => ({
          ...prev,
          pendingToolCalls: [...prev.pendingToolCalls, toolUse]
        }))
      } else if (event.type === 'tool_result' && event.toolResult) {
        const toolResult = event.toolResult as ToolResultBlock
        setState((prev) => {
          const matchingTool = prev.pendingToolCalls.find(
            (t) => t.id === toolResult.tool_use_id
          )
          if (!matchingTool) return prev

          return {
            ...prev,
            pendingToolCalls: prev.pendingToolCalls.filter(
              (t) => t.id !== toolResult.tool_use_id
            ),
            completedToolCalls: [
              ...prev.completedToolCalls,
              { call: matchingTool, result: toolResult }
            ]
          }
        })
      }
    })

    // Subscribe to end events
    const unsubEnd = window.grimoireAPI.sessions.onStreamEnd((event) => {
      if (event.sessionId !== sessionId) return
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: event.success ? null : (event.error ?? 'Stream ended with error')
      }))
    })

    // Cleanup all subscriptions on unmount
    return () => {
      unsubChunk()
      unsubTool()
      unsubEnd()
    }
  }, [sessionId])

  return { ...state, reset }
}
```

---

#### Task 6: Create JumpToLatestButton Component (AC: #3)

**File:** `src/renderer/src/features/sessions/components/JumpToLatestButton.tsx`

**Action:** Create new file:

```typescript
import { type ReactElement } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'

export interface JumpToLatestButtonProps {
  /** Whether the button should be visible */
  visible: boolean
  /** Callback when button is clicked */
  onClick: () => void
}

/**
 * Floating button to jump to latest content during streaming.
 * Shows when user scrolls away from bottom while streaming is active.
 */
export function JumpToLatestButton({
  visible,
  onClick
}: JumpToLatestButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
        'flex items-center gap-1.5 px-3 py-1.5',
        'bg-[var(--accent)] text-white rounded-full',
        'text-xs font-medium shadow-lg',
        'hover:bg-[var(--accent)]/90 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      )}
      aria-label="Jump to latest message"
    >
      <ChevronDown className="w-3.5 h-3.5" />
      <span>Jump to latest</span>
    </button>
  )
}
```

---

#### Task 7: Update useConversationStore for Streaming (AC: #4, #6)

**File:** `src/renderer/src/features/sessions/store/useConversationStore.ts`

**Action:** Add streaming state and actions. Update the interface (after line 47) and implementation.

**Add to interface (after line 47, before closing brace):**

```typescript
/** Streaming state per session */
streamingMessages: Record<string, StreamingState | null>

/** Start streaming for a session */
startStreaming: (sessionId: string) => void

/** Append content chunk to streaming message */
appendStreamChunk: (sessionId: string, chunk: string) => void

/** Complete streaming and convert to permanent message */
completeStreaming: (sessionId: string, success: boolean) => void

/** Clear streaming state for a session */
clearStreaming: (sessionId: string) => void
```

**Add StreamingState type before the interface:**

```typescript
/**
 * Streaming message state
 */
export interface StreamingState {
  content: string
  toolCalls: ToolUseBlock[]
  startedAt: number
}
```

**Add to imports at top:**

```typescript
import type { ToolUseBlock } from '../components/types'
```

**Add to initial state (after `pendingMessages: new Map()`):**

```typescript
streamingMessages: {},
```

**Add to implementation (after `setMessages` action):**

```typescript
startStreaming: (sessionId) => {
  set((state) => ({
    streamingMessages: {
      ...state.streamingMessages,
      [sessionId]: {
        content: '',
        toolCalls: [],
        startedAt: Date.now()
      }
    }
  }))
},

appendStreamChunk: (sessionId, chunk) => {
  set((state) => {
    const current = state.streamingMessages[sessionId]
    if (!current) return state
    return {
      streamingMessages: {
        ...state.streamingMessages,
        [sessionId]: {
          ...current,
          content: current.content + chunk
        }
      }
    }
  })
},

completeStreaming: (sessionId, success) => {
  const state = get()
  const streaming = state.streamingMessages[sessionId]
  if (!streaming) return

  if (success && streaming.content) {
    // Convert streaming content to permanent assistant message
    const assistantMessage: ConversationMessage = {
      uuid: `assistant-${crypto.randomUUID()}`,
      role: 'assistant',
      content: streaming.content,
      timestamp: Date.now(),
      toolUseBlocks: streaming.toolCalls.length > 0 ? streaming.toolCalls : undefined
    }

    set((state) => {
      const newMessages = new Map(state.messages)
      const sessionMessages = newMessages.get(sessionId) ?? []
      newMessages.set(sessionId, [...sessionMessages, assistantMessage])

      const newStreaming = { ...state.streamingMessages }
      delete newStreaming[sessionId]

      return {
        messages: newMessages,
        streamingMessages: newStreaming
      }
    })
  } else {
    // Clear streaming state without adding message
    set((state) => {
      const newStreaming = { ...state.streamingMessages }
      delete newStreaming[sessionId]
      return { streamingMessages: newStreaming }
    })
  }
},

clearStreaming: (sessionId) => {
  set((state) => {
    const newStreaming = { ...state.streamingMessages }
    delete newStreaming[sessionId]
    return { streamingMessages: newStreaming }
  })
}
```

---

#### Task 8: Update ConversationView for Streaming Integration (AC: #1, #2, #3, #4)

**File:** `src/renderer/src/features/sessions/components/ConversationView.tsx`

**Action:** Integrate streaming components. Make the following changes:

**Add imports (after existing imports):**

```typescript
import { StreamingMessageBubble } from './StreamingMessageBubble'
import { JumpToLatestButton } from './JumpToLatestButton'
import { useStreamingMessage } from '../hooks/useStreamingMessage'
import { useConversationStore } from '../store/useConversationStore'
```

**Add streaming hook call (after line 65, useActiveTimelineEvent call):**

```typescript
// Streaming state from hook (Story 3a-3)
const {
  content: streamingContent,
  isStreaming: isActivelyStreaming,
  pendingToolCalls,
  completedToolCalls
} = useStreamingMessage(sessionId)

// Track if user manually scrolled up during streaming
const [userScrolledUp, setUserScrolledUp] = useState(false)
```

**Replace simulated streaming state (search for "Track streaming state for Loading->Thinking transition"):**

Replace the simulated streaming useState:
```typescript
// Track streaming state for Loading->Thinking transition
// MVP NOTE: With request-response model, this will be refined in Epic 3b
const [isStreaming, setIsStreaming] = useState(false)
```

With derived state from hook:
```typescript
// Use actual streaming state (Story 3a-3)
const isStreaming = isActivelyStreaming
```

**Update auto-scroll effect (search for "Simulate streaming detection for Loading->Thinking transition"):**

Replace the entire simulated streaming detection useEffect block:
```typescript
// Simulate streaming detection for Loading->Thinking transition
// MVP NOTE: With request-response model, this simulates the transition
// Real streaming detection will be implemented in Epic 3b
useEffect(() => {
  if (sessionState === 'working' && messages.length > 0) {
    // Consider "streaming" once we have at least one message while working
    setIsStreaming(true)
  } else if (sessionState === 'idle') {
    setIsStreaming(false)
  }
}, [sessionState, messages.length])
```

With real streaming auto-scroll:
```typescript
// Handle streaming auto-scroll (Story 3a-3)
useEffect(() => {
  if (isStreaming && isNearBottom() && !userScrolledUp) {
    scrollToBottom()
  }
}, [streamingContent, isStreaming, isNearBottom, userScrolledUp, scrollToBottom])
```

**Add scroll tracking in handleScroll (inside the handleScroll callback, after the debounce logic):**

```typescript
// Track user scroll-away during streaming (Story 3a-3)
if (isStreaming && viewportRef.current) {
  const atBottom = isNearBottom()
  if (!atBottom && !userScrolledUp) {
    setUserScrolledUp(true)
  } else if (atBottom && userScrolledUp) {
    setUserScrolledUp(false)
  }
}
```

**Add JumpToLatest click handler (after scrollToBottom):**

```typescript
// Handle jump to latest click (Story 3a-3)
const handleJumpToLatest = useCallback(() => {
  scrollToBottom()
  setUserScrolledUp(false)
}, [scrollToBottom])
```

**Add StreamingMessageBubble and JumpToLatestButton in render (before LoadingIndicator, around line 372):**

```typescript
{/* Streaming message bubble (Story 3a-3) */}
{isStreaming && (
  <StreamingMessageBubble
    content={streamingContent}
    isStreaming={true}
  />
)}

{/* Pending tool calls during streaming (Story 3a-3) */}
{pendingToolCalls.map((tool) => (
  <ToolCallCard
    key={tool.id}
    toolCall={tool}
    result={null}
    isExpanded={expandedTools.has(tool.id)}
    onToggle={() => toggleTool(tool.id)}
  />
))}

{/* Completed tool calls during streaming (Story 3a-3) */}
{completedToolCalls.map(({ call, result }) => (
  <ToolCallCard
    key={call.id}
    toolCall={call}
    result={result}
    isExpanded={expandedTools.has(call.id)}
    onToggle={() => toggleTool(call.id)}
  />
))}
```

**Add JumpToLatestButton (inside ScrollArea.Root, after ScrollArea.Scrollbar):**

```typescript
{/* Jump to latest button (Story 3a-3) */}
<JumpToLatestButton
  visible={isStreaming && userScrolledUp}
  onClick={handleJumpToLatest}
/>
```

**Reset userScrolledUp on session change (add to line 206, inside the sessionId useEffect):**

```typescript
setUserScrolledUp(false)
```

---

#### Task 9: Update Component Exports (AC: #1-6)

**File:** `src/renderer/src/features/sessions/components/index.ts`

**Action:** Add exports for new components.

```typescript
export { StreamingMessageBubble } from './StreamingMessageBubble'
export type { StreamingMessageBubbleProps } from './StreamingMessageBubble'
export { JumpToLatestButton } from './JumpToLatestButton'
export type { JumpToLatestButtonProps } from './JumpToLatestButton'
```

**File:** `src/renderer/src/features/sessions/hooks/index.ts`

**Action:** Add export for new hook.

```typescript
export { useStreamingMessage } from './useStreamingMessage'
```

---

#### Task 10: Create StreamingMessageBubble Tests (AC: #1, #4)

**File:** `src/renderer/src/features/sessions/components/StreamingMessageBubble.test.tsx`

**Action:** Create new test file:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamingMessageBubble } from './StreamingMessageBubble'

describe('StreamingMessageBubble', () => {
  it('renders content when streaming', () => {
    render(<StreamingMessageBubble content="Hello world" isStreaming={true} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows cursor when streaming is active', () => {
    const { container } = render(
      <StreamingMessageBubble content="Test" isStreaming={true} />
    )
    const cursor = container.querySelector('.animate-cursor-blink')
    expect(cursor).toBeInTheDocument()
  })

  it('hides cursor when streaming is complete', () => {
    const { container } = render(
      <StreamingMessageBubble content="Test" isStreaming={false} />
    )
    const cursor = container.querySelector('.animate-cursor-blink')
    expect(cursor).not.toBeInTheDocument()
  })

  it('handles empty content gracefully', () => {
    render(<StreamingMessageBubble content="" isStreaming={true} />)
    // Should still render the bubble container
    const bubble = screen.getByRole('generic')
    expect(bubble).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(
      <StreamingMessageBubble content="Styled" isStreaming={true} />
    )
    const bubble = container.querySelector('.rounded-\\[var\\(--radius-sm\\)\\]')
    expect(bubble).toBeInTheDocument()
  })
})
```

---

#### Task 11: Create useStreamingMessage Tests (AC: #1, #5)

**File:** `src/renderer/src/features/sessions/hooks/useStreamingMessage.test.ts`

**Action:** Create new test file:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreamingMessage } from './useStreamingMessage'

describe('useStreamingMessage', () => {
  const mockSessionId = 'test-session-123'
  let mockOnStreamChunk: (callback: (event: unknown) => void) => () => void
  let mockOnStreamTool: (callback: (event: unknown) => void) => () => void
  let mockOnStreamEnd: (callback: (event: unknown) => void) => () => void
  let chunkCallback: ((event: unknown) => void) | null = null
  let toolCallback: ((event: unknown) => void) | null = null
  let endCallback: ((event: unknown) => void) | null = null

  beforeEach(() => {
    mockOnStreamChunk = vi.fn((cb) => {
      chunkCallback = cb
      return vi.fn()
    })
    mockOnStreamTool = vi.fn((cb) => {
      toolCallback = cb
      return vi.fn()
    })
    mockOnStreamEnd = vi.fn((cb) => {
      endCallback = cb
      return vi.fn()
    })

    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          onStreamChunk: mockOnStreamChunk,
          onStreamTool: mockOnStreamTool,
          onStreamEnd: mockOnStreamEnd
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    chunkCallback = null
    toolCallback = null
    endCallback = null
  })

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    expect(result.current.content).toBe('')
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.pendingToolCalls).toEqual([])
    expect(result.current.completedToolCalls).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('accumulates content from chunk events', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'Hello ' })
    })

    expect(result.current.content).toBe('Hello ')
    expect(result.current.isStreaming).toBe(true)

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'world!' })
    })

    expect(result.current.content).toBe('Hello world!')
  })

  it('ignores events for different session', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: 'other-session', type: 'text', content: 'Ignored' })
    })

    expect(result.current.content).toBe('')
  })

  it('tracks tool use events', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    const toolUse = {
      type: 'tool_use' as const,
      id: 'tool-1',
      name: 'Read',
      input: { file_path: '/test.ts' }
    }

    act(() => {
      toolCallback?.({ sessionId: mockSessionId, type: 'tool_use', toolUse })
    })

    expect(result.current.pendingToolCalls).toHaveLength(1)
    expect(result.current.pendingToolCalls[0].id).toBe('tool-1')
  })

  it('handles stream end event', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'Content' })
    })

    expect(result.current.isStreaming).toBe(true)

    act(() => {
      endCallback?.({ sessionId: mockSessionId, success: true })
    })

    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets error on failed stream end', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      endCallback?.({ sessionId: mockSessionId, success: false, error: 'Network error' })
    })

    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBe('Network error')
  })

  it('resets state with reset function', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'Content' })
    })

    expect(result.current.content).toBe('Content')

    act(() => {
      result.current.reset()
    })

    expect(result.current.content).toBe('')
    expect(result.current.isStreaming).toBe(false)
  })

  it('cleans up listeners on unmount', () => {
    const cleanupChunk = vi.fn()
    const cleanupTool = vi.fn()
    const cleanupEnd = vi.fn()

    mockOnStreamChunk = vi.fn(() => cleanupChunk)
    mockOnStreamTool = vi.fn(() => cleanupTool)
    mockOnStreamEnd = vi.fn(() => cleanupEnd)

    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          onStreamChunk: mockOnStreamChunk,
          onStreamTool: mockOnStreamTool,
          onStreamEnd: mockOnStreamEnd
        }
      }
    })

    const { unmount } = renderHook(() => useStreamingMessage(mockSessionId))

    unmount()

    expect(cleanupChunk).toHaveBeenCalled()
    expect(cleanupTool).toHaveBeenCalled()
    expect(cleanupEnd).toHaveBeenCalled()
  })
})
```

---

#### Task 12: Create JumpToLatestButton Tests (AC: #3)

**File:** `src/renderer/src/features/sessions/components/JumpToLatestButton.test.tsx`

**Action:** Create new test file:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JumpToLatestButton } from './JumpToLatestButton'

describe('JumpToLatestButton', () => {
  it('renders visible when visible prop is true', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: /jump to latest/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toHaveClass('opacity-0')
  })

  it('is hidden when visible prop is false', () => {
    render(<JumpToLatestButton visible={false} onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: /jump to latest/i })
    expect(button).toHaveClass('opacity-0')
    expect(button).toHaveClass('pointer-events-none')
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<JumpToLatestButton visible={true} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('displays correct text', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    expect(screen.getByText('Jump to latest')).toBeInTheDocument()
  })

  it('has correct accessibility label', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    expect(screen.getByLabelText('Jump to latest message')).toBeInTheDocument()
  })
})
```

---

#### Task 13: Update ConversationView Tests (AC: #1-4)

**File:** `src/renderer/src/features/sessions/components/ConversationView.test.tsx`

**Action:** Add tests for streaming functionality to existing test file.

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConversationView } from './ConversationView'

// Add to existing test file or create new describe block

describe('streaming functionality', () => {
  const mockSessionId = 'streaming-test-session'
  let mockChunkCallback: ((event: unknown) => void) | null = null
  let mockEndCallback: ((event: unknown) => void) | null = null

  beforeEach(() => {
    // Mock streaming API with callback capture
    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          onStreamChunk: vi.fn((cb) => {
            mockChunkCallback = cb
            return vi.fn()
          }),
          onStreamTool: vi.fn(() => vi.fn()),
          onStreamEnd: vi.fn((cb) => {
            mockEndCallback = cb
            return vi.fn()
          }),
          onMetadataUpdated: vi.fn(() => vi.fn())
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockChunkCallback = null
    mockEndCallback = null
  })

  it('shows StreamingMessageBubble when streaming content arrives', async () => {
    render(
      <ConversationView
        messages={[]}
        sessionId={mockSessionId}
        sessionState="working"
      />
    )

    // Simulate streaming chunk arriving
    if (mockChunkCallback) {
      mockChunkCallback({ sessionId: mockSessionId, type: 'text', content: 'Hello from stream' })
    }

    await waitFor(() => {
      expect(screen.getByText('Hello from stream')).toBeInTheDocument()
    })
  })

  it('shows cursor animation while actively streaming', async () => {
    const { container } = render(
      <ConversationView
        messages={[]}
        sessionId={mockSessionId}
        sessionState="working"
      />
    )

    // Simulate streaming chunk arriving
    if (mockChunkCallback) {
      mockChunkCallback({ sessionId: mockSessionId, type: 'text', content: 'Test' })
    }

    await waitFor(() => {
      const cursor = container.querySelector('.animate-cursor-blink')
      expect(cursor).toBeInTheDocument()
    })
  })

  it('shows JumpToLatestButton when user scrolls up during streaming', async () => {
    const { container } = render(
      <ConversationView
        messages={[]}
        sessionId={mockSessionId}
        sessionState="working"
      />
    )

    // Start streaming
    if (mockChunkCallback) {
      mockChunkCallback({ sessionId: mockSessionId, type: 'text', content: 'Content' })
    }

    // Simulate user scrolling up (mock scroll event)
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      // Mock scrollTop and scrollHeight to simulate scroll-away
      Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true })
      Object.defineProperty(viewport, 'scrollHeight', { value: 1000, writable: true })
      Object.defineProperty(viewport, 'clientHeight', { value: 300, writable: true })
      fireEvent.scroll(viewport)
    }

    await waitFor(() => {
      const jumpButton = screen.queryByLabelText('Jump to latest message')
      // Button should appear when scrolled away during streaming
      expect(jumpButton).toBeInTheDocument()
    })
  })

  it('hides cursor when streaming completes', async () => {
    const { container } = render(
      <ConversationView
        messages={[]}
        sessionId={mockSessionId}
        sessionState="working"
      />
    )

    // Start streaming
    if (mockChunkCallback) {
      mockChunkCallback({ sessionId: mockSessionId, type: 'text', content: 'Final content' })
    }

    // Complete streaming
    if (mockEndCallback) {
      mockEndCallback({ sessionId: mockSessionId, success: true })
    }

    await waitFor(() => {
      const cursor = container.querySelector('.animate-cursor-blink')
      expect(cursor).not.toBeInTheDocument()
    })
  })
})
```

---

#### Task 14: Run Validation (AC: #1-6)

**Action:** Run `npm run validate` to ensure all tests pass and types check.

```bash
npm run validate
```

### Acceptance Criteria

**AC1: Response appears character-by-character (FR50)**
- **Given** CC is generating a response
- **When** tokens stream in via `stream:chunk` IPC events
- **Then** the response appears character-by-character in StreamingMessageBubble
- **And** a cursor blink animation indicates active streaming (`.animate-cursor-blink` class)
- **And** the bubble grows as content is added (CSS handles overflow)

**AC2: Auto-scroll during streaming**
- **Given** response is streaming
- **When** content extends beyond the visible area
- **Then** the conversation auto-scrolls smoothly to show new content (scrollToBottom called)
- **And** scrolling is not jarring or jumpy (uses existing smooth scroll)

**AC3: Manual scroll pauses auto-scroll**
- **Given** the user manually scrolls up during streaming
- **When** they are reading earlier content
- **Then** auto-scroll pauses (userScrolledUp state set to true)
- **And** JumpToLatestButton appears at bottom-center
- **And** clicking JumpToLatestButton resumes auto-scroll (resets userScrolledUp, calls scrollToBottom)

**AC4: Streaming complete state**
- **Given** streaming completes
- **When** `stream:end` event arrives with success=true
- **Then** the cursor animation stops (isStreaming=false hides cursor)
- **And** the message is converted to permanent message via completeStreaming
- **And** the session state transitions to idle via updateTabSessionState

**AC5: Tool calls displayed during streaming**
- **Given** CC executes tool calls during response
- **When** `stream:tool` events arrive with tool_use type
- **Then** ToolCallCard appears inline with result={null} (shows "No result available")
- **And** when tool_result arrives, ToolCallCard updates with result

**AC6: Error state clears on new response**
- **Given** a previous error occurred (sessionState='error')
- **When** a new response stream starts (first chunk arrives)
- **Then** isStreaming becomes true
- **And** the UI shows streaming indicator (StreamingMessageBubble with cursor)

## Additional Context

### Dependencies

**Required Stories (Upstream):**
- Story 3a-2 (Message Send Flow): Provides useSendMessage hook and session state management - COMPLETED

**Dependent Stories (Downstream):**
- Story 3a-4 (Abort and Resume): Will use streaming state for abort
- Story 3b-2 (NDJSON Stream Parser): Will emit the streaming events this story consumes

**This Story Provides:**
- UI components ready to consume streaming events
- Event listener infrastructure in preload
- Store integration for streaming state

### Testing Strategy

1. **Unit Tests (Components):**
   - StreamingMessageBubble: cursor visibility, content display, empty state
   - JumpToLatestButton: visibility toggle, click handling

2. **Hook Tests:**
   - useStreamingMessage: chunk accumulation, tool tracking, cleanup on unmount
   - Mock window.grimoireAPI methods

3. **Integration Tests (Manual):**
   - Full ConversationView with streaming simulation
   - Scroll behavior during streaming (requires actual scroll events)

### Notes

**CSS Animation Location:**
The cursor blink animation should be added to `src/renderer/src/assets/main.css` (the project's main CSS file). Add it after the existing animation sections for consistency with existing patterns.

**Event Channel Names:**
- `stream:chunk` - Main process sends text content chunks
- `stream:tool` - Main process sends tool_use/tool_result events
- `stream:end` - Main process signals stream completion

**Store Reactivity:**
Using `Record<string, StreamingState | null>` instead of `Map` ensures Zustand can detect changes properly. Maps require special handling in Zustand that can lead to subtle bugs.

**Error Handling:**
If stream:end arrives with success=false, the error is captured in hook state but NOT automatically displayed. The calling component (ConversationView) should check for errors and display appropriately.

### File Checklist

Files to CREATE:
- [ ] `src/renderer/src/features/sessions/components/StreamingMessageBubble.tsx`
- [ ] `src/renderer/src/features/sessions/components/StreamingMessageBubble.test.tsx`
- [ ] `src/renderer/src/features/sessions/components/JumpToLatestButton.tsx`
- [ ] `src/renderer/src/features/sessions/components/JumpToLatestButton.test.tsx`
- [ ] `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts`
- [ ] `src/renderer/src/features/sessions/hooks/useStreamingMessage.test.ts`

Files to MODIFY:
- [ ] `src/shared/types/ipc.ts` - Add streaming event schemas
- [ ] `src/preload/index.ts` - Add streaming event listeners
- [ ] `src/preload/index.d.ts` - Add streaming type declarations
- [ ] `src/renderer/src/features/sessions/components/ConversationView.tsx` - Integrate streaming
- [ ] `src/renderer/src/features/sessions/store/useConversationStore.ts` - Add streaming state
- [ ] `src/renderer/src/features/sessions/components/index.ts` - Export new components
- [ ] `src/renderer/src/features/sessions/hooks/index.ts` - Export new hook
- [ ] `src/renderer/src/assets/main.css` - Add cursor animation
