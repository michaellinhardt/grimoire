---
title: 'Sub-Agent Display'
slug: '2b-3-sub-agent-display'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Radix UI', 'Zustand', 'Tailwind CSS v4', 'lucide-react']
files_to_modify:
  - 'src/renderer/src/features/sessions/components/types.ts'
  - 'src/renderer/src/features/sessions/components/index.ts'
  - 'src/renderer/src/features/sessions/components/ConversationView.tsx'
  - 'src/renderer/src/shared/store/useUIStore.ts'
  - 'src/renderer/src/shared/store/useUIStore.test.ts'
  - 'src/renderer/src/core/shell/TabBar.tsx'
  - 'src/renderer/src/assets/main.css'
files_to_create:
  - 'src/renderer/src/features/sessions/components/SubAgentBubble.tsx'
  - 'src/renderer/src/features/sessions/components/SubAgentBubble.test.tsx'
code_patterns:
  - 'Radix Collapsible for expand/collapse'
  - 'cn() utility for conditional classes'
  - 'lucide-react icons'
  - 'Zustand store actions'
  - 'Fragment-based message rendering'
test_patterns:
  - '@testing-library/react for component tests'
  - 'vi.mock() for store mocking'
  - 'Fixed timestamps for reproducible tests'
---

# Tech-Spec: Sub-Agent Display (Story 2b.3)

**Created:** 2026-01-23

## Overview

### Problem Statement

When Claude Code spawns sub-agents to handle complex tasks, users need visibility into what these agents are doing without losing context of the main conversation. Currently, there's no way to view sub-agent activity - they appear as opaque Task tool calls.

### Solution

Implement SubAgentBubble component that displays sub-agents as collapsible nested conversations with:
- Collapsed state showing agent icon, name, status badge, and open-in-tab action
- Expanded state showing conversation summary (message count, tool count)
- Dedicated tab view for full sub-agent conversations with purple-tinted styling

### Scope

**In Scope:**
- SubAgentBubble component with collapsed/expanded states
- Status badge display (Running/Done/Error) with appropriate styling
- Open-in-tab functionality via openSubAgentTab action in useUIStore
- Sub-agent tab styling (.tab--subagent with purple tint)
- Integration into ConversationView with mock data
- Tab label format: `{agentType}-{shortId}`

**Out of Scope:**
- Full sub-agent conversation loading from JSONL (Epic 3b)
- Real-time streaming for running sub-agents (Epic 3b)
- Event Timeline integration for sub-agent clicks (Story 2c.3)
- Sub-agent conversation navigation/filtering
- Sub-agent index building from session data (covered in Epic 2a)

## Context for Development

### Codebase Patterns

**Component Organization (from Story 2b.2):**
- PascalCase files: `SubAgentBubble.tsx`
- Colocated tests: `SubAgentBubble.test.tsx` beside source
- Feature folder: `src/renderer/src/features/sessions/components/`

**Existing Components to Reference:**
- `ToolCallCard.tsx` - Collapsible card pattern with Radix Collapsible
- `MessageBubble.tsx` - Styling patterns and CSS variable usage
- `ConversationView.tsx` - Integration target, handles tool cards similarly

**Existing Utilities (DO NOT RECREATE):**
- `cn()` from `@renderer/shared/utils/cn` - Conditional class merging
- `formatToolSummary` from `@renderer/shared/utils/formatToolSummary` - Tool summary formatting
- `findToolResult`, `isToolError`, `getErrorPreview` from `@renderer/shared/utils/pairToolCalls`

**Existing CSS Classes (DO NOT RECREATE):**
- `.collapsible-content` in main.css - Radix Collapsible animation (slideDown/slideUp)
- `.tab--working` and `.tab--error` - Tab state indicators pattern

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/features/sessions/components/ToolCallCard.tsx` | Reference for collapsible card pattern |
| `src/renderer/src/features/sessions/components/types.ts` | Type definitions to extend |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Integration target |
| `src/renderer/src/shared/store/useUIStore.ts` | Tab management, add openSubAgentTab action |
| `src/renderer/src/core/shell/TabBar.tsx` | Tab styling, add subagent type check |
| `src/renderer/src/assets/main.css` | CSS classes, add .tab--subagent |

### Technical Decisions

1. **Radix Collapsible for expand/collapse** - Already used in ToolCallCard, consistent UX
2. **lucide-react icons** - Bot (agent icon), ChevronRight (expand), ExternalLink (open in tab)
3. **Purple color scheme for sub-agents** - Distinguishes from blue tool calls
4. **Tab type already defined** - `type: 'subagent'` exists in Tab interface, just needs styling
5. **Controlled expansion state** - Parent (ConversationView) manages via Set<string>

## Implementation Plan

### Tasks

**Task 1: Add SubAgentBlock type to types.ts**

File: `src/renderer/src/features/sessions/components/types.ts`

Add after existing type definitions:

```typescript
// ========================================
// Story 2b.3: Sub-Agent Display Types
// ========================================

