# Tech Spec: Story 3a-1 Chat Input Component

**Status:** Ready for Implementation
**Story:** 3a-1
**Epic:** 3a (Conversational Interaction)

---

## Overview

This tech spec covers the implementation of the ChatInput component, which provides users with a text input area to compose and send messages to Claude Code. The component replaces the existing ChatInputPlaceholder and includes auto-expanding textarea, keyboard shortcuts, and conditional auto-focus behavior.

### Goals
1. Create a functional ChatInput component with controlled textarea input
2. Implement auto-expanding textarea (40px min, 200px max height)
3. Support Enter to send and Shift+Enter for new lines
4. Implement conditional auto-focus (new sessions focus, existing sessions do not)
5. Display dynamic placeholder based on session state (has messages or not)
6. Maintain existing sub-agent tab behavior (hide chat input)
7. Remove ChatInputPlaceholder after ChatInput is integrated

### Non-Goals (Out of Scope)
- Message sending logic (Story 3a-2 implements the send flow)
- Backend integration for message persistence (Epic 3b concern)
- Rich text formatting or markdown preview
- File attachment support
- Voice input

---

## Files to Reference

| File | Purpose | Action |
|------|---------|--------|
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx` | Current placeholder component | DELETE (after ChatInput works) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx` | Placeholder tests | DELETE (after ChatInput works) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/NewSessionView.tsx` | New session view using placeholder | MODIFY (replace ChatInputPlaceholder with ChatInput) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/index.ts` | Component exports | MODIFY (export ChatInput, remove ChatInputPlaceholder) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx` | Middle panel with conversation | MODIFY (replace ChatInputPlaceholder with ChatInput) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/cn.ts` | Class name utility | READ ONLY |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` | UI state store (SessionState type) | READ ONLY |

---

## Codebase Patterns to Follow

### Component Patterns
- Functional components with explicit `ReactElement` return type
- Props interfaces defined with `interface ComponentNameProps`
- JSDoc comments above component with `@param` for each prop
- Use `cn()` utility for conditional class names
- Colocated tests: `Component.test.tsx` next to `Component.tsx`

### Styling Patterns
- CSS variables: `var(--text-primary)`, `var(--text-muted)`, `var(--bg-hover)`, `var(--border)`, `var(--accent)`, `var(--radius-sm)`
- Tailwind utility classes
- Icons from `lucide-react` library

### Testing Patterns
- Use `@testing-library/react` with `screen` and `fireEvent`
- Use `vi.fn()` for callback mocks
- Use `userEvent` for user interaction simulation
- Import from `vitest` for `describe`, `it`, `expect`, `beforeEach`

### Import Patterns
- Use `@renderer/` alias for cross-feature imports
- Use relative paths within same feature folder
- Use `import type { X }` for type-only imports

---

## Implementation Tasks

### Task 1: Create ChatInput Component (AC: #1, #4)

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.tsx`

**Implementation:**

```typescript
import { useState, useRef, useCallback, useEffect, type ReactElement, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'

export interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void
  /** Disable input during processing */
  disabled?: boolean
  /** Custom placeholder text (derived from hasMessages by default) */
  placeholder?: string
  /** Auto-focus on mount for new sessions */
  autoFocus?: boolean
  /** Whether session has existing messages (for placeholder logic) */
  hasMessages?: boolean
}

/**
 * Chat input component for composing and sending messages.
 * Features auto-expanding textarea, Enter to send, Shift+Enter for newlines.
 *
 * @param onSend - Callback when user sends a message
 * @param disabled - Disable input during processing
 * @param placeholder - Custom placeholder text
 * @param autoFocus - Auto-focus on mount for new sessions
 * @param hasMessages - Whether session has existing messages
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
  autoFocus = false,
  hasMessages = false
}: ChatInputProps): ReactElement {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Derive placeholder from hasMessages if not provided
  const displayPlaceholder = placeholder ?? (hasMessages ? 'Type anything to continue...' : 'Type your message...')

  // Auto-focus on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Adjust textarea height based on content
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto' // Reset to recalculate
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [])

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      adjustHeight()
    },
    [adjustHeight]
  )

  // Handle keyboard events (Enter to send, Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const trimmed = value.trim()
        if (trimmed && !disabled) {
          onSend(trimmed)
          setValue('')
          // Reset height after clearing
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
          }
        }
      }
      // Shift+Enter: default behavior (newline) allowed
    },
    [value, disabled, onSend]
  )

  // Handle send button click
  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
      // Reset height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, disabled, onSend])

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="h-auto border-t border-[var(--border)] flex items-end px-4 py-3 gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={displayPlaceholder}
        rows={1}
        className={cn(
          'flex-1 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 py-2',
          'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
          'resize-none min-h-[40px] max-h-[200px] overflow-y-auto',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Message input"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={cn(
          'p-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white',
          'hover:bg-[var(--accent)]/80 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Send message"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
```

