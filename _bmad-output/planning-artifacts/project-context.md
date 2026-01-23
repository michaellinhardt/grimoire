---
project_name: 'grimoire'
user_name: 'Teazyou'
date: '2026-01-23'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
existing_patterns_found: 47
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Platform

| Technology     | Version   | Purpose                    |
| -------------- | --------- | -------------------------- |
| Electron       | ^39.2.6   | Desktop app framework      |
| electron-vite  | ^5.0.0    | Build tool with Vite       |
| React          | ^19.2.1   | UI framework               |
| TypeScript     | ^5.9.3    | Type-safe JavaScript       |
| Vite           | ^7.2.6    | Frontend bundler           |
| better-sqlite3 | ^12.6.2   | SQLite database binding    |
| Tailwind CSS   | ^4.1.18   | Utility-first CSS (v4!)    |
| Zod            | ^4.3.5    | Runtime schema validation  |
| Zustand        | ^5.0.10   | Lightweight state manager  |
| Vitest         | ^4.0.17   | Test framework             |

### Key Dependencies

| Package                      | Version  | Purpose                    |
| ---------------------------- | -------- | -------------------------- |
| @radix-ui/react-*            | Various  | Headless UI components     |
| @electron-toolkit/utils      | ^4.0.0   | Electron utilities         |
| @electron-toolkit/preload    | ^3.0.2   | Preload script helpers     |
| react-resizable-panels       | ^4.4.1   | Resizable panel layout     |
| lucide-react                 | ^0.562.0 | Icon library               |
| clsx + tailwind-merge        | Latest   | Class name utilities       |

### Critical Version Notes

- **Tailwind CSS v4**: Uses `@tailwindcss/vite` plugin, NOT v3 config format
- **Zod v4**: Uses new API (`z.string()` not `z.coerce`)
- **React 19**: Supports new features but avoid deprecated patterns
- **Electron 39**: Use contextBridge for IPC, sandbox mode considerations

---

## Critical Implementation Rules

### Electron Architecture Rules

1. **Process Separation is Mandatory**
   - Main process: `src/main/` - Node.js, full system access
   - Preload: `src/preload/` - Bridge layer, contextBridge only
   - Renderer: `src/renderer/` - React app, no Node.js access

2. **IPC Channel Naming Convention**
   ```
   namespace:action
   ```
   - Examples: `sessions:list`, `sessions:spawn`, `dialog:selectFolder`
   - Namespace is singular, lowercase
   - Action is camelCase verb

3. **IPC Validation Pattern**
   - Validate ALL inputs at IPC boundary using Zod schemas
   - Preload stays thin - no validation logic
   - Main process handlers: `SomeSchema.parse(data)` first line
   ```typescript
   // CORRECT - main/ipc/sessions.ts
   ipcMain.handle('sessions:terminate', async (_, data: unknown) => {
     const { sessionId } = TerminateRequestSchema.parse(data) // Always first
     // ... rest of handler
   })
   ```

4. **Preload API Exposure**
   - Use `contextBridge.exposeInMainWorld('grimoireAPI', {...})`
   - Keep preload thin - just IPC wrapper functions
   - Type definitions in `src/preload/index.d.ts`

### Database Rules

1. **Schema Location**: `src/shared/db/schema.sql` (imported via `?raw`)

2. **Version Tracking**
   - Bump `VERSION` comment when modifying schema
   - DB_VERSION constant in `src/main/db.ts` must match
   - Schema changes trigger database recreation (MVP approach)

3. **Naming Conventions**
   | Element      | Convention              | Example                    |
   | ------------ | ----------------------- | -------------------------- |
   | Tables       | snake_case, plural      | `sessions`, `file_edits`   |
   | Columns      | snake_case              | `folder_path`, `created_at`|
   | Primary keys | `id` or `{table}_id`    | `id`, `session_id`         |
   | Foreign keys | `{referenced_table}_id` | `session_id`               |
   | Timestamps   | `{action}_at`           | `created_at`, `updated_at` |
   | Booleans     | `is_{state}` or bare    | `is_hidden`, `archived`    |

