# Technical Discovery: Story 3a-3 Response Streaming Display

**Generated:** 2026-01-24
**Story:** 3a-3-response-streaming-display
**Status:** Discovery Complete

---

## Technical Context

### Key File Paths and Current State

| File | Purpose | Current State |
|------|---------|---------------|
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx` | Main conversation display | Has `isStreaming` local state (simulated), auto-scroll logic, message refs |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useConversationStore.ts` | Message state management | Has `DisplayMessage` type (union of ConversationMessage and SystemMessage) |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/MessageBubble.tsx` | Message rendering | No streaming support, static content only |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | IPC bridge | Has `onMetadataUpdated` pattern for events, no streaming events |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | IPC type declarations | Matches preload, no streaming types |
| `/Users/teazyou/dev/grimoire/src/shared/types/ipc.ts` | IPC schemas | Has SendMessageSchema, no streaming event schemas |
| `/Users/teazyou/dev/grimoire/src/main/ipc/sessions.ts` | IPC handlers | Has sendMessage stub (TODO: Epic 3b), no streaming emission |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ThinkingIndicator.tsx` | Working state indicator | Animated dots, shown when `working && isStreaming` |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/LoadingIndicator.tsx` | Loading state indicator | Fade pulse, shown when `working && !isStreaming` |

### Component Dependencies

```
MiddlePanelContent.tsx
    |
    +-> useConversationStore (getMessages)
    +-> useSendMessage (sendMessage)
    +-> ConversationView (messages, sessionId, sessionState)
    +-> ChatInput (onSend, disabled, hasMessages)

ConversationView.tsx
    |
    +-> MessageBubble (role, content, timestamp)
    +-> ToolCallCard (toolCall, result, isExpanded)
    +-> SubAgentBubble (subAgent, isExpanded)
    +-> ThinkingIndicator (shown when working + streaming)
    +-> LoadingIndicator (shown when working + !streaming)
    +-> useUIStore (scrollPositions, setScrollPosition)
    +-> useActiveTimelineEvent (timeline sync)
```

### Patterns to Follow

**IPC Event Listener Pattern (from preload/index.ts line 78-84):**
```typescript
onMetadataUpdated: (callback: (data: SessionMetadataLike) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionMetadataLike): void =>
    callback(data)
  ipcRenderer.on('sessions:metadataUpdated', handler)
  return () => ipcRenderer.removeListener('sessions:metadataUpdated', handler)
}
```

**State Update Pattern (from useConversationStore.ts):**
```typescript
set((state) => {
  const newMessages = new Map(state.messages)
  const sessionMessages = newMessages.get(sessionId) ?? []
  newMessages.set(sessionId, [...sessionMessages, newMessage])
  return { messages: newMessages }
})
```

**Auto-scroll Pattern (from ConversationView.tsx lines 156-168):**
```typescript
const isNearBottom = useCallback((): boolean => {
  if (!viewportRef.current) return true
  const { scrollTop, scrollHeight, clientHeight } = viewportRef.current
  return scrollHeight - scrollTop - clientHeight < 100
}, [])

const scrollToBottom = useCallback((): void => {
  if (viewportRef.current) {
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }
}, [])
```

---

## Investigation Results

### Existing Streaming Simulation

ConversationView currently has a **simulated** streaming detection mechanism (lines 51-54 and 231-238):

```typescript
// Line 53 - Local state for simulated streaming
const [isStreaming, setIsStreaming] = useState(false)

