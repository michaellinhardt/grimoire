# Discovery File: Story 3a-2 Message Send Flow

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **my messages to be sent and persisted reliably**,
So that **I never lose my input even if something goes wrong**.

### Acceptance Criteria

**AC1: Session UUID generation for new sessions (FR52)**
- Given the user types in a new session (no UUID yet)
- When they send the first message
- Then a Session UUID is generated before CC spawn
- And the session is created in the database with this UUID

**AC2: User message appears immediately (FR49)**
- Given the user sends a message
- When the send action triggers
- Then the user message appears immediately in the conversation
- And the message is persisted to the session
- And the CC child process spawn is initiated

**AC3: Historical session interaction (FR51)**
- Given the user can interact with any session
- When selecting a historical session and typing
- Then the message is sent to resume that session
- And the conversation continues seamlessly

**AC4: Spawn failure handling (FR53)**
- Given the CC spawn fails
- When an error occurs
- Then the user's message is still saved in the session
- And an error message is displayed in the conversation
- And the user can retry by sending another message

**AC5: Waiting state feedback**
- Given a message is sent successfully
- When waiting for response
- Then the thinking indicator appears
- And the send button is disabled until response completes or user aborts

### Technical Requirements
- FR49: Send message to spawn/resume CC child process
- FR51: Interact with any session (historical or new) via chat input
- FR52: Generate Session UUID on first user input (before CC spawn)
- FR53: Save session even if CC spawn fails (preserves user input and errors)

## Previous Story Learnings (from Epic 2c)

### Files Created
- `src/renderer/src/features/sessions/components/utils/timelineUtils.ts` - Utility pattern
- `src/renderer/src/features/sessions/hooks/useTimelineEvents.ts` - Hook for data flow
- `src/renderer/src/features/sessions/hooks/useActiveTimelineEvent.ts` - Hook for DOM sync

### Patterns Used
- **IPC Communication:** Use `window.grimoireAPI.sessions.*` for IPC calls
- **State Management:** Zustand for UI state, stores trigger reloads
- **Error Handling:** Wrap IPC calls in try/catch, update UI state on error
- **Loading States:** Use `isLoading` pattern in stores

### Dev Notes from Epic 2c
- ConversationView has `sessionState` prop for loading indicators (working/idle/error)
- ThinkingIndicator and LoadingIndicator components already exist
- useUIStore has `updateTabSessionState()` for updating tab state

## Architecture Relevance

### Applicable Patterns from architecture.md

**IPC Architecture:**
```typescript
// src/shared/types/ipc.ts - Already defined
export const SpawnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  folderPath: z.string()
})
```

**IPC Channels (defined in architecture):**
- `sessions:sendMessage` - Send message to session (spawn/resume CC)
- `sessions:spawn` - Spawn CC child process
- `sessions:kill` - Terminate running process

**State Machine (3-state):**
```
Idle -> Working -> Idle
         |
       Error
```

**Error Handling Pattern:**
```typescript
// Renderer error handling
async function sendMessage(sessionId: string, message: string) {
  try {
    await window.grimoireAPI.sessions.sendMessage({ sessionId, message })
  } catch (error) {
    console.error('Send failed:', error)
    useUIStore.getState().updateTabSessionState(tabId, 'error')
  }
}
```

### Constraints for This Story

1. **IPC Boundary:** All CC interaction goes through main process via IPC
2. **Optimistic UI:** User message appears immediately before IPC response
3. **Session Persistence:** Session must be created in DB before CC spawn attempt
4. **UUID Generation:** Use `crypto.randomUUID()` for session ID generation
5. **Integration with ChatInput:** ChatInput (Story 3a-1) calls sendMessage handler

### Existing Code to Reuse

