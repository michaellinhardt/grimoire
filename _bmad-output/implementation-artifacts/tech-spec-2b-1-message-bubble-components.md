---
title: 'Message Bubble Components'
slug: '2b-1-message-bubble-components'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Tailwind CSS v4', 'Radix UI', 'Zustand', 'Vitest']
files_to_modify:
  - 'src/renderer/src/features/sessions/components/MessageBubble.tsx'
  - 'src/renderer/src/features/sessions/components/MessageBubble.test.tsx'
  - 'src/renderer/src/features/sessions/components/ConversationView.tsx'
  - 'src/renderer/src/features/sessions/components/ConversationView.test.tsx'
  - 'src/renderer/src/features/sessions/components/types.ts'
  - 'src/renderer/src/features/sessions/components/index.ts'
  - 'src/renderer/src/shared/utils/formatMessageTimestamp.ts'
  - 'src/renderer/src/shared/utils/formatMessageTimestamp.test.ts'
  - 'src/renderer/src/shared/utils/index.ts'
  - 'src/renderer/src/shared/store/useUIStore.ts'
  - 'src/renderer/src/core/shell/MiddlePanelContent.tsx'
code_patterns:
  - 'cn() for conditional Tailwind classes'
  - 'Colocated test files'
  - 'Single-function-per-file utilities'
  - 'Zustand immutable updates'
test_patterns:
  - '@testing-library/react for component tests'
  - 'vi.mock for module mocking'
  - 'act() for state updates'
---

# Tech-Spec: Message Bubble Components

**Created:** 2026-01-23
**Story:** 2b-1-message-bubble-components
**Epic:** 2b - Conversation Rendering

## Overview

### Problem Statement

When users open a session, they need to see the conversation history as clearly distinguished message bubbles. Currently, MiddlePanelContent shows a placeholder for session conversations. Users cannot visually distinguish between their messages and Claude's responses, nor can they navigate long conversations effectively.

### Solution

Create MessageBubble and ConversationView components that render conversation messages with:
- Visual distinction between user (right-aligned, accent-colored) and assistant (left-aligned, elevated background) messages
- Timestamp formatting (relative for recent, absolute for older messages)
- Smooth scrolling with Radix ScrollArea
- Auto-scroll to latest message on load
- Scroll position persistence per session tab

### Scope

**In Scope:**
- MessageBubble component with user and assistant variants
- ConversationView component with Radix ScrollArea
- formatMessageTimestamp utility function
- ConversationMessage type definition
- Mock conversation data for development
- Scroll position persistence in useUIStore
- Integration into MiddlePanelContent
- Comprehensive unit tests

**Out of Scope:**
- Tool call bubbles (Story 2b.2)
- Sub-agent bubbles (Story 2b.3)
- Real conversation data loading from JSONL (Epic 3b)
- Rewind UI on user messages (Story 2b.5)
- Chat input component (Epic 3a)
- Streaming/thinking indicators (Story 2b.4)
- Message virtualization (future optimization)

## Context for Development

### Codebase Patterns

**Component Organization (established in Epic 2a):**
- PascalCase files: `SessionList.tsx`, `SessionListItem.tsx`
- Colocated tests: `SessionList.test.tsx` beside `SessionList.tsx`
- Feature folders: `src/renderer/src/features/sessions/components/`
- Barrel exports: `index.ts` for clean imports

**Utility Pattern (established):**
- Single-function-per-file: `formatRelativeTime.ts`, `formatCost.ts`
- JSDoc comments with @param and @returns
- Export from `src/renderer/src/shared/utils/index.ts`

**Zustand Pattern (established in Epic 2a):**
- Naming: `use{Name}Store`
- Immutable updates: `set((state) => ({ ...state, newValue }))`
- Extend existing stores for related state (useUIStore for UI concerns)

**Existing Utilities to REUSE:**
- `cn()` from `src/renderer/src/shared/utils/cn.ts` - conditional class merging
- `formatRelativeTime()` from `src/renderer/src/shared/utils/formatRelativeTime.ts` - base for timestamp formatting

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/features/sessions/components/SessionListItem.tsx` | Example of cn() usage, color classes, component structure |
| `src/renderer/src/shared/utils/formatRelativeTime.ts` | Base for formatMessageTimestamp, single-function pattern |
| `src/renderer/src/shared/utils/cn.ts` | Utility for conditional Tailwind classes |
| `src/renderer/src/shared/store/useUIStore.ts` | Zustand store to extend with scroll positions |
| `src/renderer/src/core/shell/MiddlePanelContent.tsx` | Integration target for ConversationView |
| `src/renderer/src/features/sessions/components/index.ts` | Barrel file to update |

### Technical Decisions

**TD1: Single MessageBubble component with role prop**
- Use conditional styling based on `role: 'user' | 'assistant'` prop
- Cleaner than separate UserBubble/ClaudeBubble components
- Consistent with single-responsibility principle

**TD2: Timestamp as Unix milliseconds (number)**
- Matches existing `formatRelativeTime()` input type
- Consistent with database timestamp format (INTEGER)
- Enables simple arithmetic for time comparisons

**TD3: Scroll persistence in useUIStore (not new store)**
- Follow established pattern of extending existing domain stores
- UI scroll position is transient UI state
- Map<sessionId, number> for O(1) lookup

**TD4: Radix ScrollArea for scrolling**
- Already installed: `@radix-ui/react-scroll-area`
- Provides smooth, consistent scrolling behavior
- Better than native scrollbar for dark theme styling

**TD5: Smart auto-scroll behavior**
- Only auto-scroll on initial load OR when user is near bottom
- Prevents disrupting users reading conversation history
- "Near bottom" defined as within 100px of scroll end

## Implementation Plan

### Tasks

#### Task 1: Create ConversationMessage type and mock data

**File:** `src/renderer/src/features/sessions/components/types.ts`

```typescript
/**
 * A single message in a conversation
 */
