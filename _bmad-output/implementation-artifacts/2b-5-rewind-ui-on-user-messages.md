# Story 2b.5: Rewind UI on User Messages

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to rewind a conversation from any of my messages**,
So that **I can explore different conversation paths without losing history**.

## Acceptance Criteria

1. **Given** a user message bubble is displayed (not the first message) (FR67h) **When** the user hovers over the message **Then** a [rewind icon] rewind icon appears in the top-right corner of the bubble

2. **Given** the first user message in a conversation **When** the user hovers over it **Then** no rewind icon appears (no prior checkpoint to rewind to)

3. **Given** the user clicks the rewind icon **When** the modal opens **Then** a "Rewind Conversation" modal appears with darkened overlay **And** the modal contains a text area (auto-focused) for the new message **And** Cancel and Send buttons are displayed

4. **Given** the rewind modal is open **When** the user clicks outside the modal, presses Escape, or clicks Cancel **Then** the modal closes without any action

5. **Given** the rewind modal is open with text entered **When** the user clicks Send **Then** the system calls `sessions:rewind` IPC with checkpoint UUID and new message **And** a loading state appears on the Send button **And** on success: modal closes, new forked session becomes active **And** on error: error message displays in the modal

## Tasks / Subtasks

- [x] Task 1: Add rewind icon to MessageBubble (AC: 1, 2) ✅
  - [x] Update `src/renderer/src/features/sessions/components/MessageBubble.tsx`
  - [x] Add `messageIndex` prop to determine if first message (index 0)
  - [x] Add `onRewind?: () => void` prop for rewind callback
  - [x] Import `RotateCcw` icon from `lucide-react`
  - [x] **CRITICAL**: Add `relative` class to container div (currently missing - required for absolute icon positioning)
  - [x] **CRITICAL**: Add `group` class to container div (for hover detection)
  - [x] Show icon on hover (except for first user message)
  - [x] Use `opacity-0 group-hover:opacity-100` pattern (from SubAgentBubble lines 105-108)
  - [x] Position icon in top-right corner with absolute positioning (`absolute top-2 right-2`)
  - [x] Icon styling: muted color, hover state with accent color
  - [x] Update `MessageBubble.test.tsx` with rewind icon tests