---

### Task 2: Create ChatInput Tests (AC: #1-5)

**New File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.test.tsx`

**Implementation:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  const mockOnSend = vi.fn()

  beforeEach(() => {
    mockOnSend.mockClear()
  })

  describe('rendering', () => {
    it('renders textarea and send button', () => {
      render(<ChatInput onSend={mockOnSend} />)

      expect(screen.getByRole('textbox', { name: /message input/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('renders default placeholder when hasMessages is false', () => {
      render(<ChatInput onSend={mockOnSend} hasMessages={false} />)

      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
    })

    it('renders continue placeholder when hasMessages is true', () => {
      render(<ChatInput onSend={mockOnSend} hasMessages={true} />)

      expect(screen.getByPlaceholderText('Type anything to continue...')).toBeInTheDocument()
    })

    it('renders custom placeholder when provided', () => {
      render(<ChatInput onSend={mockOnSend} placeholder="Custom text" />)

      expect(screen.getByPlaceholderText('Custom text')).toBeInTheDocument()
    })
  })

  describe('input behavior', () => {
    it('updates value on input change', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello world')

      expect(textarea).toHaveValue('Hello world')
    })

    it('disables send button when input is empty', () => {
      render(<ChatInput onSend={mockOnSend} />)

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('disables send button when input is whitespace only', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '   ')

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('enables send button when input has content', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeEnabled()
    })
  })

  describe('send behavior', () => {
    it('calls onSend with trimmed message when Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '  Hello world  ')
      await user.keyboard('{Enter}')

      expect(mockOnSend).toHaveBeenCalledWith('Hello world')
      expect(textarea).toHaveValue('')
    })

    it('calls onSend when send button is clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')

      const button = screen.getByRole('button', { name: /send message/i })
      await user.click(button)

      expect(mockOnSend).toHaveBeenCalledWith('Hello')
      expect(textarea).toHaveValue('')
    })

    it('does not call onSend when Enter is pressed with empty input', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.click(textarea)
      await user.keyboard('{Enter}')

      expect(mockOnSend).not.toHaveBeenCalled()
    })

    it('inserts newline on Shift+Enter', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Line 1')
      await user.keyboard('{Shift>}{Enter}{/Shift}')
      await user.type(textarea, 'Line 2')

      expect(textarea).toHaveValue('Line 1\nLine 2')
      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('disables textarea when disabled prop is true', () => {
      render(<ChatInput onSend={mockOnSend} disabled />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })

    it('disables send button when disabled prop is true', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} disabled />)

      // Even if we could type (which we can't due to disabled), button should be disabled
      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('does not call onSend when disabled', async () => {
      // Start with enabled, type, then render disabled
      const { rerender } = render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Hello' } })

      rerender(<ChatInput onSend={mockOnSend} disabled />)

      const button = screen.getByRole('button', { name: /send message/i })
      fireEvent.click(button)

      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('auto-focus behavior', () => {
    it('focuses textarea on mount when autoFocus is true', () => {
      render(<ChatInput onSend={mockOnSend} autoFocus />)

      const textarea = screen.getByRole('textbox')
      expect(document.activeElement).toBe(textarea)
    })

    it('does not focus textarea on mount when autoFocus is false', () => {
      render(<ChatInput onSend={mockOnSend} autoFocus={false} />)

      const textarea = screen.getByRole('textbox')
      expect(document.activeElement).not.toBe(textarea)
    })

    it('does not focus textarea on mount by default', () => {
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      expect(document.activeElement).not.toBe(textarea)
    })
  })
})
```

