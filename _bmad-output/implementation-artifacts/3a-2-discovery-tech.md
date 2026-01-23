# Technical Discovery: Story 3a-2 Message Send Flow

## Technical Context

### Key File Paths

**New Files to Create:**
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useSendMessage.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useSendMessage.test.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useConversationStore.ts`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useConversationStore.test.ts`

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/src/main/ipc/sessions.ts` - Add sendMessage handler (after line 305)
- `/Users/teazyou/dev/grimoire/src/shared/types/ipc.ts` - Add SendMessageSchema (after line 170)
- `/Users/teazyou/dev/grimoire/src/preload/index.ts` - Expose sessions.sendMessage
- `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` - Add type declaration
- `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` - Add updateTabSessionId action
- `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx` - Use send hook

**Reference Files:**
- `/Users/teazyou/dev/grimoire/src/main/ipc/sessions.ts` - IPC handler patterns
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useSessionStore.ts` - Store patterns
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/hooks/useTimelineEvents.ts` - Hook patterns

### Component Dependencies

**External Libraries:**
- `zod` - IPC validation (already in project)
- `zustand` - State management (already in project)
- `crypto.randomUUID()` - UUID generation (built-in)

**Internal Dependencies:**
- `useUIStore` - Tab state management (updateTabSessionState, updateTabSessionId)
- `useSessionStore` - Session list for folderPath lookup
- `window.grimoireAPI.sessions` - IPC bridge

### Patterns to Follow

**IPC Handler Pattern (from sessions.ts lines 263-305):**
```typescript
ipcMain.handle('sessions:sendMessage', async (_, data: unknown) => {
  const validated = SendMessageSchema.parse(data)
  // ... implementation
  return { success: true }
})
```

**Zustand Store Pattern (from useSessionStore.ts):**
```typescript
import { create } from 'zustand'

interface ConversationStoreState {
  // State
  messages: Map<string, ConversationMessage[]>
  // Actions
  addMessage: (sessionId: string, message: ConversationMessage) => void
}

export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  messages: new Map(),
  addMessage: (sessionId, message) =>
    set((state) => {
      const newMap = new Map(state.messages)
      const existing = newMap.get(sessionId) ?? []
      newMap.set(sessionId, [...existing, message])
      return { messages: newMap }
    })
}))
```

**Hook Pattern (from useTimelineEvents.ts):**
```typescript
export function useSendMessage(
  sessionId: string | null,
  folderPath: string,
  isNewSession: boolean
) {
  // Hook implementation
}
```

---

## Investigation Results

### Existing IPC Infrastructure Analysis

**sessions.ts Structure:**
- Line 1-20: Imports (including Zod schemas from ipc.ts)
- Line 22: registerSessionsIPC() function
- Line 23-44: sessions:terminate handler
- Line 99-113: sessions:create handler - **Key reference for new session creation**
- Line 263-305: sessions:rewind handler - **Similar pattern to sendMessage**

**sessions:create Pattern (lines 99-113):**
```typescript
ipcMain.handle('sessions:create', async (_, data: unknown) => {
  const { folderPath } = CreateSessionSchema.parse(data)
  const sessionId = randomUUID()
  const now = Date.now()
  const db = getDatabase()

  db.prepare(`
    INSERT INTO sessions (id, folder_path, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, folderPath, now, now)

  return { sessionId }
})
```

### Preload API Pattern

**Current sessions namespace (index.ts lines 26-77):**
```typescript
const grimoireAPI = {
  sessions: {
    // ... existing methods
    create: (folderPath: string): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke('sessions:create', { folderPath }),
    rewind: (data: {...}): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke('sessions:rewind', data),
  }
}
```

**Type Declaration Pattern (index.d.ts lines 11-42):**
```typescript
export interface GrimoireAPI {
  sessions: {
    // ... existing methods
    rewind: (data: {
      sessionId: string
      checkpointUuid: string
      newMessage: string
    }) => Promise<{ sessionId: string }>
  }
}
```

### useUIStore Analysis

**Existing Actions (lines 46-64):**
- `updateTabSessionState(tabId, sessionState)` - Line 56
- `updateTabTitle(tabId, title)` - Line 57

**MISSING Action (needs to be added):**
- `updateTabSessionId(tabId, sessionId)` - Required for new session flow

**Tab Interface (lines 8-14):**
```typescript
export interface Tab {
  id: string
  type: 'session' | 'subagent' | 'file'
  title: string
  sessionId: string | null  // null for unsaved sessions
  sessionState: SessionState // 'idle' | 'working' | 'error'
}
```

### FolderPath Source Analysis

**For Existing Sessions:**
- Look up session from `useSessionStore.sessions` by sessionId
- Extract `session.folderPath`

**Pattern in useSessionStore (lines 90-95):**
```typescript
export const selectSessionById = (
  sessions: SessionWithExists[],
  sessionId: string
): SessionWithExists | undefined => {
  return sessions.find((s) => s.id === sessionId)
}
```

### MiddlePanelContent Current State

**Lines 17-18 (mock messages):**
```typescript
const mockMessages = useMemo(() => createMockMessages(), [])
```
This will be replaced with useConversationStore.

**Lines 39-43 (ConversationView usage):**
```typescript
<ConversationView
  messages={mockMessages}
  sessionId={activeTab.sessionId}
  sessionState={activeTab.sessionState}
/>
```

---

## Implementation Hints

### SendMessage Schema (ipc.ts)

Add after RewindRequestSchema (around line 170):
```typescript
// ============================================================
// Message Send Schemas (Story 3a.2)
// ============================================================

export const SendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  folderPath: z.string().min(1),
  isNewSession: z.boolean().optional().default(false)
})

export type SendMessageRequest = z.infer<typeof SendMessageSchema>
```

### IPC Handler (sessions.ts)

Add after the rewind handler (after line 305):
```typescript
// Send message to session (Story 3a.2)
// NOTE: Actual CC spawn will be implemented in Epic 3b
ipcMain.handle('sessions:sendMessage', async (_, data: unknown) => {
  const { sessionId, message, folderPath, isNewSession } = SendMessageSchema.parse(data)

  const db = getDatabase()

  // Create session in DB if new
  if (isNewSession) {
    const now = Date.now()
    db.prepare(`
      INSERT INTO sessions (id, folder_path, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, folderPath, now, now)
  }

  // Epic 3b will add: Spawn CC child process here
  // For now, acknowledge message received
  return { success: true }
})
```

### Preload Method (index.ts)

Add to sessions object:
```typescript
sendMessage: (data: {
  sessionId: string
  message: string
  folderPath: string
  isNewSession?: boolean
}): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('sessions:sendMessage', data),
```

### useConversationStore Structure

```typescript
import { create } from 'zustand'
import type { ConversationMessage } from '../components/types'

