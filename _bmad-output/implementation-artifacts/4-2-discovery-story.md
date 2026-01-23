# Discovery File: Story 4-2 Offline Mode and Status Indication

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **to use Grimoire offline for browsing history**,
So that **I can review past sessions even without internet**.

### Acceptance Criteria

**AC1: Read-only operations work offline (FR13)**
- Given the network is unavailable
- When the user opens Grimoire
- Then session browsing works normally (list, open, scroll)
- And conversation history is fully readable
- And file edits panel shows historical data

**AC2: Network status indication (FR14)**
- Given the network status changes
- When the user is online or offline
- Then a clear status indicator appears in the UI
- And the indicator updates in near real-time

**AC3: Send message blocked offline (FR13)**
- Given the user is offline
- When they attempt to send a message
- Then an appropriate error is shown
- And the message is NOT sent to CC
- And the input is disabled or shows offline state

**AC4: Online/offline transitions (FR14)**
- Given the network status changes
- When transitioning between online and offline states
- Then the UI updates accordingly
- And any blocked operations become available when online again

### Technical Requirements
- FR13: Detect network unavailability using Electron APIs
- FR13: Read-only operations work offline (browse sessions, view conversations, see file edits)
- FR13: Attempting to send messages while offline shows appropriate error
- FR14: System indicates network status changes in UI (online/offline icon)

## Previous Story Learnings (from Epic 3b and Story 4-1)

### Files Created/Modified in Epic 3b (CC Integration)
- `src/main/sessions/cc-spawner.ts` - CC child process spawning with error handling
- `src/main/sessions/stream-parser.ts` - NDJSON parsing and `emitToRenderer` pattern
- `src/main/sessions/instance-state-manager.ts` - 3-state machine (idle/working/error)
- `src/preload/index.ts` - IPC methods for sessions

### From Story 4-1 (Loading Screen and Startup Verification)
- **Expected files:**
  - `src/main/verification.ts`
  - `src/main/ipc/app.ts`
  - `src/renderer/src/core/loading/LoadingScreen.tsx`
  - `src/renderer/src/core/loading/useStartupVerification.ts`
- **Patterns used:**
  - IPC event emission via `emitToRenderer()`
  - Hook-based state management for transient UI state
  - Modal error display patterns
- **Dev notes:** Network monitoring is complementary to startup verification

### From Epic 3a (Chat Input)
- **Files:** `src/renderer/src/features/sessions/components/ChatInput.tsx`
- **Patterns used:**
  - Disabled button states based on session state
  - Tooltip for explaining disabled state
  - `useConversationStore` for message sending
- **Dev notes:** Add offline check to existing disabled conditions

### Patterns Established in Previous Stories

**emitToRenderer pattern (from stream-parser.ts):**
```typescript
import { BrowserWindow } from 'electron'
export function emitToRenderer(channel: string, payload: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach((w) => w.webContents.send(channel, payload))
}
```

**ChatInput disabled states pattern:**
```typescript
// Already disables when isWorking or isStreaming
// Add !isOnline to disabled condition
disabled={isWorking || isStreaming || !isOnline}
```

**stream:end error pattern:**
```typescript
emitToRenderer('stream:end', {
  sessionId,
  success: false,
  error: 'Error message here'
})
```

### Dev Notes from Previous Stories
- `hasActiveProcess(sessionId)` for concurrent request guard (Story 3b-4)
- Error state machine transitions (Story 3b-3)
- IPC handlers in `src/main/ipc/sessions.ts` pattern

## Architecture Relevance

### Applicable Patterns from architecture.md

**IPC Channels (following namespace:action pattern):**
```typescript
// New IPC channels needed
'network:getStatus'     -> { online: boolean }
'network:statusChanged' -> { online: boolean } // Event (main -> renderer)
```

**State Management Options:**
```typescript
// Option 1: Add to useUIStore
interface UIState {
  isOnline: boolean
  setIsOnline: (online: boolean) => void
}

// Option 2: Dedicated hook (simpler, recommended)
// useNetworkStatus.ts
```

**Project Structure:**
```
src/main/
├── network-monitor.ts      # NEW - Network status polling
└── ipc/
    └── network.ts          # NEW - Network IPC handlers

src/renderer/src/shared/
├── hooks/
│   └── useNetworkStatus.ts # NEW - Network status hook
└── components/
    └── NetworkIndicator.tsx # NEW - Status indicator component
```

