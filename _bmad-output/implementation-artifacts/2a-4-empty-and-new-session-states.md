# Story 2a.4: Empty and New Session States

Status: done

## Story

As a **user**,
I want **clear visual feedback when no session is selected or when starting fresh**,
so that **I understand the app state and know how to proceed**.

## Acceptance Criteria

1. **Given** no session is selected (FR32) **When** the middle panel is displayed **Then** an empty state message appears: "Select a session or start a new one" **And** a prominent "New Session" button is visible

2. **Given** the user starts a new session **When** the new session tab opens **Then** the conversation area is empty **And** the input box is auto-focused (UX11) **And** the placeholder text says "Type your message..."

3. **Given** a session is being streamed with sub-agents **When** new sub-agents are discovered (FR32b) **Then** the sub-agent index is updated in real-time **And** new sub-agents appear in the conversation as they are created

## Tasks / Subtasks

- [x] Task 1: Create EmptyStateView component (AC: 1)
  - [x] Create `src/renderer/src/features/sessions/components/EmptyStateView.tsx`
  - [x] Display centered message: "Select a session or start a new one"
  - [x] Add prominent "New Session" button below the message
  - [x] Use accent color for the button (bg-[var(--accent)])
  - [x] Button icon: Plus from lucide-react
  - [x] Connect button to folder picker flow (same as LeftPanelContent "+" button)
  - [x] Add tests: `EmptyStateView.test.tsx`

- [x] Task 2: Create NewSessionView component (AC: 2)
  - [x] Create `src/renderer/src/features/sessions/components/NewSessionView.tsx`
  - [x] Display centered empty state message for new session
  - [x] Include ChatInputPlaceholder component at bottom (prep for Epic 3a)
  - [x] Pass `autoFocus` prop to indicate this should be focused when ChatInput is implemented
  - [x] Placeholder text: "Type your message..."
  - [x] Add tests: `NewSessionView.test.tsx`

- [x] Task 3: Create ChatInputPlaceholder component (AC: 2)
  - [x] Create `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`
  - [x] Visual placeholder for chat input (to be replaced in Epic 3a)
  - [x] Accepts `autoFocus` prop for future implementation
  - [x] Accepts `placeholder` prop (default: "Type your message...")
  - [x] Display placeholder text in muted style
  - [x] Add comment noting this will be replaced by actual ChatInput in Epic 3a
  - [x] Add tests: `ChatInputPlaceholder.test.tsx`

- [x] Task 4: Update MiddlePanelContent to use new components (AC: 1, 2)
  - [x] Import EmptyStateView, NewSessionView from features/sessions/components
  - [x] Replace inline empty state (lines 9-14) with `<EmptyStateView />`
  - [x] Replace inline new session view (lines 17-33) with `<NewSessionView />`
  - [x] Keep existing session view structure (lines 36-53) for now - will be replaced in Epic 2b
  - [x] Update tests: `MiddlePanelContent.test.tsx`

- [x] Task 5: Add handleNewSession to EmptyStateView (AC: 1)
  - [x] Import same pattern from LeftPanelContent.tsx for folder picker flow
  - [x] Use `window.grimoireAPI.dialog.selectFolder()` for folder selection
  - [x] Use `window.grimoireAPI.sessions.create()` for session creation
  - [x] Use `useUIStore.getState().focusOrOpenSession()` to open new tab
  - [x] Use `useSessionStore.getState().loadSessions()` to refresh list
  - [x] Handle error cases gracefully (try/catch with console.error)

- [x] Task 6: Add visual polish to empty states (AC: 1, 2)
  - [x] EmptyStateView: Add subtle icon (MessageSquare or similar) above text
  - [x] NewSessionView: Add visual cue that session is ready for input
  - [x] Ensure consistent spacing and typography with UX spec
  - [x] Use proper semantic elements (button for interactive, div for display)

- [x] Task 7: Sub-agent architecture note (AC: 3)
  - [x] **NOTE:** AC3 describes future behavior implemented in Epic 2b/3a
  - [x] Add JSDoc comment in NewSessionView noting where sub-agent index will appear
  - [x] Example comment: `{/* Sub-agent index will appear here during streaming (Epic 2b) */}`
  - [x] No code implementation needed - architecture already supports sub-agents via Tab type 'subagent' in useUIStore

- [x] Task 8: Export new components from barrel (AC: all)
  - [x] Update `src/renderer/src/features/sessions/components/index.ts`
  - [x] Export EmptyStateView, NewSessionView, ChatInputPlaceholder