interface ConversationStoreState {
  // State - Map keyed by sessionId
  messages: Map<string, ConversationMessage[]>

  // Actions
  addMessage: (sessionId: string, message: ConversationMessage) => void
  addOptimisticMessage: (sessionId: string, content: string) => string // returns tempId
  addErrorMessage: (sessionId: string, errorText: string) => void
  getMessages: (sessionId: string) => ConversationMessage[]
}

export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  messages: new Map(),

  addMessage: (sessionId, message) =>
    set((state) => {
      const newMap = new Map(state.messages)
      const existing = newMap.get(sessionId) ?? []
      newMap.set(sessionId, [...existing, message])
      return { messages: newMap }
    }),

  addOptimisticMessage: (sessionId, content) => {
    const tempId = crypto.randomUUID()
    const message: ConversationMessage = {
      uuid: tempId,
      role: 'user',
      content,
      timestamp: Date.now()
    }
    get().addMessage(sessionId, message)
    return tempId
  },

  addErrorMessage: (sessionId, errorText) => {
    const message: ConversationMessage = {
      uuid: crypto.randomUUID(),
      role: 'assistant', // System error displayed as assistant
      content: errorText,
      timestamp: Date.now()
    }
    get().addMessage(sessionId, message)
  },

  getMessages: (sessionId) => get().messages.get(sessionId) ?? []
}))
```

### useSendMessage Hook

```typescript
import { useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useConversationStore } from '../store/useConversationStore'

export function useSendMessage(
  tabId: string,
  sessionId: string | null,
  folderPath: string,
  isNewSession: boolean
) {
  const { updateTabSessionState, updateTabSessionId } = useUIStore()
  const { addOptimisticMessage, addErrorMessage } = useConversationStore()

  const sendMessage = useCallback(async (message: string) => {
    // Generate UUID for new sessions
    const effectiveSessionId = sessionId ?? crypto.randomUUID()

    // 1. Add optimistic message
    addOptimisticMessage(effectiveSessionId, message)

    // 2. Update tab state to working
    updateTabSessionState(tabId, 'working')

    // 3. Update tab sessionId if new session
    if (!sessionId) {
      updateTabSessionId(tabId, effectiveSessionId)
    }

    try {
      // 4. Call IPC
      await window.grimoireAPI.sessions.sendMessage({
        sessionId: effectiveSessionId,
        message,
        folderPath,
        isNewSession: !sessionId
      })

      // Success - wait for response (Epic 3a.3)
      // For now, just set back to idle after brief delay (stub)
      setTimeout(() => updateTabSessionState(tabId, 'idle'), 1000)
    } catch (error) {
      // 5. Handle error
      addErrorMessage(
        effectiveSessionId,
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      updateTabSessionState(tabId, 'error')
    }
  }, [
    tabId, sessionId, folderPath, addOptimisticMessage,
    addErrorMessage, updateTabSessionState, updateTabSessionId
  ])

  return sendMessage
}
```

### updateTabSessionId Action (useUIStore.ts)

Add to UIState interface (around line 56):
```typescript
updateTabSessionId: (tabId: string, sessionId: string) => void
```

Add implementation (after updateTabTitle):
```typescript
updateTabSessionId: (tabId, sessionId) =>
  set((state) => ({
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, sessionId } : t))
  })),
