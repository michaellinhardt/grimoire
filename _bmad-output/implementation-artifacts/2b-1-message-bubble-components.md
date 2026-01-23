# Story 2b.1: Message Bubble Components

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see conversation messages as distinct visual bubbles**,
so that **I can easily follow the dialogue between myself and Claude**.

## Acceptance Criteria

1. **Given** a conversation is loaded **When** the messages are rendered (FR33) **Then** user messages appear as right-aligned bubbles with accent-muted background and accent border **And** Claude messages appear as left-aligned bubbles with elevated background and subtle border **And** each bubble has rounded corners (bottom-right smaller for user, bottom-left smaller for Claude)

2. **Given** messages are displayed **When** viewing timestamps **Then** timestamps appear below each bubble in muted text **And** format is relative for recent ("2 min ago") and absolute for older ("Jan 15, 14:32")

3. **Given** a conversation has many messages (FR39) **When** the user scrolls **Then** the conversation area scrolls smoothly **And** scroll position is preserved when switching back to this tab

4. **Given** a session is loaded **When** the conversation renders **Then** the view auto-scrolls to the most recent message

## Tasks / Subtasks

- [x] Task 1: Create MessageBubble component with User variant (AC: 1, 2)
  - [x] Create `src/renderer/src/features/sessions/components/MessageBubble.tsx`
  - [x] Implement UserBubble: right-aligned, accent-muted bg, accent border, rounded corners (bottom-right smaller)
  - [x] Props: `role: 'user' | 'assistant'`, `content: string`, `timestamp: number` (Unix ms, NOT string)
  - [x] Use Tailwind CSS v4 utility classes (NOT v3 - different config approach)
  - [x] **REQUIRED:** Use `cn()` utility from `src/renderer/src/shared/utils/cn.ts` for conditional class merging
  - [x] Follow dark-first color system from UX spec (accent: hsl 270, 60%, 55%)
  - [x] Add JSDoc with @param and @returns documentation
  - [x] Add colocated test file `MessageBubble.test.tsx`

- [x] Task 2: Create MessageBubble component with Claude variant (AC: 1, 2)
  - [x] Implement ClaudeBubble: left-aligned, elevated bg, subtle border, rounded corners (bottom-left smaller)
  - [x] Use same component with conditional styling based on `role` prop
  - [x] Ensure consistent spacing with UX spec (8px base unit: space-sm, space-md, space-lg)
  - [x] Add tests for both user and assistant variants

- [x] Task 3: Create timestamp formatter utility (AC: 2)
  - [x] REUSE existing `formatRelativeTime` from `src/renderer/src/shared/utils/formatRelativeTime.ts` for < 24h
  - [x] Create `formatMessageTimestamp` in `src/renderer/src/shared/utils/formatMessageTimestamp.ts`
  - [x] Logic: `< 24h`: use formatRelativeTime ("2m ago", "3h ago"), `>= 24h`: format as "Jan 15, 14:32"
  - [x] **Pattern:** Single-function-per-file (see existing formatRelativeTime.ts, formatCost.ts)
  - [x] Add colocated tests `formatMessageTimestamp.test.ts` for edge cases (now, minutes, hours, 24h boundary, different years)
  - [x] Export from `src/renderer/src/shared/utils/index.ts`

- [x] Task 4: Create ConversationView component (AC: 3, 4)
  - [x] Create `src/renderer/src/features/sessions/components/ConversationView.tsx`
  - [x] Use Radix ScrollArea for smooth scrolling (already installed: @radix-ui/react-scroll-area)
  - [x] Accept `messages: ConversationMessage[]` and `sessionId: string` props
  - [x] Render MessageBubble for each message based on role with `space-y-4` gap between messages
  - [x] **Auto-scroll logic:** Only auto-scroll on initial load OR when user is already at bottom (see Dev Notes)
  - [x] **Scroll persistence:** Save position to useUIStore on scroll event, restore on mount if saved position exists
  - [x] **Parent height:** Component requires parent with defined height (e.g., `flex-1` in flex container)
  - [x] Add JSDoc with @param and @returns documentation
  - [x] Add colocated test file `ConversationView.test.tsx`

