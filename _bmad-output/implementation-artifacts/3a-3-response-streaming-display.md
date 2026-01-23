# Story 3a.3: Response Streaming Display

Status: ready-for-dev

## Story

As a **user**,
I want **to see Claude's responses appear in real-time**,
So that **I can follow along as Claude thinks and responds**.

## Acceptance Criteria

1. **AC1: Response appears character-by-character (FR50)**
   - Given CC is generating a response
   - When tokens stream in
   - Then the response appears character-by-character in a Claude message bubble
   - And a cursor blink animation indicates active streaming
   - And the bubble grows as content is added

2. **AC2: Auto-scroll during streaming**
   - Given response is streaming
   - When content extends beyond the visible area
   - Then the conversation auto-scrolls smoothly to show new content
   - And scrolling is not jarring or jumpy

3. **AC3: Manual scroll pauses auto-scroll**
   - Given the user manually scrolls up during streaming
   - When they are reading earlier content
   - Then auto-scroll pauses to not interrupt reading
   - And a "Jump to latest" indicator appears
   - And clicking the indicator resumes auto-scroll

4. **AC4: Streaming complete state**
   - Given streaming completes
   - When the final token arrives
   - Then the cursor animation stops
   - And the message bubble shows complete state
   - And the input box is re-enabled for next message

5. **AC5: Tool calls displayed during streaming**
   - Given CC executes tool calls during response
   - When tool_use events arrive in stream
   - Then tool call cards appear inline with assistant response
   - And tool results are displayed when received

6. **AC6: Error state clears on new response**
   - Given a previous error occurred
   - When a new response stream starts
   - Then the error state from Story 3a-2 transitions to working
   - And the UI shows streaming indicator

## Tasks / Subtasks

### Task 1: Create streaming message component (AC: #1, #4)
- [ ] 1.1 Create `StreamingMessageBubble.tsx` in `src/renderer/src/features/sessions/components/`
  - Import: `useState`, `useEffect`, `useMemo` from 'react'
  - Accept props: `content: string`, `isStreaming: boolean`, `timestamp?: number`
  - Extend MessageBubble styling with cursor animation
  - Use CSS animation for blinking cursor: `@keyframes blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }`
  - Apply cursor only when `isStreaming=true`
- [ ] 1.2 Add cursor animation CSS
  - Add to component or create shared animation utility
  - Cursor: vertical bar `|` with 1s blink animation
  - Cursor positioned after last character
  - Cursor disappears when `isStreaming=false`
- [ ] 1.3 Handle empty/initial state
  - Show minimal bubble height even when content is empty
  - Display cursor immediately when streaming starts
  - Transition smoothly as content arrives

### Task 2: Implement streaming event processing (AC: #1, #5)
- [ ] 2.1 Create `useStreamingMessage` hook in `src/renderer/src/features/sessions/hooks/`
  - Accept: `sessionId: string`
  - State: `streamingContent: string`, `isStreaming: boolean`, `toolCalls: ToolUseBlock[]`
  - Listen to IPC events for streaming chunks (Story 3b will emit these)
  - Accumulate content as chunks arrive
  - Track tool_use blocks from stream
- [ ] 2.2 Define streaming event types in `src/shared/types/ipc.ts`
  - Add `StreamChunkEvent` type: `{ sessionId: string, content: string, type: 'text' | 'tool_use' | 'tool_result' }`
  - Add `StreamEndEvent` type: `{ sessionId: string, success: boolean, error?: string }`
  - Add `StreamToolEvent` type: `{ sessionId: string, toolUse: ToolUseBlock }`
  - Follow existing pattern from architecture (NDJSON event types)
- [ ] 2.3 Update preload to expose streaming event listeners
  - Add `onStreamChunk: (callback: (event: StreamChunkEvent) => void) => () => void`
  - Add `onStreamEnd: (callback: (event: StreamEndEvent) => void) => () => void`
  - Return cleanup function for React useEffect
  - Add to `src/preload/index.ts` and `src/preload/index.d.ts`

