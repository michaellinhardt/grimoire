# Discovery File: Story 4-1 Loading Screen and Startup Verification

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **Grimoire to start reliably with clear feedback**,
So that **I know the app is loading and any issues are clearly communicated**.

### Acceptance Criteria

**AC1: Loading screen display (FR8)**
- Given the user launches Grimoire
- When the app starts
- Then a loading screen appears with the Grimoire logo
- And startup progress is indicated (subtle animation)

**AC2: Claude Code installation verification (FR9)**
- Given the app is starting
- When verifying Claude Code installation
- Then the system checks if `claude` command is available
- And if not found, an error modal appears with installation instructions

**AC3: CLAUDE_CONFIG_DIR verification (FR10, FR11)**
- Given the app is starting
- When verifying CLAUDE_CONFIG_DIR configuration
- Then the system checks if the directory exists and is writable
- And if setup fails, a modal error appears with quit/retry options

**AC4: Authentication verification (FR12)**
- Given the app is starting
- When verifying authentication
- Then the system checks if CC credentials are valid
- And if auth fails, a modal appears with instructions to authenticate

**AC5: Startup completion (NFR1)**
- Given all verifications pass
- When startup completes
- Then the loading screen transitions to the main UI
- And total startup time is < 3 seconds

### Technical Requirements
- FR8: System displays loading screen with app logo during startup
- FR9: System verifies Claude Code installation on startup
- FR10: System verifies CLAUDE_CONFIG_DIR environment configuration on startup
- FR11: System displays modal error with quit/retry if config directory setup fails
- FR12: System verifies authentication credentials on startup
- NFR1: App startup < 3 seconds
- AR1: Use electron-vite with react-ts template as starter (already done)

## Previous Story Learnings (from Epic 3b)

### Files Created in Epic 3b (CC Integration)
- `src/main/sessions/cc-spawner.ts` - CC child process spawning with CLAUDE_CONFIG_DIR
- `src/main/sessions/instance-state-manager.ts` - 3-state machine (idle/working/error)
- `src/main/sessions/stream-parser.ts` - NDJSON parsing and `emitToRenderer` pattern
- `src/main/process-registry.ts` - Process tracking registry
- `src/main/index.ts` - Graceful shutdown handler in before-quit

### Patterns Established in Previous Stories

**Main Process Startup (from src/main/index.ts):**
```typescript
// Current startup flow
app.whenReady().then(() => {
  initDatabase()
  registerSessionsIPC()
  registerDialogIPC()
  registerShellIPC()
  electronApp.setAppUserModelId('com.grimoire')
  // ... window creation
})
```

**CC Executable Detection (from cc-spawner.ts):**
```typescript
// Can reuse for verification
function findClaudeExecutable(): string {
  if (process.platform === 'win32') {
    return 'claude'
  }
  return 'claude'
}
```

**CLAUDE_CONFIG_DIR Path (from cc-spawner.ts):**
```typescript
const env = {
  CLAUDE_CONFIG_DIR: join(app.getPath('userData'), '.claude')
}
```

**emitToRenderer pattern (from stream-parser.ts):**
```typescript
import { BrowserWindow } from 'electron'
export function emitToRenderer(channel: string, payload: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach((w) => w.webContents.send(channel, payload))
}
```

### Dev Notes from Previous Stories
- Error modal pattern: Use Radix UI Dialog with overlay
- Process spawning uses `spawn()` from child_process
- Check `err.code === 'ENOENT'` for missing executable
- CLAUDE_CONFIG_DIR is at `app.getPath('userData')/.claude`
- Debug logging via environment variables (e.g., DEBUG_PROCESS_LIFECYCLE)

## Architecture Relevance

### Applicable Patterns from architecture.md

**Loading Screen Component (per architecture):**
```
src/renderer/src/core/loading/
  LoadingScreen.tsx     - Loading UI
  useAppInit.ts         - CC verification, auth check
```

**Startup Verification Flow:**
1. Show loading screen immediately
2. Initialize database (already in main/index.ts)
3. Verify CC installation (check if `claude` command exists)
4. Verify CLAUDE_CONFIG_DIR directory
5. Verify authentication (optional - defer if complex)
6. Transition to main UI