1. **IPC Types:** `SpawnRequestSchema`, `SessionSchema` in `src/shared/types/ipc.ts`
2. **useSessionStore:** Session list management and reload
3. **useUIStore:** Tab state management, `updateTabSessionState()`
4. **ConversationView:** Already accepts `sessionState` prop for indicators
5. **ThinkingIndicator/LoadingIndicator:** Components for feedback

### File Structure

```
src/renderer/src/features/sessions/
├── components/
│   ├── ChatInput.tsx           # From Story 3a-1 - calls onSend callback
│   └── ... (existing)
├── hooks/
│   └── useSendMessage.ts       # NEW - Message send logic hook
├── store/
│   └── useConversationStore.ts # NEW or extend - Local message state
```

```
src/preload/
└── index.ts                    # Add sessions.sendMessage to grimoireAPI
```

```
src/main/
└── ipc/
    └── sessions.ts             # Add sendMessage handler (stub for now, Epic 3b implements CC spawn)
```

## Git Context

### Recent Relevant Commits
- `89c0cf7` - feat: session scanner and database sync (story 2a-1)
- `e7c04a2` - story 1 ok, story 2 plan, workflow auto
- `31c93a9` - story 1 code

### Files Modified in Epic 2c (for reference)
- `src/renderer/src/shared/store/useUIStore.ts` - Tab state management
- `src/renderer/src/features/sessions/components/ConversationView.tsx` - Session state handling
- `src/renderer/src/features/sessions/store/useSessionStore.ts` - Session list state

## Implementation Notes

### Key Technical Decisions

1. **Message Send Flow:**
   ```
   User clicks Send
        |
        v
   ChatInput calls onSend(message)
        |
        v
   useSendMessage hook:
     - Generate UUID if new session
     - Add message to local conversation state (optimistic)
     - Update tab state to 'working'
     - Call IPC sessions:sendMessage
        |
        v (IPC)
   Main process:
     - Validate request
     - Create session in DB if new
     - [Epic 3b: Spawn CC child process]
     - Return success/error
        |
        v
   Renderer:
     - On success: wait for response (Epic 3b)
     - On error: show error, keep message saved
   ```

2. **Local Conversation State:** Create `useConversationStore` to track messages optimistically before persisting

3. **Session Creation:** New sessions created in DB on first message send, not on tab open

4. **Tab State Sync:** Use `updateTabSessionState()` to sync session state with tab display

### IPC Handler Stub (for Epic 3a, full implementation in Epic 3b)

```typescript
// Main process handler (stub)
ipcMain.handle('sessions:sendMessage', async (_, req) => {
  const validated = SendMessageRequestSchema.parse(req)

  // Create session in DB if not exists
  const session = await createOrGetSession(validated.sessionId, validated.folderPath)

  // Epic 3b: Actually spawn CC and send message
  // For now, just return success to test flow
  return { success: true, sessionId: session.id }
})
```

### CSS Variables Reference

```css
--text-primary: Primary text color
--text-muted: Muted text (error messages)
--bg-base: Base background
--bg-elevated: Elevated surface
--accent: Purple accent (working indicator)
--error: Red for error states
```

### Testing Approach

1. **Unit Tests:**
   - `useSendMessage.test.ts` - Hook behavior tests
   - Test UUID generation for new sessions
   - Test optimistic message addition
   - Test error handling

2. **Integration Tests:**
   - Test message appears in conversation after send
   - Test session created in store after first send
   - Test tab state updates to 'working'

3. **Mock IPC:**
   ```typescript
   window.grimoireAPI = {
     sessions: {
       sendMessage: vi.fn().mockResolvedValue({ success: true, sessionId: 'test-uuid' })
     }
   }
   ```

### Dependencies

- **Story 3a-1 (Chat Input):** Provides the UI that calls send handler
- **Epic 3b (CC Integration):** Will implement actual CC spawn - this story creates the stub

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.2: Message Send Flow]
- [Source: _bmad-output/planning-artifacts/architecture.md#IPC Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Spawn Child Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#State Architecture]

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