### Task 3: Update ConversationView for streaming (AC: #1, #2, #4)
- [ ] 3.1 Integrate `useStreamingMessage` hook
  - Get streaming state from hook
  - Conditionally render StreamingMessageBubble when streaming
  - Keep existing message rendering for completed messages
- [ ] 3.2 Update auto-scroll behavior for streaming
  - Modify existing `isNearBottom` check to also consider streaming state
  - Scroll to bottom on each content chunk if user is near bottom
  - Maintain smooth scroll behavior (no jumpy updates)
- [ ] 3.3 Handle streaming completion
  - When `StreamEndEvent` received with success=true:
    - Move streaming content to permanent message
    - Clear streaming state
    - Transition sessionState from 'working' to 'idle'
  - When `StreamEndEvent` received with success=false:
    - Show error message in conversation
    - Transition to 'error' state

### Task 4: Implement "Jump to latest" indicator (AC: #3)
- [ ] 4.1 Create `JumpToLatestButton.tsx` component
  - Show when: `isStreaming && !isNearBottom && userScrolledUp`
  - Style: floating button at bottom-center of conversation area
  - Icon: down arrow with "Jump to latest" text
  - Position: `fixed` within scroll container, `bottom-4`
  - Animate: fade in/out with 150ms transition
- [ ] 4.2 Track user scroll-away state
  - Add `userScrolledUp` state to ConversationView
  - Set to true when user scrolls UP during streaming
  - Reset to false when user clicks "Jump to latest" or scrolls to bottom
- [ ] 4.3 Implement jump behavior
  - On click: `scrollToBottom()` and reset `userScrolledUp`
  - Resume auto-scroll on subsequent chunks

### Task 5: Integrate tool call display during streaming (AC: #5)
- [ ] 5.1 Extend `useStreamingMessage` for tool events
  - Track `pendingToolCalls: ToolUseBlock[]` (tool_use received, no result yet)
  - Track `completedToolCalls: { call: ToolUseBlock, result: ToolResultBlock }[]`
  - Update when tool_result events arrive
- [ ] 5.2 Render tool cards inline during streaming
  - After current streaming text, show pending tool cards
  - Tool cards show "Running..." status while pending
  - Update to show result when tool_result received
  - Use existing ToolCallCard component with streaming-specific props

### Task 6: Handle state transitions (AC: #4, #6)
- [ ] 6.1 Update useConversationStore for streaming
  - Add `streamingMessage: Map<string, StreamingState>` to store
  - `StreamingState`: `{ content: string, toolCalls: ToolUseBlock[], startedAt: number }`
  - `startStreaming(sessionId)`: Initialize streaming state
  - `appendChunk(sessionId, chunk)`: Add content to streaming
  - `completeStreaming(sessionId)`: Finalize and convert to message
- [ ] 6.2 Connect state transitions
  - On stream start: `updateTabSessionState(tabId, 'working')`
  - On stream complete: `updateTabSessionState(tabId, 'idle')`, `completeStreaming(sessionId)`
  - On stream error: `updateTabSessionState(tabId, 'error')`, add error message
- [ ] 6.3 Clear previous error state on new stream
  - In useSendMessage: Clear error state when starting new send
  - In useStreamingMessage: Reset error display when streaming starts

### Task 7: Write unit tests (AC: #1-6)
- [ ] 7.1 Create `StreamingMessageBubble.test.tsx`
  - Test: renders content with cursor when streaming
  - Test: cursor hidden when not streaming
  - Test: handles empty content gracefully
  - Test: animation classes applied correctly
- [ ] 7.2 Create `useStreamingMessage.test.ts`
  - Test: accumulates content from chunks
  - Test: tracks streaming state
  - Test: handles tool_use events
  - Test: cleans up on unmount
- [ ] 7.3 Create `JumpToLatestButton.test.tsx`
  - Test: visible when scrolled up and streaming
  - Test: hidden when at bottom
  - Test: click triggers scroll to bottom
- [ ] 7.4 Update `ConversationView.test.tsx`
  - Test: shows StreamingMessageBubble during streaming
  - Test: auto-scroll behavior during streaming
  - Test: transition from streaming to complete