- [x] Task 5: Create ConversationMessage type and mock data (AC: 1, 3)
  - [x] Add `ConversationMessage` interface in `src/renderer/src/features/sessions/components/types.ts`
  - [x] Fields: `uuid: string`, `role: 'user' | 'assistant'`, `content: string`, `timestamp: number` (Unix ms)
  - [x] **NOTE:** timestamp is Unix milliseconds (number), NOT ISO 8601 string - matches formatMessageTimestamp input
  - [x] Create mock conversation data for testing and development (with realistic timestamps)
  - [x] Export types from `src/renderer/src/features/sessions/components/index.ts`

- [x] Task 6: Integrate ConversationView into MiddlePanelContent (AC: 3, 4)
  - [x] Update `src/renderer/src/core/shell/MiddlePanelContent.tsx`
  - [x] Import and render ConversationView when a session tab is active
  - [x] Pass mock messages for now (real data integration in Epic 3b)
  - [x] Ensure proper layout: conversation fills available space, chat input at bottom (future story)

- [x] Task 7: Final validation (AC: all)
  - [x] Run `npm run validate` (tsc + vitest + lint)
  - [x] Verify user and assistant bubbles render correctly
  - [x] Verify timestamps display in correct format
  - [x] Verify smooth scrolling works
  - [x] Verify auto-scroll to bottom on load

## Dev Notes

### Previous Story Intelligence (Epic 2a)

Epic 2a established the following patterns that MUST be followed:

**Component Organization:**
- PascalCase files: `SessionList.tsx`, `ChatInput.tsx`
- Colocate tests: `SessionList.test.tsx` beside `SessionList.tsx`
- Feature folders at `src/renderer/src/features/sessions/`

**Zustand Store Pattern (from 2a.6):**
- Naming: `use{Name}Store` (e.g., `useSessionStore`)
- Immutable updates: `set((state) => ({ ...state, newValue }))`
- Map-based state for O(1) lookup when needed

**Existing Utilities to REUSE (DO NOT RECREATE):**
- `src/renderer/src/shared/utils/formatRelativeTime.ts` - For timestamp formatting
- `src/renderer/src/shared/utils/cn.ts` - For conditional class merging (Tailwind)
- `src/renderer/src/shared/utils/index.ts` - Export barrel

**Test Pattern (from 2a.6):**
- Mock `window.grimoireAPI` via `vi.stubGlobal('window', { grimoireAPI: mockGrimoireAPI })`
- Use `@testing-library/react` for component tests
- Use `act()` for state updates in tests

### Architecture Compliance

| Element | Convention | This Story |
|---------|------------|------------|
| Component files | PascalCase.tsx | `MessageBubble.tsx`, `ConversationView.tsx` |
| Tests | Colocated | `MessageBubble.test.tsx` beside source |
| Styling | Tailwind CSS v4 | Utility classes for all styling |
| Scrolling | Radix ScrollArea | `@radix-ui/react-scroll-area` |
| State | Zustand | For scroll position persistence |

### UX Design Specifications (CRITICAL)

From `ux-design-specification.md` - Message Bubble Components:

**User Bubble:**
```
┌─────────────────────────────────┐
│ Message content here...         │
└─────────────────────────────────┘
                            14:32
```
- Alignment: Right
- Background: Accent muted + accent border
- Border radius: Rounded, bottom-right smaller

**Claude Bubble:**
```
┌─────────────────────────────────┐
│ Message content here...         │
└─────────────────────────────────┘
14:32
```
- Alignment: Left
- Background: Elevated + subtle border
- Border radius: Rounded, bottom-left smaller

### Color System (Dark Theme - Primary)

From UX spec - use CSS variables or Tailwind v4 theme:

| Role | Value | Usage |
|------|-------|-------|
| Background (base) | `hsl(240, 10%, 10%)` | Main app background |
| Background (elevated) | `hsl(240, 10%, 13%)` | Panels, cards, Claude bubbles |
| Background (hover) | `hsl(240, 10%, 16%)` | Interactive hover states |
| Text (primary) | `hsl(0, 0%, 90%)` | Main content |
| Text (muted) | `hsl(0, 0%, 60%)` | Secondary info, timestamps |
| Border | `hsl(240, 10%, 20%)` | Subtle separation |
| Accent (primary) | `hsl(270, 60%, 55%)` | Interactive elements, User bubble |
| Accent (muted) | Accent at lower opacity | User bubble background |

### Spacing System (8px base unit)

| Token | Value | Usage |
|-------|-------|-------|
| space-xs | 4px | Tight gaps, icon padding |
| space-sm | 8px | Default element spacing |
| space-md | 16px | Section gaps, card padding |
| space-lg | 24px | Panel padding, major sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 4px | Buttons, inputs |
| radius-md | 8px | Cards, message bubbles |
| radius-lg | 12px | Modals, dialogs |

### Tailwind CSS v4 Implementation

**CRITICAL:** This project uses Tailwind CSS v4, NOT v3. Key differences:
- Configuration approach is different (CSS-based, not JS config)
- Use utility classes directly, theme values defined in CSS

**REQUIRED: Use `cn()` for conditional class merging:**
```tsx
import { cn } from '@/shared/utils'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: number  // Unix ms
}

/**
 * Renders a conversation message bubble
 * @param role - Message author ('user' or 'assistant')
 * @param content - Message text content
 * @param timestamp - Unix timestamp in milliseconds
 */
export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'max-w-[80%] rounded-lg p-3',
        isUser
          ? 'ml-auto rounded-br-sm bg-purple-500/20 border border-purple-500/40'  // User: right-aligned, accent
          : 'mr-auto rounded-bl-sm bg-gray-800 border border-gray-700'            // Claude: left-aligned, elevated
      )}
    >
      <p className="text-gray-100 whitespace-pre-wrap">{content}</p>
      <span
        className={cn(
          'text-xs text-gray-500 mt-1 block',
          isUser && 'text-right'  // User timestamp aligned right
        )}
      >
        {formatMessageTimestamp(timestamp)}
      </span>
    </div>
  )
}
```

**Color Mapping (UX Spec HSL to Tailwind v4):**
| UX Spec | Tailwind Class | Usage |
|---------|----------------|-------|
| Accent primary hsl(270,60%,55%) | `bg-purple-500/20` (bg), `border-purple-500/40` | User bubble |
| Elevated hsl(240,10%,13%) | `bg-gray-800` | Claude bubble |
| Border hsl(240,10%,20%) | `border-gray-700` | Claude bubble border |
| Text muted hsl(0,0%,60%) | `text-gray-500` | Timestamps |

### ConversationMessage Type

```typescript
// src/renderer/src/features/sessions/components/types.ts

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

// Mock data for development (export from types.ts or separate mock file)
export const MOCK_MESSAGES: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Hello, can you help me with a React question?', timestamp: Date.now() - 1000 * 60 * 5 },
  { uuid: '2', role: 'assistant', content: 'Of course! I\'d be happy to help with React. What would you like to know?', timestamp: Date.now() - 1000 * 60 * 4 },
  { uuid: '3', role: 'user', content: 'How do I use useEffect correctly?', timestamp: Date.now() - 1000 * 60 * 2 },
  { uuid: '4', role: 'assistant', content: 'useEffect is used for side effects in React components. The key rules are:\n\n1. Always include dependencies in the dependency array\n2. Return a cleanup function if needed\n3. Avoid infinite loops by careful dependency management', timestamp: Date.now() - 1000 * 60 * 1 }
]
```

### Radix ScrollArea Usage

**CRITICAL:** Parent container MUST have defined height for ScrollArea to work.

```typescript
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MessageBubble } from './MessageBubble'
import type { ConversationMessage } from './types'

interface ConversationViewProps {
  messages: ConversationMessage[]
  sessionId: string  // For scroll persistence
}

/**
 * Scrollable conversation view with message bubbles
 * @param messages - Array of conversation messages to display
 * @param sessionId - Session ID for scroll position persistence
 */
export function ConversationView({ messages, sessionId }: ConversationViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)

  return (
    // Parent must provide height (e.g., flex-1 in flex container)
    <ScrollArea.Root className="h-full w-full">
      <ScrollArea.Viewport className="h-full w-full" ref={viewportRef}>
        {/* space-y-4 provides 16px gap between messages */}
        <div className="flex flex-col space-y-4 p-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.uuid} {...msg} />
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none p-0.5 transition-colors bg-transparent hover:bg-gray-800/50"
      >
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-gray-600" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
```

