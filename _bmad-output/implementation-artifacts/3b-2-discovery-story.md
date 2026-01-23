# Discovery File: Story 3b-2 NDJSON Stream Parser

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **CC output to be parsed and displayed in real-time**,
So that **I see properly formatted messages, tool calls, and results as they stream**.

### Acceptance Criteria

**AC1: Real-time NDJSON parsing (FR64)**
- Given CC is running and producing output
- When NDJSON events arrive on stdout
- Then each line is parsed as a JSON object in real-time
- And events are processed based on their type (system, user, assistant, result)

**AC2: Session ID capture from init message (FR67c)**
- Given the first message arrives (type: system, subtype: init)
- When the init event is received
- Then the session_id is captured from the message
- And the session is associated with this ID (no file reading needed)

**AC3: Checkpoint UUID capture (FR67d)**
- Given user messages arrive with --replay-user-messages
- When a user message event is received
- Then the uuid field is captured as a checkpoint/rewind point
- And checkpoints are stored for potential rewind operations

**AC4: Metadata capture during streaming (FR67e)**
- Given cost/token data is included in the stream
- When costUSD or token fields are present
- Then the metadata is captured and stored to session_metadata table
- And the info panel can display cumulative totals

**AC5: Stream completion handling**
- Given the stream ends with a result message
- When the result event (subtype: success) arrives
- Then the session returns to Idle state
- And no file reading is needed (all data came from stream)

**AC6: Unified conversation loader (FR67a, FR67b)**
- Given the unified conversation loader is used
- When loading conversation data at startup sync
- Then the same loader handles both main sessions and sub-agent conversations
- And conversation type is determined from file path structure

### Technical Requirements
- FR64: System parses NDJSON stream in real-time during process execution
- FR67a: System uses unified conversation loader for both main sessions and sub-agent conversations
- FR67b: System determines conversation type (main vs sub-agent) from file path, not loader logic
- FR67c: System captures session ID from stream init message (not from file system)
- FR67d: System captures user message UUIDs from stream for checkpoint capability
- FR67e: System stores session metadata (tokens, cost) to database during streaming
- AR19: NDJSON stream-json protocol via CC CLI
- AR20: Stream state management for text and tool call assembly
- AR21: Response tracking with status (sending, streaming, complete, error)
- AR22: Handle known issue: final result event may not emit, use stop_reason instead

## Previous Story Learnings (from Story 3b-1 and Epic 3a)

### Infrastructure from Story 3b-1 (CC Child Process Spawning)
- `src/main/cc/spawner.ts` - CC process spawning with proper env vars
- `src/main/process-registry.ts` - Tracks active processes by sessionId
- Process spawned with `--output-format stream-json` flag
- stdin receives user message, stdout emits NDJSON stream

### Stream Events Already Wired (from Epic 3a)
Preload exposes these event channels:
```typescript
// src/preload/index.ts
onStreamChunk: (callback) => void  // { sessionId, type: 'text', content, uuid? }
onStreamTool: (callback) => void   // { sessionId, type: 'tool_use'|'tool_result', toolUse?, toolResult? }
onStreamEnd: (callback) => void    // { sessionId, success, error?, aborted?, totalTokens?, costUsd? }
```

### IPC Schemas Defined (from Epic 3a)
```typescript
// src/shared/types/ipc.ts
StreamChunkEventSchema    // Text content events
StreamToolEventSchema     // Tool use/result events
StreamEndEventSchema      // Stream completion events
```

### Renderer Hooks Ready (from Epic 3a)
- `useStreamEvents.ts` - Subscribes to stream events
- `useConversationStore.ts` - Updates messages during streaming
- Hooks expect events to be emitted from main process

### Dev Notes from Epic 3a
- Stream event listeners already wired in preload
- useStreamEvents hook subscribes and updates conversation store
- StreamingMessage component renders with cursor animation
- Auto-scroll behavior handled by useStreamingScroll hook

## Architecture Relevance

### Stream Message Types (from architecture.md)

```typescript
// First message - contains session ID
{ type: 'system', subtype: 'init', session_id: string, tools: Tool[] }

// User message (with --replay-user-messages) - uuid is checkpoint
{ type: 'user', message: { content: ContentBlock[] }, uuid: string }

// Assistant response with content
{ type: 'assistant', message: { content: ContentBlock[] }, uuid: string }

// Final message - summary
{ type: 'result', subtype: 'success', result: string, session_id: string }
```

### Stream Parsing Pattern (from architecture.md)

