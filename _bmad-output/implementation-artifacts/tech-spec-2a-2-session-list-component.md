---
title: 'Session List Component'
slug: '2a-2-session-list-component'
created: '2026-01-22'
status: 'ready-for-development'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - React
  - TypeScript
  - Zustand
  - Radix UI (ScrollArea)
  - Tailwind CSS v4
  - Electron IPC
  - Zod
  - lucide-react (icons)
files_to_modify:
  - src/renderer/src/core/shell/LeftPanelContent.tsx
  - src/main/ipc/sessions.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/renderer/src/assets/main.css
code_patterns:
  - PascalCase components
  - Zustand stores (use{Name}Store)
  - IPC namespace:action pattern
  - CSS variables with Tailwind
  - Zod validation at IPC boundary
test_patterns:
  - Colocated tests (*.test.tsx)
  - Mock stores not IPC
  - Happy path with edge cases
---

# Tech-Spec: Session List Component

**Created:** 2026-01-22
**Story:** 2a-2-session-list-component

## Overview

### Problem Statement

The left panel currently shows a placeholder "Sessions will appear here" message. Users need to see their Claude Code sessions in an organized, scrollable list so they can quickly find and select sessions to work with. The list must display session metadata, indicate active processes, warn about orphaned sessions, and allow click-to-select functionality.

### Solution

Implement a SessionList container component and SessionListItem presentational component that integrate with the existing `useSessionStore` (from Story 2a.1) and `useUIStore` (from Story 1.3). Add two new IPC handlers for updating last accessed timestamp and getting active process state. Create a relative time formatting utility for human-readable timestamps.

### Scope

**In Scope:**
- SessionList container component with filtering/sorting
- SessionListItem presentational component with status indicators
- Relative time formatting utility
- IPC handlers: `sessions:updateLastAccessed`, `sessions:getActiveProcesses`
- Integration with LeftPanelContent
- Click-to-open session functionality
- Pinned sessions sort to top
- Orphaned session warning indicator
- Active process indicator (lightning bolt + green bar)
- CSS for session list states

**Out of Scope:**
- Session context menu (Story 2a.3)
- Session archive/delete actions (Story 2a.3)
- Empty/new session states (Story 2a.4)
- Session forking (Story 2a.5)
- Folder hierarchy view (Epic 5a)
- Search/filter functionality (Epic 6)
- Pin-on-hover functionality (Story 2a.3)

## Context for Development

### Codebase Patterns

**Zustand Store Pattern:**
```typescript
// Existing pattern from useSessionStore.ts
const { sessions, isLoading, loadSessions } = useSessionStore()
// Existing pattern from useUIStore.ts
const { focusOrOpenSession, tabs } = useUIStore()
```

**IPC Channel Pattern:**
```typescript
// namespace:action with colon separator
ipcMain.handle('sessions:updateLastAccessed', ...)
ipcMain.handle('sessions:getActiveProcesses', ...)
```

**Component File Naming:**
- PascalCase: `SessionList.tsx`, `SessionListItem.tsx`
- Colocated tests: `SessionList.test.tsx`

**CSS Variables Usage:**
```typescript
className="bg-[var(--bg-hover)] text-[var(--text-muted)]"
```

**CRITICAL: selectActiveSessions Bug:**
The existing `selectActiveSessions` selector filters OUT orphaned sessions (`!s.exists`), but per AC3, orphaned sessions MUST be displayed with a warning indicator. Use custom filter instead:
```typescript
// CORRECT - shows orphaned sessions with warning
const visibleSessions = sessions.filter(s => !s.archived && !s.isHidden)
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `/Users/teazyou/dev/grimoire/src/renderer/src/features/sessions/store/useSessionStore.ts` | Session store with sessions, isLoading, loadSessions |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/store/useUIStore.ts` | UI store with focusOrOpenSession, tabs |
| `/Users/teazyou/dev/grimoire/src/renderer/src/core/shell/LeftPanelContent.tsx` | Integration target - replace placeholder |
| `/Users/teazyou/dev/grimoire/src/main/ipc/sessions.ts` | Add new IPC handlers |
| `/Users/teazyou/dev/grimoire/src/main/process-registry.ts` | Map<sessionId, ChildProcess> for active processes |
| `/Users/teazyou/dev/grimoire/src/preload/index.ts` | Add preload bridge methods |
| `/Users/teazyou/dev/grimoire/src/preload/index.d.ts` | Type declarations for window.grimoireAPI |
| `/Users/teazyou/dev/grimoire/src/shared/types/ipc.ts` | SessionIdSchema already exists for validation |
| `/Users/teazyou/dev/grimoire/src/renderer/src/shared/utils/cn.ts` | Existing className utility |
| `/Users/teazyou/dev/grimoire/src/renderer/src/assets/main.css` | CSS variables, existing .tab--working animation |

