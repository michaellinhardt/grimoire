# Discovery File: Story 3a-1 Chat Input Component

## Story Requirements (from Epics)

### User Story Statement
As a **user**,
I want **a chat input area to compose and send messages**,
So that **I can communicate with Claude Code naturally**.

### Acceptance Criteria

**AC1: Chat input area is displayed at bottom of conversation view (FR47)**
- Given a session is open in the middle panel
- When the conversation view loads
- Then a chat input area is displayed at the bottom
- And the input has a send button [->] on the right
- And the input auto-expands as text is entered (up to max height)

**AC2: Auto-focus for new sessions (UX11)**
- Given a new session is opened
- When the session tab becomes active
- Then the input box is automatically focused (zero-click principle)
- And the user can start typing immediately

**AC3: No auto-focus for existing sessions**
- Given an existing session is selected
- When the session loads
- Then the input is NOT auto-focused (user must click to engage)
- And the conversation scrolls to the latest message

**AC4: Multi-line input support (FR48)**
- Given the user is typing in the input
- When they press Shift+Enter
- Then a new line is inserted
- And the input expands to accommodate multiple lines

**AC5: Send on Enter**
- Given the user is typing in the input
- When they press Enter (without Shift)
- Then the message is sent
- And the input is cleared

**AC6: Dynamic placeholder for started sessions (FR60)**
- Given a session has been started (has messages)
- When the input is empty
- Then the placeholder text shows "Type anything to continue..."

**AC7: Default placeholder for new sessions**
- Given a new session (no messages)
- When the input is empty
- Then the placeholder text shows "Type your message..."

### Technical Requirements
- FR47: Chat input area at bottom of conversation view
- FR48: Multi-line paste support
- FR60: Placeholder text varies by session state
- UX11: Zero-click to first action (auto-focus for new sessions)

## Previous Story Learnings (from Epic 2c)

### Files Created
- `src/renderer/src/features/sessions/components/utils/timelineUtils.ts` - Utility pattern for data conversion
- `src/renderer/src/features/sessions/hooks/useTimelineEvents.ts` - Hook pattern for derived data
- `src/renderer/src/features/sessions/hooks/useActiveTimelineEvent.ts` - Hook pattern for DOM observation

### Patterns Used
- **Component Location:** Feature components in `src/renderer/src/features/sessions/components/`
- **Hooks Location:** Feature hooks in `src/renderer/src/features/sessions/hooks/`
- **State Management:** Zustand for UI state, stores in `shared/store/` or feature-specific `store/`
- **CSS Variables:** Use `var(--text-muted)`, `var(--border)`, etc. for theming
- **cn() utility:** For conditional Tailwind classes
- **Test Colocation:** Tests next to source files

### Dev Notes from Epic 2c
- IntersectionObserver mock added to test-setup.ts for DOM observation tests
- useUIStore has scroll position persistence already implemented
- ConversationView already tracks message refs for scroll-to-event

## Architecture Relevance

### Applicable Patterns from architecture.md

**Component Structure:**
- Feature-based organization: `src/renderer/src/features/sessions/components/`
- Colocated tests: `ChatInput.test.tsx` next to `ChatInput.tsx`
- Functional components with explicit `ReactElement` return type

**State Management:**
- Zustand for UI state (input focus, input value if needed)
- Session state from `useSessionStore`
- Tab state from `useUIStore`

**IPC Patterns (for Epic 3a-2):**
- Channel naming: `sessions:sendMessage` for sending
- Zod validation at IPC boundary in main process
- SpawnRequestSchema already defined in `src/shared/types/ipc.ts`

### Constraints for This Story

1. **Replace ChatInputPlaceholder** - Component at `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx` is a placeholder that must be replaced with the actual ChatInput
2. **Integration with ConversationView** - ChatInput will be placed below ConversationView in MiddlePanelContent
3. **Focus Management** - Must coordinate with tab switching to handle auto-focus correctly
4. **Textarea Component** - Use native textarea with Tailwind styling (not Radix - no textarea primitive)

### Existing Code to Reuse

1. **ChatInputPlaceholder.tsx** - Provides the interface contract (autoFocus prop, placeholder prop)
2. **ConversationView.tsx** - Already has sessionId and sessionState props
3. **useUIStore.ts** - Has `activeTabId` and tab state management
4. **MiddlePanelContent.tsx** - Where ChatInput will be rendered
5. **cn() utility** - For conditional class management

### File Structure

```
src/renderer/src/features/sessions/
├── components/
│   ├── ChatInput.tsx           # NEW - Replace ChatInputPlaceholder
│   ├── ChatInput.test.tsx      # NEW - Colocated tests
│   ├── ChatInputPlaceholder.tsx # REMOVE after ChatInput is complete
│   └── ... (existing)
```

## Git Context

### Recent Relevant Commits
- `89c0cf7` - feat: session scanner and database sync (story 2a-1)
- `e7c04a2` - story 1 ok, story 2 plan, workflow auto
- `31c93a9` - story 1 code

### Files Modified in Epic 2c (for reference)
- `src/renderer/src/features/sessions/components/EventTimelineItem.tsx`
- `src/renderer/src/core/shell/RightPanelContent.tsx`
- `src/renderer/src/shared/store/useUIStore.ts`
- `src/renderer/src/features/sessions/components/ConversationView.tsx`

## Implementation Notes

### Key Technical Decisions

1. **Input Component:** Use native `<textarea>` with auto-resize behavior
2. **Auto-resize Logic:** Set height based on scrollHeight on each change
3. **Max Height:** Cap at reasonable height (e.g., 200px or 8 lines)
4. **Focus Detection:** Use tab type and message count to determine auto-focus
5. **Send Action:** Call IPC `sessions:sendMessage` (implemented in Story 3a-2)

### CSS Variables Reference

```css
--text-primary: Primary text color
--text-muted: Muted/secondary text (placeholder)
--bg-base: Base background
--bg-elevated: Elevated surface
--bg-hover: Hover state
--accent: Purple accent color (send button)
--border: Border color
```

### Testing Approach

1. **Unit Tests:**
   - Render with different props (autoFocus, placeholder, hasMessages)
   - Test Enter key sends message
   - Test Shift+Enter inserts newline
   - Test auto-resize behavior

2. **Integration Tests:**
   - Test focus behavior on new session tab
   - Test placeholder text changes based on message count

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3a.1: Chat Input Component]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX11 Zero-click]

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
