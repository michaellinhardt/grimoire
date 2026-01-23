# Story 3a.2: Message Send Flow

Status: done

## Story

As a **user**,
I want **my messages to be sent and persisted reliably**,
So that **I never lose my input even if something goes wrong**.

## Acceptance Criteria

1. **AC1: UUID generation for new sessions (FR52)**
   - Given the user types in a new session (no UUID yet)
   - When they send the first message
   - Then a Session UUID is generated before CC spawn
   - And the session is created in the database with this UUID

2. **AC2: User message appears immediately (FR49)**
   - Given the user sends a message
   - When the send action triggers
   - Then the user message appears immediately in the conversation
   - And the message is persisted to the session state
   - And the CC child process spawn is initiated (via IPC)

3. **AC3: Interact with any session (FR51)**
   - Given the user can interact with any session
   - When selecting a historical session and typing
   - Then the message is sent to resume that session
   - And the conversation continues seamlessly

4. **AC4: Input preserved on spawn failure (FR53)**
   - Given the CC spawn fails
   - When an error occurs
   - Then the user's message is still saved in the session
   - And an error message is displayed in the conversation
   - And the user can retry by sending another message

5. **AC5: Thinking indicator during send (FR41 partial)**
   - Given a message is sent successfully
   - When waiting for response
   - Then the thinking indicator appears
   - And the send button is disabled until response completes or user aborts

6. **AC6: Input disabled during processing**
   - Given a message has been sent
   - When the session state is 'working'
   - Then the input field is disabled
   - And the send button shows disabled state
   - And user cannot type until processing completes

## Tasks / Subtasks

### Task 1: Create message sending IPC handler (AC: #1, #2, #3)
- [x] 1.1 Add `sessions:sendMessage` IPC channel in `src/main/ipc/sessions.ts` (COMPLETED)
  - Import: `SendMessageSchema` from shared types (create in 1.2)
  - Validate: `{ sessionId: string, message: string, folderPath: string, isNewSession?: boolean }`
  - If `isNewSession` is true, create session in DB first (use existing `sessions:create` logic, lines 99-113)
  - Return: `{ success: boolean, error?: string }`
  - Add after the rewind handler (after line 305 in sessions.ts)
- [x] 1.2 Add Zod schema for send message in `src/shared/types/ipc.ts` (COMPLETED)
  - Add to ipc.ts after RewindRequestSchema (around line 170+)
  ```typescript
  // ============================================================
  // Message Send Schemas (Story 3a.2)
  // ============================================================

  export const SendMessageSchema = z.object({
    sessionId: z.string().uuid(),
    message: z.string().min(1),
    folderPath: z.string().min(1), // REQUIRED for all sends (new or existing)
    isNewSession: z.boolean().optional().default(false)
  })
  export type SendMessageRequest = z.infer<typeof SendMessageSchema>
  ```
  - Note: `SpawnRequestSchema` already exists in ipc.ts (line 5-9) with similar structure but this schema adds the IPC request validation for send operations
- [x] 1.3 Update preload to expose `sessions.sendMessage` (COMPLETED)
  - Add to `src/preload/index.ts` grimoireAPI.sessions object
  - Type: `sendMessage: (req: { sessionId: string, message: string, folderPath: string, isNewSession?: boolean }) => Promise<{ success: boolean, error?: string }>`
- [x] 1.4 Update preload type declarations (COMPLETED)
  - Add to `src/preload/index.d.ts` GrimoireAPI interface
  - Import `SendMessageRequest` from `../shared/types/ipc`
  - Add to sessions object:
    ```typescript
    sendMessage: (data: SendMessageRequest) => Promise<{ success: boolean; error?: string }>
    ```
  - This follows the same pattern as other methods like `upsertMetadata`

### Task 2: Create local message store for optimistic updates (AC: #2, #4)
- [x] 2.1 Create `useConversationStore.ts` in `src/renderer/src/features/sessions/store/` (COMPLETED)
  - State: `messages: Map<string, ConversationMessage[]>` (keyed by sessionId)
  - State: `pendingMessages: Map<string, ConversationMessage>` (optimistic messages awaiting confirmation)
  - Actions: `addMessage(sessionId, message)`, `removePendingMessage(sessionId, messageId)`, `getMessages(sessionId)`
  - Import types from existing `types.ts`
