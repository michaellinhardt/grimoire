---
title: 'Session Management Actions'
slug: '2a-3-session-management-actions'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
story_file: '2a-3-session-management-actions.md'
tech_stack:
  - React 19
  - TypeScript
  - Radix UI (DropdownMenu, ContextMenu)
  - Zustand
  - Electron IPC
  - better-sqlite3
  - lucide-react
files_to_modify:
  - src/main/ipc/sessions.ts
  - src/main/ipc/index.ts
  - src/main/index.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/shared/types/ipc.ts
  - src/renderer/src/features/sessions/components/SessionListItem.tsx
  - src/renderer/src/features/sessions/components/SessionList.tsx
  - src/renderer/src/features/sessions/components/index.ts
  - src/renderer/src/core/shell/LeftPanelContent.tsx
  - src/renderer/src/shared/store/useUIStore.ts
files_to_create:
  - src/main/ipc/dialog.ts
  - src/renderer/src/features/sessions/components/SessionContextMenu.tsx
  - src/renderer/src/features/sessions/components/SessionContextMenu.test.tsx
  - src/renderer/src/features/sessions/components/SessionListItem.test.tsx
  - src/renderer/src/features/sessions/components/SessionList.test.tsx
code_patterns:
  - IPC channel naming (namespace:action)
  - Radix UI headless components
  - Zustand state management
  - Zod validation at IPC boundary
test_patterns:
  - window.grimoireAPI mock via Object.defineProperty
  - Testing Library + Vitest
  - userEvent for interaction tests
---

# Tech-Spec: Session Management Actions

**Created:** 2026-01-23
**Story:** 2a-3-session-management-actions.md

## Overview

### Problem Statement

Users need to manage their Claude Code sessions effectively within Grimoire. Currently, there is no way to create new sessions, archive sessions to hide them from the default view, or restore archived sessions. This limits the user's ability to organize their workflow.

### Solution

Implement session management actions including:
1. **New Session Creation**: "+" button in left panel header that opens a folder picker, creates a new session for the selected folder, and opens it in a new tab
2. **Archive/Unarchive**: Context menu (3-dot button + right-click) on session items to archive/unarchive sessions
3. **Show Archived Toggle**: Toggle in left panel to show/hide archived sessions with visual distinction

### Scope

**In Scope:**
- Create new session with folder picker dialog
- 3-dot context menu on session items (DropdownMenu)
- Right-click context menu (ContextMenu)
- Archive/unarchive session actions
- Show archived toggle in left panel
- Visual distinction for archived sessions
- IPC handlers for dialog and session operations
- Unit tests for all new components

**Out of Scope:**
- Pin/unpin actions (Story 6.2)
- Delete session permanently
- Rename session
- Move session to different folder
- Search/filter sessions (Epic 6)
- Persistence of showArchived toggle (MVP: in-memory only)

## Context for Development

### Codebase Patterns

**IPC Pattern:**
- Channel naming: `namespace:action` (colon separator)
- Zod validation at IPC boundary in main process
- Preload bridge passes data directly to ipcRenderer.invoke
- Type declarations in `src/preload/index.d.ts`

**Component Pattern:**
- Feature components in `src/renderer/src/features/sessions/components/`
- Tests colocated: `ComponentName.test.tsx` beside source
- Use `cn()` utility for className composition
- Use CSS variables for theming (`--bg-elevated`, `--border`, etc.)
- lucide-react for icons

