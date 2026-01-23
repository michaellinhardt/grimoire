# Discovery File: Story 3a-3 Response Streaming Display

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **to see Claude's responses appear in real-time**,
So that **I can follow along as Claude thinks and responds**.

### Acceptance Criteria

**AC1: Response appears character-by-character (FR50)**
- Given CC is generating a response
- When tokens stream in
- Then the response appears character-by-character in a Claude message bubble
- And a cursor blink animation indicates active streaming
- And the bubble grows as content is added

**AC2: Auto-scroll during streaming**
- Given response is streaming
- When content extends beyond the visible area
- Then the conversation auto-scrolls smoothly to show new content
- And scrolling is not jarring or jumpy

**AC3: Manual scroll pauses auto-scroll**
- Given the user manually scrolls up during streaming
- When they are reading earlier content
- Then auto-scroll pauses to not interrupt reading
- And a "Jump to latest" indicator appears
- And clicking the indicator resumes auto-scroll

**AC4: Streaming completion state**
- Given streaming completes
- When the final token arrives
- Then the cursor animation stops
- And the message bubble shows complete state
- And the input box is re-enabled for next message

### Technical Requirements
- FR50: Send message to spawn/resume CC child process and see responses displayed after process completion
- AR19: NDJSON stream-json protocol via CC CLI with stream-json flags
- AR20: Stream state management for text and tool call assembly
- AR21: Response tracking with status (sending, streaming, complete, error)
- AR22: Handle known issue: final result event may not emit, use stop_reason instead

## Previous Story Learnings (from Stories 3a-1 and 3a-2)

### Files Created in Story 3a-1 (Chat Input Component)
- `src/renderer/src/features/sessions/components/ChatInput.tsx` - Chat input with auto-expand, Enter/Shift+Enter handling
- `src/renderer/src/features/sessions/components/ChatInput.test.tsx` - 18+ unit tests

### Files Created in Story 3a-2 (Message Send Flow)
- `src/renderer/src/features/sessions/hooks/useSendMessage.ts` - Message send logic hook
- `src/renderer/src/features/sessions/hooks/useSendMessage.test.ts` - 11 tests for send flow
- `src/renderer/src/features/sessions/store/useConversationStore.ts` - Local message state with optimistic updates
- `src/renderer/src/features/sessions/store/useConversationStore.test.ts` - Store tests
- `src/main/ipc/sessions.ts` - Updated with `sessions:sendMessage` IPC handler
- `src/shared/types/ipc.ts` - Added `SendMessageSchema`
- `src/preload/index.ts` - Exposed `sessions.sendMessage`
- `src/preload/index.d.ts` - Type declarations
- `src/renderer/src/shared/store/useUIStore.ts` - Added `updateTabSessionId` action

### Patterns Established in Previous Stories

**State Management:**
- `useConversationStore` for local message state with optimistic updates
- `useUIStore` for tab session state (idle/working/error)
- `useSendMessage` hook for coordinating message sending

**IPC Patterns:**
- `sessions:sendMessage` handler created (stub for CC spawn - Epic 3b implements actual spawn)
- IPC response pattern: `{ success: boolean, error?: string }`

**Error Handling:**
- Error state preserved until next action (no immediate transition to idle)
- System messages added to conversation for errors
- State machine: idle -> working -> (error | idle)

### Dev Notes from Story 3a-2
- ConversationView has `sessionState` prop for loading indicators
- ThinkingIndicator component exists for working state
- useConversationStore has `addSystemMessage` for error display
- useSendMessage returns `{ sendMessage, isSending }` for integration
- Error state needs acknowledgment flow (mentioned as Story 3a-3 responsibility)

## Architecture Relevance

### Applicable Patterns from architecture.md

**Stream Communication (AR19-AR22):**
```typescript
// Stream-JSON Flow from architecture:
// 1. User sends message
// 2. Spawn `claude` process with stream-json flags
// 3. Send message via stdin JSON, close stdin
// 4. Parse NDJSON from stdout in real-time (state = Working)
// 5. Capture session_id, UUIDs, costs, tool calls as they stream
// 6. Display messages in real-time as they arrive
// 7. On process exit, return to Idle state

// Stream Message Types:
{ type: 'system', subtype: 'init', session_id: string, tools: Tool[] }
{ type: 'assistant', message: { content: ContentBlock[] }, uuid: string }
{ type: 'user', message: { content: ContentBlock[] }, uuid: string }
{ type: 'result', subtype: 'success', result: string, session_id: string }
```

**Response Tracking (AR21):**
```typescript
interface ResponseState {
  sessionId: string
  status: 'idle' | 'sending' | 'streaming' | 'complete' | 'error'
  lastEventUuid: string | null
  error?: string
  startedAt?: Date
  completedAt?: Date
}
```

