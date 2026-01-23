# Story 3a.4: Abort and Resume

Status: ready-for-dev

## Story

As a **user**,
I want **to abort a running process and resume later**,
So that **I can stop unwanted operations and continue when ready**.

## Acceptance Criteria

1. **AC1: Abort terminates CC process (FR57)**
   - Given CC is processing a request
   - When the user clicks the abort button (or presses Escape)
   - Then the running CC process is terminated
   - And streaming stops immediately

2. **AC2: Aborted message displayed (FR58)**
   - Given a process is aborted
   - When the abort completes
   - Then an "Aborted" message is displayed in the conversation
   - And the message has distinct styling (muted, italic)
   - And the session state transitions to Idle

3. **AC3: Resume aborted session (FR59)**
   - Given a session was aborted
   - When the user types a new message
   - Then the session resumes normally
   - And a new CC process spawns with the session ID
   - And conversation continues from where it was aborted

4. **AC4: Abort button visibility**
   - Given the abort button is displayed
   - When no process is running (sessionState is 'idle')
   - Then the abort button is hidden or disabled
   - And the send button is shown instead

5. **AC5: Keyboard shortcut for abort**
   - Given CC is processing (sessionState is 'working')
   - When the user presses Escape key
   - Then the abort action is triggered
   - And behavior matches clicking the abort button

6. **AC6: Partial content preserved on abort**
   - Given response was streaming
   - When user aborts mid-stream
   - Then any content received before abort is preserved
   - And the partial response is visible in conversation
   - And "Aborted" message appears after partial content

## Tasks / Subtasks

### Task 1: Create AbortButton component (AC: #1, #4)
- [ ] 1.1 Create `AbortButton.tsx` in `src/renderer/src/features/sessions/components/`
  - Import: lucide-react `Square` or `XCircle` icon (stop symbol)
  - Accept props: `onAbort: () => void`, `disabled?: boolean`, `visible?: boolean`
  - Style: Red-tinted background, white icon
  - Position: Replace send button when `visible=true`
  - Show tooltip: "Stop generation (Esc)"
- [ ] 1.2 Implement visibility logic
  - Visible when `sessionState === 'working'`
  - Hidden when `sessionState === 'idle'` or `sessionState === 'error'`
  - Smooth transition between send button and abort button
- [ ] 1.3 Add disabled state
  - Disable briefly after click to prevent double-abort
  - Show spinner or loading state during abort IPC call
  - Re-enable (as send button) after abort complete

### Task 2: Integrate abort button into ChatInput (AC: #4)
- [ ] 2.1 Update `ChatInput.tsx` to accept abort callback
  - Add prop: `onAbort?: () => void`
  - Add prop: `isAborting?: boolean`
  - Conditionally render AbortButton vs SendButton based on sessionState
  - Keep existing send logic for when not working
- [ ] 2.2 Update ChatInput styling for button swap
  - Both buttons should occupy same space
  - Use conditional rendering or CSS visibility
  - Maintain consistent button size (no layout shift)
- [ ] 2.3 Pass abort callback from MiddlePanelContent
  - Get abort function from hook
  - Pass to ChatInput's `onAbort` prop
  - Track aborting state for disabled state

### Task 3: Implement abort IPC handler (AC: #1)
- [ ] 3.1 Add `sessions:abort` IPC channel in `src/main/ipc/sessions.ts`
  - Accept: `{ sessionId: string }`
  - Validate with Zod schema
  - Look up process in processRegistry
  - Call `process.kill('SIGTERM')` or `SIGKILL` if needed
  - Return: `{ success: boolean, error?: string }`
- [ ] 3.2 Add Zod schema for abort in `src/shared/types/ipc.ts`
  ```typescript
  export const AbortRequestSchema = z.object({
    sessionId: z.string().uuid()
  })
  export type AbortRequest = z.infer<typeof AbortRequestSchema>
  ```
- [ ] 3.3 Update preload to expose `sessions.abort`
  - Add to `src/preload/index.ts`: `abort: (sessionId: string) => Promise<{ success: boolean, error?: string }>`
  - Add to `src/preload/index.d.ts`: Type declaration
- [ ] 3.4 Handle process cleanup
  - Remove process from registry after abort
  - Emit `stream:end` event with `{ success: false, aborted: true }`
  - Ensure no orphaned processes

