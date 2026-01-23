---
title: 'Rewind UI on User Messages'
slug: '2b-5-rewind-ui-on-user-messages'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React', 'Zustand', 'Radix UI', 'Tailwind CSS v4', 'Zod', 'Electron IPC', 'Vitest', 'Testing Library']
files_to_modify: ['src/renderer/src/features/sessions/components/MessageBubble.tsx', 'src/renderer/src/features/sessions/components/MessageBubble.test.tsx', 'src/renderer/src/features/sessions/components/ConversationView.tsx', 'src/renderer/src/features/sessions/components/ConversationView.test.tsx', 'src/renderer/src/features/sessions/components/index.ts', 'src/shared/types/ipc.ts', 'src/shared/types/ipc.test.ts', 'src/preload/index.ts', 'src/preload/index.d.ts', 'src/main/ipc/sessions.ts', 'src/main/ipc/sessions.test.ts', 'src/shared/db/schema.sql']
code_patterns: ['Zustand stores with actions', 'Radix UI primitives', 'Zod schema validation at IPC boundary', 'CSS variables for theming', 'group hover pattern for hover icons', 'Colocated test files']
test_patterns: ['Vitest with fake timers', 'Testing Library for component tests', 'userEvent for interactions', 'vi.mock for store mocking']
---

# Tech-Spec: Rewind UI on User Messages

**Created:** 2026-01-23
**Source Story:** `/Users/teazyou/dev/grimoire/_bmad-output/implementation-artifacts/2b-5-rewind-ui-on-user-messages.md`

## Overview

### Problem Statement

Users need the ability to rewind conversations from any user message to explore different conversation paths without losing history. Currently, there is no UI mechanism to trigger a rewind operation from a specific message in the conversation view.

### Solution

Add a rewind icon to user message bubbles (except the first message) that appears on hover, and implement a modal dialog for users to enter a new message. When submitted, the system creates a forked session from the checkpoint UUID and switches to the new session.

### Scope

**In Scope:**
- Rewind icon on user message bubbles (hover, non-first message)
- RewindModal component with text input, Cancel/Send buttons
- IPC handler for `sessions:rewind` creating fork entry in database
- ConversationView integration with modal state management
- All associated tests

**Out of Scope (Epic 3b):**
- Actual Claude Code spawn with `--checkpoint <uuid>` flag
- Streaming response in forked session
- Resume functionality with checkpoint
- Message passing to CC child process

## Context for Development

### Codebase Patterns

**Component Organization:**
- Feature components in `src/renderer/src/features/sessions/components/`
- PascalCase file naming: `ComponentName.tsx`
- Colocated tests: `ComponentName.test.tsx` beside source file
- Export barrel in `index.ts`

**State Management:**
- Zustand stores with actions pattern
- `useUIStore` for UI state (tabs, panels, scroll positions)
- `useSessionStore` for session data

**Styling:**
- Tailwind CSS v4 utility classes
- CSS variables for theming: `var(--bg-elevated)`, `var(--text-primary)`, `var(--accent)`
- `cn()` utility for conditional class merging

**Hover Icon Pattern (from SubAgentBubble):**
- Container needs `relative` and `group` classes
- Icon uses `opacity-0 group-hover:opacity-100` for hover visibility
- Absolute positioning: `absolute top-2 right-2`