### Constraints for This Story

1. **Electron API:** Use `net.isOnline()` from `electron` (available in Electron 12+)
2. **Polling Interval:** 5 seconds is typical balance between responsiveness and overhead
3. **SQLite Works Offline:** Database operations are local, no network needed
4. **Only CC Needs Network:** Message sending is the only network-dependent operation
5. **No Auth Token Refresh:** CC handles its own auth - we just check network layer

### Existing Code to Reuse

1. **src/main/sessions/stream-parser.ts** - `emitToRenderer` function
2. **src/renderer/src/features/sessions/components/ChatInput.tsx** - Disabled state pattern
3. **src/renderer/src/shared/store/useUIStore.ts** - Zustand store pattern
4. **src/preload/index.ts** - IPC method patterns

### File Structure

```
src/main/
├── network-monitor.ts     # NEW - Network status polling and events
└── network-monitor.test.ts # NEW - Tests
```

```
src/main/ipc/
├── index.ts               # UPDATE - Export network IPC
└── network.ts             # NEW - Network status IPC handlers
```

```
src/shared/types/
└── ipc.ts                 # UPDATE - Add network schemas
```

```
src/preload/
└── index.ts               # UPDATE - Add network methods
```

```
src/renderer/src/shared/
├── hooks/
│   ├── useNetworkStatus.ts      # NEW - Network status hook
│   └── useNetworkStatus.test.ts # NEW - Tests
└── components/
    ├── NetworkIndicator.tsx      # NEW - Status indicator component
    └── NetworkIndicator.test.tsx # NEW - Tests
```

```
src/renderer/src/features/sessions/components/
└── ChatInput.tsx          # UPDATE - Add offline check to disabled
```

## Git Context

### Recent Relevant Commits
- `cf50e77` - reset sprint-runner.csv
- `4d6016a` - feat(3b): implement stories 3b-3,3b-4
- `d26dc41` - feat(3b): implement stories 3b-1,3b-2

### Files Modified in Epic 3b
- `src/main/sessions/cc-spawner.ts` - CC spawning logic
- `src/main/sessions/stream-parser.ts` - emitToRenderer pattern
- `src/renderer/src/features/sessions/components/ChatInput.tsx` - Send button states
- `src/preload/index.ts` - IPC methods

## Implementation Notes

### Key Technical Decisions

1. **Network Monitor (Main Process):**
   ```typescript
   // src/main/network-monitor.ts
   import { net } from 'electron'
   import { emitToRenderer } from './sessions/stream-parser'

   let lastStatus: boolean | null = null
   const POLL_INTERVAL = 5000 // 5 seconds

   export function startNetworkMonitor(): void {
     // Initial check
     checkAndEmit()

     // Poll periodically
     setInterval(checkAndEmit, POLL_INTERVAL)
   }

   function checkAndEmit(): void {
     const online = net.isOnline()
     if (lastStatus !== online) {
       lastStatus = online
       emitToRenderer('network:statusChanged', { online })
     }
   }

   export function getNetworkStatus(): { online: boolean } {
     return { online: net.isOnline() }
   }
   ```

2. **Network IPC Handler:**
   ```typescript
   // src/main/ipc/network.ts
   import { ipcMain } from 'electron'
   import { getNetworkStatus } from '../network-monitor'

   export function registerNetworkIPC(): void {
     ipcMain.handle('network:getStatus', () => {
       return getNetworkStatus()
     })
   }
   ```

3. **Preload Exposure:**
   ```typescript
   // Add to grimoireAPI in src/preload/index.ts
   network: {
     getStatus: (): Promise<{ online: boolean }> =>
       ipcRenderer.invoke('network:getStatus'),
     onStatusChanged: (callback: (data: { online: boolean }) => void): (() => void) => {
       const handler = (_event: Electron.IpcRendererEvent, data: { online: boolean }): void =>
         callback(data)
       ipcRenderer.on('network:statusChanged', handler)
       return () => ipcRenderer.removeListener('network:statusChanged', handler)
     }
   }
   ```