```

---

## Risk Areas

### 1. FolderPath Missing for New Sessions
- **Risk:** New session tabs may not have folderPath available
- **Mitigation:** Current flow requires folder selection before session creation
- **Verification:** Error if folderPath is empty when sending first message

### 2. Optimistic Update Rollback Complexity
- **Risk:** Message appears but IPC fails - confusing UX
- **Mitigation:** Keep message visible but add error message below it
- **Decision:** Do NOT remove the user's message on failure (preserves input per FR53)

### 3. Session State Race Conditions
- **Risk:** Multiple rapid sends causing state confusion
- **Mitigation:** Disable input when sessionState is 'working'
- **Verification:** Test rapid click scenarios

### 4. Store Map Immutability
- **Risk:** Mutating Map directly instead of creating new Map
- **Mitigation:** Always use `new Map(state.messages)` pattern
- **Verification:** Test state updates don't affect previous snapshots

### 5. Missing updateTabSessionId Action
- **Risk:** New sessions won't properly associate tab with session
- **Mitigation:** Add action explicitly (documented in story)
- **Verification:** Test new session flow updates tab correctly

### 6. IPC Schema Import
- **Risk:** Forgetting to import SendMessageSchema in sessions.ts
- **Mitigation:** Add to existing import block at top of file
- **Verification:** TypeScript will catch if schema not imported

---

## Testing Strategy

### Unit Tests (useSendMessage.test.ts)

**Send Flow Tests:**
1. Calls addOptimisticMessage with correct sessionId and content
2. Updates tab session state to 'working' on send
3. Calls IPC with correct parameters
4. Generates UUID for new sessions (sessionId is null)
5. Calls updateTabSessionId for new sessions

**Error Handling Tests:**
6. Adds error message on IPC failure
7. Updates session state to 'error' on failure
8. Error message contains useful information

### Store Tests (useConversationStore.test.ts)

**State Management Tests:**
1. addMessage creates new session entry if not exists
2. addMessage appends to existing session messages
3. addOptimisticMessage returns temp UUID
4. addOptimisticMessage creates user-role message
5. addErrorMessage creates assistant-role message
6. getMessages returns empty array for unknown session

**Immutability Tests:**
7. State updates create new Map instances
8. Previous state snapshots unchanged after updates

### Integration Tests (MiddlePanelContent.test.tsx)

**Component Integration:**
1. onSend callback triggers useSendMessage hook
2. Input disabled when sessionState is 'working'
3. Messages from useConversationStore render correctly

**Mock Setup:**
```typescript
vi.mock('@renderer/features/sessions/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(() => vi.fn())
}))

vi.mock('@renderer/features/sessions/store/useConversationStore', () => ({
  useConversationStore: vi.fn(() => ({
    getMessages: () => []
  }))
}))
```

### IPC Tests (sessions.ts)

Note: IPC handlers tested in node environment, not jsdom.

```typescript
// Test with mock ipcMain
describe('sessions:sendMessage', () => {
  it('creates session when isNewSession is true', async () => {
    // ... test implementation
  })

  it('returns success for valid request', async () => {
    // ... test implementation
  })
})
```

---

## Validation Checklist

Before marking story complete:
- [ ] `npm run validate` passes (typecheck + test + lint)
- [ ] SendMessageSchema added to ipc.ts
- [ ] sessions:sendMessage IPC handler added to sessions.ts
- [ ] sendMessage method exposed in preload
- [ ] Type declarations updated in index.d.ts
- [ ] updateTabSessionId action added to useUIStore
- [ ] useConversationStore created with optimistic update pattern
- [ ] useSendMessage hook created and tested
- [ ] MiddlePanelContent uses send hook
- [ ] Input disabled during 'working' state
- [ ] Error messages display in conversation
- [ ] New session flow generates UUID correctly

---

## References

- Story file: `_bmad-output/implementation-artifacts/3a-2-message-send-flow.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project context: `_bmad-output/planning-artifacts/project-context.md`

---

## Dependency Note

**REQUIRED:** Story 3a-1 (Chat Input Component) must be completed before this story.
- This story implements the `onSend` handler that ChatInput will call
- ChatInput provides the UI; this story provides the logic

**DOWNSTREAM:** Epic 3b will implement actual CC child process spawning.
- The IPC handler created here is a stub that returns success
- Epic 3b will add spawn logic using the same IPC channel

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
