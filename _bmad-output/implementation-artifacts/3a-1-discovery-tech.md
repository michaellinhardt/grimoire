# Technical Discovery: Story 3a-1 Chat Input Component

## Technical Context

### Key File Paths

**Primary Implementation:**
- NEW: `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.tsx`
- NEW: `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInput.test.tsx`

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/index.ts` - Add exports
- `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/MiddlePanelContent.tsx` - Replace ChatInputPlaceholder
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/NewSessionView.tsx` - Replace ChatInputPlaceholder

**Files to Delete (after implementation):**
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.test.tsx`

**Reference Files:**
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx` - Current placeholder interface
- `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/cn.ts` - Class name utility
- `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/components/ThinkingIndicator.tsx` - Component pattern reference

### Component Dependencies

**External Libraries:**
- `react` - useState, useRef, useCallback, useEffect
- `lucide-react` - Send icon (already in project)

**Internal Dependencies:**
- `@renderer/shared/utils/cn` - For conditional Tailwind classes
- CSS variables from `index.css` - theming support

**No Additional Dependencies Required:**
- Native textarea (not Radix UI - no textarea primitive available)
- No new npm packages needed

### Patterns to Follow

**Component Structure Pattern (from ThinkingIndicator.tsx):**
```typescript
import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'

export interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  hasMessages?: boolean
}

export function ChatInput({ ... }: ChatInputProps): ReactElement {
  // Component implementation
}
```

**CSS Variable Usage Pattern:**
- `--bg-hover` for input background
- `--border` for container border
- `--text-primary` for input text
- `--text-muted` for placeholder
- `--accent` for send button
- `--radius-sm` for border radius

**State Management Pattern:**
- Local useState for controlled input value (no Zustand needed)
- Disabled state controlled via prop from parent

**Export Pattern (from index.ts):**
```typescript
export { ChatInput } from './ChatInput'
export type { ChatInputProps } from './ChatInput'
```

---

## Investigation Results

### Existing ChatInputPlaceholder Analysis

**Location:** `src/renderer/src/features/sessions/components/ChatInputPlaceholder.tsx`

**Current Interface:**
```typescript
interface ChatInputPlaceholderProps {
  autoFocus?: boolean  // For UX11 zero-click
  placeholder?: string // Default: "Type your message..."
}
```

**Current Usage in MiddlePanelContent.tsx (line 48):**
```tsx
{!isSubAgentTab && <ChatInputPlaceholder placeholder="Type your message..." />}
```
- autoFocus NOT passed (existing sessions don't auto-focus per AC3)

**Current Usage in NewSessionView.tsx (line 18):**
```tsx
<ChatInputPlaceholder autoFocus placeholder="Type your message..." />
```
- autoFocus=true passed (new sessions auto-focus per AC2/UX11)

### Integration Points

**MiddlePanelContent.tsx Integration:**
- Line 4: Import ChatInputPlaceholder
- Line 32: `isSubAgentTab` check (preserves hide logic for sub-agent tabs)
- Line 48: Renders ChatInputPlaceholder when not sub-agent

**NewSessionView.tsx Integration:**
- Line 2: Import ChatInputPlaceholder
- Line 18: Renders with autoFocus=true

### CSS Variables Available (from investigation)

From ThinkingIndicator and other components:
- `var(--bg-elevated)` - Elevated background
- `var(--bg-hover)` - Input hover/focus background
- `var(--text-muted)` - Muted text (placeholders)
- `var(--text-primary)` - Primary text
- `var(--border)` - Border color
- `var(--accent)` - Accent color (purple) for send button
- `var(--radius-sm)` - Small border radius

---

## Implementation Hints

### Auto-Expanding Textarea

Use scrollHeight calculation on input change:
```typescript
const adjustHeight = useCallback(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = 'auto' // Reset first
    const newHeight = Math.min(textareaRef.current.scrollHeight, 200)
    textareaRef.current.style.height = `${newHeight}px`
  }
}, [])
```

Constraints: `min-h-[40px]` and `max-h-[200px]` with `resize-none`

### Keyboard Handling

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
      // Reset height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }
  // Shift+Enter: default behavior (newline) allowed
}, [value, disabled, onSend])
```

### Auto-Focus Implementation

```typescript
useEffect(() => {
  if (autoFocus) {
    textareaRef.current?.focus()
  }
}, [autoFocus])
```

Run only on mount - empty dependency array NOT needed since autoFocus won't change.

### Dynamic Placeholder

```typescript
const effectivePlaceholder = placeholder ??
  (hasMessages ? 'Type anything to continue...' : 'Type your message...')