/**
 * Sub-agent block representing a spawned child agent
 */
export interface SubAgentBlock {
  type: 'sub_agent'
  /** Sub-agent session ID (full UUID) */
  id: string
  /** Agent type from spawn (e.g., 'Explore', 'Bash', 'Task') */
  agentType: string
  /** Human-readable label for display */
  label: string
  /** UUID of parent message that spawned this agent */
  parentMessageUuid: string
  /** File path to sub-agent conversation JSONL */
  path: string
  /** Current status of the sub-agent */
  status: 'running' | 'done' | 'error'
  /** Total messages in sub-agent conversation (optional, for summary) */
  messageCount?: number
  /** Total tool calls in sub-agent conversation (optional, for summary) */
  toolCount?: number
  /** Brief summary of what the agent accomplished (optional) */
  summary?: string
}
```

Extend ConversationMessage interface (add after existing fields):

```typescript
export interface ConversationMessage {
  // ... existing fields ...
  /** Optional sub-agent blocks for assistant messages */
  subAgentBlocks?: SubAgentBlock[]
}
```

Add mock data:

```typescript
/**
 * Mock sub-agents for development and testing
 */
export const MOCK_SUB_AGENTS: SubAgentBlock[] = [
  {
    type: 'sub_agent',
    id: 'subagent-001-a8b2c3d4',
    agentType: 'Explore',
    label: 'Code Analysis Agent',
    parentMessageUuid: 'msg-001',
    path: '/.claude/sub-agents/subagent-001-a8b2c3d4.jsonl',
    status: 'done',
    messageCount: 8,
    toolCount: 5,
    summary: 'Analyzed authentication module. Found 3 security concerns in login flow.'
  },
  {
    type: 'sub_agent',
    id: 'subagent-002-f3c1e9a7',
    agentType: 'Task',
    label: 'Refactoring Assistant',
    parentMessageUuid: 'msg-002',
    path: '/.claude/sub-agents/subagent-002-f3c1e9a7.jsonl',
    status: 'running',
    messageCount: 3,
    toolCount: 2
  },
  {
    type: 'sub_agent',
    id: 'subagent-003-d4e5f6a1',
    agentType: 'Bash',
    label: 'Build Agent',
    parentMessageUuid: 'msg-003',
    path: '/.claude/sub-agents/subagent-003-d4e5f6a1.jsonl',
    status: 'error',
    messageCount: 2,
    toolCount: 1,
    summary: 'Build failed: npm ERR! missing dependency'
  }
]

/**
 * Mock messages with sub-agents for development and testing
 */
export const MOCK_MESSAGES_WITH_SUB_AGENTS: ConversationMessage[] = [
  {
    uuid: 'msg-sa-001',
    role: 'user',
    content: 'Can you analyze the authentication code and find any security issues?',
    timestamp: 1737640000000
  },
  {
    uuid: 'msg-sa-002',
    role: 'assistant',
    content: "I'll spawn an analysis agent to examine the auth module thoroughly.",
    timestamp: 1737640060000,
    subAgentBlocks: [MOCK_SUB_AGENTS[0]]
  },
  {
    uuid: 'msg-sa-003',
    role: 'assistant',
    content: 'The analysis is complete. Here are the findings from the Code Analysis Agent:',
    timestamp: 1737640360000
  }
]
```

---

**Task 2: Create SubAgentBubble component**

File: `src/renderer/src/features/sessions/components/SubAgentBubble.tsx`

```typescript
import { type ReactElement } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Bot, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import type { SubAgentBlock } from './types'

export interface SubAgentBubbleProps {
  /** Sub-agent data block */
  subAgent: SubAgentBlock
  /** Whether the bubble is expanded showing summary */
  isExpanded?: boolean
  /** Callback to toggle expanded state */
  onToggle?: () => void
  /** Callback to open sub-agent in dedicated tab */
  onOpenInTab?: () => void
}