```typescript
import * as readline from 'readline'
import type { Readable } from 'stream'

async function* parseStream(sessionId: string, stdout: Readable): AsyncGenerator<StreamEvent> {
  const rl = readline.createInterface({ input: stdout })

  for await (const line of rl) {
    const msg = JSON.parse(line)

    // Capture session ID from init
    if (msg.type === 'system' && msg.subtype === 'init') {
      yield { type: 'init', sessionId: msg.session_id }
    }

    // Capture checkpoints from user messages
    if (msg.type === 'user' && msg.uuid) {
      yield { type: 'checkpoint', uuid: msg.uuid }
    }

    // Yield content for display
    if (msg.type === 'assistant') {
      yield { type: 'content', message: msg.message, uuid: msg.uuid }
    }

    // Capture cost metadata
    if (msg.costUSD !== undefined) {
      yield { type: 'cost', cost: msg.costUSD }
    }
  }
}
```

### Content Block Types

```typescript
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

interface TextBlock {
  type: 'text'
  text: string
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string          // e.g., "toolu_01HXYyux..."
  name: string        // e.g., "Read", "Write", "Edit", "Task"
  input: Record<string, unknown>
}

interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string // Matches ToolUseBlock.id
  content: string
  is_error?: boolean
}
```

### Constraints for This Story

1. **NDJSON Format:** Each line is a complete JSON object
2. **Partial Messages:** Assistant text may arrive in multiple chunks
3. **Tool Call Assembly:** Tool use and tool result arrive as separate events
4. **Error Handling:** Must handle malformed JSON, stream interruption
5. **Memory:** Don't accumulate entire stream in memory
6. **Known Issue (AR22):** Final result event may not emit - use stop_reason or process exit

### Existing Code to Extend

1. **spawner.ts** - Add stdout stream parsing after spawn
2. **processRegistry** - Already tracks processes, no changes needed
3. **sessions:sendMessage** - May need to wire parser to spawned process
4. **Stream events** - Already defined in preload, need to emit from main

### File Structure

```
src/main/
├── cc/
│   ├── spawner.ts              # UPDATE - Wire stream parser to spawned process
│   ├── stream-parser.ts        # NEW - NDJSON parsing and event emission
│   ├── stream-parser.test.ts   # NEW - Tests
│   └── types.ts                # UPDATE - Stream message types
├── ipc/
│   └── sessions.ts             # UPDATE - Wire parser, emit events to renderer
```

## Git Context

### Recent Relevant Commits
- `cb2735c` - Fix HIGH severity: Tool result data loss from out-of-order streaming events
- `de88909` - Fix incomplete streaming completion logic (Story 3a-3, Review Attempt 2)
- `a69e124` - sprint-runner opti not bad, batch 2 stories
- `dd2fe8e` - code-review: 3a-2-message-send-flow attempt 2, 5 issues fixed

### Key Files for Reference
- `src/preload/index.ts` - Stream event listener definitions
- `src/renderer/src/features/sessions/hooks/useStreamEvents.ts` - Subscribes to stream events
- `src/renderer/src/features/sessions/store/useConversationStore.ts` - Handles streamed content
- `src/shared/types/ipc.ts` - Stream event schemas

## Implementation Notes

### Key Technical Decisions

1. **Stream Parser Module:**
   ```typescript
   // src/main/cc/stream-parser.ts
   import * as readline from 'readline'
   import type { ChildProcess } from 'child_process'
   import type { BrowserWindow } from 'electron'

   interface StreamParserOptions {
     sessionId: string
     child: ChildProcess
     mainWindow: BrowserWindow | null
     onSessionIdCaptured?: (capturedId: string) => void
     onCheckpoint?: (uuid: string) => void
     onMetadata?: (tokens: { input: number; output: number }, cost: number) => void
   }

   export function attachStreamParser(options: StreamParserOptions): void {
     const { sessionId, child, mainWindow, onSessionIdCaptured, onCheckpoint, onMetadata } = options

     if (!child.stdout) {
       console.error('No stdout available on child process')
       return
     }

     const rl = readline.createInterface({
       input: child.stdout,
       crlfDelay: Infinity
     })

     let currentTextBuffer = ''
     let totalInputTokens = 0
     let totalOutputTokens = 0
     let totalCost = 0

     rl.on('line', (line) => {
       try {
         const event = JSON.parse(line)

         // Handle init message - capture session ID
         if (event.type === 'system' && event.subtype === 'init') {
           onSessionIdCaptured?.(event.session_id)
         }

         // Handle user message - capture checkpoint UUID
         if (event.type === 'user' && event.uuid) {
           onCheckpoint?.(event.uuid)
         }

         // Handle assistant message
         if (event.type === 'assistant' && event.message) {
           for (const block of event.message.content || []) {
             if (block.type === 'text') {
               // Emit text chunk
               mainWindow?.webContents.send('stream:chunk', {
                 sessionId,
                 type: 'text',
                 content: block.text,
                 uuid: event.uuid
               })
             } else if (block.type === 'tool_use') {
               // Emit tool use
               mainWindow?.webContents.send('stream:tool', {
                 sessionId,
                 type: 'tool_use',
                 toolUse: block
               })
             }
           }

           // Capture token usage
           if (event.message.usage) {
             totalInputTokens += event.message.usage.input_tokens || 0
             totalOutputTokens += event.message.usage.output_tokens || 0
           }
         }

         // Handle tool result (in user message)
         if (event.type === 'user' && event.message) {
           const content = event.message.content
           if (Array.isArray(content)) {
             for (const block of content) {
               if (block.type === 'tool_result') {
                 mainWindow?.webContents.send('stream:tool', {
                   sessionId,
                   type: 'tool_result',
                   toolResult: block
                 })
               }
             }
           }
         }

         // Handle result message
         if (event.type === 'result') {
           if (event.costUSD !== undefined) {
             totalCost = event.costUSD
           }
         }

       } catch (parseError) {
         console.error('Failed to parse NDJSON line:', line, parseError)
       }
     })

     rl.on('close', () => {
       // Stream ended - emit final metadata
       onMetadata?.({ input: totalInputTokens, output: totalOutputTokens }, totalCost)
     })

     // Handle stderr for errors
     child.stderr?.on('data', (data) => {
       console.error('CC stderr:', data.toString())
     })
   }
   ```

