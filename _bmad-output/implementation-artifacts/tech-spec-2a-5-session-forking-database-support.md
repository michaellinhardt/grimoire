---
title: 'Session Forking Database Support'
slug: '2a-5-session-forking-database-support'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Electron', 'TypeScript', 'React', 'SQLite (better-sqlite3)', 'Zustand', 'Zod', 'Vitest']
files_to_modify:
  - 'src/main/sessions/session-scanner.ts'
  - 'src/main/ipc/sessions.ts'
  - 'src/shared/types/ipc.ts'
  - 'src/preload/index.ts'
  - 'src/preload/index.d.ts'
  - 'src/renderer/src/features/sessions/store/useSessionStore.ts'
code_patterns:
  - 'IPC namespace:action pattern'
  - 'Zod validation at boundary'
  - 'snake_case DB to camelCase TS transform'
  - 'Zustand immutable updates'
test_patterns:
  - 'Colocated tests (*.test.ts beside source)'
  - 'Vitest with jsdom for renderer, node for main'
  - 'Mock window.grimoireAPI via Object.defineProperty'
---

# Tech-Spec: Session Forking Database Support

**Created:** 2026-01-23
**Story:** 2a-5-session-forking-database-support

## Overview

### Problem Statement

The system needs to track session lineage (parent-child relationships) and hidden status in the database to support rewind operations. When a user rewinds a session, the current session should be hidden from the default list while preserving history, and the new forked session should track its parent for lineage queries.

### Solution

Extend the existing IPC layer with handlers for:
1. Filtering hidden sessions from `sessions:list`
2. Hiding/unhiding sessions
3. Forking sessions with atomic transaction (create child + hide parent)
4. Querying session lineage (following `forked_from_session_id` chain)
5. UI toggle to show/hide hidden sessions in the store

### Scope

**In Scope:**
- Database query modifications to filter hidden sessions
- IPC handlers for hide/unhide/fork/getLineage operations
- Preload API extensions for new handlers
- Store state for showHiddenSessions toggle
- Unit tests for all new handlers

**Out of Scope:**
- Rewind UI in conversation view (Epic 2b - Story 2b.5)
- Actual CC CLI forking with checkpoints (Epic 3b)
- Session info panel lineage display (Epic 2c)
- Visual indicators for forked sessions (deferred)

## Context for Development

### Codebase Patterns

**IPC Handler Pattern (from `src/main/ipc/sessions.ts`):**
```typescript
ipcMain.handle('sessions:archive', async (_, data: unknown) => {
  const sessionId = SessionIdSchema.parse(data)
  const db = getDatabase()
  db.prepare('UPDATE sessions SET archived = 1 WHERE id = ?').run(sessionId)
  return { success: true }
})
```

**Zod Validation Pattern (from `src/shared/types/ipc.ts`):**
```typescript
export const SessionIdSchema = z.string().uuid()
export const CreateSessionSchema = z.object({
  folderPath: z.string().min(1)
})
```

**Preload API Pattern (from `src/preload/index.ts`):**
```typescript
archive: (sessionId: string): Promise<{ success: boolean }> =>
  ipcRenderer.invoke('sessions:archive', sessionId)
```

**Store Pattern (from `useSessionStore.ts`):**
```typescript
loadSessions: async () => {
  set({ isLoading: true, error: null })
  try {
    const sessions = await window.grimoireAPI.sessions.list()
    set({ sessions, isLoading: false })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions'
    set({ error: errorMessage, isLoading: false })
  }
}
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/main/ipc/sessions.ts` | Existing IPC handlers - patterns for archive/unarchive |
| `src/main/sessions/session-scanner.ts` | `listSessions()` function to extend |
| `src/shared/types/ipc.ts` | Zod schemas - add new schemas here |
| `src/preload/index.ts` | Preload API - add new methods |
| `src/preload/index.d.ts` | TypeScript declarations for preload |
| `src/renderer/src/features/sessions/store/useSessionStore.ts` | Store to add toggle state |
| `src/shared/db/schema.sql` | Reference only - schema already has forking columns |