- [x] 2.2 Implement optimistic update pattern (COMPLETED)
  - `addOptimisticMessage(sessionId, content)`: Creates temp message with UUID, adds to messages
  - `confirmMessage(sessionId, tempId, realId)`: Updates temp UUID to real UUID after success
  - `revertMessage(sessionId, tempId)`: Removes message on failure (but keeps for error display)
- [x] 2.3 Add error message display logic (COMPLETED)
  - On spawn failure, add system message with error content
  - Error messages have distinct styling (muted, italic per FR58 pattern)
- [x] 2.4 Write unit tests for useConversationStore (COMPLETED)
  - Test: addOptimisticMessage creates message with temp UUID
  - Test: confirmMessage updates UUID
  - Test: error messages are preserved

### Task 3: Implement send flow in MiddlePanelContent (AC: #2, #3, #5, #6)
- [x] 3.1 Create `useSendMessage` hook in `src/renderer/src/features/sessions/hooks/` (COMPLETED)
  - Accept: `sessionId: string | null`, `folderPath: string`, `isNewSession: boolean`
  - **CRITICAL:** folderPath MUST be derived by caller and passed in:
    - For existing sessions: Look up session in useSessionStore by sessionId and extract `session.folderPath`
    - For new sessions: Get from tab context if available (future flow)
    - If folderPath is missing and not new session, this is a bug in the caller
  - Use `useConversationStore` for optimistic updates
  - Use `useUIStore` to update tab session state to 'working'
  - Call `window.grimoireAPI.sessions.sendMessage` via IPC with folderPath parameter
  - Handle success: wait for response (Story 3a.3 will complete this)
  - Handle error: show error, revert to 'idle' state
- [x] 3.2 Update `MiddlePanelContent.tsx` to use send hook (COMPLETED)
  - Replace `ChatInputPlaceholder` with actual `ChatInput` component (from Story 3a-1)
  - Get `sendMessage` function from hook
  - Pass to ChatInput's `onSend` prop
  - Derive `disabled` from `activeTab.sessionState === 'working'`
- [x] 3.3 Update MiddlePanelContent to use conversation store (COMPLETED)
  - Replace `createMockMessages()` (via useMemo) with `useConversationStore.getMessages(sessionId)`
  - Keep mock fallback for development until Epic 3b integrates real data
  - Update import from `createMockMessages` to `useConversationStore`
- [x] 3.4 Update tab session state on send (COMPLETED)
  - On send: `updateTabSessionState(tabId, 'working')`
  - On complete/error: `updateTabSessionState(tabId, 'idle')` or `updateTabSessionState(tabId, 'error')`

### Task 4: Handle new session creation flow (AC: #1)

**IMPORTANT CLARIFICATION:** The current codebase creates sessions when the user picks a folder (via "New Session" button). This story supports TWO flows:
1. **Existing sessions (primary flow):** Tab already has sessionId from folder selection - just send message
2. **New sessions via first message (future flow):** If a tab opens without sessionId but WITH a known folderPath (e.g., from folder drag-drop or quick-start), generate UUID on first send

For MVP, focus on flow #1. Flow #2 requires NewSessionView to have a folder context.

- [x] 4.1 Generate UUID on first message send (future flow) (COMPLETED)
  - In `useSendMessage` hook, check if `sessionId` is null
  - If null AND folderPath is known, generate UUID with `crypto.randomUUID()`
  - If null AND no folderPath, show error (cannot create session without folder)
  - Pass `isNewSession: true` to IPC handler
- [x] 4.2 Update useUIStore tab with new sessionId (COMPLETED)
  - After successful session creation, update tab's `sessionId` field
  - Use existing `updateTabTitle` pattern as reference
  - **REQUIRED:** Add `updateTabSessionId(tabId, sessionId)` action to useUIStore.ts (COMPLETED)
    - This action updates a tab's sessionId field after new session is created
    - Add to UIState interface: `updateTabSessionId: (tabId: string, sessionId: string) => void`
    - Implementation pattern:
      ```typescript
      updateTabSessionId: (tabId, sessionId) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, sessionId } : t))
        }))
      ```
    - This mirrors the `updateTabTitle` and `updateTabSessionState` pattern already in the store