/**
 * Renders a sub-agent as a collapsible bubble with inline summary and open-in-tab action.
 *
 * @param subAgent - Sub-agent data block
 * @param isExpanded - Whether the bubble is expanded showing summary
 * @param onToggle - Callback to toggle expanded state
 * @param onOpenInTab - Callback to open sub-agent in dedicated tab
 * @returns A styled sub-agent bubble element
 */
export function SubAgentBubble({
  subAgent,
  isExpanded = false,
  onToggle,
  onOpenInTab
}: SubAgentBubbleProps): ReactElement {
  const { status } = subAgent

  const statusBadgeClass = cn(
    'text-xs px-2 py-0.5 rounded flex-shrink-0',
    status === 'running' && 'text-green-500 bg-green-500/10 animate-pulse',
    status === 'done' && 'text-[var(--text-muted)] bg-[var(--bg-base)]',
    status === 'error' && 'text-red-500 bg-red-500/10'
  )

  const statusText = status === 'running' ? 'Running...' : status === 'done' ? 'Done' : 'Error'

  return (
    <Collapsible.Root open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          'rounded-lg border-l-2 border-purple-500 bg-purple-500/10',
          'hover:bg-purple-500/15 transition-colors'
        )}
      >
        {/* Header - always visible */}
        <div className="flex items-center justify-between p-3 group">
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="flex items-center flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`${subAgent.label || subAgent.agentType + ' Agent'}, status: ${statusText}`}
            >
              <Bot
                className="h-4 w-4 text-purple-400 mr-2 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="font-medium text-[var(--text-primary)] truncate">
                {subAgent.label || `${subAgent.agentType} Agent`}
              </span>
              <span className={statusBadgeClass + ' ml-2'}>
                {statusText}
              </span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 ml-auto text-[var(--text-muted)] transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
                aria-hidden="true"
              />
            </button>
          </Collapsible.Trigger>

          {/* Open in tab button - visible on hover or when expanded */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenInTab?.()
            }}
            className={cn(
              'ml-2 p-1 rounded hover:bg-purple-500/20 transition-opacity cursor-pointer',
              'opacity-0 group-hover:opacity-100',
              isExpanded && 'opacity-100',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:opacity-100'
            )}
            title="Open in new tab"
            aria-label="Open sub-agent in new tab"
          >
            <ExternalLink className="h-4 w-4 text-purple-400" aria-hidden="true" />
          </button>
        </div>

        {/* Expanded content */}
        <Collapsible.Content className="collapsible-content overflow-hidden">
          <div className="px-3 pb-3 border-t border-purple-500/20">
            {/* Summary stats */}
            <div className="text-xs text-[var(--text-muted)] py-2">
              {subAgent.messageCount ?? '?'} messages, {subAgent.toolCount ?? '?'} tool calls
            </div>

            {/* Conversation summary - simplified view */}
            {subAgent.summary && (
              <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-base)] rounded p-2">
                {subAgent.summary}
              </div>
            )}

            {/* Note for when no summary is available */}
            {!subAgent.summary && (
              <div className="text-xs text-[var(--text-muted)] italic">
                Click the external link icon to view full conversation.
              </div>
            )}
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  )
}
```

---

**Task 3: Create SubAgentBubble tests**

File: `src/renderer/src/features/sessions/components/SubAgentBubble.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubAgentBubble } from './SubAgentBubble'
import { MOCK_SUB_AGENTS } from './types'

