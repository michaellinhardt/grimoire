# Discovery File: Story 3a-4 Abort and Resume

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **to abort a running process and resume later**,
So that **I can stop unwanted operations and continue when ready**.

### Acceptance Criteria

**AC1: Abort running process (FR57)**
- Given CC is processing a request
- When the user clicks the abort button (or presses Escape)
- Then the running CC process is terminated
- And streaming stops immediately

**AC2: Aborted message display (FR58)**
- Given a process is aborted
- When the abort completes
- Then an "Aborted" message is displayed in the conversation
- And the message has distinct styling (muted, italic)
- And the session state transitions to Idle

**AC3: Resume after abort (FR59)**
- Given a session was aborted
- When the user types a new message
- Then the session resumes normally
- And a new CC process spawns with the session ID
- And conversation continues from where it was aborted

**AC4: Abort button visibility**
- Given the abort button is displayed
- When no process is running
- Then the abort button is hidden or disabled
- And the send button is shown instead

### Technical Requirements
- FR57: User can abort a running CC process
- FR58: System displays "Aborted" message in conversation when user aborts
- FR59: User can resume aborted session by typing new message
- AR15: 3-state instance machine supports Working -> Idle transition on abort

## Previous Story Learnings (from Stories 3a-1, 3a-2, and 3a-3)

### Files Created in Story 3a-1 (Chat Input Component)
- `src/renderer/src/features/sessions/components/ChatInput.tsx` - Chat input with auto-expand, Enter/Shift+Enter handling, disabled state
- `src/renderer/src/features/sessions/components/ChatInput.test.tsx` - 18+ unit tests

### Files Created in Story 3a-2 (Message Send Flow)
- `src/renderer/src/features/sessions/hooks/useSendMessage.ts` - Message send logic, state transitions
- `src/renderer/src/features/sessions/hooks/useSendMessage.test.ts` - 11 tests
- `src/renderer/src/features/sessions/store/useConversationStore.ts` - Local message state, optimistic updates, system messages
- `src/main/ipc/sessions.ts` - `sessions:sendMessage` IPC handler
- `src/shared/types/ipc.ts` - `SendMessageSchema`
- `src/preload/index.ts` - Exposed `sessions.sendMessage`
- `src/renderer/src/shared/store/useUIStore.ts` - `updateTabSessionState`, `updateTabSessionId`

### Files Expected from Story 3a-3 (Response Streaming Display)
- `src/renderer/src/features/sessions/components/StreamingMessage.tsx` - Message with cursor animation
- `src/renderer/src/features/sessions/hooks/useStreamingScroll.ts` - Auto-scroll behavior
- `src/renderer/src/features/sessions/hooks/useStreamEvents.ts` - Stream event subscription
- Preload updates for stream event listeners

### Patterns Established in Previous Stories

**State Management:**
- `useConversationStore.addSystemMessage(sessionId, content)` - For system messages (errors, aborted)
- `useUIStore.updateTabSessionState(tabId, state)` - For state transitions
- State machine: idle -> working -> (error | idle)

**IPC Patterns:**
- `sessions:sendMessage` - Send message to session
- IPC response pattern: `{ success: boolean, error?: string }`

**ChatInput Integration:**
- `disabled` prop controls input state
- `onSend` callback for message submission
- Button state derives from parent sessionState

### Dev Notes from Previous Stories
- Error state preserved until next action (Story 3a-2)
- System messages have distinct role in useConversationStore
- ChatInput has disabled state for working sessions
- ThinkingIndicator shows during working state

## Architecture Relevance

### Applicable Patterns from architecture.md

**Instance State Machine (AR15):**
```
Idle → Working → Idle (normal completion)
Working → Error (on failure)
Working → Idle (on abort)  // This story handles this transition
Error → Idle (on acknowledgment)
```

**Process Termination:**
```typescript
// Main process child handling
// processRegistry: Map<sessionId, ChildProcess>

// On abort request:
// 1. Get child process from registry
// 2. Send SIGTERM (graceful) or SIGKILL (force)
// 3. Remove from registry
// 4. Emit abort event to renderer
// 5. Transition to Idle state
```

**IPC Channel for Abort:**
```typescript
// Request channel: 'sessions:abort'
// Response: { success: boolean, error?: string }

// Event channel: 'sessions:aborted'
// Event: { sessionId: string, reason: 'user' | 'error' }
```

### Constraints for This Story

1. **Process Registry:** Main process tracks active CC processes
2. **Graceful Termination:** Try SIGTERM first, then SIGKILL after timeout
3. **State Consistency:** Ensure renderer state syncs with actual process state
4. **Partial Content:** Handle case where streaming message is incomplete
5. **Story 3b Dependency:** Actual process termination requires Epic 3b infrastructure

### Existing Code to Reuse

1. **useConversationStore.ts** - `addSystemMessage` for abort message
2. **useUIStore.ts** - `updateTabSessionState` for Idle transition
3. **ChatInput.tsx** - Already has disabled prop, can add abort button
4. **useSendMessage.ts** - State transition patterns
5. **ThinkingIndicator.tsx** - Can be replaced with abort button during working state

### File Structure

```
src/renderer/src/features/sessions/
├── components/
│   ├── ChatInput.tsx              # UPDATE - Add abort button during working state
│   ├── ChatInput.test.tsx         # UPDATE - Tests for abort button
│   ├── AbortedMessage.tsx         # NEW - Styled "Aborted" message component
│   └── AbortedMessage.test.tsx    # NEW - Tests
├── hooks/
│   ├── useAbortSession.ts         # NEW - Abort logic hook
│   └── useAbortSession.test.ts    # NEW - Tests
```