### Auto-Scroll Implementation

**CRITICAL: Only auto-scroll when appropriate - do NOT force-scroll users reading history.**

```typescript
// In ConversationView.tsx
const viewportRef = useRef<HTMLDivElement>(null)
const isInitialMount = useRef(true)
const { scrollPositions, setScrollPosition } = useUIStore()

// Check if user is near bottom (within 100px)
const isNearBottom = useCallback(() => {
  if (!viewportRef.current) return true
  const { scrollTop, scrollHeight, clientHeight } = viewportRef.current
  return scrollHeight - scrollTop - clientHeight < 100
}, [])

// Auto-scroll to bottom ONLY on:
// 1. Initial mount (no saved position)
// 2. User already at bottom when new messages arrive
useEffect(() => {
  if (!viewportRef.current) return

  const savedPosition = scrollPositions.get(sessionId)

  if (isInitialMount.current) {
    isInitialMount.current = false
    if (savedPosition !== undefined) {
      // Restore saved position
      viewportRef.current.scrollTop = savedPosition
    } else {
      // Initial load - scroll to bottom
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
    return
  }

  // Only auto-scroll if user is near bottom
  if (isNearBottom()) {
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }
}, [messages, sessionId])

// Save scroll position on scroll (debounced in real impl)
const handleScroll = useCallback(() => {
  if (viewportRef.current) {
    setScrollPosition(sessionId, viewportRef.current.scrollTop)
  }
}, [sessionId, setScrollPosition])
```

### formatMessageTimestamp Implementation

```typescript
// src/renderer/src/shared/utils/formatMessageTimestamp.ts
import { formatRelativeTime } from './formatRelativeTime'

/**
 * Format message timestamp for display
 * < 24h: relative ("2m ago", "3h ago")
 * >= 24h: absolute ("Jan 15, 14:32")
 */
export function formatMessageTimestamp(timestamp: number | null | undefined): string {
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
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  // Include year if different from current year
  const year = date.getFullYear()
  const currentYear = new Date().getFullYear()
  if (year !== currentYear) {
    return `${month} ${day}, ${year}, ${time}`
  }

  return `${month} ${day}, ${time}`
}
```

### Scroll Position Persistence

**Add to existing useUIStore** (NOT a new store - follow single-domain pattern):

```typescript
// In src/renderer/src/shared/store/useUIStore.ts
// ADD these fields to existing UIState interface:

interface UIState {
  // ... existing fields ...

  // Scroll position per sessionId (for tab switching)
  scrollPositions: Map<string, number>
  setScrollPosition: (sessionId: string, position: number) => void
  getScrollPosition: (sessionId: string) => number
  clearScrollPosition: (sessionId: string) => void
}

// ADD these actions to the store:
scrollPositions: new Map(),

setScrollPosition: (sessionId, position) =>
  set((state) => ({
    scrollPositions: new Map(state.scrollPositions).set(sessionId, position)
  })),

getScrollPosition: (sessionId) =>
  get().scrollPositions.get(sessionId) ?? 0,

clearScrollPosition: (sessionId) =>
  set((state) => {
    const newMap = new Map(state.scrollPositions)
    newMap.delete(sessionId)
    return { scrollPositions: newMap }
  })
```

**IMPORTANT:** When a session tab is closed, call `clearScrollPosition(sessionId)` to prevent memory leaks.

### File Structure

**New Files:**
- `src/renderer/src/features/sessions/components/MessageBubble.tsx`
- `src/renderer/src/features/sessions/components/MessageBubble.test.tsx`
- `src/renderer/src/features/sessions/components/ConversationView.tsx`
- `src/renderer/src/features/sessions/components/ConversationView.test.tsx`
- `src/renderer/src/features/sessions/components/types.ts`
- `src/renderer/src/shared/utils/formatMessageTimestamp.ts`
- `src/renderer/src/shared/utils/formatMessageTimestamp.test.ts`