describe('SubAgentBubble', () => {
  const mockOnToggle = vi.fn()
  const mockOnOpenInTab = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('collapsed state', () => {
    it('renders agent icon and label', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
          onToggle={mockOnToggle}
          onOpenInTab={mockOnOpenInTab}
        />
      )

      expect(screen.getByText('Code Analysis Agent')).toBeInTheDocument()
    })

    it('renders "Done" status badge for done agents', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
        />
      )

      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('renders "Running..." status badge with animation for running agents', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[1]}
          isExpanded={false}
        />
      )

      const badge = screen.getByText('Running...')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('animate-pulse')
    })

    it('renders "Error" status badge for error agents', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[2]}
          isExpanded={false}
        />
      )

      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('shows open-in-tab button', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
          onOpenInTab={mockOnOpenInTab}
        />
      )

      expect(screen.getByLabelText('Open sub-agent in new tab')).toBeInTheDocument()
    })

    it('uses default label when label is empty', () => {
      const agentWithoutLabel = {
        ...MOCK_SUB_AGENTS[0],
        label: ''
      }

      render(
        <SubAgentBubble
          subAgent={agentWithoutLabel}
          isExpanded={false}
        />
      )

      expect(screen.getByText('Explore Agent')).toBeInTheDocument()
    })
  })

  describe('expanded state', () => {
    it('shows message and tool count', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={true}
        />
      )

      expect(screen.getByText('8 messages, 5 tool calls')).toBeInTheDocument()
    })

    it('shows summary when available', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={true}
        />
      )

      expect(screen.getByText(/Analyzed authentication module/)).toBeInTheDocument()
    })

    it('shows placeholder when no summary available', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[1]}
          isExpanded={true}
        />
      )

      expect(screen.getByText(/Click the external link icon/)).toBeInTheDocument()
    })

    it('rotates chevron when expanded', () => {
      const { container } = render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={true}
        />
      )

      // ChevronRight should have rotate-90 class when expanded
      const chevron = container.querySelector('.rotate-90')
      expect(chevron).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onToggle when clicking header', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
          onToggle={mockOnToggle}
          onOpenInTab={mockOnOpenInTab}
        />
      )

      const trigger = screen.getByRole('button', { name: /Code Analysis Agent/ })
      fireEvent.click(trigger)

      expect(mockOnToggle).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenInTab when clicking external link button', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
          onToggle={mockOnToggle}
          onOpenInTab={mockOnOpenInTab}
        />
      )

      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      fireEvent.click(openButton)

      expect(mockOnOpenInTab).toHaveBeenCalledTimes(1)
      // Should not trigger toggle
      expect(mockOnToggle).not.toHaveBeenCalled()
    })

    it('does not call onToggle when clicking open-in-tab button', () => {
      render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
          onToggle={mockOnToggle}
          onOpenInTab={mockOnOpenInTab}
        />
      )

      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      fireEvent.click(openButton)

      expect(mockOnToggle).not.toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('applies purple border and background', () => {
      const { container } = render(
        <SubAgentBubble
          subAgent={MOCK_SUB_AGENTS[0]}
          isExpanded={false}
        />
      )

      const bubble = container.querySelector('.border-purple-500')
      expect(bubble).toBeInTheDocument()
      expect(bubble).toHaveClass('bg-purple-500/10')
    })
  })
})
```

---

**Task 4: Add openSubAgentTab action to useUIStore**

File: `src/renderer/src/shared/store/useUIStore.ts`

Add import at top:

```typescript
import type { SubAgentBlock } from '@renderer/features/sessions/components/types'
```

Add to UIState interface (after existing actions):

```typescript
interface UIState {
  // ... existing properties and actions ...

  // Sub-agent tab management (Story 2b.3)
  openSubAgentTab: (subAgent: SubAgentBlock) => void
}
```

Add implementation to store (after clearScrollPosition):

```typescript
openSubAgentTab: (subAgent) =>
  set((state) => {
    // Check if sub-agent tab already open
    const existing = state.tabs.find(
      (t) => t.type === 'subagent' && t.sessionId === subAgent.id
    )
    if (existing) {
      return { activeTabId: existing.id }
    }

    // Create new sub-agent tab
    const shortId = subAgent.id.slice(-4)
    const title = `${subAgent.agentType}-${shortId}`

    const newTab: Tab = {
      id: `subagent-${subAgent.id}`,
      type: 'subagent',
      title,
      sessionId: subAgent.id,
      sessionState:
        subAgent.status === 'running' ? 'working' :
        subAgent.status === 'error' ? 'error' : 'idle'
    }

    return {
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id
    }
  }),
```

---

**Task 5: Add openSubAgentTab tests**

File: `src/renderer/src/shared/store/useUIStore.test.ts`

Add import at top of file (with existing imports):

```typescript
import type { SubAgentBlock } from '@renderer/features/sessions/components/types'
```

Add this describe block INSIDE the main `describe('useUIStore', () => { ... })` block, after the existing describe blocks. This ensures the shared `beforeEach` resets store state before each test:

```typescript
// Add inside the main describe('useUIStore', ...) block
// The parent beforeEach resets state: tabs: [], activeTabId: null, etc.