// Lines 231-238 - Simulate streaming detection
useEffect(() => {
  if (sessionState === 'working' && messages.length > 0) {
    // Consider "streaming" once we have at least one message while working
    setIsStreaming(true)
  } else if (sessionState === 'idle') {
    setIsStreaming(false)
  }
}, [sessionState, messages.length])
```

**Critical Finding:** This simulation MUST be replaced with real IPC event-driven streaming state.

### Message Store Structure

`useConversationStore.ts` already has:
- `messages: Map<string, DisplayMessage[]>` - keyed by sessionId
- `DisplayMessage = ConversationMessage | SystemMessage` - union type
- `addOptimisticMessage(sessionId, content)` - adds user message optimistically
- `addErrorMessage(sessionId, errorContent)` - adds system error message

**Missing for streaming:**
- `streamingMessage: Record<string, StreamingState | null>` - current streaming content per session
- `startStreaming(sessionId)` - initialize streaming state
- `appendChunk(sessionId, chunk)` - accumulate content
- `completeStreaming(sessionId)` - convert to permanent message

### Preload Event Exposure

Current preload exposes `onMetadataUpdated` with proper cleanup pattern. Streaming needs:
- `onStreamChunk: (callback: (event: StreamChunkEvent) => void) => () => void`
- `onStreamTool: (callback: (event: StreamToolEvent) => void) => () => void`
- `onStreamEnd: (callback: (event: StreamEndEvent) => void) => () => void`

### ToolCallCard Compatibility

`ToolCallCard.tsx` already handles `result={null}` case (shows "No result available" in italic). This is compatible with pending tool calls during streaming.

---

## Implementation Hints

### 1. Streaming Event Types (add to ipc.ts)

```typescript
export interface StreamChunkEvent {
  sessionId: string
  type: 'text'
  content: string
  uuid?: string
}

export interface StreamToolEvent {
  sessionId: string
  type: 'tool_use' | 'tool_result'
  toolUse?: ToolUseBlock
  toolResult?: ToolResultBlock
}

export interface StreamEndEvent {
  sessionId: string
  success: boolean
  error?: string
  aborted?: boolean
  totalTokens?: { input: number; output: number }
  costUsd?: number
}
```

### 2. Preload Additions (add to sessions object)

```typescript
onStreamChunk: (callback: (event: StreamChunkEvent) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, event: StreamChunkEvent): void => callback(event)
  ipcRenderer.on('stream:chunk', handler)
  return () => ipcRenderer.removeListener('stream:chunk', handler)
},
onStreamTool: (callback: (event: StreamToolEvent) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, event: StreamToolEvent): void => callback(event)
  ipcRenderer.on('stream:tool', handler)
  return () => ipcRenderer.removeListener('stream:tool', handler)
},
onStreamEnd: (callback: (event: StreamEndEvent) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, event: StreamEndEvent): void => callback(event)
  ipcRenderer.on('stream:end', handler)
  return () => ipcRenderer.removeListener('stream:end', handler)
}
```

### 3. useStreamingMessage Hook Structure

```typescript
// src/renderer/src/features/sessions/hooks/useStreamingMessage.ts
interface StreamingState {
  content: string
  toolCalls: ToolUseBlock[]
  isStreaming: boolean
}

function useStreamingMessage(sessionId: string | null): StreamingState {
  const [state, setState] = useState<StreamingState>({ content: '', toolCalls: [], isStreaming: false })

  useEffect(() => {
    if (!sessionId) return

    const unsubChunk = window.grimoireAPI.sessions.onStreamChunk((event) => {
      if (event.sessionId === sessionId) {
        setState(prev => ({ ...prev, content: prev.content + event.content, isStreaming: true }))
      }
    })

    const unsubEnd = window.grimoireAPI.sessions.onStreamEnd((event) => {
      if (event.sessionId === sessionId) {
        setState(prev => ({ ...prev, isStreaming: false }))
      }
    })

    return () => {
      unsubChunk()
      unsubEnd()
    }
  }, [sessionId])

  return state
}
```

### 4. StreamingMessageBubble Component

```typescript
// Extend MessageBubble with cursor animation
interface StreamingMessageBubbleProps {
  content: string
  isStreaming: boolean
  timestamp?: number
}

// CSS for cursor:
// .streaming-cursor::after { content: '|'; animation: blink 1s step-end infinite; }
// @keyframes blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
```

### 5. JumpToLatestButton Component

```typescript
// Show when: isStreaming && !isNearBottom && userScrolledUp
// Position: fixed within scroll container, bottom-4, center
// On click: scrollToBottom() and reset userScrolledUp
```

### 6. ConversationView Integration Points

Replace simulated streaming (lines 51-54, 231-238) with:
```typescript
// Get streaming state from hook
const { content: streamingContent, isStreaming, toolCalls } = useStreamingMessage(sessionId)

