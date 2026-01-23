# Technical Discovery: Story 3a-4 Abort and Resume

**Generated:** 2026-01-24
**Story:** 3a-4-abort-and-resume
**Status:** Discovery Complete

---

## Technical Context

### Key File Paths and Current State

| File | Purpose | Current State |
|------|---------|---------------|
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.tsx` | Send/Abort UI | Has `onSend`, `disabled` props - NO abort button props |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx` | Panel integration | Passes `disabled={sessionState === 'working'}` to ChatInput - NO abort callback |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useConversationStore.ts` | Message store | Has `addErrorMessage` - NO `addAbortedMessage` |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ConversationView.tsx` | Message display | Accepts `ConversationMessage[]` - NOT `DisplayMessage[]` (blocks SystemMessage rendering) |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | IPC bridge | Has `terminate` - NO `abort` method |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | IPC types | Matches preload - NO abort type |
| `/Users/teazyou/dev/grimoire/src/main/ipc/sessions.ts` | IPC handlers | Has `sessions:terminate` handler, NO `sessions:abort` |
| `/Users/teazyou/dev/grimoire/src/shared/types/ipc.ts` | Schemas | Has `TerminateRequestSchema` - NO `AbortRequestSchema` |
| `/Users/teazyou/dev/grimoire/src/main/process-registry.ts` | Process tracking | Empty Map placeholder - processes populated by Epic 3b |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` | UI state | Has `updateTabSessionState(tabId, state)` with SessionState type |

### Component Dependencies

```
MiddlePanelContent.tsx
    |
    +-> useConversationStore (getMessages)
    +-> useSendMessage (sendMessage)
    +-> [NEEDED] useAbortSession (abort, isAborting)
    +-> ChatInput (onSend, disabled, hasMessages)
           |
           +-> [NEEDED] onAbort prop
           +-> [NEEDED] isWorking prop (controls button swap)
           +-> [NEEDED] isAborting prop (loading state)
    +-> ConversationView (messages, sessionId, sessionState)
           |
           +-> [ISSUE] Accepts ConversationMessage[], needs DisplayMessage[]
```

### Patterns to Follow

**Terminate Handler Pattern (from sessions.ts lines 24-45):**
```typescript
ipcMain.handle('sessions:terminate', async (_, data: unknown) => {
  const { sessionId } = TerminateRequestSchema.parse(data)
  const child = processRegistry.get(sessionId)
  if (!child) return { success: true }

  child.kill('SIGTERM')

  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5000))
  ])

  if (!child.killed) {
    child.kill('SIGKILL')
  }

  processRegistry.delete(sessionId)
  return { success: true }
})
```

**Error Message Pattern (from useConversationStore.ts lines 101-116):**
```typescript
addErrorMessage: (sessionId, errorContent) => {
  const errorMessage: SystemMessage = {
    type: 'system',
    uuid: `error-${crypto.randomUUID()}`,
    content: errorContent,
    timestamp: Date.now(),
    isError: true
  }
  set((state) => {
    const newMessages = new Map(state.messages)
    const sessionMessages = newMessages.get(sessionId) ?? []
    newMessages.set(sessionId, [...sessionMessages, errorMessage])
    return { messages: newMessages }
  })
}
```

**State Transition Pattern (from useSendMessage.ts lines 88-89):**
```typescript
updateTabSessionState(tabId, 'working')
// ... on completion ...
updateTabSessionState(tabId, 'idle')
```

---

## Investigation Results

### Critical Blocking Issues Identified

#### Issue #1: ConversationView Type Incompatibility (CRITICAL)

**Location:** `ConversationView.tsx` line 18
**Current:** `messages: ConversationMessage[]`
**Required:** `messages: DisplayMessage[]` (to render SystemMessage including abort messages)

**Impact:** Abort messages (SystemMessage with `isError: false`) will NOT render without this fix.

**Related:** `MiddlePanelContent.tsx` line 68 has cast `as ConversationMessage[]` that masks this issue.

#### Issue #2: Missing addAbortedMessage Store Action (CRITICAL)

**Location:** `useConversationStore.ts`
**Current:** Only has `addErrorMessage(sessionId, errorContent)`
**Required:** `addAbortedMessage(sessionId)` to add non-error system message

**Impact:** useAbortSession hook cannot add abort message to conversation.

#### Issue #3: Missing Preload Abort Method (CRITICAL)

**Location:** `preload/index.ts` sessions object
**Current:** Has `terminate`, `sendMessage`, `onMetadataUpdated`
**Required:** `abort: (data: { sessionId: string }) => Promise<{ success: boolean; error?: string }>`

**Impact:** Renderer cannot invoke abort IPC call.

#### Issue #4: Missing IPC Handler (CRITICAL)

**Location:** `main/ipc/sessions.ts`
**Current:** Has `sessions:terminate` (different semantics - for cleanup on close)
**Required:** `sessions:abort` handler with graceful termination + event emission

**Impact:** No backend to handle abort request.

#### Issue #5: ChatInput Props Not Extended (HIGH)

**Location:** `ChatInput.tsx` lines 13-24
**Current Props:** `onSend`, `disabled`, `placeholder`, `autoFocus`, `hasMessages`
**Required Props:** `onAbort?: () => void`, `isAborting?: boolean`, `isWorking?: boolean`

**Impact:** Cannot show abort button or pass abort callback.

### Existing Terminate vs New Abort

`sessions:terminate` exists but has different semantics:
- Used for cleanup when closing a tab/app
- No event emission to renderer
- No abort message added to conversation

`sessions:abort` should:
- Send SIGTERM/SIGKILL to process
- Emit `stream:end` event with `aborted: true`
- Return success/failure status
- Allow renderer to add abort message and transition state

---

## Implementation Hints

### 1. Add AbortRequestSchema (ipc.ts)

```typescript
export const AbortRequestSchema = z.object({
  sessionId: z.string().uuid()
})
export type AbortRequest = z.infer<typeof AbortRequestSchema>
```

### 2. Add Abort IPC Handler (sessions.ts)

```typescript
import { BrowserWindow } from 'electron'

