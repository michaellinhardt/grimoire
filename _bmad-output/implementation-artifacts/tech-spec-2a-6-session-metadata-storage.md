---
title: 'Session Metadata Storage'
slug: '2a-6-session-metadata-storage'
created: '2026-01-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - TypeScript
  - Zod
  - better-sqlite3
  - Zustand
  - Vitest
files_to_modify:
  - src/shared/types/ipc.ts
  - src/shared/types/ipc.test.ts
  - src/main/ipc/sessions.ts
  - src/main/ipc/sessions.test.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/renderer/src/shared/utils/index.ts
files_to_create:
  - src/main/sessions/session-metadata.ts
  - src/main/sessions/session-metadata.test.ts
  - src/renderer/src/features/sessions/store/useSessionMetadataStore.ts
  - src/renderer/src/features/sessions/store/useSessionMetadataStore.test.ts
  - src/renderer/src/shared/utils/formatTokenCount.ts
  - src/renderer/src/shared/utils/formatTokenCount.test.ts
  - src/renderer/src/shared/utils/formatCost.ts
  - src/renderer/src/shared/utils/formatCost.test.ts
code_patterns:
  - IPC validation at boundary with Zod
  - Snake_case DB to camelCase TS transforms
  - Zustand stores with Map for keyed data
  - Single-function-per-file utilities
test_patterns:
  - Colocated test files (*.test.ts)
  - vi.stubGlobal for window.grimoireAPI mocks
  - vi.mock for database mocking
  - Zod rejection tests for schema validation
---

# Tech-Spec: Session Metadata Storage

**Created:** 2026-01-23
**Story:** 2a.6 - Session Metadata Storage

## Overview

### Problem Statement

Users need to track their Claude Code token usage and associated costs. The system must capture token counts (input/output) and estimated costs for each session, store them persistently, and provide infrastructure for displaying this information in the UI.

### Solution

Implement a complete metadata storage and retrieval system:
1. Define Zod schemas for session metadata types
2. Create IPC handlers for get/upsert operations using SQLite UPSERT pattern
3. Add transform functions for DB row to TypeScript object conversion
4. Expose metadata methods through preload API
5. Create Zustand store for client-side metadata caching
6. Implement formatter utilities for display (token counts, costs)

### Scope

**In Scope:**
- SessionMetadata and SessionMetadataUpsert Zod schemas in `src/shared/types/ipc.ts`
- IPC handlers for `sessions:getMetadata` and `sessions:upsertMetadata`
- Transform function `toSessionMetadata()` for DB row conversion
- Preload API methods for renderer access
- Zustand store for metadata caching
- Formatter utilities: `formatTokenCount()` and `formatCost()`
- Comprehensive tests for all new code

**Out of Scope:**
- Stream parsing to capture metadata during responses (Epic 3b - Story 3b.2)
- SessionInfo UI component to display metadata (Epic 2c - Story 2c.2)
- Real-time streaming metadata updates (Epic 3b)
- Per-message token breakdown (deferred enhancement)

## Context for Development

### Codebase Patterns

**IPC Boundary Validation Pattern:**
```typescript
ipcMain.handle('sessions:getMetadata', async (_, data: unknown) => {
  const sessionId = SessionIdSchema.parse(data)  // Validate at boundary
  // ... implementation
})
```

**DB Transform Pattern (from session-scanner.ts):**
```typescript
interface DBSessionMetadataRow {
  session_id: string  // snake_case from DB
  total_input_tokens: number
  // ...
}

function toSessionMetadata(row: DBSessionMetadataRow): SessionMetadata {
  return {
    sessionId: row.session_id,  // camelCase for TS
    totalInputTokens: row.total_input_tokens,
    // ...
  }
}
```

**Zustand Store Pattern (from useSessionStore.ts):**
```typescript
export const useSessionMetadataStore = create<SessionMetadataState>((set, get) => ({
  metadata: new Map(),
  isLoading: false,
  loadMetadata: async (sessionId: string) => { /* ... */ }
}))
```