- [ ] 7.5 Run `npm run validate` to verify all tests pass

## Dev Notes

### Architecture Patterns

**Component/Hook Locations:**
- Component: `src/renderer/src/features/sessions/components/StreamingMessageBubble.tsx`
- Component: `src/renderer/src/features/sessions/components/JumpToLatestButton.tsx`
- Hook: `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts`
- Types: `src/shared/types/ipc.ts` (add streaming event types)
- Store: `src/renderer/src/features/sessions/store/useConversationStore.ts` (extend)

**Data Flow (Streaming):**
```
Main Process (Epic 3b) sends IPC events
    |
    v
preload: onStreamChunk, onStreamEnd
    |
    v
useStreamingMessage hook
    |
    +-> Updates local streaming state
    +-> Accumulates content chunks
    +-> Tracks tool calls
    |
    v
ConversationView
    |
    +-> Renders StreamingMessageBubble for active stream
    +-> Shows JumpToLatestButton when scrolled away
    +-> Auto-scrolls on new chunks (if near bottom)
    |
    v
On StreamEnd:
    +-> useConversationStore.completeStreaming()
    +-> useUIStore.updateTabSessionState('idle')
```

**State Management:**
- `useStreamingMessage`: Local hook state for current streaming session
- `useConversationStore`: Persistent message state with streaming integration
- `useUIStore`: Session state transitions (working -> idle)

### Existing Code to Reuse

**CRITICAL - Do NOT reinvent these:**

1. **ConversationView.tsx** - Already has auto-scroll logic, isNearBottom(), scrollToBottom()
2. **MessageBubble.tsx** - Base styling for message bubbles
3. **ToolCallCard.tsx** - Tool call display (extend for streaming state)
4. **ThinkingIndicator.tsx** - Shows during initial loading, transitions to streaming
5. **useConversationStore.ts** - Message storage (from Story 3a-2)
6. **formatMessageTimestamp.ts** - Timestamp formatting

**IMPORTANT - Integration Points:**
- ConversationView already has `sessionState` prop driving indicators
- LoadingIndicator shows when `working && !isStreaming`
- ThinkingIndicator shows when `working && isStreaming`
- This story connects real streaming to replace the simulated pattern

### File Structure Conventions

```
src/
  renderer/src/
    features/sessions/
      components/
        StreamingMessageBubble.tsx     # NEW
        StreamingMessageBubble.test.tsx # NEW
        JumpToLatestButton.tsx          # NEW
        JumpToLatestButton.test.tsx     # NEW
      hooks/
        useStreamingMessage.ts          # NEW
        useStreamingMessage.test.ts     # NEW
  shared/
    types/
      ipc.ts                            # UPDATE - add streaming types
  preload/
    index.ts                            # UPDATE - add streaming listeners
    index.d.ts                          # UPDATE - add streaming types
```

### Testing Approach

1. **Unit Tests (components):**
   - Mock streaming state via props
   - Test visual states (streaming vs complete)
   - Test animation class presence

2. **Hook Tests:**
   - Mock IPC event listeners
   - Test chunk accumulation
   - Test cleanup on unmount

3. **Integration Tests:**
   - Full ConversationView with streaming
   - Scroll behavior during streaming

### Technical Requirements

**Streaming Event Types (from Architecture):**
```typescript
// Stream chunk event (text content)
interface StreamChunkEvent {
  sessionId: string
  type: 'text'
  content: string
  uuid?: string
}

// Stream tool event (tool call or result)
interface StreamToolEvent {
  sessionId: string
  type: 'tool_use' | 'tool_result'
  toolUse?: ToolUseBlock
  toolResult?: ToolResultBlock
}

// Stream end event
interface StreamEndEvent {
  sessionId: string
  success: boolean
  error?: string
  totalTokens?: { input: number, output: number }
  costUsd?: number
}
```

**IPC Event Listeners Pattern:**
```typescript
// preload/index.ts
onStreamChunk: (callback: (event: StreamChunkEvent) => void) => {
  const listener = (_: IpcRendererEvent, event: StreamChunkEvent) => callback(event)
  ipcRenderer.on('stream:chunk', listener)
  return () => ipcRenderer.removeListener('stream:chunk', listener)
}
```