### Technical Decisions

1. **Polling for Active Processes (MVP):** Use setInterval polling every 2 seconds instead of events. Simple, reliable for MVP.

2. **Fire-and-forget lastAccessedAt update:** Don't await the IPC call when clicking sessions - keeps UI snappy.

3. **Custom filter over selectActiveSessions:** Avoid the bug in selectActiveSessions that hides orphaned sessions.

4. **Radix ScrollArea:** Use existing dependency for consistent scrollbar styling.

5. **Button elements for list items:** Ensures keyboard accessibility (Tab, Enter/Space).

6. **Session name derivation:** Extract last path segment from folderPath since sessions don't have explicit names.

## Implementation Plan

### Task 1: Create formatRelativeTime Utility

**File:** `src/renderer/src/shared/utils/formatRelativeTime.ts`

```typescript
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (timestamp == null) return 'Never'

  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString()
}
```

**Test File:** `src/renderer/src/shared/utils/formatRelativeTime.test.ts` (note: `.ts` not `.tsx` since this is a pure utility with no React)
- Test "Just now" for < 60 seconds
- Test "Xm ago" for minutes
- Test "Xh ago" for hours
- Test "Yesterday" for 1 day
- Test "Xd ago" for 2-6 days
- Test date format for > 7 days
- Test null/undefined returns "Never"

### Task 1.5: Create getSessionDisplayName Utility

**File:** `src/renderer/src/shared/utils/getSessionDisplayName.ts`

```typescript
/**
 * Derives a human-readable display name from a session's folder path.
 * Extracts the last path segment as the project name.
 * @param folderPath - The full folder path of the session
 * @returns The display name (last path segment or 'Unknown Project')
 */
export function getSessionDisplayName(folderPath: string): string {
  const segments = folderPath.split('/').filter(Boolean)
  return segments[segments.length - 1] || 'Unknown Project'
}
```

**Test File:** `src/renderer/src/shared/utils/getSessionDisplayName.test.ts`
- Test extracts last segment from path (`/Users/test/myproject` -> `myproject`)
- Test handles trailing slash (`/Users/test/myproject/` -> `myproject`)
- Test handles root paths (`/` -> `Unknown Project`)
- Test handles empty string (`''` -> `Unknown Project`)
- Test handles Windows-style paths (bonus: may not be needed for macOS MVP)

### Task 2: Create SessionListItem Component

**File:** `src/renderer/src/features/sessions/components/SessionListItem.tsx`

**Props Interface:**
```typescript
import type { SessionWithExists } from '../../../../../shared/types/ipc'

interface SessionListItemProps {
  session: SessionWithExists
  isActive: boolean  // TRUE when this session's tab is the currently active tab
  isWorking: boolean
  onClick: () => void
}
```

**Key Implementation Details:**
- Use `<button type="button">` for accessibility
- Derive display name using shared utility (see Task 1.5 below)
- Show pin icon when `session.isPinned === true` (accent color) - use Lucide `Pin` icon, NOT emoji
- Show lightning bolt when `isWorking === true` (green, animated) - use Lucide `Zap` icon, NOT emoji
- Show warning icon when `session.exists === false` - use Lucide `AlertTriangle` icon, NOT emoji
- Apply red tint to folder path when orphaned
- Green left border + animated dots for working state
- Accent background for active/selected state
- Add `aria-label` to all icon elements for screen reader accessibility