4. **TypeScript Transformation**
   - DB rows use snake_case
   - TypeScript interfaces use camelCase
   - Always transform at the service layer
   ```typescript
   // CORRECT transformation
   function toSession(row: DBSessionRow): Session {
     return {
       id: row.id,
       folderPath: row.folder_path,  // snake_case -> camelCase
       createdAt: row.created_at,
       isPinned: Boolean(row.is_pinned)  // INTEGER -> boolean
     }
   }
   ```

5. **Transactions for Multi-Statement Operations**
   ```typescript
   const transaction = db.transaction(() => {
     // Multiple statements here
   })
   transaction() // Execute atomically
   ```

### State Management Rules

1. **Zustand Store Pattern**
   - Separate stores per domain (`useSessionStore`, `useUIStore`)
   - Stores in: `src/renderer/src/shared/store/` or `features/*/store/`
   - Naming: `use{Domain}Store.ts`

2. **Store Structure**
   ```typescript
   interface SomeState {
     // State values
     items: Item[]
     isLoading: boolean
     error: string | null

     // Actions - always functions
     loadItems: () => Promise<void>
     clearError: () => void
   }

   export const useSomeStore = create<SomeState>((set, get) => ({
     items: [],
     isLoading: false,
     error: null,

     loadItems: async () => {
       set({ isLoading: true, error: null })
       try {
         const items = await window.grimoireAPI.some.list()
         set({ items, isLoading: false })
       } catch (error) {
         set({ error: error.message, isLoading: false })
       }
     },

     clearError: () => set({ error: null })
   }))
   ```

3. **State Updates**
   - Use `set()` with partial state (immutable)
   - For complex updates: `set((state) => ({ ... }))`
   - NEVER mutate state directly

4. **Selectors Pattern**
   - Export selector functions alongside store
   - Keep selectors pure (no side effects)
   ```typescript
   export const selectActiveItems = (items: Item[]): Item[] => {
     return items.filter(i => i.active)
   }
   ```

### Component & File Organization

1. **File Naming**
   | Type           | Convention              | Example                    |
   | -------------- | ----------------------- | -------------------------- |
   | React component| `{Name}.tsx`            | `SessionList.tsx`          |
   | Test file      | `{Name}.test.tsx`       | `SessionList.test.tsx`     |
   | Zustand store  | `use{Name}Store.ts`     | `useSessionStore.ts`       |
   | Hook           | `use{Name}.ts`          | `usePolling.ts`            |
   | Utility        | `{name}.ts`             | `formatters.ts`            |
   | Types          | `types.ts` or `{name}.ts`| `types.ts`, `ipc.ts`       |

2. **Component Structure**
   - Features in: `src/renderer/src/features/{feature}/`
   - Core UI in: `src/renderer/src/core/{area}/`
   - Shared in: `src/renderer/src/shared/{type}/`

3. **Test Colocation**
   - Tests live next to implementation files
   - Same directory, `.test.ts` or `.test.tsx` suffix

4. **Path Alias**
   - Use `@renderer/*` for renderer imports
   - Configured in `tsconfig.web.json` and `electron.vite.config.ts`
   ```typescript
   import { useUIStore } from '@renderer/shared/store/useUIStore'
   ```

### Testing Rules

1. **Test Environment Matching**
   - Renderer tests: jsdom environment (default)
   - Main/preload tests: node environment
   - Configured via `environmentMatchGlobs` in `vitest.config.ts`

2. **Test Setup**
   - Global setup in `src/test-setup.ts`
   - Globals enabled (`describe`, `it`, `expect` without imports)

3. **Component Testing Pattern**
   ```typescript
   import { render, screen } from '@testing-library/react'
   import userEvent from '@testing-library/user-event'

   describe('ComponentName', () => {
     it('should render correctly', () => {
       render(<ComponentName />)
       expect(screen.getByRole('button')).toBeInTheDocument()
     })
   })
   ```

4. **Mocking IPC**
   ```typescript
   vi.mock('@renderer/...', () => ({
     useSessionStore: vi.fn(() => ({
       sessions: [],
       loadSessions: vi.fn()
     }))
   }))
   ```

### Code Style Rules

1. **Prettier Configuration** (from `.prettierrc.yaml`)
   - Single quotes: `true`
   - Semicolons: `false`
   - Print width: 100
   - Trailing commas: none

2. **ESLint Configuration**
   - TypeScript strict mode via `@electron-toolkit/eslint-config-ts`
   - React hooks rules enabled
   - React Refresh for HMR support