```
src/preload/
├── index.ts                       # UPDATE - Add sessions.abort method
└── index.d.ts                     # UPDATE - Type declarations
```

```
src/main/ipc/
└── sessions.ts                    # UPDATE - Add sessions:abort handler
```

```
src/shared/types/
└── ipc.ts                         # UPDATE - Add AbortRequestSchema
```

## Git Context

### Recent Relevant Commits
- `dd2fe8e` - code-review: 3a-2-message-send-flow attempt 2, 5 issues fixed
- `95821a1` - sprint-runner opti, attempt 4
- `89c0cf7` - feat: session scanner and database sync (story 2a-1)

### Files Modified in Stories 3a-1 and 3a-2
- `src/renderer/src/features/sessions/components/ChatInput.tsx`
- `src/renderer/src/features/sessions/hooks/useSendMessage.ts`
- `src/renderer/src/features/sessions/store/useConversationStore.ts`
- `src/renderer/src/core/shell/MiddlePanelContent.tsx`
- `src/renderer/src/shared/store/useUIStore.ts`
- `src/main/ipc/sessions.ts`
- `src/shared/types/ipc.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

## Implementation Notes

### Key Technical Decisions

1. **Abort Button Placement:**
   ```typescript
   // In ChatInput, replace send button with abort during working state
   interface ChatInputProps {
     onSend: (message: string) => void
     onAbort?: () => void  // NEW - abort callback
     disabled?: boolean
     isWorking?: boolean   // NEW - controls button swap
     // ... existing props
   }

   // Button rendering logic:
   // isWorking ? <AbortButton onClick={onAbort} /> : <SendButton onClick={handleSend} />
   ```

2. **Abort Hook:**
   ```typescript
   // useAbortSession.ts
   interface UseAbortSessionResult {
     abort: () => Promise<void>
     isAborting: boolean
   }

   function useAbortSession(sessionId: string | null): UseAbortSessionResult {
     const [isAborting, setIsAborting] = useState(false)

     const abort = useCallback(async () => {
       if (!sessionId) return
       setIsAborting(true)
       try {
         await window.grimoireAPI.sessions.abort({ sessionId })
         // State transition handled by event listener
       } catch (error) {
         console.error('Abort failed:', error)
       } finally {
         setIsAborting(false)
       }
     }, [sessionId])

     return { abort, isAborting }
   }
   ```

3. **IPC Handler:**
   ```typescript
   // Main process - sessions.ts
   ipcMain.handle('sessions:abort', async (_, data: unknown) => {
     const { sessionId } = AbortRequestSchema.parse(data)

     const process = processRegistry.get(sessionId)
     if (!process) {
       return { success: false, error: 'No active process for session' }
     }

     // Graceful termination
     process.kill('SIGTERM')

     // Force kill after timeout if still running
     setTimeout(() => {
       if (!process.killed) {
         process.kill('SIGKILL')
       }
     }, 3000)

     processRegistry.delete(sessionId)
     // Emit abort event to renderer
     mainWindow.webContents.send('sessions:aborted', { sessionId, reason: 'user' })

     return { success: true }
   })
   ```

4. **Aborted Message Styling:**
   ```typescript
   // AbortedMessage.tsx
   interface AbortedMessageProps {
     timestamp: number
   }

   // Styling: muted text, italic, system message appearance
   // Classes: text-[var(--text-muted)] italic text-sm
   // Content: "Request aborted"
   ```

5. **Keyboard Shortcut:**
   ```typescript
   // Add Escape key listener in ConversationView or MiddlePanelContent
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape' && sessionState === 'working') {
         abort()
       }
     }
     window.addEventListener('keydown', handleKeyDown)
     return () => window.removeEventListener('keydown', handleKeyDown)
   }, [sessionState, abort])
   ```

### CSS Variables Reference

```css
--text-primary: Primary text color
--text-muted: Muted text (aborted message)
--bg-elevated: System message background
--error: Red for abort button (visual warning)
--border: Subtle borders
```

### Testing Approach

1. **Unit Tests (ChatInput.test.tsx updates):**
   - Test: shows abort button when isWorking=true
   - Test: shows send button when isWorking=false
   - Test: abort button calls onAbort callback
   - Test: abort button disabled when isAborting=true

2. **Hook Tests (useAbortSession.test.ts):**
   - Test: calls IPC with correct sessionId
   - Test: sets isAborting during abort
   - Test: handles IPC error gracefully
   - Test: does nothing when sessionId is null

3. **Component Tests (AbortedMessage.test.tsx):**
   - Test: renders "Request aborted" text
   - Test: has muted, italic styling
   - Test: shows timestamp

4. **Integration Tests:**
   - Test: Escape key triggers abort during working state
   - Test: abort adds system message to conversation
   - Test: state transitions to idle after abort
   - Test: user can send new message after abort

### Regression Risks

1. **ChatInput button swap** - Ensure send functionality still works
2. **State transitions** - Abort should properly reset to idle
3. **Partial messages** - Handle incomplete streaming message on abort
4. **Multiple aborts** - Prevent double-abort issues

### Dependencies

- **Story 3a-3 (Response Streaming Display):** Provides streaming infrastructure this story interrupts
- **Epic 3b (CC Integration):** Provides actual process registry - this story creates stubs

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.4: Abort and Resume]
- [Source: _bmad-output/planning-artifacts/architecture.md#Instance State Machine]
- [Source: _bmad-output/planning-artifacts/architecture.md#Spawn Child Architecture]

---

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
