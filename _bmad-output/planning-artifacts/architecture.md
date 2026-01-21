---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-01-21'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-grimoire-2026-01-09.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
workflowType: 'architecture'
project_name: 'grimoire'
user_name: 'Teazyou'
date: '2026-01-15'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

67 functional requirements organized into 8 categories:
- **Application Shell (FR1-7):** Multi-panel Obsidian-inspired layout with ribbon navigation, collapsible panels, resizable dividers, and tab system for multiple open sessions
- **Application Lifecycle (FR8-19):** Loading screen with CC verification, HOME/auth checks, offline support, auto-updates, state persistence
- **Plugin System (FR20-24):** Enable/disable plugins, per-plugin settings, core plugins use same architecture as future community plugins
- **Session Management (FR25-32):** Session list from `CLAUDE_CONFIG_DIR` folder, metadata display, archive functionality, active child process indicators (6-state system)
- **Conversation Display (FR33-42):** Message bubbles, tool call cards, sub-agent expansion, error indicators, navigation map, streaming indicators
- **Session Information (FR43-46):** Token usage display, per-message consumption, full metadata exposure
- **Session Interaction (FR47-60):** Chat input, real-time streaming, child process spawn/stop with configurable idle timeout, session UUID generation, abort capability
- **CC Integration (FR61-67):** Direct spawn with `CLAUDE_CONFIG_DIR` isolation, session ID argument passing, NDJSON stream parsing, graceful cleanup on app quit

**Non-Functional Requirements:**

| Category | Requirements |
|----------|-------------|
| Performance | App startup < 3s, session load < 1s, sub-agent expansion < 100ms, child spawn < 500ms, real-time streaming with no lag |
| Reliability | Zero data loss, user input preserved on spawn failure, graceful child cleanup on app quit |
| Integration | File watcher on `CLAUDE_CONFIG_DIR` folder, direct child process spawn with NDJSON stream parsing |

**Scale & Complexity:**

- Primary domain: Desktop App (Electron)
- Complexity level: Medium
- Estimated architectural components: ~8-10 major subsystems (shell, plugins, sessions, conversation renderer, child process manager, stream parser, file watcher, IPC layer)

### Technical Constraints & Dependencies

- **Electron framework:** Main process + renderer process architecture
- **Claude Code CLI:** External dependency - spawned directly with `CLAUDE_CONFIG_DIR` env var for isolation
- **Process architecture:** Main process spawns CC children directly via Node.js `child_process`, manages lifecycle via 6-state machine
- **File system:** `CLAUDE_CONFIG_DIR` path under app data folder for session data (platform-specific paths)
- **macOS primary:** Phase 1 targets macOS, architecture must not block future Windows/Linux
- **Local-first:** No cloud dependencies, all data on user machine
- **Offline capable:** History browsing works offline, CC execution requires network

### Cross-Cutting Concerns Identified