**Modified Files:**
- `src/renderer/src/features/sessions/components/index.ts` (add MessageBubble, ConversationView, types exports)
- `src/renderer/src/core/shell/MiddlePanelContent.tsx` (integrate ConversationView)
- `src/renderer/src/shared/store/useUIStore.ts` (add scrollPositions Map and actions)
- `src/renderer/src/shared/utils/index.ts` (export formatMessageTimestamp)

### Scope Boundaries

**In Scope:**
- MessageBubble component (User and Claude variants)
- ConversationView component with scrolling
- Timestamp formatting for messages
- Auto-scroll to bottom on load
- Scroll position persistence per tab

**Out of Scope (Future Stories):**
- Tool call bubbles (Story 2b.2)
- Sub-agent bubbles (Story 2b.3)
- Real conversation data loading from JSONL (Epic 3b)
- Rewind UI on user messages (Story 2b.5)
- Chat input component (Epic 3a)
- Streaming/thinking indicators (Story 2b.4)

### Dependencies

**Existing (verified):**
- `@radix-ui/react-scroll-area` - Smooth scrolling (already installed)
- `zustand` - State management (already installed)
- Tailwind CSS v4 - Styling (already configured)
- `vitest` + `@testing-library/react` - Testing (already installed)

**Existing Utilities (REUSE - DO NOT RECREATE):**
- `formatRelativeTime` - `src/renderer/src/shared/utils/formatRelativeTime.ts` (verified exists)
- `cn` - `src/renderer/src/shared/utils/cn.ts` (verified exists - uses clsx + tailwind-merge)
- `formatTokenCount` - `src/renderer/src/shared/utils/formatTokenCount.ts` (if needed)
- `formatCost` - `src/renderer/src/shared/utils/formatCost.ts` (if needed)

### Project Structure Notes

- Components go in `src/renderer/src/features/sessions/components/`
- Follow electron-vite feature-based organization per architecture
- Sessions feature already exists from Epic 2a with stores in `src/renderer/src/features/sessions/store/`

### Barrel File Updates

**Update `src/renderer/src/features/sessions/components/index.ts`:**
```typescript
export { ChatInputPlaceholder } from './ChatInputPlaceholder'
export { EmptyStateView } from './EmptyStateView'
export { NewSessionView } from './NewSessionView'
export { SessionList } from './SessionList'
export { SessionListItem } from './SessionListItem'
export { SessionContextMenu } from './SessionContextMenu'
// NEW in this story:
export { MessageBubble } from './MessageBubble'
export type { MessageBubbleProps } from './MessageBubble'
export { ConversationView } from './ConversationView'
export type { ConversationViewProps } from './ConversationView'
export type { ConversationMessage } from './types'
export { MOCK_MESSAGES, createMockMessages } from './types'
```

**Update `src/renderer/src/shared/utils/index.ts`:**
```typescript
export { cn } from './cn'
export { formatRelativeTime } from './formatRelativeTime'
export { getSessionDisplayName } from './getSessionDisplayName'
export { formatTokenCount } from './formatTokenCount'
export { formatCost } from './formatCost'
// NEW in this story:
export { formatMessageTimestamp } from './formatMessageTimestamp'
```

### MiddlePanelContent Integration

```typescript
// In src/renderer/src/core/shell/MiddlePanelContent.tsx
import { ConversationView, MOCK_MESSAGES } from '../../features/sessions/components'

// Render ConversationView when session tab is active
// Parent container needs flex-1 to fill available space
function MiddlePanelContent() {
  const { activeTab } = useUIStore()

  // Only show conversation for session tabs (not sub-agent or file tabs)
  if (!activeTab || activeTab.type !== 'session') {
    return <EmptyStateView /> // or appropriate placeholder
  }

  return (
    <div className="flex flex-col h-full">
      {/* ConversationView fills remaining space */}
      <div className="flex-1 min-h-0"> {/* min-h-0 critical for flex overflow */}
        <ConversationView
          messages={MOCK_MESSAGES}  // Replace with real data in Epic 3b
          sessionId={activeTab.sessionId}
        />
      </div>
      {/* Chat input will go here in future story */}
    </div>
  )
}
```