export interface ConversationMessage {
  /** Unique identifier for the message */
  uuid: string
  /** Message author - 'user' for human, 'assistant' for Claude */
  role: 'user' | 'assistant'
  /** Message text content */
  content: string
  /** Unix timestamp in milliseconds (NOT ISO 8601 string) */
  timestamp: number
}

/**
 * Mock conversation data for development and testing.
 * Uses fixed timestamps relative to a base time for reproducible tests.
 * In production tests, use vi.useFakeTimers() with vi.setSystemTime().
 */
export const MOCK_MESSAGES: ConversationMessage[] = [
  {
    uuid: 'msg-1',
    role: 'user',
    content: 'Hello, can you help me with a React question?',
    timestamp: 1737630000000 // Fixed: 2026-01-23T10:00:00Z
  },
  {
    uuid: 'msg-2',
    role: 'assistant',
    content:
      "Of course! I'd be happy to help with React. What would you like to know?",
    timestamp: 1737630060000 // Fixed: 2026-01-23T10:01:00Z
  },
  {
    uuid: 'msg-3',
    role: 'user',
    content: 'How do I use useEffect correctly?',
    timestamp: 1737630180000 // Fixed: 2026-01-23T10:03:00Z
  },
  {
    uuid: 'msg-4',
    role: 'assistant',
    content:
      'useEffect is used for side effects in React components. The key rules are:\n\n1. Always include dependencies in the dependency array\n2. Return a cleanup function if needed\n3. Avoid infinite loops by careful dependency management',
    timestamp: 1737630240000 // Fixed: 2026-01-23T10:04:00Z
  }
]

/**
 * Helper to create mock messages with relative timestamps (for runtime dev use).
 * Use MOCK_MESSAGES directly for tests with vi.useFakeTimers().
 */
export function createMockMessages(): ConversationMessage[] {
  const now = Date.now()
  return [
    { uuid: 'msg-1', role: 'user', content: 'Hello, can you help me with a React question?', timestamp: now - 1000 * 60 * 5 },
    { uuid: 'msg-2', role: 'assistant', content: "Of course! I'd be happy to help with React. What would you like to know?", timestamp: now - 1000 * 60 * 4 },
    { uuid: 'msg-3', role: 'user', content: 'How do I use useEffect correctly?', timestamp: now - 1000 * 60 * 2 },
    { uuid: 'msg-4', role: 'assistant', content: 'useEffect is used for side effects in React components. The key rules are:\n\n1. Always include dependencies in the dependency array\n2. Return a cleanup function if needed\n3. Avoid infinite loops by careful dependency management', timestamp: now - 1000 * 60 * 1 }
  ]
}
```

**Acceptance Criteria:**
- [ ] ConversationMessage interface exported with uuid, role, content, timestamp
- [ ] MOCK_MESSAGES array exported with realistic test data
- [ ] Timestamps are Unix milliseconds (number type)

---

#### Task 2: Create formatMessageTimestamp utility

**File:** `src/renderer/src/shared/utils/formatMessageTimestamp.ts`

```typescript
import { formatRelativeTime } from './formatRelativeTime'

/**
 * Format message timestamp for display in conversation bubbles.
 * Uses relative time for recent messages (<24h) and absolute for older messages.
 *
 * @param timestamp - Unix timestamp in milliseconds, or null/undefined
 * @returns Formatted timestamp string (e.g., "2m ago", "Jan 15, 14:32")
 */
export function formatMessageTimestamp(
  timestamp: number | null | undefined
): string {
  if (timestamp == null) return ''

  const now = Date.now()
  const diff = now - timestamp
  const hours = diff / (1000 * 60 * 60)

  // Less than 24 hours: use relative time
  if (hours < 24) {
    return formatRelativeTime(timestamp)
  }

  // 24+ hours: show date and time
  const date = new Date(timestamp)
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Include year if different from current year
  const year = date.getFullYear()
  const currentYear = new Date().getFullYear()
  if (year !== currentYear) {
    return `${month} ${day}, ${year}, ${time}`
  }

  return `${month} ${day}, ${time}`
}
```

**Test File:** `src/renderer/src/shared/utils/formatMessageTimestamp.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatMessageTimestamp } from './formatMessageTimestamp'