**CSS Classes (use Tailwind utilities with CSS variables - do NOT add new CSS classes to main.css):**
```typescript
cn(
  "w-full text-left p-2 rounded-[var(--radius-sm)] transition-colors",
  "hover:bg-[var(--bg-hover)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-inset",
  isActive && "bg-[var(--accent-muted)] border border-[var(--accent)]",
  isWorking && "border-l-2 border-l-[var(--success)]",
  !session.exists && "opacity-75"
)
```

**Icon Implementation (use lucide-react icons):**
```typescript
import { Pin, Zap, AlertTriangle } from 'lucide-react'

// Pin icon (when isPinned)
<Pin className="w-4 h-4 text-[var(--accent)]" aria-label="Pinned session" />

// Working indicator (when isWorking)
<Zap className="w-4 h-4 text-[var(--success)] animate-pulse" aria-label="Session is working" />

// Orphaned warning (when !exists)
<AlertTriangle className="w-4 h-4 text-[var(--warning)]" aria-label="Folder not found" />
```

### Task 3: Create SessionList Container Component

**File:** `src/renderer/src/features/sessions/components/SessionList.tsx`

**Key Implementation Details:**
1. Use `useSessionStore` for sessions and loading state
2. Use `useUIStore` for focusOrOpenSession, tabs, and activeTabId
3. Poll active processes via `useState` + `useEffect` with setInterval
4. Custom filter: `sessions.filter(s => !s.archived && !s.isHidden)`
5. Custom sort: pinned first, then by lastAccessedAt descending
6. Use Radix ScrollArea for scrollable list
7. Handle empty state: "No sessions found"
8. Handle loading state: "Loading sessions..."
9. Use shared `getSessionDisplayName` utility (from Task 1.5)

**Import Requirements:**
```typescript
import { useEffect, useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { SessionListItem } from './SessionListItem'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'
import type { SessionWithExists } from '../../../../../shared/types/ipc'
```

**Active Process Polling:**
```typescript
const [activeProcesses, setActiveProcesses] = useState<string[]>([])

// Empty dependency array is intentional - poll setup runs once on mount
// Polling handles dynamic state internally via setInterval
useEffect(() => {
  // Immediate fetch on mount
  window.grimoireAPI.sessions.getActiveProcesses()
    .then(setActiveProcesses)
    .catch(console.error)

  // Poll every 2 seconds
  const poll = setInterval(async () => {
    try {
      const active = await window.grimoireAPI.sessions.getActiveProcesses()
      setActiveProcesses(active)
    } catch (error) {
      console.error('Failed to poll active processes:', error)
    }
  }, 2000)
  return () => clearInterval(poll)
}, []) // Intentionally empty - see comment above
```

**Active Tab Identification (CRITICAL - must check activeTabId, not just tab existence):**
```typescript
const { focusOrOpenSession, tabs, activeTabId } = useUIStore()

// Check if session is THE CURRENTLY ACTIVE TAB (not just open in any tab)
const isSessionActive = (sessionId: string): boolean => {
  if (!activeTabId) return false
  const activeTab = tabs.find(t => t.id === activeTabId)
  return activeTab?.sessionId === sessionId
}
```

**Session Click Handler:**
```typescript
const handleSessionClick = (session: SessionWithExists) => {
  const displayName = getSessionDisplayName(session.folderPath)
  focusOrOpenSession(session.id, displayName)
  // Fire-and-forget update (don't await to keep UI responsive)
  window.grimoireAPI.sessions.updateLastAccessed(session.id).catch(console.error)
}
```

### Task 4: Create Barrel Export

**File:** `src/renderer/src/features/sessions/components/index.ts`

```typescript
export { SessionList } from './SessionList'
export { SessionListItem } from './SessionListItem'
```

**File:** `src/renderer/src/shared/utils/index.ts` (create or update if exists)

Add exports for new utilities:
```typescript
export { cn } from './cn'
export { formatRelativeTime } from './formatRelativeTime'
export { getSessionDisplayName } from './getSessionDisplayName'
```

### Task 5: Add IPC Handlers

**File:** `src/main/ipc/sessions.ts`

Add imports at top:
```typescript
import { SessionIdSchema } from '../../shared/types/ipc'
import { getDatabase } from '../db'
```

Add handlers inside `registerSessionsIPC()`:

```typescript
// Update last accessed timestamp
ipcMain.handle('sessions:updateLastAccessed', async (_, data: unknown) => {
  const sessionId = SessionIdSchema.parse(data)
  const db = getDatabase()
  const now = Date.now()
  db.prepare('UPDATE sessions SET last_accessed_at = ? WHERE id = ?').run(now, sessionId)
  return { success: true }
})

// Get active processes (session IDs with running child processes)
ipcMain.handle('sessions:getActiveProcesses', () => {
  return Array.from(processRegistry.keys())
})
```

### Task 6: Update Preload Bridge

**File:** `src/preload/index.ts`

Add to `grimoireAPI.sessions` object:
```typescript
sessions: {
  // ... existing methods
  updateLastAccessed: (sessionId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('sessions:updateLastAccessed', sessionId),
  getActiveProcesses: (): Promise<string[]> =>
    ipcRenderer.invoke('sessions:getActiveProcesses')
}
```

### Task 7: Update Type Declarations

**File:** `src/preload/index.d.ts`

Update GrimoireAPI interface:
```typescript
interface GrimoireAPI {
  sessions: {
    terminate: (sessionId: string) => Promise<{ success: boolean }>
    scan: () => Promise<ScanResult>
    sync: (sessions: DiscoveredSession[]) => Promise<SyncResult>
    list: () => Promise<SessionWithExists[]>
    updateLastAccessed: (sessionId: string) => Promise<{ success: boolean }>  // NEW
    getActiveProcesses: () => Promise<string[]>  // NEW
  }
}
```

### Task 8: Integrate with LeftPanelContent

**File:** `src/renderer/src/core/shell/LeftPanelContent.tsx`

Replace placeholder with SessionList:
```typescript
import type { ReactElement } from 'react'
import { PanelTopbar } from './PanelTopbar'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { SessionList } from '@renderer/features/sessions/components'

export function LeftPanelContent(): ReactElement {
  const { setLeftPanelCollapsed } = useUIStore()

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <PanelTopbar title="Sessions" side="left" onCollapse={() => setLeftPanelCollapsed(true)} />
      <div className="flex-1 overflow-hidden">
        <SessionList />
      </div>
    </div>
  )
}
```

### Task 9: Add CSS Styles (if needed)

**File:** `src/renderer/src/assets/main.css`