### Task 4: Create useAbortSession hook (AC: #1, #2, #3)
- [ ] 4.1 Create `useAbortSession.ts` in `src/renderer/src/features/sessions/hooks/`
  - Accept: `sessionId: string`, `tabId: string`
  - State: `isAborting: boolean`
  - Call `window.grimoireAPI.sessions.abort(sessionId)`
  - Update session state to 'idle' on success
  - Add "Aborted" message to conversation
- [ ] 4.2 Integrate with useConversationStore
  - Add `addAbortedMessage(sessionId)` action
  - Message type: 'system' with content: "Response generation was aborted"
  - Styling: muted text, italic, with distinct background
- [ ] 4.3 Handle streaming state on abort
  - If streaming was active, finalize partial content first
  - Then add "Aborted" message
  - Clear streaming state in useStreamingMessage

### Task 5: Implement keyboard shortcut (AC: #5)
- [ ] 5.1 Add global Escape key handler
  - Listen for Escape key at ConversationView or MiddlePanelContent level
  - Only trigger if `sessionState === 'working'`
  - Call same abort function as button click
- [ ] 5.2 Consider focus context
  - Escape should work regardless of focus location
  - Use window-level event listener
  - Cleanup listener on component unmount
- [ ] 5.3 Add keyboard shortcut documentation
  - Update ChatInput title/tooltip
  - Show "(Esc)" hint on abort button

### Task 6: Handle partial content preservation (AC: #6)
- [ ] 6.1 Update useStreamingMessage for abort handling
  - On abort: don't discard current `streamingContent`
  - Convert partial content to permanent message with `isPartial: true` flag
  - Then append "Aborted" system message
- [ ] 6.2 Update StreamingMessageBubble for partial state
  - When `isPartial=true`, remove streaming cursor
  - Add subtle visual indicator that content is incomplete
  - No functional difference from complete messages
- [ ] 6.3 Update useConversationStore
  - `completeStreamingAsPartial(sessionId)`: Save partial content as message
  - Partial messages should be distinguishable in store (optional metadata)

### Task 7: Display "Aborted" message (AC: #2)
- [ ] 7.1 Create AbortedMessage component or style
  - Distinct from user/assistant messages
  - Style: muted text (`text-[var(--text-muted)]`), italic
  - Optional: red-tinted left border
  - Content: "Response generation was aborted"
- [ ] 7.2 Add to ConversationView rendering
  - Handle message type 'system' or 'aborted' in render loop
  - Position after the last (partial) assistant message
  - Use existing MessageBubble with modified styling OR create dedicated component

### Task 8: Implement resume functionality (AC: #3)
- [ ] 8.1 Verify existing send flow supports resume
  - useSendMessage should work on aborted sessions
  - Session state transitions: idle/error -> working on new send
  - CC spawn uses same session ID (resume continues conversation)
- [ ] 8.2 Update ChatInput to enable input after abort
  - After abort completes, state is 'idle'
  - ChatInput should be enabled and focused
  - Placeholder shows "Type anything to continue..." (existing behavior)
- [ ] 8.3 Test resume with aborted session
  - Send message -> Abort -> Send new message
  - New message should spawn CC with same session ID
  - CC resumes from last checkpoint (CC handles this)

### Task 9: Write unit tests (AC: #1-6)
- [ ] 9.1 Create `AbortButton.test.tsx`
  - Test: renders when visible
  - Test: hidden when visible=false
  - Test: calls onAbort on click
  - Test: disabled during abort
- [ ] 9.2 Create `useAbortSession.test.ts`
  - Test: calls IPC abort method
  - Test: transitions session state to idle
  - Test: adds aborted message to conversation
  - Test: handles abort error gracefully
- [ ] 9.3 Update `ChatInput.test.tsx`
  - Test: shows abort button when sessionState='working'
  - Test: shows send button when sessionState='idle'
  - Test: abort callback called when abort button clicked
- [ ] 9.4 Test keyboard shortcut
  - Test: Escape key triggers abort when working
  - Test: Escape does nothing when idle
- [ ] 9.5 Update `ConversationView.test.tsx`
  - Test: "Aborted" message displayed
  - Test: partial content preserved