describe('formatMessageTimestamp', () => {
  beforeEach(() => {
    // Mock Date.now to a fixed time: Jan 23, 2026 12:00:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for null', () => {
    expect(formatMessageTimestamp(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatMessageTimestamp(undefined)).toBe('')
  })

  it('uses relative time for timestamps less than 24 hours ago', () => {
    const twoHoursAgo = Date.now() - 1000 * 60 * 60 * 2
    expect(formatMessageTimestamp(twoHoursAgo)).toBe('2h ago')
  })

  it('uses relative time for timestamps less than 1 hour ago', () => {
    const thirtyMinutesAgo = Date.now() - 1000 * 60 * 30
    expect(formatMessageTimestamp(thirtyMinutesAgo)).toBe('30m ago')
  })

  it('shows absolute date for timestamps 24+ hours ago', () => {
    const twoDaysAgo = Date.now() - 1000 * 60 * 60 * 48
    const result = formatMessageTimestamp(twoDaysAgo)
    expect(result).toMatch(/Jan 21, \d{2}:\d{2}/)
  })

  it('includes year for timestamps from different year', () => {
    const lastYear = new Date('2025-12-15T10:30:00Z').getTime()
    const result = formatMessageTimestamp(lastYear)
    expect(result).toContain('2025')
    // Format: "Dec 15, 2025, HH:MM" - month and day may vary by locale
    expect(result).toMatch(/2025/)
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('handles edge case at exactly 24 hours', () => {
    const exactly24HoursAgo = Date.now() - 1000 * 60 * 60 * 24
    const result = formatMessageTimestamp(exactly24HoursAgo)
    // At exactly 24h, should show absolute date (not relative time)
    // Format includes month abbreviation, day, and time - NOT relative format
    expect(result).not.toMatch(/ago$/)
    expect(result).toMatch(/\d{2}:\d{2}/) // Should include time in HH:MM format
  })
})
```

**Update barrel file:** `src/renderer/src/shared/utils/index.ts`
```typescript
export { cn } from './cn'
export { formatRelativeTime } from './formatRelativeTime'
export { getSessionDisplayName } from './getSessionDisplayName'
export { formatTokenCount } from './formatTokenCount'
export { formatCost } from './formatCost'
export { formatMessageTimestamp } from './formatMessageTimestamp' // NEW
```

**Acceptance Criteria:**
- [ ] formatMessageTimestamp function created following single-function-per-file pattern
- [ ] Uses formatRelativeTime for <24h timestamps
- [ ] Shows absolute date format (Jan 15, 14:32) for >=24h timestamps
- [ ] Includes year for different year timestamps
- [ ] Handles null/undefined gracefully
- [ ] Tests cover all edge cases
- [ ] Exported from utils/index.ts

---

#### Task 3: Create MessageBubble component

**File:** `src/renderer/src/features/sessions/components/MessageBubble.tsx`

```typescript
import type { ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'
import { formatMessageTimestamp } from '@renderer/shared/utils/formatMessageTimestamp'

export interface MessageBubbleProps {
  /** Message author - 'user' for human, 'assistant' for Claude */
  role: 'user' | 'assistant'
  /** Message text content */
  content: string
  /** Unix timestamp in milliseconds */
  timestamp: number
}

/**
 * Renders a conversation message bubble with role-based styling.
 * User messages: right-aligned, accent-muted background, accent border
 * Assistant messages: left-aligned, elevated background, subtle border
 *
 * @param role - Message author ('user' or 'assistant')
 * @param content - Message text content
 * @param timestamp - Unix timestamp in milliseconds
 * @returns A styled message bubble element
 */
export function MessageBubble({
  role,
  content,
  timestamp
}: MessageBubbleProps): ReactElement {
  const isUser = role === 'user'

  return (
    <div
      role="article"
      aria-label={isUser ? 'User message' : 'Assistant message'}
      className={cn(
        'max-w-[80%] rounded-lg p-3',
        isUser
          ? 'ml-auto rounded-br-sm bg-[var(--accent-muted)] border border-[var(--accent)]'
          : 'mr-auto rounded-bl-sm bg-[var(--bg-elevated)] border border-[var(--border)]'
      )}
    >
      <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words">
        {content}
      </p>
      <span
        className={cn(
          'text-xs text-[var(--text-muted)] mt-1 block',
          isUser && 'text-right'
        )}
      >
        {formatMessageTimestamp(timestamp)}
      </span>
    </div>
  )
}
```

**Test File:** `src/renderer/src/features/sessions/components/MessageBubble.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders user message content', () => {
    render(
      <MessageBubble
        role="user"
        content="Hello, Claude!"
        timestamp={Date.now() - 1000 * 60 * 2}
      />
    )
    expect(screen.getByText('Hello, Claude!')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(
      <MessageBubble
        role="assistant"
        content="Hello! How can I help you?"
        timestamp={Date.now() - 1000 * 60}
      />
    )
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()
  })

  it('shows timestamp for user message', () => {
    render(
      <MessageBubble
        role="user"
        content="Test"
        timestamp={Date.now() - 1000 * 60 * 5}
      />
    )
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('applies right alignment for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('ml-auto')
    expect(bubble.className).toContain('rounded-br-sm')
  })

  it('applies left alignment for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('mr-auto')
    expect(bubble.className).toContain('rounded-bl-sm')
  })

  it('has accessible aria-label for user messages', () => {
    render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    expect(screen.getByLabelText('User message')).toBeInTheDocument()
  })

  it('has accessible aria-label for assistant messages', () => {
    render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    expect(screen.getByLabelText('Assistant message')).toBeInTheDocument()
  })

  it('applies accent styling for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('bg-[var(--accent-muted)]')
    expect(bubble.className).toContain('border-[var(--accent)]')
  })

  it('applies elevated styling for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('bg-[var(--bg-elevated)]')
    expect(bubble.className).toContain('border-[var(--border)]')
  })

  it('preserves whitespace in content', () => {
    const multilineContent = 'Line 1\nLine 2\nLine 3'
    render(
      <MessageBubble
        role="assistant"
        content={multilineContent}
        timestamp={Date.now()}
      />
    )
    const contentElement = screen.getByText(/Line 1/)
    expect(contentElement.className).toContain('whitespace-pre-wrap')
  })

  it('aligns timestamp right for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    const timestamp = container.querySelector('span')
    expect(timestamp?.className).toContain('text-right')
  })

  it('does not align timestamp right for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    const timestamp = container.querySelector('span')
    expect(timestamp?.className).not.toContain('text-right')
  })
})
```

**Acceptance Criteria:**
- [ ] MessageBubble component created with role, content, timestamp props
- [ ] User messages: right-aligned, accent-muted bg, accent border, rounded-br-sm
- [ ] Assistant messages: left-aligned, elevated bg, subtle border, rounded-bl-sm
- [ ] Timestamps displayed below content in muted text
- [ ] User timestamp right-aligned, assistant timestamp left-aligned
- [ ] Uses cn() for conditional class merging
- [ ] Uses CSS variables for colors (var(--accent), var(--bg-elevated), etc.)
- [ ] Preserves whitespace in message content (whitespace-pre-wrap)
- [ ] Accessibility: role="article" and aria-label="User message"/"Assistant message"
- [ ] JSDoc documentation included
- [ ] All tests pass (including accessibility tests)

---

#### Task 4: Add scroll position persistence to useUIStore

**File:** `src/renderer/src/shared/store/useUIStore.ts`

Add the following to the existing UIState interface and store:

```typescript
// Add to UIState interface:
// Scroll positions per session for tab switching persistence
scrollPositions: Map<string, number>
setScrollPosition: (sessionId: string, position: number) => void
getScrollPosition: (sessionId: string) => number
clearScrollPosition: (sessionId: string) => void