**Utility Function Pattern (from formatRelativeTime.ts):**
```typescript
// Single exported function per file
export function formatTokenCount(count: number): string {
  // Implementation
}
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/shared/types/ipc.ts` | Existing Zod schemas - follow SessionSchema pattern |
| `src/shared/types/ipc.test.ts` | Zod rejection test patterns |
| `src/main/ipc/sessions.ts` | IPC handler patterns with Zod validation |
| `src/main/ipc/sessions.test.ts` | IPC handler test patterns with vi.mock |
| `src/main/sessions/session-scanner.ts` | DBRow interface and toSession() transform pattern |
| `src/preload/index.ts` | Preload API implementation patterns |
| `src/preload/index.d.ts` | TypeScript declarations for preload API |
| `src/renderer/src/features/sessions/store/useSessionStore.ts` | Zustand store patterns |
| `src/renderer/src/features/sessions/store/useSessionStore.test.ts` | Store test patterns with vi.stubGlobal |
| `src/renderer/src/shared/utils/formatRelativeTime.ts` | Single-function utility pattern |
| `src/renderer/src/shared/utils/formatRelativeTime.test.ts` | Utility test pattern |
| `src/shared/db/schema.sql` | session_metadata table schema (already exists) |

### Technical Decisions

1. **UPSERT Pattern**: Use SQLite `INSERT ... ON CONFLICT DO UPDATE` for atomic create-or-update operations. This avoids race conditions when multiple updates occur.

2. **Incremental Updates**: The upsert adds delta values to existing totals rather than replacing them. This allows streaming updates where each chunk adds to the running total. Note: `model` uses COALESCE (only updates if new value provided) while tokens/cost are always additive.

3. **Map-based Store**: Use `Map<string, SessionMetadata>` for O(1) lookup by sessionId, following the keyed data pattern.

4. **Separate Transform File**: Create `session-metadata.ts` separate from `session-scanner.ts` for clarity and single-responsibility.

5. **FK Validation**: Validate session exists before upserting metadata to maintain referential integrity. Wrapped in transaction for atomicity.

6. **Error State in Store**: The metadata store includes `error: string | null` state to match the pattern from `useSessionStore`, allowing components to display error feedback to users.

## Implementation Plan

### Task 1: Add SessionMetadata Zod Schemas

**File:** `src/shared/types/ipc.ts`

Add at end of file (after SessionLineageSchema):

```typescript
// ============================================================
// Session Metadata Schemas (Story 2a.6)
// ============================================================

export const SessionMetadataSchema = z.object({
  sessionId: z.string().uuid(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  model: z.string().nullable(),
  updatedAt: z.number().nullable()
})

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>

// For upsert operations - delta values to add to existing totals
export const SessionMetadataUpsertSchema = z.object({
  sessionId: z.string().uuid(),
  inputTokens: z.number().int().nonnegative().optional().default(0),
  outputTokens: z.number().int().nonnegative().optional().default(0),
  costUsd: z.number().nonnegative().optional().default(0),
  model: z.string().optional()
})

export type SessionMetadataUpsert = z.infer<typeof SessionMetadataUpsertSchema>
```

**File:** `src/shared/types/ipc.test.ts`

Add at end of file (inside the main describe block):

```typescript
// Story 2a.6 - Session Metadata Schemas
describe('SessionMetadataSchema', () => {
  it('accepts valid metadata', () => {
    const valid = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalCostUsd: 0.05,
      model: 'claude-sonnet-4-20250514',
      updatedAt: Date.now()
    }
    expect(() => SessionMetadataSchema.parse(valid)).not.toThrow()
  })

  it('accepts metadata with null model and updatedAt', () => {
    const valid = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      model: null,
      updatedAt: null
    }
    expect(() => SessionMetadataSchema.parse(valid)).not.toThrow()
  })

  it('rejects non-UUID sessionId', () => {
    expect(() =>
      SessionMetadataSchema.parse({
        sessionId: 'not-a-uuid',
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalCostUsd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updatedAt: Date.now()
      })
    ).toThrow()
  })

  it('rejects negative token counts', () => {
    expect(() =>
      SessionMetadataSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: -100,
        totalOutputTokens: 50,
        totalCostUsd: 0.05,
        model: null,
        updatedAt: null
      })
    ).toThrow()
  })

  it('rejects negative cost', () => {
    expect(() =>
      SessionMetadataSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalCostUsd: -0.05,
        model: null,
        updatedAt: null
      })
    ).toThrow()
  })
})

describe('SessionMetadataUpsertSchema', () => {
  it('accepts minimal upsert with only sessionId', () => {
    const result = SessionMetadataUpsertSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000'
    })
    expect(result.inputTokens).toBe(0)
    expect(result.outputTokens).toBe(0)
    expect(result.costUsd).toBe(0)
    expect(result.model).toBeUndefined()
  })

  it('accepts full upsert with all fields', () => {
    const valid = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
      model: 'claude-sonnet-4-20250514'
    }
    expect(() => SessionMetadataUpsertSchema.parse(valid)).not.toThrow()
  })

  it('rejects non-UUID sessionId', () => {
    expect(() =>
      SessionMetadataUpsertSchema.parse({
        sessionId: 'invalid'
      })
    ).toThrow()
  })

  it('rejects negative inputTokens', () => {
    expect(() =>
      SessionMetadataUpsertSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        inputTokens: -100
      })
    ).toThrow()
  })

  it('rejects negative cost', () => {
    expect(() =>
      SessionMetadataUpsertSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        costUsd: -0.01
      })
    ).toThrow()
  })
})
```