3. **Import Order**
   - External packages first
   - Internal absolute paths (`@renderer/...`)
   - Relative paths last
   - Types can be separate import statement

### Critical Don't-Miss Rules

1. **NEVER Access Node.js APIs in Renderer**
   - No `fs`, `path`, `child_process` in renderer code
   - All system operations go through IPC

2. **NEVER Store Sensitive Data Unencrypted**
   - Database at `~/.grimoire/grimoire.db`
   - No API keys in code
   - Trust local environment (single-user app)

3. **ALWAYS Validate IPC Inputs**
   - Use Zod schemas at IPC boundary
   - Never trust renderer input

4. **ALWAYS Use Transactions for Multi-Row Operations**
   - Prevents partial state on errors
   - better-sqlite3 transactions are synchronous

5. **Child Process Management**
   - 3-state machine: Idle -> Working -> Error
   - Processes spawn per message, exit after response
   - Process registry in `src/main/process-registry.ts`
   - Graceful shutdown on app quit (SIGTERM, then SIGKILL)

6. **Session File Handling**
   - Claude Code sessions at `CLAUDE_CONFIG_DIR/projects/{hash}/{uuid}.jsonl`
   - Parse NDJSON format
   - Sub-agents at `{session}/subagents/agent-{6-char}.jsonl`

7. **React Performance**
   - Sub-agent expansion must be < 100ms
   - Use React.memo sparingly, measure first
   - Avoid inline object/function props that cause re-renders

8. **Error Handling Pattern**
   ```typescript
   // Renderer - catch and update state
   try {
     await window.grimoireAPI.sessions.spawn(...)
   } catch (error) {
     console.error('Spawn failed:', error)
     useStore.getState().setError(error.message)
   }

   // Main - let errors propagate (IPC rejects)
   ipcMain.handle('channel', async (_, data) => {
     const validated = Schema.parse(data) // Throws on invalid
     return await doWork(validated) // Throws on failure
   })
   ```

### Development Workflow

1. **Commands**
   - `npm run dev` - Start development with HMR
   - `npm run validate` - Full check: typecheck + test + lint
   - `npm run test` - Run tests once
   - `npm run test:watch` - Run tests in watch mode
   - `npm run build:mac` - Build macOS app

2. **TypeScript Check**
   - Two configs: `tsconfig.node.json` (main/preload), `tsconfig.web.json` (renderer)
   - Run both: `npm run typecheck`

3. **Database Changes**
   - Edit `src/shared/db/schema.sql`
   - Bump VERSION comment
   - Update DB_VERSION in `src/main/db.ts`
   - Database recreates on version mismatch (MVP approach)

4. **Adding IPC Channels**
   1. Add Zod schema in `src/shared/types/ipc.ts`
   2. Add handler in `src/main/ipc/{namespace}.ts`
   3. Add preload method in `src/preload/index.ts`
   4. Update type definitions in `src/preload/index.d.ts`

---

## Architecture Quick Reference

```
grimoire/
├── src/
│   ├── main/           # Electron main process (Node.js)
│   │   ├── db.ts       # SQLite initialization
│   │   ├── ipc/        # IPC handlers by namespace
│   │   └── sessions/   # Session scanning, loading
│   ├── preload/        # Context bridge (IPC wrapper)
│   ├── renderer/       # React app
│   │   └── src/
│   │       ├── core/   # Shell, loading, settings
│   │       ├── features/   # Feature modules
│   │       └── shared/ # Hooks, stores, utils
│   └── shared/
│       ├── types/      # Shared types + Zod schemas
│       └── db/         # SQL schema
└── resources/          # App icons
```

### Data Flow

```
User Action → Renderer Component → Zustand Store
                                         ↓
                                    grimoireAPI.{namespace}.{action}()
                                         ↓
                                    Preload (IPC invoke)
                                         ↓
                                    Main Process Handler
                                         ↓
                                    Zod Validation → Database/System
```

---

## Reference Documents

For deeper context, refer to:
- **Architecture**: `_bmad-output/planning-artifacts/architecture.md`
- **PRD**: `_bmad-output/planning-artifacts/prd.md`
- **DB Schema**: `src/shared/db/schema.sql`
- **IPC Types**: `src/shared/types/ipc.ts`