// Add to initial state:
scrollPositions: new Map(),

// Add to actions:
setScrollPosition: (sessionId, position) =>
  set((state) => ({
    scrollPositions: new Map(state.scrollPositions).set(sessionId, position)
  })),

getScrollPosition: (sessionId) => get().scrollPositions.get(sessionId) ?? 0,

clearScrollPosition: (sessionId) =>
  set((state) => {
    const newMap = new Map(state.scrollPositions)
    newMap.delete(sessionId)
    return { scrollPositions: newMap }
  }),
```

**Update closeTab to clear scroll position:**
```typescript
closeTab: (id) =>
  set((state) => {
    const closingTab = state.tabs.find((t) => t.id === id)
    const index = state.tabs.findIndex((t) => t.id === id)
    const newTabs = state.tabs.filter((t) => t.id !== id)

    // Select previous tab, or next if closing first, or null if empty
    let newActiveId: string | null = null
    if (newTabs.length > 0) {
      if (state.activeTabId === id) {
        newActiveId = index > 0 ? newTabs[index - 1].id : newTabs[0].id
      } else {
        newActiveId = state.activeTabId
      }
    }

    // Clear scroll position for closed session tab
    const newScrollPositions = new Map(state.scrollPositions)
    if (closingTab?.sessionId) {
      newScrollPositions.delete(closingTab.sessionId)
    }

    return { tabs: newTabs, activeTabId: newActiveId, scrollPositions: newScrollPositions }
  }),