// Render StreamingMessageBubble when isStreaming is true
// Show JumpToLatestButton when scrolled away during streaming
// Auto-scroll on content change if near bottom
```

---

## Risk Areas

### 1. Memory Leak from Event Listeners
**Risk:** Event listeners not properly cleaned up on unmount
**Mitigation:** Always return cleanup function from useEffect, verify removeListener called

### 2. Race Conditions with Message Completion
**Risk:** StreamEndEvent arrives before all chunks processed
**Mitigation:** Use completion callback pattern, finalize in useEffect cleanup

### 3. Scroll Position Corruption
**Risk:** Auto-scroll during streaming corrupts saved scroll positions
**Mitigation:** Only save scroll position when NOT streaming (debounce + streaming guard)

### 4. Content Accumulation Performance
**Risk:** String concatenation for every chunk causes GC pressure
**Mitigation:** Consider using array of chunks and join() on render, or use ref for accumulation

### 5. Type Mismatch Between Processes
**Risk:** StreamChunkEvent type not shared between main and renderer
**Mitigation:** Define types in shared/types/ipc.ts, import in both processes

### 6. Simulated Streaming State Interference
**Risk:** Existing simulated `isStreaming` state conflicts with real streaming
**Mitigation:** MUST remove simulated logic entirely when implementing real streaming

---

## Testing Strategy

### Unit Tests Required

**StreamingMessageBubble.test.tsx:**
- Renders content with cursor when `isStreaming=true`
- Cursor hidden when `isStreaming=false`
- Handles empty content gracefully
- Animation classes applied correctly
- Content updates trigger re-render

**useStreamingMessage.test.ts:**
- Accumulates content from sequential chunks
- Tracks isStreaming state transitions
- Handles tool_use events
- Cleans up listeners on unmount (verify removeListener called)
- Handles sessionId changes (resets state)
- Mock `window.grimoireAPI.sessions.onStreamChunk` etc.

**JumpToLatestButton.test.tsx:**
- Visible when scrolled up AND streaming
- Hidden when at bottom OR not streaming
- Click triggers scrollToBottom callback
- Fade animation classes present

**ConversationView.test.tsx (updates):**
- Shows StreamingMessageBubble during streaming
- Auto-scrolls on new chunks when near bottom
- Shows JumpToLatest when scrolled away during streaming
- Transition from streaming to complete message

### Integration Tests

- Full stream flow: chunk -> chunk -> end -> message persisted
- Scroll behavior: auto-scroll during streaming, pause on manual scroll
- Tool cards: appear inline during streaming, show result when received

### Mock Setup

```typescript
// Mock streaming events
const mockOnStreamChunk = vi.fn((callback) => {
  // Store callback for triggering in tests
  mockStreamChunkCallback = callback
  return vi.fn() // cleanup function
})

