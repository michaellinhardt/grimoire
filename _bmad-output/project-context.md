---
project_name: 'grimoire'
user_name: 'Teazyou'
date: '2026-01-22'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Core Stack:**
- Electron via electron-vite (react-ts template)
- React + TypeScript
- Vite for build/HMR

**Key Dependencies:**
- Tailwind CSS v4 (not v3 - different config approach)
- Radix UI primitives (dialog, dropdown-menu, tooltip, scroll-area, tabs)
- Zustand ~3KB (transient UI state only)
- better-sqlite3 (requires `npx electron-rebuild -f -w better-sqlite3`)
- Zod (runtime validation at IPC boundary)
- Vitest + Testing Library
- electron-builder for packaging

---

## Language-Specific Rules (TypeScript)

**Path Aliases:**
- `@plugins/*` → `./plugins/*` in tsconfig.json

**Type Transformation (DB ↔ TypeScript):**
- DB uses snake_case, TypeScript uses camelCase
- Always use transform functions: `toSession(row)`, `toFolder(row)`, `toFileEdit(row)`
- Booleans: `Boolean(row.is_archived)` (DB stores INTEGER 0/1)

**Zod Validation:**
- Validate at IPC boundary in main process, NOT in preload
- Preload stays thin - no validation logic
- Schema naming: `{Name}Schema` (e.g., `SpawnRequestSchema`)

**Error Handling:**
- IPC handlers: Throw errors (let them propagate as rejections)
- Renderer: Wrap IPC calls in try/catch, update Zustand on error
- Categorize spawn errors: `ENOENT` = "Claude Code not found"

**Import Patterns:**
- Static plugin imports for MVP (no dynamic `import()`)
- Shared types in `src/shared/types/`
- Zod schemas co-located with type definitions

---

## Framework-Specific Rules (React/Electron)

**Component Organization:**
- PascalCase files: `SessionList.tsx`, `ChatInput.tsx`
- Colocate tests: `SessionList.test.tsx` beside `SessionList.tsx`
- Feature folders are autonomous (independently understandable by AI)

**Zustand State Management:**
- Naming: `use{Name}Store` (e.g., `useUIStore`, `useSessionStore`)
- Separate stores per domain - NEVER combine multiple domains
- Immutable updates only: `set({ key: value })` or `set((state) => ({ ... }))`
- Never mutate: `state.foo = bar` is forbidden

**Electron Process Boundaries:**
| Process | Responsibilities |
|---------|------------------|
| Main | SQLite, child processes, IPC handlers, Zod validation |
| Preload | Thin contextBridge only, NO validation |
| Renderer | React, Zustand, calls `window.grimoireAPI` |

**IPC Channel Naming:**
- Pattern: `namespace:action` (use colon, not dot or camelCase)
- Examples: `sessions:list`, `sessions:spawn`, `instance:stateChanged`
- Namespaces: lowercase singular (`session`, `instance`, `db`, `app`)

**Plugin Structure:**
```
plugins/{name}/src/
├── main/           # Electron main process code
├── renderer/       # React components
│   ├── store/      # Plugin-specific Zustand stores
│   └── hooks/      # Plugin-specific hooks
└── shared/         # Shared types/constants
```

---

## Testing Rules

**Test Location:**
- Colocate with source: `SessionList.test.tsx` beside `SessionList.tsx`
- Paths: `src/**/*.test.ts`, `plugins/**/*.test.ts`

**Environment Separation (vitest.config.ts):**
- `**/main/**/*.test.ts` → `node` environment
- `**/preload/**/*.test.ts` → `node` environment
- Everything else → `jsdom` (renderer tests)

**Validation Command:**
```bash
npm run validate  # tsc --noEmit && vitest run && npm run lint
```
Run after ALL code changes.

**Required Tests:**
- All Zod schemas must have rejection tests (invalid inputs)
- Schema test example: reject non-UUID sessionId, empty message

**MVP Scope:**
- Happy path integration tests for core flows
- Manual testing for session file parsing edge cases
- Comprehensive automation deferred to post-MVP

---

## Code Quality & Style Rules

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| React components | PascalCase | `SessionList` |
| Component files | PascalCase.tsx | `SessionList.tsx` |
| Hooks | use + camelCase | `useSessionStore` |
| Utilities | camelCase | `formatTimestamp` |
| Constants | SCREAMING_SNAKE_CASE | `DB_VERSION` |
| Zod schemas | PascalCase + Schema | `SpawnRequestSchema` |
| Zustand stores | use + Name + Store | `useUIStore` |

**Database Naming:**
| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `sessions`, `file_edits` |
| Columns | snake_case | `session_id`, `created_at` |
| Timestamps | `{action}_at` | `created_at`, `updated_at` |
| Booleans | `is_{state}` | `is_archived`, `is_pinned` |