```

**Add tests to existing useUIStore.test.ts:**

```typescript
// Add to existing useUIStore tests:
describe('scroll position persistence', () => {
  it('stores scroll position for session', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setScrollPosition('session-1', 500)
    })

    expect(result.current.getScrollPosition('session-1')).toBe(500)
  })

  it('returns 0 for unknown session', () => {
    const { result } = renderHook(() => useUIStore())
    expect(result.current.getScrollPosition('unknown')).toBe(0)
  })

  it('clears scroll position for session', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.setScrollPosition('session-1', 500)
      result.current.clearScrollPosition('session-1')
    })

    expect(result.current.getScrollPosition('session-1')).toBe(0)
  })

  it('clears scroll position when closing session tab', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.addTab({ id: 'tab-1', type: 'session', title: 'Test', sessionId: 'session-1' })
      result.current.setScrollPosition('session-1', 500)
    })

    expect(result.current.getScrollPosition('session-1')).toBe(500)

    act(() => {
      result.current.closeTab('tab-1')
    })

    expect(result.current.getScrollPosition('session-1')).toBe(0)
  })

  it('does not clear scroll position when closing non-session tab', () => {
    const { result } = renderHook(() => useUIStore())

    act(() => {
      result.current.addTab({ id: 'tab-1', type: 'session', title: 'Session', sessionId: 'session-1' })
      result.current.addTab({ id: 'tab-2', type: 'file', title: 'File', sessionId: null })
      result.current.setScrollPosition('session-1', 500)
    })

    act(() => {
      result.current.closeTab('tab-2') // Close file tab, not session
    })

    expect(result.current.getScrollPosition('session-1')).toBe(500) // Should still be 500
  })
})
```

**Acceptance Criteria:**
- [ ] scrollPositions Map<string, number> added to UIState
- [ ] setScrollPosition action creates new Map with updated position
- [ ] getScrollPosition returns position or 0 if not found
- [ ] clearScrollPosition removes entry from Map
- [ ] closeTab clears scroll position for closed session
- [ ] closeTab does NOT clear scroll position when closing non-session tabs
- [ ] All existing useUIStore tests still pass
- [ ] New scroll position tests pass

---

#### Task 5: Create ConversationView component

**File:** `src/renderer/src/features/sessions/components/ConversationView.tsx`

```typescript
import { useRef, useEffect, useCallback, type ReactElement } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MessageBubble } from './MessageBubble'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import type { ConversationMessage } from './types'

export interface ConversationViewProps {
  /** Array of conversation messages to display */
  messages: ConversationMessage[]
  /** Session ID for scroll position persistence */
  sessionId: string
}

/**
 * Scrollable conversation view with message bubbles.
 * Features smart auto-scroll and scroll position persistence per session.
 *
 * @param messages - Array of conversation messages to display
 * @param sessionId - Session ID for scroll position persistence
 * @returns A scrollable conversation view element
 */
export function ConversationView({
  messages,
  sessionId
}: ConversationViewProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement>(null)
  const isInitialMount = useRef(true)
  const lastMessageCountRef = useRef(messages.length)

  const { getScrollPosition, setScrollPosition } = useUIStore()

  // Check if user is near bottom (within 100px)
  const isNearBottom = useCallback((): boolean => {
    if (!viewportRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = viewportRef.current
    return scrollHeight - scrollTop - clientHeight < 100
  }, [])

  // Scroll to bottom helper
  const scrollToBottom = useCallback((): void => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [])

  // Handle initial mount and scroll restoration
  useEffect(() => {
    if (!viewportRef.current) return

    if (isInitialMount.current) {
      isInitialMount.current = false
      const savedPosition = getScrollPosition(sessionId)

      if (savedPosition > 0) {
        // Restore saved position
        viewportRef.current.scrollTop = savedPosition
      } else {
        // Initial load with no saved position - scroll to bottom
        scrollToBottom()
      }
      lastMessageCountRef.current = messages.length
      return
    }

    // Check if new messages were added
    if (messages.length > lastMessageCountRef.current) {
      // Only auto-scroll if user is near bottom
      if (isNearBottom()) {
        scrollToBottom()
      }
      lastMessageCountRef.current = messages.length
    }
  }, [messages, sessionId, getScrollPosition, isNearBottom, scrollToBottom])

  // Reset initial mount flag when sessionId changes
  useEffect(() => {
    isInitialMount.current = true
    lastMessageCountRef.current = messages.length
  }, [sessionId, messages.length])

  // Save scroll position on scroll
  // NOTE: For MVP, this is not debounced. If performance becomes an issue with
  // rapid state updates, consider adding a debounce (e.g., 100ms) using
  // a simple setTimeout/clearTimeout pattern or a debounce utility.
  // The Zustand Map approach already minimizes re-renders since only the
  // scrollPositions Map changes, not the entire store.
  const handleScroll = useCallback((): void => {
    if (viewportRef.current) {
      setScrollPosition(sessionId, viewportRef.current.scrollTop)
    }
  }, [sessionId, setScrollPosition])

  return (
    <ScrollArea.Root className="h-full w-full">
      <ScrollArea.Viewport
        ref={viewportRef}
        className="h-full w-full"
        onScroll={handleScroll}
      >
        <div className="flex flex-col space-y-4 p-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.uuid}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none p-0.5 transition-colors bg-transparent hover:bg-[var(--bg-hover)]"
      >
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--text-muted)] opacity-50 hover:opacity-75" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
```

**Test File:** `src/renderer/src/features/sessions/components/ConversationView.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ConversationView } from './ConversationView'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import type { ConversationMessage } from './types'

// Mock useUIStore - return only the properties we need, properly typed
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

// Use fixed timestamps for reproducible tests
const mockMessages: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Hello', timestamp: 1737630000000 },
  { uuid: '2', role: 'assistant', content: 'Hi there!', timestamp: 1737630030000 }
]