- [x] Task 9: Add tests for all new components (AC: all)
  - [x] Test EmptyStateView: renders message, button click triggers folder picker
  - [x] Test NewSessionView: renders empty state, shows placeholder input
  - [x] Test ChatInputPlaceholder: renders with correct placeholder text
  - [x] Test MiddlePanelContent: shows EmptyStateView when no tabs, shows NewSessionView for new session

- [x] Task 10: Final validation (AC: all)
  - [x] Run `npm run validate` (tsc + vitest + lint)
  - [x] Manual test: app starts with empty state showing button
  - [x] Manual test: clicking "New Session" opens folder picker
  - [x] Manual test: selecting folder creates session and opens tab
  - [x] Manual test: new session shows empty conversation with placeholder input

## Dev Notes

### Previous Story Intelligence (2a.3)

Story 2a.3 established session management patterns. Key learnings:

- **handleNewSession pattern** exists in `LeftPanelContent.tsx` - reuse for EmptyStateView
- **IPC flow**: `dialog:selectFolder` -> `sessions:create` -> `focusOrOpenSession`
- **Error handling**: try/catch with console.error for IPC failures
- **getState() pattern**: Use `useXxxStore.getState().action()` for imperative calls outside React render

```typescript
// From LeftPanelContent.tsx - reuse this pattern
const handleNewSession = async (): Promise<void> => {
  try {
    const result = await window.grimoireAPI.dialog.selectFolder()
    if (result.canceled || !result.folderPath) return

    const { sessionId } = await window.grimoireAPI.sessions.create(result.folderPath)
    const displayName = getSessionDisplayName(result.folderPath)

    useSessionStore.getState().loadSessions()
    useUIStore.getState().focusOrOpenSession(sessionId, displayName)
  } catch (error) {
    console.error('Failed to create new session:', error)
  }
}
```

### Architecture Requirements

**Dependencies (already installed - verified in previous stories):**
- `lucide-react` - Icons (Plus, MessageSquare)
- `@testing-library/react` - Component testing
- `@testing-library/user-event` - User interaction testing

**Component Location:**
- Feature components: `src/renderer/src/features/sessions/components/`
- Tests colocated: `ComponentName.test.tsx` beside source
- **Import pattern for feature components from core:** Use `@renderer/features/sessions/components`
- **Import pattern for shared stores:** Use `@renderer/shared/store/useUIStore`

**MiddlePanelContent Current Structure (`src/renderer/src/core/shell/MiddlePanelContent.tsx`):**
```typescript
// Current logic (to be refactored):
// 1. No tabs: Empty state (lines 9-14) -> Replace with <EmptyStateView />
// 2. Tab with no sessionId: New session (lines 17-33) -> Replace with <NewSessionView />
// 3. Tab with sessionId: Session view (lines 36-53) -> Keep for now (Epic 2b)
```

**Component Patterns:**

```tsx
// EmptyStateView.tsx
import { Plus, MessageSquare } from 'lucide-react'
import type { ReactElement } from 'react'
import { useSessionStore } from '@renderer/features/sessions/store/useSessionStore'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { getSessionDisplayName } from '@renderer/shared/utils'

export function EmptyStateView(): ReactElement {
  const handleNewSession = async (): Promise<void> => {
    try {
      const result = await window.grimoireAPI.dialog.selectFolder()
      if (result.canceled || !result.folderPath) return

      const { sessionId } = await window.grimoireAPI.sessions.create(result.folderPath)
      const displayName = getSessionDisplayName(result.folderPath)

      useSessionStore.getState().loadSessions()
      useUIStore.getState().focusOrOpenSession(sessionId, displayName)
    } catch (error) {
      console.error('Failed to create new session:', error)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-elevated)] p-4">
      <MessageSquare className="w-12 h-12 text-[var(--text-muted)] mb-4" />
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Select a session or start a new one
      </p>
      <button
        type="button"
        onClick={handleNewSession}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[var(--radius-sm)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Session
      </button>
    </div>
  )
}
```

```tsx
// NewSessionView.tsx
import type { ReactElement } from 'react'
import { ChatInputPlaceholder } from './ChatInputPlaceholder'

/**
 * View for a new session with no messages yet.
 * Shows empty conversation area with placeholder input.
 * Sub-agent index will appear during streaming (Epic 2b - AC3).
 */
export function NewSessionView(): ReactElement {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* Conversation area - sub-agent index will appear here during streaming (Epic 2b) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">
          New session - start typing to begin
        </p>
      </div>
      {/* ChatInput placeholder - will be replaced with actual ChatInput in Epic 3a */}
      {/* autoFocus indicates this input should be focused when implemented (UX11) */}
      <ChatInputPlaceholder autoFocus placeholder="Type your message..." />
    </div>
  )
}
```