- [ ] 9.6 Run `npm run validate` to verify all tests pass

## Dev Notes

### Architecture Patterns

**Component/Hook Locations:**
- Component: `src/renderer/src/features/sessions/components/AbortButton.tsx`
- Hook: `src/renderer/src/features/sessions/hooks/useAbortSession.ts`
- IPC: `src/main/ipc/sessions.ts` (add abort handler)
- Schema: `src/shared/types/ipc.ts` (add AbortRequest)

**Data Flow (Abort):**
```
User clicks Abort or presses Escape
    |
    v
useAbortSession hook
    |
    +-> 1. Set isAborting = true
    +-> 2. Call window.grimoireAPI.sessions.abort(sessionId)
    |
    v (IPC)
Main process: sessions.ts handler
    |
    +-> 1. Find process in registry
    +-> 2. Kill process with SIGTERM
    +-> 3. Remove from registry
    +-> 4. Emit stream:end with aborted=true
    +-> 5. Return { success: true }
    |
    v
Back to renderer
    |
    +-> 1. useStreamingMessage receives stream:end event
    +-> 2. Finalize partial content if any
    +-> 3. useConversationStore.addAbortedMessage(sessionId)
    +-> 4. useUIStore.updateTabSessionState(tabId, 'idle')
    +-> 5. Set isAborting = false
```

**State Machine:**
```
idle -> (send) -> working -> (abort) -> idle
                     |
                     +-> (complete) -> idle
                     |
                     +-> (error) -> error -> (send) -> working
```

### Existing Code to Reuse

**CRITICAL - Do NOT reinvent these:**

1. **ChatInput.tsx** - Already handles send button, extend for abort button swap
2. **useConversationStore.ts** - Message storage, extend for system messages
3. **useStreamingMessage.ts** - From Story 3a-3, handles streaming state
4. **processRegistry** - Main process Map for tracking CC processes
5. **MessageBubble.tsx** - Base styling, extend for system message styling
6. **Session state machine** - Existing idle/working/error pattern

**IMPORTANT - Integration Points:**
- ChatInput already receives `disabled` prop based on sessionState
- ConversationView already renders based on sessionState
- Story 3a-3 sets up streaming infrastructure this story leverages

### File Structure Conventions

```
src/
  main/
    ipc/
      sessions.ts             # UPDATE - add abort handler
  preload/
    index.ts                  # UPDATE - expose sessions.abort
    index.d.ts                # UPDATE - type declarations
  shared/
    types/
      ipc.ts                  # UPDATE - add AbortRequestSchema
  renderer/src/
    features/sessions/
      components/
        AbortButton.tsx       # NEW
        AbortButton.test.tsx  # NEW
        ChatInput.tsx         # UPDATE - add abort button integration
      hooks/
        useAbortSession.ts    # NEW
        useAbortSession.test.ts # NEW
      store/
        useConversationStore.ts # UPDATE - add aborted message handling
```

### Testing Approach

1. **Unit Tests (components):**
   - Mock sessionState for button visibility
   - Mock onAbort callback
   - Test visual states

2. **Hook Tests:**
   - Mock IPC abort method
   - Test state transitions
   - Mock useConversationStore

3. **Integration Tests:**
   - Full abort flow from button to message
   - Keyboard shortcut handling

### Technical Requirements

**Abort IPC Handler Pattern:**
```typescript
ipcMain.handle('sessions:abort', async (_, data: unknown) => {
  const { sessionId } = AbortRequestSchema.parse(data)

  const process = processRegistry.get(sessionId)
  if (!process) {
    return { success: false, error: 'No active process for session' }
  }

  try {
    process.kill('SIGTERM')
    processRegistry.delete(sessionId)

    // Emit abort event to renderer
    mainWindow?.webContents.send('stream:end', {
      sessionId,
      success: false,
      aborted: true
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

**Escape Key Handler Pattern:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && sessionState === 'working' && !isAborting) {
      handleAbort()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [sessionState, isAborting, handleAbort])
```