describe('ConversationView', () => {
  const mockSetScrollPosition = vi.fn()
  const mockGetScrollPosition = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))

    mockSetScrollPosition.mockClear()
    mockGetScrollPosition.mockReturnValue(0)

    // Mock only the functions actually used by ConversationView
    vi.mocked(useUIStore).mockImplementation(() => ({
      setScrollPosition: mockSetScrollPosition,
      getScrollPosition: mockGetScrollPosition,
      // Provide stubs for other required properties to satisfy TypeScript
      // These are not used by ConversationView but needed for type safety
      scrollPositions: new Map(),
      clearScrollPosition: vi.fn(),
      // Include required UIState properties (minimal stubs)
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      tabs: [],
      activeTabId: null,
      activeSection: 'sessions' as const,
      showArchived: false,
      setLeftPanelCollapsed: vi.fn(),
      setRightPanelCollapsed: vi.fn(),
      setActiveSection: vi.fn(),
      setShowArchived: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      setActiveTabId: vi.fn(),
      findTabBySessionId: vi.fn(),
      focusOrOpenSession: vi.fn(),
      updateTabSessionState: vi.fn(),
      updateTabTitle: vi.fn()
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders all messages', () => {
    render(<ConversationView messages={mockMessages} sessionId="test-session" />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('renders messages with correct roles', () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const bubbles = container.querySelectorAll('.max-w-\\[80\\%\\]')
    expect(bubbles).toHaveLength(2)

    // First bubble (user) should have ml-auto
    expect(bubbles[0].className).toContain('ml-auto')
    // Second bubble (assistant) should have mr-auto
    expect(bubbles[1].className).toContain('mr-auto')
  })

  it('renders empty state when no messages', () => {
    const { container } = render(
      <ConversationView messages={[]} sessionId="test-session" />
    )

    const messageContainer = container.querySelector('.flex.flex-col.space-y-4')
    expect(messageContainer?.children).toHaveLength(0)
  })

  it('calls getScrollPosition on mount', () => {
    render(<ConversationView messages={mockMessages} sessionId="test-session" />)

    expect(mockGetScrollPosition).toHaveBeenCalledWith('test-session')
  })

  it('saves scroll position on scroll', async () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      await act(async () => {
        fireEvent.scroll(viewport, { target: { scrollTop: 100 } })
      })
    }

    expect(mockSetScrollPosition).toHaveBeenCalledWith('test-session', expect.any(Number))
  })

  it('renders messages with space-y-4 gap', () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const messageContainer = container.querySelector('.space-y-4')
    expect(messageContainer).toBeInTheDocument()
  })

  it('has proper padding around messages', () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const messageContainer = container.querySelector('.p-4')
    expect(messageContainer).toBeInTheDocument()
  })
})
```

**Acceptance Criteria:**
- [ ] ConversationView component created with messages and sessionId props
- [ ] Uses Radix ScrollArea for smooth scrolling
- [ ] Renders MessageBubble for each message
- [ ] Messages have space-y-4 gap between them
- [ ] Auto-scrolls to bottom on initial load (no saved position)
- [ ] Restores scroll position if previously saved
- [ ] Only auto-scrolls on new messages if user is near bottom
- [ ] Saves scroll position on scroll events
- [ ] Styled scrollbar for dark theme
- [ ] JSDoc documentation included
- [ ] All tests pass

---

#### Task 6: Update barrel file exports

**File:** `src/renderer/src/features/sessions/components/index.ts`

```typescript
export { ChatInputPlaceholder } from './ChatInputPlaceholder'
export { EmptyStateView } from './EmptyStateView'
export { NewSessionView } from './NewSessionView'
export { SessionList } from './SessionList'
export { SessionListItem } from './SessionListItem'
export { SessionContextMenu } from './SessionContextMenu'
// NEW in Story 2b.1:
export { MessageBubble } from './MessageBubble'
export type { MessageBubbleProps } from './MessageBubble'
export { ConversationView } from './ConversationView'
export type { ConversationViewProps } from './ConversationView'
export type { ConversationMessage } from './types'
export { MOCK_MESSAGES, createMockMessages } from './types'
```

**Acceptance Criteria:**
- [ ] MessageBubble and MessageBubbleProps exported
- [ ] ConversationView and ConversationViewProps exported
- [ ] ConversationMessage type exported
- [ ] MOCK_MESSAGES exported

---

#### Task 7: Integrate ConversationView into MiddlePanelContent

**File:** `src/renderer/src/core/shell/MiddlePanelContent.tsx`

```typescript
import { useMemo } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import {
  ChatInputPlaceholder,
  EmptyStateView,
  NewSessionView,
  ConversationView,
  createMockMessages
} from '@renderer/features/sessions/components'
import type { ReactElement } from 'react'