Add session list specific styles:
```css
/* Session list working state - animated dots */
.session-item--working .working-dots::after {
  content: '...';
  animation: dots-pulse 1.5s ease-in-out infinite;
}

@keyframes dots-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

Note: Most styling will use Tailwind utilities with CSS variables. Only add CSS for animations that can't be done inline.

### Task 10: Write Component Tests

**SessionListItem.test.tsx:**
- Renders session display name from folder path
- Shows folder path below name
- Shows relative timestamp
- Shows pin icon when isPinned=true
- Shows lightning bolt when isWorking=true
- Shows warning icon when exists=false
- Applies red tint to path when orphaned
- Calls onClick when clicked
- Has accessible button role

**SessionList.test.tsx:**
- Loads sessions on mount (calls loadSessions)
- Filters out archived sessions
- Filters out hidden sessions
- Shows orphaned sessions (NOT filtered)
- Sorts pinned sessions first
- Sorts by lastAccessedAt descending
- Shows loading state
- Shows empty state
- Clicking session calls focusOrOpenSession

### Task 11: Final Validation

```bash
npm run validate  # tsc --noEmit && vitest run && npm run lint
```

Manual testing checklist:
- [ ] Sessions display in left panel list
- [ ] Clicking session opens/focuses tab
- [ ] Orphaned sessions show warning icon
- [ ] Pinned sessions appear at top
- [ ] Most recent sessions appear first (within non-pinned)
- [ ] Relative timestamps display correctly
- [ ] Active process shows lightning bolt (if process running)

## Acceptance Criteria

### AC1: Session List Display
**Given** the user views the left panel with Sessions view active
**When** sessions are loaded from the database
**Then** sessions are displayed as a scrollable list
**And** each session item shows: name/summary, folder path below name, relative timestamp
**And** sessions are sorted by last_accessed_at descending (most recent first)

### AC2: Active Process Indicator
**Given** a session has an active child process
**When** displayed in the list
**Then** a lightning bolt icon appears indicating connected state
**And** Working state shows green color bar with animated dots indicator

### AC3: Orphaned Session Warning
**Given** a session's folder no longer exists
**When** displayed in the list
**Then** a warning icon appears
**And** the folder path shows red tint

### AC4: Session Selection
**Given** the user clicks a session in the list
**When** the session is selected
**Then** the conversation loads in the middle panel
**And** the session is marked as last_accessed_at = now

## Additional Context

### Dependencies

**Existing (no changes needed):**
- `zustand` - State management
- `@radix-ui/react-scroll-area` - Scroll container
- `clsx` + `tailwind-merge` - CSS class composition
- `zod` - Runtime validation

**Files Created by This Story:**
- `src/renderer/src/features/sessions/components/SessionListItem.tsx`
- `src/renderer/src/features/sessions/components/SessionListItem.test.tsx`
- `src/renderer/src/features/sessions/components/SessionList.tsx`
- `src/renderer/src/features/sessions/components/SessionList.test.tsx`
- `src/renderer/src/features/sessions/components/index.ts`
- `src/renderer/src/shared/utils/formatRelativeTime.ts`
- `src/renderer/src/shared/utils/formatRelativeTime.test.ts`
- `src/renderer/src/shared/utils/getSessionDisplayName.ts`
- `src/renderer/src/shared/utils/getSessionDisplayName.test.ts`
- `src/renderer/src/shared/utils/index.ts` (create or update)

**Files Modified:**
- `src/renderer/src/core/shell/LeftPanelContent.tsx`
- `src/main/ipc/sessions.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/assets/main.css` (optional)

### Testing Strategy

**Unit Tests:**
- formatRelativeTime utility - all time ranges
- SessionListItem - renders all states correctly
- SessionList - filtering, sorting, state handling

**Integration Tests:**
- Click flow: session click -> focusOrOpenSession called
- Load flow: mount -> loadSessions called

**Mock Strategy:**
- Mock `useSessionStore` and `useUIStore` in component tests
- Mock `window.grimoireAPI` for IPC calls
- Do NOT mock fs (lesson from Story 2a.1)

### Notes

**Performance Considerations:**
- Polling interval of 2 seconds is acceptable for MVP
- Fire-and-forget lastAccessedAt update keeps UI responsive
- Virtual scrolling NOT needed for MVP (typical session count < 100)

**Accessibility:**
- All list items are buttons with proper focus states
- Icons have aria-label attributes for screen readers AND title for tooltips
- Color is not the only indicator (icons accompany colors)

**Icon Library:**
- Use lucide-react for all icons (Pin, Zap, AlertTriangle)
- Do NOT use emoji characters in code (per project-context.md)
- lucide-react is already installed in the project (v0.562.0)

**Future Enhancements (Out of Scope):**
- WebSocket/events instead of polling
- Virtual scrolling for large lists
- Drag-and-drop reordering
- Context menu actions

---

## Change Log

- **2026-01-22 Review Pass 3** - Fixed 7 issues from adversarial review:
  - **MEDIUM (F4)**: Extracted `getSessionDisplayName` to shared utility to avoid duplication between SessionListItem and SessionList components. Created new Task 1.5.
  - **MEDIUM (F6)**: Fixed `isSessionActive` to check `activeTabId` instead of just tab existence. The session should only show as "active" when its tab is THE currently focused tab, not just open in any tab.
  - **MEDIUM (F11)**: Added aria-label requirements for all icon elements to improve screen reader accessibility.
  - **LOW (F2)**: Changed from emoji icons to lucide-react icons (Pin, Zap, AlertTriangle) per project-context.md no-emoji rule.
  - **LOW (F5)**: Added explicit note that `.test.ts` (not `.tsx`) is correct for pure utility functions.
  - **LOW (F7)**: Added explicit comment explaining empty dependency array in polling useEffect is intentional.
  - **LOW (F8)**: Added note to use Tailwind utilities only, not add new CSS classes to main.css.
  - Updated files list to include new `getSessionDisplayName.ts` utility and barrel export updates.