---

### Task 3: Update MiddlePanelContent to Use ChatInput (AC: #1, #3, #6)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx`

**Actions:**

1. Replace `ChatInputPlaceholder` import with `ChatInput`
2. Add `useCallback` to React imports
3. Update the JSX to use ChatInput with appropriate props
4. Pass `autoFocus={false}` for existing sessions
5. Pass `hasMessages` based on message count
6. Pass `disabled` based on sessionState
7. Pass stub `onSend` callback (will be implemented in Story 3a-2)

**Change 1 - Update imports (lines 1-10):**

Replace:
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
```

With:
```typescript
import { useMemo, useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import {
  ChatInput,
  EmptyStateView,
  NewSessionView,
  ConversationView,
  createMockMessages
} from '@renderer/features/sessions/components'
import type { ReactElement } from 'react'
```

**Change 2 - Add handleSend callback (insert after line 18, before "// No tabs open" comment):**
```typescript
  // Stub send handler - will be implemented in Story 3a-2
  const handleSend = useCallback((message: string) => {
    // TODO: Story 3a-2 will implement the actual send flow
    console.log('[Story 3a-2 placeholder] Send message:', message)
  }, [])
```

**Change 3 - Update ChatInput usage (lines 45-48):**

Replace:
```typescript
      {/* Chat input placeholder - will be implemented in Epic 3a */}
      {/* NOTE: Sub-agent tabs hide chat input (read-only view) */}
      {/* NOTE: Existing sessions do NOT auto-focus per UX spec (only new sessions auto-focus) */}
      {!isSubAgentTab && <ChatInputPlaceholder placeholder="Type your message..." />}
```

With:
```typescript
      {/* Chat input - sub-agent tabs hide this (read-only view) */}
      {/* NOTE: Existing sessions do NOT auto-focus per UX spec (only new sessions auto-focus) */}
      {!isSubAgentTab && (
        <ChatInput
          onSend={handleSend}
          autoFocus={false}
          hasMessages={mockMessages.length > 0}
          disabled={activeTab.sessionState === 'working'}
          placeholder="Type your message..."
        />
      )}
```

---

### Task 4: Update NewSessionView to Use ChatInput (AC: #2)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/NewSessionView.tsx`

**Actions:**

1. Replace `ChatInputPlaceholder` import with `ChatInput`
2. Update the JSX to use ChatInput with appropriate props
3. Pass `autoFocus={true}` for new sessions (UX11)
4. Pass `hasMessages={false}` since new sessions have no messages
5. Pass stub `onSend` callback (will be implemented in Story 3a-2)

**Before:**
```typescript
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
        <p className="text-sm text-[var(--text-muted)]">New session - start typing to begin</p>
      </div>
      {/* ChatInput placeholder - will be replaced with actual ChatInput in Epic 3a */}
      {/* autoFocus indicates this input should be focused when implemented (UX11) */}
      <ChatInputPlaceholder autoFocus placeholder="Type your message..." />
    </div>
  )
}
```

**After:**
```typescript
import { useCallback, type ReactElement } from 'react'
import { ChatInput } from './ChatInput'

/**
 * View for a new session with no messages yet.
 * Shows empty conversation area with chat input.
 * Sub-agent index will appear during streaming (Epic 2b - AC3).
 */
export function NewSessionView(): ReactElement {
  // Stub send handler - will be implemented in Story 3a-2
  const handleSend = useCallback((message: string) => {
    // TODO: Story 3a-2 will implement the actual send flow with UUID generation
    console.log('[Story 3a-2 placeholder] New session send:', message)
  }, [])

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* Conversation area - sub-agent index will appear here during streaming (Epic 2b) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">New session - start typing to begin</p>
      </div>
      {/* ChatInput with auto-focus for new sessions (UX11) */}
      <ChatInput
        onSend={handleSend}
        autoFocus={true}
        hasMessages={false}
        disabled={false}
        placeholder="Type your message..."
      />
    </div>
  )
}
```

---

### Task 5: Update Component Index Exports (AC: #1)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/index.ts`

**Actions:**

1. Replace `ChatInputPlaceholder` export with `ChatInput` and `ChatInputProps`
2. Keep ALL other existing exports unchanged (EmptyStateView, NewSessionView, SessionList, etc.)

**Change (line 1 only):**

Replace:
```typescript
export { ChatInputPlaceholder } from './ChatInputPlaceholder'
```

With:
```typescript
export { ChatInput } from './ChatInput'
export type { ChatInputProps } from './ChatInput'
```

**IMPORTANT:** All other exports (lines 2-43) must remain unchanged. This file exports many components from Stories 2b.1-2b.5. Only the first line changes.

---

### Task 6: Update MiddlePanelContent Tests (AC: #1, #6)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.test.tsx`

**Actions:**

1. Update mock from `ChatInputPlaceholder` to `ChatInput` with proper props
2. Update existing test assertions to check for ChatInput
3. Add new tests for disabled state during 'working' sessionState

**Change 1 - Update mock (replace lines 16-18 in the vi.mock block):**

Replace:
```typescript
  ChatInputPlaceholder: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="chat-input-placeholder">{placeholder || 'Type your message...'}</div>
  ),
```

With:
```typescript
  ChatInput: ({
    onSend,
    disabled,
    placeholder,
    autoFocus,
    hasMessages
  }: {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
    autoFocus?: boolean
    hasMessages?: boolean
  }) => (
    <div data-testid="chat-input">
      <textarea
        data-testid="chat-input-textarea"
        aria-label="Message input"
        disabled={disabled}
        placeholder={placeholder}
        data-autofocus={autoFocus}
        data-has-messages={hasMessages}
      />
      <button aria-label="Send message" disabled={disabled} onClick={() => onSend('test')}>
        Send
      </button>
    </div>
  ),
```

**Change 2 - Update existing test assertions:**

In the test "should show session view with chat input placeholder for existing session" (around line 114), update:

Replace:
```typescript
    expect(screen.getByTestId('chat-input-placeholder')).toBeInTheDocument()
```

With:
```typescript
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
```

**Change 3 - Update sub-agent tests (around line 239):**

Replace:
```typescript
      expect(screen.queryByTestId('chat-input-placeholder')).not.toBeInTheDocument()
```

With:
```typescript
      expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
```

**Change 4 - Update regular session test (around line 256):**

Replace:
```typescript
      expect(screen.getByTestId('chat-input-placeholder')).toBeInTheDocument()
```

With:
```typescript
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
```

**Change 5 - Add new test for disabled state (add to existing describe block):**

```typescript
  describe('ChatInput disabled state', () => {
    it('should disable ChatInput when sessionState is working', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'working'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      const textarea = screen.getByTestId('chat-input-textarea')
      expect(textarea).toBeDisabled()
    })

    it('should enable ChatInput when sessionState is idle', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      const textarea = screen.getByTestId('chat-input-textarea')
      expect(textarea).not.toBeDisabled()
    })
  })
```

---

### Task 7: Update NewSessionView Tests (AC: #2)

**File:** `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/NewSessionView.test.tsx`

**Actions:**

1. Update test assertions to check for ChatInput instead of ChatInputPlaceholder
2. Verify autoFocus={true} behavior (textarea is focused on mount)
3. Verify hasMessages={false} placeholder text

**IMPORTANT:** The existing test file has an outdated assertion expecting `'Type your message... (input coming in Epic 3a)'` but the actual placeholder is `'Type your message...'`. This needs correction.

**Complete replacement for NewSessionView.test.tsx:**

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NewSessionView } from './NewSessionView'

