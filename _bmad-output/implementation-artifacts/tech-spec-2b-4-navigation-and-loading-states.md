---
title: 'Navigation and Loading States'
slug: '2b-4-navigation-and-loading-states'
created: '2026-01-23'
status: 'complete'
stepsCompleted: [1, 2, 3]
tech_stack: ['React', 'TypeScript', 'Radix UI', 'Tailwind CSS v4', 'Zustand', 'Vitest']
files_to_modify:
  - 'src/renderer/src/features/sessions/components/types.ts'
  - 'src/renderer/src/features/sessions/components/index.ts'
  - 'src/renderer/src/features/sessions/components/ConversationView.tsx'
  - 'src/renderer/src/features/sessions/components/SubAgentBubble.tsx'
  - 'src/renderer/src/assets/main.css'
  - 'src/renderer/src/core/shell/MiddlePanelContent.tsx'
code_patterns:
  - 'PascalCase component files with colocated tests'
  - 'CSS keyframe animations in main.css'
  - 'Zustand state for UI indicators'
  - 'useRef Map for message refs'
test_patterns:
  - '@testing-library/react for component tests'
  - 'vi.mock() for store mocking'
  - 'Fixed timestamps for reproducible tests'
---

# Tech-Spec: Navigation and Loading States

**Created:** 2026-01-23
**Story:** 2b-4-navigation-and-loading-states
**Status:** Ready for Implementation

## Overview

### Problem Statement

Users navigating long conversations need a way to quickly find specific points in the conversation. Additionally, when Claude is processing or loading, users need clear visual feedback to understand the system state. Currently, there are no navigation tools or loading indicators in the conversation view.

### Solution

Implement an event timeline for navigation (components only - integration is Story 2c.3), thinking/loading indicators for feedback during Claude processing, and update the SubAgentBubble running animation to use sequential dot animation instead of whole-element pulse.

### Scope

**In Scope:**
- EventTimelineItem component (user events right-aligned, system events left-aligned)
- EventTimeline component with scrollable event list
- TimelineEvent type and mock data
- Scroll-to-event functionality (click timeline -> scroll conversation)
- ThinkingIndicator component with animated dots
- LoadingIndicator component with fade pulse
- Integration of indicators into ConversationView
- SubAgentBubble running dots animation update
- CSS keyframe animations for all indicators

**Out of Scope:**
- RightPanelContent Events tab integration (Story 2c.3)
- Real-time timeline updates from streaming (Epic 3b)
- Bi-directional scroll sync (timeline highlighting based on scroll position)
- Token count calculation from real messages (uses mock/provided data)

## Context for Development

### Codebase Patterns

**Component Organization (from Story 2b.3):**
- PascalCase files: `EventTimelineItem.tsx`, `ThinkingIndicator.tsx`, `LoadingIndicator.tsx`
- Colocate tests: `ComponentName.test.tsx` beside `ComponentName.tsx`
- Feature folder: `src/renderer/src/features/sessions/components/`

**Existing Components to REUSE:**
- `SubAgentBubble.tsx` - Has Running status badge at line 39, needs animated dots addition
- `MessageBubble.tsx` - Reference for message styling and alignment
- `ConversationView.tsx` - Integration target for indicators
- `ToolCallCard.tsx` - Reference for event display patterns

**Existing Utilities to REUSE (DO NOT RECREATE):**
- `src/renderer/src/shared/utils/cn.ts` - Conditional class merging (Tailwind)
- `src/renderer/src/shared/utils/formatTokenCount.ts` - For token count display (e.g., "3.4k")
- `src/renderer/src/shared/utils/formatMessageTimestamp.ts` - For timestamp formatting

**State Management:**
- Session state from `useUIStore` via `activeTab.sessionState` (idle/working/error)
- Tab interface has `sessionState: SessionState` field

**Color System (Dark Theme):**
- CSS variables: `var(--bg-elevated)`, `var(--text-primary)`, `var(--text-muted)`, `var(--border)`
- User events: Accent color (`bg-purple-500/20`)
- System events: Elevated background (`var(--bg-elevated)`)
- Sub-agent timeline events: Purple-tinted (`bg-purple-500/10`)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx` | Integration target for indicators and scroll-to-event |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/SubAgentBubble.tsx` | Update running animation (lines 37-44 have statusBadgeClass/statusText) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/types.ts` | Add TimelineEvent type |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/index.ts` | Export new components |
| `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css` | Add CSS animations |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` | SessionState type and tab.sessionState |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/formatTokenCount.ts` | Token formatting utility |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/formatMessageTimestamp.ts` | Timestamp formatting utility |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx` | Pass sessionState prop to ConversationView (line 38) |

### Technical Decisions