**State Pattern:**
- Zustand stores for UI state
- `useUIStore` for panel/tab state
- `useSessionStore` for session data
- Use `getState()` for imperative calls outside React render cycle

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/features/sessions/components/SessionListItem.tsx` | Existing session item component to modify |
| `src/renderer/src/features/sessions/components/SessionList.tsx` | Session list with filtering logic |
| `src/main/ipc/sessions.ts` | Existing session IPC handlers |
| `src/preload/index.ts` | Preload bridge with grimoireAPI |
| `src/preload/index.d.ts` | Type declarations for grimoireAPI |
| `src/shared/types/ipc.ts` | Zod schemas for IPC validation |
| `src/renderer/src/shared/store/useUIStore.ts` | UI state store |
| `src/renderer/src/core/shell/LeftPanelContent.tsx` | Left panel container |

### Technical Decisions

1. **Radix DropdownMenu for 3-dot menu**: Already in dependencies, accessible, headless
2. **Radix ContextMenu for right-click**: Need to install `@radix-ui/react-context-menu`
3. **Node crypto.randomUUID()**: Use built-in instead of uuid package for session ID generation
4. **Electron dialog.showOpenDialog**: Native folder picker for new session flow
5. **showArchived in-memory only**: Skip Zustand persist middleware for MVP
6. **Shared menu styling**: Both DropdownMenu and ContextMenu use same visual styles

## Implementation Plan

### Task 1: Install @radix-ui/react-context-menu

**File:** package.json (via npm install)

**Action:** Install the Radix ContextMenu package for right-click menu support.

```bash
npm install @radix-ui/react-context-menu
```

### Task 2: Add CreateSessionSchema to shared types

**File:** `src/shared/types/ipc.ts`

**Action:** Add Zod schema for session creation request at the end of the file.

```typescript
// Add after SessionListSchema definition

// ============================================================
// Session Management Schemas (Story 2a.3)
// ============================================================

export const CreateSessionSchema = z.object({
  folderPath: z.string().min(1)
})

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>
```

### Task 3: Create dialog IPC handler

**File:** `src/main/ipc/dialog.ts` (NEW FILE)

**Action:** Create new file with folder picker dialog handler.

```typescript
import { ipcMain, dialog } from 'electron'

export function registerDialogIPC(): void {
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Folder'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, folderPath: null }
    }

    return { canceled: false, folderPath: result.filePaths[0] }
  })
}
```

### Task 4: Add session management IPC handlers

**File:** `src/main/ipc/sessions.ts`

**Action:** Add archive, unarchive, and create handlers inside `registerSessionsIPC()` function.

```typescript
// Add imports at top of file
import { randomUUID } from 'crypto'
import { CreateSessionSchema } from '../../shared/types/ipc'

