---
title: 'Empty and New Session States'
slug: '2a-4-empty-and-new-session-states'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - React 18 + TypeScript
  - Vitest + Testing Library
  - Zustand
  - lucide-react
  - Tailwind CSS v4 (CSS variables)
files_to_modify:
  - src/renderer/src/features/sessions/components/EmptyStateView.tsx (create)
  - src/renderer/src/features/sessions/components/EmptyStateView.test.tsx (create)
  - src/renderer/src/features/sessions/components/NewSessionView.tsx (create)
  - src/renderer/src/features/sessions/components/NewSessionView.test.tsx (create)
  - src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx (create)
  - src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx (create)
  - src/renderer/src/features/sessions/components/index.ts (modify)
  - src/renderer/src/core/shell/MiddlePanelContent.tsx (modify)
  - src/renderer/src/core/shell/MiddlePanelContent.test.tsx (create)
code_patterns:
  - Feature components in src/renderer/src/features/sessions/components/
  - Tests colocated with source files (ComponentName.test.tsx)
  - Use @renderer alias for imports
  - Zustand getState() for imperative calls in async handlers
  - CSS variables for styling (--bg-elevated, --accent, etc.)
test_patterns:
  - Vitest with @testing-library/react
  - jest-dom matchers via src/test-setup.ts
  - Mock grimoireAPI via Object.defineProperty on window
  - Mock Zustand stores via vi.mock with @renderer alias
  - Use waitFor from testing-library for async assertions
  - userEvent.setup() for user interactions
---

# Tech-Spec: Empty and New Session States

**Created:** 2026-01-23

## Overview

### Problem Statement

When no session is selected in Grimoire, the middle panel shows a basic placeholder text. Users need clear visual feedback indicating the app state and an obvious call-to-action to create a new session. Similarly, when starting a new session, the conversation area should show an appropriate empty state with a placeholder for the chat input (to be implemented in Epic 3a).

### Solution

Create three new React components:
1. **EmptyStateView** - Displayed when no tabs are open, shows a "Select a session or start a new one" message with a prominent "New Session" button
2. **NewSessionView** - Displayed when a new session tab is open (no sessionId), shows empty conversation area with the chat input placeholder
3. **ChatInputPlaceholder** - Visual placeholder for the chat input, to be replaced by the actual ChatInput component in Epic 3a

These components will replace the inline JSX in `MiddlePanelContent.tsx` with well-tested, reusable components following established project patterns.

### Scope

**In Scope:**
- EmptyStateView component with "New Session" button (AC1)
- NewSessionView component with empty conversation area (AC2)
- ChatInputPlaceholder component with placeholder text (AC2)
- Integration into MiddlePanelContent
- Full test coverage for all new components
- Auto-focus marker for future ChatInput implementation (UX11)
- JSDoc comment noting where sub-agent index will appear (AC3 architecture note)

**Out of Scope:**
- Actual ChatInput component (Epic 3a)
- Conversation rendering (Epic 2b)
- Sub-agent streaming and real-time updates (Epic 2b/3a)
- Message sending functionality (Epic 3a)

## Context for Development

### Codebase Patterns

**Component Organization:**
- Feature components live in `src/renderer/src/features/sessions/components/`
- Tests are colocated: `ComponentName.test.tsx` beside `ComponentName.tsx`
- Export all public components via barrel file `index.ts`

**Import Patterns:**
- Use `@renderer` alias for internal imports (e.g., `@renderer/shared/store/useUIStore`)
- Import feature stores from `@renderer/features/sessions/store/useSessionStore`
- Import utilities from `@renderer/shared/utils`

**Styling Patterns:**
- Use CSS variables from main.css (e.g., `--bg-elevated`, `--accent`, `--text-muted`)
- Use Tailwind utility classes with CSS variable values
- Icons from lucide-react library

**State Management:**
- Use `useUIStore.getState().action()` for imperative calls outside React render
- Use `useSessionStore.getState().loadSessions()` to refresh session list

**handleNewSession Pattern (from LeftPanelContent.tsx):**
```typescript
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

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/core/shell/LeftPanelContent.tsx` | Contains handleNewSession pattern to reuse |
| `src/renderer/src/core/shell/MiddlePanelContent.tsx` | Target file for integration - replace inline JSX |
| `src/renderer/src/shared/store/useUIStore.ts` | Tab management, focusOrOpenSession action |
| `src/renderer/src/features/sessions/store/useSessionStore.ts` | loadSessions action |
| `src/renderer/src/shared/utils/getSessionDisplayName.ts` | Utility for deriving display name from path |
| `src/renderer/src/features/sessions/components/index.ts` | Barrel file to update with new exports |
| `src/test-setup.ts` | Test setup with ResizeObserver mock and jest-dom |
| `vitest.config.ts` | Test configuration with @renderer alias |