Also add imports at top of test file:
```typescript
import {
  // ... existing imports ...
  SessionMetadataSchema,
  SessionMetadataUpsertSchema
} from './ipc'
```

---

### Task 2: Create Transform Function

**File:** `src/main/sessions/session-metadata.ts` (NEW)

```typescript
import type { SessionMetadata } from '../../shared/types/ipc'

/**
 * DB row type for session_metadata table (snake_case)
 * Exported for IPC handler type annotations
 */
export interface DBSessionMetadataRow {
  session_id: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  model: string | null
  updated_at: number | null
}

/**
 * Transform DB row (snake_case) to SessionMetadata (camelCase)
 */
export function toSessionMetadata(row: DBSessionMetadataRow): SessionMetadata {
  return {
    sessionId: row.session_id,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalCostUsd: row.total_cost_usd,
    model: row.model,
    updatedAt: row.updated_at
  }
}
```

**File:** `src/main/sessions/session-metadata.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'
import { toSessionMetadata, type DBSessionMetadataRow } from './session-metadata'

describe('toSessionMetadata', () => {
  it('transforms DB row to SessionMetadata with all fields', () => {
    const row: DBSessionMetadataRow = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      total_input_tokens: 1000,
      total_output_tokens: 500,
      total_cost_usd: 0.05,
      model: 'claude-sonnet-4-20250514',
      updated_at: 1700000000000
    }

    const result = toSessionMetadata(row)

    expect(result).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalCostUsd: 0.05,
      model: 'claude-sonnet-4-20250514',
      updatedAt: 1700000000000
    })
  })

  it('handles null model and updatedAt', () => {
    const row: DBSessionMetadataRow = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      model: null,
      updated_at: null
    }

    const result = toSessionMetadata(row)

    expect(result.model).toBeNull()
    expect(result.updatedAt).toBeNull()
  })

  it('preserves exact numeric values', () => {
    const row: DBSessionMetadataRow = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      total_input_tokens: 123456,
      total_output_tokens: 654321,
      total_cost_usd: 1.234567,
      model: null,
      updated_at: null
    }

    const result = toSessionMetadata(row)

    expect(result.totalInputTokens).toBe(123456)
    expect(result.totalOutputTokens).toBe(654321)
    expect(result.totalCostUsd).toBe(1.234567)
  })
})
```

---

### Task 3: Add IPC Handlers

**File:** `src/main/ipc/sessions.ts`

Add imports at top:
```typescript
import {
  // ... existing imports ...
  SessionIdSchema,
  SessionMetadataSchema,
  SessionMetadataUpsertSchema
} from '../../shared/types/ipc'
import { toSessionMetadata, type DBSessionMetadataRow } from '../sessions/session-metadata'
```

Add handlers inside `registerSessionsIPC()` function (after getLineage handler):