**Key File Locations:**
- Shared types: `src/shared/types/`
- DB schema: `src/shared/db/schema.sql`
- Main process: `src/main/`
- Renderer core: `src/renderer/src/core/`
- Plugin code: `plugins/{name}/src/`

**Style Rules:**
- ESLint + Prettier (electron-vite defaults)
- No emojis unless explicitly requested
- Comments only where logic isn't self-evident

---

## Development Workflow Rules

**Essential Commands:**
```bash
npm run dev          # Development with HMR
npm run validate     # tsc + vitest + lint (run after ALL changes)
npm run build        # Production build
npm run make         # Create unsigned DMG
```

**Database Schema (MVP):**
- Schema file: `src/shared/db/schema.sql`
- Version: `DB_VERSION` constant + SQLite `user_version` pragma
- MVP: Recreate DB on schema change (data loss acceptable)
- Always bump version when modifying schema

**Native Module Rebuild:**
```bash
npx electron-rebuild -f -w better-sqlite3  # After install or Electron upgrade
```

**Distribution (MVP):**
- Unsigned DMG for testing: `npm run make`
- Bypass Gatekeeper: `xattr -cr /Applications/Grimoire.app`
- Code signing deferred to pre-public release

---

## Critical Don't-Miss Rules

### Child Process Lifecycle (3-State Machine)

**States:** Idle → Working → Idle (or Error)

| Event | Transition |
|-------|------------|
| User sends message | Idle → Working |
| Process exits (code 0) | Working → Idle |
| Process exits (non-zero) | Working → Error |
| User sends new message | Error → Working |

**Spawn Pattern:**
```typescript
// Message sent via stdin JSON after spawn, not CLI argument
const child = spawn('claude', [
  '-p',
  '--input-format', 'stream-json',
  '--output-format', 'stream-json',
  '--verbose',
  '--replay-user-messages',
  '--dangerously-skip-permissions',
  '--resume', sessionId
], {
  env: {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(app.getPath('userData'), '.claude'),
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1'
  }
})

// Send message via stdin (not CLI argument)
child.stdin.write(JSON.stringify({
  type: 'user',
  message: { role: 'user', content: userMessage }
}))
child.stdin.end()
```

**Critical:** Each message = new process. Process exits after response. No persistent instances.

### IPC Anti-Patterns

```typescript
// WRONG - dot separator
ipcMain.handle('sessions.list', ...)

// WRONG - camelCase
ipcMain.handle('listSessions', ...)

// CORRECT - namespace:action with colon
ipcMain.handle('sessions:list', ...)
```

### Zustand Anti-Patterns

```typescript
// WRONG - mutating state directly
set((state) => {
  state.sessions.push(newSession)
  return state
})

// CORRECT - immutable update
set((state) => ({
  sessions: [...state.sessions, newSession]
}))

// WRONG - combining domains
const useStore = create((set) => ({
  ui: { ... },
  sessions: { ... }  // Should be separate stores
}))
```

### Database Anti-Patterns

```sql
-- WRONG
CREATE TABLE Sessions (       -- Should be lowercase
  sessionId TEXT,             -- Should be snake_case
  FolderPath TEXT             -- Should be snake_case
)

-- CORRECT
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  folder_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

### Session File Reading

- **Source of truth:** `.claude` folder for session existence
- **DB purpose:** App metadata, fast startup queries
- **Stream parsing:** NDJSON from stdout during execution (primary data source)
- **Read session file:** Only during startup sync to discover existing sessions
- **During active session:** All data comes from stream, NO file reading needed
- **Unified loader:** Same `loadConversation(path)` for main and sub-agent (startup sync only)

### Tab Types

| Type | CSS Class | When |
|------|-----------|------|
| Session | `.tab--session` | Main conversations |
| Sub-Agent | `.tab--subagent` | Nested agent views (purple tint) |
| File | `.tab--file` | File preview (blue tint) |

**Sub-agent tabs:** Hide chat input (`tab.type === 'subagent'`)

### Data Format Rules

| Data | DB Format | TypeScript Format |
|------|-----------|-------------------|
| Timestamps | Unix ms (INTEGER) | `number` |
| UUIDs | TEXT | `string` |
| Booleans | INTEGER 0/1 | `boolean` |
| JSON fields | snake_case | camelCase |

### Performance Patterns

- DB-first startup (query DB, show list, background scan `.claude`)
- Polling with 1-2s interval for MVP (events deferred)
- On-send spawn (no warmup, `-p` flag is fast enough)
- Sub-agent expansion < 100ms (client-side, no IPC)

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Run `npm run validate` after every change

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

---

_Last Updated: 2026-01-22_