### Technical Decisions

1. **Copy handleNewSession pattern from LeftPanelContent** - The exact same flow is needed (folder picker -> create session -> open tab), so reuse the proven pattern.

2. **ChatInputPlaceholder accepts props for future use** - The `autoFocus` prop is documented but not used in the placeholder; it signals to Epic 3a implementers that this input should auto-focus.

3. **Use `void autoFocus` to suppress unused variable lint warning** - Since autoFocus is intentionally unused in the placeholder, explicitly mark it as such to avoid lint errors.

4. **JSDoc comments for future epic references** - Add clear comments indicating where sub-agent index (Epic 2b) and ChatInput (Epic 3a) will be implemented.

5. **Test grimoireAPI via Object.defineProperty** - Since grimoireAPI is on window (not a module), mock it by defining a property on the window object in beforeEach.

## Implementation Plan

### Tasks

- [ ] Task 1: Create ChatInputPlaceholder component
  - File: `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`
  - Action: Create new component with props interface for autoFocus and placeholder text
  - Notes:
    - Accept `autoFocus?: boolean` prop (documented for Epic 3a, unused in placeholder)
    - Accept `placeholder?: string` prop with default "Type your message..."
    - Use `void autoFocus` to mark as intentionally unused
    - Add JSDoc comment noting replacement by ChatInput in Epic 3a
    - Render a div styled to look like a disabled input field

- [ ] Task 2: Create ChatInputPlaceholder tests
  - File: `src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx`
  - Action: Create test file with basic render tests
  - Notes:
    - Test default placeholder text renders
    - Test custom placeholder text renders
    - Test autoFocus prop is accepted without error

- [ ] Task 3: Create EmptyStateView component
  - File: `src/renderer/src/features/sessions/components/EmptyStateView.tsx`
  - Action: Create new component with message and New Session button
  - Notes:
    - Import Plus and MessageSquare icons from lucide-react
    - Display MessageSquare icon above the message text
    - Display "Select a session or start a new one" text
    - Display prominent "New Session" button with Plus icon
    - Use accent color for button (`bg-[var(--accent)]`)
    - Implement handleNewSession following LeftPanelContent pattern
    - Center content vertically and horizontally

- [ ] Task 4: Create EmptyStateView tests
  - File: `src/renderer/src/features/sessions/components/EmptyStateView.test.tsx`
  - Action: Create comprehensive test file
  - Notes:
    - Mock grimoireAPI on window via Object.defineProperty
    - Mock useUIStore and useSessionStore via vi.mock
    - Test: renders message and button
    - Test: clicking button triggers folder picker
    - Test: creates session and opens tab after folder selection
    - Test: does nothing when folder picker is canceled
    - Test: handles IPC errors gracefully (console.error)

- [ ] Task 5: Create NewSessionView component
  - File: `src/renderer/src/features/sessions/components/NewSessionView.tsx`
  - Action: Create new component for empty session state
  - Notes:
    - Display centered message "New session - start typing to begin"
    - Include ChatInputPlaceholder at bottom with autoFocus=true
    - Add JSDoc comment noting sub-agent index location (Epic 2b)
    - Use flex column layout with flex-1 for conversation area

- [ ] Task 6: Create NewSessionView tests
  - File: `src/renderer/src/features/sessions/components/NewSessionView.test.tsx`
  - Action: Create test file
  - Notes:
    - Test: renders new session message
    - Test: renders ChatInputPlaceholder with placeholder text
    - Test: ChatInputPlaceholder receives autoFocus prop

- [ ] Task 7: Update barrel file with new exports
  - File: `src/renderer/src/features/sessions/components/index.ts`
  - Action: Add exports for EmptyStateView, NewSessionView, ChatInputPlaceholder
  - Notes: Maintain alphabetical order of exports

- [ ] Task 8: Update MiddlePanelContent to use new components
  - File: `src/renderer/src/core/shell/MiddlePanelContent.tsx`
  - Action: Replace inline JSX with imported components
  - Notes:
    - Import EmptyStateView, NewSessionView from @renderer/features/sessions/components
    - Replace the `if (!activeTab)` block (empty state JSX) with `<EmptyStateView />`
    - Replace the `if (!activeTab.sessionId)` block (new session JSX) with `<NewSessionView />`
    - Keep the final return block (session view with sessionId) for now (Epic 2b)