describe('openSubAgentTab (Story 2b.3)', () => {
  const mockSubAgent: SubAgentBlock = {
    type: 'sub_agent',
    id: 'subagent-001-a8b2c3d4',
    agentType: 'Explore',
    label: 'Code Analysis Agent',
    parentMessageUuid: 'msg-001',
    path: '/.claude/sub-agents/subagent-001-a8b2c3d4.jsonl',
    status: 'done',
    messageCount: 8,
    toolCount: 5
  }

  it('creates new tab with type subagent', () => {
    const { openSubAgentTab, tabs } = useUIStore.getState()

    openSubAgentTab(mockSubAgent)

    const state = useUIStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].type).toBe('subagent')
  })

  it('sets tab title to agentType-shortId format', () => {
    const { openSubAgentTab } = useUIStore.getState()

    openSubAgentTab(mockSubAgent)

    const state = useUIStore.getState()
    expect(state.tabs[0].title).toBe('Explore-c3d4')
  })

  it('sets sessionId to sub-agent ID', () => {
    const { openSubAgentTab } = useUIStore.getState()

    openSubAgentTab(mockSubAgent)

    const state = useUIStore.getState()
    expect(state.tabs[0].sessionId).toBe('subagent-001-a8b2c3d4')
  })

  it('focuses existing tab if sub-agent already open', () => {
    const { openSubAgentTab, addTab } = useUIStore.getState()

    // First open the sub-agent
    openSubAgentTab(mockSubAgent)

    // Open another tab to change focus
    addTab({ id: 'other-tab', type: 'session', title: 'Other' })

    // Open the same sub-agent again
    openSubAgentTab(mockSubAgent)

    const state = useUIStore.getState()
    // Should not create duplicate
    expect(state.tabs.filter(t => t.type === 'subagent')).toHaveLength(1)
    // Should focus the existing tab
    expect(state.activeTabId).toBe('subagent-subagent-001-a8b2c3d4')
  })

  it('sets sessionState to working for running sub-agents', () => {
    const runningAgent: SubAgentBlock = {
      ...mockSubAgent,
      status: 'running'
    }

    const { openSubAgentTab } = useUIStore.getState()
    openSubAgentTab(runningAgent)

    const state = useUIStore.getState()
    expect(state.tabs[0].sessionState).toBe('working')
  })

  it('sets sessionState to error for error sub-agents', () => {
    const errorAgent: SubAgentBlock = {
      ...mockSubAgent,
      status: 'error'
    }

    const { openSubAgentTab } = useUIStore.getState()
    openSubAgentTab(errorAgent)

    const state = useUIStore.getState()
    expect(state.tabs[0].sessionState).toBe('error')
  })

  it('sets sessionState to idle for done sub-agents', () => {
    const { openSubAgentTab } = useUIStore.getState()
    openSubAgentTab(mockSubAgent) // status: 'done'

    const state = useUIStore.getState()
    expect(state.tabs[0].sessionState).toBe('idle')
  })

  it('makes the new tab active', () => {
    const { openSubAgentTab } = useUIStore.getState()

    openSubAgentTab(mockSubAgent)

    const state = useUIStore.getState()
    expect(state.activeTabId).toBe('subagent-subagent-001-a8b2c3d4')
  })
})
```

---

**Task 6: Add .tab--subagent CSS class**

File: `src/renderer/src/assets/main.css`

Add CSS variable first (add to `:root` block, after `--accent-muted`):

```css
  /* Sub-agent accent - purple tint for sub-agent tabs */
  --subagent-bg: hsl(270, 30%, 12%);
  --subagent-bg-hover: hsl(270, 30%, 16%);
```

Then add after existing tab state indicators (after `.tab--error::before`):

```css
/* Sub-agent tab - purple tint background (Story 2b.3) */
.tab--subagent {
  background-color: var(--subagent-bg);
}