**Aborted Message Type:**
```typescript
// In useConversationStore
interface SystemMessage extends ConversationMessage {
  role: 'system'
  type: 'aborted' | 'error' | 'info'
  content: string
}

addAbortedMessage: (sessionId: string) => {
  const message: SystemMessage = {
    uuid: crypto.randomUUID(),
    role: 'system',
    type: 'aborted',
    content: 'Response generation was aborted',
    timestamp: Date.now()
  }
  set((state) => ({
    messages: new Map(state.messages).set(
      sessionId,
      [...(state.messages.get(sessionId) ?? []), message]
    )
  }))
}
```

**Button Swap CSS:**
```css
/* In ChatInput - smooth transition between buttons */
.chat-input-button {
  transition: opacity 150ms, transform 150ms;
}
.chat-input-button.hidden {
  opacity: 0;
  pointer-events: none;
  position: absolute;
}
```

### Regression Risks

1. **Send functionality** - Adding abort button must not break send
2. **State transitions** - Abort must properly reset all states
3. **Streaming cleanup** - Partial content must be handled correctly
4. **Process cleanup** - No orphaned processes after abort

### Libraries/Versions

- lucide-react: `Square` or `XCircle` icon for abort
- Zod: Validation for abort request

### Story Dependencies

**REQUIRED - Must be completed before this story:**
- **Story 3a-2 (Message Send Flow):** Provides session state management
- **Story 3a-3 (Response Streaming Display):** Provides streaming infrastructure

**This story prepares:**
- Complete user control over CC processes
- Clean abort/resume workflow
- Foundation for process lifecycle management

**DOWNSTREAM - Related stories:**
- **Story 3b-3 (Instance State Machine):** Will formalize process states

### Previous Story Learnings

**From Story 3a-1 (Chat Input Component):**
- Button positioning and styling patterns
- Keyboard handling with event.key checks
- Controlled component pattern

**From Story 3a-2 (Message Send Flow):**
- State transitions: idle -> working -> idle/error
- Error state preserved until acknowledged
- IPC handler pattern with Zod validation

**From Story 3a-3 (Response Streaming Display):**
- useStreamingMessage hook structure
- Stream event handling pattern
- Partial content accumulation

**From Story 2b.5 (Rewind UI):**
- Modal/action pattern for disruptive operations
- Loading state during async operations

### Process Kill Considerations

**Graceful shutdown:**
1. Send SIGTERM first
2. Wait 500ms for graceful exit
3. If still running, send SIGKILL
4. Always cleanup registry

**Platform differences:**
- macOS/Linux: SIGTERM works directly
- Windows: Use `process.kill()` which sends appropriate signal

```typescript
async function killProcess(process: ChildProcess, timeout = 500): Promise<void> {
  return new Promise((resolve) => {
    const forceKill = setTimeout(() => {
      process.kill('SIGKILL')
      resolve()
    }, timeout)

    process.once('exit', () => {
      clearTimeout(forceKill)
      resolve()
    })

    process.kill('SIGTERM')
  })
}
```

### Project Structure Notes

- Path alias: `@renderer` maps to `src/renderer/src`
- Colocate tests with components
- Export new components from `index.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.4: Abort and Resume]
- [Source: _bmad-output/planning-artifacts/architecture.md#Instance Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture.md#Spawn Child Architecture]
- [Source: _bmad-output/planning-artifacts/project-context.md#Framework-Specific Rules]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

Files to be created:
- `src/renderer/src/features/sessions/components/AbortButton.tsx`
- `src/renderer/src/features/sessions/components/AbortButton.test.tsx`
- `src/renderer/src/features/sessions/hooks/useAbortSession.ts`
- `src/renderer/src/features/sessions/hooks/useAbortSession.test.ts`

Files to be modified:
- `src/main/ipc/sessions.ts` (add abort handler)
- `src/shared/types/ipc.ts` (add AbortRequestSchema)
- `src/preload/index.ts` (expose sessions.abort)
- `src/preload/index.d.ts` (add type declarations)
- `src/renderer/src/features/sessions/components/ChatInput.tsx` (add abort button integration)
- `src/renderer/src/features/sessions/components/ChatInput.test.tsx` (update tests)
- `src/renderer/src/features/sessions/store/useConversationStore.ts` (add aborted message handling)
- `src/renderer/src/features/sessions/components/ConversationView.tsx` (render aborted messages)
- `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts` (handle abort during streaming)
- `src/renderer/src/features/sessions/components/index.ts` (export AbortButton)