- [x] Task 2: Create RewindModal component (AC: 3, 4, 5) ✅
  - [x] Create `src/renderer/src/features/sessions/components/RewindModal.tsx`
  - [x] Use Radix Dialog primitive (`@radix-ui/react-dialog`)
  - [x] Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onRewind: (message: string) => Promise<void>`, `isLoading?: boolean`, `error?: string | null`
  - [x] Darkened overlay with click-to-close
  - [x] Modal container: centered, max-width 500px, rounded corners
  - [x] Title: "Rewind Conversation"
  - [x] Text area: auto-focused, resizable, placeholder text
  - [x] Buttons: Cancel (secondary), Send (primary, accent color)
  - [x] Send button disabled when empty or loading
  - [x] Loading state: spinner on Send button, disabled inputs
  - [x] Error state: red error message below text area
  - [x] Keyboard: Escape closes, Tab navigation
  - [x] Create colocated test file `RewindModal.test.tsx`

- [x] Task 3: Add rewind IPC handler (AC: 5) ✅
  - [x] Update `src/shared/types/ipc.ts` with **NEW** `RewindRequestSchema` (distinct from existing `ForkSessionSchema`)
  - [x] RewindRequestSchema fields: `sessionId` (current session), `checkpointUuid` (message UUID to rewind from), `newMessage` (user's new input)
  - [x] Update `src/preload/index.ts` with `sessions.rewind()` method
  - [x] Update `src/preload/index.d.ts` with rewind type
  - [x] Add handler in `src/main/ipc/sessions.ts` for `sessions:rewind` channel
  - [x] Rewind operation: Fork session from checkpoint, store new message intent
  - [x] **IMPORTANT**: This is NOT a simple fork - it creates a session that will resume from a specific checkpoint
  - [x] **MVP NOTE**: Actual CC spawn with `--checkpoint <uuid>` is Epic 3b; this story creates the fork entry in DB
  - [x] Return `{ sessionId: string }` on success
  - [x] Add tests to `src/main/ipc/sessions.test.ts`
  - [x] Added rewind_context table to schema.sql for Epic 3b CC spawn

- [x] Task 4: Wire up RewindModal in ConversationView (AC: all) ✅
  - [x] Update `src/renderer/src/features/sessions/components/ConversationView.tsx`
  - [x] Add state: `rewindModalOpen`, `rewindTargetUuid: string | null`, `rewindLoading`, `rewindError`
  - [x] Track message index via `messages.map((msg, index) => ...)`
  - [x] Pass `messageIndex` and `onRewind` to MessageBubble for each message
  - [x] Handle rewind click: store message UUID, open modal
  - [x] Render RewindModal at end of component JSX
  - [x] Handle modal submit: call `grimoireAPI.sessions.rewind()`, handle success/error
  - [x] On success: Close modal, add new session to store, switch to it via useUIStore
  - [x] Update ConversationView tests

- [x] Task 5: Update useSessionStore for rewind support (AC: 5) ✅
  - [x] Analyzed store - existing `fetchSessions` will handle new forked sessions
  - [x] No changes needed to useSessionStore - forked session appears in DB and will be fetched
  - [x] Decision: Rewind IPC creates fork entry in DB; session list refreshes automatically

- [x] Task 6: Export new components (AC: all) ✅
  - [x] Update `src/renderer/src/features/sessions/components/index.ts`
  - [x] Export `RewindModal`
  - [x] Export `RewindModalProps` type

- [x] Task 7: Final validation (AC: all) ✅
  - [x] Run `npm run validate` (tsc + vitest + lint) - All 574 tests pass
  - [x] Verify MessageBubble shows rewind icon on hover (not first message) - Tested
  - [x] Verify RewindModal opens and closes correctly - Tested
  - [x] Verify IPC handler creates forked session - Tested
  - [x] Verify success flow: modal closes, new session active - Tested

## Dev Notes

### Previous Story Intelligence (Story 2b.4)

Story 2b.4 established these critical patterns - **MUST FOLLOW**:

**Component Organization:**
- PascalCase files: `MessageBubble.tsx`, `ConversationView.tsx`
- Colocate tests: `ComponentName.test.tsx` beside `ComponentName.tsx`
- Feature folder: `src/renderer/src/features/sessions/components/`

**Existing Components to REUSE:**
- `MessageBubble.tsx` - UPDATE to add rewind icon (lines 24-43)
- `ConversationView.tsx` - Integration target for modal state
- `SubAgentBubble.tsx` - Reference for hover icon pattern (has [->] icon on hover)

**Existing Utilities to REUSE (DO NOT RECREATE):**
- `src/renderer/src/shared/utils/cn.ts` - Conditional class merging (Tailwind)
- `src/renderer/src/shared/utils/index.ts` - Export barrel

**Existing CSS Classes:**
- Hover states: `group` and `group-hover:visible` pattern from SubAgentBubble
- Button styles: Reference existing button patterns in codebase

**Test Pattern (from 2b.4):**
- Use `@testing-library/react` for component tests
- Use `vi.mock()` to mock stores and IPC
- Use `userEvent` for interaction tests

**Color System (Dark Theme):**
- Use CSS variables: `var(--bg-elevated)`, `var(--text-primary)`, `var(--text-muted)`, `var(--border)`
- Accent color: `var(--accent)` for primary actions
- Error: `hsl(0, 65%, 50%)` for error states

### Architecture Compliance

| Element | Convention | This Story |
|---------|------------|------------|
| Component files | PascalCase.tsx | `RewindModal.tsx` |
| Tests | Colocated | `.test.tsx` beside source |
| Styling | Tailwind CSS v4 | Utility classes + CSS variables |
| State | Zustand | For session store |
| IPC | Zod schemas | For type validation |

### UX Design Specifications (CRITICAL)

From `ux-design-specification.md` - Rewind UI:

**User Bubble with Rewind Icon:**
```
Default:
+-------------------------------+
| Message content here...       |
+-------------------------------+
                          14:32

On hover (non-first message):
+-------------------------------+
| Message content here...   [R] |  <- Rewind icon appears top-right
+-------------------------------+
                          14:32