### Technical Decisions

1. **DB-Level Filtering**: Filter `is_hidden` at the database query level (not just in `selectActiveSessions`) to reduce data transfer when `includeHidden=false`. When `includeHidden=true`, the store receives ALL sessions.

2. **Atomic Fork Transaction**: Use SQLite transaction for fork operation to ensure both session creation AND parent hide happen atomically. No partial state.

3. **Lineage Depth Limit**: Cap lineage queries at 100 depth to prevent infinite loops on corrupted data.

4. **Transient Toggle State**: `showHiddenSessions` is transient UI state per architecture - not persisted to settings table.

5. **Schema Exists**: The DB schema already includes `forked_from_session_id` and `is_hidden` columns. No migration needed.

## Implementation Plan

### Tasks

- [ ] **Task 1: Add Zod schemas for new operations**
  - File: `src/shared/types/ipc.ts`
  - Action: Add three new schemas at the end of the file:
    ```typescript
    // Session Forking Schemas (Story 2a.5)
    export const ListSessionsOptionsSchema = z.object({
      includeHidden: z.boolean().optional().default(false)
    })

    export type ListSessionsOptions = z.infer<typeof ListSessionsOptionsSchema>

    export const ForkSessionSchema = z.object({
      parentSessionId: z.string().uuid(),
      hideParent: z.boolean().optional().default(true)
    })

    export type ForkSessionRequest = z.infer<typeof ForkSessionSchema>

    export const SessionLineageSchema = z.array(z.string().uuid())

    export type SessionLineage = z.infer<typeof SessionLineageSchema>
    ```
  - Notes: Follow existing schema naming convention. Export types for use in preload. NOTE: Do NOT wrap ListSessionsOptionsSchema in `.optional()` - the schema itself defines the object shape; optionality is handled at call site.

- [ ] **Task 2: Update listSessions() to support includeHidden option**
  - File: `src/main/sessions/session-scanner.ts`
  - Action: Modify the `listSessions()` function signature and query. Use two separate prepared statements (NOT string interpolation) for clarity and type safety:
    ```typescript
    export async function listSessions(options?: { includeHidden?: boolean }): Promise<SessionWithExists[]> {
      const db = getDatabase()
      const includeHidden = options?.includeHidden ?? false

      // Use separate prepared statements - avoid string interpolation for SQL
      const rows = includeHidden
        ? db.prepare(`
            SELECT id, folder_path, created_at, updated_at, last_accessed_at,
                   archived, is_pinned, forked_from_session_id, is_hidden
            FROM sessions
            ORDER BY updated_at DESC
          `).all() as DBSessionRow[]
        : db.prepare(`
            SELECT id, folder_path, created_at, updated_at, last_accessed_at,
                   archived, is_pinned, forked_from_session_id, is_hidden
            FROM sessions
            WHERE is_hidden = 0
            ORDER BY updated_at DESC
          `).all() as DBSessionRow[]

      // ... rest unchanged (folder existence checks)
    }
    ```
  - Notes: Default behavior (no options) excludes hidden sessions. IMPORTANT: Use ternary with separate `db.prepare()` calls rather than building query string dynamically - this is clearer and avoids SQL injection patterns even though this specific case would be safe.

- [ ] **Task 3: Update sessions:list IPC handler to pass options**
  - File: `src/main/ipc/sessions.ts`
  - Action: Modify the existing `sessions:list` handler:
    ```typescript
    import { ListSessionsOptionsSchema } from '../../shared/types/ipc'

    ipcMain.handle('sessions:list', async (_, data?: unknown) => {
      const options = data ? ListSessionsOptionsSchema.parse(data) : undefined
      const sessions = await listSessions(options)
      return SessionListSchema.parse(sessions)
    })
    ```
  - Notes: Make data param optional for backward compatibility.