export function MiddlePanelContent(): ReactElement {
  const { tabs, activeTabId } = useUIStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Create mock messages once per render cycle (will be replaced by real data in Epic 3b)
  const mockMessages = useMemo(() => createMockMessages(), [])

  // No tabs open - show empty state with New Session button
  if (!activeTab) {
    return <EmptyStateView />
  }

  // Tab with no sessionId (new unsaved session) - show empty conversation with placeholder
  if (!activeTab.sessionId) {
    return <NewSessionView />
  }

  // Tab with sessionId - show session conversation
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* ConversationView fills remaining space - min-h-0 critical for flex overflow */}
      <div className="flex-1 min-h-0">
        <ConversationView
          messages={mockMessages}
          sessionId={activeTab.sessionId}
        />
      </div>
      {/* Chat input placeholder - will be implemented in Epic 3a */}
      {/* NOTE: Existing sessions do NOT auto-focus per UX spec (only new sessions auto-focus) */}
      <ChatInputPlaceholder placeholder="Type your message..." />
    </div>
  )
}
```

**Update test file:** `src/renderer/src/core/shell/MiddlePanelContent.test.tsx`

Add test cases for the conversation view integration:

```typescript
// Add to existing tests:
it('renders ConversationView when session tab is active', () => {
  // Must include all required UIStore properties for type safety
  mockUseUIStore.mockReturnValue({
    tabs: [{ id: 'tab-1', type: 'session', title: 'Test', sessionId: 'session-123', sessionState: 'idle' }],
    activeTabId: 'tab-1',
    getScrollPosition: vi.fn().mockReturnValue(0),
    setScrollPosition: vi.fn(),
    // Add remaining required stubs
    scrollPositions: new Map(),
    clearScrollPosition: vi.fn(),
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    activeSection: 'sessions' as const,
    showArchived: false,
    setLeftPanelCollapsed: vi.fn(),
    setRightPanelCollapsed: vi.fn(),
    setActiveSection: vi.fn(),
    setShowArchived: vi.fn(),
    addTab: vi.fn(),
    closeTab: vi.fn(),
    setActiveTabId: vi.fn(),
    findTabBySessionId: vi.fn(),
    focusOrOpenSession: vi.fn(),
    updateTabSessionState: vi.fn(),
    updateTabTitle: vi.fn()
  })

  render(<MiddlePanelContent />)

  // Should render mock messages from ConversationView (using createMockMessages)
  expect(screen.getByText(/Hello, can you help me with a React question/)).toBeInTheDocument()
})