vi.stubGlobal('grimoireAPI', {
  sessions: {
    onStreamChunk: mockOnStreamChunk,
    onStreamTool: vi.fn(() => vi.fn()),
    onStreamEnd: vi.fn(() => vi.fn())
  }
})
```

---

## Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/renderer/src/features/sessions/components/StreamingMessageBubble.tsx` | Component | Message with cursor animation |
| `src/renderer/src/features/sessions/components/StreamingMessageBubble.test.tsx` | Test | Unit tests |
| `src/renderer/src/features/sessions/components/JumpToLatestButton.tsx` | Component | Scroll resume indicator |
| `src/renderer/src/features/sessions/components/JumpToLatestButton.test.tsx` | Test | Unit tests |
| `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts` | Hook | Event subscription + accumulation |
| `src/renderer/src/features/sessions/hooks/useStreamingMessage.test.ts` | Test | Hook tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types/ipc.ts` | Add StreamChunkEvent, StreamToolEvent, StreamEndEvent types |
| `src/preload/index.ts` | Add onStreamChunk, onStreamTool, onStreamEnd to sessions |
| `src/preload/index.d.ts` | Add type declarations for streaming events |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Integrate useStreamingMessage, add streaming UI |
| `src/renderer/src/features/sessions/store/useConversationStore.ts` | Add streaming state management (optional, can be local to hook) |
| `src/renderer/src/features/sessions/components/index.ts` | Export new components |
| `src/renderer/src/features/sessions/hooks/index.ts` | Export new hooks (create if needed) |

---

## Dependencies

**Blocking:** None - this story can proceed independently

**Downstream:**
- Story 3a-4 (Abort) will use streaming state for abort detection
- Epic 3b will emit the actual streaming events from main process

**Note:** Main process event emission (Epic 3b) is NOT a blocker. This story creates the renderer-side infrastructure to consume events. The events can be tested with mocks.

# Project Context Dump Below
The project context from `_bmad-output/planning-artifacts/project-context.md` is injected below. Do not read that file separately - use this content.

---
project_name: 'grimoire'
user_name: 'Teazyou'
date: '2026-01-23'
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'testing_rules',
    'quality_rules',
    'workflow_rules',
    'anti_patterns'
  ]
status: 'complete'
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Runtime:**

- Electron 39.x (main + renderer process architecture)
- React 19.x with TypeScript 5.9
- Node.js (via Electron main process)

**Build Tools:**

- electron-vite 5.x (single config for main/preload/renderer)
- Vite 7.x with @vitejs/plugin-react
- electron-builder for packaging

**UI Framework:**

- Tailwind CSS 4.x via @tailwindcss/vite plugin (NO tailwind.config.js)
- Radix UI primitives (headless, unstyled components)
- lucide-react for icons
- react-resizable-panels for panel layout

**State Management:**

- Zustand 5.x for renderer UI state
- SQLite (better-sqlite3 12.x) for persistent data
- Zod 4.x for runtime validation at IPC boundaries

**Testing:**

- Vitest 4.x with jsdom environment
- @testing-library/react for component tests
- Colocated test files (`Component.test.tsx`)

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **Strict TypeScript:** Project uses strict mode via @electron-toolkit/tsconfig
- **No implicit any:** All function parameters and returns must be typed
- **Use `type` imports:** For type-only imports use `import type { X }` syntax
- **Zod for runtime validation:** Validate all IPC requests in main process handlers using Zod schemas
- **Transform DB rows:** Always transform snake_case database columns to camelCase TypeScript properties
- **ReactElement returns:** Components should return `ReactElement` type, not `JSX.Element`

### Framework-Specific Rules (Electron + React)

**Electron Process Architecture:**

- Main process: DB access, IPC handlers, child process management, file system operations
- Preload: Thin contextBridge layer, NO validation (validation in main process)
- Renderer: React components, Zustand stores, IPC calls via `window.grimoireAPI`

**IPC Patterns:**

- Channel naming: `namespace:action` format (e.g., `sessions:list`, `sessions:spawn`)
- Request validation: All IPC handlers must validate input with Zod schemas
- Error handling: Let errors propagate as rejections, renderer catches in try/catch
- Keep preload thin: No business logic, just invoke/send wrappers

**React Patterns:**

- Functional components only with explicit `ReactElement` return type
- Hooks at top level, no conditional hooks
- Use Radix UI primitives for accessible interactive components
- CSS variables for theming: `var(--text-muted)`, `var(--border)`, etc.
- Use `cn()` utility from `@renderer/shared/utils/cn` for conditional classes

**State Management:**

- Zustand stores in `shared/store/` folder with `use{Name}Store.ts` naming
- Separate stores per domain (useUIStore, useSessionStore, etc.)
- Use `set()` with partial state for updates - never mutate directly
- For complex updates, use callback form: `set((state) => ({ ... }))`
- Main process state accessed via IPC, not direct imports

### Testing Rules

- **Colocate tests:** Test file next to source file (`Component.tsx` + `Component.test.tsx`)
- **Test environments:** jsdom for renderer tests, node for main/preload tests (via environmentMatchGlobs)
- **Setup file:** Tests use `src/test-setup.ts` for global configuration
- **Import patterns:** Use `@renderer/` alias in renderer tests, relative paths in main tests
- **Mock IPC:** Mock `window.grimoireAPI` methods for renderer component tests
- **Validate script:** Run `npm run validate` (typecheck + test + lint) before committing

### Code Quality & Style Rules

**File Naming:**

- React components: `PascalCase.tsx` (e.g., `SessionList.tsx`)
- Test files: `PascalCase.test.tsx` (colocated)
- Zustand stores: `use{Name}Store.ts` (e.g., `useUIStore.ts`)
- Utilities: `camelCase.ts` (e.g., `formatRelativeTime.ts`)
- Types: `types.ts` or domain-specific (e.g., `ipc.ts`)

**Database Conventions:**

- Table names: snake_case, plural (`sessions`, `file_edits`)
- Column names: snake_case (`folder_path`, `created_at`)
- Booleans: INTEGER 0/1 in DB, transformed to boolean in TypeScript
- Timestamps: Unix milliseconds (INTEGER), transform to Date as needed
- Schema file: `src/shared/db/schema.sql` with VERSION comment

**Path Aliases:**

- `@renderer`: Maps to `src/renderer/src` (renderer code only)
- Use relative paths for imports within same feature folder

**Linting:**

- ESLint with @electron-toolkit configs
- Prettier for formatting
- React Hooks plugin (exhaustive-deps) enabled
- ESLint cache enabled: `npm run lint` uses `--cache`

### Development Workflow Rules

**Project Structure:**

```
src/
  main/           # Electron main process (Node.js)
  preload/        # Context bridge (thin layer)
  renderer/src/   # React application
    core/shell/   # App shell components
    features/     # Feature modules (sessions, etc.)
    shared/       # Shared utils, stores, components
  shared/         # Shared between main & renderer
    types/        # Zod schemas and TypeScript types
    db/           # Database schema