describe('NewSessionView', () => {
  it('renders empty state message', () => {
    render(<NewSessionView />)
    expect(screen.getByText('New session - start typing to begin')).toBeInTheDocument()
  })

  it('renders ChatInput with auto-focus', () => {
    render(<NewSessionView />)

    const textarea = screen.getByRole('textbox', { name: /message input/i })
    expect(textarea).toBeInTheDocument()
    expect(document.activeElement).toBe(textarea)
  })

  it('renders new session placeholder text', () => {
    render(<NewSessionView />)

    // Note: placeholder is 'Type your message...' for new sessions per AC5
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('renders send button', () => {
    render(<NewSessionView />)

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('has proper layout structure', () => {
    const { container } = render(<NewSessionView />)
    // Check for flex column layout
    const mainContainer = container.querySelector('.flex-1.flex.flex-col')
    expect(mainContainer).toBeInTheDocument()
    // Check for conversation area
    const conversationArea = container.querySelector('.flex-1.flex.items-center.justify-center')
    expect(conversationArea).toBeInTheDocument()
  })
})
```

---

### Task 8: Delete ChatInputPlaceholder Files (AC: #1)

**IMPORTANT:** Only perform this task AFTER all tests pass with the new ChatInput component.

**Files to Delete:**
1. `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`
2. `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx`

**Verification:**
- Run `npm run validate` to ensure no remaining references to ChatInputPlaceholder
- Check that build completes without errors

---

### Task 9: Final Verification

**Run full test suite:**
```bash
npm run validate
```

**Manual verification checklist:**
- [ ] New session tab: input is auto-focused
- [ ] Existing session tab: input is NOT auto-focused
- [ ] Type in input: text appears
- [ ] Press Enter: message is "sent" (logged to console for now)
- [ ] Press Shift+Enter: new line inserted
- [ ] Empty input: send button disabled
- [ ] Session in 'working' state: input disabled
- [ ] Sub-agent tab: no input displayed
- [ ] Placeholder text changes based on hasMessages

---

## Acceptance Criteria Verification

| AC | Description | Implementation | Test |
|----|-------------|----------------|------|
| AC1 | Chat input at bottom with send button | Task 1: ChatInput component | ChatInput.test.tsx |
| AC2 | New session auto-focus | Tasks 1, 4: autoFocus prop | ChatInput.test.tsx, NewSessionView.test.tsx |
| AC3 | Existing sessions no auto-focus | Tasks 1, 3: autoFocus={false} | MiddlePanelContent.test.tsx |
| AC4 | Enter sends, Shift+Enter newline | Task 1: handleKeyDown | ChatInput.test.tsx |
| AC5 | Dynamic placeholder | Task 1: hasMessages prop | ChatInput.test.tsx |
| AC6 | Sub-agent tabs hide input | Task 3: isSubAgentTab check | MiddlePanelContent.test.tsx |

---

## Dependencies

### Required Before This Story
- None (this is the first story in Epic 3a)

### Blocks Future Stories
- **Story 3a-2 (Message Send Flow):** Will implement the actual onSend callback logic

---

## Testing Strategy

### Unit Tests
| File | Test Focus |
|------|------------|
| `ChatInput.test.tsx` | Component rendering, input behavior, send behavior, disabled state, auto-focus |

### Component Integration Tests
| File | Test Focus |
|------|------------|
| `MiddlePanelContent.test.tsx` | ChatInput visibility for session vs sub-agent tabs, disabled state |
| `NewSessionView.test.tsx` | ChatInput auto-focus, placeholder |

### Manual Testing
- Verify auto-expanding textarea behavior visually
- Verify CSS styling matches design system
- Test keyboard shortcuts work correctly

---

## Risk Areas

1. **Auto-expand Height Calculation:** The scrollHeight-based approach may have edge cases with certain fonts or zoom levels. Monitor for visual glitches.

2. **Focus Management:** Auto-focus on new sessions must not interfere with other focus handlers. Ensure focus only happens on mount.

3. **Placeholder Removal:** After deleting ChatInputPlaceholder, ensure no other components reference it.

4. **Test Updates:** Both MiddlePanelContent.test.tsx and NewSessionView.test.tsx may have existing assertions that need updating.

---

## Checklist Verification

- [x] ACTIONABLE: Every task has clear file path AND specific action
- [x] LOGICAL: Tasks ordered by dependency (component first, then integration, then cleanup)
- [x] TESTABLE: All ACs have corresponding test cases
- [x] COMPLETE: No placeholders, no "TBD", no "TODO" (except intentional stub comments)
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