- [x] 4.3 Create session in database (COMPLETED)
  - IPC handler creates DB record before returning
  - Return `{ success: true, sessionId: string }` for new sessions
  - Subsequent messages use the returned sessionId

### Task 5: Display error messages in conversation (AC: #4)
- [x] 5.1 Create error message component or style (COMPLETED - handled in useConversationStore with SystemMessage type)
  - Error messages rendered with muted, italic styling
  - Red-tinted background or left border for visibility
  - Reuse pattern from FR58 (Aborted message styling)
- [x] 5.2 Add error message on spawn failure (COMPLETED)
  - useConversationStore.addErrorMessage(sessionId, errorText)
  - Display in ConversationView alongside regular messages
  - Error message is NOT a user or assistant message - system type
- [x] 5.3 Verify user can retry after error (COMPLETED)
  - State transitions back to 'idle' on error
  - User can type and send again
  - Next send attempts new spawn

### Task 6: Write integration tests (AC: #1-6)
- [x] 6.1 Create `useSendMessage.test.ts` in hooks folder (COMPLETED)
  - Test: generates UUID for new sessions
  - Test: calls IPC with correct parameters
  - Test: updates session state to 'working' on send
  - Test: handles IPC error gracefully
  - Test: updates state back to 'idle' on error
- [x] 6.2 Update `MiddlePanelContent.test.tsx` (COMPLETED)
  - Test: onSend callback triggers send flow
  - Test: input disabled when sessionState is 'working'
  - Test: thinking indicator shown during 'working' state
- [x] 6.3 Create `useConversationStore.test.ts` (COMPLETED)
  - Test: optimistic message pattern
  - Test: error message handling
- [x] 6.4 Run `npm run validate` to verify all tests pass (COMPLETED - 722 tests passing)

## Dev Notes

### Architecture Patterns

**Component/Hook Locations:**
- Hook: `src/renderer/src/features/sessions/hooks/useSendMessage.ts`
- Store: `src/renderer/src/features/sessions/store/useConversationStore.ts`
- IPC: `src/main/ipc/sessions.ts` (add to existing file)
- Schema: `src/shared/types/ipc.ts` (add to existing schemas)

**Data Flow:**
```
User types -> ChatInput.onSend
    |
    v
useSendMessage hook
    |
    +-> 1. Add optimistic message to useConversationStore
    +-> 2. Set session state to 'working' in useUIStore
    +-> 3. Call window.grimoireAPI.sessions.sendMessage
    |
    v (IPC)
Main process: sessions.ts handler
    |
    +-> If new session: create in DB
    +-> Return { success: true, sessionId }
    |
    v
Back to renderer
    |
    +-> On success: wait for response (Story 3a.3)
    +-> On error: show error, state = 'idle'
```

**State Management:**
- `useUIStore`: Tab state (sessionState: 'idle'|'working'|'error')
- `useConversationStore`: Messages per session (optimistic updates)
- Process state tracked in main process (processRegistry)

### Existing Code to Reuse

**CRITICAL - Do NOT reinvent these:**

1. **sessions.ts IPC handlers** - Pattern for IPC validation and DB operations
2. **useUIStore.ts** - `updateTabSessionState` for state transitions, `SessionState` type
3. **ThinkingIndicator.tsx** - Already exists for AC5
4. **LoadingIndicator.tsx** - Already exists for loading states
5. **processRegistry** - Main process Map<sessionId, ChildProcess>
6. **ConversationView.tsx** - Already handles sessionState prop for indicators
7. **Zod schemas** - Follow existing pattern in `src/shared/types/ipc.ts`

**IMPORTANT - Integration Points:**
- ConversationView already has `sessionState` prop driving indicators
- MiddlePanelContent already passes `sessionState={activeTab.sessionState}`
- ChatInput will receive `disabled` prop based on sessionState

### File Structure Conventions