- [ ] **Task 4: Add sessions:hide IPC handler**
  - File: `src/main/ipc/sessions.ts`
  - Action: Add handler after `sessions:unarchive`:
    ```typescript
    // Hide session (Story 2a.5)
    ipcMain.handle('sessions:hide', async (_, data: unknown) => {
      const sessionId = SessionIdSchema.parse(data)
      const db = getDatabase()
      db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(sessionId)
      return { success: true }
    })
    ```
  - Notes: Pattern matches archive handler exactly.

- [ ] **Task 5: Add sessions:unhide IPC handler**
  - File: `src/main/ipc/sessions.ts`
  - Action: Add handler after `sessions:hide`:
    ```typescript
    // Unhide session (Story 2a.5)
    ipcMain.handle('sessions:unhide', async (_, data: unknown) => {
      const sessionId = SessionIdSchema.parse(data)
      const db = getDatabase()
      db.prepare('UPDATE sessions SET is_hidden = 0 WHERE id = ?').run(sessionId)
      return { success: true }
    })
    ```
  - Notes: Pattern matches unarchive handler exactly.

- [ ] **Task 6: Add sessions:fork IPC handler with atomic transaction**
  - File: `src/main/ipc/sessions.ts`
  - Action: Add handler after `sessions:unhide`. NOTE: `randomUUID` is already imported from 'crypto' at the top of this file (used by sessions:create handler).
    ```typescript
    import { ForkSessionSchema } from '../../shared/types/ipc'
    // NOTE: randomUUID already imported at top: import { randomUUID } from 'crypto'

    // Fork session with atomic transaction (Story 2a.5)
    ipcMain.handle('sessions:fork', async (_, data: unknown) => {
      const { parentSessionId, hideParent = true } = ForkSessionSchema.parse(data)
      const db = getDatabase()

      // Validate parent exists
      const parent = db.prepare(
        'SELECT folder_path FROM sessions WHERE id = ?'
      ).get(parentSessionId) as { folder_path: string } | undefined

      if (!parent) {
        throw new Error(`Parent session not found: ${parentSessionId}`)
      }

      const newSessionId = randomUUID()
      const now = Date.now()

      // Atomic transaction: insert child + optionally hide parent
      const forkTransaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO sessions (id, folder_path, created_at, updated_at, forked_from_session_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(newSessionId, parent.folder_path, now, now, parentSessionId)

        if (hideParent) {
          db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(parentSessionId)
        }
      })

      forkTransaction()

      return { sessionId: newSessionId }
    })
    ```
  - Notes: CRITICAL - Uses SQLite transaction for atomicity. Validates parent exists first. The `randomUUID` import already exists in this file from the `sessions:create` handler implementation.

- [ ] **Task 7: Add sessions:getLineage IPC handler with depth limit**
  - File: `src/main/ipc/sessions.ts`
  - Action: Add handler after `sessions:fork`:
    ```typescript
    import { SessionLineageSchema } from '../../shared/types/ipc'

    const MAX_LINEAGE_DEPTH = 100

    // Get session lineage chain (Story 2a.5)
    ipcMain.handle('sessions:getLineage', async (_, data: unknown) => {
      const sessionId = SessionIdSchema.parse(data)
      const db = getDatabase()

      const lineage: string[] = []
      let currentId: string | null = sessionId
      let depth = 0

      const selectStmt = db.prepare(
        'SELECT forked_from_session_id FROM sessions WHERE id = ?'
      )

      while (currentId && depth < MAX_LINEAGE_DEPTH) {
        lineage.push(currentId)
        const row = selectStmt.get(currentId) as { forked_from_session_id: string | null } | undefined
        currentId = row?.forked_from_session_id ?? null
        depth++
      }

      return SessionLineageSchema.parse(lineage)
    })
    ```
  - Notes: CRITICAL - Has max depth limit (100) to prevent infinite loops on corrupted data.