**IPC Channels (following namespace:action pattern):**
```typescript
// New IPC channels needed
'app:verifyClaude'    -> { installed: boolean, version?: string, error?: string }
'app:verifyConfigDir' -> { valid: boolean, path: string, error?: string }
'app:verifyAuth'      -> { authenticated: boolean, error?: string }
```

**Error Modal Pattern:**
```typescript
// Radix UI Dialog with:
// - Title: Error type
// - Message: What went wrong + how to fix
// - Actions: Quit / Retry (if retryable)
```

### Constraints for This Story

1. **Startup Performance:** Must complete < 3 seconds (NFR1)
2. **Blocking Operations:** Verification must complete before showing main UI
3. **Error Recovery:** Some errors are retryable (config dir), some are not (CC not installed)
4. **Platform Differences:** `claude` command may differ on Windows (.cmd extension)
5. **No Auth API:** CC doesn't expose an auth check API - may need to defer auth verification

### Existing Code to Reuse

1. **src/main/index.ts** - Main process startup (enhance, don't replace)
2. **src/main/sessions/cc-spawner.ts** - CLAUDE_CONFIG_DIR path logic
3. **src/renderer/src/core/shell/Shell.tsx** - Main shell (loading screen wraps this)
4. **src/shared/store/useUIStore.ts** - Potential for app state tracking

### File Structure

```
src/renderer/src/core/loading/
├── LoadingScreen.tsx          # NEW - Loading UI with logo and animation
├── LoadingScreen.test.tsx     # NEW - Tests
├── VerificationErrorModal.tsx # NEW - Error modal for verification failures
├── VerificationErrorModal.test.tsx # NEW - Tests
├── useStartupVerification.ts  # NEW - Hook for verification flow
└── useStartupVerification.test.ts # NEW - Tests
```

```
src/main/
├── index.ts                   # UPDATE - Add verification before window show
├── verification.ts            # NEW - CC and config verification logic
└── verification.test.ts       # NEW - Tests
```

```
src/main/ipc/
├── index.ts                   # UPDATE - Export verification IPC
└── app.ts                     # NEW - App verification IPC handlers
```

```
src/shared/types/
└── ipc.ts                     # UPDATE - Add verification schemas
```

```
src/preload/
└── index.ts                   # UPDATE - Add verification methods
```

## Git Context

### Recent Relevant Commits
- `cf50e77` - reset sprint-runner.csv
- `4d6016a` - feat(3b): implement stories 3b-3,3b-4
- `d26dc41` - feat(3b): implement stories 3b-1,3b-2

### Files Modified in Epic 3b
- `src/main/index.ts` - Graceful shutdown handler
- `src/main/sessions/cc-spawner.ts` - CC spawning logic
- `src/main/sessions/stream-parser.ts` - emitToRenderer pattern
- `src/main/process-registry.ts` - Process tracking
- `src/preload/index.ts` - IPC methods

## Implementation Notes

### Key Technical Decisions

1. **Loading Screen Placement:**
   ```typescript
   // App.tsx should conditionally render LoadingScreen or Shell
   function App(): ReactElement {
     const { isStartupComplete } = useStartupVerification()

     if (!isStartupComplete) {
       return <LoadingScreen />
     }

     return (
       <Tooltip.Provider delayDuration={300}>
         <Shell />
       </Tooltip.Provider>
     )
   }
   ```

2. **CC Installation Check:**
   ```typescript
   // Main process - verification.ts
   import { spawn } from 'child_process'

   export async function verifyClaude(): Promise<{ installed: boolean; version?: string; error?: string }> {
     return new Promise((resolve) => {
       const child = spawn('claude', ['--version'], { shell: true })
       let output = ''

       child.stdout?.on('data', (data) => { output += data.toString() })

       child.on('error', (err) => {
         resolve({ installed: false, error: err.message })
       })

       child.on('exit', (code) => {
         if (code === 0) {
           resolve({ installed: true, version: output.trim() })
         } else {
           resolve({ installed: false, error: 'Claude Code not found in PATH' })
         }
       })
     })
   }
   ```

3. **Config Directory Check:**
   ```typescript
   // Main process - verification.ts
   import { existsSync, mkdirSync, accessSync, constants } from 'fs'
   import { app } from 'electron'
   import { join } from 'path'

   export function verifyConfigDir(): { valid: boolean; path: string; error?: string } {
     const configDir = join(app.getPath('userData'), '.claude')

     try {
       if (!existsSync(configDir)) {
         mkdirSync(configDir, { recursive: true })
       }
       accessSync(configDir, constants.W_OK | constants.R_OK)
       return { valid: true, path: configDir }
     } catch (err) {
       return { valid: false, path: configDir, error: (err as Error).message }
     }
   }
   ```

4. **Authentication Check (Recommended: Defer):**
   ```typescript
   // FR12 may need to be deferred or simplified
   // CC doesn't expose a direct auth check API
   // Options:
   // a) Skip auth check for MVP (show error when spawn fails)
   // b) Run `claude --help` and parse output for auth hints
   // c) Check for auth files in CLAUDE_CONFIG_DIR
   // RECOMMENDATION: Defer to later or use lightweight check
   ```

5. **Startup Verification Hook:**
   ```typescript
   // useStartupVerification.ts
   interface StartupState {
     step: 'initializing' | 'verifying-claude' | 'verifying-config' | 'complete' | 'error'
     error?: { type: 'claude' | 'config' | 'auth'; message: string; retryable: boolean }
     isComplete: boolean
   }

   export function useStartupVerification(): StartupState & { retry: () => void } {
     const [state, setState] = useState<StartupState>({ step: 'initializing', isComplete: false })

     useEffect(() => {
       runVerification()
     }, [])

     async function runVerification() {
       // Step 1: Verify Claude
       setState({ step: 'verifying-claude', isComplete: false })
       const claudeResult = await window.grimoireAPI.app.verifyClaude()
       if (!claudeResult.installed) {
         setState({
           step: 'error',
           error: { type: 'claude', message: claudeResult.error!, retryable: false },
           isComplete: false
         })
         return
       }

       // Step 2: Verify Config Dir
       setState({ step: 'verifying-config', isComplete: false })
       const configResult = await window.grimoireAPI.app.verifyConfigDir()
       if (!configResult.valid) {
         setState({
           step: 'error',
           error: { type: 'config', message: configResult.error!, retryable: true },
           isComplete: false
         })
         return
       }

       // Complete
       setState({ step: 'complete', isComplete: true })
     }

     const retry = () => runVerification()

     return { ...state, retry }
   }
   ```

### CSS Variables Reference

```css
--bg-base: Base background color (loading screen background)
--text-primary: Primary text color
--text-muted: Muted text (loading status)
--accent: Accent color (loading spinner)
--error: Red for error states
```

### Testing Approach

1. **Unit Tests (LoadingScreen.test.tsx):**
   - Test: renders logo and animation
   - Test: shows loading status text
   - Test: accessibility (proper ARIA labels)

2. **Unit Tests (VerificationErrorModal.test.tsx):**
   - Test: renders error message
   - Test: shows retry button for retryable errors
   - Test: shows quit button for non-retryable errors
   - Test: calls onRetry callback
   - Test: calls onQuit callback

3. **Hook Tests (useStartupVerification.test.ts):**
   - Test: transitions through verification steps
   - Test: stops on first error
   - Test: retry resets and restarts verification
   - Test: completes when all checks pass

4. **Main Process Tests (verification.test.ts):**
   - Test: verifyClaude detects missing claude command
   - Test: verifyClaude returns version on success
   - Test: verifyConfigDir creates directory if missing
   - Test: verifyConfigDir handles permission errors

### Regression Risks

1. **App Startup** - Must not break existing startup flow
2. **Performance** - Verification must not add significant delay
3. **Window Display** - Window should show loading screen immediately
4. **Error Recovery** - Retry should work correctly

### Dependencies

- No blocking dependencies from other Epic 4 stories
- Builds on Epic 3b infrastructure (cc-spawner.ts patterns)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Loading Screen and Startup Verification]
- [Source: _bmad-output/planning-artifacts/architecture.md#App Startup Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Isolation Architecture]

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