it('renders message bubbles with correct accessibility labels', () => {
  mockUseUIStore.mockReturnValue({
    tabs: [{ id: 'tab-1', type: 'session', title: 'Test', sessionId: 'session-123', sessionState: 'idle' }],
    activeTabId: 'tab-1',
    getScrollPosition: vi.fn().mockReturnValue(0),
    setScrollPosition: vi.fn(),
    scrollPositions: new Map(),
    clearScrollPosition: vi.fn(),
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    activeSection: 'sessions' as const,
    showArchived: false,
    setLeftPanelCollapsed: vi.fn(),
    setRightPanelCollapsed: vi.fn(),
    setActiveSection: vi.fn(),
    setShowArchived: vi.fn(),
    addTab: vi.fn(),
    closeTab: vi.fn(),
    setActiveTabId: vi.fn(),
    findTabBySessionId: vi.fn(),
    focusOrOpenSession: vi.fn(),
    updateTabSessionState: vi.fn(),
    updateTabTitle: vi.fn()
  })

  render(<MiddlePanelContent />)

  // Verify accessibility labels exist
  expect(screen.getAllByLabelText('User message').length).toBeGreaterThan(0)
  expect(screen.getAllByLabelText('Assistant message').length).toBeGreaterThan(0)
})
```

**Acceptance Criteria:**
- [ ] MiddlePanelContent imports ConversationView and createMockMessages
- [ ] Uses useMemo to memoize mock messages for stable reference
- [ ] ConversationView rendered for tabs with sessionId
- [ ] Parent container uses flex-1 and min-h-0 for proper overflow
- [ ] ChatInputPlaceholder remains at bottom
- [ ] Existing EmptyStateView and NewSessionView flows unchanged
- [ ] Tests updated to verify conversation rendering and accessibility

---

#### Task 8: Final validation

Run the full validation suite:

```bash
npm run validate
```

**Manual Testing Checklist:**
- [ ] Open a session tab - conversation renders with mock messages
- [ ] User messages appear right-aligned with accent styling
- [ ] Assistant messages appear left-aligned with elevated styling
- [ ] Timestamps display correctly (relative for recent, absolute for older)
- [ ] Scrolling is smooth via Radix ScrollArea
- [ ] Auto-scroll to bottom on initial tab open
- [ ] Switch tabs and return - scroll position preserved
- [ ] Close tab and reopen - scroll position cleared (starts at bottom)

**Acceptance Criteria:**
- [ ] `npm run validate` passes (tsc + vitest + lint)
- [ ] All new tests pass
- [ ] All existing tests still pass
- [ ] Manual verification complete

### Acceptance Criteria

**AC1: Visual Styling (FR33)**
- Given a conversation is loaded
- When messages are rendered
- Then user messages appear right-aligned with accent-muted background and accent border
- And Claude messages appear left-aligned with elevated background and subtle border
- And each bubble has rounded corners (bottom-right smaller for user, bottom-left smaller for Claude)

**AC2: Timestamps (FR33)**
- Given messages are displayed
- When viewing timestamps
- Then timestamps appear below each bubble in muted text
- And format is relative for recent ("2m ago", "3h ago") and absolute for older ("Jan 15, 14:32")

**AC3: Scrolling (FR39)**
- Given a conversation has many messages
- When the user scrolls
- Then the conversation area scrolls smoothly
- And scroll position is preserved when switching back to this tab

**AC4: Auto-scroll (FR39)**
- Given a session is loaded
- When the conversation renders
- Then the view auto-scrolls to the most recent message (if no saved position)
- And does not force-scroll if user has scrolled up to read history

## Additional Context

### Dependencies

**Existing (verified installed):**
- `@radix-ui/react-scroll-area` - Smooth scrolling component
- `zustand` - State management
- `vitest` + `@testing-library/react` - Testing
- `clsx` + `tailwind-merge` - Used by cn() utility

**No new dependencies required.**

### Testing Strategy

**Unit Tests:**
- formatMessageTimestamp: edge cases (null, <24h, >24h, different year, boundaries)
- MessageBubble: rendering, styling variants, timestamp display
- ConversationView: message rendering, scroll behavior, position persistence

**Integration Tests:**
- MiddlePanelContent: ConversationView integration with existing flows

**Manual Tests:**
- Visual verification of bubble styling
- Scroll behavior on tab switching
- Auto-scroll behavior

### Notes

**CSS Variable Dependencies:**
The following CSS variables must be defined (should already exist from Epic 1):
- `--accent` - Primary accent color (purple)
- `--accent-muted` - Accent at lower opacity
- `--bg-elevated` - Elevated background color
- `--bg-hover` - Hover state background
- `--border` - Subtle border color
- `--text-primary` - Primary text color
- `--text-muted` - Muted text color

**Performance Considerations:**
- Current implementation renders all messages without virtualization
- Acceptable for MVP (NFR2: 100+ messages < 1 second)
- Virtualization can be added in future optimization pass if needed

**Future Enhancements:**
- Tool call bubbles (Story 2b.2)
- Sub-agent bubbles (Story 2b.3)
- Real JSONL data loading (Epic 3b)
- Rewind UI on user messages (Story 2b.5)

---

## Tech Spec Quality Review

### Review Date
2026-01-23

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - Adversarial Review Mode

### Review Outcome
**APPROVED WITH FIXES** - All identified issues have been addressed.

### Issues Found and Fixed

#### HIGH Priority Issues (3 total - all fixed)

**H1: Incomplete useUIStore mock in ConversationView tests**
- Problem: Mock returned only 2 properties but component TypeScript expects full store interface
- Fix: Added complete mock implementation with all required UIStore properties
- Files affected: ConversationView.test.tsx mock setup

**H2: Missing accessibility attributes (WCAG compliance)**
- Problem: MessageBubble lacked role and aria-label, screen readers couldn't distinguish user/assistant
- Fix: Added `role="article"` and `aria-label="User message"/"Assistant message"` to MessageBubble
- Files affected: MessageBubble.tsx, MessageBubble.test.tsx (new accessibility tests)

**H3: Missing tests for closeTab scroll cleanup**
- Problem: Task 4 specified closeTab should clear scroll positions but no test coverage existed
- Fix: Added comprehensive test suite for scroll position persistence including closeTab behavior
- Files affected: useUIStore.test.ts additions

#### MEDIUM Priority Issues (3 total - all fixed)

**M1: Flaky timezone-dependent tests**
- Problem: Tests expected specific date strings (e.g., "Jan 22") but results vary by timezone
- Fix: Changed assertions to use pattern matching for format verification, not exact values
- Files affected: formatMessageTimestamp.test.ts

**M2: Dynamic MOCK_MESSAGES timestamps**
- Problem: Mock data used `Date.now() - ...` making tests non-reproducible
- Fix: Changed to fixed Unix timestamps + added `createMockMessages()` helper for runtime use
- Files affected: types.ts, MiddlePanelContent.tsx (uses createMockMessages)

**M3: Incomplete MiddlePanelContent test mock**
- Problem: Test mock didn't include all UIStore properties causing type errors
- Fix: Added complete mock with all required properties and new accessibility test
- Files affected: MiddlePanelContent.test.tsx

#### LOW Priority Issues (2 total - all fixed)

**L1: Missing debounce documentation**
- Problem: Scroll handler comment mentioned debounce but no guidance provided
- Fix: Added detailed comment explaining MVP approach and future optimization path
- Files affected: ConversationView.tsx handleScroll function

**L2: Missing accessibility acceptance criteria**
- Problem: Task 3 AC didn't mention accessibility requirements
- Fix: Added explicit accessibility criteria to Task 3 acceptance list
- Files affected: Task 3 Acceptance Criteria

### Validation Results

- **Actionable**: PASS - All tasks have clear file paths and specific actions
- **Logical**: PASS - Tasks ordered by dependency (types first, then utilities, then components)
- **Testable**: PASS - All ACs follow Given/When/Then with happy path and edge cases
- **Complete**: PASS - All investigation results inlined, no placeholders
- **Self-Contained**: PASS - Fresh agent can implement without workflow history

### Ready for Development
**YES** - Tech spec meets all READY FOR DEVELOPMENT criteria.