// Add these handlers inside registerSessionsIPC() function, after existing handlers:

  // Archive session (Story 2a.3)
  ipcMain.handle('sessions:archive', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    db.prepare('UPDATE sessions SET archived = 1 WHERE id = ?').run(sessionId)
    return { success: true }
  })

  // Unarchive session (Story 2a.3)
  ipcMain.handle('sessions:unarchive', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()
    db.prepare('UPDATE sessions SET archived = 0 WHERE id = ?').run(sessionId)
    return { success: true }
  })

  // Create new session (Story 2a.3)
  ipcMain.handle('sessions:create', async (_, data: unknown) => {
    const { folderPath } = CreateSessionSchema.parse(data)
    const sessionId = randomUUID()
    const now = Date.now()
    const db = getDatabase()

    db.prepare(`
      INSERT INTO sessions (id, folder_path, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, folderPath, now, now)

    return { sessionId }
  })
```

### Task 5: Export dialog IPC from index

**File:** `src/main/ipc/index.ts`

**Action:** Add export for the new dialog IPC module.

```typescript
export { registerSessionsIPC } from './sessions'
export { registerDialogIPC } from './dialog'
```

### Task 6: Register dialog IPC in main process

**File:** `src/main/index.ts`

**Action:** Import and register the dialog IPC handlers.

```typescript
// Update import line
import { registerSessionsIPC, registerDialogIPC } from './ipc'

// In app.whenReady(), after registerSessionsIPC():
registerDialogIPC()
```

### Task 7: Update preload bridge

**File:** `src/preload/index.ts`

**Action:** Add new session methods and dialog namespace to grimoireAPI.

```typescript
// Update grimoireAPI object:
const grimoireAPI = {
  sessions: {
    terminate: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:terminate', { sessionId }),
    scan: () => ipcRenderer.invoke('sessions:scan'),
    sync: (sessions: DiscoveredSessionLike[]) => ipcRenderer.invoke('sessions:sync', { sessions }),
    list: () => ipcRenderer.invoke('sessions:list'),
    updateLastAccessed: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:updateLastAccessed', sessionId),
    getActiveProcesses: (): Promise<string[]> => ipcRenderer.invoke('sessions:getActiveProcesses'),
    // New methods (Story 2a.3)
    archive: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:archive', sessionId),
    unarchive: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:unarchive', sessionId),
    create: (folderPath: string): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke('sessions:create', { folderPath })
  },
  // New namespace (Story 2a.3)
  dialog: {
    selectFolder: (): Promise<{ canceled: boolean; folderPath: string | null }> =>
      ipcRenderer.invoke('dialog:selectFolder')
  }
}
```

### Task 8: Update type declarations

**File:** `src/preload/index.d.ts`

**Action:** Add type declarations for new IPC methods. Note: The entire file content is replaced to include both existing and new declarations.

```typescript
import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ScanResult,
  SyncResult,
  DiscoveredSession,
  SessionWithExists
} from '../shared/types/ipc'

export interface GrimoireAPI {
  sessions: {
    terminate: (sessionId: string) => Promise<{ success: boolean }>
    scan: () => Promise<ScanResult>
    sync: (sessions: DiscoveredSession[]) => Promise<SyncResult>
    list: () => Promise<SessionWithExists[]>
    updateLastAccessed: (sessionId: string) => Promise<{ success: boolean }>
    getActiveProcesses: () => Promise<string[]>
    // New methods (Story 2a.3)
    archive: (sessionId: string) => Promise<{ success: boolean }>
    unarchive: (sessionId: string) => Promise<{ success: boolean }>
    create: (folderPath: string) => Promise<{ sessionId: string }>
  }
  dialog: {
    selectFolder: () => Promise<{ canceled: boolean; folderPath: string | null }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    grimoireAPI: GrimoireAPI
  }
}
```

### Task 9: Add showArchived state to useUIStore

**File:** `src/renderer/src/shared/store/useUIStore.ts`

**Action:** Add showArchived state and setter to the store interface and implementation.

```typescript
// Add to UIState interface:
interface UIState {
  // ... existing properties
  showArchived: boolean

  // ... existing actions
  setShowArchived: (show: boolean) => void
}

// Add to create function initial state:
export const useUIStore = create<UIState>((set, get) => ({
  // ... existing initial state
  showArchived: false,

  // ... existing actions
  setShowArchived: (show) => set({ showArchived: show }),
  // ... rest of actions
}))
```

### Task 10: Create SessionContextMenu component

**File:** `src/renderer/src/features/sessions/components/SessionContextMenu.tsx` (NEW FILE)

**Action:** Create the dropdown menu component for session actions.

```typescript
import type { ReactNode, ReactElement } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Archive, ArchiveRestore } from 'lucide-react'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

interface SessionContextMenuProps {
  session: SessionWithExists
  trigger: ReactNode
  onArchive: () => void
  onUnarchive: () => void
}

export function SessionContextMenu({
  session,
  trigger,
  onArchive,
  onUnarchive
}: SessionContextMenuProps): ReactElement {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] p-1 shadow-lg z-50"
          sideOffset={5}
        >
          {session.archived ? (
            <DropdownMenu.Item
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none"
              onSelect={onUnarchive}
            >
              <ArchiveRestore className="w-4 h-4" />
              Unarchive
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none"
              onSelect={onArchive}
            >
              <Archive className="w-4 h-4" />
              Archive
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

### Task 11: Update SessionListItem with context menus and archive styling

**File:** `src/renderer/src/features/sessions/components/SessionListItem.tsx`

**Action:** Add 3-dot menu button, right-click context menu, archive styling, and new props.

```typescript
import type { ReactElement } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Pin, Zap, AlertTriangle, MoreVertical, Archive, ArchiveRestore } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { formatRelativeTime } from '@renderer/shared/utils/formatRelativeTime'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'
import { SessionContextMenu } from './SessionContextMenu'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

interface SessionListItemProps {
  session: SessionWithExists
  isActive: boolean
  isWorking: boolean
  onClick: () => void
  onArchive: () => void
  onUnarchive: () => void
}

export function SessionListItem({
  session,
  isActive,
  isWorking,
  onClick,
  onArchive,
  onUnarchive
}: SessionListItemProps): ReactElement {
  const displayName = getSessionDisplayName(session.folderPath)

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'group w-full text-left p-2 rounded-[var(--radius-sm)] transition-colors',
            'hover:bg-[var(--bg-hover)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-inset',
            isActive && 'bg-[var(--accent-muted)] border border-[var(--accent)]',
            isWorking && 'border-l-2 border-l-[var(--success)]',
            !session.exists && 'opacity-75',
            session.archived && 'opacity-60'
          )}
        >
          <div className="flex items-center gap-2">
            {session.isPinned && (
              <Pin className="w-4 h-4 text-[var(--accent)] flex-shrink-0" aria-label="Pinned session" />
            )}
            {isWorking && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <Zap
                  className="w-4 h-4 text-[var(--success)] animate-pulse"
                  aria-label="Session is working"
                />
                <span className="text-[var(--success)] text-xs animate-pulse">...</span>
              </span>
            )}
            {!session.exists && (
              <AlertTriangle
                className="w-4 h-4 text-[var(--warning)] flex-shrink-0"
                aria-label="Folder not found"
              />
            )}
            <span className="font-medium truncate text-[var(--text-primary)] flex-1">
              {displayName}
            </span>

            {/* 3-dot menu - visible on hover */}
            <SessionContextMenu
              session={session}
              trigger={
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] focus:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Session options"
                >
                  <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              }
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          </div>
          <div
            className={cn(
              'text-xs truncate mt-0.5 pl-6',
              session.exists ? 'text-[var(--text-muted)]' : 'text-[var(--error)]',
              session.archived && 'italic'
            )}
          >
            {session.archived && (
              <Archive className="inline w-3 h-3 mr-1 text-[var(--text-muted)]" />
            )}
            {session.folderPath}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5 pl-6">
            {formatRelativeTime(session.lastAccessedAt || session.updatedAt)}
          </div>
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[160px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] p-1 shadow-lg z-50"
        >
          {session.archived ? (
            <ContextMenu.Item
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none"
              onSelect={onUnarchive}
            >
              <ArchiveRestore className="w-4 h-4" />
              Unarchive
            </ContextMenu.Item>
          ) : (
            <ContextMenu.Item
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none"
              onSelect={onArchive}
            >
              <Archive className="w-4 h-4" />
              Archive
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
```

### Task 12: Update SessionList with archive handlers and showArchived filter

**File:** `src/renderer/src/features/sessions/components/SessionList.tsx`

**Action:** Add archive handlers and update filtering to respect showArchived toggle.

```typescript
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { SessionListItem } from './SessionListItem'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

export function SessionList(): ReactElement {
  const { sessions, isLoading, loadSessions } = useSessionStore()
  const { focusOrOpenSession, tabs, activeTabId, showArchived } = useUIStore()
  const [activeProcesses, setActiveProcesses] = useState<string[]>([])

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Poll for active processes (MVP approach)
  useEffect(() => {
    window.grimoireAPI.sessions.getActiveProcesses().then(setActiveProcesses).catch(console.error)

    const poll = setInterval(async () => {
      try {
        const active = await window.grimoireAPI.sessions.getActiveProcesses()
        setActiveProcesses(active)
      } catch (error) {
        console.error('Failed to poll active processes:', error)
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [])

  // Filter sessions: show non-hidden, and include archived only if toggle is on
  const visibleSessions = sessions.filter((s) => !s.isHidden && (showArchived || !s.archived))

  // Sort: pinned first, then by lastAccessedAt descending
  const sortedSessions = [...visibleSessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return (b.lastAccessedAt || b.updatedAt) - (a.lastAccessedAt || a.updatedAt)
  })

  const isSessionActive = (sessionId: string): boolean => {
    if (!activeTabId) return false
    const activeTab = tabs.find((t) => t.id === activeTabId)
    return activeTab?.sessionId === sessionId
  }

  const handleSessionClick = (session: SessionWithExists): void => {
    const displayName = getSessionDisplayName(session.folderPath)
    focusOrOpenSession(session.id, displayName)
    window.grimoireAPI.sessions.updateLastAccessed(session.id).catch(console.error)
  }

  const handleArchive = async (sessionId: string): Promise<void> => {
    await window.grimoireAPI.sessions.archive(sessionId)
    loadSessions()
  }

  const handleUnarchive = async (sessionId: string): Promise<void> => {
    await window.grimoireAPI.sessions.unarchive(sessionId)
    loadSessions()
  }

  if (isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading sessions...</div>
  }

  if (sortedSessions.length === 0) {
    return <div className="p-4 text-[var(--text-muted)]">No sessions found</div>
  }

  return (
    <ScrollArea.Root className="h-full">
      <ScrollArea.Viewport className="h-full w-full p-2">
        <div className="space-y-1">
          {sortedSessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={isSessionActive(session.id)}
              isWorking={activeProcesses.includes(session.id)}
              onClick={() => handleSessionClick(session)}
              onArchive={() => handleArchive(session.id)}
              onUnarchive={() => handleUnarchive(session.id)}
            />
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none select-none bg-transparent p-0.5"
      >
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--border)]" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
```

### Task 13: Update LeftPanelContent with new session button and show archived toggle

**File:** `src/renderer/src/core/shell/LeftPanelContent.tsx`

**Action:** Add "+" button for new session and toggle for showing archived sessions. The PanelTopbar already accepts children which are rendered in the header area.

**Important:** Since `handleNewSession` is an async event handler (not inside a React hook), use `useSessionStore.getState()` and `useUIStore.getState()` for imperative store access to avoid stale closures.

```typescript
import type { ReactElement } from 'react'
import { Plus, Archive } from 'lucide-react'
import { PanelTopbar } from './PanelTopbar'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useSessionStore } from '@renderer/features/sessions/store/useSessionStore'
import { SessionList } from '@renderer/features/sessions/components'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'

export function LeftPanelContent(): ReactElement {
  const { setLeftPanelCollapsed, showArchived, setShowArchived } = useUIStore()

  const handleNewSession = async (): Promise<void> => {
    const result = await window.grimoireAPI.dialog.selectFolder()
    if (result.canceled || !result.folderPath) return

    const { sessionId } = await window.grimoireAPI.sessions.create(result.folderPath)
    const displayName = getSessionDisplayName(result.folderPath)

    // Refresh session list to include new session
    // Use getState() for imperative calls in async handlers (prevents stale closures)
    useSessionStore.getState().loadSessions()

    // Open the new session in a tab
    useUIStore.getState().focusOrOpenSession(sessionId, displayName)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <PanelTopbar title="Sessions" side="left" onCollapse={() => setLeftPanelCollapsed(true)}>
        {/* Action buttons in header - children are rendered between title and collapse button */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={handleNewSession}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="New session"
            title="New session"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] ${
              showArchived ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            } hover:text-[var(--text-primary)]`}
            aria-label={showArchived ? 'Hide archived sessions' : 'Show archived sessions'}
            title={showArchived ? 'Hide archived sessions' : 'Show archived sessions'}
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </PanelTopbar>
      <div className="flex-1 overflow-hidden">
        <SessionList />
      </div>
    </div>
  )
}
```

**Note:** The PanelTopbar component already accepts a `children` prop. The children are rendered within the header's flex container between the title and the collapse button. Using `ml-auto` on the wrapper div pushes the action buttons to the right side near the collapse button.

### Task 14: Update component index exports

**File:** `src/renderer/src/features/sessions/components/index.ts`

**Action:** Export the new SessionContextMenu component.

```typescript
export { SessionList } from './SessionList'
export { SessionListItem } from './SessionListItem'
export { SessionContextMenu } from './SessionContextMenu'
```

### Task 15: Add tests for SessionContextMenu

**File:** `src/renderer/src/features/sessions/components/SessionContextMenu.test.tsx` (NEW FILE)

**Action:** Create unit tests for the context menu component.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionContextMenu } from './SessionContextMenu'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

const createMockSession = (overrides: Partial<SessionWithExists> = {}): SessionWithExists => ({
  id: 'test-session-id',
  folderPath: '/test/path',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastAccessedAt: null,
  archived: false,
  isPinned: false,
  forkedFromSessionId: null,
  isHidden: false,
  exists: true,
  ...overrides
})

describe('SessionContextMenu', () => {
  const mockOnArchive = vi.fn()
  const mockOnUnarchive = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Archive option for non-archived session', async () => {
    const session = createMockSession({ archived: false })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    expect(screen.getByText('Archive')).toBeInTheDocument()
    expect(screen.queryByText('Unarchive')).not.toBeInTheDocument()
  })

  it('renders Unarchive option for archived session', async () => {
    const session = createMockSession({ archived: true })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    expect(screen.getByText('Unarchive')).toBeInTheDocument()
    expect(screen.queryByText('Archive')).not.toBeInTheDocument()
  })

  it('calls onArchive when Archive is clicked', async () => {
    const session = createMockSession({ archived: false })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    await user.click(screen.getByText('Archive'))
    expect(mockOnArchive).toHaveBeenCalledTimes(1)
  })

  it('calls onUnarchive when Unarchive is clicked', async () => {
    const session = createMockSession({ archived: true })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    await user.click(screen.getByText('Unarchive'))
    expect(mockOnUnarchive).toHaveBeenCalledTimes(1)
  })
})
```

### Task 16: Add tests for SessionListItem archive functionality

**File:** `src/renderer/src/features/sessions/components/SessionListItem.test.tsx` (NEW FILE)

**Action:** Create unit tests for the session list item with archive functionality.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionListItem } from './SessionListItem'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

const createMockSession = (overrides: Partial<SessionWithExists> = {}): SessionWithExists => ({
  id: 'test-session-id',
  folderPath: '/test/path/project',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastAccessedAt: null,
  archived: false,
  isPinned: false,
  forkedFromSessionId: null,
  isHidden: false,
  exists: true,
  ...overrides
})

describe('SessionListItem', () => {
  const mockOnClick = vi.fn()
  const mockOnArchive = vi.fn()
  const mockOnUnarchive = vi.fn()

  const defaultProps = {
    isActive: false,
    isWorking: false,
    onClick: mockOnClick,
    onArchive: mockOnArchive,
    onUnarchive: mockOnUnarchive
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders session display name', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.getByText('project')).toBeInTheDocument()
  })

  it('shows 3-dot menu button on hover', async () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} />)

    const optionsButton = screen.getByLabelText('Session options')
    expect(optionsButton).toBeInTheDocument()
    // Note: opacity styling is handled by CSS, testing presence is sufficient
  })

  it('calls onClick when session is clicked', async () => {
    const session = createMockSession()
    const user = userEvent.setup()
    render(<SessionListItem session={session} {...defaultProps} />)

    await user.click(screen.getByText('project'))
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('opens menu without triggering onClick when 3-dot button is clicked', async () => {
    const session = createMockSession()
    const user = userEvent.setup()
    render(<SessionListItem session={session} {...defaultProps} />)

    await user.click(screen.getByLabelText('Session options'))
    expect(mockOnClick).not.toHaveBeenCalled()
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('shows archived visual styling when session is archived', () => {
    const session = createMockSession({ archived: true })
    render(<SessionListItem session={session} {...defaultProps} />)

    // Check for opacity class on the button
    const button = screen.getByRole('button', { name: /project/i })
    expect(button.className).toContain('opacity-60')
  })

  it('shows Archive icon inline for archived sessions', () => {
    const session = createMockSession({ archived: true })
    render(<SessionListItem session={session} {...defaultProps} />)

    // The Archive icon should be present inline
    const archiveIcons = document.querySelectorAll('.lucide-archive')
    expect(archiveIcons.length).toBeGreaterThan(0)
  })

  it('calls onArchive when Archive menu item is clicked', async () => {
    const session = createMockSession({ archived: false })
    const user = userEvent.setup()
    render(<SessionListItem session={session} {...defaultProps} />)

    await user.click(screen.getByLabelText('Session options'))
    await user.click(screen.getByText('Archive'))
    expect(mockOnArchive).toHaveBeenCalledTimes(1)
  })

  it('calls onUnarchive when Unarchive menu item is clicked', async () => {
    const session = createMockSession({ archived: true })
    const user = userEvent.setup()
    render(<SessionListItem session={session} {...defaultProps} />)

    await user.click(screen.getByLabelText('Session options'))
    await user.click(screen.getByText('Unarchive'))
    expect(mockOnUnarchive).toHaveBeenCalledTimes(1)
  })
})
```

### Task 17: Add tests for SessionList archive and filter functionality

**File:** `src/renderer/src/features/sessions/components/SessionList.test.tsx` (NEW FILE)

**Action:** Create unit tests for the session list filtering and archive handlers.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionList } from './SessionList'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

// Mock the stores
vi.mock('../store/useSessionStore', () => ({
  useSessionStore: vi.fn()
}))

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

const createMockSession = (overrides: Partial<SessionWithExists> = {}): SessionWithExists => ({
  id: overrides.id ?? 'test-session-' + Math.random().toString(36).slice(2),
  folderPath: '/test/path',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastAccessedAt: null,
  archived: false,
  isPinned: false,
  forkedFromSessionId: null,
  isHidden: false,
  exists: true,
  ...overrides
})

describe('SessionList', () => {
  const mockArchive = vi.fn().mockResolvedValue({ success: true })
  const mockUnarchive = vi.fn().mockResolvedValue({ success: true })
  const mockLoadSessions = vi.fn()
  const mockFocusOrOpenSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.grimoireAPI
    Object.defineProperty(window, 'grimoireAPI', {
      writable: true,
      configurable: true,
      value: {
        sessions: {
          archive: mockArchive,
          unarchive: mockUnarchive,
          getActiveProcesses: vi.fn().mockResolvedValue([]),
          updateLastAccessed: vi.fn().mockResolvedValue({ success: true })
        }
      }
    })
  })

  it('filters out archived sessions when showArchived is false', async () => {
    const { useSessionStore } = await import('../store/useSessionStore')
    const { useUIStore } = await import('@renderer/shared/store/useUIStore')

    const sessions = [
      createMockSession({ id: '1', folderPath: '/test/active', archived: false }),
      createMockSession({ id: '2', folderPath: '/test/archived', archived: true })
    ]

    vi.mocked(useSessionStore).mockReturnValue({
      sessions,
      isLoading: false,
      loadSessions: mockLoadSessions
    })

    vi.mocked(useUIStore).mockReturnValue({
      focusOrOpenSession: mockFocusOrOpenSession,
      tabs: [],
      activeTabId: null,
      showArchived: false
    })

    render(<SessionList />)

    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.queryByText('archived')).not.toBeInTheDocument()
  })

  it('shows archived sessions when showArchived is true', async () => {
    const { useSessionStore } = await import('../store/useSessionStore')
    const { useUIStore } = await import('@renderer/shared/store/useUIStore')

    const sessions = [
      createMockSession({ id: '1', folderPath: '/test/active', archived: false }),
      createMockSession({ id: '2', folderPath: '/test/archived', archived: true })
    ]

    vi.mocked(useSessionStore).mockReturnValue({
      sessions,
      isLoading: false,
      loadSessions: mockLoadSessions
    })

    vi.mocked(useUIStore).mockReturnValue({
      focusOrOpenSession: mockFocusOrOpenSession,
      tabs: [],
      activeTabId: null,
      showArchived: true
    })

    render(<SessionList />)

    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('archived')).toBeInTheDocument()
  })

  it('calls archive IPC and reloads sessions when archiving', async () => {
    const { useSessionStore } = await import('../store/useSessionStore')
    const { useUIStore } = await import('@renderer/shared/store/useUIStore')
    const user = userEvent.setup()

    const sessions = [
      createMockSession({ id: 'test-id', folderPath: '/test/project', archived: false })
    ]

    vi.mocked(useSessionStore).mockReturnValue({
      sessions,
      isLoading: false,
      loadSessions: mockLoadSessions
    })

    vi.mocked(useUIStore).mockReturnValue({
      focusOrOpenSession: mockFocusOrOpenSession,
      tabs: [],
      activeTabId: null,
      showArchived: false
    })

    render(<SessionList />)

    // Open the 3-dot menu and click Archive
    await user.click(screen.getByLabelText('Session options'))
    await user.click(screen.getByText('Archive'))

    await waitFor(() => {
      expect(mockArchive).toHaveBeenCalledWith('test-id')
      expect(mockLoadSessions).toHaveBeenCalled()
    })
  })
})
```

### Task 18: Final validation

**Action:** Run validation to ensure all code compiles and tests pass.

```bash
npm run validate
```

**Manual Testing Checklist:**
- [ ] 3-dot menu appears on hover over session item
- [ ] Clicking 3-dot menu opens dropdown with Archive/Unarchive option
- [ ] Archive action hides session from default view
- [ ] Right-click on session item opens context menu
- [ ] Show archived toggle appears in left panel header
- [ ] Toggling "show archived" reveals archived sessions with visual distinction
- [ ] Archived sessions appear dimmed with Archive icon
- [ ] "+" button opens folder picker dialog
- [ ] Selecting a folder creates a new session
- [ ] New session opens in a new tab
- [ ] Session list refreshes after creating new session

## Acceptance Criteria

### AC1: New Session Creation (FR27, FR68)
**Given** the user wants to create a new session
**When** they click the "+" button in the left panel header
**Then** a folder picker dialog appears
**And** selecting a folder creates a new session associated with that folder
**And** the new session opens in a new tab

### AC2: Archive Session (FR30)
**Given** the user right-clicks a session or opens the 3-dot menu
**When** selecting "Archive"
**Then** the session is marked as archived in the database
**And** the session is hidden from the default list view

### AC3: Show Archived Toggle (FR31)
**Given** archived sessions exist
**When** the user clicks the archive toggle button in the left panel
**Then** archived sessions appear in the list with visual distinction (dimmed, italic, Archive icon)
**And** clicking the toggle again hides archived sessions

## Additional Context

### Dependencies

**NPM Package to Install:**
- `@radix-ui/react-context-menu` - for right-click context menu

**Existing Dependencies Used:**
- `@radix-ui/react-dropdown-menu` - for 3-dot menu
- `lucide-react` - for icons (Archive, ArchiveRestore, MoreVertical, Plus)
- `zustand` - for state management
- `zod` - for IPC validation

### Testing Strategy

**Unit Tests:**
- SessionContextMenu: menu rendering, item clicks, conditional display
- SessionListItem: 3-dot menu, right-click, archive styling, click handlers
- SessionList: filtering logic, archive/unarchive handlers

**Mock Pattern:**
```typescript
// Mock window.grimoireAPI via Object.defineProperty
beforeEach(() => {
  Object.defineProperty(window, 'grimoireAPI', {
    writable: true,
    configurable: true,
    value: {
      sessions: {
        archive: vi.fn().mockResolvedValue({ success: true }),
        unarchive: vi.fn().mockResolvedValue({ success: true }),
        // ... other methods
      },
      dialog: {
        selectFolder: vi.fn().mockResolvedValue({ canceled: false, folderPath: '/test' })
      }
    }
  })
})
```

### Notes

1. **PanelTopbar Modification**: Task 13 assumes PanelTopbar accepts children for action buttons. If the current PanelTopbar doesn't support this, it needs to be updated to accept an `actions` or `children` prop.

2. **showArchived Persistence**: The MVP implementation stores showArchived in memory only. It will reset to `false` on app restart. Adding Zustand persist middleware is out of scope but can be added later if needed.

3. **Error Handling**: Archive/unarchive operations are fire-and-forget with loadSessions() refresh. More sophisticated error handling (toast notifications, optimistic updates with rollback) can be added in future iterations.

4. **Keyboard Accessibility**: Radix UI components provide built-in keyboard navigation. The 3-dot menu trigger should be focusable and respond to Enter/Space.

### References

- Story file: `_bmad-output/implementation-artifacts/2a-3-session-management-actions.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Previous story (2a.2): `_bmad-output/implementation-artifacts/tech-spec-2a-2-session-list-component.md`