**IPC Pattern:**
- Zod schema validation at IPC boundary
- Schemas in `src/shared/types/ipc.ts`
- Handlers in `src/main/ipc/sessions.ts`
- Preload API in `src/preload/index.ts`
- Type declarations in `src/preload/index.d.ts`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/features/sessions/components/MessageBubble.tsx` | Current message bubble - ADD rewind icon |
| `src/renderer/src/features/sessions/components/SubAgentBubble.tsx` | Reference for hover icon pattern (lines 99-116) |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Integration target for modal state |
| `src/renderer/src/features/sessions/components/types.ts` | `ConversationMessage` type with `uuid` field |
| `src/shared/types/ipc.ts` | Existing IPC schemas, add `RewindRequestSchema` |
| `src/main/ipc/sessions.ts` | Existing handlers, add `sessions:rewind` |
| `src/preload/index.ts` | Preload API exposure |
| `src/renderer/src/shared/store/useUIStore.ts` | `focusOrOpenSession` action (lines 114-128) |

### Technical Decisions

1. **Use Radix Dialog primitive** - Already installed (`@radix-ui/react-dialog`), provides accessible modal behavior
2. **New RewindRequestSchema (not reusing ForkSessionSchema)** - Different fields needed: `checkpointUuid`, `newMessage`
3. **opacity-based hover (not visibility)** - Consistent with SubAgentBubble pattern
4. **MVP scope: Create fork entry only** - Actual CC spawn with checkpoint deferred to Epic 3b

## Implementation Plan

### Tasks

- [ ] Task 1: Add rewind icon to MessageBubble
  - File: `src/renderer/src/features/sessions/components/MessageBubble.tsx`
  - Action 1: Add `messageIndex: number` and `onRewind?: () => void` to `MessageBubbleProps`
  - Action 2: Import `RotateCcw` icon from `lucide-react`
  - Action 3: Add `relative` and `group` classes to container div (currently missing, required for absolute positioning and hover detection)
  - Action 4: Add rewind button with conditional render: `isUser && messageIndex > 0 && onRewind`
  - Action 5: Style icon with `opacity-0 group-hover:opacity-100` pattern, absolute positioning `top-2 right-2`
  - Notes: Reference SubAgentBubble lines 99-116 for hover button pattern

- [ ] Task 2: Update MessageBubble tests
  - File: `src/renderer/src/features/sessions/components/MessageBubble.test.tsx`
  - Action 1: Add test: shows rewind icon on hover for user messages (not first)
  - Action 2: Add test: does not show rewind icon for first user message (messageIndex=0)
  - Action 3: Add test: does not show rewind icon for assistant messages
  - Action 4: Add test: does not show rewind icon when onRewind is undefined
  - Action 5: Add test: calls onRewind callback when icon clicked
  - Action 6: Add test: icon has correct aria-label

- [ ] Task 3: Create RewindModal component
  - File: `src/renderer/src/features/sessions/components/RewindModal.tsx` (NEW)
  - Action 1: Create component with props: `open`, `onOpenChange`, `onRewind`, `isLoading?`, `error?`
  - Action 2: Use `@radix-ui/react-dialog` for accessible modal
  - Action 3: Implement overlay (bg-black/50), content container (centered, max-w-[500px])
  - Action 4: Add title "Rewind Conversation", textarea with autoFocus, Cancel/Send buttons
  - Action 5: Handle loading state (disabled inputs, "Sending..." text)
  - Action 6: Handle error state (red error message below textarea)
  - Action 7: Implement `handleSubmit` that calls `onRewind(message.trim())`
  - Notes: Modal closes on Escape, overlay click, Cancel button; Enter in textarea = newline (not submit)

- [ ] Task 4: Create RewindModal tests
  - File: `src/renderer/src/features/sessions/components/RewindModal.test.tsx` (NEW)
  - Action 1: Test opens with textarea focused
  - Action 2: Test closes on overlay click, Escape key, Cancel click
  - Action 3: Test Send button disabled when textarea empty
  - Action 4: Test shows loading state during submission
  - Action 5: Test shows error message on failure
  - Action 6: Test calls onRewind with message on Send click

- [ ] Task 5: Add RewindRequestSchema to IPC types
  - File: `src/shared/types/ipc.ts`
  - Action 1: Add `RewindRequestSchema` with fields: `sessionId` (uuid), `checkpointUuid` (uuid), `newMessage` (string min 1, trim whitespace)
  - Action 2: Export `RewindRequest` type
  - Notes: This is a NEW schema, distinct from `ForkSessionSchema`. Use `.transform(s => s.trim())` or validate trimmed length to prevent whitespace-only messages

- [ ] Task 6: Add IPC schema tests
  - File: `src/shared/types/ipc.test.ts`
  - Action 1: Add tests for `RewindRequestSchema` validation
  - Action 2: Test valid request passes
  - Action 3: Test invalid UUIDs rejected
  - Action 4: Test empty message rejected

- [ ] Task 7: Add sessions.rewind to preload API
  - File: `src/preload/index.ts`
  - Action: Add `rewind` method to `sessions` object:
    ```typescript
    rewind: (data: { sessionId: string; checkpointUuid: string; newMessage: string }) =>
      ipcRenderer.invoke('sessions:rewind', data)
    ```

- [ ] Task 8: Update preload type declarations
  - File: `src/preload/index.d.ts`
  - Action: Add to `GrimoireAPI.sessions`:
    ```typescript
    rewind: (data: { sessionId: string; checkpointUuid: string; newMessage: string }) =>
      Promise<{ sessionId: string }>
    ```

- [ ] Task 9: Add sessions:rewind IPC handler
  - File: `src/main/ipc/sessions.ts`
  - Action 1: Import `RewindRequestSchema` from shared types
  - Action 2: Add handler for `sessions:rewind` channel
  - Action 3: Validate request with `RewindRequestSchema.parse(data)`
  - Action 4: Create forked session using existing fork pattern (copy from sessions:fork)
  - Action 5: **CRITICAL**: Store `checkpointUuid` and `newMessage` in session_metadata or a new rewind_context table for Epic 3b to use
  - Action 6: Return `{ sessionId: newSessionId }`
  - Notes: MVP creates fork entry AND stores rewind context; actual CC spawn with checkpoint is Epic 3b but needs stored context

- [ ] Task 10: Add sessions:rewind handler tests
  - File: `src/main/ipc/sessions.test.ts`
  - Action 1: Test validates request schema
  - Action 2: Test creates fork entry in database
  - Action 3: Test returns new session ID
  - Action 4: Test handles invalid session ID
  - Action 5: Test handles invalid checkpoint UUID

- [ ] Task 11: Wire up RewindModal in ConversationView
  - File: `src/renderer/src/features/sessions/components/ConversationView.tsx`
  - Action 1: Add imports: `RewindModal`, `useState`, `useCallback`
  - Action 2: Add state: `rewindModalOpen`, `rewindTargetUuid`, `rewindLoading`, `rewindError`
  - Action 3: Create `handleRewindClick(messageUuid)` callback
  - Action 4: Update message rendering to track index via `messages.map((msg, index) => ...)` - current code uses `messages.map((msg) => {` without index
  - Action 5: Pass `messageIndex` and `onRewind` to MessageBubble for user messages (index > 0)
  - Action 6: Create `handleRewindSubmit(newMessage)` callback with IPC call - use `sessionId` prop from ConversationViewProps
  - Action 7: Render RewindModal at end of component JSX with `onOpenChange` handler that resets ALL modal state (targetUuid, error, loading)
  - Action 8: On success: close modal, call `focusOrOpenSession(result.sessionId, 'Rewound Session')`
  - Notes: `ConversationMessage.uuid` already exists for checkpoint identification

- [ ] Task 12: Update ConversationView tests
  - File: `src/renderer/src/features/sessions/components/ConversationView.test.tsx`
  - Action 1: Test opens modal when rewind icon clicked
  - Action 2: Test passes correct props to RewindModal
  - Action 3: Test handles successful rewind (modal closes, session switches)
  - Action 4: Test handles failed rewind (shows error in modal)

- [ ] Task 13: Export RewindModal from index
  - File: `src/renderer/src/features/sessions/components/index.ts`
  - Action: Add exports for `RewindModal` and `RewindModalProps`

- [ ] Task 14: Add rewind_context table to database schema
  - File: `src/shared/db/schema.sql`
  - Action 1: Add `rewind_context` table with: `session_id` (PK, FK to sessions), `checkpoint_uuid`, `new_message`, `created_at`
  - Action 2: Add FK constraint with ON DELETE CASCADE
  - Notes: This table stores rewind context for Epic 3b CC spawn; data is consumed when CC is spawned with checkpoint

- [ ] Task 15: Final validation
  - Action 1: Run `npm run validate` (tsc + vitest + lint)
  - Action 2: Verify all tests pass
  - Action 3: Manual check: MessageBubble shows rewind icon on hover (not first message)
  - Action 4: Manual check: RewindModal opens, closes, submits correctly
  - Action 5: Manual check: IPC handler creates forked session and stores rewind context

### Acceptance Criteria

- [ ] AC1: Given a user message bubble is displayed (not the first message), when the user hovers over the message, then a rewind icon (RotateCcw) appears in the top-right corner of the bubble
- [ ] AC2: Given the first user message in a conversation, when the user hovers over it, then no rewind icon appears
- [ ] AC3: Given the user clicks the rewind icon, when the modal opens, then a "Rewind Conversation" modal appears with darkened overlay, text area (auto-focused), and Cancel/Send buttons
- [ ] AC4: Given the rewind modal is open, when the user clicks outside the modal, presses Escape, or clicks Cancel, then the modal closes without any action
- [ ] AC5: Given the rewind modal is open with text entered, when the user clicks Send, then the system calls `sessions:rewind` IPC, shows loading state on Send button, and on success closes modal and switches to new forked session

## Additional Context

### Dependencies

**Already Installed (verified in package.json):**
- `@radix-ui/react-dialog` - Modal primitive
- `lucide-react` - RotateCcw icon
- `zod` - Schema validation
- `zustand` - State management
- `vitest` + `@testing-library/react` - Testing

**Internal Dependencies:**
- `useUIStore.focusOrOpenSession` - For switching to new session after rewind
- `ConversationMessage.uuid` - Already exists for checkpoint identification
- Existing fork logic in `sessions:fork` handler - Reference pattern for creating fork entry

### Testing Strategy

**Unit Tests:**
- MessageBubble: Icon visibility based on role and index, click handler
- RewindModal: Open/close states, form submission, loading/error states
- IPC Schema: Validation of RewindRequestSchema

**Integration Tests:**
- ConversationView: Full flow from icon click to modal to IPC call
- IPC Handler: Database fork entry creation

**Manual Testing Steps:**
1. Open a session with at least 2 user messages
2. Hover over second user message - verify icon appears
3. Hover over first user message - verify no icon
4. Click rewind icon - verify modal opens with focus on textarea
5. Click outside/Escape/Cancel - verify modal closes without action
6. Enter text and click Send - verify loading state, then modal closes
7. Verify new session appears in session list and is active

### Notes

**High-Risk Items:**
- CSS class addition (`relative`, `group`) to MessageBubble container - existing tests may need adjustment for class assertions
- Message index tracking in ConversationView - ensure consistent index calculation
- Modal state cleanup on close - `onOpenChange` handler must reset ALL state (targetUuid, error, loading) or stale state persists on reopen
- Database schema change - new `rewind_context` table must be created before handler can use it

**Known Limitations:**
- MVP creates fork entry AND stores rewind context; actual CC spawn with checkpoint is Epic 3b
- New session will appear but won't have actual rewound conversation until Epic 3b
- Rewind context is stored in separate table for Epic 3b to consume when spawning CC

**Future Considerations:**
- Visual indication in session list for forked/rewound sessions
- Undo rewind operation
- Batch rewind (multiple checkpoints)

### Code References

**MessageBubble Rewind Icon Implementation:**
```tsx
// Add to container div className:
className={cn(
  'relative group max-w-[80%] rounded-lg p-3',  // Added: relative, group
  isUser ? /* user styles */ : /* assistant styles */
)}

// Add rewind button (after content, inside container):
{isUser && messageIndex > 0 && onRewind && (
  <button
    onClick={(e) => { e.stopPropagation(); onRewind() }}
    className="absolute top-2 right-2 p-1 rounded transition-opacity
      opacity-0 group-hover:opacity-100
      bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]"
    aria-label="Rewind conversation from this message"
  >
    <RotateCcw className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent)]" />
  </button>
)}
```

**RewindRequestSchema:**
```typescript
export const RewindRequestSchema = z.object({
  sessionId: z.string().uuid(),
  checkpointUuid: z.string().uuid(),
  newMessage: z.string().trim().min(1, { message: 'Message cannot be empty' })
})