4. **Network Status Hook:**
   ```typescript
   // src/renderer/src/shared/hooks/useNetworkStatus.ts
   import { useState, useEffect } from 'react'

   export function useNetworkStatus(): { isOnline: boolean } {
     const [isOnline, setIsOnline] = useState(true) // Optimistic default

     useEffect(() => {
       // Get initial status
       window.grimoireAPI.network.getStatus().then(({ online }) => {
         setIsOnline(online)
       })

       // Subscribe to changes
       const cleanup = window.grimoireAPI.network.onStatusChanged(({ online }) => {
         setIsOnline(online)
       })

       return cleanup
     }, [])

     return { isOnline }
   }
   ```

5. **Network Indicator Component:**
   ```typescript
   // src/renderer/src/shared/components/NetworkIndicator.tsx
   import type { ReactElement } from 'react'
   import { WifiOff, Wifi } from 'lucide-react'
   import * as Tooltip from '@radix-ui/react-tooltip'
   import { useNetworkStatus } from '../hooks/useNetworkStatus'
   import { cn } from '@renderer/shared/utils/cn'

   export function NetworkIndicator(): ReactElement {
     const { isOnline } = useNetworkStatus()

     if (isOnline) {
       return null // Or subtle online indicator
     }

     return (
       <Tooltip.Root>
         <Tooltip.Trigger asChild>
           <div className={cn(
             'flex items-center gap-1 px-2 py-1 rounded',
             'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
           )}>
             <WifiOff size={14} className="text-[var(--error)]" />
             <span className="text-xs">Offline</span>
           </div>
         </Tooltip.Trigger>
         <Tooltip.Portal>
           <Tooltip.Content
             className="bg-[var(--bg-elevated)] text-[var(--text-primary)] px-3 py-2 rounded text-sm shadow-lg"
             sideOffset={5}
           >
             Network unavailable. Browsing history works, but sending messages is disabled.
             <Tooltip.Arrow className="fill-[var(--bg-elevated)]" />
           </Tooltip.Content>
         </Tooltip.Portal>
       </Tooltip.Root>
     )
   }
   ```

6. **ChatInput Offline Integration:**
   ```typescript
   // Update ChatInput.tsx
   import { useNetworkStatus } from '@renderer/shared/hooks/useNetworkStatus'

   export function ChatInput({ ... }): ReactElement {
     const { isOnline } = useNetworkStatus()

     // Add to disabled condition
     const isDisabled = disabled || isWorking || !isOnline

     // Add tooltip for offline state
     const getDisabledReason = () => {
       if (!isOnline) return 'Network unavailable'
       if (isWorking) return 'Processing...'
       return undefined
     }

     // ...
   }
   ```

7. **Spawn Guard for Offline:**
   ```typescript
   // In src/main/ipc/sessions.ts - sessions:sendMessage handler
   import { getNetworkStatus } from '../network-monitor'

   // Add check before spawn
   if (!getNetworkStatus().online) {
     return {
       success: false,
       error: 'Cannot send message while offline. Please check your network connection.'
     }
   }
   ```

### CSS Variables Reference

```css
--bg-elevated: Elevated background (indicator background)
--text-primary: Primary text color
--text-muted: Muted text (offline label)
--error: Red for offline indicator
--warning: Yellow/orange for warning states
```

### Testing Approach

1. **Unit Tests (network-monitor.test.ts):**
   - Test: returns current online status
   - Test: emits event on status change
   - Test: does not emit on same status

2. **Hook Tests (useNetworkStatus.test.ts):**
   - Test: initial state is optimistic (true)
   - Test: updates when status changes
   - Test: cleans up on unmount

3. **Component Tests (NetworkIndicator.test.tsx):**
   - Test: shows nothing when online
   - Test: shows offline indicator when offline
   - Test: tooltip explains offline state

4. **Integration Tests:**
   - Test: sendMessage blocked when offline
   - Test: ChatInput disabled when offline
   - Test: status changes update UI

### Regression Risks

1. **ChatInput behavior** - Must not break existing disabled states
2. **IPC registration** - Must register network IPC alongside existing handlers
3. **Startup timing** - Network monitor should start after app ready
4. **Memory leaks** - Ensure cleanup of event listeners

### Dependencies

- Story 4-1 (Loading Screen) - Sets up startup infrastructure
- Epic 3a/3b (Chat Input, CC Integration) - Provides base components to modify

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Offline Mode and Status Indication]
- [Source: Electron net module documentation](https://www.electronjs.org/docs/latest/api/net)

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