## Review Log

### 2026-01-23: Adversarial Review Pass 3

**Findings Fixed (1 HIGH, 3 MEDIUM, 2 LOW):**

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| F1 | HIGH | Task 11 SessionListItem code sample defines unused `menuContent` variable | Removed dead code - the variable was defined but never referenced |
| F2 | MEDIUM | Task 8 type declarations missing `export` keyword on GrimoireAPI interface | Added `export` to interface declaration |
| F3 | MEDIUM | Task 12 SessionList uses `React.ReactElement` without importing React | Changed to `ReactElement` with proper import from 'react' |
| F4 | MEDIUM | Task 13 LeftPanelContent destructures `focusOrOpenSession` but calls it in async handler risking stale closures | Changed to use `useUIStore.getState().focusOrOpenSession()` pattern |
| F5 | LOW | Task 10 SessionContextMenu uses `React.ReactNode` and `React.ReactElement` | Changed to import `ReactNode, ReactElement` from 'react' |
| F6 | LOW | Task 17 SessionList.test uses `crypto.randomUUID()` not available in jsdom | Changed to inline ID generation with Math.random() |

**Verified (No Changes Needed):**

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| F7 | LOW | Task 4 sessions:create INSERT statement | Verified correct - 4 columns, 4 values |
| F8 | LOW | Task 11 ContextMenu.Content z-50 | Already present in code sample |
| F9 | INFO | @radix-ui/react-context-menu installation | Task 1 already covers this |
| F10 | INFO | Test setup for jsdom | Project has src/test-setup.ts |

**Conclusion:** All identified issues have been fixed. The tech spec now meets the Ready for Development standard.