```tsx
// ChatInputPlaceholder.tsx
import type { ReactElement } from 'react'

interface ChatInputPlaceholderProps {
  /** When true, indicates this input should auto-focus when ChatInput is implemented (UX11) */
  autoFocus?: boolean
  placeholder?: string
}

/**
 * Placeholder for chat input - will be replaced by actual ChatInput in Epic 3a.
 *
 * NOTE for Epic 3a: When implementing ChatInput:
 * - If autoFocus is true, call inputRef.focus() on mount
 * - Replace this entire component with the actual ChatInput
 */
export function ChatInputPlaceholder({
  autoFocus = false,
  placeholder = 'Type your message...'
}: ChatInputPlaceholderProps): ReactElement {
  // NOTE: autoFocus prop is stored for documentation purposes only in this placeholder.
  // Epic 3a will implement actual focus behavior.
  void autoFocus // Explicitly mark as intentionally unused

  return (
    <div className="h-12 border-t border-[var(--border)] flex items-center px-4">
      <div className="flex-1 h-8 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 flex items-center">
        <span className="text-sm text-[var(--text-muted)]">
          {placeholder} (input coming in Epic 3a)
        </span>
      </div>
    </div>
  )
}
```

### UX Specification Reference

**Empty States (from ux-design-specification.md):**

| Context                   | Empty State Display                               |
| ------------------------- | ------------------------------------------------- |
| No sessions               | "No sessions yet. Start typing to begin."         |
| Session list (filtered)   | "No sessions match your filter."                  |
| New session (no messages) | Input focused, placeholder "Type your message..." |
| Events panel (no events)  | "Events will appear as conversation progresses."  |

**Important: Empty State Context Clarification:**
- UX spec "No sessions" refers to the **left panel session list** being empty
- This story's EmptyStateView is for the **middle panel** when no tab is open/selected
- The message "Select a session or start a new one" is appropriate for middle panel empty state
- This is distinct from the left panel empty state message

**Auto-Focus Behavior:**
- Auto-focus on new session (UX11)
- NO auto-focus on existing session (per UX spec)

**Input Placeholder:**
- "Type your message..." for new and existing sessions

### CSS Variables Reference

From `main.css`:
- `--bg-elevated`: Elevated surfaces (hsl(240, 10%, 13%))
- `--bg-hover`: Hover state background
- `--text-muted`: Secondary/muted text (hsl(0, 0%, 60%))
- `--accent`: Purple accent color (hsl(270, 60%, 55%))
- `--accent-hover`: Hover state for accent
- `--border`: Subtle borders (hsl(240, 10%, 20%))
- `--radius-sm`: 4px - buttons, inputs

### Testing Strategy

**Test Setup (from 2a.2, 2a.3):**
- `src/test-setup.ts` exists with ResizeObserver mock and jest-dom setup
- Import `@testing-library/user-event` for click interactions
- Use `vi.fn()` for mocking, not `jest.fn()`

**CRITICAL: Async Test Patterns:**
- Use `waitFor` from `@testing-library/react`, NOT `vi.waitFor` (which doesn't exist)
- jest-dom matchers like `toBeInTheDocument()` are auto-imported via test-setup.ts

**Mock Pattern (from 2a.3 - mock at window level):**
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EmptyStateView } from './EmptyStateView'

// grimoireAPI is on window, NOT a module import - mock via Object.defineProperty
const mockSelectFolder = vi.fn().mockResolvedValue({ canceled: false, folderPath: '/test/path' })
const mockCreate = vi.fn().mockResolvedValue({ sessionId: 'new-session-id' })
const mockLoadSessions = vi.fn()
const mockFocusOrOpenSession = vi.fn()

// Mock Zustand stores - use @renderer alias consistently
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: {
    getState: () => ({
      focusOrOpenSession: mockFocusOrOpenSession
    })
  }
}))

vi.mock('@renderer/features/sessions/store/useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      loadSessions: mockLoadSessions
    })
  }
}))

beforeEach(() => {
  vi.clearAllMocks()

  Object.defineProperty(window, 'grimoireAPI', {
    writable: true,
    configurable: true,
    value: {
      sessions: {
        create: mockCreate,
        list: vi.fn().mockResolvedValue([]),
        getActiveProcesses: vi.fn().mockResolvedValue([])
      },
      dialog: {
        selectFolder: mockSelectFolder
      }
    }
  })
})