```
- [R] = RotateCcw icon from lucide-react
- Icon appears on hover ONLY for non-first user messages
- Icon position: absolute, top-right of bubble

**Rewind Modal Anatomy:**
```
+-----------------------------------------------------+
|                                                     |
|  +-----------------------------------------------+  |
|  |         Rewind Conversation                   |  |
|  +-----------------------------------------------+  |
|  |                                               |  |
|  |  +---------------------------------------+    |  |
|  |  | Enter new message...                  |    |  |
|  |  |                                       |    |  |
|  |  |                                       |    |  |
|  |  +---------------------------------------+    |  |
|  |                                               |  |
|  |                    [Cancel]  [Send]           |  |
|  +-----------------------------------------------+  |
|                                                     |
+-----------------------------------------------------+
  ^ Darkened overlay (click to close)
```

**Modal Behavior:**
| Action | Result |
|--------|--------|
| Click rewind icon on user message | Open modal, focus text area |
| Click outside modal | Close modal (discard input) |
| Press Escape | Close modal (discard input) |
| Click Cancel | Close modal (discard input) |
| Click Send (empty) | Disabled or show validation |
| Click Send (with text) | Trigger rewind operation |

**Keyboard Navigation:**
- Escape: Close modal
- Tab: Navigate between text area and buttons
- Enter in text area: Newline (NOT submit)

### Rewind IPC Architecture

**Request Schema:**
```typescript
// Add to src/shared/types/ipc.ts
export const RewindRequestSchema = z.object({
  sessionId: z.string().uuid(),      // Current session
  checkpointUuid: z.string().uuid(), // Message UUID to rewind from
  newMessage: z.string().min(1)      // New message to send
})

export type RewindRequest = z.infer<typeof RewindRequestSchema>
```

**IPC Handler Pattern:**
```typescript
// In src/main/ipc/sessions.ts
ipcMain.handle('sessions:rewind', async (_, data: unknown) => {
  const { sessionId, checkpointUuid, newMessage } = RewindRequestSchema.parse(data)

  // 1. Create forked session in database
  const forkedSessionId = crypto.randomUUID()

  // 2. Fork using existing logic
  // MVP: Creates fork entry; actual CC spawn with checkpoint is Epic 3b

  // 3. Return new session ID
  return { sessionId: forkedSessionId }
})
```

**MVP Scope Note:**
The full rewind flow requires Claude Code to be spawned with:
- `--resume <session-id>`
- `--checkpoint <checkpoint-uuid>`
- New message as input

This CC integration is **Epic 3b** scope. For this story (2b.5):
1. UI components are complete and functional
2. IPC handler creates the fork entry in database
3. Returns new session ID so UI can switch to it
4. Actual message sending happens in Epic 3b when user types in new session

### ConversationView Integration

**State Management:**
```typescript
// Add to ConversationView.tsx
// Note: ConversationMessage type already includes `uuid: string` field
// See types.ts - this UUID is captured from CC stream (FR67d)
const [rewindModalOpen, setRewindModalOpen] = useState(false)
const [rewindTargetUuid, setRewindTargetUuid] = useState<string | null>(null)
const [rewindLoading, setRewindLoading] = useState(false)
const [rewindError, setRewindError] = useState<string | null>(null)

// Handler for MessageBubble - creates closure over message UUID
const handleRewindClick = useCallback((messageUuid: string) => {
  setRewindTargetUuid(messageUuid)
  setRewindModalOpen(true)
  setRewindError(null)
}, [])

// CRITICAL: In the message rendering loop, pass the UUID:
// messages.map((msg, index) => (
//   <MessageBubble
//     key={msg.uuid}
//     role={msg.role}
//     content={msg.content}
//     timestamp={msg.timestamp}
//     messageIndex={index}
//     onRewind={msg.role === 'user' && index > 0 ? () => handleRewindClick(msg.uuid) : undefined}
//   />
// ))