.tab--subagent:hover {
  background-color: var(--subagent-bg-hover);
}
```

**NOTE:** Using CSS variables ensures consistency with the design system and makes theming easier.

---

**Task 7: Update TabBar to apply sub-agent styling**

File: `src/renderer/src/core/shell/TabBar.tsx`

Update the className in the tab div (around line 98-106):

```typescript
className={cn(
  'group h-full px-3 flex items-center gap-2 border-r border-[var(--border)] cursor-pointer',
  'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset',
  tab.id === activeTabId &&
    'text-[var(--text-primary)] border-b-2 border-b-[var(--accent)]',
  tab.sessionState === 'working' && 'tab--working',
  tab.sessionState === 'error' && 'tab--error',
  tab.type === 'subagent' && 'tab--subagent'  // NEW: Sub-agent tab styling
)}
```

---

**Task 8: Update ConversationView to render SubAgentBubble**

File: `src/renderer/src/features/sessions/components/ConversationView.tsx`

Add imports:

```typescript
import { SubAgentBubble } from './SubAgentBubble'
import type { ConversationMessage, SubAgentBlock } from './types'
```

Update useUIStore import:

```typescript
import { useUIStore } from '@renderer/shared/store/useUIStore'
```

Add state for sub-agent expansion (after expandedTools state):

```typescript
// Track which sub-agent bubbles are expanded
const [expandedSubAgents, setExpandedSubAgents] = useState<Set<string>>(new Set())
```

Add toggle callback (after toggleTool):

```typescript
const toggleSubAgent = useCallback((agentId: string) => {
  setExpandedSubAgents((prev) => {
    const next = new Set(prev)
    if (next.has(agentId)) {
      next.delete(agentId)
    } else {
      next.add(agentId)
    }
    return next
  })
}, [])
```

Get openSubAgentTab from store:

```typescript
const { getScrollPosition, setScrollPosition, openSubAgentTab } = useUIStore()
```

Add handler for opening in tab:

```typescript
const handleOpenSubAgentInTab = useCallback(
  (subAgent: SubAgentBlock) => {
    openSubAgentTab(subAgent)
  },
  [openSubAgentTab]
)
```

Update sessionId reset effect to also reset expandedSubAgents:

```typescript
useEffect(() => {
  isInitialMount.current = true
  lastMessageCountRef.current = messages.length
  // Reset expanded tools and sub-agents when switching sessions
  setExpandedTools(new Set())
  setExpandedSubAgents(new Set())
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset on sessionId change, not messages
}, [sessionId])
```

Update the message rendering logic (replace the existing messages.map):

```typescript
messages.map((msg) => {
  // Check if message has tool use blocks or sub-agent blocks (assistant messages only)
  const hasToolBlocks = msg.role === 'assistant' && msg.toolUseBlocks && msg.toolUseBlocks.length > 0
  const hasSubAgentBlocks = msg.role === 'assistant' && msg.subAgentBlocks && msg.subAgentBlocks.length > 0

  if (hasToolBlocks || hasSubAgentBlocks) {
    // Determine which tools to render (filter out Task/Skill tools when sub-agents present)
    const toolsToRender = hasSubAgentBlocks
      ? (msg.toolUseBlocks ?? []).filter(
          (tool) => tool.name !== 'Task' && tool.name !== 'Skill'
        )
      : (msg.toolUseBlocks ?? [])

    return (
      <Fragment key={msg.uuid}>
        {/* Render text content first if present */}
        {msg.content && (
          <MessageBubble
            role="assistant"
            content={msg.content}
            timestamp={msg.timestamp}
          />
        )}
        {/* Render tool call cards (excluding Task/Skill when sub-agents present) */}
        {toolsToRender.map((tool) => (
          <ToolCallCard
            key={tool.id}
            toolCall={tool}
            result={findToolResult(tool.id, msg.toolResults)}
            isExpanded={expandedTools.has(tool.id)}
            onToggle={() => toggleTool(tool.id)}
          />
        ))}
        {/* Render sub-agent bubbles */}
        {msg.subAgentBlocks?.map((subAgent) => (
          <SubAgentBubble
            key={subAgent.id}
            subAgent={subAgent}
            isExpanded={expandedSubAgents.has(subAgent.id)}
            onToggle={() => toggleSubAgent(subAgent.id)}
            onOpenInTab={() => handleOpenSubAgentInTab(subAgent)}
          />
        ))}
        {/* Show timestamp for tool/agent-only messages (no text content) */}
        {!msg.content && (
          <span className="text-xs text-[var(--text-muted)] ml-1">
            {formatMessageTimestamp(msg.timestamp)}
          </span>
        )}
      </Fragment>
    )
  }

  // Regular message without tool or sub-agent blocks
  return (
    <MessageBubble
      key={msg.uuid}
      role={msg.role}
      content={msg.content}
      timestamp={msg.timestamp}
    />
  )
})
```

---

**Task 9: Update exports in index.ts**

File: `src/renderer/src/features/sessions/components/index.ts`

Add at the end:

```typescript
// Story 2b.3: Sub-Agent Display
export { SubAgentBubble } from './SubAgentBubble'
export type { SubAgentBubbleProps } from './SubAgentBubble'
export type { SubAgentBlock } from './types'
export { MOCK_SUB_AGENTS, MOCK_MESSAGES_WITH_SUB_AGENTS } from './types'
```

---

**Task 10: Final validation**

Run the following commands to verify implementation:

```bash
npm run validate  # tsc --noEmit && vitest run && npm run lint
```

Verify manually:
- Sub-agent bubbles render with purple styling (purple left border, purple-tinted background)
- Collapse/expand works correctly with smooth animation
- Status badges display correctly (Running with pulse animation, Done muted, Error red)
- Open-in-tab creates correct tab with type 'subagent'
- Sub-agent tabs have purple tint styling
- Clicking open-in-tab focuses existing tab if already open

### Acceptance Criteria

| AC | Description | Implementation |
|----|-------------|----------------|
| AC1 | Sub-agents appear with purple-tinted background, purple left border, [A] icon + agent name + status badge | SubAgentBubble component with cn() classes: `bg-purple-500/10`, `border-l-2 border-purple-500`, Bot icon, status badge |
| AC2 | Hover shows [up-right arrow] button, clicking opens sub-agent in dedicated tab | ExternalLink icon with `opacity-0 group-hover:opacity-100`, onOpenInTab callback |
| AC3 | Click expands inline showing summary, click header again collapses | Radix Collapsible, isExpanded state, onToggle callback |
| AC4 | Sub-agent tabs have purple-tinted background, label format "{agentType}-{shortId}" | `.tab--subagent` CSS class, openSubAgentTab action |
| AC5 | Timeline sub-agent click opens in tab | Stub only - interface prepared for Story 2c.3 integration |

## Additional Context

### Dependencies

**Already Installed (verified in package.json):**
- `@radix-ui/react-collapsible` - For expand/collapse animation
- `lucide-react` - For icons (Bot, ChevronRight, ExternalLink)
- `zustand` - State management
- `vitest` + `@testing-library/react` - Testing

**Existing Utilities (REUSE):**
- `cn` from `@renderer/shared/utils/cn`
- `findToolResult` from `@renderer/shared/utils/pairToolCalls`
- `formatMessageTimestamp` from `@renderer/shared/utils/formatMessageTimestamp`

### Testing Strategy

**Unit Tests:**
- SubAgentBubble renders collapsed state correctly
- SubAgentBubble renders expanded state with summary
- Status badges display correct styling (running/done/error)
- onToggle called when clicking header
- onOpenInTab called when clicking external link button
- stopPropagation prevents toggle when clicking open-in-tab

**Store Tests:**
- openSubAgentTab creates correct tab structure
- openSubAgentTab focuses existing tab if already open
- Tab title follows "{agentType}-{shortId}" format
- sessionState maps correctly from sub-agent status

**Integration Tests (ConversationView):**
- SubAgentBubble renders for messages with subAgentBlocks
- Task/Skill tool calls filtered when sub-agents present
- Expansion state managed separately from tool cards

### Performance Considerations

- NFR3: Sub-agent expansion < 100ms (client-side only, no IPC)
- Radix Collapsible animation is 200ms (consistent with existing patterns)
- Summary is pre-computed in SubAgentBlock, no runtime parsing
- Full conversation loaded only when opening dedicated tab

### Notes

**Timeline Integration (AC5):**
Story 2c.3 (Event Timeline) will add sub-agent events to the timeline. The `onSubAgentClick` handler should call the same `openSubAgentTab` action, ensuring consistent behavior between:
- Clicking [up-right arrow] button on SubAgentBubble
- Clicking sub-agent event in timeline (Story 2c.3)

**Sub-Agent Detection Logic:**
For MVP, if `subAgentBlocks` is present on a message, all `Task` and `Skill` tools in that message are assumed to be sub-agent spawns and are filtered from ToolCallCard rendering. Full tool-to-subagent ID matching deferred to Epic 3b when parsing real JSONL data.

**Agent Type Labels:**
| agentType | Display Label (when label is empty) |
|-----------|-------------------------------------|
| Explore | "Explore Agent" |
| Task | "Task Agent" |
| Bash | "Bash Agent" |
| Code | "Code Agent" |
| Research | "Research Agent" |
| default | "{agentType} Agent" |
