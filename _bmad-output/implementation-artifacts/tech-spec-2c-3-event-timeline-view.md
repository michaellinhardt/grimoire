# Tech Spec: Story 2c-3 Event Timeline View

**Status:** Ready for Implementation
**Story:** 2c-3
**Epic:** 2c (Session Detail Right Panel)

---

## Overview

This tech spec covers the implementation of the Event Timeline View, which displays a condensed timeline of all conversation events in the right panel. Users can click events to navigate to specific points in the conversation, and the timeline syncs bidirectionally with the conversation scroll position.

### Goals
1. Remove icons from EventTimelineItem per UX9 specification (text-only display)
2. Wire real conversation data to the timeline (replace mock data)
3. Implement click-to-scroll navigation from timeline to conversation
4. Implement two-way scroll sync between conversation and timeline

### Non-Goals (Out of Scope)
- Real-time streaming message updates (Epic 3b concern)
- Conversation data fetching from backend (using existing mock data flow for now)
- Performance optimizations for 1000+ message sessions (premature optimization)
- Keyboard navigation within timeline (already handled by button elements)

---

## Files to Reference

| File | Purpose | Action |
|------|---------|--------|
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimelineItem.tsx` | Timeline item component with icons | MODIFY (remove icons) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimelineItem.test.tsx` | Tests for EventTimelineItem | READ ONLY (no icon-specific assertions exist) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimeline.tsx` | Timeline container component | READ ONLY (already supports activeEventUuid) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimeline.test.tsx` | Tests for EventTimeline | READ ONLY (no icon-specific assertions exist) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/types.ts` | TimelineEvent and ConversationMessage types | READ ONLY |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/RightPanelContent.tsx` | Right panel with EventTimeline | MODIFY (integrate real data, scroll handlers) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx` | Middle panel with ConversationView | READ ONLY (no changes needed) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx` | Conversation view component | MODIFY (add message UUIDs as data attrs, expose scroll sync) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` | UI state store | MODIFY (add activeTimelineEventUuid state) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/formatTokenCount.ts` | Token count formatter | READ ONLY |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/formatMessageTimestamp.ts` | Timestamp formatter | READ ONLY |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/cn.ts` | Class name utility | READ ONLY |

---

## Codebase Patterns to Follow

### Component Patterns
- Functional components with explicit `ReactElement` return type
- Props interfaces defined with `interface ComponentNameProps`
- JSDoc comments above component with `@param` for each prop
- Use `cn()` utility for conditional class names

### State Management Patterns
- Zustand stores in `shared/store/` with `use{Name}Store.ts` naming
- State updates via `set()` with callback form for complex updates
- Selectors as plain functions (not hooks) for derived state

### Testing Patterns
- Colocated tests: `Component.test.tsx` next to `Component.tsx`
- Use `vi.useFakeTimers()` + `vi.setSystemTime()` for timestamp tests
- Mock `window.grimoireAPI` for IPC-dependent tests
- Use `@testing-library/react` with `screen` and `fireEvent`

### CSS Patterns
- CSS variables: `var(--text-primary)`, `var(--bg-elevated)`, `var(--accent)`
- Tailwind utility classes with `cn()` for conditional application
- Radix UI primitives (ScrollArea) used for scrollable containers

### Import Patterns
- Use `@renderer/` alias for cross-feature imports
- Use relative paths within same feature folder
- Use `import type { X }` for type-only imports

---

## Implementation Tasks

### Task 1: Remove Icons from EventTimelineItem (AC: #1)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimelineItem.tsx`