1. **Scroll-to-Event Implementation**: Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` - browser handles timing (~300ms). No custom timing implementation needed.

2. **Message Refs Pattern**: Use `useRef<Map<string, HTMLDivElement>>(new Map())` to track message elements by UUID. Assign refs via callback during rendering: `ref={(el) => el && messageRefs.current.set(msg.uuid, el)}`.

3. **Indicator Rendering Location**: Render indicators at the END of messages list (after last message, before scroll area ends).

4. **Loading->Thinking Transition**: Use local state `isStreaming` in ConversationView. MVP note: With request-response model, actual streaming transitions will be refined in Epic 3b.

5. **Running Dots Animation**: Replace existing `animate-pulse` on SubAgentBubble status badge with sequential dot animation. Keep "Running..." text.

## Implementation Plan

### Tasks

#### Task 1: Add TimelineEvent Type and Mock Data (AC: 1)

**File:** `src/renderer/src/features/sessions/components/types.ts`

Add after existing types:

```typescript
// ========================================
// Story 2b.4: Navigation and Loading States Types
// ========================================

/**
 * Timeline event for navigation map
 * Each event corresponds to a ConversationMessage for scroll navigation
 */
export interface TimelineEvent {
  /** Unique identifier matching ConversationMessage.uuid */
  uuid: string
  /** Event type determines alignment and styling */
  type: 'user' | 'assistant' | 'tool' | 'sub_agent'
  /** One-line truncated summary for display */
  summary: string
  /** Unix timestamp in milliseconds */
  timestamp: number
  /** Optional token count for display */
  tokenCount?: number
  /** For sub_agent type: agent type (e.g., "Explore", "Bash") */
  agentType?: string
  /** For sub_agent type: short ID (e.g., "a8b2") */
  agentId?: string
}

/**
 * Mock timeline events for development and testing
 * NOTE: Fixed timestamps (1737640000000 = 2026-01-23T11:06:40Z) ensure reproducible tests
 */
export const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    uuid: 'evt-001',
    type: 'user',
    summary: 'Can you analyze the authentication code?',
    timestamp: 1737640000000,
    tokenCount: 1200
  },
  {
    uuid: 'evt-002',
    type: 'assistant',
    summary: "I'll examine the auth module thoroughly...",
    timestamp: 1737640060000,
    tokenCount: 3400
  },
  {
    uuid: 'evt-003',
    type: 'tool',
    summary: 'Read src/auth/login.ts',
    timestamp: 1737640120000,
    tokenCount: 850
  },
  {
    uuid: 'evt-004',
    type: 'sub_agent',
    summary: 'Explore-a8b2',
    timestamp: 1737640180000,
    tokenCount: 5200,
    agentType: 'Explore',
    agentId: 'a8b2'
  },
  {
    uuid: 'evt-005',
    type: 'assistant',
    summary: 'Based on my analysis, there are 3 issues...',
    timestamp: 1737640360000,
    tokenCount: 2100
  }
]
```

---

#### Task 2: Create EventTimelineItem Component (AC: 1)

**File:** `src/renderer/src/features/sessions/components/EventTimelineItem.tsx`

```typescript
import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'
import { formatTokenCount } from '@renderer/shared/utils/formatTokenCount'
import { formatMessageTimestamp } from '@renderer/shared/utils/formatMessageTimestamp'
import type { TimelineEvent } from './types'

export interface EventTimelineItemProps {
  /** Timeline event data */
  event: TimelineEvent
  /** Whether this event is currently active/highlighted */
  isActive?: boolean
  /** Click handler for navigation */
  onClick?: () => void
}

/**
 * Single item in the event timeline navigation map.
 * User events are right-aligned, system events are left-aligned.
 */
export function EventTimelineItem({
  event,
  isActive = false,
  onClick
}: EventTimelineItemProps): ReactElement {
  const isUserEvent = event.type === 'user'
  const isSubAgent = event.type === 'sub_agent'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left py-2 px-3 rounded-md transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        'hover:bg-[var(--bg-hover)]',
        isActive && 'bg-[var(--bg-hover)]',
        isUserEvent ? 'flex flex-col items-end' : 'flex flex-col items-start'
      )}
      aria-label={`Navigate to ${event.type} event: ${event.summary}`}
    >
      {/* Summary box with alignment-based styling */}
      <div
        className={cn(
          'max-w-[85%] px-3 py-2 rounded-lg',
          isUserEvent && 'bg-purple-500/20 text-right',
          !isUserEvent && !isSubAgent && 'bg-[var(--bg-elevated)]',
          isSubAgent && 'bg-purple-500/10 border-l-2 border-purple-500'
        )}
      >
        <span className="text-sm text-[var(--text-primary)] line-clamp-1">
          {event.summary}
        </span>
        {event.tokenCount !== undefined && (
          <span className="ml-2 text-xs text-[var(--text-muted)]">
            {formatTokenCount(event.tokenCount)}
          </span>
        )}
      </div>

      {/* Timestamp below the box */}
      <span
        className={cn(
          'text-xs text-[var(--text-muted)] mt-1',
          isUserEvent ? 'mr-1' : 'ml-1'
        )}
      >
        {formatMessageTimestamp(event.timestamp)}
      </span>
    </button>
  )
}
```

**Test File:** `src/renderer/src/features/sessions/components/EventTimelineItem.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EventTimelineItem } from './EventTimelineItem'
import type { TimelineEvent } from './types'