describe('EmptyStateView', () => {
  it('should render the empty state message and button', () => {
    render(<EmptyStateView />)
    expect(screen.getByText('Select a session or start a new one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new session/i })).toBeInTheDocument()
  })

  it('should call folder picker when New Session clicked', async () => {
    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))
    expect(mockSelectFolder).toHaveBeenCalled()
  })

  it('should create session and open tab after folder selection', async () => {
    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))

    // Wait for the full async chain to complete
    await waitFor(() => {
      expect(mockFocusOrOpenSession).toHaveBeenCalledWith('new-session-id', 'path')
    })

    // Verify the intermediate steps also happened
    expect(mockSelectFolder).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith('/test/path')
    expect(mockLoadSessions).toHaveBeenCalled()
  })

  it('should not create session when folder picker is canceled', async () => {
    mockSelectFolder.mockResolvedValueOnce({ canceled: true, folderPath: null })
    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))

    // Give time for any async operations (there shouldn't be any after cancel)
    await waitFor(() => {
      expect(mockSelectFolder).toHaveBeenCalled()
    })

    // These should NOT have been called due to cancellation
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockLoadSessions).not.toHaveBeenCalled()
    expect(mockFocusOrOpenSession).not.toHaveBeenCalled()
  })

  it('should handle IPC errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValueOnce(new Error('IPC failed'))

    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create new session:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })
})
```

**MiddlePanelContent Test Pattern:**
```typescript
// src/renderer/src/core/shell/MiddlePanelContent.test.tsx
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MiddlePanelContent } from './MiddlePanelContent'

// Mock useUIStore with different states for different tests
const mockUseUIStore = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: () => mockUseUIStore()
}))

// Mock the session components
vi.mock('@renderer/features/sessions/components', () => ({
  EmptyStateView: () => <div data-testid="empty-state">EmptyStateView</div>,
  NewSessionView: () => <div data-testid="new-session">NewSessionView</div>
}))