// Handler for RewindModal submit
const handleRewindSubmit = useCallback(async (newMessage: string) => {
  if (!rewindTargetUuid) return

  setRewindLoading(true)
  setRewindError(null)

  try {
    const result = await window.grimoireAPI.sessions.rewind({
      sessionId,
      checkpointUuid: rewindTargetUuid,
      newMessage
    })

    // Close modal
    setRewindModalOpen(false)
    setRewindTargetUuid(null)

    // Refresh session list to include new forked session
    // Then switch to the new session using focusOrOpenSession
    const { focusOrOpenSession } = useUIStore.getState()
    focusOrOpenSession(result.sessionId, 'Rewound Session')  // Title will be updated later

  } catch (err) {
    setRewindError(err instanceof Error ? err.message : 'Failed to rewind')
  } finally {
    setRewindLoading(false)
  }
}, [sessionId, rewindTargetUuid])
```

**MessageBubble Props Update:**
```typescript
export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  messageIndex: number        // NEW: To determine if first message
  onRewind?: () => void       // NEW: Callback when rewind clicked
}
```

### MessageBubble Hover Icon Pattern

From existing `SubAgentBubble.tsx` (line 52-58) - reference pattern:
```tsx
{/* Open in tab button - visible on hover */}
<button
  onClick={(e) => { e.stopPropagation(); onOpenInTab?.() }}
  className="absolute top-2 right-2 p-1 rounded invisible group-hover:visible
    bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-colors"
  aria-label="Open in new tab"
>
  <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
</button>
```

**Apply to MessageBubble:**
```tsx
// Add group class to container for hover detection
<div
  role="article"
  className={cn(
    'relative group max-w-[80%] rounded-lg p-3',  // Added: relative, group
    isUser ? /* user styles */ : /* assistant styles */
  )}
>
  {/* Content */}

  {/* Rewind icon - only for user messages, not first */}
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
</div>
```

**Note:** Uses `opacity-0 group-hover:opacity-100` pattern from SubAgentBubble (lines 105-108) rather than `invisible group-hover:visible`.

### RewindModal Component Structure

```tsx
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'

interface RewindModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRewind: (message: string) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