**Cursor Animation CSS:**
```css
.streaming-cursor::after {
  content: '|';
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}
```

**Auto-scroll during streaming:**
```typescript
useEffect(() => {
  if (isStreaming && isNearBottom() && !userScrolledUp) {
    scrollToBottom()
  }
}, [streamingContent, isStreaming, isNearBottom, userScrolledUp])
```

### Regression Risks

1. **Scroll position persistence** - Ensure streaming doesn't corrupt saved positions
2. **Message rendering** - New StreamingMessageBubble must integrate with existing message list
3. **State synchronization** - Streaming state must sync with useConversationStore
4. **Indicator transitions** - Loading -> Streaming -> Complete must be smooth

### Libraries/Versions

- React 19.x: useEffect cleanup for event listeners
- Radix UI ScrollArea: Already in use for ConversationView
- CSS animations: Native, no additional library

### Story Dependencies

**REQUIRED - Must be completed before real streaming works:**
- **Story 3a-2 (Message Send Flow):** Provides the message sending infrastructure
- **Story 3b-2 (NDJSON Stream Parser):** Will emit the actual streaming events

**This story prepares:**
- UI components ready to consume streaming events
- Event listener infrastructure in preload
- Store integration for streaming state

**DOWNSTREAM - Stories that depend on this story:**
- **Story 3a-4 (Abort and Resume):** Will use streaming state for abort
- **Story 3b-2 (NDJSON Stream Parser):** Will emit events that this story consumes

### Previous Story Learnings

**From Story 3a-1 (Chat Input Component):**
- Auto-focus pattern with useEffect and empty deps
- Controlled component pattern for input
- CSS variable usage for theming

**From Story 3a-2 (Message Send Flow):**
- Optimistic update pattern in useConversationStore
- State transitions: idle -> working -> idle/error
- IPC event handling pattern
- Error state preserved until acknowledged

**From Story 2c-3 (Event Timeline View):**
- Scroll-to-event functionality with refs
- Highlight animation on scroll target
- useActiveTimelineEvent for scroll sync

### Project Structure Notes

- Path alias: `@renderer` maps to `src/renderer/src`
- Colocate tests with components
- Export new components from `index.ts`

### CC Stream Event Reference (from Architecture)

```typescript
// From stream-parser.ts pattern in architecture.md
async function* parseStream(sessionId: string, stdout: Readable): AsyncGenerator<StreamEvent> {
  for await (const line of rl) {
    const msg = JSON.parse(line)

    // Text content
    if (msg.type === 'assistant') {
      yield { type: 'content', message: msg.message, uuid: msg.uuid }
    }

    // Tool use in content blocks
    if (msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use') {
          yield { type: 'tool_use', toolCall: block }
        }
      }
    }
  }
}
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.3: Response Streaming Display]
- [Source: _bmad-output/planning-artifacts/architecture.md#CC Communication]
- [Source: _bmad-output/planning-artifacts/architecture.md#Stream-JSON Flow]
- [Source: _bmad-output/planning-artifacts/project-context.md#Framework-Specific Rules]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

Files to be created:
- `src/renderer/src/features/sessions/components/StreamingMessageBubble.tsx`
- `src/renderer/src/features/sessions/components/StreamingMessageBubble.test.tsx`
- `src/renderer/src/features/sessions/components/JumpToLatestButton.tsx`
- `src/renderer/src/features/sessions/components/JumpToLatestButton.test.tsx`
- `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts`
- `src/renderer/src/features/sessions/hooks/useStreamingMessage.test.ts`

Files to be modified:
- `src/shared/types/ipc.ts` (add streaming event types)
- `src/preload/index.ts` (add streaming event listeners)
- `src/preload/index.d.ts` (add streaming type declarations)
- `src/renderer/src/features/sessions/components/ConversationView.tsx` (integrate streaming)
- `src/renderer/src/features/sessions/store/useConversationStore.ts` (add streaming state)
- `src/renderer/src/features/sessions/components/index.ts` (export new components)