1. **Child Process Lifecycle:** Direct spawn via Node.js with `CLAUDE_CONFIG_DIR` env var. 6-state machine (Idle → Spawning → Working → Pending → Terminating, plus Error). Tiered timeout: Working=∞, Pending+Focused=10min, Pending+Unfocused=3min. See [Spawn Child Architecture](#spawn-child-architecture) for details.

2. **Waiting State Detection:** Detect via NDJSON stream events - `stop_reason` in message event indicates Claude waiting for input. Instance transitions to Pending state.

3. **Status Communication:** In-memory state management in main process. No separate status file needed - stream events provide real-time state.

4. **File Watcher Scope:** Watch `CLAUDE_CONFIG_DIR/.claude` folder (platform-specific path under app data). Changes only occur when our child process runs.

5. **Plugin Architecture:** Define core plugin patterns *before* building Sessions plugin. Build only what Sessions needs in the API; extract reusable patterns when second plugin arrives.

6. **Visual Indicators:** Triple redundancy pattern - color bar + icon (⚡/⚠️) + animation (`···` for working). 6 states mapped to distinct visuals. 🔌 disconnect button on session row (click to kill instance). Graceful cleanup of all children on app quit.

7. **State Persistence:** Hybrid pattern - `.claude` folder is source of truth for session existence, DB stores app metadata and enables fast startup queries.

### Testing Strategy (MVP)

- Lean approach for first version
- Happy path integration tests for core flows
- Manual testing corpus for session file parsing edge cases
- Defer comprehensive test automation to post-MVP

## Starter Template Evaluation

### Primary Technology Domain

**Desktop App (Electron)** with React renderer, based on project requirements for an Obsidian-inspired visual client for Claude Code.

### Technical Preferences Established

| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | React + TypeScript | Component model, ecosystem, team familiarity |
| Build Tool | Vite (via electron-vite) | Fast HMR, modern ESM support |
| Styling | Tailwind CSS v4 | Utility-first, dark-mode native, UX spec recommendation |
| Components | Radix UI | Headless, accessible, full styling control |
| State (runtime) | Zustand | Minimal boilerplate, ~3KB, transient UI state only |
| State (persistent) | SQLite (better-sqlite3) | Single DB for all data, externally queryable |
| Packaging | electron-builder | Mature, DMG/NSIS/code signing support |
| Testing | Vitest + Testing Library | AI-automatable, fast, Vite-native |

### Selected Starter: electron-vite (react-ts template)

**Rationale:**
- Native Vite integration with mature, stable implementation
- Single config file for main, renderer, and preload scripts
- True HMR for renderer + hot reload for main/preload
- Better ESM support than Electron Forge's experimental Vite plugin
- Uses electron-builder for packaging (battle-tested)

**Initialization Commands:**

```bash
# Create project with React + TypeScript template
npm create @quick-start/electron@latest grimoire -- --template react-ts

cd grimoire

# Add Tailwind CSS v4
npm install -D tailwindcss @tailwindcss/vite

# Add Radix UI primitives
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-tabs

# Add Zustand for runtime UI state
npm install zustand

# Add SQLite for persistent data
npm install better-sqlite3
npm install -D @types/better-sqlite3
npx electron-rebuild -f -w better-sqlite3

# Add testing stack
npm install -D vitest @testing-library/react jsdom

# Add development utilities
npm install -D prettier eslint
```

### State Architecture

| Layer | Solution | Purpose |
|-------|----------|---------|
| **Persistent** | SQLite | Sessions, settings, plugin config - externally queryable |
| **Runtime UI** | Zustand | Panel visibility, selected tab, transient state |
| **Main process** | Plain objects | Child process registry, watcher status |

**Database location:** `~/.grimoire/grimoire.db`

**Schema file:** `src/shared/db/schema.sql`

### Data Fetching Pattern (MVP)

**Polling with 1-2 second interval** - simple, reliable, ship first.

```typescript
// MVP approach - optimize to events later if needed
useEffect(() => {
  const poll = setInterval(async () => {
    const sessions = await window.grimoireAPI.sessions.list()
    setSessionStore(sessions)
  }, 2000)
  return () => clearInterval(poll)
}, [])
```

Event-driven updates deferred to optimization phase.

### Plugin Architecture (MVP)

**Static imports, folder convention only.** No dynamic runtime loading for Phase 1.

- `plugins/` is organizational structure for future-proofing
- Code imported directly into main bundle
- True dynamic plugin system is future scope

```typescript
// src/main/plugin-loader.ts (MVP)
import { SessionsPlugin } from '../../plugins/sessions/src/main'
export const plugins = [SessionsPlugin]
```

```typescript
// Path alias for clean imports
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@plugins/*": ["./plugins/*"]
    }
  }
}
```

### IPC Architecture

Typed contextBridge via shared types - simple request/response for MVP.

```typescript
// src/shared/types/ipc.ts
export interface GrimoireAPI {
  sessions: {
    list: () => Promise<Session[]>
    spawn: (sessionId: string) => Promise<void>
    kill: (sessionId: string) => Promise<void>
  }
  db: {
    query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  }
}
```

### Testing Configuration

**AI-automatable validation:**
```json
{
  "scripts": {
    "validate": "tsc --noEmit && vitest run && npm run lint"
  }
}
```

**Vitest config with environment separation:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['**/main/**/*.test.ts', 'node'],
      ['**/preload/**/*.test.ts', 'node']
    ]
  }
})
```

### Project Structure

```
grimoire/
├── CLAUDE.md
├── electron.vite.config.ts
├── vitest.config.ts
├── tsconfig.json                  ← includes @plugins/* path alias
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   └── plugin-loader.ts       ← Static plugin imports
│   ├── preload/
│   │   └── index.ts
│   ├── renderer/
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── core/
│   │       │   ├── shell/
│   │       │   ├── loading/
│   │       │   └── settings/
│   │       └── shared/
│   │           ├── hooks/
│   │           ├── store/         ← Zustand stores
│   │           └── utils/
│   └── shared/
│       ├── types/
│       │   └── ipc.ts
│       └── db/
│           └── schema.sql
├── plugins/
│   └── sessions/
│       ├── AGENTS.md
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts
│       │   │   ├── instance-manager.ts   ← 6-state machine
│       │   │   └── stream-parser.ts      ← NDJSON parsing
│       │   ├── renderer/
│       │   │   ├── SessionList.tsx
│       │   │   ├── SessionList.test.ts
│       │   │   ├── ConversationView.tsx
│       │   │   └── ...
│       │   └── shared/
│       │       └── types.ts
│       └── README.md
└── resources/                      ← App icons
```

### Architecture Principles

1. **Feature folders are autonomous** - Independently understandable by AI
2. **Colocate tests** - `Feature.test.ts` next to `Feature.tsx`
3. **Plugins kept flat** - 2-3 levels max, static imports for MVP
4. **Shared UI strategy** - Start in plugin, extract when second consumer appears
5. **Ship then optimize** - Polling before events, static before dynamic
6. **State machine testability** - 6-state machine is pure logic, easy unit tests

## Spawn Child Architecture

### Overview

The Spawn Child system manages Claude Code CLI instances on behalf of Grimoire. Key concepts:

- **Session:** A conversation within Claude Code (persisted in `.claude` folder)
- **Instance:** A running Claude Code stream/child process (ephemeral)

### Session ID Management

**Pattern:** Hybrid - folder is truth, DB adds metadata

| Responsibility | Source of Truth | Purpose |
|----------------|-----------------|---------|
| Session existence | `.claude` folder | Claude Code is authoritative |
| App metadata/stats | Database | Links app data to sessions |

DB entry created only after Claude Code's first response or error confirms session exists.

### App Startup Pattern

**Pattern:** DB-First with Background Validation

| Step | Action |
|------|--------|
| 1 | Query DB → Show session list immediately (fast startup) |
| 2 | Background: Scan `.claude` folder |
| 3 | Compare → Flag discrepancies |
| 4 | Notify user of "discovered" sessions if any |

### Instance Lifecycle

**State Machine (6 states):**

```
Idle → Spawning → Working → Pending → Terminating
                     ↓
                   Error
```

**Tiered Timeout:**

| State | Default Timeout | Behavior |
|-------|-----------------|----------|
| Working | None | No timeout while processing |
| Pending + Focused | 10 min | User viewing this session |
| Pending + Unfocused | 3 min | User in different session |
| Never close | ∞ | Optional setting |

Timer resets on tab switch (not cumulative).

**Spawn Strategy:** First keystroke triggers spawn (typing masks cold start).

**Error Handling:**

| Error Type | Handling |
|------------|----------|
| Network/transient | Auto-retry 2x, then surface |
| Spawn failure | Show immediately, offer retry |
| Claude error | Show in chat, instance stays alive |
| Crash/fatal | Terminate, show error, offer restart |

**Concurrency:** Unlimited instances, user-managed via UI.

### Stream Communication

**Protocol:** NDJSON stream-json via Claude Code CLI

```bash
CLAUDE_CONFIG_DIR=/path/to/grimoire/.claude \
claude --session-id <uuid> \
       --output-format stream-json \
       --include-partial-messages \
       -p "user message"
```

**Event types:** `init`, `message`, `tool_use`, `tool_result`, `result`

**Response Tracking:**

```typescript
interface Response {
  id: string
  status: 'sending' | 'streaming' | 'complete' | 'error'
  chunks: string[]
  fullText: string
  error?: Error
  startedAt: Date
  completedAt?: Date
}
```

**Known Issue:** Final `result` event may not emit (GitHub #1920). Mitigate via `stop_reason` in message event.

### Isolation Architecture

**Pattern:** `CLAUDE_CONFIG_DIR` environment variable per-process

**Data Locations:**

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Grimoire/.claude/` |
| Windows | `%APPDATA%/Grimoire/.claude/` |
| Linux | `~/.local/share/grimoire/.claude/` |

**Spawn Implementation:**

```typescript
const child = spawn('claude', [
  '--session-id', sessionId,
  '--output-format', 'stream-json',
  '--include-partial-messages',
  '-p', message
], {
  env: {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(app.getPath('userData'), '.claude')
  }
});
```

**Why CLAUDE_CONFIG_DIR over alternatives:**
- Docker: Too much friction (requires install, 500MB+)
- HOME override: Breaks developer toolchain
- Symlink swap: Risky with concurrent processes
- CLAUDE_CONFIG_DIR: Clean, per-process, crash-safe

### Tab Behavior

**Architecture:** Single-window app with tabbed interface

| Scenario | Behavior |
|----------|----------|
| Click session in list | Open tab (or focus if already open) |
| Close tab while Pending/Idle | Tab closes, instance terminates |
| Close tab while Working | Confirmation dialog |
| Close app | All instances terminate (graceful shutdown) |

### Settings

**Storage:** Database (not files)
- Global + per-project settings in DB
- Schema-driven defaults and validation
- Immediate application with undo support

### Data Export/Backup

**MVP:** Not included. Users can manually backup app data folder if needed.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- All critical decisions made in Steps 2-3 and spawn-child-decisions
- Stack: electron-vite + React + TypeScript + Tailwind + Radix + Zustand + SQLite
- Child process: CLAUDE_CONFIG_DIR isolation + 6-state machine + NDJSON streaming

**Important Decisions (Shape Architecture):**
- Data validation: Zod for runtime validation (renderer → main only)
- Plugin architecture: Static imports for MVP
- IPC: Typed contextBridge with shared types

**Deferred Decisions (Post-MVP):**

| Decision | Trigger to Implement |
|----------|---------------------|
| Auto-updates | Before first external user |
| Code signing | Before first external user |
| Database migrations | When schema changes post-launch |
| Dynamic plugin loading | When second plugin needed |
| Event-driven data fetching | If polling causes performance issues |
| Settings backup on schema change | When approaching stability |

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | SQLite (better-sqlite3) | Single file, externally queryable, no server |
| Schema location | `src/shared/db/schema.sql` | AI reference, version controlled |
| Migration strategy | **Recreate on change** (MVP) | Acceptable data loss during early development |
| Validation | **Zod** | Runtime validation with TypeScript inference |

**Schema version tracking:**
```sql
-- src/shared/db/schema.sql
-- VERSION: 1
-- IMPORTANT: Bump version number when modifying this file

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  archived INTEGER DEFAULT 0
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
```

**Migration approach for MVP:**
```typescript
// src/main/db.ts
const DB_VERSION = 1

function initDatabase(dbPath: string) {
  const db = new Database(dbPath)
  const currentVersion = db.pragma('user_version', { simple: true })

  if (currentVersion !== DB_VERSION) {
    console.warn(`Database schema changed (${currentVersion} → ${DB_VERSION}). Recreating database.`)
    // Drop and recreate all tables
    db.exec(fs.readFileSync('src/shared/db/schema.sql', 'utf-8'))
    db.pragma(`user_version = ${DB_VERSION}`)
  }
  return db
}
```

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App authentication | **None** | Local-first single-user app |
| Claude Code auth | **External** | CC handles its own authentication |
| Data location | Platform app data folder | Standard, user-accessible if needed |

**Security model:** Trust local environment. No encryption of local data.

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IPC mechanism | Typed contextBridge | Simple, type-safe, no extra deps |
| Data fetching | Polling (MVP) | Ship first, optimize to events later |
| Error handling | Categorized (spawn-child) | Network, spawn, Claude, crash - different handling |
| Validation | Zod at IPC boundary | Renderer → Main only (trust main → renderer) |

**Validation pattern:**
```typescript
// src/shared/types/ipc.ts
import { z } from 'zod'

export const SpawnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1)
})

export type SpawnRequest = z.infer<typeof SpawnRequestSchema>
```

```typescript
// preload/index.ts - keep thin, no validation
contextBridge.exposeInMainWorld('grimoireAPI', {
  sessions: {
    spawn: (req: unknown) => ipcRenderer.invoke('sessions:spawn', req)
  }
})
```

```typescript
// main/ipc-handlers.ts - validate here
ipcMain.handle('sessions:spawn', async (_, req: unknown) => {
  const validated = SpawnRequestSchema.parse(req) // Throws on failure
  return instanceManager.spawn(validated)
})
```

**Validation failure:** Throws error → IPC rejects → Renderer catches in try/catch.

**Schema tests required:**
```typescript
// src/shared/types/ipc.test.ts
import { SpawnRequestSchema } from './ipc'

test('SpawnRequestSchema rejects invalid sessionId', () => {
  expect(() => SpawnRequestSchema.parse({
    sessionId: 'not-a-uuid',
    message: 'hi'
  })).toThrow()
})

test('SpawnRequestSchema rejects empty message', () => {
  expect(() => SpawnRequestSchema.parse({
    sessionId: crypto.randomUUID(),
    message: ''
  })).toThrow()
})
```

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State (UI) | Zustand | Minimal boilerplate, mirrors main process state |
| State (persistent) | SQLite via IPC | Single source of truth |
| Components | Radix UI (headless) | Accessible, unstyled, full control |
| Styling | Tailwind CSS v4 | Utility-first, dark mode native |
| Routing | N/A | Single window with tabs (not SPA routing) |
| Code organization | Feature-based | AI-friendly, autonomous folders |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | electron-vite | Fast HMR, stable Vite integration |
| Packaging | electron-builder | Mature, cross-platform |
| Auto-updates | **Deferred** | Implement before first external user |
| Code signing | **Deferred** | Implement before first external user |
| CI/CD | **Deferred** | Local builds for MVP |

**Distribution approach (MVP):**
- Build locally with `npm run build`
- Distribute unsigned DMG for personal use
- Add signing + notarization before any public release

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold (electron-vite react-ts)
2. Tailwind + Radix + Zod setup
3. SQLite integration with schema
4. IPC layer with typed contextBridge + Zod validation
5. Core shell (panels, tabs)
6. Sessions plugin (instance-manager, stream-parser)

**Cross-Component Dependencies:**
- Zod schemas shared between renderer validation and main process
- SQLite accessed only from main process (renderer queries via IPC)
- Zustand stores mirror instance state from main process events
- 6-state machine drives both IPC events and UI indicators

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 6 areas where AI agents could make different choices - all now have defined patterns.

### Naming Patterns

#### Database Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `sessions`, `settings`, `plugin_configs` |
| Columns | snake_case | `session_id`, `project_path`, `created_at` |
| Primary keys | `id` or `{table}_id` | `id` for simple, `session_id` if referenced |
| Foreign keys | `{referenced_table}_id` | `session_id` referencing sessions |
| Timestamps | `{action}_at` | `created_at`, `updated_at`, `archived_at` |
| Booleans | `is_{state}` or `{state}` | `is_archived` or `archived` |

**Example schema:**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived INTEGER DEFAULT 0
);
```

#### IPC Channel Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Channels | `namespace:action` | `sessions:list`, `sessions:spawn` |
| Events | `namespace:eventName` | `instance:stateChanged`, `session:discovered` |
| Namespace | Lowercase, singular | `session`, `instance`, `db`, `app` |
| Action | camelCase verb | `list`, `spawn`, `kill`, `getById` |

**All IPC channels:**
```typescript
// Request channels (renderer → main)
'sessions:list'
'sessions:spawn'
'sessions:kill'
'sessions:sendMessage'
'db:query'
'app:getPath'

// Event channels (main → renderer)
'instance:stateChanged'
'instance:streamChunk'
'session:discovered'
'app:beforeQuit'
```

#### Code Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| React components | PascalCase | `SessionList`, `ConversationView` |
| Component files | PascalCase.tsx | `SessionList.tsx`, `ChatInput.tsx` |
| Test files | PascalCase.test.ts | `SessionList.test.ts` |
| Hooks | camelCase, use prefix | `useSessionStore`, `useInstanceState` |
| Utilities | camelCase | `formatTimestamp`, `parseStreamEvent` |
| Constants | SCREAMING_SNAKE_CASE | `DB_VERSION`, `DEFAULT_TIMEOUT` |
| Types/Interfaces | PascalCase | `Session`, `InstanceState`, `SpawnRequest` |
| Zod schemas | PascalCase + Schema | `SpawnRequestSchema`, `SessionSchema` |
| Zustand stores | use + Name + Store | `useUIStore`, `useSessionStore` |

### Structure Patterns

#### Project Organization

| Content Type | Location | Example |
|--------------|----------|---------|
| React components | Feature folder | `plugins/sessions/src/renderer/SessionList.tsx` |
| Component tests | Colocated | `plugins/sessions/src/renderer/SessionList.test.ts` |
| Zustand stores | `shared/store/` | `src/renderer/src/shared/store/useUIStore.ts` |
| Shared hooks | `shared/hooks/` | `src/renderer/src/shared/hooks/usePolling.ts` |
| Shared types | `src/shared/types/` | `src/shared/types/ipc.ts` |
| Zod schemas | With types | `src/shared/types/ipc.ts` |
| DB schema | `src/shared/db/` | `src/shared/db/schema.sql` |
| Main process | `src/main/` | `src/main/db.ts`, `src/main/ipc-handlers.ts` |
| Plugin main | `plugins/{name}/src/main/` | `plugins/sessions/src/main/instance-manager.ts` |
| Plugin renderer | `plugins/{name}/src/renderer/` | `plugins/sessions/src/renderer/SessionList.tsx` |

#### File Naming Patterns

| File Type | Convention | Example |
|-----------|------------|---------|
| React component | `{ComponentName}.tsx` | `SessionList.tsx` |
| Test file | `{ComponentName}.test.ts` | `SessionList.test.ts` |
| Zustand store | `use{Name}Store.ts` | `useUIStore.ts` |
| Hook | `use{Name}.ts` | `usePolling.ts` |
| Utility | `{name}.ts` | `formatters.ts`, `parsers.ts` |
| Types | `{domain}.ts` or `types.ts` | `ipc.ts`, `types.ts` |
| Constants | `constants.ts` | `constants.ts` |
| Index exports | `index.ts` | `index.ts` |

### Format Patterns

#### IPC Response Format

**Success response:**
```typescript
// Direct return - no wrapper for simple responses
return sessions // Session[]
return { success: true }
```

**Error response:**
```typescript
// Throw error - IPC rejects, renderer catches
throw new Error('Spawn failed: process exited with code 1')

// For typed errors, use Zod-validated error schema
const AppErrorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spawn_failed'), message: z.string(), code: z.number().optional() }),
  z.object({ type: z.literal('network_error'), message: z.string() }),
  z.object({ type: z.literal('validation_error'), message: z.string(), field: z.string() }),
])
```

#### Data Exchange Formats

| Data Type | Format | Example |
|-----------|--------|---------|
| Timestamps | Unix milliseconds (INTEGER) | `1705123456789` |
| UUIDs | String | `"550e8400-e29b-41d4-a716-446655440000"` |
| Booleans (DB) | INTEGER 0/1 | `archived INTEGER DEFAULT 0` |
| Booleans (JSON) | true/false | `{ "archived": false }` |
| JSON fields | camelCase | `{ "projectPath": "/path", "createdAt": 1705123456789 }` |
| SQL fields | snake_case | `project_path`, `created_at` |

**TypeScript ↔ SQLite mapping:**
```typescript
// Transform snake_case DB rows to camelCase TypeScript
function toSession(row: DBSessionRow): Session {
  return {
    id: row.id,
    projectPath: row.project_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: Boolean(row.archived)
  }
}
```

### Communication Patterns

#### Event System Patterns

**IPC event structure:**
```typescript
// Main → Renderer events
interface InstanceStateEvent {
  sessionId: string
  state: InstanceState // 'idle' | 'spawning' | 'working' | 'pending' | 'terminating' | 'error'
  previousState: InstanceState
  timestamp: number
}

interface StreamChunkEvent {
  sessionId: string
  chunk: string
  eventType: 'message' | 'tool_use' | 'tool_result'
}
```

**Event emission pattern:**
```typescript
// Main process
mainWindow.webContents.send('instance:stateChanged', {
  sessionId,
  state: newState,
  previousState: oldState,
  timestamp: Date.now()
})

// Renderer - preload exposes listener
window.grimoireAPI.onInstanceStateChange((event) => {
  useInstanceStore.getState().updateState(event.sessionId, event.state)
})
```

#### State Management Patterns

**Zustand store pattern:**
```typescript
// Separate stores per domain
// src/renderer/src/shared/store/useUIStore.ts
interface UIState {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  activeTabId: string | null
  setLeftPanel: (open: boolean) => void
  setActiveTab: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTabId: null,
  setLeftPanel: (open) => set({ leftPanelOpen: open }),
  setActiveTab: (id) => set({ activeTabId: id })
}))
```

**State update pattern:**
```typescript
// Always use set() with partial state (immutable updates)
set({ leftPanelOpen: false })

// For complex updates, use callback form
set((state) => ({
  tabs: [...state.tabs, newTab]
}))

// Never mutate directly
// ❌ state.leftPanelOpen = false
```

### Process Patterns

#### Error Handling Patterns

**Renderer error handling:**
```typescript
// Wrap IPC calls in try/catch
async function spawnSession(sessionId: string, message: string) {
  try {
    await window.grimoireAPI.sessions.spawn({ sessionId, message })
  } catch (error) {
    // Log for debugging
    console.error('Spawn failed:', error)

    // Update UI state
    useInstanceStore.getState().setError(sessionId, error.message)

    // Don't re-throw unless caller needs to handle
  }
}
```

**Main process error handling:**
```typescript
// IPC handlers - let errors propagate as rejections
ipcMain.handle('sessions:spawn', async (_, req) => {
  const validated = SpawnRequestSchema.parse(req) // Throws on invalid
  return instanceManager.spawn(validated) // Throws on failure
})

// Instance manager - categorize errors
class InstanceManager {
  async spawn(request: SpawnRequest) {
    try {
      // spawn logic
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Claude Code not found. Please install it first.')
      }
      throw error // Re-throw unknown errors
    }
  }
}
```

#### Loading State Patterns

**Loading state naming:**
```typescript
// Per-operation loading states in stores
interface SessionState {
  sessions: Session[]
  isLoading: boolean        // Initial load
  isRefreshing: boolean     // Background refresh
  error: string | null
}

// Instance-specific states
interface InstanceState {
  state: 'idle' | 'spawning' | 'working' | 'pending' | 'terminating' | 'error'
  // 'spawning' IS the loading state for that instance
}
```

**Loading UI pattern:**
```typescript
// Show loading only on initial load, not refreshes
{isLoading && sessions.length === 0 && <LoadingSpinner />}
{sessions.length > 0 && <SessionList sessions={sessions} />}
{error && <ErrorMessage message={error} />}
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly - no variations
2. Place files in specified locations - no alternative structures
3. Use Zod schemas for all IPC request validation
4. Use separate Zustand stores per domain
5. Transform snake_case DB fields to camelCase TypeScript
6. Use `namespace:action` pattern for all IPC channels
7. Colocate tests with components
8. Use PascalCase for React components and their files

**Pattern Verification:**
- `npm run validate` catches type mismatches
- ESLint rules enforce naming conventions
- PR review checks file placement

### Pattern Examples

**Good Examples:**

```typescript
// ✅ Correct IPC channel naming
ipcMain.handle('sessions:list', async () => { ... })

// ✅ Correct file structure
plugins/sessions/src/renderer/SessionList.tsx
plugins/sessions/src/renderer/SessionList.test.ts

// ✅ Correct Zustand store
export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  isLoading: false,
  setSessions: (sessions) => set({ sessions })
}))

// ✅ Correct DB → TypeScript transformation
const session: Session = {
  id: row.id,
  projectPath: row.project_path,  // snake_case → camelCase
  createdAt: row.created_at
}
```

**Anti-Patterns:**

```typescript
// ❌ Wrong IPC naming
ipcMain.handle('listSessions', ...)     // Should be 'sessions:list'
ipcMain.handle('sessions.list', ...)    // Should use colon, not dot

// ❌ Wrong file naming
session-list.tsx                        // Should be SessionList.tsx
sessionList.tsx                         // Should be SessionList.tsx

// ❌ Wrong store structure
const useStore = create((set) => ({
  ui: { ... },
  sessions: { ... }                     // Should be separate stores
}))

// ❌ Mutating state directly
set((state) => {
  state.sessions.push(newSession)       // Should use spread
  return state
})

// ❌ Inconsistent naming in DB
CREATE TABLE Sessions (                 // Should be lowercase 'sessions'
  sessionId TEXT,                       // Should be 'session_id' or 'id'
  ProjectPath TEXT                      // Should be 'project_path'
)
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
grimoire/
├── README.md
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
│
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── db.test.ts
│   │   ├── ipc-handlers.ts
│   │   ├── ipc-handlers.test.ts
│   │   ├── plugin-loader.ts
│   │   └── window.ts
│   │
│   ├── preload/
│   │   ├── index.ts
│   │   └── index.d.ts
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── App.test.tsx
│   │       │
│   │       ├── core/
│   │       │   ├── shell/
│   │       │   │   ├── Shell.tsx
│   │       │   │   ├── Shell.test.tsx
│   │       │   │   ├── Ribbon.tsx
│   │       │   │   ├── LeftPanel.tsx
│   │       │   │   ├── RightPanel.tsx
│   │       │   │   ├── TabBar.tsx
│   │       │   │   ├── TabBar.test.tsx
│   │       │   │   ├── ResizableDivider.tsx
│   │       │   │   └── types.ts
│   │       │   │
│   │       │   ├── loading/
│   │       │   │   ├── LoadingScreen.tsx
│   │       │   │   ├── LoadingScreen.test.tsx
│   │       │   │   └── useAppInit.ts
│   │       │   │
│   │       │   └── settings/
│   │       │       ├── SettingsDialog.tsx
│   │       │       ├── SettingsDialog.test.tsx
│   │       │       ├── SettingsCategory.tsx
│   │       │       └── useSettings.ts
│   │       │
│   │       └── shared/
│   │           ├── components/
│   │           │   ├── Button.tsx
│   │           │   ├── Dialog.tsx
│   │           │   ├── Tooltip.tsx
│   │           │   └── ScrollArea.tsx
│   │           │
│   │           ├── hooks/
│   │           │   ├── usePolling.ts
│   │           │   ├── usePolling.test.ts
│   │           │   └── useIpcEvent.ts
│   │           │
│   │           ├── store/
│   │           │   ├── useUIStore.ts
│   │           │   ├── useUIStore.test.ts
│   │           │   ├── useTabStore.ts
│   │           │   └── useTabStore.test.ts
│   │           │
│   │           └── utils/
│   │               ├── formatters.ts
│   │               ├── formatters.test.ts
│   │               └── cn.ts
│   │
│   └── shared/
│       ├── types/
│       │   ├── ipc.ts
│       │   ├── ipc.test.ts
│       │   ├── session.ts
│       │   └── instance.ts
│       │
│       ├── db/
│       │   └── schema.sql
│       │
│       └── constants.ts
│
├── plugins/
│   └── sessions/
│       ├── README.md
│       │
│       └── src/
│           ├── main/
│           │   ├── index.ts
│           │   ├── index.test.ts
│           │   ├── instance-manager.ts
│           │   ├── instance-manager.test.ts
│           │   ├── stream-parser.ts
│           │   ├── stream-parser.test.ts
│           │   ├── session-scanner.ts
│           │   └── session-scanner.test.ts
│           │
│           ├── renderer/
│           │   ├── SessionList.tsx
│           │   ├── SessionList.test.tsx
│           │   ├── SessionListItem.tsx
│           │   ├── SessionListItem.test.tsx
│           │   ├── ConversationView.tsx
│           │   ├── ConversationView.test.tsx
│           │   ├── MessageBubble.tsx
│           │   ├── ToolCallCard.tsx
│           │   ├── SubAgentContainer.tsx
│           │   ├── ChatInput.tsx
│           │   ├── ChatInput.test.tsx
│           │   ├── SessionInfo.tsx
│           │   ├── EventTimeline.tsx
│           │   ├── StreamingIndicator.tsx
│           │   │
│           │   ├── store/
│           │   │   ├── useSessionStore.ts
│           │   │   ├── useSessionStore.test.ts
│           │   │   ├── useInstanceStore.ts
│           │   │   └── useInstanceStore.test.ts
│           │   │
│           │   └── hooks/
│           │       ├── useSessionPolling.ts
│           │       └── useStreamEvents.ts
│           │
│           └── shared/
│               ├── types.ts
│               └── constants.ts
│
└── resources/
    ├── icon.icns
    ├── icon.ico
    └── icon.png
```

### Architectural Boundaries

#### IPC Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                     RENDERER PROCESS                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Core Shell  │  │  Settings   │  │   Sessions Plugin   │  │
│  │  (Zustand)  │  │  (Zustand)  │  │     (Zustand)       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                    ┌─────┴─────┐                             │
│                    │  Preload  │  ← contextBridge            │
│                    │(grimoireAPI)  + Zod validation          │
│                    └─────┬─────┘                             │
└──────────────────────────┼───────────────────────────────────┘
                           │ IPC (namespace:action)
┌──────────────────────────┼───────────────────────────────────┐
│                    ┌─────┴─────┐                             │
│                    │   Main    │                             │
│                    │ Process   │                             │
│                    └─────┬─────┘                             │
│         ┌────────────────┼─────────────────────┐             │
│         │                │                     │             │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐  │
│  │   SQLite    │  │   Plugin    │  │  Instance Manager   │  │
│  │    (DB)     │  │   Loader    │  │   (6-state FSM)     │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
│                     MAIN PROCESS              │             │
└───────────────────────────────────────────────┼─────────────┘
                                                │ spawn()
                                    ┌───────────┴───────────┐
                                    │   Claude Code CLI     │
                                    │  (CLAUDE_CONFIG_DIR)  │
                                    └───────────────────────┘
```

#### Component Boundaries

| Boundary | Owner | Consumers | Communication |
|----------|-------|-----------|---------------|
| Shell layout | `core/shell/` | All plugins | Props, Zustand |
| Settings UI | `core/settings/` | All plugins | Plugin settings interface |
| Session state | `plugins/sessions/` | Shell (indicators) | Zustand + IPC events |
| Instance lifecycle | `plugins/sessions/main/` | Renderer via IPC | Events |
| Database | `src/main/db.ts` | All main process code | Function calls |

#### Data Boundaries

| Data Type | Location | Access Pattern |
|-----------|----------|----------------|
| Sessions | `CLAUDE_CONFIG_DIR/.claude/` | Read-only (file watcher) |
| App metadata | SQLite `sessions` table | Main process only |
| Settings | SQLite `settings` table | Main process only |
| UI state | Zustand stores | Renderer only |
| Instance state | In-memory Map | Main process, emits events |

### Requirements to Structure Mapping

#### FR1-7: Application Shell → `src/renderer/src/core/shell/`

| FR | File | Purpose |
|----|------|---------|
| FR1 | `Shell.tsx` | Multi-panel layout container |
| FR2 | `Ribbon.tsx` | Left navigation ribbon |
| FR3 | `LeftPanel.tsx`, `RightPanel.tsx` | Collapsible panels |
| FR4 | `ResizableDivider.tsx` | Panel resize handles |
| FR5-7 | `TabBar.tsx` | Tab system, one-per-session |

#### FR8-19: Application Lifecycle → `src/renderer/src/core/loading/`

| FR | File | Purpose |
|----|------|---------|
| FR8-11 | `LoadingScreen.tsx` | Loading UI |
| FR12-15 | `useAppInit.ts` | CC verification, auth check |
| FR16-19 | `src/main/db.ts` | State persistence, startup |

#### FR20-24: Plugin System → `src/renderer/src/core/settings/`

| FR | File | Purpose |
|----|------|---------|
| FR20-24 | `SettingsDialog.tsx`, `SettingsCategory.tsx` | Plugin enable/disable, settings |

#### FR25-32: Session Management → `plugins/sessions/`

| FR | File | Purpose |
|----|------|---------|
| FR25-27 | `SessionList.tsx` | List from CLAUDE_CONFIG_DIR |
| FR28 | `SessionListItem.tsx` | State indicators, 🔌 disconnect |
| FR29-32 | `session-scanner.ts` | Archive, metadata |

#### FR33-42: Conversation Display → `plugins/sessions/renderer/`

| FR | File | Purpose |
|----|------|---------|
| FR33 | `MessageBubble.tsx` | User/assistant messages |
| FR34 | `ToolCallCard.tsx` | Tool call display |
| FR35 | `SubAgentContainer.tsx` | Collapsible sub-agents |
| FR36 | `EventTimeline.tsx` | Navigation map |
| FR37-42 | `ConversationView.tsx` | Streaming, errors, indicators |

#### FR43-46: Session Information → `plugins/sessions/renderer/`

| FR | File | Purpose |
|----|------|---------|
| FR43-46 | `SessionInfo.tsx` | Token usage, metadata |

#### FR47-60: Session Interaction → `plugins/sessions/`

| FR | File | Purpose |
|----|------|---------|
| FR47-53 | `ChatInput.tsx` | Input, send, abort |
| FR54-55 | `instance-manager.ts` | Spawn on keystroke, timeout |
| FR56-60 | `stream-parser.ts` | Real-time streaming |

#### FR61-67: CC Integration → `plugins/sessions/main/`

| FR | File | Purpose |
|----|------|---------|
| FR61-64 | `instance-manager.ts` | CLAUDE_CONFIG_DIR spawn |
| FR65-67 | `stream-parser.ts` | NDJSON parsing, session ID |

### Integration Points

#### Internal Communication

| From | To | Method | Channel/Pattern |
|------|-----|--------|-----------------|
| Renderer | Main | IPC invoke | `sessions:list`, `sessions:spawn` |
| Main | Renderer | IPC send | `instance:stateChanged`, `instance:streamChunk` |
| Components | Components | Zustand | `useSessionStore`, `useUIStore` |
| Plugin | Core | Props | Shell passes plugin components |

#### Data Flow

```
User types message
       │
       ▼
ChatInput.tsx (Zustand: queue message)
       │
       ▼
grimoireAPI.sessions.spawn() (IPC)
       │
       ▼
instance-manager.ts (spawn child with CLAUDE_CONFIG_DIR)
       │
       ▼
stream-parser.ts (NDJSON events)
       │
       ├──▶ instance:streamChunk (IPC event)
       │           │
       │           ▼
       │    useStreamEvents.ts → ConversationView.tsx
       │
       └──▶ instance:stateChanged (IPC event)
                   │
                   ▼
            useInstanceStore.ts → SessionListItem.tsx (indicators)
```

### Distribution Strategy (MVP)

| Phase | Method | Signing | Auto-Update |
|-------|--------|---------|-------------|
| Development | `npm run dev` | No | No |
| Friend testing | GitHub clone or unsigned DMG | No | No |
| Public release | Signed + notarized DMG | Yes | Yes |

**For friend testing (unsigned DMG):**
```bash
npm run make  # Creates dist/Grimoire-x.x.x.dmg
```
Friend runs `xattr -cr /Applications/Grimoire.app` to bypass Gatekeeper.

**For developer friends:**
```bash
git clone https://github.com/you/grimoire
cd grimoire
npm install
npm run dev
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices (electron-vite, React, TypeScript, Tailwind v4, Radix UI, SQLite, Zustand, Zod, Vitest) are compatible and commonly used together. No version conflicts identified.

**Pattern Consistency:**
All naming conventions (IPC channels, file names, DB columns, Zustand stores) follow documented patterns consistently. Transformation rules (snake_case ↔ camelCase) are clear.

**Structure Alignment:**
Project structure supports all architectural decisions. Electron process separation (main/preload/renderer) is respected. Feature-based organization enables autonomous component development.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
All 67 functional requirements mapped to specific files in the project structure. Each FR category has a designated location with clear file responsibilities.

**Non-Functional Requirements Coverage:**
- Performance: DB-first startup, first-keystroke spawn, client-side expansions
- Reliability: SQLite + .claude folder dual truth, graceful shutdown
- Integration: CLAUDE_CONFIG_DIR isolation, NDJSON streaming, file watching

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions documented with rationale
- Technology stack fully specified
- Integration patterns (IPC, state, events) complete with examples
- Performance strategies defined

**Structure Completeness:**
- Complete directory tree with all files listed
- Component boundaries clearly defined
- FR → file mapping comprehensive
- Data flow diagrams included

**Pattern Completeness:**
- 6 naming pattern categories defined
- Good/anti-pattern examples provided
- 8 enforcement guidelines for AI agents
- Error and loading patterns specified

### Gap Analysis Results

**Critical Gaps:** None

**Important Gaps (Acceptable for MVP):**
- Package versions not pinned (rely on package-lock.json)
- ESLint config uses electron-vite defaults

**Deferred Items:**
- CI/CD pipeline (before public release)
- Auto-updates (before public release)
- Code signing (before public release)
- Proper migrations (when schema stabilizes)

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Medium - Desktop App)
- [x] Technical constraints identified (Electron, CC CLI, macOS primary)
- [x] Cross-cutting concerns mapped (7 concerns documented)

**✅ Architectural Decisions**
- [x] Critical decisions documented with rationale
- [x] Technology stack fully specified
- [x] Integration patterns defined (IPC, Zustand, SQLite)
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established (6 categories)
- [x] Structure patterns defined (file organization)
- [x] Communication patterns specified (IPC, events)
- [x] Process patterns documented (error, loading)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clear separation between core and plugins
- Comprehensive pattern documentation prevents AI agent conflicts
- All FRs mapped to specific implementation files
- 6-state machine fully documented with spawn-child decisions

**Areas for Future Enhancement:**
- Dynamic plugin loading when second plugin needed
- Event-driven data fetching if polling causes issues
- CI/CD and code signing before public release

### Implementation Handoff

**AI Agent Guidelines:**
1. Follow all architectural decisions exactly as documented
2. Use implementation patterns consistently across all components
3. Respect project structure and boundaries
4. Refer to this document for all architectural questions
5. Run `npm run validate` after any code changes

**First Implementation Steps:**
```bash
# 1. Create project with electron-vite
npm create @quick-start/electron@latest grimoire -- --template react-ts

# 2. Install dependencies
cd grimoire
npm install better-sqlite3 zustand zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-tabs
npm install -D tailwindcss @tailwindcss/vite @types/better-sqlite3 vitest @testing-library/react jsdom

# 3. Rebuild native modules
npx electron-rebuild -f -w better-sqlite3

# 4. Reorganize to feature-based structure
# (Follow project structure from architecture document)
```