- [ ] **Task 8: Update preload API with new methods**
  - File: `src/preload/index.ts`
  - Action: Add new methods to the sessions object:
    ```typescript
    sessions: {
      // ... existing methods ...
      list: (options?: { includeHidden?: boolean }) =>
        ipcRenderer.invoke('sessions:list', options),
      // New methods (Story 2a.5)
      hide: (sessionId: string): Promise<{ success: boolean }> =>
        ipcRenderer.invoke('sessions:hide', sessionId),
      unhide: (sessionId: string): Promise<{ success: boolean }> =>
        ipcRenderer.invoke('sessions:unhide', sessionId),
      fork: (parentSessionId: string, options?: { hideParent?: boolean }): Promise<{ sessionId: string }> =>
        ipcRenderer.invoke('sessions:fork', { parentSessionId, ...options }),
      getLineage: (sessionId: string): Promise<string[]> =>
        ipcRenderer.invoke('sessions:getLineage', sessionId)
    }
    ```
  - Notes: Update existing `list` method signature to accept options.

- [ ] **Task 9: Update preload TypeScript declarations**
  - File: `src/preload/index.d.ts`
  - Action: Update GrimoireAPI interface:
    ```typescript
    export interface GrimoireAPI {
      sessions: {
        terminate: (sessionId: string) => Promise<{ success: boolean }>
        scan: () => Promise<ScanResult>
        sync: (sessions: DiscoveredSession[]) => Promise<SyncResult>
        list: (options?: { includeHidden?: boolean }) => Promise<SessionWithExists[]>
        updateLastAccessed: (sessionId: string) => Promise<{ success: boolean }>
        getActiveProcesses: () => Promise<string[]>
        archive: (sessionId: string) => Promise<{ success: boolean }>
        unarchive: (sessionId: string) => Promise<{ success: boolean }>
        create: (folderPath: string) => Promise<{ sessionId: string }>
        // New methods (Story 2a.5)
        hide: (sessionId: string) => Promise<{ success: boolean }>
        unhide: (sessionId: string) => Promise<{ success: boolean }>
        fork: (parentSessionId: string, options?: { hideParent?: boolean }) => Promise<{ sessionId: string }>
        getLineage: (sessionId: string) => Promise<string[]>
      }
      dialog: {
        selectFolder: () => Promise<{ canceled: boolean; folderPath: string | null }>
      }
    }
    ```
  - Notes: All return types explicitly declared for type safety.

- [ ] **Task 10: Add showHiddenSessions toggle to useSessionStore**
  - File: `src/renderer/src/features/sessions/store/useSessionStore.ts`
  - Action: Add state and action to the store:
    ```typescript
    interface SessionStoreState {
      // State
      sessions: SessionWithExists[]
      isLoading: boolean
      isScanning: boolean
      error: string | null
      showHiddenSessions: boolean  // NEW

      // Actions
      loadSessions: () => Promise<void>
      triggerScan: () => Promise<SyncResult | null>
      setSessions: (sessions: SessionWithExists[]) => void
      clearError: () => void
      toggleShowHidden: () => void  // NEW
    }

    export const useSessionStore = create<SessionStoreState>((set, get) => ({
      // Initial state
      sessions: [],
      isLoading: false,
      isScanning: false,
      error: null,
      showHiddenSessions: false,  // NEW - default false

      // Actions
      loadSessions: async () => {
        set({ isLoading: true, error: null })
        try {
          const options = { includeHidden: get().showHiddenSessions }
          const sessions = await window.grimoireAPI.sessions.list(options)
          set({ sessions, isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions'
          set({ error: errorMessage, isLoading: false })
        }
      },

      toggleShowHidden: () => {  // NEW
        set((state) => ({ showHiddenSessions: !state.showHiddenSessions }))
        get().loadSessions()  // Reload with new filter
      },

      // ... rest unchanged
    }))
    ```
  - Notes: `toggleShowHidden` flips state AND triggers reload. This is transient UI state, not persisted.

  **IMPORTANT - UI Component Usage**:
  - When `showHiddenSessions = false`: DB returns only non-hidden sessions. Use `selectActiveSessions()` to also filter archived/non-existent.
  - When `showHiddenSessions = true`: DB returns ALL sessions including hidden. UI components should:
    - Use `sessions.filter(s => s.exists && !s.archived)` to show active + hidden sessions
    - OR create a new selector `selectSessionsForDisplay(sessions, showHiddenSessions)` that conditionally includes hidden
  - The existing `selectActiveSessions()` filters OUT hidden sessions, so it should NOT be used when `showHiddenSessions = true`.
  - **Recommendation**: Add a new selector in this task:
    ```typescript
    export const selectDisplayableSessions = (
      sessions: SessionWithExists[],
      showHidden: boolean
    ): SessionWithExists[] => {
      return sessions.filter((s) =>
        s.exists && !s.archived && (showHidden || !s.isHidden)
      )
    }
    ```