export function RewindModal({
  open,
  onOpenChange,
  onRewind,
  isLoading = false,
  error = null
}: RewindModalProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return
    await onRewind(message.trim())
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-[500px] bg-[var(--bg-elevated)] rounded-lg p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Rewind Conversation
          </Dialog.Title>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter new message..."
            className="w-full h-32 p-3 rounded-md bg-[var(--bg-base)] border border-[var(--border)]
              text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-y"
            autoFocus
            disabled={isLoading}
          />

          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-[var(--bg-base)] text-[var(--text-primary)]
                  hover:bg-[var(--bg-hover)] transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!message.trim() || isLoading}
              className={cn(
                'px-4 py-2 rounded-md transition-colors',
                'bg-[var(--accent)] text-white hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 rounded hover:bg-[var(--bg-hover)]"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### File Structure

**New Files:**
- `src/renderer/src/features/sessions/components/RewindModal.tsx`
- `src/renderer/src/features/sessions/components/RewindModal.test.tsx`

**Modified Files:**
- `src/shared/types/ipc.ts` - Add RewindRequestSchema
- `src/shared/types/ipc.test.ts` - Add rewind schema tests
- `src/preload/index.ts` - Add sessions.rewind method
- `src/preload/index.d.ts` - Add rewind type
- `src/main/ipc/sessions.ts` - Add sessions:rewind handler
- `src/main/ipc/sessions.test.ts` - Add rewind tests
- `src/renderer/src/features/sessions/components/MessageBubble.tsx` - Add rewind icon
- `src/renderer/src/features/sessions/components/MessageBubble.test.tsx` - Add rewind tests
- `src/renderer/src/features/sessions/components/ConversationView.tsx` - Wire up modal
- `src/renderer/src/features/sessions/components/ConversationView.test.tsx` - Add modal tests
- `src/renderer/src/features/sessions/components/index.ts` - Export RewindModal

### Scope Boundaries

**In Scope:**
- MessageBubble rewind icon (hover, non-first message)
- RewindModal component with all states
- IPC handler for sessions:rewind
- ConversationView integration with modal
- Creating fork entry in database

**Out of Scope (Epic 3b):**
- Actual Claude Code spawn with checkpoint UUID
- Streaming response in forked session
- Resume functionality with checkpoint
- Message passing to CC child process

### Dependencies

**Already Installed (verified):**
- `@radix-ui/react-dialog` - For modal (already in package.json)
- `lucide-react` - For RotateCcw icon (already used)
- `zod` - For schema validation (already used)
- `vitest` + `@testing-library/react` - Testing

**Existing IPC Patterns (REUSE):**
- `sessions:fork` in `src/main/ipc/sessions.ts` - Reference for fork logic
- `ForkSessionSchema` in `src/shared/types/ipc.ts` - Reference for schema pattern

### Testing Strategy

**MessageBubble Tests:**
- Shows rewind icon on hover for user messages (not first)
- Does not show rewind icon for first user message
- Does not show rewind icon for assistant messages
- Calls onRewind when icon clicked
- Icon has correct aria-label

**RewindModal Tests:**
- Opens with text area focused
- Closes on overlay click
- Closes on Escape key
- Closes on Cancel click
- Disables Send when empty
- Shows loading state during submission
- Shows error message on failure
- Calls onRewind with message on Send click
- Clears input after successful submission

**IPC Handler Tests:**
- Validates request schema
- Creates fork entry in database
- Returns new session ID
- Handles invalid session ID
- Handles invalid checkpoint UUID

**ConversationView Integration Tests:**
- Opens modal when rewind icon clicked
- Passes correct props to RewindModal
- Handles successful rewind (closes modal, switches session)
- Handles failed rewind (shows error)

### Performance Considerations

- NFR3: Modal open < 100ms (client-side only)
- Modal uses Radix Dialog portal for proper z-index stacking
- Icon visibility controlled by CSS (no JS on hover)

### References

- [Source: epics.md#Epic 2b Story 2b.5] - Acceptance criteria and FR67h mapping
- [Source: ux-design-specification.md#Rewind Modal] - Modal specifications
- [Source: ux-design-specification.md#User Bubble] - Rewind icon placement
- [Source: architecture.md#Session Forking] - Fork database structure
- [Source: 2b-4-navigation-and-loading-states.md#Dev Notes] - Previous story patterns
- [Source: 2a-5-session-forking-database-support.md] - Fork IPC reference

### Project Structure Notes

- All new components in `src/renderer/src/features/sessions/components/`
- IPC types in `src/shared/types/ipc.ts`
- IPC handlers in `src/main/ipc/sessions.ts`
- No conflicts detected with existing structure

## Story Quality Review

### Review Date
2026-01-23 (Pass 2)

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Create-Story Workflow (AUTONOMOUS MODE)

### Review Outcome
**APPROVED** - Story is implementation-ready with accurate codebase alignment.

### Review Pass 2 - Issues Found and Fixed

#### CRITICAL Issues: 0

#### HIGH Issues (1 - fixed)

**H1: Task 1 did not emphasize required CSS class additions**
- Problem: Task 1 listed `relative` and `group` classes but not prominently; current MessageBubble.tsx (line 31-36) has neither class
- Fix: Added **CRITICAL** markers to Task 1 subtasks for `relative` and `group` class additions
- These are required for: (1) absolute icon positioning, (2) hover detection via group-hover

#### MEDIUM Issues (2 - fixed)

**M1: RewindModal code example missing useState import**
- Problem: Code example used `useState` hook but didn't show the import statement
- Fix: Added `import { useState } from 'react'` to RewindModal component structure

**M2: Task 3 didn't clarify RewindRequestSchema is NEW (not reusing ForkSessionSchema)**
- Problem: Could confuse developer into thinking rewind uses existing fork schema
- Fix: Clarified that RewindRequestSchema is a **NEW** schema with different fields (checkpointUuid, newMessage)
- Added explicit field list to Task 3

#### LOW Issues (2 - fixed)

**L1: ConversationView integration didn't clarify UUID source**
- Problem: Code referenced `msg.uuid` without explaining where it comes from
- Fix: Added comment noting that `ConversationMessage` type already includes `uuid: string` (from FR67d stream capture)

**L2: Task 3 relationship to existing sessions:fork unclear**
- Problem: Both fork and rewind create forked sessions, relationship unclear
- Fix: Added note that rewind creates a session that will resume from a specific checkpoint (not a simple fork)

### Review Pass 1 - Previous Issues (retained for history)

**H1 (Pass 1):** Hover pattern used wrong class names - Fixed to `opacity-0 group-hover:opacity-100`
**M1 (Pass 1):** Message UUID passing unclear - Added explicit closure example
**M2 (Pass 1):** Post-rewind session switching not specified - Added `focusOrOpenSession` usage

### Acceptance Criteria Verification
- AC1 (Rewind icon on hover): COMPLETE - MessageBubble updates specified with correct hover pattern
- AC2 (No icon on first message): COMPLETE - `messageIndex > 0` check specified
- AC3 (Modal opens): COMPLETE - RewindModal component fully specified with Radix Dialog
- AC4 (Modal closes): COMPLETE - Click outside, Escape, Cancel behaviors specified
- AC5 (Rewind operation): COMPLETE - IPC handler specified, success/error handling specified

### Technical Alignment Verification
- SubAgentBubble hover pattern: VERIFIED - Uses `opacity-0 group-hover:opacity-100` (lines 105-108)
- @radix-ui/react-dialog: VERIFIED - Already installed in package.json
- ConversationMessage.uuid: VERIFIED - Type already has uuid field for checkpoint identification
- useUIStore.focusOrOpenSession: VERIFIED - Exists in useUIStore.ts (line 114-128)
- MessageBubble current structure: VERIFIED - Lines 24-43, needs `relative` + `group` classes added
- ForkSessionSchema: VERIFIED - Exists in ipc.ts (line 113-118), RewindRequestSchema will be NEW

### Recommendation
Story is complete and ready for dev-story execution.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed successfully without blocking issues.

### Completion Notes List

1. **MessageBubble Rewind Icon (Task 1)**: Added `RotateCcw` icon from lucide-react that appears on hover for non-first user messages. Used `relative group` CSS classes on container and `opacity-0 group-hover:opacity-100` for smooth fade-in effect. Added comprehensive tests covering all edge cases.

2. **RewindModal Component (Task 2)**: Created new modal using Radix UI Dialog primitive. Features auto-focused textarea, proper keyboard navigation (Tab, Escape), loading/error states, and clear message reset when reopening. Used `resetKey` prop pattern to handle message state reset when modal reopens.

3. **IPC Handler (Task 3)**: Added `RewindRequestSchema` to validate sessionId, checkpointUuid, and newMessage. Handler creates forked session in DB with rewind context stored in new `rewind_context` table. This context (checkpoint UUID + new message) will be consumed by Epic 3b when CC is spawned with `--checkpoint` flag.

4. **Database Schema (Task 3 extension)**: Added `rewind_context` table to schema.sql (version bumped to 2) to store checkpoint UUID and new message for forked sessions. This prepares for Epic 3b CC spawn integration.

5. **ConversationView Integration (Task 4)**: Wired up RewindModal with state management for modal open/close, loading, error, and reset key. MessageBubble receives `messageIndex` and `onRewind` callback. Tests verify full flow including error handling.

6. **useSessionStore (Task 5)**: Analysis determined no changes needed - existing `fetchSessions` will pick up new forked sessions from DB automatically.

7. **Component Export (Task 6)**: Added `RewindModal` and `RewindModalProps` to components index.ts.

8. **Validation (Task 7)**: All 574 tests pass. TypeScript compiles without errors. ESLint passes.

### File List

**New Files:**
- `src/renderer/src/features/sessions/components/RewindModal.tsx` - Modal component for rewind confirmation
- `src/renderer/src/features/sessions/components/RewindModal.test.tsx` - 20 tests for modal behavior

**Modified Files:**
- `src/shared/types/ipc.ts` - Added `RewindRequestSchema` and `RewindRequest` type
- `src/shared/types/ipc.test.ts` - Added 9 tests for `RewindRequestSchema`
- `src/shared/db/schema.sql` - Added `rewind_context` table, bumped version to 2
- `src/preload/index.ts` - Added `sessions.rewind()` method
- `src/preload/index.d.ts` - Added rewind type declaration
- `src/main/ipc/sessions.ts` - Added `sessions:rewind` handler with atomic transaction
- `src/main/ipc/sessions.test.ts` - Added 9 tests for rewind handler
- `src/renderer/src/features/sessions/components/MessageBubble.tsx` - Added rewind icon, `messageIndex`, `onRewind` props
- `src/renderer/src/features/sessions/components/MessageBubble.test.tsx` - Added 10 tests for rewind icon
- `src/renderer/src/features/sessions/components/ConversationView.tsx` - Integrated RewindModal, state management
- `src/renderer/src/features/sessions/components/ConversationView.test.tsx` - Added 7 tests for rewind functionality
- `src/renderer/src/features/sessions/components/index.ts` - Exported RewindModal
- `src/renderer/src/core/shell/CloseTabConfirmDialog.test.tsx` - Updated mock to include rewind method

## Senior Developer Review (AI)

### Review Date
2026-01-23 (Code Review Pass 1)

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Code-Review Workflow (AUTONOMOUS MODE)

### Issues Found and Fixed

#### CRITICAL Issues: 0

#### HIGH Issues: 0

#### MEDIUM Issues: 2 (fixed)

**M1: Missing transition-colors on rewind icon**
- File: `src/renderer/src/features/sessions/components/MessageBubble.tsx`
- Problem: The RotateCcw icon had `hover:text-[var(--accent)]` for color change on hover, but no `transition-colors` class for smooth transition effect
- Fix: Added `transition-colors` to the icon's className
- Before: `<RotateCcw className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent)]" />`
- After: `<RotateCcw className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" />`

**M2: Test quality - act() warnings in ConversationView rewind tests**
- File: `src/renderer/src/features/sessions/components/ConversationView.test.tsx`
- Problem: Rewind-related tests triggered React 18+ warnings about state updates not wrapped in act()
- Root Cause: Radix Dialog opens/closes trigger async state updates that need proper act() wrapping
- Fix: Wrapped fireEvent.click calls that interact with modal state in `await act(async () => {...})`
- Affected tests:
  - `opens RewindModal when rewind icon is clicked`
  - `calls onRewind with checkpoint UUID and new message when submitted`
  - `closes modal after successful rewind`
  - `shows error message when rewind fails`
  - `resets rewind state when session changes`

#### LOW Issues: 0

### Verification

- All 574 tests pass
- TypeScript compiles without errors
- ESLint passes
- act() warnings eliminated from rewind tests

### Change Log Entry

| Date | Change | Reviewer |
|------|--------|----------|
| 2026-01-23 | Code Review Pass 1: Fixed 2 MEDIUM issues (transition-colors, test act() warnings) | Claude Opus 4.5 |
| 2026-01-23 | Code Review Pass 2: Fixed 1 MEDIUM issue (Radix Dialog Description warning) | Claude Opus 4.5 |
| 2026-01-23 | Code Review Pass 3: APPROVED - Zero issues found, story marked done | Claude Opus 4.5 |

---

## Senior Developer Review (AI) - Pass 2

### Review Date
2026-01-23 (Code Review Pass 2)

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Code-Review Workflow (AUTONOMOUS MODE)

### Issues Found and Fixed

#### CRITICAL Issues: 0

#### HIGH Issues: 0

#### MEDIUM Issues: 1 (fixed)

**M1: Radix Dialog Description Warning**
- File: `src/renderer/src/features/sessions/components/RewindModal.tsx`
- Lines: 84-103
- Problem: Using manual `aria-describedby` with a `<p>` element instead of Radix's `<Dialog.Description>` component caused test warnings: "Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}."
- Fix: Changed from manual `<p id="rewind-modal-description">` with `aria-describedby` attribute to using `<Dialog.Description asChild>` wrapper around the description paragraph
- Before:
  ```tsx
  <Dialog.Content aria-describedby="rewind-modal-description">
    ...
    <p id="rewind-modal-description" className="sr-only">...</p>
  ```
- After:
  ```tsx
  <Dialog.Content>
    ...
    <Dialog.Description asChild>
      <p className="sr-only">...</p>
    </Dialog.Description>
  ```

#### LOW Issues: 0

### Verification

- All 574 tests pass
- TypeScript compiles without errors
- ESLint passes
- Radix Dialog warnings eliminated from all tests

---

## Senior Developer Review (AI) - Pass 3

### Review Date
2026-01-23 (Code Review Pass 3)

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101) - BMAD Code-Review Workflow (AUTONOMOUS MODE)

### Review Outcome
**APPROVED** - Story implementation is complete and ready for production.

### Issues Found

#### CRITICAL Issues: 0
#### HIGH Issues: 0
#### MEDIUM Issues: 0
#### LOW Issues: 0

### Verification

- All 574 tests pass
- TypeScript compiles without errors
- ESLint passes
- All Acceptance Criteria verified as implemented
- All Tasks marked [x] confirmed as completed
- Code follows project conventions (project-context.md)
- Previous review issues (Pass 1 & Pass 2) all fixed

### Final Status
Story status changed from `review` to `done`.
Sprint status synced: `2b-5-rewind-ui-on-user-messages` -> done

