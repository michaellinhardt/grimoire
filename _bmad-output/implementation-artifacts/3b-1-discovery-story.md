# Discovery File: Story 3b-1 CC Child Process Spawning

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **Grimoire to spawn Claude Code processes correctly**,
So that **my sessions work seamlessly with proper isolation and continuity**.

### Acceptance Criteria

**AC1: CLAUDE_CONFIG_DIR isolation (FR61)**
- Given the user sends a message to a session
- When CC needs to be spawned
- Then the child process is created with CLAUDE_CONFIG_DIR environment variable set
- And CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1 is set for rewind support
- And this provides isolation from other CC instances

**AC2: Session ID resume (FR62, FR66)**
- Given a session has an existing ID
- When spawning CC for that session
- Then the --resume argument is passed with the session UUID
- And CC resumes the existing conversation

**AC3: Message delivery via stdin (FR63)**
- Given the user sends a message
- When CC is spawned
- Then the spawn uses `-p --input-format stream-json --output-format stream-json --verbose --replay-user-messages --dangerously-skip-permissions`
- And the user message is sent via stdin as JSON (not CLI argument)
- And stdin is closed after sending the message

**AC4: Session ID tracking (FR56, FR65, FR67c)**
- Given CC is spawned
- When the process starts
- Then the session ID is captured from the stream init message
- And the session ID is mapped to the child process in the registry
- And the mapping enables tracking which process belongs to which session

### Technical Requirements
- FR55: System spawns new child process when user sends message (request-response model)
- FR56: System maintains session ID mapping to child processes
- FR61: System spawns CC child processes with CLAUDE_CONFIG_DIR environment variable for isolation
- FR62: System spawns CC with session ID argument for session continuity
- FR63: System passes user input to CC child process as terminal input
- FR65: System tracks session ID for each spawned CC instance
- FR66: System supports resuming any existing session by ID
- FR67: System displays actionable error in conversation when CC fails to spawn
- FR67c: System captures session ID from stream init message (not from file system)
- AR15: 3-state instance machine: Idle -> Working -> Idle (or Idle -> Working -> Error -> Idle)
- AR19: NDJSON stream-json protocol via CC CLI with --include-partial-messages (now --verbose)

## Previous Story Learnings (from Epic 3a)

### Files Created in Story 3a-4 (Abort and Resume)
- `src/renderer/src/features/sessions/hooks/useAbortSession.ts` - Abort logic hook
- `src/renderer/src/features/sessions/hooks/useAbortSession.test.ts` - Tests for abort
- `src/renderer/src/features/sessions/store/useConversationStore.ts` - Extended with addAbortedMessage action

### Files Modified in Epic 3a
- `src/renderer/src/features/sessions/components/ChatInput.tsx` - Includes abort button during working state
- `src/renderer/src/features/sessions/hooks/useSendMessage.ts` - Message send logic
- `src/renderer/src/features/sessions/hooks/useStreamEvents.ts` - Stream event subscription
- `src/main/ipc/sessions.ts` - IPC handlers including sessions:sendMessage, sessions:abort
- `src/shared/types/ipc.ts` - Schemas including SendMessageSchema, AbortRequestSchema
- `src/preload/index.ts` - API surface including streaming event listeners
- `src/main/process-registry.ts` - Placeholder for child process registry

### Patterns Established in Epic 3a

**IPC Streaming Events:**
```typescript
// Main -> Renderer events via preload
'stream:chunk'  // { sessionId, type: 'text', content, uuid? }
'stream:tool'   // { sessionId, type: 'tool_use' | 'tool_result', toolUse?, toolResult? }
'stream:end'    // { sessionId, success, error?, aborted?, totalTokens?, costUsd? }
```

**State Management:**
- `useConversationStore` - Manages local messages during streaming
- `useUIStore` - Manages tab session state (idle/working/error)
- State transitions: idle -> working -> (error | idle)