2. **Integration with Spawner:**
   ```typescript
   // In spawner.ts, after spawning:
   attachStreamParser({
     sessionId,
     child,
     mainWindow: getMainWindow(),
     onSessionIdCaptured: (capturedId) => {
       // Update session ID mapping if needed (for new sessions)
       console.log('Session ID from CC:', capturedId)
     },
     onCheckpoint: (uuid) => {
       // Store checkpoint for rewind capability
       checkpoints.set(uuid, sessionId)
     },
     onMetadata: async (tokens, cost) => {
       // Update session_metadata in database
       await upsertMetadata({
         sessionId,
         inputTokens: tokens.input,
         outputTokens: tokens.output,
         costUsd: cost
       })
     }
   })
   ```

3. **Process Exit Handling:**
   ```typescript
   // In spawner.ts
   child.on('exit', (code, signal) => {
     processRegistry.delete(sessionId)

     mainWindow?.webContents.send('stream:end', {
       sessionId,
       success: code === 0,
       error: code !== 0 ? `Process exited with code ${code}` : undefined,
       aborted: signal === 'SIGTERM' || signal === 'SIGKILL',
       totalTokens: { input: totalInputTokens, output: totalOutputTokens },
       costUsd: totalCost
     })
   })
   ```

4. **Error Event Emission:**
   ```typescript
   // Handle spawn errors and stream errors
   child.on('error', (err) => {
     processRegistry.delete(sessionId)
     mainWindow?.webContents.send('stream:end', {
       sessionId,
       success: false,
       error: err.message
     })
   })
   ```

### Testing Approach

1. **Unit Tests (stream-parser.test.ts):**
   - Test: parses init message and captures session_id
   - Test: emits checkpoint for user messages with uuid
   - Test: emits stream:chunk for assistant text blocks
   - Test: emits stream:tool for tool_use blocks
   - Test: emits stream:tool for tool_result blocks
   - Test: accumulates token counts from usage fields
   - Test: captures costUSD from result message
   - Test: handles malformed JSON gracefully
   - Test: emits close callback with totals

2. **Integration Tests:**
   - Test: spawned process has parser attached
   - Test: stream events reach renderer
   - Test: session_metadata updated after stream ends
   - Test: process exit emits stream:end event

### CSS Variables Reference (for renderer integration)

```css
--text-streaming: Streaming text color (same as primary)
--bg-streaming: Background for streaming message bubble
--cursor-blink: Cursor animation timing
```

### Dependencies

- **Story 3b-1 (CC Child Process Spawning):** Provides the spawned process to parse
- **Epic 3a:** Provides renderer infrastructure for displaying streamed content

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3b.2: NDJSON Stream Parser]
- [Source: _bmad-output/planning-artifacts/architecture.md#Stream Parsing]
- [Source: _bmad-output/planning-artifacts/architecture.md#Claude Code JSONL Format Specification]

---

# Project Context

See `_bmad-output/planning-artifacts/project-context.md` for technology stack, coding rules, and patterns.

Key points relevant to this story:
- Node.js `readline` module for line-by-line parsing
- NDJSON = Newline-delimited JSON (one JSON object per line)
- Electron `webContents.send()` for main -> renderer events
- Process stdout is a Node.js Readable stream
- Use `crlfDelay: Infinity` for cross-platform line handling

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