- [ ] Task 9: Create MiddlePanelContent tests
  - File: `src/renderer/src/core/shell/MiddlePanelContent.test.tsx`
  - Action: Create test file for the component
  - Notes:
    - Mock useUIStore with different states
    - Mock EmptyStateView and NewSessionView components
    - Test: shows EmptyStateView when no tabs exist
    - Test: shows NewSessionView for tab without sessionId
    - Test: shows session view for tab with sessionId

- [ ] Task 10: Run validation and manual testing
  - Action: Run `npm run validate` and verify all tests pass
  - Notes:
    - Fix any TypeScript errors
    - Fix any lint errors
    - Fix any failing tests
    - Manual test: app starts with empty state showing button
    - Manual test: clicking "New Session" opens folder picker
    - Manual test: selecting folder creates session and opens tab
    - Manual test: new session shows empty conversation with placeholder input

### Acceptance Criteria

- [ ] AC1: Given no session is selected (no active tab), when the middle panel is displayed, then an empty state message appears: "Select a session or start a new one" AND a prominent "New Session" button is visible with Plus icon AND clicking the button triggers the folder picker flow

- [ ] AC2: Given the user starts a new session (tab with no sessionId), when the new session tab opens, then the conversation area is empty AND the ChatInputPlaceholder is visible AND the placeholder text says "Type your message..." AND the autoFocus prop is passed to ChatInputPlaceholder

- [ ] AC3: Given sub-agent architecture note requirement, when NewSessionView is implemented, then a JSDoc comment is present indicating where sub-agent index will appear during streaming (Epic 2b)

- [ ] AC4: Given the "New Session" button is clicked AND folder is selected, when session creation completes, then the session list is refreshed AND the new session opens in a tab

- [ ] AC5: Given the "New Session" button is clicked AND folder picker is canceled, when the dialog closes, then no session is created AND no changes occur

- [ ] AC6: Given an IPC error occurs during session creation, when the error is caught, then it is logged to console.error AND the app does not crash

- [ ] AC7: Given all components are implemented, when `npm run validate` is run, then all TypeScript checks pass AND all tests pass AND no lint errors exist

## Additional Context

### Dependencies

**External Libraries (already installed):**
- `lucide-react` - Icons (Plus, MessageSquare)
- `@testing-library/react` - Component testing
- `@testing-library/user-event` - User interaction testing
- `vitest` - Test runner

**Internal Dependencies:**
- `useUIStore` - Tab management
- `useSessionStore` - Session list refresh
- `getSessionDisplayName` - Display name utility
- `window.grimoireAPI.dialog.selectFolder()` - Folder picker IPC
- `window.grimoireAPI.sessions.create()` - Session creation IPC

### Testing Strategy

**Unit Tests:**
- ChatInputPlaceholder: renders with default/custom placeholder, accepts autoFocus prop
- EmptyStateView: renders message and button, button click flow (5 tests)
- NewSessionView: renders message and placeholder input

**Integration Tests:**
- MiddlePanelContent: shows correct component for each state (3 tests)

**Mock Strategy:**
- grimoireAPI: Mock via Object.defineProperty on window
- Zustand stores: Mock via vi.mock with @renderer alias path
- Async assertions: Use waitFor from @testing-library/react

**Test Pattern Example:**
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockSelectFolder = vi.fn()
const mockCreate = vi.fn()
const mockLoadSessions = vi.fn()
const mockFocusOrOpenSession = vi.fn()

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
      sessions: { create: mockCreate },
      dialog: { selectFolder: mockSelectFolder }
    }
  })
})
```

### Notes

**Risk Items:**
- None identified - this is a straightforward UI component story with well-established patterns

**Known Limitations:**
- ChatInputPlaceholder is non-functional - just visual placeholder for Epic 3a
- autoFocus is documented but not implemented (Epic 3a responsibility)

**Future Considerations:**
- Epic 2b will replace session view placeholder with ConversationView
- Epic 3a will replace ChatInputPlaceholder with actual ChatInput
- Sub-agent streaming indicators will appear in the conversation area (Epic 2b)

**CSS Variables Reference:**
| Variable | Purpose |
| -------- | ------- |
| `--bg-elevated` | Elevated surface background |
| `--bg-hover` | Hover state background |
| `--text-muted` | Secondary/muted text |
| `--accent` | Purple accent color for buttons |
| `--accent-hover` | Hover state for accent |
| `--border` | Subtle borders |
| `--radius-sm` | 4px border radius |