- [ ] **Task 11: Create IPC handler tests**
  - File: `src/main/ipc/sessions.test.ts` (create new file)
  - Action: Create test file with tests for new handlers.

  **IMPORTANT - Testing IPC Handlers**: Since `ipcMain.handle()` handlers cannot be invoked directly in tests, extract the handler logic into separate testable functions. Alternative approach: test the `listSessions()` function directly in `session-scanner.test.ts` and focus IPC tests on integration with mock Electron.

  **Recommended Pattern** - Extract logic for testability:
    ```typescript
    // In sessions.ts - extract handler logic
    export async function hideSession(sessionId: string): Promise<{ success: boolean }> {
      const db = getDatabase()
      db.prepare('UPDATE sessions SET is_hidden = 1 WHERE id = ?').run(sessionId)
      return { success: true }
    }

    // IPC handler just validates and delegates
    ipcMain.handle('sessions:hide', async (_, data: unknown) => {
      const sessionId = SessionIdSchema.parse(data)
      return hideSession(sessionId)
    })
    ```

  **Test file structure**:
    ```typescript
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
    import { getDatabase } from '../db'

    // Mock better-sqlite3
    vi.mock('../db', () => ({
      getDatabase: vi.fn()
    }))

    // Import the extracted functions (not the IPC registration)
    import { hideSession, unhideSession, forkSession, getSessionLineage } from './sessions'

    describe('sessions handler logic', () => {
      let mockDb: {
        prepare: ReturnType<typeof vi.fn>
        transaction: ReturnType<typeof vi.fn>
      }

      beforeEach(() => {
        mockDb = {
          prepare: vi.fn().mockReturnValue({
            run: vi.fn().mockReturnValue({ changes: 1 }),
            get: vi.fn(),
            all: vi.fn()
          }),
          transaction: vi.fn((fn) => fn)
        }
        vi.mocked(getDatabase).mockReturnValue(mockDb as any)
      })

      describe('hideSession', () => {
        it('should set is_hidden to 1 for valid session', async () => {
          await hideSession('550e8400-e29b-41d4-a716-446655440000')
          expect(mockDb.prepare).toHaveBeenCalledWith(
            'UPDATE sessions SET is_hidden = 1 WHERE id = ?'
          )
        })
      })

      describe('forkSession', () => {
        it('should use atomic transaction', async () => {
          mockDb.prepare.mockReturnValueOnce({
            get: vi.fn().mockReturnValue({ folder_path: '/test/path' })
          })
          await forkSession('parent-id', true)
          expect(mockDb.transaction).toHaveBeenCalled()
        })
      })

      describe('getSessionLineage', () => {
        it('should respect max depth limit', async () => {
          // Create a mock that always returns a parent (simulating circular ref)
          const mockGet = vi.fn().mockReturnValue({ forked_from_session_id: 'parent-id' })
          mockDb.prepare.mockReturnValue({ get: mockGet })

          const lineage = await getSessionLineage('start-id')

          // Should cap at MAX_LINEAGE_DEPTH (100)
          expect(lineage.length).toBeLessThanOrEqual(100)
        })
      })
    })
    ```
  - Notes: Tests colocated with handlers in `src/main/ipc/`. This pattern extracts logic for testability while keeping IPC handlers thin.