**Process Registry:**
```typescript
// src/main/process-registry.ts
export const processRegistry = new Map<string, ChildProcess>()
// Already referenced in sessions:abort and sessions:terminate handlers
```

### Dev Notes from Epic 3a
- sessions:sendMessage currently creates DB entry but does NOT spawn CC (placeholder for 3b-1)
- Stream event listeners are wired up in preload/index.ts
- useStreamEvents.ts subscribes to stream events and updates useConversationStore
- ChatInput toggles between send/abort button based on sessionState
- ThinkingIndicator shows during working state

## Architecture Relevance

### Applicable Patterns from architecture.md

**CC Spawn Command:**
```bash
CLAUDE_CONFIG_DIR=/path/to/grimoire/.claude \
CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1 \
claude -p \
  --input-format stream-json \
  --output-format stream-json \
  --verbose \
  --replay-user-messages \
  --dangerously-skip-permissions \
  --resume <session-id>
```

**Message Sent via stdin:**
```json
{ "type": "user", "message": { "role": "user", "content": "user message here" } }
```

**Data Locations (CLAUDE_CONFIG_DIR):**
| Platform | Path                                              |
| -------- | ------------------------------------------------- |
| macOS    | `~/Library/Application Support/Grimoire/.claude/` |
| Windows  | `%APPDATA%/Grimoire/.claude/`                     |
| Linux    | `~/.local/share/grimoire/.claude/`                |

**Error Handling Categories (AR18):**
| Error Type             | Handling                                    |
| ---------------------- | ------------------------------------------- |
| Spawn failure (ENOENT) | Show immediately, CC not installed          |
| Non-zero exit code     | Show error in chat, session returns to Idle |

### Constraints for This Story

1. **Electron Main Process:** Child spawning must happen in main process, not renderer
2. **Environment Isolation:** Each CC process gets its own CLAUDE_CONFIG_DIR via env var
3. **Process Registry:** Track all active processes for cleanup on app quit
4. **Single Process Per Session:** Only one active process allowed per session at a time
5. **Graceful Shutdown:** SIGTERM first, then SIGKILL after timeout

### Existing Code to Reuse/Extend

1. **processRegistry** (`src/main/process-registry.ts`) - Already exists, needs population
2. **sessions:sendMessage** (`src/main/ipc/sessions.ts`) - Extend to spawn CC process
3. **sessions:abort** (`src/main/ipc/sessions.ts`) - Already implemented, uses processRegistry
4. **Stream event channels** (`src/preload/index.ts`) - Already wired for chunk/tool/end

### File Structure

```
src/main/
├── process-registry.ts         # EXISTS - Map<sessionId, ChildProcess>
├── cc/                         # NEW - CC integration module
│   ├── spawner.ts              # NEW - CC process spawning logic
│   ├── spawner.test.ts         # NEW - Tests
│   └── types.ts                # NEW - CC-specific types
├── ipc/
│   └── sessions.ts             # UPDATE - Integrate spawner into sendMessage
```

## Git Context

### Recent Relevant Commits
- `b495f22` - fix sprint-runner
- `c6349fc` - stories
- `62f559d` - code-review: Update story 3a-3 status to done after finding and fixing HIGH severity issue
- `cb2735c` - Fix HIGH severity: Tool result data loss from out-of-order streaming events
- `dd2fe8e` - code-review: 3a-2-message-send-flow attempt 2, 5 issues fixed

### Files Modified in Epic 3a (Reference)
- `src/main/ipc/sessions.ts` - Contains sendMessage placeholder
- `src/main/process-registry.ts` - Empty registry, awaiting population
- `src/preload/index.ts` - Stream event listeners already wired
- `src/shared/types/ipc.ts` - All schemas defined

## Implementation Notes

### Key Technical Decisions