```

### Styling Approach

**Container:**
```tsx
<div className="h-auto border-t border-[var(--border)] flex items-end px-4 py-3 gap-2">
```

**Textarea:**
```tsx
<textarea
  className={cn(
    'flex-1 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 py-2',
    'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
    'resize-none min-h-[40px] max-h-[200px] focus:outline-none'
  )}
/>
```

**Send Button:**
```tsx
<button
  className={cn(
    'p-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white',
    'hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed'
  )}
  disabled={!value.trim() || disabled}
>
  <Send size={18} />
</button>
```

---

## Risk Areas

### 1. Sub-Agent Tab Hide Logic
- **Risk:** Breaking existing hide logic when replacing ChatInputPlaceholder
- **Mitigation:** Keep the `isSubAgentTab` check in MiddlePanelContent unchanged
- **Verification:** Test that sub-agent tabs still hide the input

### 2. Focus Management
- **Risk:** Focus stealing on tab switches or message list updates
- **Mitigation:** Only focus on mount when autoFocus=true, not on re-renders
- **Verification:** Test that clicking existing sessions doesn't auto-focus

### 3. Height Calculation Edge Cases
- **Risk:** Textarea height not resetting after send
- **Mitigation:** Explicitly reset height to 'auto' after clearing value
- **Verification:** Test rapid send sequences

### 4. Empty Message Prevention
- **Risk:** Sending whitespace-only messages
- **Mitigation:** Trim and validate before send, disable button when empty
- **Verification:** Test with spaces, tabs, newlines only

### 5. Two Integration Points
- **Risk:** Forgetting to update both MiddlePanelContent AND NewSessionView
- **Mitigation:** Story tasks explicitly list both files
- **Verification:** Test both new session and existing session flows

---

## Testing Strategy

### Unit Tests (ChatInput.test.tsx)

**Rendering Tests:**
1. Renders textarea and send button
2. Applies placeholder text correctly
3. Disabled state shows disabled styling

**Interaction Tests:**
4. Input value updates on change (controlled component)
5. Enter key calls onSend with trimmed message
6. Shift+Enter inserts newline (does not send)
7. Empty input disables send button
8. Button click sends message and clears input

**Auto-Focus Tests:**
9. Auto-focus when autoFocus=true
10. No auto-focus when autoFocus=false or undefined

**Placeholder Logic Tests:**
11. Shows "Type anything to continue..." when hasMessages=true
12. Shows "Type your message..." when hasMessages=false/undefined
13. Custom placeholder overrides default logic

**Auto-Expand Tests:**
14. Height increases with multi-line content
15. Height caps at max-h limit

### Integration Tests

**MiddlePanelContent.test.tsx:**
- ChatInput rendered for session tabs (not sub-agent)
- ChatInput hidden for sub-agent tabs
- autoFocus=false passed for existing sessions

**NewSessionView.test.tsx:**
- ChatInput rendered with autoFocus=true
- ChatInput rendered with hasMessages=false

### Testing Utilities Required

```typescript
// Mock setup
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

// For userEvent interactions
const user = userEvent.setup()

// For keyboard events
await user.type(input, 'Hello{Enter}')
await user.type(input, 'Hello{Shift>}{Enter}{/Shift}')
```

---

## Validation Checklist

Before marking story complete:
- [ ] `npm run validate` passes (typecheck + test + lint)
- [ ] ChatInput renders correctly in both MiddlePanelContent and NewSessionView
- [ ] Auto-focus works for new sessions only
- [ ] Sub-agent tabs still hide the input
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Dynamic placeholder changes based on hasMessages
- [ ] ChatInputPlaceholder deleted and no references remain

---

## References

- Story file: `_bmad-output/implementation-artifacts/3a-1-chat-input-component.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project context: `_bmad-output/planning-artifacts/project-context.md`

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