- [ ] **Task 12: Add store toggle tests**
  - File: `src/renderer/src/features/sessions/store/useSessionStore.test.ts` (file ALREADY EXISTS - add to existing tests)
  - Action: Add new describe block AFTER existing tests for toggle behavior:
    ```typescript
    // ADD this describe block after the existing 'selectors' describe block

    describe('showHiddenSessions toggle', () => {
      beforeEach(() => {
        // Reset store state including new field
        useSessionStore.setState({
          sessions: [],
          isLoading: false,
          isScanning: false,
          error: null,
          showHiddenSessions: false  // NEW
        })
        vi.clearAllMocks()
      })

      it('should default showHiddenSessions to false', () => {
        expect(useSessionStore.getState().showHiddenSessions).toBe(false)
      })

      it('should toggle showHiddenSessions state', () => {
        expect(useSessionStore.getState().showHiddenSessions).toBe(false)

        act(() => {
          useSessionStore.getState().toggleShowHidden()
        })

        expect(useSessionStore.getState().showHiddenSessions).toBe(true)
      })

      it('should call loadSessions after toggle', async () => {
        mockGrimoireAPI.sessions.list.mockResolvedValueOnce([])

        await act(async () => {
          useSessionStore.getState().toggleShowHidden()
        })

        // loadSessions was called (indirectly verified by list being called)
        expect(mockGrimoireAPI.sessions.list).toHaveBeenCalled()
      })

      it('should pass includeHidden: true when showHiddenSessions is true', async () => {
        // First toggle to true
        useSessionStore.setState({ showHiddenSessions: true })
        mockGrimoireAPI.sessions.list.mockResolvedValueOnce([])

        await act(async () => {
          await useSessionStore.getState().loadSessions()
        })

        expect(mockGrimoireAPI.sessions.list).toHaveBeenCalledWith({ includeHidden: true })
      })

      it('should pass includeHidden: false when showHiddenSessions is false', async () => {
        useSessionStore.setState({ showHiddenSessions: false })
        mockGrimoireAPI.sessions.list.mockResolvedValueOnce([])

        await act(async () => {
          await useSessionStore.getState().loadSessions()
        })

        expect(mockGrimoireAPI.sessions.list).toHaveBeenCalledWith({ includeHidden: false })
      })
    })
    ```
  - Notes: This file ALREADY EXISTS at the specified path. Add the new describe block after the existing 'selectors' tests. The mock setup (mockGrimoireAPI) is already defined at the top of the file. Also update the beforeEach in existing tests to include `showHiddenSessions: false` in the setState call.

- [ ] **Task 13: Run validation**
  - Action: Run `npm run validate` (tsc + vitest + lint)
  - Verify:
    - [ ] No TypeScript errors
    - [ ] All tests pass
    - [ ] No lint errors
  - Notes: Fix any issues before marking complete.

### Acceptance Criteria

- [ ] **AC 1:** Given the database has sessions with `is_hidden = 1`, when calling `sessions:list` without options, then hidden sessions are excluded from the result.

- [ ] **AC 2:** Given the database has sessions with `is_hidden = 1`, when calling `sessions:list` with `{ includeHidden: true }`, then ALL sessions (including hidden) are returned.

- [ ] **AC 3:** Given a valid session ID, when calling `sessions:hide`, then that session's `is_hidden` column is set to 1 and `{ success: true }` is returned.

- [ ] **AC 4:** Given a valid session ID, when calling `sessions:unhide`, then that session's `is_hidden` column is set to 0 and `{ success: true }` is returned.

- [ ] **AC 5:** Given a valid parent session ID, when calling `sessions:fork` with `hideParent: true` (default), then a new session is created with `forked_from_session_id` set to parent AND parent's `is_hidden` is set to 1 atomically.

- [ ] **AC 6:** Given a valid parent session ID, when calling `sessions:fork` with `hideParent: false`, then a new session is created with `forked_from_session_id` set to parent AND parent remains visible.

- [ ] **AC 7:** Given an invalid parent session ID, when calling `sessions:fork`, then an error is thrown with message "Parent session not found: {id}".