export type RewindRequest = z.infer<typeof RewindRequestSchema>
```

**IPC Handler Pattern:**
```typescript
ipcMain.handle('sessions:rewind', async (_, data: unknown) => {
  const { sessionId, checkpointUuid, newMessage } = RewindRequestSchema.parse(data)

  // Validate parent session exists (reuse logic from sessions:fork)
  const db = getDatabase()
  const parent = db.prepare('SELECT folder_path FROM sessions WHERE id = ?')
    .get(sessionId) as { folder_path: string } | undefined

  if (!parent) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const newSessionId = randomUUID()
  const now = Date.now()

  // Atomic transaction: create fork + store rewind context
  const rewindTransaction = db.transaction(() => {
    // Create forked session entry
    db.prepare(`
      INSERT INTO sessions (id, folder_path, created_at, updated_at, forked_from_session_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(newSessionId, parent.folder_path, now, now, sessionId)

    // Store rewind context for Epic 3b (checkpoint UUID + new message)
    // Using session_metadata's model field temporarily OR create rewind_context table
    // Option A: Store in JSON in a new column/table
    // Option B: Store checkpointUuid and newMessage for later CC spawn
    db.prepare(`
      INSERT INTO rewind_context (session_id, checkpoint_uuid, new_message, created_at)
      VALUES (?, ?, ?, ?)
    `).run(newSessionId, checkpointUuid, newMessage, now)

    // Hide parent (consistent with fork behavior)
    db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(sessionId)
  })

  rewindTransaction()

  return { sessionId: newSessionId }
})
```

**NOTE:** Add `rewind_context` table to schema.sql:
```sql
CREATE TABLE IF NOT EXISTS rewind_context (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  checkpoint_uuid TEXT NOT NULL,
  new_message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

**ConversationView Modal State Management:**
```typescript
// State for rewind modal
const [rewindModalOpen, setRewindModalOpen] = useState(false)
const [rewindTargetUuid, setRewindTargetUuid] = useState<string | null>(null)
const [rewindLoading, setRewindLoading] = useState(false)
const [rewindError, setRewindError] = useState<string | null>(null)

// CRITICAL: Handle modal close to reset ALL state (prevents stale state on reopen)
const handleModalOpenChange = useCallback((open: boolean) => {
  setRewindModalOpen(open)
  if (!open) {
    // Reset all modal state when closing
    setRewindTargetUuid(null)
    setRewindError(null)
    setRewindLoading(false)
  }
}, [])

// Use handleModalOpenChange instead of setRewindModalOpen in RewindModal props
<RewindModal
  open={rewindModalOpen}
  onOpenChange={handleModalOpenChange}  // NOT setRewindModalOpen
  onRewind={handleRewindSubmit}
  isLoading={rewindLoading}
  error={rewindError}
/>
```

**ConversationView Message Rendering with Index:**
```typescript
// Update existing map to include index for MessageBubble props
{messages.map((msg, index) => {
  // ... existing tool/subagent logic ...

  // Regular message without tool blocks or sub-agents
  return (
    <div
      key={msg.uuid}
      ref={(el) => {
        if (el) messageRefs.current.set(msg.uuid, el)
      }}
    >
      <MessageBubble
        role={msg.role}
        content={msg.content}
        timestamp={msg.timestamp}
        messageIndex={index}
        onRewind={msg.role === 'user' && index > 0 ? () => handleRewindClick(msg.uuid) : undefined}
      />
    </div>
  )
})}
```