ipcMain.handle('sessions:abort', async (event, data: unknown) => {
  const { sessionId } = AbortRequestSchema.parse(data)
  const child = processRegistry.get(sessionId)

  if (!child) {
    return { success: false, error: 'No active process for session' }
  }

  try {
    child.kill('SIGTERM')

    // Wait for graceful exit (500ms)
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 500))
    ])

    // Force kill if still running
    if (!child.killed) {
      child.kill('SIGKILL')
    }

    processRegistry.delete(sessionId)

    // Emit abort event to renderer
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.webContents.send('stream:end', {
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

### 3. Add Preload Abort Method (preload/index.ts)

```typescript
// In sessions object:
abort: (data: { sessionId: string }): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('sessions:abort', data),
```

### 4. Add Type Declaration (preload/index.d.ts)

```typescript
// In GrimoireAPI.sessions:
abort: (data: { sessionId: string }) => Promise<{ success: boolean; error?: string }>
```

### 5. Add addAbortedMessage to Store (useConversationStore.ts)

```typescript
// Add to interface:
addAbortedMessage: (sessionId: string) => void

// Add implementation:
addAbortedMessage: (sessionId) => {
  const abortedMessage: SystemMessage = {
    type: 'system',
    uuid: `aborted-${crypto.randomUUID()}`,
    content: 'Response generation was aborted',
    timestamp: Date.now(),
    isError: false  // Distinguishes from error styling
  }
  set((state) => {
    const newMessages = new Map(state.messages)
    const sessionMessages = newMessages.get(sessionId) ?? []
    newMessages.set(sessionId, [...sessionMessages, abortedMessage])
    return { messages: newMessages }
  })
}
```

### 6. Fix ConversationView Type (ConversationView.tsx)

```typescript
// Change line 18 from:
messages: ConversationMessage[]
// To:
messages: DisplayMessage[]

// Import DisplayMessage from store:
import type { DisplayMessage } from '../store/useConversationStore'

// Update message rendering to check for SystemMessage:
{messages.map((msg, index) => {
  if (msg.type === 'system') {
    // Render SystemMessage (abort or error)
    return (
      <div key={msg.uuid} className={cn(
        'text-sm italic',
        msg.isError ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'
      )}>
        {msg.content}
      </div>
    )
  }
  // Existing ConversationMessage rendering...
})}
```

### 7. Remove Cast in MiddlePanelContent (line 68)

```typescript
// Change from:
messages={displayMessages as ConversationMessage[]}
// To:
messages={displayMessages}
```

### 8. Create useAbortSession Hook

```typescript
// src/renderer/src/features/sessions/hooks/useAbortSession.ts
interface UseAbortSessionResult {
  abort: () => Promise<void>
  isAborting: boolean
}

function useAbortSession(sessionId: string | null, tabId: string): UseAbortSessionResult {
  const [isAborting, setIsAborting] = useState(false)
  const { addAbortedMessage } = useConversationStore()
  const { updateTabSessionState } = useUIStore()

  const abort = useCallback(async () => {
    if (!sessionId || isAborting) return

    setIsAborting(true)
    try {
      const result = await window.grimoireAPI.sessions.abort({ sessionId })
      if (result.success) {
        addAbortedMessage(sessionId)
        updateTabSessionState(tabId, 'idle')
      } else {
        console.error('Abort failed:', result.error)
      }
    } catch (error) {
      console.error('Abort error:', error)
    } finally {
      setIsAborting(false)
    }
  }, [sessionId, tabId, isAborting, addAbortedMessage, updateTabSessionState])

  return { abort, isAborting }
}
```

### 9. Extend ChatInput Props and UI

```typescript
// Add to ChatInputProps:
onAbort?: () => void
isAborting?: boolean
isWorking?: boolean

// Update button rendering:
{isWorking ? (
  <button
    type="button"
    onClick={onAbort}
    disabled={isAborting}
    className={cn(
      'p-2 rounded-[var(--radius-sm)] bg-red-600 text-white',
      'hover:bg-red-700 transition-colors',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    )}
    aria-label="Stop generation (Escape)"
  >
    {isAborting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
  </button>
) : (
  // Existing send button
)}
```

### 10. Update MiddlePanelContent Integration

```typescript
// Import hook:
import { useAbortSession } from '@renderer/features/sessions/hooks/useAbortSession'

// Use hook:
const { abort, isAborting } = useAbortSession(
  activeTab?.sessionId ?? null,
  activeTab?.id ?? ''
)

// Pass to ChatInput:
<ChatInput
  onSend={sendMessage}
  onAbort={abort}
  isAborting={isAborting}
  isWorking={activeTab.sessionState === 'working'}
  autoFocus={false}
  hasMessages={displayMessages.length > 0}
  disabled={activeTab.sessionState === 'working'}
/>
```

### 11. Add Escape Key Handler

```typescript
// In ConversationView or MiddlePanelContent:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && sessionState === 'working' && !isAborting) {
      abort()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [sessionState, isAborting, abort])
```

---

## Risk Areas

### 1. Process Kill Race Conditions
**Risk:** Process exits before SIGKILL timeout, registry already cleared
**Mitigation:** Check `child.killed` before force kill, use `.once('exit')` listener

### 2. State Desync Between Main and Renderer
**Risk:** Abort succeeds but renderer doesn't update state
**Mitigation:** Always emit `stream:end` event, let renderer handle state transition

### 3. Double-Abort Prevention
**Risk:** User clicks abort multiple times rapidly
**Mitigation:** `isAborting` state prevents concurrent abort calls, disable button during abort

### 4. Orphaned Processes
**Risk:** Abort fails but process still running
**Mitigation:** Force SIGKILL after timeout, verify deletion from registry

### 5. Type System Cascade Changes
**Risk:** Changing ConversationView props type ripples to many files
**Mitigation:** Update only ConversationView and MiddlePanelContent, maintain backward compatibility

### 6. Missing Process Registry Entry
**Risk:** Abort called but process not in registry (edge case)
**Mitigation:** Return error response "No active process for session", don't crash

---

## Testing Strategy

### Unit Tests Required

**AbortButton.test.tsx (if separate component):**
- Renders when visible
- Hidden when `visible=false`
- Calls `onAbort` on click
- Shows loading state when `isAborting=true`
- Disabled during abort

**useAbortSession.test.ts:**
- Calls IPC `abort` method with correct sessionId
- Sets `isAborting=true` during abort
- Calls `addAbortedMessage` on success
- Calls `updateTabSessionState(tabId, 'idle')` on success
- Handles abort error gracefully (logs, doesn't crash)
- Returns early when `sessionId` is null
- Prevents concurrent abort calls

**ChatInput.test.tsx (updates):**
- Shows abort button when `isWorking=true`
- Shows send button when `isWorking=false`
- Abort button calls `onAbort` callback
- Abort button disabled when `isAborting=true`
- Send button still works when not working

**ConversationView.test.tsx (updates):**
- Renders SystemMessage with `type: 'system'`
- Aborted message has muted styling (not error)
- Error message has error styling

### Integration Tests

- Full abort flow: working state -> abort click -> IPC call -> state idle
- Keyboard shortcut: Escape triggers abort during working
- Resume flow: abort -> send new message -> working state

### Mock Setup

```typescript
// Mock abort IPC
vi.stubGlobal('grimoireAPI', {
  sessions: {
    abort: vi.fn().mockResolvedValue({ success: true }),
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  }
})

// Mock useUIStore
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn(() => ({
    updateTabSessionState: vi.fn()
  }))
}))

// Mock useConversationStore
vi.mock('../store/useConversationStore', () => ({
  useConversationStore: vi.fn(() => ({
    addAbortedMessage: vi.fn()
  }))
}))
```

---

## Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/renderer/src/features/sessions/components/AbortButton.tsx` | Component | Abort button (optional - can inline in ChatInput) |
| `src/renderer/src/features/sessions/components/AbortButton.test.tsx` | Test | Unit tests |
| `src/renderer/src/features/sessions/hooks/useAbortSession.ts` | Hook | Abort logic |
| `src/renderer/src/features/sessions/hooks/useAbortSession.test.ts` | Test | Hook tests |

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/shared/types/ipc.ts` | Add `AbortRequestSchema` | P1 - BLOCKING |
| `src/main/ipc/sessions.ts` | Add `sessions:abort` handler | P1 - BLOCKING |
| `src/preload/index.ts` | Add `abort` method to sessions | P1 - BLOCKING |
| `src/preload/index.d.ts` | Add abort type declaration | P1 - BLOCKING |
| `src/renderer/src/features/sessions/store/useConversationStore.ts` | Add `addAbortedMessage` action | P1 - BLOCKING |
| `src/renderer/src/features/sessions/components/ConversationView.tsx` | Change props type to `DisplayMessage[]`, add SystemMessage rendering | P1 - BLOCKING |
| `src/renderer/src/core/shell/MiddlePanelContent.tsx` | Remove cast, integrate useAbortSession, pass abort props | P2 - HIGH |
| `src/renderer/src/features/sessions/components/ChatInput.tsx` | Add abort props, button swap logic | P2 - HIGH |
| `src/renderer/src/features/sessions/components/ChatInput.test.tsx` | Add abort button tests | P3 |
| `src/renderer/src/features/sessions/components/ConversationView.test.tsx` | Add SystemMessage rendering tests | P3 |
| `src/renderer/src/features/sessions/components/index.ts` | Export AbortButton if created | P4 |
| `src/renderer/src/features/sessions/hooks/index.ts` | Export useAbortSession | P4 |

---

## Dependencies

**Blocking for this story:**
- Story 3a-2 (Message Send Flow) - COMPLETED

**Deferred functionality (requires Story 3a-3 / Epic 3b):**
- Partial content preservation on abort (AC6)
- StreamingMessage state handling on abort

**Note:** Core abort functionality (terminate process, add message, state transition) works WITHOUT streaming infrastructure. Partial content preservation is deferred.

---

## Implementation Order

Recommended order to avoid cascading failures:

1. **IPC Layer First:**
   - Add `AbortRequestSchema` to `ipc.ts`
   - Add `sessions:abort` handler to `main/ipc/sessions.ts`
   - Add `abort` to `preload/index.ts`
   - Add type to `preload/index.d.ts`

2. **Store Layer:**
   - Add `addAbortedMessage` to `useConversationStore.ts`

3. **Type Fix (ConversationView):**
   - Change props type to `DisplayMessage[]`
   - Add SystemMessage rendering logic
   - Remove cast in MiddlePanelContent

4. **Hook Layer:**
   - Create `useAbortSession.ts`
   - Create tests

5. **UI Layer:**
   - Update ChatInput props and button rendering
   - Integrate hook in MiddlePanelContent
   - Add Escape key handler

6. **Tests:**
   - Update existing tests for new props/behavior
   - Add new tests for abort functionality

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