```
src/
  main/
    ipc/
      sessions.ts        # UPDATE - add sendMessage handler
  preload/
    index.ts             # UPDATE - expose sendMessage
    index.d.ts           # UPDATE - type declarations
  shared/
    types/
      ipc.ts             # UPDATE - add SendMessageSchema
  renderer/src/
    features/sessions/
      hooks/
        useSendMessage.ts     # NEW - send logic hook
        useSendMessage.test.ts # NEW - tests
      store/
        useConversationStore.ts     # NEW - message state
        useConversationStore.test.ts # NEW - tests
```

### Testing Approach

1. **Unit Tests (hooks):**
   - Mock `window.grimoireAPI.sessions.sendMessage`
   - Mock Zustand stores with initial state
   - Test state transitions

2. **Store Tests:**
   - Pure state logic testing
   - Optimistic update patterns

3. **Integration Tests:**
   - End-to-end flow from ChatInput to IPC

### Technical Requirements

**Optimistic Update Pattern:**
```typescript
// 1. Add message immediately (optimistic)
const tempId = crypto.randomUUID()
addOptimisticMessage(sessionId, {
  uuid: tempId,
  role: 'user',
  content: message,
  timestamp: Date.now()
})

// 2. Call IPC (folderPath from session context)
const result = await window.grimoireAPI.sessions.sendMessage({
  sessionId,
  message,
  folderPath,
  isNewSession
})

// 3. On success, message stays (maybe update UUID)
// 4. On failure, keep message but add error
```

**Session State Machine:**
```
idle -> (send) -> working -> (complete) -> idle
                     |
                     +-> (error) -> error -> (acknowledge) -> idle
```

**IPC Handler Pattern (sessions.ts):**
```typescript
ipcMain.handle('sessions:sendMessage', async (_, data: unknown) => {
  const { sessionId, message, folderPath, isNewSession } = SendMessageSchema.parse(data)

  // Create session if new
  if (isNewSession) {
    const now = Date.now()
    const db = getDatabase()
    db.prepare(`INSERT INTO sessions (id, folder_path, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(sessionId, folderPath, now, now)
  }

  // Spawn CC will be added in Story 3b
  // For now, just acknowledge the message
  return { success: true }
})
```

### Regression Risks

1. **ConversationView messages** - Switching from mock to store-based messages
2. **Tab state synchronization** - Ensure state updates reflect across components
3. **Existing session operations** - Don't break archive/hide/fork flows

### Libraries/Versions

- Zustand 5.x: For useConversationStore
- Zod 4.x: For IPC schema validation
- crypto.randomUUID(): Built-in for UUID generation

### Story Dependencies

**REQUIRED - Must be completed before this story:**
- **Story 3a-1 (Chat Input Component):** Provides the ChatInput component with `onSend` and `disabled` props that this story integrates with

**DOWNSTREAM - Stories that depend on this story:**
- **Story 3a-3 (Response Handling):** Will complete the response handling flow started here
- **Story 3b-1 (CC Child Process Spawning):** Will implement actual CC spawn using the IPC handler created here

### Previous Story Learnings

**From Story 3a-1 (Chat Input Component):**
- ChatInput will be created with `onSend`, `disabled` props
- This story implements the `onSend` handler
- Disabled state driven by `sessionState === 'working'`

**From Story 2a.3 (Session Management):**
- Pattern for IPC handlers with Zod validation
- Session creation in database
- Transaction patterns for atomic operations

**From Story 2b.4 (Loading States):**
- ThinkingIndicator and LoadingIndicator already implemented
- sessionState drives indicator display in ConversationView

### FolderPath Source Clarification

**IMPORTANT - Where does folderPath come from?**

For **existing sessions** (tab has sessionId):
- Look up session from `useSessionStore.sessions` by sessionId
- Extract `session.folderPath`

For **new sessions** (tab has no sessionId - future flow):
- Requires Tab interface to be extended with optional `folderPath` field
- OR require folder selection before typing (current flow via "New Session" button)

**Recommended approach for MVP:**
1. Existing sessions: Get folderPath from session lookup
2. New session tabs: Currently blocked by "New Session" button requiring folder selection first
3. If extending to allow quick-start without folder selection, the UI must prompt for folder before send

### CC Spawn Integration Note

**IMPORTANT:** This story sets up the message send flow but does NOT implement actual CC spawning. The IPC handler will:
1. Accept the message
2. Create session in DB if needed
3. Return success

Actual CC child process spawning will be implemented in Story 3b-1 (CC Child Process Spawning). This story prepares the renderer-side infrastructure.

### Project Structure Notes

- Path alias: `@renderer` maps to `src/renderer/src`
- Feature stores go in `features/{feature}/store/`
- Colocate tests with source files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.2: Message Send Flow]
- [Source: _bmad-output/planning-artifacts/architecture.md#IPC Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Spawn Child Architecture]
- [Source: _bmad-output/planning-artifacts/project-context.md#IPC Patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (Code Review 1)

### Code Review 1 (2026-01-24)

**Reviewer:** Claude Opus 4.5
**Result:** 2 MEDIUM issues found and FIXED

**MEDIUM-1: Non-reactive isSending state in useSendMessage (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` line 130
- Problem: Using `useUIStore.getState()` in render path prevented reactive updates
- Fix: Changed to use Zustand hook with selector for proper reactivity