// Mock utilities - use realistic formatting that matches actual utility behavior
vi.mock('@renderer/shared/utils/formatTokenCount', () => ({
  formatTokenCount: (count: number) => {
    if (count < 1000) return count.toString()
    if (count < 999500) return `${(count / 1000).toFixed(1)}k`
    return `${(count / 1000000).toFixed(1)}M`
  }
}))

vi.mock('@renderer/shared/utils/formatMessageTimestamp', () => ({
  formatMessageTimestamp: () => '14:32'
}))

const mockUserEvent: TimelineEvent = {
  uuid: 'evt-user',
  type: 'user',
  summary: 'Can you help me?',
  timestamp: 1737640000000,
  tokenCount: 1200
}

const mockAssistantEvent: TimelineEvent = {
  uuid: 'evt-assistant',
  type: 'assistant',
  summary: 'I can help with that...',
  timestamp: 1737640060000,
  tokenCount: 3400
}

const mockSubAgentEvent: TimelineEvent = {
  uuid: 'evt-subagent',
  type: 'sub_agent',
  summary: 'Explore-a8b2',
  timestamp: 1737640180000,
  tokenCount: 5200,
  agentType: 'Explore',
  agentId: 'a8b2'
}

describe('EventTimelineItem', () => {
  it('renders user event right-aligned with accent background', () => {
    render(<EventTimelineItem event={mockUserEvent} />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('items-end')
    expect(screen.getByText('Can you help me?')).toBeInTheDocument()
  })

  it('renders assistant event left-aligned with elevated background', () => {
    render(<EventTimelineItem event={mockAssistantEvent} />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('items-start')
    expect(screen.getByText('I can help with that...')).toBeInTheDocument()
  })

  it('renders sub-agent event with purple tint and border', () => {
    render(<EventTimelineItem event={mockSubAgentEvent} />)

    expect(screen.getByText('Explore-a8b2')).toBeInTheDocument()
    // Sub-agent has purple border styling
    const summaryBox = screen.getByText('Explore-a8b2').closest('div')
    expect(summaryBox).toHaveClass('border-purple-500')
  })

  it('shows formatted token count', () => {
    render(<EventTimelineItem event={mockUserEvent} />)

    // 1200 tokens formats to "1.2k" per actual formatTokenCount utility
    expect(screen.getByText('1.2k')).toBeInTheDocument()
  })

  it('shows timestamp', () => {
    render(<EventTimelineItem event={mockUserEvent} />)

    expect(screen.getByText('14:32')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<EventTimelineItem event={mockUserEvent} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies active styling when isActive is true', () => {
    render(<EventTimelineItem event={mockUserEvent} isActive />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-[var(--bg-hover)]')
  })

  it('has accessible aria-label', () => {
    render(<EventTimelineItem event={mockUserEvent} />)

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Navigate to user event: Can you help me?'
    )
  })
})
```

---

#### Task 3: Create EventTimeline Component (AC: 1)

**File:** `src/renderer/src/features/sessions/components/EventTimeline.tsx`

```typescript
import { type ReactElement } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { EventTimelineItem } from './EventTimelineItem'
import type { TimelineEvent } from './types'

export interface EventTimelineProps {
  /** Array of timeline events to display */
  events: TimelineEvent[]
  /** Callback when an event is clicked for navigation */
  onEventClick: (eventUuid: string) => void
  /** Currently active/highlighted event UUID */
  activeEventUuid?: string
  /** Callback for sub-agent events to open in tab instead of scroll */
  onSubAgentClick?: (event: TimelineEvent) => void
}

/**
 * Scrollable event timeline for conversation navigation.
 * Renders EventTimelineItem for each event with appropriate alignment.
 */
export function EventTimeline({
  events,
  onEventClick,
  activeEventUuid,
  onSubAgentClick
}: EventTimelineProps): ReactElement {
  const handleEventClick = (event: TimelineEvent): void => {
    if (event.type === 'sub_agent' && onSubAgentClick) {
      onSubAgentClick(event)
    } else {
      onEventClick(event.uuid)
    }
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm p-4">
        Events will appear as the conversation progresses.
      </div>
    )
  }

  return (
    <ScrollArea.Root className="h-full w-full">
      <ScrollArea.Viewport className="h-full w-full">
        <div className="flex flex-col space-y-1 p-2">
          {events.map((event) => (
            <EventTimelineItem
              key={event.uuid}
              event={event}
              isActive={event.uuid === activeEventUuid}
              onClick={() => handleEventClick(event)}
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

**Test File:** `src/renderer/src/features/sessions/components/EventTimeline.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EventTimeline } from './EventTimeline'
import { MOCK_TIMELINE_EVENTS } from './types'

// Mock EventTimelineItem to simplify tests
vi.mock('./EventTimelineItem', () => ({
  EventTimelineItem: ({ event, onClick, isActive }: any) => (
    <button
      data-testid={`event-${event.uuid}`}
      data-active={isActive}
      onClick={onClick}
    >
      {event.summary}
    </button>
  )
}))

describe('EventTimeline', () => {
  it('renders list of EventTimelineItems', () => {
    const handleClick = vi.fn()
    render(
      <EventTimeline events={MOCK_TIMELINE_EVENTS} onEventClick={handleClick} />
    )

    expect(screen.getByTestId('event-evt-001')).toBeInTheDocument()
    expect(screen.getByTestId('event-evt-002')).toBeInTheDocument()
    expect(screen.getByTestId('event-evt-003')).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    const handleClick = vi.fn()
    render(<EventTimeline events={[]} onEventClick={handleClick} />)

    expect(screen.getByText('Events will appear as the conversation progresses.')).toBeInTheDocument()
  })

  it('highlights active event', () => {
    const handleClick = vi.fn()
    render(
      <EventTimeline
        events={MOCK_TIMELINE_EVENTS}
        onEventClick={handleClick}
        activeEventUuid="evt-002"
      />
    )

    expect(screen.getByTestId('event-evt-002')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('event-evt-001')).toHaveAttribute('data-active', 'false')
  })

  it('calls onEventClick with correct uuid', () => {
    const handleClick = vi.fn()
    render(
      <EventTimeline events={MOCK_TIMELINE_EVENTS} onEventClick={handleClick} />
    )

    fireEvent.click(screen.getByTestId('event-evt-001'))
    expect(handleClick).toHaveBeenCalledWith('evt-001')
  })

  it('calls onSubAgentClick for sub_agent events', () => {
    const handleEventClick = vi.fn()
    const handleSubAgentClick = vi.fn()
    render(
      <EventTimeline
        events={MOCK_TIMELINE_EVENTS}
        onEventClick={handleEventClick}
        onSubAgentClick={handleSubAgentClick}
      />
    )

    // evt-004 is a sub_agent type
    fireEvent.click(screen.getByTestId('event-evt-004'))
    expect(handleSubAgentClick).toHaveBeenCalledWith(MOCK_TIMELINE_EVENTS[3])
    expect(handleEventClick).not.toHaveBeenCalled()
  })
})
```

---

#### Task 4: Create ThinkingIndicator Component (AC: 2)

**File:** `src/renderer/src/features/sessions/components/ThinkingIndicator.tsx`

```typescript
import { type ReactElement } from 'react'

/**
 * Animated thinking indicator shown while Claude is processing.
 * Displays "Thinking..." with sequential dot pulse animation.
 */
export function ThinkingIndicator(): ReactElement {
  return (
    <div
      className="thinking-indicator flex items-center py-3 px-4"
      role="status"
      aria-label="Claude is thinking"
    >
      <div className="flex items-center bg-[var(--bg-elevated)] rounded-lg px-4 py-2">
        <span className="text-sm text-[var(--text-muted)]">Thinking</span>
        <span className="thinking-dots ml-1 flex">
          <span className="dot text-[var(--text-muted)]">.</span>
          <span className="dot text-[var(--text-muted)]">.</span>
          <span className="dot text-[var(--text-muted)]">.</span>
        </span>
      </div>
    </div>
  )
}
```

**Test File:** `src/renderer/src/features/sessions/components/ThinkingIndicator.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThinkingIndicator } from './ThinkingIndicator'

describe('ThinkingIndicator', () => {
  it('renders "Thinking" text', () => {
    render(<ThinkingIndicator />)

    expect(screen.getByText('Thinking')).toBeInTheDocument()
  })

  it('has three dots', () => {
    render(<ThinkingIndicator />)

    const dots = screen.getAllByText('.')
    expect(dots).toHaveLength(3)
  })

  it('has role="status" for accessibility', () => {
    render(<ThinkingIndicator />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has accessible aria-label', () => {
    render(<ThinkingIndicator />)

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Claude is thinking'
    )
  })

  it('has thinking-indicator class for CSS animation', () => {
    render(<ThinkingIndicator />)

    const container = screen.getByRole('status')
    expect(container).toHaveClass('thinking-indicator')
  })

  it('has thinking-dots class for CSS animation', () => {
    render(<ThinkingIndicator />)

    const dotsContainer = screen.getByText('.').parentElement
    expect(dotsContainer).toHaveClass('thinking-dots')
  })
})
```

---

#### Task 5: Create LoadingIndicator Component (AC: 3)

**File:** `src/renderer/src/features/sessions/components/LoadingIndicator.tsx`

```typescript
import { type ReactElement } from 'react'

/**
 * Loading indicator shown when Claude Code child process is spawning.
 * Displays "Loading Claude Code..." with subtle fade pulse animation.
 */
export function LoadingIndicator(): ReactElement {
  return (
    <div
      className="loading-indicator flex items-center py-3 px-4"
      role="status"
      aria-label="Loading Claude Code"
    >
      <div className="flex items-center bg-[var(--bg-elevated)] rounded-lg px-4 py-2">
        <span className="text-sm text-[var(--text-muted)]">Loading Claude Code...</span>
      </div>
    </div>
  )
}
```

**Test File:** `src/renderer/src/features/sessions/components/LoadingIndicator.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingIndicator } from './LoadingIndicator'

describe('LoadingIndicator', () => {
  it('renders "Loading Claude Code..." text', () => {
    render(<LoadingIndicator />)

    expect(screen.getByText('Loading Claude Code...')).toBeInTheDocument()
  })

  it('has role="status" for accessibility', () => {
    render(<LoadingIndicator />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has accessible aria-label', () => {
    render(<LoadingIndicator />)

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Loading Claude Code'
    )
  })

  it('has loading-indicator class for CSS animation', () => {
    render(<LoadingIndicator />)

    const container = screen.getByRole('status')
    expect(container).toHaveClass('loading-indicator')
  })
})
```

---

#### Task 6: Add CSS Animations (AC: 2, 3, 4)

**File:** `src/renderer/src/assets/main.css`

Append after existing animations:

```css
/* ========================================
   Story 2b.4: Navigation and Loading States
   ======================================== */

/* Thinking dots animation - sequential pulse */
@keyframes thinking-dots {
  0%, 20% { opacity: 0.3; }
  50% { opacity: 1; }
  80%, 100% { opacity: 0.3; }
}

.thinking-indicator .thinking-dots .dot:nth-child(1) {
  animation: thinking-dots 1.4s ease-in-out infinite;
}

.thinking-indicator .thinking-dots .dot:nth-child(2) {
  animation: thinking-dots 1.4s ease-in-out 0.2s infinite;
}

.thinking-indicator .thinking-dots .dot:nth-child(3) {
  animation: thinking-dots 1.4s ease-in-out 0.4s infinite;
}

/* Fade pulse animation for loading indicator */
@keyframes fade-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.loading-indicator {
  animation: fade-pulse 2s ease-in-out infinite;
}

/* Running dots animation for sub-agent status badge */
.running-dots .dot:nth-child(1) {
  animation: thinking-dots 1.4s ease-in-out infinite;
}

.running-dots .dot:nth-child(2) {
  animation: thinking-dots 1.4s ease-in-out 0.2s infinite;
}

.running-dots .dot:nth-child(3) {
  animation: thinking-dots 1.4s ease-in-out 0.4s infinite;
}
```

---

#### Task 7: Update SubAgentBubble Running Animation (AC: 4)

**File:** `src/renderer/src/features/sessions/components/SubAgentBubble.tsx`

**Change:** Replace `animate-pulse` on status badge with animated dots.

**Verified Line Numbers (as of codebase state):**
- Lines 37-42: statusBadgeClass definition
- Line 44: statusText definition
- Line 69: Status badge render with `{statusText}`

Find statusBadgeClass and statusText definitions (lines 37-44):

```typescript
// BEFORE (lines 37-44):
const statusBadgeClass = cn(
  'text-xs px-2 py-0.5 rounded',
  status === 'running' && 'text-green-500 bg-green-500/10 animate-pulse',
  status === 'done' && 'text-[var(--text-muted)] bg-[var(--bg-base)]',
  status === 'error' && 'text-red-500 bg-red-500/10'
)

const statusText = status === 'running' ? 'Running...' : status === 'done' ? 'Done' : 'Error'
```

Replace with:

```typescript
// AFTER:
const statusBadgeClass = cn(
  'text-xs px-2 py-0.5 rounded flex items-center',
  status === 'running' && 'text-green-500 bg-green-500/10',
  status === 'done' && 'text-[var(--text-muted)] bg-[var(--bg-base)]',
  status === 'error' && 'text-red-500 bg-red-500/10'
)

// Running status shows animated dots instead of "Running..."
const renderStatusContent = (): ReactElement => {
  if (status === 'running') {
    return (
      <>
        <span>Running</span>
        <span className="running-dots ml-0.5 flex">
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </span>
      </>
    )
  }
  return <span>{status === 'done' ? 'Done' : 'Error'}</span>
}
```

And update the render (line 69 - inside the header div):

```typescript
// BEFORE (line 69):
<span className={cn(statusBadgeClass, 'ml-2 flex-shrink-0')}>{statusText}</span>

// AFTER:
<span className={cn(statusBadgeClass, 'ml-2 flex-shrink-0')}>{renderStatusContent()}</span>
```

**IMPORTANT:** Delete the `statusText` const since it's no longer used (prevents dead code).

**Update Test File:** `src/renderer/src/features/sessions/components/SubAgentBubble.test.tsx`

Add tests for running animation:

```typescript
describe('SubAgentBubble running animation', () => {
  it('shows animated dots when status is running', () => {
    render(
      <SubAgentBubble
        subAgent={{ ...MOCK_SUB_AGENTS[1], status: 'running' }}
      />
    )

    expect(screen.getByText('Running')).toBeInTheDocument()
    // Should have running-dots container with 3 dots
    const dotsContainer = document.querySelector('.running-dots')
    expect(dotsContainer).toBeInTheDocument()
    expect(dotsContainer?.querySelectorAll('.dot')).toHaveLength(3)
  })

  it('does not show animated dots when status is done', () => {
    render(
      <SubAgentBubble
        subAgent={{ ...MOCK_SUB_AGENTS[0], status: 'done' }}
      />
    )

    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(document.querySelector('.running-dots')).not.toBeInTheDocument()
  })

  it('does not show animated dots when status is error', () => {
    render(
      <SubAgentBubble
        subAgent={{ ...MOCK_SUB_AGENTS[2], status: 'error' }}
      />
    )

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(document.querySelector('.running-dots')).not.toBeInTheDocument()
  })
})
```

---

#### Task 8: Add Scroll-to-Event to ConversationView (AC: 1)

**File:** `src/renderer/src/features/sessions/components/ConversationView.tsx`

**Verified Line Numbers (as of codebase state):**
- Lines 27-29: Existing refs (viewportRef, isInitialMount, lastMessageCountRef)
- Lines 77-81: scrollToBottom function
- Lines 113-120: sessionId change effect
- Line 155: Message mapping starts

**Changes:**

1. Add messageRefs Map after existing refs (line 29):

```typescript
// After existing refs (lines 27-29):
const viewportRef = useRef<HTMLDivElement>(null)
const isInitialMount = useRef(true)
const lastMessageCountRef = useRef(messages.length)
// ADD after line 29:
const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
```

2. Add scrollToEvent callback after scrollToBottom (after line 81):

```typescript
// After scrollToBottom (lines 77-81):
const scrollToBottom = useCallback((): void => {
  if (viewportRef.current) {
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }
}, [])

// ADD after line 81:
/**
 * Scroll to a specific event/message in the conversation.
 * Browser handles smooth scroll timing (~300ms).
 */
const scrollToEvent = useCallback((eventUuid: string): void => {
  const element = messageRefs.current.get(eventUuid)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}, [])
```

3. Clear refs on sessionId change (update existing effect at lines 113-120):

```typescript
// Reset initial mount flag when sessionId changes (lines 113-120)
useEffect(() => {
  isInitialMount.current = true
  lastMessageCountRef.current = messages.length
  // Reset expanded tools and sub-agents when switching sessions
  setExpandedTools(new Set())
  setExpandedSubAgents(new Set())
  // ADD: Clear message refs when session changes
  messageRefs.current.clear()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset on sessionId change
}, [sessionId])
```

4. Add cleanup on component unmount (add new effect after debounce cleanup at lines 126-132):

```typescript
// ADD after line 132 (after the debounce cleanup effect):
// Cleanup message refs on unmount to prevent memory leaks
useEffect(() => {
  return () => {
    messageRefs.current.clear()
  }
}, [])
```

5. Wrap message rendering with ref assignment (in the map function starting at line 155):

For messages WITH tool blocks or sub-agents (the Fragment branch):
```typescript
// BEFORE (lines 172-209):
return (
  <Fragment key={msg.uuid}>
    {/* ... content ... */}
  </Fragment>
)

// AFTER: Wrap Fragment content in a div with ref:
return (
  <div
    key={msg.uuid}
    ref={(el) => el && messageRefs.current.set(msg.uuid, el)}
  >
    {/* Move Fragment content inside (remove Fragment, keep inner content) */}
    {msg.content && (
      <MessageBubble ... />
    )}
    {/* ... tool cards ... */}
    {/* ... sub-agent bubbles ... */}
  </div>
)
```

For regular messages WITHOUT tool blocks (the MessageBubble branch):
```typescript
// BEFORE (lines 213-220):
return (
  <MessageBubble
    key={msg.uuid}
    role={msg.role}
    content={msg.content}
    timestamp={msg.timestamp}
  />
)

// AFTER: Wrap in div with ref:
return (
  <div
    key={msg.uuid}
    ref={(el) => el && messageRefs.current.set(msg.uuid, el)}
  >
    <MessageBubble
      role={msg.role}
      content={msg.content}
      timestamp={msg.timestamp}
    />
  </div>
)
```

6. Export scrollToEvent via component props (for future RightPanelContent integration in Story 2c.3):

Update the interface:

```typescript
export interface ConversationViewProps {
  messages: ConversationMessage[]
  sessionId: string
  /** Optional: callback to receive scrollToEvent function for external navigation */
  onScrollToEventReady?: (scrollFn: (uuid: string) => void) => void
}
```

Add effect to expose the function:
```typescript
// Add after the scrollToEvent definition:
useEffect(() => {
  onScrollToEventReady?.(scrollToEvent)
}, [onScrollToEventReady, scrollToEvent])
```

---

#### Task 9: Integrate Indicators into ConversationView (AC: 2, 3)

**File:** `src/renderer/src/features/sessions/components/ConversationView.tsx`

**Changes:**

1. Update imports (add after existing imports at top of file):

```typescript
import { ThinkingIndicator } from './ThinkingIndicator'
import { LoadingIndicator } from './LoadingIndicator'
import type { SessionState } from '@renderer/shared/store/useUIStore'
```

2. Update props interface (combines with Task 8 additions):

```typescript
export interface ConversationViewProps {
  messages: ConversationMessage[]
  sessionId: string
  /** Session state for indicator display - use SessionState type from useUIStore */
  sessionState?: SessionState
  /** Optional: callback to receive scrollToEvent function */
  onScrollToEventReady?: (scrollFn: (uuid: string) => void) => void
}
```

3. Destructure sessionState with default and add local state for streaming detection:

```typescript
// Update function signature to destructure sessionState:
export function ConversationView({
  messages,
  sessionId,
  sessionState = 'idle',
  onScrollToEventReady
}: ConversationViewProps): ReactElement {

// After existing state declarations (around line 36):
const [expandedSubAgents, setExpandedSubAgents] = useState<Set<string>>(new Set())
// ADD:
const [hasFirstStreamEvent, setHasFirstStreamEvent] = useState(false)
```

4. Reset streaming state on sessionId change (add to existing effect):

```typescript
useEffect(() => {
  isInitialMount.current = true
  lastMessageCountRef.current = messages.length
  setExpandedTools(new Set())
  setExpandedSubAgents(new Set())
  messageRefs.current.clear()
  setHasFirstStreamEvent(false) // ADD: Reset streaming state
}, [sessionId])
```

5. Detect first stream event when messages change (add new effect):

```typescript
// ADD after the sessionId change effect:
// Detect first stream event to transition from Loading to Thinking indicator
useEffect(() => {
  // When new messages arrive while working, we've received first stream event
  if (sessionState === 'working' && messages.length > lastMessageCountRef.current) {
    setHasFirstStreamEvent(true)
  }
}, [messages.length, sessionState])
```

6. Add indicator rendering at end of messages list (inside the flex container, after message rendering):

```typescript
<div className="flex flex-col space-y-4 p-4">
  {messages.length === 0 ? (
    // ... empty state (lines 150-153)
  ) : (
    // ... message rendering (lines 155-221)
  )}

  {/* ADD: Loading and Thinking Indicators - render at end of messages */}
  {sessionState === 'working' && !hasFirstStreamEvent && <LoadingIndicator />}
  {sessionState === 'working' && hasFirstStreamEvent && <ThinkingIndicator />}
</div>
```

**IMPORTANT - Update MiddlePanelContent.tsx:**

The ConversationView is rendered from MiddlePanelContent.tsx (line 38). Must update to pass sessionState prop:

**File:** `src/renderer/src/core/shell/MiddlePanelContent.tsx`

```typescript
// Line 38 BEFORE:
<ConversationView messages={mockMessages} sessionId={activeTab.sessionId} />

// Line 38 AFTER:
<ConversationView
  messages={mockMessages}
  sessionId={activeTab.sessionId}
  sessionState={activeTab.sessionState}
/>
```

This ensures the sessionState from the tab (managed by useUIStore) is passed to ConversationView for indicator display.

---

#### Task 10: Update Barrel File Exports (AC: all)

**File:** `src/renderer/src/features/sessions/components/index.ts`

Add exports:

```typescript
// Story 2b.4: Navigation and Loading States
export { EventTimelineItem } from './EventTimelineItem'
export type { EventTimelineItemProps } from './EventTimelineItem'
export { EventTimeline } from './EventTimeline'
export type { EventTimelineProps } from './EventTimeline'
export { ThinkingIndicator } from './ThinkingIndicator'
export { LoadingIndicator } from './LoadingIndicator'
export type { TimelineEvent } from './types'
export { MOCK_TIMELINE_EVENTS } from './types'
```

---

#### Task 11: Final Validation (AC: all)

Run validation:

```bash
npm run validate
```

Verify:
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Linting passes
- [ ] EventTimeline renders with mock data
- [ ] ThinkingIndicator shows animated dots
- [ ] LoadingIndicator shows fade pulse
- [ ] SubAgentBubble running state shows animated dots

### Acceptance Criteria

| AC | Criteria | Implementation |
|----|----------|----------------|
| 1 | Event timeline with navigation | EventTimeline + EventTimelineItem + scrollToEvent |
| 2 | Thinking indicator with animated dots | ThinkingIndicator + CSS animation |
| 3 | Loading indicator with fade pulse | LoadingIndicator + CSS animation |
| 4 | Sub-agent running animation | SubAgentBubble update + running-dots CSS |

## Additional Context

### Dependencies

**Already Installed (verified in codebase):**
- `@radix-ui/react-scroll-area` - Used in ConversationView.tsx
- `lucide-react` - Used in SubAgentBubble.tsx, ToolCallCard.tsx
- Tailwind CSS v4 - Styling
- `vitest` + `@testing-library/react` - Testing
- `zustand` - State management

**Existing Utilities (REUSE):**
- `cn` - `src/renderer/src/shared/utils/cn.ts`
- `formatTokenCount` - `src/renderer/src/shared/utils/formatTokenCount.ts`
- `formatMessageTimestamp` - `src/renderer/src/shared/utils/formatMessageTimestamp.ts`

### Testing Strategy

**Component Tests:**
- EventTimelineItem: Alignment, styling, click handling, accessibility
- EventTimeline: List rendering, empty state, active highlighting, sub-agent click handling
- ThinkingIndicator: Text, dots, CSS classes, accessibility
- LoadingIndicator: Text, CSS classes, accessibility
- ConversationView: Indicator state transitions, scrollToEvent functionality
- SubAgentBubble: Running animation with sequential dots

**Test Patterns:**
- Use `@testing-library/react` for component tests
- Use `vi.mock()` to mock utilities (formatTokenCount, formatMessageTimestamp)
- Use fixed timestamps (1737640000000) for reproducible tests

### Performance Considerations

- NFR3: Sub-agent expansion < 100ms (client-side only)
- Scroll animation: Browser handles timing (~300ms smooth scroll)
- CSS animations: GPU-accelerated (opacity only)
- EventTimeline: No virtualization needed for MVP (< 100 events typical)

### Notes

**MVP Considerations:**
- EventTimeline integration into RightPanelContent is Story 2c.3
- Loading->Thinking transition logic will be refined in Epic 3b when real streaming is implemented
- Bi-directional scroll sync (timeline highlighting from scroll) deferred to 2c.3

**File Structure (New Files):**
```
src/renderer/src/features/sessions/components/
├── EventTimelineItem.tsx
├── EventTimelineItem.test.tsx
├── EventTimeline.tsx
├── EventTimeline.test.tsx
├── ThinkingIndicator.tsx
├── ThinkingIndicator.test.tsx
├── LoadingIndicator.tsx
└── LoadingIndicator.test.tsx
```

**Modified Files:**
- `types.ts` - Add TimelineEvent type
- `index.ts` - Export new components
- `ConversationView.tsx` - Add indicators and scrollToEvent
- `ConversationView.test.tsx` - Add indicator state transition tests
- `SubAgentBubble.tsx` - Update running animation
- `SubAgentBubble.test.tsx` - Add running animation tests
- `main.css` - Add CSS animations
- `MiddlePanelContent.tsx` - Pass sessionState prop to ConversationView

## Tech Spec Review Record

### Review Date
2026-01-23

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Create-Tech-Spec Adversarial Review

### Review Outcome
**APPROVED WITH FIXES** - All identified issues have been corrected. Spec is ready for development.

### Issues Found and Fixed

#### CRITICAL Issues: 0

#### HIGH Issues (2 - fixed)

**F1: Task 7 SubAgentBubble line number references incorrect**
- Problem: Task 7 stated "Find line 37-44" without verifying actual codebase line numbers, and referenced "line 69" for render update
- Impact: Developer would search for wrong code sections, causing confusion
- Fix: Updated Task 7 with verified line numbers (37-42 for statusBadgeClass, 44 for statusText, 69 for status display) and added explicit "Verified Line Numbers" section

**F2: ConversationView line number references stale**
- Problem: Task 8 referenced line numbers that didn't match actual codebase state
- Impact: Developer would struggle to locate correct code sections
- Fix: Updated Task 8 with verified line numbers and explicit "Verified Line Numbers" section

#### MEDIUM Issues (4 - fixed)

**F3: Missing MiddlePanelContent.tsx update for sessionState prop**
- Problem: Task 9 added sessionState prop to ConversationViewProps but didn't mention updating MiddlePanelContent.tsx (which renders ConversationView)
- Impact: Indicator integration would be incomplete - sessionState would never be passed
- Fix: Added MiddlePanelContent.tsx to files_to_modify list and added explicit update instructions in Task 9

**F4: EventTimelineItem test had incorrect mock for formatTokenCount**
- Problem: Mock returned `${count}tok` but actual utility returns "1.2k" format for 1200 tokens
- Impact: Test expectation `expect(screen.getByText('1200tok'))` would fail against real utility
- Fix: Updated mock to match actual utility behavior and changed test expectation to "1.2k"

**F5: sessionState prop type defined inline instead of importing SessionState**
- Problem: Task 9 defined `sessionState?: 'idle' | 'working' | 'error'` inline instead of using existing SessionState type
- Impact: Type duplication, potential drift from canonical type definition
- Fix: Updated to import and use `SessionState` from useUIStore

**F6: Missing cleanup for messageRefs on unmount**
- Problem: Task 8 cleared refs on sessionId change but didn't mention cleanup on component unmount
- Impact: Potential memory leak if refs hold DOM elements when component unmounts
- Fix: Added explicit unmount cleanup effect in Task 8

#### LOW Issues (2 - fixed)

**F7: Empty state text inconsistency**
- Problem: EventTimeline empty state said "Events will appear as conversation progresses." (missing "the")
- Impact: Minor UI text inconsistency with ConversationView empty state
- Fix: Changed to "Events will appear as the conversation progresses."

**F8: Files to Reference table had outdated SubAgentBubble description**
- Problem: Table said "(line 39 has animate-pulse)" but actual code has statusBadgeClass at lines 37-42
- Impact: Misleading reference for developer
- Fix: Updated to "(lines 37-44 have statusBadgeClass/statusText)"

### Verification Checklist
- [x] All HIGH issues resolved
- [x] All MEDIUM issues resolved
- [x] All LOW issues resolved
- [x] Line number references verified against actual codebase
- [x] Modified files list complete (includes MiddlePanelContent.tsx)
- [x] Test expectations match actual utility behavior
- [x] Type definitions use canonical types where available
- [x] Memory cleanup patterns complete