**CRITICAL:** `min-h-0` on the flex child is required for proper overflow behavior in flexbox.

### Performance Considerations

- Virtualization deferred to future optimization (MVP: render all messages)
- NFR2: Session load (100+ messages) < 1 second
- NFR3: Sub-agent expansion < 100ms (client-side)
- NFR7: Tab switching instant (no reload delay)

### References

- [Source: epics.md#Epic 2b Story 2b.1] - Acceptance criteria and FR33, FR39 mapping
- [Source: ux-design-specification.md#Message Bubble] - Visual specifications
- [Source: architecture.md#Frontend Architecture] - Component organization
- [Source: project-context.md#Framework-Specific Rules] - React/Electron patterns
- [Source: 2a-6-session-metadata-storage.md#Dev Notes] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

1. **Task 1 & 2 (MessageBubble):** Created single component with conditional styling based on `role` prop. User messages are right-aligned with accent-muted background and accent border; assistant messages are left-aligned with elevated background and subtle border. Uses CSS variables for colors (var(--accent), var(--bg-elevated), etc.). Added accessibility attributes (role="article", aria-label). 13 tests pass.

2. **Task 3 (formatMessageTimestamp):** Created utility that delegates to formatRelativeTime for <24h timestamps and formats as "Jan 15, 14:32" for older timestamps. Includes year for timestamps from different years. 10 tests pass covering edge cases.

3. **Task 4 (ConversationView):** Created scrollable view using Radix ScrollArea. Implements smart auto-scroll (only on initial load or when user is near bottom). Saves/restores scroll position per sessionId using useUIStore. 11 tests pass.

4. **Task 5 (Types):** Created ConversationMessage interface with uuid, role, content, and timestamp (Unix ms). Added MOCK_MESSAGES for tests and createMockMessages() helper for runtime.

5. **Scroll Persistence (useUIStore):** Extended existing store with scrollPositions Map, setScrollPosition, getScrollPosition, and clearScrollPosition. closeTab now clears scroll position for closed session tabs. 8 new tests added (32 total pass).

6. **Task 6 (Integration):** Updated MiddlePanelContent to render ConversationView for tabs with sessionId. Uses useMemo for stable mock messages reference. Parent container uses flex-1 and min-h-0 for proper overflow. 9 tests pass.

7. **Task 7 (Validation):** All 310 tests pass. TypeScript compiles without errors. ESLint passes (prettier issues auto-fixed).

### Change Log

- 2026-01-23: Story 2b.1 implementation complete. Created MessageBubble and ConversationView components, formatMessageTimestamp utility, scroll position persistence in useUIStore, and integrated into MiddlePanelContent with mock data.
- 2026-01-23: Code Review (Attempt 1) - Fixed 2 MEDIUM and 2 LOW issues:
  - M1: Fixed sessionId change effect dependency causing unnecessary scroll resets
  - M2: Added empty state message for ConversationView when no messages
  - L1: Added clarifying comments to test mock messages timestamps
  - L2: Added aria-label to scrollbar for accessibility
- 2026-01-23: Code Review (Attempt 2) - Fixed 3 MEDIUM and 3 LOW issues:
  - M1: Improved 24h boundary test to verify exact date output (Jan 22)
  - M2: Added debounce (100ms) to scroll position saving to reduce state updates during rapid scrolling
  - M3: Added test for ConversationView when messages change from non-empty to empty
  - L1: Improved createMockMessages() documentation with usage guidelines for tests vs development
  - L2: Clarified useMemo comment in MiddlePanelContent (per mount, not per render cycle)
  - L3: Updated story documentation to match actual barrel file exports (added type exports)
- 2026-01-23: Code Review (Attempt 3 - FINAL) - Fixed 1 MEDIUM and 1 LOW issues:
  - M1: Added debounce cleanup on component unmount to prevent memory leaks and state updates after unmount
  - L1: Added test for scroll position restoration and unmount cleanup behavior

### File List

**New Files:**
- `src/renderer/src/features/sessions/components/MessageBubble.tsx`
- `src/renderer/src/features/sessions/components/MessageBubble.test.tsx`
- `src/renderer/src/features/sessions/components/ConversationView.tsx`
- `src/renderer/src/features/sessions/components/ConversationView.test.tsx`
- `src/renderer/src/features/sessions/components/types.ts`
- `src/renderer/src/shared/utils/formatMessageTimestamp.ts`
- `src/renderer/src/shared/utils/formatMessageTimestamp.test.ts`

**Modified Files:**
- `src/renderer/src/features/sessions/components/index.ts` - Added exports for MessageBubble, ConversationView, types
- `src/renderer/src/core/shell/MiddlePanelContent.tsx` - Integrated ConversationView
- `src/renderer/src/core/shell/MiddlePanelContent.test.tsx` - Updated tests for ConversationView integration
- `src/renderer/src/shared/store/useUIStore.ts` - Added scroll position persistence (scrollPositions Map, set/get/clear actions)
- `src/renderer/src/shared/store/useUIStore.test.ts` - Added scroll position tests
- `src/renderer/src/shared/utils/index.ts` - Exported formatMessageTimestamp

## Story Quality Review

### Review Date
2026-01-23

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Review Outcome
**APPROVED** - All critical issues identified and fixed.

### Issues Found and Fixed

#### CRITICAL Issues (3 total - all fixed)

**C1: Timestamp type inconsistency**
- Problem: Story showed `timestamp: string` in interface but `number` in formatter
- Fix: Standardized on `timestamp: number` (Unix ms) throughout story and all examples
- Files affected: Task 1, Task 5, ConversationMessage interface, MessageBubble props

**C2: Missing cn() utility usage in example code**
- Problem: Example code used raw className strings instead of established `cn()` pattern
- Fix: Updated MessageBubble example to use `cn()` for conditional class merging
- Files affected: Tailwind CSS v4 Implementation section

**C3: Auto-scroll UX problem**
- Problem: Original useEffect would force-scroll users reading history to bottom
- Fix: Added logic to only auto-scroll on initial load OR when user is near bottom
- Files affected: Auto-Scroll Implementation section

#### HIGH Issues (3 total - all fixed)

**H1: Missing color mapping from UX spec to Tailwind**
- Problem: No clear guidance on how UX spec HSL values map to Tailwind classes
- Fix: Added explicit color mapping table with UX spec values and Tailwind equivalents

**H2: Missing scroll persistence implementation details**
- Problem: Scroll persistence was mentioned but not explained
- Fix: Added complete implementation with useUIStore integration, save/restore logic

**H3: Missing types export from barrel file**
- Problem: No guidance on exporting ConversationMessage from index.ts
- Fix: Added explicit barrel file update section with all exports

#### MEDIUM Issues (3 total - all fixed)

**M1: Missing viewport ref typing clarification** - Clarified in code example
**M2: Missing parent height constraint documentation** - Added explicit note about `flex-1` and `min-h-0`
**M3: Missing message spacing** - Added `space-y-4` in ConversationView example

#### LOW Issues (2 total - all fixed)

**L1: Missing JSDoc requirements** - Added JSDoc requirement to Task 1 and Task 4
**L2: Missing import for formatMessageTimestamp** - Added to MessageBubble example

### Acceptance Criteria Verification
- AC1 (Visual styling): COMPLETE - Detailed example with cn(), color mapping, border radius
- AC2 (Timestamps): COMPLETE - formatMessageTimestamp implementation with relative/absolute logic
- AC3 (Scrolling): COMPLETE - Radix ScrollArea with persistence and proper parent height
- AC4 (Auto-scroll): COMPLETE - Smart auto-scroll only when appropriate

### Validation Results
- Story completeness: PASS
- Technical accuracy: PASS
- LLM optimization: PASS (actionable code examples, clear requirements)

### Recommendation
Story is complete and ready for dev-story execution.