1. **Spawn Module Design:**
   ```typescript
   // src/main/cc/spawner.ts
   import { spawn, type ChildProcess } from 'child_process'
   import { app } from 'electron'
   import { join } from 'path'
   import { processRegistry } from '../process-registry'

   interface SpawnOptions {
     sessionId: string
     message: string
     folderPath: string
     isResume: boolean  // true if existing session
   }

   interface SpawnResult {
     success: boolean
     error?: string
   }

   export async function spawnCCProcess(options: SpawnOptions): Promise<SpawnResult> {
     const { sessionId, message, folderPath, isResume } = options

     // Build CLAUDE_CONFIG_DIR path
     const claudeConfigDir = join(app.getPath('userData'), '.claude')

     // Build spawn arguments
     const args = [
       '-p',
       '--input-format', 'stream-json',
       '--output-format', 'stream-json',
       '--verbose',
       '--replay-user-messages',
       '--dangerously-skip-permissions'
     ]

     if (isResume) {
       args.push('--resume', sessionId)
     }

     // Spawn process with isolated environment
     const child = spawn('claude', args, {
       cwd: folderPath,
       env: {
         ...process.env,
         CLAUDE_CONFIG_DIR: claudeConfigDir,
         CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1'
       },
       stdio: ['pipe', 'pipe', 'pipe']
     })

     // Register process
     processRegistry.set(sessionId, child)

     // Send message via stdin
     const stdinMessage = JSON.stringify({
       type: 'user',
       message: { role: 'user', content: message }
     })
     child.stdin?.write(stdinMessage)
     child.stdin?.end()

     // Handle errors
     child.on('error', (err) => {
       // Handle spawn errors (e.g., ENOENT if claude not installed)
       processRegistry.delete(sessionId)
       // Emit error event to renderer
     })

     child.on('exit', (code) => {
       processRegistry.delete(sessionId)
       // Emit end event to renderer
     })

     return { success: true }
   }
   ```

2. **Integration with sendMessage:**
   ```typescript
   // In sessions:sendMessage handler
   // After creating/updating DB entry:
   const result = await spawnCCProcess({
     sessionId,
     message,
     folderPath,
     isResume: !isNewSession
   })
   ```

3. **Error Event Emission:**
   ```typescript
   // When spawn fails
   mainWindow?.webContents.send('stream:end', {
     sessionId,
     success: false,
     error: 'Failed to spawn Claude Code: command not found'
   })
   ```

4. **Process Cleanup on App Quit:**
   ```typescript
   // In src/main/index.ts - already has before-quit handler
   // Ensure it kills all processes in processRegistry
   ```

### Testing Approach

1. **Unit Tests (spawner.test.ts):**
   - Test: builds correct spawn arguments for new session
   - Test: builds correct spawn arguments for resume session
   - Test: sets CLAUDE_CONFIG_DIR correctly
   - Test: sets CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING
   - Test: writes message to stdin in correct format
   - Test: registers process in processRegistry
   - Test: removes process from registry on exit
   - Test: handles ENOENT error (claude not found)

2. **Integration Tests:**
   - Test: sendMessage triggers spawn for new session
   - Test: sendMessage triggers spawn with --resume for existing session
   - Test: error event emitted when spawn fails
   - Test: process registry contains spawned process

### Dependencies

- **Story 3b-2 (NDJSON Stream Parser):** This story spawns the process but parsing is in 3b-2
- **Epic 3a:** Provides the IPC infrastructure and streaming event system

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3b.1: CC Child Process Spawning]
- [Source: _bmad-output/planning-artifacts/architecture.md#CC Communication]
- [Source: _bmad-output/planning-artifacts/architecture.md#Spawn Child Architecture]

---

# Project Context

See `_bmad-output/planning-artifacts/project-context.md` for technology stack, coding rules, and patterns.

Key points relevant to this story:
- Main process handles all child process spawning (never renderer)
- Use `spawn` from Node.js `child_process` module
- Environment isolation via CLAUDE_CONFIG_DIR env var
- Process registry for cleanup on app quit
- Electron app data path: `app.getPath('userData')`

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