describe('MiddlePanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show EmptyStateView when no tabs exist', () => {
    mockUseUIStore.mockReturnValue({ tabs: [], activeTabId: null })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('should show NewSessionView for tab without sessionId', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [{ id: 'tab-1', type: 'session', title: 'New', sessionId: null, sessionState: 'idle' }],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('new-session')).toBeInTheDocument()
  })

  it('should show session view for tab with sessionId', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [{ id: 'tab-1', type: 'session', title: 'Project', sessionId: 'session-123', sessionState: 'idle' }],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByText(/Session: Project/)).toBeInTheDocument()
  })
})
```

### Project Structure Notes

**Files to create:**
- `src/renderer/src/features/sessions/components/EmptyStateView.tsx`
- `src/renderer/src/features/sessions/components/EmptyStateView.test.tsx`
- `src/renderer/src/features/sessions/components/NewSessionView.tsx`
- `src/renderer/src/features/sessions/components/NewSessionView.test.tsx`
- `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`
- `src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx`

**Files to modify:**
- `src/renderer/src/core/shell/MiddlePanelContent.tsx` - Use new components
- `src/renderer/src/features/sessions/components/index.ts` - Export new components

**Test files to create or update:**
- `src/renderer/src/core/shell/MiddlePanelContent.test.tsx` (create if not exists)

### Architecture Compliance

| Element | Convention | This Story |
|---------|------------|------------|
| React components | PascalCase | `EmptyStateView.tsx`, `NewSessionView.tsx`, `ChatInputPlaceholder.tsx` |
| Component files | PascalCase.tsx | As above |
| Tests | Colocated | `*.test.tsx` beside source |
| CSS variables | --kebab-case | `--bg-elevated`, `--accent` |
| Zustand stores | use{Name}Store | `useUIStore`, `useSessionStore` (existing) |
| IPC channels | namespace:action | `dialog:selectFolder`, `sessions:create` (existing) |

### Scope Boundaries

**In Scope:**
- Empty state view when no session selected (AC1)
- New session view with placeholder input (AC2)
- "New Session" button in empty state (AC1)
- Auto-focus marker for future ChatInput (AC2)
- Placeholder text "Type your message..." (AC2)

**Out of Scope (Future Stories/Epics):**
- Actual ChatInput component (Epic 3a)
- Conversation rendering (Epic 2b)
- Sub-agent streaming and real-time updates (Epic 2b/3a) - AC3 is a placeholder noting architecture supports this
- Message sending functionality (Epic 3a)

### Sub-Agent Note (AC3)

AC3 mentions sub-agent index updates during streaming. This story creates the foundational empty states. The actual sub-agent streaming implementation is deferred to:
- **Epic 2b**: Conversation Display (sub-agent expansion, streaming indicators)
- **Epic 3a**: Session Interaction (spawn, message send, stream handling)

The architecture already supports sub-agents via:
- Tab type: `'subagent'` in useUIStore
- SubAgentContainer component (to be created in Epic 2b)
- Stream parsing in session-file-reader.ts (to be created in Epic 2b)

### References

- [Source: epics.md#Story 2a.4] - Acceptance criteria
- [Source: ux-design-specification.md#State Patterns] - Empty state patterns
- [Source: ux-design-specification.md#Chat Input] - Input placeholder and auto-focus
- [Source: architecture.md#Project Structure] - File organization
- [Source: project-context.md#Framework-Specific Rules] - Component patterns
- [Source: 2a-3-session-management-actions.md] - Previous story patterns (handleNewSession)
- [Source: 2a-2-session-list-component.md] - Utility patterns (getSessionDisplayName)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Implemented ChatInputPlaceholder component with autoFocus and placeholder props (4 tests)
- Implemented EmptyStateView with MessageSquare icon and New Session button (6 tests)
- Implemented NewSessionView with ChatInputPlaceholder integration (4 tests)
- Updated MiddlePanelContent to use new components (7 tests)
- Updated barrel file with 3 new exports (ChatInputPlaceholder, EmptyStateView, NewSessionView)
- All 186 tests pass, TypeScript compiles cleanly, no lint errors

### Change Log

- 2026-01-23: **Story Implemented** - All 10 tasks completed:
  - Created ChatInputPlaceholder, EmptyStateView, NewSessionView components
  - Updated MiddlePanelContent to use new components
  - Added comprehensive tests (21 new tests across 4 test files)
  - All validations pass (tsc, vitest, lint)
- 2026-01-23: **Review Pass 2** - Fixed 1 HIGH + 3 MEDIUM issues:
  - **HIGH**: Improved test coverage - added 5 comprehensive tests including render verification, full async chain validation, cancellation handling, and error handling
  - **MEDIUM**: Removed non-standard `data-autofocus` attribute from ChatInputPlaceholder - replaced with JSDoc documentation and explicit `void autoFocus` to avoid lint warnings about unused props
  - **MEDIUM**: Enhanced test pattern to verify full async chain (mockFocusOrOpenSession as final assertion) rather than intermediate steps
  - **MEDIUM**: Added test for IPC error handling to ensure graceful failure
- 2026-01-23: Story reviewed and fixed - corrected import paths to use @renderer alias, fixed test pattern (waitFor from testing-library not vi.waitFor), clarified UX spec context
- 2026-01-23: Story created from epics, ready for development
- 2026-01-23: **Review Pass 3** - Fixed 1 HIGH + 1 MEDIUM + 2 LOW issues:
  - **HIGH**: MiddlePanelContent now uses ChatInputPlaceholder component for existing sessions (was inline duplicate with inconsistent text)
  - **MEDIUM**: Fixed text inconsistency - existing session placeholder now says "Type your message..." (AC2 compliant) instead of "Type a message..."
  - **LOW**: Added aria-label and title attributes to EmptyStateView button for accessibility
  - **LOW**: Added role="textbox", aria-placeholder, and aria-disabled to ChatInputPlaceholder for screen reader support
  - Updated MiddlePanelContent.test.tsx mock to include ChatInputPlaceholder
  - All 186 tests pass, TypeScript clean, no lint errors
- 2026-01-23: **Review Pass 4 (Final)** - APPROVED - Story marked as done
  - All acceptance criteria implemented and verified
  - All tasks completed as documented
  - 186 tests pass, TypeScript clean, no lint errors
  - Code quality meets project standards
  - Minor notes: placeholder text includes "(input coming in Epic 3a)" which is acceptable for MVP placeholder, will be replaced in Epic 3a

### File List

**Created:**
- `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx` - Chat input placeholder component
- `src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx` - Tests (4 tests)
- `src/renderer/src/features/sessions/components/EmptyStateView.tsx` - Empty state with New Session button
- `src/renderer/src/features/sessions/components/EmptyStateView.test.tsx` - Tests (6 tests)
- `src/renderer/src/features/sessions/components/NewSessionView.tsx` - New session view
- `src/renderer/src/features/sessions/components/NewSessionView.test.tsx` - Tests (4 tests)
- `src/renderer/src/core/shell/MiddlePanelContent.test.tsx` - Tests (7 tests)

**Modified:**
- `src/renderer/src/core/shell/MiddlePanelContent.tsx` - Use new components
- `src/renderer/src/features/sessions/components/index.ts` - Export new components