**Actions:**
1. Remove import statement: `import { User, Bot, Wrench, Users } from 'lucide-react'`
2. Remove the `Icon` constant assignment (line 38): `const Icon = isUserEvent ? User : isTool ? Wrench : isSubAgent ? Users : Bot`
3. Remove the Icon JSX element (lines 69-78): The entire `<Icon ... />` block
4. Update aria-label to remove icon reference: Change from `Go to ${event.type} event: ${event.summary}` to just that (no change needed, already doesn't reference icons)
5. Adjust gap in button className: Change `gap-2` to `gap-1` since we no longer have icon spacing

**Before:**
```tsx
import { User, Bot, Wrench, Users } from 'lucide-react'
// ...
const Icon = isUserEvent ? User : isTool ? Wrench : isSubAgent ? Users : Bot
// ...
<button className="... gap-2 ...">
  <Icon ... />
  <div className="flex-1 ...">
```

**After:**
```tsx
// No lucide-react imports
// No Icon constant
// ...
<button className="... gap-1 ...">
  <div className="flex-1 ...">
```

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimelineItem.test.tsx`

**Actions:**
1. The tests do NOT explicitly assert on icons, so no test changes required
2. Verify all existing tests pass after icon removal

---

### Task 2: Create Timeline Event Conversion Utility (AC: #1, #2)

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/utils/timelineUtils.ts`

**Purpose:** Convert ConversationMessage[] to TimelineEvent[] for timeline display

**Implementation:**

```typescript
import type { ConversationMessage, TimelineEvent, ToolUseBlock, SubAgentBlock } from '../types'

/**
 * Maximum characters for summary truncation
 */
const SUMMARY_MAX_LENGTH = 50

/**
 * Truncate text to max length with ellipsis
 */
function truncateSummary(text: string, maxLength: number = SUMMARY_MAX_LENGTH): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Extract a one-line summary from message content
 * For tool calls, uses tool name + primary parameter
 * For sub-agents, uses agent type + short ID
 */
function extractSummary(
  message: ConversationMessage,
  toolCall?: ToolUseBlock,
  subAgent?: SubAgentBlock
): string {
  // Sub-agent: "Explore-a8b2"
  if (subAgent) {
    const shortId = subAgent.id.slice(-4)
    return `${subAgent.agentType}-${shortId}`
  }

  // Tool call: "Read src/main/index.ts"
  if (toolCall) {
    const input = toolCall.input
    // Extract primary parameter based on tool type
    if (toolCall.name === 'Read' && input.file_path) {
      return `Read ${truncateSummary(String(input.file_path), 40)}`
    }
    if (toolCall.name === 'Write' && input.file_path) {
      return `Write ${truncateSummary(String(input.file_path), 40)}`
    }
    if (toolCall.name === 'Edit' && input.file_path) {
      return `Edit ${truncateSummary(String(input.file_path), 40)}`
    }
    if (toolCall.name === 'Bash' && input.command) {
      return `Bash: ${truncateSummary(String(input.command), 40)}`
    }
    if (toolCall.name === 'Glob' && input.pattern) {
      return `Glob ${truncateSummary(String(input.pattern), 40)}`
    }
    if (toolCall.name === 'Grep' && input.pattern) {
      return `Grep ${truncateSummary(String(input.pattern), 40)}`
    }
    return toolCall.name
  }

  // Regular message: first line, truncated
  const firstLine = message.content.split('\n')[0]
  return truncateSummary(firstLine)
}

/**
 * Estimate token count from message content
 * Uses rough approximation: ~4 chars per token for English text
 * Returns undefined if content is empty
 */
function estimateTokenCount(content: string): number | undefined {
  if (!content) return undefined
  return Math.ceil(content.length / 4)
}

/**
 * Convert a ConversationMessage array to TimelineEvent array.
 * Each message becomes one or more timeline events:
 * - User messages: 1 user event
 * - Assistant messages: 1 assistant event + N tool events + N sub-agent events
 *
 * @param messages - Array of conversation messages
 * @returns Array of timeline events for display
 */
export function convertToTimelineEvents(messages: ConversationMessage[]): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      // User message -> user event
      events.push({
        uuid: message.uuid,
        type: 'user',
        summary: extractSummary(message),
        timestamp: message.timestamp,
        tokenCount: estimateTokenCount(message.content)
      })
    } else {
      // Assistant message -> assistant event (if has content)
      if (message.content) {
        events.push({
          uuid: message.uuid,
          type: 'assistant',
          summary: extractSummary(message),
          timestamp: message.timestamp,
          tokenCount: estimateTokenCount(message.content)
        })
      }

      // Tool calls -> tool events
      if (message.toolUseBlocks) {
        for (const tool of message.toolUseBlocks) {
          // Skip Task/Skill tools that have corresponding sub-agents
          if (
            (tool.name === 'Task' || tool.name === 'Skill') &&
            message.subAgentBlocks?.some((sa) => sa.parentMessageUuid === message.uuid)
          ) {
            continue
          }
          events.push({
            uuid: `${message.uuid}-tool-${tool.id}`,
            type: 'tool',
            summary: extractSummary(message, tool),
            timestamp: message.timestamp,
            tokenCount: estimateTokenCount(JSON.stringify(tool.input))
          })
        }
      }

      // Sub-agents -> sub_agent events
      if (message.subAgentBlocks) {
        for (const subAgent of message.subAgentBlocks) {
          const shortId = subAgent.id.slice(-4)
          events.push({
            uuid: `${message.uuid}-subagent-${subAgent.id}`,
            type: 'sub_agent',
            summary: `${subAgent.agentType}-${shortId}`,
            timestamp: message.timestamp,
            tokenCount: undefined, // Sub-agent token count not available at message level
            agentType: subAgent.agentType,
            agentId: shortId
          })
        }
      }
    }
  }

  return events
}
```

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/utils/timelineUtils.test.ts`

**Test cases:**
1. Empty messages array returns empty events array
2. User message converts to user event with correct fields
3. Assistant message converts to assistant event
4. Message with tool calls generates tool events
5. Message with sub-agents generates sub_agent events
6. Task/Skill tools are filtered when sub-agent exists
7. Summary truncation works correctly at 50 chars
8. Token count estimation (~4 chars per token)

---

### Task 3: Create useTimelineEvents Hook (AC: #1, #2)

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useTimelineEvents.ts`

**Purpose:** Provide memoized timeline events derived from conversation messages

```typescript
import { useMemo } from 'react'
import type { ConversationMessage, TimelineEvent } from '../components/types'
import { convertToTimelineEvents } from '../components/utils/timelineUtils'

/**
 * Hook that converts conversation messages to timeline events.
 * Memoizes the conversion to prevent unnecessary recalculation.
 *
 * @param messages - Array of conversation messages
 * @returns Memoized array of timeline events
 */
export function useTimelineEvents(messages: ConversationMessage[]): TimelineEvent[] {
  return useMemo(() => convertToTimelineEvents(messages), [messages])
}
```

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useTimelineEvents.test.ts`

**Test cases:**
1. Returns empty array for empty messages
2. Memoizes result (same reference when messages unchanged)
3. Recalculates when messages change

---

### Task 4: Add activeTimelineEventUuid to useUIStore (AC: #4, #5)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts`

**Actions:**
1. Add `activeTimelineEventUuid: string | null` to UIState interface
2. Add `setActiveTimelineEventUuid: (uuid: string | null) => void` action
3. Initialize `activeTimelineEventUuid: null` in initial state
4. Implement setter action

**Add to interface:**
```typescript
interface UIState {
  // ... existing fields

  // Active timeline event (for two-way scroll sync)
  activeTimelineEventUuid: string | null

  // ... existing actions
  setActiveTimelineEventUuid: (uuid: string | null) => void
}
```

**Add to store:**
```typescript
export const useUIStore = create<UIState>((set, get) => ({
  // ... existing state
  activeTimelineEventUuid: null,

  // ... existing actions
  setActiveTimelineEventUuid: (uuid) => set({ activeTimelineEventUuid: uuid }),
}))
```

---

### Task 5: Add data-message-uuid Attributes to ConversationView (AC: #4, #5)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx`

**Actions:**
1. Add `data-message-uuid` attribute to message wrapper divs for scroll targeting
2. This is already partially done with `ref` assignment - just add the data attribute

**First message wrapper (lines 266-271 - messages with tools/sub-agents):**
```tsx
// BEFORE:
<div
  key={msg.uuid}
  ref={(el) => {
    if (el) messageRefs.current.set(msg.uuid, el)
  }}
>

// AFTER:
<div
  key={msg.uuid}
  data-message-uuid={msg.uuid}
  ref={(el) => {
    if (el) messageRefs.current.set(msg.uuid, el)
  }}
>
```

**Second message wrapper (lines 311-316 - regular messages without tools):**
```tsx
// BEFORE:
<div
  key={msg.uuid}
  ref={(el) => {
    if (el) messageRefs.current.set(msg.uuid, el)
  }}
>

// AFTER:
<div
  key={msg.uuid}
  data-message-uuid={msg.uuid}
  ref={(el) => {
    if (el) messageRefs.current.set(msg.uuid, el)
  }}
>
```

**IMPORTANT:** Both wrapper divs must be updated to ensure all messages are targetable by the IntersectionObserver.

---

### Task 6: Create useActiveTimelineEvent Hook (AC: #5)

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useActiveTimelineEvent.ts`

**Purpose:** Track which message is currently visible in the conversation viewport using IntersectionObserver

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'

/** Debounce delay for scroll position updates */
const SCROLL_DEBOUNCE_MS = 100

/**
 * Hook that tracks the currently visible message in the conversation view.
 * Uses IntersectionObserver to detect which messages are in the viewport,
 * and updates activeTimelineEventUuid in the UI store.
 *
 * @param containerRef - Ref to the scrollable container element
 * @param messageUuids - Array of message UUIDs in display order
 */
export function useActiveTimelineEvent(
  containerRef: React.RefObject<HTMLElement | null>,
  messageUuids: string[]
): void {
  const { setActiveTimelineEventUuid } = useUIStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleMessagesRef = useRef<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const updateActiveEvent = useCallback(() => {
    // Find the topmost visible message (first in the messageUuids array that is visible)
    for (const uuid of messageUuids) {
      if (visibleMessagesRef.current.has(uuid)) {
        setActiveTimelineEventUuid(uuid)
        return
      }
    }
    // No visible messages
    setActiveTimelineEventUuid(null)
  }, [messageUuids, setActiveTimelineEventUuid])

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(updateActiveEvent, SCROLL_DEBOUNCE_MS)
  }, [updateActiveEvent])

  // Single consolidated useEffect that handles observer setup and re-observation
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Cleanup previous observer if exists
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    visibleMessagesRef.current.clear()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const uuid = entry.target.getAttribute('data-message-uuid')
          if (!uuid) continue

          if (entry.isIntersecting) {
            visibleMessagesRef.current.add(uuid)
          } else {
            visibleMessagesRef.current.delete(uuid)
          }
        }
        debouncedUpdate()
      },
      {
        root: container,
        threshold: 0.5 // Element is "visible" when 50% in view
      }
    )

    observerRef.current = observer

    // Observe all message elements
    const messageElements = container.querySelectorAll('[data-message-uuid]')
    messageElements.forEach((el) => observer.observe(el))

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      observer.disconnect()
      observerRef.current = null
      visibleMessagesRef.current.clear()
    }
  }, [containerRef, messageUuids, debouncedUpdate])
}
```

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useActiveTimelineEvent.test.ts`

**Test cases:**
1. Updates activeTimelineEventUuid when message becomes visible
2. Clears activeTimelineEventUuid when no messages visible
3. Debounces rapid updates (100ms)
4. Cleans up observer on unmount
5. Handles container ref being null
6. Re-observes elements when messageUuids change (single observer, no duplicates)
7. Selects topmost visible message in display order

---

### Task 7: Implement Scroll-to-Event in ConversationView (AC: #4)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx`

The `scrollToEvent` function already exists (lines 128-134). We need to:

1. Add highlight animation when scrolling to an event
2. Register the scroll function to the store for RightPanelContent access

**Add highlight state (after line 64, with other state declarations):**

```typescript
// Highlight state for scroll-to-event animation (Story 2c-3)
const [highlightedUuid, setHighlightedUuid] = useState<string | null>(null)
```

**Update scrollToEvent function (replace lines 128-134):**

```typescript
// Scroll to a specific event/message by UUID with highlight animation
const scrollToEvent = useCallback((eventUuid: string) => {
  const element = messageRefs.current.get(eventUuid)
  if (element) {
    // Browser handles smooth scroll timing (~300ms)
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Apply highlight animation
    setHighlightedUuid(eventUuid)

    // Remove highlight after 500ms
    setTimeout(() => {
      setHighlightedUuid(null)
    }, 500)
  }
}, [])
```

**Update message wrapper divs to include highlight class:**

Import `cn` utility at top of file if not already imported:
```typescript
import { cn } from '@renderer/shared/utils/cn'
```

**First wrapper (messages with tools/sub-agents) - around line 266:**
```tsx
<div
  key={msg.uuid}
  data-message-uuid={msg.uuid}
  className={cn(
    'transition-all duration-300',
    highlightedUuid === msg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
  )}
  ref={(el) => {
    if (el) messageRefs.current.set(msg.uuid, el)
  }}
>
```

**Second wrapper (regular messages) - around line 311:**
```tsx
<div
  key={msg.uuid}
  data-message-uuid={msg.uuid}
  className={cn(
    'transition-all duration-300',
    highlightedUuid === msg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
  )}
  ref={(el) => {
    if (el) messageRefs.current.set(msg.uuid, el)
  }}
>
```

**IMPORTANT:** Apply the same `className` pattern to BOTH wrapper divs to ensure consistent highlighting regardless of message type.

---

### Task 8: Integrate Real Data and Scroll Sync in RightPanelContent (AC: #1-5)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/RightPanelContent.tsx`

**Actions:**

1. Remove `MOCK_TIMELINE_EVENTS` import
2. Import `useTimelineEvents` hook
3. Get messages from props or parent (for now, use mock messages like MiddlePanelContent)
4. Wire up `activeTimelineEventUuid` from useUIStore
5. Update `handleEventClick` to call scroll function from store
6. Add auto-scroll for timeline when active event changes

**IMPORTANT:** Radix `Tabs.Content` does not forward refs directly. We need to add a wrapper div inside the Tabs.Content to hold the ref for querying data-event-uuid elements.

**Updated implementation:**

```typescript
import { type ReactElement, useCallback, useEffect, useRef, useMemo } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useUIStore, type RightPanelTab } from '@renderer/shared/store/useUIStore'
import { RightPanelTabs } from './RightPanelTabs'
import { EventTimeline } from '@renderer/features/sessions/components/EventTimeline'
import { SessionInfoView } from '@renderer/features/sessions/components/SessionInfoView'
import { useTimelineEvents } from '@renderer/features/sessions/hooks/useTimelineEvents'
import {
  createMockMessages,
  type TimelineEvent
} from '@renderer/features/sessions/components/types'

// ... FilesPlaceholder stays same

export function RightPanelContent(): ReactElement {
  const {
    tabs,
    activeTabId,
    rightPanelActiveTab,
    activeTimelineEventUuid,
    scrollToConversationEvent,
    setRightPanelActiveTab,
    setRightPanelCollapsed,
    openSubAgentTab
  } = useUIStore()

  const activeMiddleTab = tabs.find((t) => t.id === activeTabId)
  const activeSessionId = activeMiddleTab?.type === 'session' ? activeMiddleTab.sessionId : null

  // Get mock messages (same pattern as MiddlePanelContent - will be replaced with real data in Epic 3b)
  const mockMessages = useMemo(() => createMockMessages(), [])

  // Convert messages to timeline events
  const timelineEvents = useTimelineEvents(mockMessages)

  // Ref for timeline scroll container (wrapper div inside Tabs.Content)
  const timelineContainerRef = useRef<HTMLDivElement>(null)

  // Auto-select Files tab when viewing a file in middle panel
  useEffect(() => {
    if (activeMiddleTab?.type === 'file' && rightPanelActiveTab !== 'files') {
      setRightPanelActiveTab('files')
    }
  }, [activeMiddleTab?.id, activeMiddleTab?.type, rightPanelActiveTab, setRightPanelActiveTab])

  // Auto-scroll timeline to keep active event visible
  useEffect(() => {
    if (!activeTimelineEventUuid || !timelineContainerRef.current) return

    const activeElement = timelineContainerRef.current.querySelector(
      `[data-event-uuid="${activeTimelineEventUuid}"]`
    )
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeTimelineEventUuid])

  // Event handlers for EventTimeline - use scroll function from store
  const handleEventClick = useCallback(
    (eventUuid: string): void => {
      if (scrollToConversationEvent) {
        scrollToConversationEvent(eventUuid)
      }
    },
    [scrollToConversationEvent]
  )

  const handleSubAgentClick = useCallback(
    (event: TimelineEvent): void => {
      if (event.type === 'sub_agent' && event.agentType) {
        openSubAgentTab({
          type: 'sub_agent',
          id: event.uuid,
          agentType: event.agentType,
          label: `${event.agentType} Agent`,
          parentMessageUuid: '',
          path: '',
          status: 'done'
        })
      }
    },
    [openSubAgentTab]
  )

  return (
    <Tabs.Root
      value={rightPanelActiveTab}
      onValueChange={(value) => setRightPanelActiveTab(value as RightPanelTab)}
      className="h-full flex flex-col bg-[var(--bg-base)]"
    >
      <RightPanelTabs onCollapse={() => setRightPanelCollapsed(true)} />

      <Tabs.Content value="info" className="flex-1 outline-none overflow-hidden">
        <SessionInfoView sessionId={activeSessionId} />
      </Tabs.Content>

      <Tabs.Content value="events" className="flex-1 outline-none overflow-hidden">
        {/* Wrapper div for ref since Tabs.Content doesn't forward refs */}
        <div ref={timelineContainerRef} className="h-full">
          <EventTimeline
            events={timelineEvents}
            onEventClick={handleEventClick}
            onSubAgentClick={handleSubAgentClick}
            activeEventUuid={activeTimelineEventUuid}
          />
        </div>
      </Tabs.Content>

      <Tabs.Content value="files" className="flex-1 outline-none overflow-hidden">
        <FilesPlaceholder />
      </Tabs.Content>
    </Tabs.Root>
  )
}
```

**NOTE:** Removed `onScrollToEvent` prop - now uses `scrollToConversationEvent` from store directly (see Task 10).

---

### Task 9: Add data-event-uuid to EventTimelineItem (AC: #5)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimelineItem.tsx`

**Action:** Add `data-event-uuid` attribute to the button element for scroll targeting

```tsx
<button
  type="button"
  onClick={onClick}
  data-event-uuid={event.uuid}
  className={cn(
    // ... existing classes
  )}
  aria-label={`Go to ${event.type} event: ${event.summary}`}
>
```

---

### Task 10: Wire Scroll Functions via Store (AC: #4, #5)

**Purpose:** Enable RightPanelContent to trigger scrolling in ConversationView using Zustand store as communication bridge (avoids prop drilling).

**File 1:** `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts`

**Add to UIState interface (after line 35, after `showArchived: boolean`):**
```typescript
  // Scroll-to-event function reference (registered by ConversationView)
  scrollToConversationEvent: ((uuid: string) => void) | null
```

**Add to interface actions (after line 54, after `openSubAgentTab`):**
```typescript
  setScrollToConversationEvent: (fn: ((uuid: string) => void) | null) => void
```

**Add to initial state (after line 67, after `scrollPositions: new Map()`):**
```typescript
  scrollToConversationEvent: null,
```

**Add action implementation (after line 73, after `setShowArchived`):**
```typescript
  setScrollToConversationEvent: (fn) => set({ scrollToConversationEvent: fn }),
```

---

**File 2:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx`

**Update useUIStore destructuring (line 53) to add setScrollToConversationEvent:**
```typescript
const { getScrollPosition, setScrollPosition, openSubAgentTab, setScrollToConversationEvent } = useUIStore()
```

**Add useEffect to register scroll function (after the existing onScrollToEventRef effect, around line 200):**
```typescript
// Register scroll function to store for cross-component access (Story 2c-3)
useEffect(() => {
  setScrollToConversationEvent(scrollToEvent)
  return () => setScrollToConversationEvent(null)
}, [scrollToEvent, setScrollToConversationEvent])
```

**NOTE:** This coexists with the existing `onScrollToEventRef` callback pattern. The store-based approach is used by RightPanelContent, while the callback ref approach remains available for other uses.

---

**File 3:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/RightPanelContent.tsx`

Already covered in Task 8 - uses `scrollToConversationEvent` from store in `handleEventClick`.

---

### Task 11: Integrate useActiveTimelineEvent in ConversationView (AC: #5)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx`

**Purpose:** Track which message is visible in viewport and sync to timeline highlight.

**Add import at top of file:**
```typescript
import { useActiveTimelineEvent } from '../hooks/useActiveTimelineEvent'
```

**Add useMemo import if not present:**
```typescript
import { useRef, useEffect, useCallback, useState, useMemo, type ReactElement } from 'react'
```

**Add hook call inside component (after viewportRef declaration, around line 43):**
```typescript
// Track message UUIDs for scroll sync
const messageUuids = useMemo(() => messages.map((m) => m.uuid), [messages])

// Track active message in viewport for timeline sync (Story 2c-3)
useActiveTimelineEvent(viewportRef, messageUuids)
```

**NOTE:** The hook uses the existing `viewportRef` which is already defined in the component. The hook updates `activeTimelineEventUuid` in useUIStore, which RightPanelContent reads to highlight the active timeline event.

---

### Task 12: Update Tests and Final Verification (AC: #1-5)

**Files to update tests:**

1. `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimelineItem.test.tsx`
   - Verify no icon-related assertions exist (they don't - already verified)
   - Tests should pass without modification

2. `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/EventTimeline.test.tsx`
   - Verify no icon-related assertions exist
   - Tests should pass without modification

3. `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/RightPanelContent.test.tsx`
   - Update to not import MOCK_TIMELINE_EVENTS
   - Mock useTimelineEvents hook or provide mock messages

4. `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.test.ts`
   - Add tests for new state: activeTimelineEventUuid
   - Add tests for new actions: setActiveTimelineEventUuid, setScrollToConversationEvent

**Run full test suite:** `npm run validate`

---

## Acceptance Criteria Verification

| AC | Description | Implementation | Test |
|----|-------------|----------------|------|
| AC1 | Chat-style bubbles, no icons | Task 1: Remove icons from EventTimelineItem | EventTimelineItem.test.tsx |
| AC2 | Summary, token count, timestamp | Task 2: convertToTimelineEvents utility | timelineUtils.test.tsx |
| AC3 | Sub-agent styling and click | Already implemented, verify in Task 8 | EventTimeline.test.tsx |
| AC4 | Click scrolls conversation | Tasks 7, 10: scrollToEvent + store wiring | Integration test |
| AC5 | Two-way scroll sync | Tasks 4, 6, 11: useActiveTimelineEvent hook | useActiveTimelineEvent.test.tsx |

---

## Dependencies

### Required Before This Story
- Story 2c-1: Right Panel with Tab Views (DONE)
- Story 2c-2: Session Info View (DONE)
- Story 2b.4: Navigation and Loading States (DONE) - provides EventTimeline, EventTimelineItem, types

### Blocks Future Stories
- None directly, but scroll sync patterns may be reused in Epic 3b streaming

---

## Testing Strategy

### Unit Tests
| File | Test Focus |
|------|------------|
| `timelineUtils.test.ts` | Pure function conversion logic |
| `useTimelineEvents.test.ts` | Hook memoization |
| `useActiveTimelineEvent.test.ts` | IntersectionObserver mocking |
| `useUIStore.test.ts` | New state/actions |

### Component Tests
| File | Test Focus |
|------|------------|
| `EventTimelineItem.test.tsx` | Rendering without icons |
| `EventTimeline.test.tsx` | Event list rendering, click handlers |
| `RightPanelContent.test.tsx` | Integration with timeline events |

### Integration Tests
- Manual verification of scroll-to-event behavior
- Manual verification of two-way scroll sync
- Check highlight animation timing (500ms)

### Test Environment Setup
- Use `vi.useFakeTimers()` for timestamp tests
- Mock `IntersectionObserver` for scroll sync tests
- Mock `window.grimoireAPI` for IPC calls

---

## Risk Areas

1. **IntersectionObserver Complexity:** The two-way scroll sync requires careful handling of the observer. Watch for:
   - Memory leaks if observer not disconnected
   - Excessive re-renders from rapid scroll updates
   - Edge cases with empty message lists

2. **Scroll Animation Timing:** Browser `scrollIntoView` timing varies. The 300ms ease-out is a CSS approximation, not a guarantee.

3. **Performance with Many Messages:** For sessions with 100+ messages, the IntersectionObserver will observe many elements. Monitor performance and consider virtualization in future if needed.

4. **State Sync Race Conditions:** When clicking timeline item while user is also scrolling, the state updates may conflict. The debounce helps but edge cases may exist.

---

## Checklist Verification

- [x] ACTIONABLE: Every task has clear file path AND specific action
- [x] LOGICAL: Tasks ordered by dependency (icon removal first, then utilities, then hooks, then integration)
- [x] TESTABLE: All ACs use Given/When/Then format (from story file)
- [x] COMPLETE: No placeholders, no "TBD", no "TODO"
- [x] SELF-CONTAINED: A fresh agent can implement without reading conversation history
- [x] Files to Reference table is populated with real paths
- [x] Codebase Patterns section matches actual project patterns
- [x] Implementation tasks are numbered and sequenced
- [x] Dependencies section lists required prior work
- [x] Testing Strategy specifies test types and locations
- [x] No task requires "figure out" or "research"
- [x] No ambiguous instructions
- [x] Scope boundaries explicit (Non-Goals section)

CHECKLIST COMPLETED: YES