**Streaming Display Pattern:**
- Real-time updates as NDJSON events arrive
- Cursor animation during active streaming
- Auto-scroll with user override capability
- Completion detection via stop_reason or result event

### Constraints for This Story

1. **IPC Event-Based Updates:** Main process emits stream events, renderer subscribes
2. **ConversationView Integration:** Must work with existing ConversationView component
3. **useConversationStore:** Use existing store for message updates
4. **Session State Sync:** Update tab state during streaming lifecycle
5. **Story 3b Dependency:** Actual CC spawn happens in Epic 3b - this story focuses on renderer-side streaming display

### Existing Code to Reuse

1. **useConversationStore.ts** - Has `addMessage`, `updateMessage`, `getMessages`
2. **ConversationView.tsx** - Already renders messages, has `sessionState` prop
3. **MessageBubble.tsx** - Existing message display component
4. **ThinkingIndicator.tsx** - Shows during working state
5. **useUIStore.ts** - `updateTabSessionState` for lifecycle updates
6. **useSendMessage.ts** - Already sets state to 'working' on send

### File Structure

```
src/renderer/src/features/sessions/
├── components/
│   ├── ConversationView.tsx       # UPDATE - Add streaming message display
│   ├── StreamingMessage.tsx       # NEW - Message component with cursor animation
│   ├── StreamingMessage.test.tsx  # NEW - Tests
│   ├── JumpToLatest.tsx           # NEW - Auto-scroll resume indicator
│   └── JumpToLatest.test.tsx      # NEW - Tests
├── hooks/
│   ├── useStreamingScroll.ts      # NEW - Auto-scroll with pause detection
│   ├── useStreamingScroll.test.ts # NEW - Tests
│   └── useStreamEvents.ts         # NEW - Subscribe to stream events from main
├── store/
│   └── useConversationStore.ts    # UPDATE - Add streaming message support
```

```
src/preload/
└── index.ts                       # UPDATE - Add stream event listeners
```

```
src/main/
└── ipc/
    └── sessions.ts                # Will be updated in Epic 3b for actual streaming
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

1. **Streaming Message Component:**
   ```typescript
   interface StreamingMessageProps {
     content: string
     isStreaming: boolean
     messageUuid: string
   }

   // Shows cursor animation when isStreaming=true
   // Transitions to static when complete
   ```

2. **Auto-Scroll Behavior:**
   ```typescript
   // useStreamingScroll hook
   interface ScrollState {
     isAutoScrolling: boolean
     showJumpToLatest: boolean
   }

   // Auto-scroll pauses when:
   // - User scrolls up manually
   // - User is more than 100px from bottom

   // Resume when:
   // - User clicks "Jump to latest"
   // - User scrolls back to bottom
   ```

3. **Stream Event Subscription:**
   ```typescript
   // Preload exposes event listeners
   window.grimoireAPI.sessions.onStreamChunk((event) => {
     // { sessionId, content, uuid, type: 'text' | 'tool_use' }
   })

   window.grimoireAPI.sessions.onStreamComplete((event) => {
     // { sessionId, uuid, success: boolean }
   })
   ```

4. **Message State During Streaming:**
   ```typescript
   interface StreamingMessageState {
     uuid: string
     content: string
     isComplete: boolean
     role: 'assistant'
   }

   // In useConversationStore:
   // - startStreamingMessage(sessionId, uuid)
   // - appendStreamContent(sessionId, uuid, content)
   // - completeStreamingMessage(sessionId, uuid)
   ```

### CSS Variables Reference

```css
--text-primary: Primary text color
--text-muted: Muted text (timestamps, cursor)
--bg-elevated: Message bubble background
--accent: Cursor blink color
--border: Subtle borders
```

### Testing Approach

1. **Unit Tests (StreamingMessage.test.tsx):**
   - Test: renders content correctly
   - Test: shows cursor animation when streaming
   - Test: hides cursor when complete
   - Test: handles incremental content updates

2. **Hook Tests (useStreamingScroll.test.ts):**
   - Test: auto-scrolls on new content
   - Test: pauses on manual scroll up
   - Test: shows jump indicator when paused
   - Test: resumes on jump click

3. **Integration Tests:**
   - Test: stream events update conversation
   - Test: completion transitions state to idle
   - Test: error handling during stream

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.3: Response Streaming Display]
- [Source: _bmad-output/planning-artifacts/architecture.md#CC Communication]
- [Source: _bmad-output/planning-artifacts/architecture.md#Stream-JSON Flow]

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
