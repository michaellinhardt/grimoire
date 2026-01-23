# Story 2b.6: Sub-Agent Tab Read-Only

Status: ready-for-dev

## Story

As a **user viewing a sub-agent conversation**,
I want **a read-only view without chat input**,
So that **I understand this is a historical view, not an interactive session**.

## Acceptance Criteria

1. **Given** a sub-agent conversation is opened in a tab (FR67i)
   **When** the tab type is `subagent`
   **Then** the chat input area at the bottom is hidden completely
   **And** the conversation view expands to fill the available space

2. **Given** a main session tab is active
   **When** switching between main session and sub-agent tabs
   **Then** the input area appears/disappears appropriately based on tab type

## Tasks / Subtasks

- [ ] Task 1: Verify existing implementation in MiddlePanelContent.tsx (AC: #1, #2)
  - [ ] 1.1 Review `src/renderer/src/core/shell/MiddlePanelContent.tsx` line 31, 47
  - [ ] 1.2 Confirm `isSubAgentTab = activeTab.type === 'subagent'` logic exists
  - [ ] 1.3 Confirm `{!isSubAgentTab && <ChatInputPlaceholder ... />}` conditional exists
  - [ ] 1.4 Verify conversation view fills height when input hidden (flex-1 pattern)

- [ ] Task 2: Verify tests exist for conditional rendering (AC: #1, #2)
  - [ ] 2.1 Review `src/renderer/src/core/shell/MiddlePanelContent.test.tsx` lines 204-256
  - [ ] 2.2 Confirm test "should NOT show chat input for sub-agent tab (read-only)" exists
  - [ ] 2.3 Confirm test "should show chat input for regular session tab" exists
  - [ ] 2.4 Run `npm run test` to verify tests pass

- [ ] Task 3: Manual verification (AC: #1, #2)
  - [ ] 3.1 Open a main session tab - verify input visible
  - [ ] 3.2 Click sub-agent bubble's "open in tab" button - verify input hidden
  - [ ] 3.3 Switch between tabs - verify input toggles correctly
  - [ ] 3.4 Run `npm run validate` - verify all checks pass

## Dev Notes

### Architecture Patterns (MUST FOLLOW)

- **Zustand store pattern**: Use `useUIStore` to get active tab state
- **Tab type checking**: `tab.type === 'subagent'` for conditional logic
- **Conditional rendering**: Standard React pattern `{condition && <Component />}`

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/src/core/shell/MiddlePanel.tsx` | Add conditional rendering logic for ChatInputPlaceholder |
| `src/renderer/src/core/shell/MiddlePanel.test.tsx` | Add tests for subagent tab behavior (create if needed) |

### Existing Code to Reuse (DO NOT REINVENT)

The infrastructure is **already built**. From `useUIStore.ts`:
```typescript
export interface Tab {
  id: string
  type: 'session' | 'subagent' | 'file'  // <-- subagent type exists
  title: string
  sessionId: string | null
  sessionState: SessionState
}
```

From `TabBar.tsx`:
```typescript
tab.type === 'subagent' && 'tab--subagent'  // <-- already styled
```

The `openSubAgentTab` action already creates subagent tabs correctly.

### Implementation Pattern

```typescript
// In MiddlePanel.tsx
import { useUIStore } from '@renderer/shared/store/useUIStore'

function MiddlePanel() {
  const { tabs, activeTabId } = useUIStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const isSubAgentTab = activeTab?.type === 'subagent'

  return (
    <div className="flex flex-col h-full">
      {/* Conversation area - takes full height when no input */}
      <div className="flex-1 overflow-hidden">
        <ConversationView ... />
      </div>

      {/* Chat input - hidden for subagent tabs */}
      {!isSubAgentTab && <ChatInputPlaceholder ... />}
    </div>
  )
}
```

### Testing Approach

Use `@testing-library/react` with mocked Zustand store:

```typescript
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

describe('MiddlePanel', () => {
  it('hides input for subagent tabs', () => {
    useUIStore.mockReturnValue({
      tabs: [{ id: '1', type: 'subagent', ... }],
      activeTabId: '1'
    })
    render(<MiddlePanel />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
```

### Project Structure Notes

- Path alias: Use `@renderer/*` for imports (configured in tsconfig.web.json)
- Test colocation: Place test file next to component
- Store pattern: Never mutate Zustand state directly

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2b.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tab-Type-Conventions]
- [Source: src/renderer/src/shared/store/useUIStore.ts#Tab-interface]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