- [ ] **AC 8:** Given a session with lineage depth 3 (A <- B <- C), when calling `sessions:getLineage(C)`, then `[C, B, A]` is returned (current to root).

- [ ] **AC 9:** Given a session with lineage depth > 100, when calling `sessions:getLineage`, then the result is capped at 100 entries to prevent infinite loops. **Testing note**: This AC is tested by mocking the database to return a circular reference (session A -> session A) and verifying the result array length is exactly 100, not by creating 101+ real sessions.

- [ ] **AC 10:** Given `showHiddenSessions = false` in store, when calling `toggleShowHidden()`, then state becomes `true` AND `loadSessions()` is called with `{ includeHidden: true }`.

## Additional Context

### Dependencies

**Existing (verified in package.json):**
- `better-sqlite3` - Database operations with transaction support
- `zod` - Schema validation at IPC boundary
- `zustand` - State management in renderer
- `electron` - IPC communication

**No new dependencies required.**

### Testing Strategy

**Unit Tests:**
- IPC handlers (`src/main/ipc/sessions.test.ts`)
  - Mock `getDatabase()` to return mock db object
  - Verify SQL queries and parameters
  - Test error cases (invalid UUID, parent not found)
  - Test transaction usage for fork

- Store tests (`useSessionStore.test.ts`)
  - Mock `window.grimoireAPI.sessions.list`
  - Test toggle state changes
  - Verify reload triggered after toggle

**Integration Tests (Manual):**
1. Create a session, fork it, verify parent is hidden
2. Toggle "show hidden" and verify parent appears
3. Check lineage returns correct chain
4. Unhide a session and verify it appears in default list

### Notes

**High-Risk Items:**
- Transaction atomicity for fork operation - if transaction fails mid-way, neither operation should persist
- Lineage depth limit - must prevent infinite loops on corrupted data (self-referencing `forked_from_session_id`)

**Known Limitations:**
- No UI for showing/toggling hidden sessions yet (deferred to Epic 2c)
- No visual indicator for forked sessions in the list (deferred)

**Future Considerations:**
- May want `sessions:getChildren(sessionId)` to show all forks of a session
- May want to cascade hide/unhide to all descendants
- Lineage visualization in session info panel (Epic 2c)

## References

- Story file: `/Users/teazyou/dev/grimoire/_bmad-output/implementation-artifacts/2a-5-session-forking-database-support.md`
- Architecture: `/Users/teazyou/dev/grimoire/_bmad-output/planning-artifacts/architecture.md`
- Project context: `/Users/teazyou/dev/grimoire/_bmad-output/project-context.md`

---

## Change Log

- **2026-01-23 Review Pass 2** - Adversarial review identified 2 HIGH + 5 MEDIUM + 3 LOW issues. All fixed:
  - **F1 (HIGH)**: Fixed Task 2 to use separate prepared statements instead of string interpolation for SQL
  - **F2 (HIGH)**: Clarified backward compatibility for list() signature change - no breaking change since data param is optional
  - **F3 (MEDIUM)**: Added detailed guidance in Task 11 for testing IPC handlers by extracting handler logic to testable functions
  - **F4 (MEDIUM)**: Added note in Task 6 that randomUUID is already imported (no additional import needed)
  - **F5 (MEDIUM)**: Fixed Task 12 to indicate file ALREADY EXISTS and to add tests after existing describe blocks
  - **F6 (LOW)**: Acknowledged but deferred - hide/unhide silent success on non-existent ID matches existing archive pattern
  - **F7 (LOW)**: Fixed Task 1 schema - removed erroneous `.optional()` wrapper from ListSessionsOptionsSchema
  - **F8 (LOW)**: Added testing note to AC 9 explaining how to test depth limit via mock circular reference
  - **F9 (LOW)**: Acknowledged - selecting is_hidden column even when filtering is minor; no fix needed
  - **F10 (MEDIUM)**: Added detailed usage guidance in Task 10 for selectActiveSessions vs new selectDisplayableSessions selector