```

**Scripts:**

- `npm run dev` - Start development with HMR
- `npm run validate` - Full validation (typecheck + test + lint)
- `npm run build:mac` - Build for macOS
- `npm test` - Run tests once
- `npm run test:watch` - Watch mode for tests

**Feature Organization:**

- Features in `features/{feature-name}/` folders
- Each feature has: `components/`, `store/` (if needed), `hooks/` (if needed)
- Feature stores are domain-specific Zustand stores

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**

- NEVER access SQLite from renderer process - always use IPC
- NEVER use `git add .` or `git add -A` - add specific files
- NEVER mutate Zustand state directly - always use `set()`
- NEVER skip Zod validation for IPC requests in main process
- NEVER import main process modules into renderer or vice versa
- NEVER use `require()` in renderer - use ESM imports only
- NEVER put business logic in preload - keep it minimal

**Electron-Specific Gotchas:**

- Main window preload path: `join(__dirname, '../preload/index.js')`
- Dev mode check: `is.dev && process.env['ELECTRON_RENDERER_URL']`
- Process cleanup: Handle `before-quit` to terminate child processes
- DB initialization: Call `initDatabase()` in main process on app ready
- Schema import: Use `?raw` suffix to import SQL as string

**IPC Channel Requirements:**

- All channels in `sessions:` namespace for session operations
- All channels in `dialog:` namespace for native dialogs
- Event channels (main -> renderer) use same namespace pattern
- Documented channels in `src/preload/index.ts` grimoireAPI object

**Database Schema Changes:**

- Bump VERSION comment in `schema.sql` when modifying
- MVP uses recreate-on-change migration (data loss acceptable)
- FK constraints enabled by default in SQLite

**CSS/Styling Rules:**

- Tailwind CSS v4: Import via `@import "tailwindcss"` in CSS
- NO tailwind.config.js - v4 uses CSS-based configuration
- Use CSS custom properties for theming (defined in index.css)
- Radix components are unstyled - apply Tailwind classes directly

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Run `npm run validate` after making changes
- Check existing patterns in codebase before creating new ones

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack or major patterns change
- Review periodically for outdated rules
- Remove rules that become obvious or obsolete

Last Updated: 2026-01-23