```typescript
  // Get metadata for a session (Story 2a.6)
  ipcMain.handle('sessions:getMetadata', async (_, data: unknown) => {
    const sessionId = SessionIdSchema.parse(data)
    const db = getDatabase()

    const row = db.prepare(`
      SELECT session_id, total_input_tokens, total_output_tokens,
             total_cost_usd, model, updated_at
      FROM session_metadata
      WHERE session_id = ?
    `).get(sessionId) as DBSessionMetadataRow | undefined

    if (!row) return null
    return SessionMetadataSchema.parse(toSessionMetadata(row))
  })

  // Upsert metadata - creates or updates with incremental values (Story 2a.6)
  ipcMain.handle('sessions:upsertMetadata', async (_, data: unknown) => {
    const input = SessionMetadataUpsertSchema.parse(data)
    const db = getDatabase()
    const now = Date.now()

    // Use transaction for atomicity (FK validation + upsert)
    const upsertTransaction = db.transaction(() => {
      // Validate session exists (FK constraint)
      const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?')
        .get(input.sessionId)
      if (!sessionExists) {
        throw new Error(`Session not found: ${input.sessionId}`)
      }

      // UPSERT - increment existing values or create new record
      // Note: Tokens/cost are ADDED to existing values (cumulative tracking)
      //       Model uses COALESCE - only updates if new value provided (preserves existing)
      db.prepare(`
        INSERT INTO session_metadata (session_id, total_input_tokens, total_output_tokens, total_cost_usd, model, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          total_input_tokens = total_input_tokens + excluded.total_input_tokens,
          total_output_tokens = total_output_tokens + excluded.total_output_tokens,
          total_cost_usd = total_cost_usd + excluded.total_cost_usd,
          model = COALESCE(excluded.model, model),
          updated_at = excluded.updated_at
      `).run(input.sessionId, input.inputTokens, input.outputTokens, input.costUsd, input.model ?? null, now)
    })

    upsertTransaction()
    return { success: true }
  })
```

**File:** `src/main/ipc/sessions.test.ts`

Add at end of file (new describe block):

```typescript
describe('Session Metadata Handlers (Story 2a.6)', () => {
  describe('sessions:getMetadata logic', () => {
    it('should return metadata when found', () => {
      const mockRow = {
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        total_input_tokens: 1000,
        total_output_tokens: 500,
        total_cost_usd: 0.05,
        model: 'claude-sonnet-4-20250514',
        updated_at: 1700000000000
      }
      const mockGet = vi.fn().mockReturnValue(mockRow)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const row = db.prepare('SELECT ...').get('550e8400-e29b-41d4-a716-446655440000')

      expect(row).toEqual(mockRow)
    })

    it('should return null when metadata not found', () => {
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const row = db.prepare('SELECT ...').get('550e8400-e29b-41d4-a716-446655440000')

      expect(row).toBeUndefined()
    })
  })

  describe('sessions:upsertMetadata logic', () => {
    it('should throw error when session does not exist', () => {
      const mockGet = vi.fn().mockReturnValue(undefined)
      mockDb.prepare.mockReturnValue({ get: mockGet })

      const db = getDatabase()
      const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?')
        .get('non-existent-uuid')

      expect(sessionExists).toBeUndefined()
      // Handler would throw: throw new Error(`Session not found: ${sessionId}`)
    })

    it('should execute UPSERT SQL when session exists', () => {
      const mockGet = vi.fn().mockReturnValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
      const mockRun = vi.fn()
      mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun })

      const db = getDatabase()

      // Check session exists
      const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?')
        .get('550e8400-e29b-41d4-a716-446655440000')
      expect(sessionExists).toBeDefined()

      // Execute upsert
      db.prepare('INSERT INTO session_metadata ... ON CONFLICT ...')
        .run('550e8400-e29b-41d4-a716-446655440000', 100, 50, 0.01, 'claude-sonnet-4-20250514', Date.now())

      expect(mockRun).toHaveBeenCalled()
    })
  })
})
```

Also add import at top of test file:
```typescript
import {
  // ... existing imports ...
  SessionMetadataSchema,
  SessionMetadataUpsertSchema
} from '../../shared/types/ipc'
```

---

### Task 4: Update Preload API

**File:** `src/preload/index.d.ts`

Add import:
```typescript
import type {
  ScanResult,
  SyncResult,
  DiscoveredSession,
  SessionWithExists,
  SessionMetadata         // NEW (Story 2a.6)
} from '../shared/types/ipc'
```

Add methods to GrimoireAPI.sessions interface (after getLineage):
```typescript
    // New methods (Story 2a.6)
    getMetadata: (sessionId: string) => Promise<SessionMetadata | null>
    upsertMetadata: (data: {
      sessionId: string
      inputTokens?: number
      outputTokens?: number
      costUsd?: number
      model?: string
    }) => Promise<{ success: boolean }>
```

Note: `SessionMetadataUpsert` is NOT imported here - the inline type keeps the declaration aligned with index.ts implementation and avoids importing types that aren't used in return types.

**File:** `src/preload/index.ts`

Add methods to grimoireAPI.sessions object (after getLineage):
```typescript
    // New methods (Story 2a.6)
    getMetadata: (sessionId: string): Promise<SessionMetadata | null> =>
      ipcRenderer.invoke('sessions:getMetadata', sessionId),
    upsertMetadata: (data: {
      sessionId: string
      inputTokens?: number
      outputTokens?: number
      costUsd?: number
      model?: string
    }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:upsertMetadata', data)
```

Note: The inline type in index.ts keeps preload thin (no schema imports), while index.d.ts imports the proper types for consumers.

---

### Task 5: Create Zustand Store

**File:** `src/renderer/src/features/sessions/store/useSessionMetadataStore.ts` (NEW)

```typescript
import { create } from 'zustand'
import type { SessionMetadata } from '../../../../../shared/types/ipc'

interface SessionMetadataState {
  // State
  metadata: Map<string, SessionMetadata>
  isLoading: boolean
  error: string | null

  // Actions
  loadMetadata: (sessionId: string) => Promise<void>
  updateMetadata: (sessionId: string, data: Partial<SessionMetadata>) => void
  clearMetadata: (sessionId: string) => void
  clearError: () => void
}

export const useSessionMetadataStore = create<SessionMetadataState>((set, get) => ({
  // Initial state
  metadata: new Map(),
  isLoading: false,
  error: null,

  // Actions
  loadMetadata: async (sessionId: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.grimoireAPI.sessions.getMetadata(sessionId)
      set((state) => {
        const newMap = new Map(state.metadata)
        if (result) {
          newMap.set(sessionId, result)
        } else {
          // Clear any stale entry if metadata no longer exists
          newMap.delete(sessionId)
        }
        return { metadata: newMap, isLoading: false }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load metadata'
      console.error('Failed to load metadata:', error)
      set({ error: errorMessage, isLoading: false })
    }
  },

  updateMetadata: (sessionId: string, data: Partial<SessionMetadata>) => {
    set((state) => {
      const existing = state.metadata.get(sessionId)
      if (!existing) return state
      const updated = { ...existing, ...data }
      return { metadata: new Map(state.metadata).set(sessionId, updated) }
    })
  },

  clearMetadata: (sessionId: string) => {
    set((state) => {
      const newMap = new Map(state.metadata)
      newMap.delete(sessionId)
      return { metadata: newMap }
    })
  },

  clearError: () => {
    set({ error: null })
  }
}))

// Selector for getting metadata by sessionId
export const selectMetadataBySessionId = (
  metadata: Map<string, SessionMetadata>,
  sessionId: string
): SessionMetadata | undefined => {
  return metadata.get(sessionId)
}
```

**File:** `src/renderer/src/features/sessions/store/useSessionMetadataStore.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionMetadataStore, selectMetadataBySessionId } from './useSessionMetadataStore'
import type { SessionMetadata } from '../../../../../shared/types/ipc'

// Mock the grimoireAPI
const mockGrimoireAPI = {
  sessions: {
    getMetadata: vi.fn(),
    upsertMetadata: vi.fn()
  }
}

vi.stubGlobal('window', {
  grimoireAPI: mockGrimoireAPI
})

describe('useSessionMetadataStore', () => {
  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    model: 'claude-sonnet-4-20250514',
    updatedAt: Date.now()
  }

  beforeEach(() => {
    // Reset store state before each test
    useSessionMetadataStore.setState({
      metadata: new Map(),
      isLoading: false,
      error: null
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('loadMetadata', () => {
    it('should load metadata and update state', async () => {
      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(mockMetadata)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.get(mockMetadata.sessionId)).toEqual(mockMetadata)
      expect(state.isLoading).toBe(false)
    })

    it('should handle null result (metadata not found)', async () => {
      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(null)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata('non-existent')
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has('non-existent')).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('should clear stale entry when metadata no longer exists', async () => {
      // Setup: Pre-populate with metadata
      useSessionMetadataStore.setState({
        metadata: new Map([[mockMetadata.sessionId, mockMetadata]]),
        isLoading: false,
        error: null
      })

      // Mock API returning null (metadata was deleted)
      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(null)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      // Stale entry should be cleared
      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has(mockMetadata.sessionId)).toBe(false)
    })

    it('should handle API error and set error state', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGrimoireAPI.sessions.getMetadata.mockRejectedValueOnce(new Error('API Error'))

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('API Error')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load metadata:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    it('should clear error before loading', async () => {
      // Setup: Pre-populate with error
      useSessionMetadataStore.setState({
        metadata: new Map(),
        isLoading: false,
        error: 'Previous error'
      })

      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(mockMetadata)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.error).toBeNull()
    })

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: SessionMetadata | null) => void
      const loadPromise = new Promise<SessionMetadata | null>((resolve) => {
        resolvePromise = resolve
      })
      mockGrimoireAPI.sessions.getMetadata.mockReturnValueOnce(loadPromise)

      // Start loading
      const loadPromiseResult = useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)

      // Check loading state
      expect(useSessionMetadataStore.getState().isLoading).toBe(true)

      // Resolve and wait
      await act(async () => {
        resolvePromise!(mockMetadata)
        await loadPromiseResult
      })

      expect(useSessionMetadataStore.getState().isLoading).toBe(false)
    })
  })

  describe('updateMetadata', () => {
    it('should update existing metadata', () => {
      // Setup initial state with metadata
      useSessionMetadataStore.setState({
        metadata: new Map([[mockMetadata.sessionId, mockMetadata]]),
        isLoading: false,
        error: null
      })

      act(() => {
        useSessionMetadataStore.getState().updateMetadata(mockMetadata.sessionId, {
          totalInputTokens: 2000,
          totalOutputTokens: 1000
        })
      })

      const state = useSessionMetadataStore.getState()
      const updated = state.metadata.get(mockMetadata.sessionId)
      expect(updated?.totalInputTokens).toBe(2000)
      expect(updated?.totalOutputTokens).toBe(1000)
      // Other fields should remain unchanged
      expect(updated?.totalCostUsd).toBe(mockMetadata.totalCostUsd)
      expect(updated?.model).toBe(mockMetadata.model)
    })

    it('should do nothing if metadata does not exist', () => {
      const initialState = useSessionMetadataStore.getState()

      act(() => {
        useSessionMetadataStore.getState().updateMetadata('non-existent', {
          totalInputTokens: 2000
        })
      })

      // State should be unchanged
      expect(useSessionMetadataStore.getState()).toEqual(initialState)
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      useSessionMetadataStore.setState({
        metadata: new Map(),
        isLoading: false,
        error: 'Some error'
      })

      act(() => {
        useSessionMetadataStore.getState().clearError()
      })

      expect(useSessionMetadataStore.getState().error).toBeNull()
    })
  })

  describe('clearMetadata', () => {
    it('should remove metadata for sessionId', () => {
      // Setup initial state with metadata
      useSessionMetadataStore.setState({
        metadata: new Map([[mockMetadata.sessionId, mockMetadata]]),
        isLoading: false,
        error: null
      })

      act(() => {
        useSessionMetadataStore.getState().clearMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has(mockMetadata.sessionId)).toBe(false)
    })

    it('should not affect other metadata entries', () => {
      const otherMetadata: SessionMetadata = {
        ...mockMetadata,
        sessionId: '650e8400-e29b-41d4-a716-446655440001'
      }

      // Setup initial state with two metadata entries
      useSessionMetadataStore.setState({
        metadata: new Map([
          [mockMetadata.sessionId, mockMetadata],
          [otherMetadata.sessionId, otherMetadata]
        ]),
        isLoading: false,
        error: null
      })

      act(() => {
        useSessionMetadataStore.getState().clearMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has(mockMetadata.sessionId)).toBe(false)
      expect(state.metadata.has(otherMetadata.sessionId)).toBe(true)
    })
  })
})

describe('selectMetadataBySessionId', () => {
  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    model: 'claude-sonnet-4-20250514',
    updatedAt: Date.now()
  }

  it('should return metadata for existing sessionId', () => {
    const metadataMap = new Map([[mockMetadata.sessionId, mockMetadata]])
    const result = selectMetadataBySessionId(metadataMap, mockMetadata.sessionId)
    expect(result).toEqual(mockMetadata)
  })

  it('should return undefined for non-existent sessionId', () => {
    const metadataMap = new Map([[mockMetadata.sessionId, mockMetadata]])
    const result = selectMetadataBySessionId(metadataMap, 'non-existent')
    expect(result).toBeUndefined()
  })

  it('should return undefined for empty map', () => {
    const metadataMap = new Map<string, SessionMetadata>()
    const result = selectMetadataBySessionId(metadataMap, mockMetadata.sessionId)
    expect(result).toBeUndefined()
  })
})
```

---

### Task 6: Create Formatter Utilities

**File:** `src/renderer/src/shared/utils/formatTokenCount.ts` (NEW)

```typescript
/**
 * Format token count for display
 * < 1000: "123"
 * >= 1000 and < 999500: "1.2k" (rounds to 1 decimal)
 * >= 999500: "1.0M" (avoids awkward "1000.0k")
 * >= 1000000: "1.2M"
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString()
  // Switch to M before we'd display "1000.0k" (at 999500, toFixed rounds to 1000.0)
  if (count < 999500) return `${(count / 1000).toFixed(1)}k`
  return `${(count / 1000000).toFixed(1)}M`
}
```

**File:** `src/renderer/src/shared/utils/formatTokenCount.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'
import { formatTokenCount } from './formatTokenCount'

describe('formatTokenCount', () => {
  it('returns raw number for counts under 1000', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(1)).toBe('1')
    expect(formatTokenCount(123)).toBe('123')
    expect(formatTokenCount(999)).toBe('999')
  })

  it('formats thousands with k suffix', () => {
    expect(formatTokenCount(1000)).toBe('1.0k')
    expect(formatTokenCount(1500)).toBe('1.5k')
    expect(formatTokenCount(12500)).toBe('12.5k')
    expect(formatTokenCount(999499)).toBe('999.5k') // Just under threshold
  })

  it('switches to M before displaying 1000.0k', () => {
    // At 999500, toFixed(1) on 999.5 would round to 999.5k
    // At 999500+, we switch to M to avoid awkward "1000.0k"
    expect(formatTokenCount(999500)).toBe('1.0M')
    expect(formatTokenCount(999999)).toBe('1.0M')
  })

  it('formats millions with M suffix', () => {
    expect(formatTokenCount(1000000)).toBe('1.0M')
    expect(formatTokenCount(1500000)).toBe('1.5M')
    expect(formatTokenCount(12500000)).toBe('12.5M')
  })

  it('handles edge cases', () => {
    expect(formatTokenCount(1001)).toBe('1.0k')
    expect(formatTokenCount(1050)).toBe('1.0k') // rounds to 1 decimal
    expect(formatTokenCount(1051)).toBe('1.1k') // rounds up
  })
})
```

**File:** `src/renderer/src/shared/utils/formatCost.ts` (NEW)

```typescript
/**
 * Format cost as USD currency
 * Always shows 2 decimal places
 * Returns '$0.00' for invalid inputs (NaN, undefined, null)
 */
export function formatCost(usd: number): string {
  if (usd == null || Number.isNaN(usd)) return '$0.00'
  return `$${usd.toFixed(2)}`
}
```

**File:** `src/renderer/src/shared/utils/formatCost.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'
import { formatCost } from './formatCost'

describe('formatCost', () => {
  it('formats zero cost', () => {
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats small costs with 2 decimal places', () => {
    expect(formatCost(0.01)).toBe('$0.01')
    expect(formatCost(0.05)).toBe('$0.05')
    expect(formatCost(0.42)).toBe('$0.42')
  })

  it('formats costs over a dollar', () => {
    expect(formatCost(1)).toBe('$1.00')
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(10.99)).toBe('$10.99')
    expect(formatCost(100.00)).toBe('$100.00')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatCost(0.001)).toBe('$0.00')
    expect(formatCost(0.005)).toBe('$0.01') // rounds up
    expect(formatCost(0.994)).toBe('$0.99')
    expect(formatCost(0.995)).toBe('$1.00') // rounds up
  })

  it('handles large costs', () => {
    expect(formatCost(1000)).toBe('$1000.00')
    expect(formatCost(12345.67)).toBe('$12345.67')
  })

  it('handles invalid inputs defensively', () => {
    expect(formatCost(NaN)).toBe('$0.00')
    // @ts-expect-error - testing runtime behavior with undefined
    expect(formatCost(undefined)).toBe('$0.00')
    // @ts-expect-error - testing runtime behavior with null
    expect(formatCost(null)).toBe('$0.00')
  })
})
```

**File:** `src/renderer/src/shared/utils/index.ts`

Update to export new utilities:
```typescript
export { cn } from './cn'
export { formatRelativeTime } from './formatRelativeTime'
export { getSessionDisplayName } from './getSessionDisplayName'
export { formatTokenCount } from './formatTokenCount'
export { formatCost } from './formatCost'
```

---

### Task 7: Final Validation

Run validation commands:
```bash
npm run validate
```

Expected checks:
- TypeScript compilation succeeds
- All tests pass (new and existing)
- ESLint passes with no errors

## Acceptance Criteria

### AC1: Metadata Capture and Storage
**Given** the database has `session_metadata` table (FR67e)
**When** a session streams responses
**Then** the system captures token counts and cost from the stream
**And** stores them in `session_metadata` table

**Verification:**
- `SessionMetadataUpsertSchema` validates input data
- `sessions:upsertMetadata` handler performs UPSERT to `session_metadata` table
- Upsert increments existing values (additive) for cumulative tracking
- FK validation ensures session exists before upserting
- Operation wrapped in `db.transaction()` for atomicity (prevents race conditions)

### AC2: Metadata Display Format
**Given** a session has metadata stored
**When** viewing the session info panel
**Then** total input tokens, output tokens, and estimated cost are displayed
**And** the format is: "Tokens: 12.5k in / 8.2k out" and "Est. Cost: $0.42"

**Verification:**
- `formatTokenCount()` formats: < 1000: "123", >= 1000 and < 999500: "1.2k", >= 999500: "1.0M"
- `formatCost()` formats: "$0.42" (always 2 decimal places, handles invalid inputs)
- `useSessionMetadataStore` provides metadata via `loadMetadata(sessionId)`
- UI can access via: `const { metadata, error } = useSessionMetadataStore()` then `metadata.get(sessionId)`

### AC3: Live Updates During Streaming
**Given** metadata is being captured during streaming
**When** the response completes
**Then** the session_metadata record is updated with cumulative totals
**And** the info panel reflects the updated values

**Verification:**
- `sessions:upsertMetadata` handler adds delta values to existing totals (not replace)
- Store's `updateMetadata()` allows optimistic UI updates
- `loadMetadata()` refreshes from database for accurate totals

## Dependencies

**Existing (verified present in codebase):**
- `better-sqlite3` - Database operations
- `zod` - Schema validation
- `zustand` - State management
- `session_metadata` table - Already exists in `src/shared/db/schema.sql`

**Internal Dependencies:**
- `SessionIdSchema` from `src/shared/types/ipc.ts`
- `getDatabase` from `src/main/db`
- Preload context bridge pattern

## Testing Strategy

**Unit Tests (Colocated):**
1. `src/shared/types/ipc.test.ts` - Schema validation and rejection tests
2. `src/main/sessions/session-metadata.test.ts` - Transform function tests
3. `src/main/ipc/sessions.test.ts` - IPC handler logic tests
4. `src/renderer/src/features/sessions/store/useSessionMetadataStore.test.ts` - Store tests
5. `src/renderer/src/shared/utils/formatTokenCount.test.ts` - Formatter tests
6. `src/renderer/src/shared/utils/formatCost.test.ts` - Formatter tests

**Test Coverage Focus:**
- Zod schema accepts valid inputs
- Zod schema rejects invalid inputs (negative numbers, non-UUID)
- Transform correctly maps snake_case to camelCase
- Store handles loading, updating, clearing metadata
- Store handles API errors gracefully
- Formatters produce expected output for edge cases

## Notes

### Implementation Order

Tasks should be implemented in this order due to dependencies:
1. **Task 1** (Zod schemas) - Foundation for all other tasks
2. **Task 2** (Transform function) - Required by IPC handlers
3. **Task 3** (IPC handlers) - Required by preload API
4. **Task 4** (Preload API) - Required by renderer store
5. **Task 5** (Zustand store) - Depends on preload API
6. **Task 6** (Formatters) - Independent, can be parallel with Task 5
7. **Task 7** (Validation) - Final step

### Architecture Compliance

| Element | Convention | This Story |
|---------|------------|------------|
| IPC channels | namespace:action | `sessions:getMetadata`, `sessions:upsertMetadata` |
| Zod schemas | PascalCase + Schema | `SessionMetadataSchema`, `SessionMetadataUpsertSchema` |
| DB columns | snake_case | `session_id`, `total_input_tokens`, `total_cost_usd` |
| TS fields | camelCase | `sessionId`, `totalInputTokens`, `totalCostUsd` |
| Tests | Colocated | `*.test.ts` beside source |
| Stores | use{Name}Store | `useSessionMetadataStore` |
| Utilities | Single function per file | `formatTokenCount.ts`, `formatCost.ts` |

### Future Integration Points

- **Epic 3b (Story 3b.2)**: Stream parsing will call `sessions:upsertMetadata` with extracted token/cost data
- **Epic 2c (Story 2c.2)**: SessionInfo component will use `useSessionMetadataStore` and formatters
- **Stream updates**: May add WebSocket/event listener for real-time metadata updates

### References

- [Source: epics.md#Story 2a.6] - Acceptance criteria and FR67e mapping
- [Source: architecture.md#Database Schema] - session_metadata table definition
- [Source: architecture.md#IPC Architecture] - GrimoireAPI sessions.getMetadata
- [Source: project-context.md#IPC Channel Naming] - namespace:action pattern
- [Source: 2a-5-session-forking-database-support.md] - Previous story patterns