**MEDIUM-2: Missing eslint-disable comment for autoFocus useEffect (FIXED)**
- File: `src/renderer/src/features/sessions/components/ChatInput.tsx` line 57
- Problem: Intentional empty dependency array had lint warning without explanation
- Fix: Added eslint-disable comment inside useEffect explaining intentional behavior

**LOW-1: Console.error logging (NOT FIXED - acceptable for MVP)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` line 56
- Observation: Uses console.error which is fine for MVP

**LOW-2: Test helper timing fragility (NOT FIXED - tests passing)**
- File: `src/renderer/src/features/sessions/components/ConversationView.test.tsx` line 80
- Observation: Test function uses Date.now() which works with mocked timers

**Verification:** All 722 tests passing, lint clean

---

Claude Haiku 4.5 (Review Attempt 3)

### Debug Log References

### Completion Notes List

Claude Haiku 4.5 (Code Review 2 - Attempt 2)

**Reviewer:** Claude Haiku 4.5
**Result:** 5 issues found and FIXED

**HIGH-1: Race condition in new session state update (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` line 71-72
- Problem: Tab sessionId was updated BEFORE IPC success, creating orphaned sessions
- Fix: Moved updateTabSessionId AFTER result.success check

**HIGH-2: Silent folderPath failures masking data integrity issues (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` lines 50-51
- Problem: Missing session or missing folderPath gave generic error instead of explicit error
- Fix: Added explicit null checks with descriptive error messages

**MEDIUM-1: No empty message validation (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` line 65
- Problem: Empty messages could be sent, creating poor UX
- Fix: Added client-side trim() and validation before optimistic update

**MEDIUM-2: No message length limit (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` line 80
- Problem: Arbitrary message sizes could cause memory/DB issues
- Fix: Added 100KB length limit with explicit error

**MEDIUM-3: Silent session lookup failures (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` line 51
- Problem: Missing session in store gave generic error
- Fix: Added explicit check with descriptive error message

**LOW-1: Hardcoded retry delays (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` lines 99-101
- Problem: 2-second artificial delay prevented immediate retry
- Fix: Removed delays - user can retry immediately

**LOW-2: Console.log placeholder in production (FIXED)**
- File: `src/main/ipc/sessions.ts` line 332
- Problem: TODO placeholder with console.log
- Fix: Converted to conditional debug logging

**Tests Updated:**
- Added 3 new tests (now 11 total for useSendMessage)
- Updated test for trimming behavior
- Updated error state transition test
- Added tests for empty message rejection
- Added tests for message length limit rejection
- Added test for failed session creation not updating tab

**Verification:** All 725 tests passing (3 new), lint clean

---

**Review Attempt 3 (Final Review):**

CRITICAL ISSUES FIXED:
1. **Task 4.2 - Missing `updateTabSessionId` action clarification**: Enhanced task 4.2 to explicitly document that `updateTabSessionId` needs to be added to useUIStore.ts with implementation pattern. This action is critical for new session creation flow to update tab's sessionId after successful DB creation.

MEDIUM PRIORITY CLARIFICATIONS:
2. **Task 1.1 - IPC handler placement**: Added clarification that `sessions:sendMessage` should be added after the rewind handler (after line 305).
3. **Task 1.2 - Schema documentation**: Enhanced with line reference and note about existing `SpawnRequestSchema`.
4. **Task 1.4 - Preload type declarations**: Clarified exact location and pattern for adding `sendMessage` method to GrimoireAPI interface.

VERIFICATION RESULTS:
- useUIStore.ts: Confirmed it has `updateTabSessionState` and `updateTabTitle` patterns, but LACKS `updateTabSessionId` (critical gap filled)
- src/main/ipc/sessions.ts: Verified structure and confirmed where new handler should go
- src/shared/types/ipc.ts: Confirmed Zod pattern with existing schemas like SpawnRequestSchema
- src/preload/index.ts: Confirmed grimoireAPI structure and pattern for new methods
- src/preload/index.d.ts: Confirmed TypeScript interface pattern
- src/renderer/src/core/shell/MiddlePanelContent.tsx: Confirmed it uses ChatInputPlaceholder and has sessionState prop ready
- Directory structure: Confirmed both hooks/ and store/ directories exist with proper patterns

STORY QUALITY ASSESSMENT:
- Acceptance Criteria: Well-defined, match discovery requirements
- Task breakdown: Clear and comprehensive with 6 main tasks
- Dev Notes: Excellent architecture patterns, data flow diagrams, and code examples
- Dependencies: Properly documented with clear story dependencies
- FolderPath handling: Clearly explained with two flows (existing/new sessions)
- Testing approach: Good coverage of unit, store, and integration tests

NO NEW CRITICAL ISSUES FOUND in story structure. All issues identified were DOCUMENTATION CLARIFICATIONS to help developers implement more precisely.

### File List

Files to be created:
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useSendMessage.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useSendMessage.test.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useConversationStore.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useConversationStore.test.ts`

Files to be modified:
- `/Users/teazyou/dev/grimoire/src/main/ipc/sessions.ts`
- `/Users/teazyou/dev/grimoire/src/shared/types/ipc.ts`
- `/Users/teazyou/dev/grimoire/src/preload/index.ts`
- `/Users/teazyou/dev/grimoire/src/preload/index.d.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx`
- `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` (add updateTabSessionId)
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/NewSessionView.tsx` (if extending quick-start flow)

---

Claude Haiku 4.5 (Code Review Attempt 3 - Final Verification)

**Reviewer:** Claude Haiku 4.5
**Result:** 4 issues found and FIXED

**CRITICAL-1: TypeScript compilation error in test (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.test.ts` line 365
- Problem: `generatedSessionId` variable declared but never used, causing build failure
- Fix: Removed unused variable declaration

**HIGH-1: Incorrect error state transition logic (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.ts` lines 117-119, 126-128
- Problem: State was set to 'error' then immediately to 'idle', making error state invisible to user
- Fix: Removed immediate transition to 'idle'. Error state is now preserved until Story 3a-3 handles user acknowledgment
- Impact: Error messages now remain visible, better UX for error handling

**MEDIUM-1: Test assertion incorrect after behavior fix (FIXED)**
- File: `src/renderer/src/features/sessions/hooks/useSendMessage.test.ts` line 194
- Problem: Test expected state to be 'idle' after failure, but design now keeps error state visible
- Fix: Updated test to verify state remains 'error' until Story 3a-3 transitions it
- Added clarifying comment about Story 3a-3 responsibility

**MEDIUM-2: Prettier formatting issue (FIXED)**
- File: `src/main/ipc/sessions.ts` line 333
- Problem: Long template literal exceeds line length limit
- Fix: Split string across multiple lines for proper formatting

**Verification Results:**
- All 725 tests passing (no failures)
- TypeScript strict mode: PASS
- ESLint: PASS
- Prettier: PASS
- Full validation (npm run validate): PASS

**Story Status:** ALL ISSUES FIXED - Story ready for "done" status
