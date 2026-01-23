---
title: 'NDJSON Stream Parser'
slug: '3b-2-ndjson-stream-parser'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Node.js readline
  - Node.js events (EventEmitter)
  - Electron main process
  - TypeScript 5.9
  - Zod 4.x
  - Electron IPC
files_to_modify:
  - src/main/sessions/cc-spawner.ts
  - src/main/sessions/types.ts
  - src/main/ipc/sessions.ts
files_to_create:
  - src/main/sessions/stream-parser.ts
  - src/main/sessions/stream-parser.test.ts
  - src/main/sessions/checkpoint-registry.ts
code_patterns:
  - EventEmitter for event-driven parsing
  - Readline for line-by-line NDJSON processing
  - IPC event emission to renderer
  - Graceful error handling for malformed JSON
test_patterns:
  - Vitest with node environment
  - Mock Readable streams
  - Mock BrowserWindow.webContents
  - EventEmitter testing
---

# Tech-Spec: NDJSON Stream Parser

**Created:** 2026-01-24
**Story Reference:** 3b-2-ndjson-stream-parser.md

## Overview

### Problem Statement

Story 3b-1 implements basic CC process spawning with minimal init event parsing. However, the full NDJSON stream from CC contains various event types (user messages, assistant content, tool calls, results, metadata) that need to be parsed and emitted to the renderer in real-time. Without comprehensive stream parsing, users cannot see tool executions, cost tracking, or properly formatted responses.

### Solution

Implement a full NDJSON stream parser that:
1. Parses all NDJSON event types (system, user, assistant, result)
2. Emits appropriate IPC events to renderer (stream:chunk, stream:tool, stream:end)
3. Captures checkpoints from user message UUIDs for rewind capability
4. Extracts and persists token/cost metadata to database
5. Handles malformed JSON gracefully (log warning, skip line)
6. Integrates with the cc-spawner module from Story 3b-1

### Scope

**In Scope:**
- `stream-parser.ts` module with EventEmitter-based parser
- Parsed event types for all CC message types
- stream:chunk emission for assistant text content
- stream:tool emission for tool_use and tool_result blocks
- stream:end emission with metadata on completion
- Checkpoint storage from user message UUIDs
- Token/cost metadata persistence to session_metadata table
- Malformed JSON error handling
- Integration with cc-spawner.ts

**Out of Scope:**
- Instance state machine (Story 3b-3)
- Request-response lifecycle coordination (Story 3b-4)
- Full conversation persistence (Epic 4)
- Rewind IPC handler (Epic 4 - will use stored checkpoints)

## Context for Development

### Codebase Patterns

**CC Spawner Init Parsing (from Story 3b-1 cc-spawner.ts):**
```typescript
// Story 3b-1 implements basic init event capture
// This story expands parsing to all event types
if (child.stdout) {
  const rl = createInterface({
    input: child.stdout,
    crlfDelay: Infinity
  })

  rl.on('line', (line) => {
    if (!initReceived) {
      try {
        const event = JSON.parse(line)
        if (event.type === 'system' && event.subtype === 'init') {
          // ... capture session ID
        }
      } catch {
        // Ignore parse errors
      }
    }
  })
}
```

**Stream Event Schemas (from src/shared/types/ipc.ts lines 234-272):**
```typescript
export const StreamChunkEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.literal('text'),
  content: z.string(),
  uuid: z.string().uuid().optional()
})

export const StreamToolEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['tool_use', 'tool_result']),
  toolUse: StreamToolUseBlockSchema.optional(),
  toolResult: StreamToolResultBlockSchema.optional()
})

export const StreamEndEventSchema = z.object({
  sessionId: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
  aborted: z.boolean().optional(),
  totalTokens: z.object({
    input: z.number(),
    output: z.number()
  }).optional(),
  costUsd: z.number().optional()
})
```

**Renderer Streaming Hook (from src/renderer/src/features/sessions/hooks/useStreamingMessage.ts):**
```typescript
// Already handles stream:chunk, stream:tool, stream:end
// Expects events with sessionId for filtering
const unsubChunk = window.grimoireAPI.sessions.onStreamChunk((event) => {
  if (event.sessionId !== sessionId) return
  setState((prev) => ({
    ...prev,
    content: prev.content + event.content,
    isStreaming: true
  }))
})
```

**Metadata Upsert Handler (from src/main/ipc/sessions.ts lines 223-262):**
```typescript
ipcMain.handle('sessions:upsertMetadata', async (_, data: unknown) => {
  const input = SessionMetadataUpsertSchema.parse(data)
  // ... UPSERT with cumulative token/cost tracking
})
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/main/sessions/cc-spawner.ts` | CC spawner with basic init parsing (Story 3b-1) |
| `src/main/sessions/types.ts` | Session types including SystemInitEvent |
| `src/shared/types/ipc.ts` | Stream event schemas (lines 234-272) |
| `src/preload/index.ts` | Stream event listeners (lines 88-133) |
| `src/renderer/src/features/sessions/hooks/useStreamingMessage.ts` | Renderer streaming hook |
| `src/main/ipc/sessions.ts` | sessions:upsertMetadata handler (lines 223-262) |

### Technical Decisions

1. **EventEmitter Pattern:** Use Node.js EventEmitter for the parser to allow flexible event subscription and testing.

2. **Separate Parser Module:** Keep stream parsing logic separate from spawner for better testability and single responsibility.

3. **In-Memory Checkpoint Storage:** Store checkpoints in a Map for now; Epic 4 will implement full rewind functionality.

4. **Direct IPC Call for Metadata:** Call the internal upsertMetadata logic directly rather than going through IPC for efficiency.

5. **Known Issue Handling (AR22):** Track whether result event was received; treat exit code 0 without result as success.

6. **Graceful JSON Errors:** Log warning and skip line on parse errors to maintain stream processing.

## Implementation Plan

### Tasks

#### Task 1: Add Parser Types to types.ts (AC: #1-6)

**File:** `src/main/sessions/types.ts`

**Action:** Add parsed event interfaces after SpawnOptions (around line 100).

```typescript
// ============================================================
// Stream Parser Types (Story 3b-2)
// ============================================================

/**
 * Token usage information from assistant messages.
 */
export interface TokenInfo {
  input: number
  output: number
}

/**
 * Parsed init event from CC stream.
 */
export interface ParsedInitEvent {
  type: 'init'
  sessionId: string
  tools: unknown[]
}

/**
 * Parsed user event from CC stream - contains checkpoint UUID.
 */
export interface ParsedUserEvent {
  type: 'user'
  uuid: string
  content: string
}

/**
 * Parsed assistant event from CC stream - text content or tool use.
 */
export interface ParsedAssistantEvent {
  type: 'assistant'
  uuid?: string
  content?: string
  toolUse?: {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
  }
  tokens?: TokenInfo
}

/**
 * Parsed tool result event from CC stream.
 */
export interface ParsedToolResultEvent {
  type: 'tool_result'
  toolUseId: string
  content: string
  isError: boolean
}

/**
 * Parsed result event from CC stream - end of response.
 */
export interface ParsedResultEvent {
  type: 'result'
  success: boolean
  durationMs?: number
  tokens?: TokenInfo
  costUsd?: number
}

/**
 * Union type for all parsed stream events.
 */
export type ParsedStreamEvent =
  | ParsedInitEvent
  | ParsedUserEvent
  | ParsedAssistantEvent
  | ParsedToolResultEvent
  | ParsedResultEvent
```

---

#### Task 2: Create Checkpoint Registry Module (AC: #3)

**File:** `src/main/sessions/checkpoint-registry.ts`

**Action:** Create new file for in-memory checkpoint storage.

```typescript
/**
 * In-memory storage for user message checkpoints.
 * Key: sessionId, Value: array of checkpoint UUIDs (chronological order)
 *
 * Used for rewind capability - Epic 4 will add sessions:getCheckpoints IPC handler.
 * Checkpoints are user message UUIDs that can be used with CC's --checkpoint flag.
 */
export const checkpointRegistry = new Map<string, string[]>()

/**
 * Maximum checkpoints to store per session (memory limit).
 */
const MAX_CHECKPOINTS_PER_SESSION = 100

/**
 * Add a checkpoint UUID for a session.
 * Maintains chronological order with newest at the end.
 *
 * @param sessionId - Session UUID
 * @param checkpointUuid - User message UUID to store as checkpoint
 */
export function addCheckpoint(sessionId: string, checkpointUuid: string): void {
  const existing = checkpointRegistry.get(sessionId) ?? []

  // Avoid duplicates (shouldn't happen but be safe)
  if (existing.includes(checkpointUuid)) return

  // Add new checkpoint
  const updated = [...existing, checkpointUuid]

  // Trim if over limit (remove oldest)
  if (updated.length > MAX_CHECKPOINTS_PER_SESSION) {
    updated.shift()
  }

  checkpointRegistry.set(sessionId, updated)
}

/**
 * Get all checkpoints for a session.
 *
 * @param sessionId - Session UUID
 * @returns Array of checkpoint UUIDs in chronological order
 */
export function getCheckpoints(sessionId: string): string[] {
  return checkpointRegistry.get(sessionId) ?? []
}

/**
 * Clear checkpoints for a session.
 * Called when session is deleted or app quits.
 *
 * @param sessionId - Session UUID
 */
export function clearCheckpoints(sessionId: string): void {
  checkpointRegistry.delete(sessionId)
}
```

---

#### Task 3: Create Stream Parser Module (AC: #1, #2, #4, #5, #6)

**File:** `src/main/sessions/stream-parser.ts`

**Action:** Create new file with the stream parser implementation.

```typescript
import { createInterface } from 'readline'
import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import type { Readable } from 'stream'
import type {
  ParsedInitEvent,
  ParsedUserEvent,
  ParsedAssistantEvent,
  ParsedToolResultEvent,
  ParsedResultEvent,
  TokenInfo
} from './types'
import { addCheckpoint } from './checkpoint-registry'
import { getDatabase } from '../db'

/**
 * Stream parser events interface.
 */
export interface StreamParserEvents {
  init: (event: ParsedInitEvent) => void
  user: (event: ParsedUserEvent) => void
  assistant: (event: ParsedAssistantEvent) => void
  tool_result: (event: ParsedToolResultEvent) => void
  result: (event: ParsedResultEvent) => void
  error: (error: Error) => void
  close: () => void
}

/**
 * Stream parser instance type.
 */
export interface StreamParser extends EventEmitter {
  on<K extends keyof StreamParserEvents>(event: K, listener: StreamParserEvents[K]): this
  emit<K extends keyof StreamParserEvents>(event: K, ...args: Parameters<StreamParserEvents[K]>): boolean
}

/**
 * Options for creating a stream parser.
 */
export interface CreateStreamParserOptions {
  /** Session ID for event emission */
  sessionId: string
  /** Stdout stream from CC process */
  stdout: Readable
  /** Callback when session ID captured from init event */
  onSessionIdCaptured?: (capturedId: string) => void
}

/**
 * Emits an event to all renderer windows.
 */
function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}

/**
 * Upserts session metadata directly to database.
 * Uses same logic as sessions:upsertMetadata but avoids IPC overhead.
 */
function upsertMetadata(
  sessionId: string,
  tokens: TokenInfo,
  costUsd: number,
  model?: string
): void {
  try {
    const db = getDatabase()
    const now = Date.now()

    // Check if session exists (FK validation)
    const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
    if (!sessionExists) {
      console.warn(`[stream-parser] Session not found for metadata upsert: ${sessionId}`)
      return
    }

    // UPSERT - increment existing values or create new record
    db.prepare(
      `
      INSERT INTO session_metadata (session_id, total_input_tokens, total_output_tokens, total_cost_usd, model, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        total_input_tokens = total_input_tokens + excluded.total_input_tokens,
        total_output_tokens = total_output_tokens + excluded.total_output_tokens,
        total_cost_usd = total_cost_usd + excluded.total_cost_usd,
        model = COALESCE(excluded.model, model),
        updated_at = excluded.updated_at
    `
    ).run(sessionId, tokens.input, tokens.output, costUsd, model ?? null, now)
  } catch (error) {
    console.error('[stream-parser] Failed to upsert metadata:', error)
  }
}

/**
 * Creates a stream parser that parses NDJSON from CC stdout.
 *
 * @param options - Parser configuration
 * @returns EventEmitter-based stream parser
 */
export function createStreamParser(options: CreateStreamParserOptions): StreamParser {
  const { sessionId, stdout, onSessionIdCaptured } = options
  const emitter = new EventEmitter() as StreamParser

  // Track session ID (may be updated for new sessions)
  let currentSessionId = sessionId

  // Track accumulated metadata
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0
  let capturedModel: string | undefined

  // Track if result event received (AR22 known issue)
  let resultReceived = false

  const rl = createInterface({
    input: stdout,
    crlfDelay: Infinity
  })

  rl.on('line', (line) => {
    try {
      const event = JSON.parse(line)

      // Handle system init event
      if (event.type === 'system' && event.subtype === 'init') {
        const parsed: ParsedInitEvent = {
          type: 'init',
          sessionId: event.session_id,
          tools: event.tools ?? []
        }

        // Update session ID if different (new session case)
        if (event.session_id) {
          currentSessionId = event.session_id
          onSessionIdCaptured?.(event.session_id)
        }

        emitter.emit('init', parsed)

        // Emit stream:init to renderer
        emitToRenderer('stream:init', {
          sessionId: currentSessionId,
          tools: parsed.tools
        })
      }

      // Handle user message - capture checkpoint UUID
      else if (event.type === 'user') {
        const uuid = event.uuid
        const content =
          typeof event.message?.content === 'string'
            ? event.message.content
            : JSON.stringify(event.message?.content ?? '')

        if (uuid) {
          // Store checkpoint for rewind capability
          addCheckpoint(currentSessionId, uuid)

          const parsed: ParsedUserEvent = {
            type: 'user',
            uuid,
            content
          }
          emitter.emit('user', parsed)
        }

        // Check for tool_result blocks in user messages
        if (Array.isArray(event.message?.content)) {
          for (const block of event.message.content) {
            if (block.type === 'tool_result') {
              const toolResultParsed: ParsedToolResultEvent = {
                type: 'tool_result',
                toolUseId: block.tool_use_id,
                content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
                isError: block.is_error ?? false
              }

              emitter.emit('tool_result', toolResultParsed)

              // Emit stream:tool to renderer
              emitToRenderer('stream:tool', {
                sessionId: currentSessionId,
                type: 'tool_result',
                toolResult: {
                  type: 'tool_result',
                  tool_use_id: block.tool_use_id,
                  content: toolResultParsed.content,
                  is_error: toolResultParsed.isError
                }
              })
            }
          }
        }
      }

      // Handle assistant message
      else if (event.type === 'assistant' && event.message) {
        const uuid = event.uuid
        const model = event.message.model

        // Capture model for metadata
        if (model && !capturedModel) {
          capturedModel = model
        }

        // Process content blocks
        if (Array.isArray(event.message.content)) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              const parsed: ParsedAssistantEvent = {
                type: 'assistant',
                uuid,
                content: block.text
              }
              emitter.emit('assistant', parsed)

              // Emit stream:chunk to renderer
              emitToRenderer('stream:chunk', {
                sessionId: currentSessionId,
                type: 'text',
                content: block.text,
                uuid
              })
            } else if (block.type === 'tool_use') {
              const parsed: ParsedAssistantEvent = {
                type: 'assistant',
                uuid,
                toolUse: {
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: block.input ?? {}
                }
              }
              emitter.emit('assistant', parsed)

              // Emit stream:tool to renderer
              emitToRenderer('stream:tool', {
                sessionId: currentSessionId,
                type: 'tool_use',
                toolUse: {
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: block.input ?? {}
                }
              })
            }
          }
        }

        // Capture token usage from assistant messages
        if (event.message.usage) {
          totalInputTokens += event.message.usage.input_tokens ?? 0
          totalOutputTokens += event.message.usage.output_tokens ?? 0
        }
      }

      // Handle result message (end of stream)
      else if (event.type === 'result') {
        resultReceived = true

        // Capture cost from result
        if (event.cost_usd !== undefined) {
          totalCostUsd = event.cost_usd
        } else if (event.costUSD !== undefined) {
          // Handle both naming conventions
          totalCostUsd = event.costUSD
        }

        const parsed: ParsedResultEvent = {
          type: 'result',
          success: event.subtype === 'success',
          durationMs: event.duration_ms,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          costUsd: totalCostUsd
        }
        emitter.emit('result', parsed)
      }
    } catch (parseError) {
      // Log warning but don't crash - skip invalid lines
      console.warn(
        '[stream-parser] Failed to parse NDJSON line:',
        line.substring(0, 100),
        parseError
      )
    }
  })

  rl.on('close', () => {
    // Persist metadata to database
    if (totalInputTokens > 0 || totalOutputTokens > 0 || totalCostUsd > 0) {
      upsertMetadata(
        currentSessionId,
        { input: totalInputTokens, output: totalOutputTokens },
        totalCostUsd,
        capturedModel
      )
    }

    emitter.emit('close')
  })

  rl.on('error', (error) => {
    console.error('[stream-parser] Readline error:', error)
    emitter.emit('error', error)
  })

  return emitter
}

```

---

#### Task 4: Update CC Spawner to Use Stream Parser (AC: #1-6)

**File:** `src/main/sessions/cc-spawner.ts`

**Action:** Replace the inline init parsing with the full stream parser integration.

**Step 4.1: Update imports at top of file.**

Replace:
```typescript
import { createInterface } from 'readline'
```

With:
```typescript
import { createStreamParser } from './stream-parser'
```

**Step 4.2: Remove inline parsing logic and integrate stream parser.**

**IMPORTANT:** Story 3b-1 creates cc-spawner.ts with inline init parsing. This step replaces that with the full stream parser.

Find the section in spawnCC that sets up stdout readline (after stdin.end() call, the section that starts with "Track whether we've captured..."). The exact code from Story 3b-1 includes:
- `let capturedSessionId = sessionId ?? ''`
- `let initReceived = false`
- readline setup with `rl.on('line', ...)`
- init event parsing logic
- `emitToRenderer('stream:init', ...)` call

This entire section (from `// Track whether we've captured...` to the end of the `if (child.stdout) { ... }` block) should be replaced with the new stream parser integration below.

Replace with:

```typescript
// Track whether we've captured the real session ID
let capturedSessionId = sessionId ?? ''

// Track result event for AR22 handling
let resultReceived = false

// Setup stream parser for full NDJSON parsing (Story 3b-2)
if (child.stdout) {
  const parser = createStreamParser({
    sessionId: capturedSessionId || registryId,
    stdout: child.stdout,
    onSessionIdCaptured: (newSessionId) => {
      // Update registry if session ID changed (new session)
      if (!sessionId && newSessionId) {
        processRegistry.delete(registryId)
        processRegistry.set(newSessionId, child)
        capturedSessionId = newSessionId
      } else if (sessionId) {
        capturedSessionId = sessionId
      }
    }
  })

  parser.on('result', () => {
    resultReceived = true
  })
}
```

**Step 4.3: Update the exit handler to use resultReceived flag.**

Find the child.on('exit') handler and update to use resultReceived:

```typescript
// Handle process exit
child.on('exit', (code, signal) => {
  // Remove from registry
  if (capturedSessionId) {
    processRegistry.delete(capturedSessionId)
  } else {
    processRegistry.delete(registryId)
  }

  // Determine success (AR22: handle missing result event)
  const success = code === 0

  // Emit stream:end event (only if not already emitted by result event)
  // Parser emits data to renderer; we emit final end event on process exit
  emitToRenderer('stream:end', {
    sessionId: capturedSessionId || registryId,
    success,
    error: success
      ? undefined
      : `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}${stderrBuffer ? `: ${stderrBuffer.trim()}` : ''}`,
    aborted: signal === 'SIGTERM' || signal === 'SIGKILL'
  })
})
```

**Step 4.4: Refactor emitToRenderer to avoid duplication.**

Story 3b-1 defines `emitToRenderer` in cc-spawner.ts. This story moves it to stream-parser.ts and exports it.

**In cc-spawner.ts, update the import:**

Find and remove this function:
```typescript
/**
 * Emits an event to all renderer windows.
 */
function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}
```

**Update the import at the top of cc-spawner.ts:**

Change:
```typescript
import { createStreamParser } from './stream-parser'
```

To:
```typescript
import { createStreamParser, emitToRenderer } from './stream-parser'
```

**Note:** The `emitToRenderer` function is already defined in stream-parser.ts (Task 3) and exported. The cc-spawner.ts uses it for the `stream:end` event on process exit.

---

#### Task 5: Export New Modules from Sessions Index (AC: #1-6)

**File:** `src/main/sessions/index.ts`

**Action:** Add exports for stream-parser and checkpoint-registry.

Add these lines:
```typescript
export { createStreamParser, emitToRenderer } from './stream-parser'
export { addCheckpoint, getCheckpoints, clearCheckpoints } from './checkpoint-registry'
```

---

#### Task 6: Create Stream Parser Unit Tests (AC: #1-6)

**File:** `src/main/sessions/stream-parser.test.ts`

**Action:** Create comprehensive test file:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'stream'
import { EventEmitter } from 'events'

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock database
vi.mock('../db', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(() => ({ id: 'test-session' }))
    }))
  }))
}))

// Mock checkpoint registry
vi.mock('./checkpoint-registry', () => ({
  addCheckpoint: vi.fn()
}))

import { BrowserWindow } from 'electron'
import { createStreamParser } from './stream-parser'
import { addCheckpoint } from './checkpoint-registry'

describe('stream-parser', () => {
  let mockWindow: { webContents: { send: ReturnType<typeof vi.fn> } }
  let mockStdout: Readable

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock window
    mockWindow = { webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
      mockWindow as unknown as Electron.BrowserWindow
    ])

    // Create mock stdout stream
    mockStdout = new Readable({ read: vi.fn() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function pushEvent(event: unknown): void {
    mockStdout.push(JSON.stringify(event) + '\n')
  }

  function endStream(): void {
    mockStdout.push(null)
  }

  describe('init event parsing', () => {
    it('parses init event and emits session ID', async () => {
      const onSessionIdCaptured = vi.fn()
      const parser = createStreamParser({
        sessionId: 'initial-session',
        stdout: mockStdout,
        onSessionIdCaptured
      })

      const initPromise = new Promise<void>((resolve) => {
        parser.on('init', () => resolve())
      })

      pushEvent({
        type: 'system',
        subtype: 'init',
        session_id: 'captured-session-id',
        tools: ['Read', 'Write']
      })
      endStream()

      await initPromise

      expect(onSessionIdCaptured).toHaveBeenCalledWith('captured-session-id')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:init',
        expect.objectContaining({
          sessionId: 'captured-session-id',
          tools: ['Read', 'Write']
        })
      )
    })
  })

  describe('user event parsing', () => {
    it('captures checkpoint UUID from user messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const userPromise = new Promise<void>((resolve) => {
        parser.on('user', () => resolve())
      })

      pushEvent({
        type: 'user',
        uuid: 'checkpoint-uuid-123',
        message: { role: 'user', content: 'Hello world' }
      })
      endStream()

      await userPromise

      expect(addCheckpoint).toHaveBeenCalledWith('test-session', 'checkpoint-uuid-123')
    })

    it('emits tool_result from user messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'user',
        uuid: 'user-uuid',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'File contents here',
              is_error: false
            }
          ]
        }
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_result',
          toolResult: expect.objectContaining({
            tool_use_id: 'toolu_123'
          })
        })
      )
    })

    it('emits tool_result with is_error flag', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'user',
        uuid: 'user-uuid',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_err',
              content: 'Error: File not found',
              is_error: true
            }
          ]
        }
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_result',
          toolResult: expect.objectContaining({
            is_error: true
          })
        })
      )
    })
  })

  describe('assistant event parsing', () => {
    it('emits stream:chunk for text content', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const assistantPromise = new Promise<void>((resolve) => {
        parser.on('assistant', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        uuid: 'assistant-uuid',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help?' }]
        }
      })
      endStream()

      await assistantPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:chunk',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'text',
          content: 'Hello! How can I help?',
          uuid: 'assistant-uuid'
        })
      )
    })

    it('emits stream:tool for tool_use blocks', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const assistantPromise = new Promise<void>((resolve) => {
        parser.on('assistant', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        uuid: 'assistant-uuid',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_456',
              name: 'Read',
              input: { file_path: '/src/test.ts' }
            }
          ]
        }
      })
      endStream()

      await assistantPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_use',
          toolUse: expect.objectContaining({
            id: 'toolu_456',
            name: 'Read'
          })
        })
      )
    })

    it('accumulates token usage from assistant messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<void>((resolve) => {
        parser.on('result', () => resolve())
      })

      // First assistant message with tokens
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 1' }],
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      })

      // Second assistant message with more tokens
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 2' }],
          usage: { input_tokens: 200, output_tokens: 100 }
        }
      })

      // Result event
      pushEvent({
        type: 'result',
        subtype: 'success',
        cost_usd: 0.05
      })
      endStream()

      await resultPromise

      // Parser should have accumulated 300 input, 150 output
      // Verification happens via metadata upsert mock
    })
  })

  describe('result event parsing', () => {
    it('parses result event and extracts cost', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ costUsd: number | undefined }>((resolve) => {
        parser.on('result', (event) => resolve({ costUsd: event.costUsd }))
      })

      pushEvent({
        type: 'result',
        subtype: 'success',
        duration_ms: 5000,
        cost_usd: 0.123
      })
      endStream()

      const result = await resultPromise
      expect(result.costUsd).toBe(0.123)
    })

    it('handles costUSD (alternative naming)', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ costUsd: number | undefined }>((resolve) => {
        parser.on('result', (event) => resolve({ costUsd: event.costUsd }))
      })

      pushEvent({
        type: 'result',
        subtype: 'success',
        costUSD: 0.456
      })
      endStream()

      const result = await resultPromise
      expect(result.costUsd).toBe(0.456)
    })
  })

  describe('error handling', () => {
    it('handles malformed JSON gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      // Push invalid JSON
      mockStdout.push('not valid json\n')

      // Push valid JSON to verify parsing continues
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Valid message' }]
        }
      })
      endStream()

      await closePromise

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:chunk',
        expect.objectContaining({ content: 'Valid message' })
      )

      consoleWarnSpy.mockRestore()
    })

    it('skips invalid lines and continues parsing', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      let assistantCount = 0
      parser.on('assistant', () => assistantCount++)

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      pushEvent({ type: 'assistant', message: { content: [{ type: 'text', text: 'First' }] } })
      mockStdout.push('{"broken: json\n') // Invalid
      pushEvent({ type: 'assistant', message: { content: [{ type: 'text', text: 'Second' }] } })
      endStream()

      await closePromise

      expect(assistantCount).toBe(2)
    })
  })

  describe('close event', () => {
    it('emits close event when stream ends', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      endStream()

      await closePromise
      // If we get here without timeout, test passes
    })
  })
})
```

---

#### Task 7: Create Checkpoint Registry Tests (AC: #3)

**File:** `src/main/sessions/checkpoint-registry.test.ts`

**Action:** Create test file for checkpoint registry:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkpointRegistry,
  addCheckpoint,
  getCheckpoints,
  clearCheckpoints
} from './checkpoint-registry'

describe('checkpoint-registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    checkpointRegistry.clear()
  })

  describe('addCheckpoint', () => {
    it('adds checkpoint to session', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a'])
    })

    it('maintains chronological order', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-1', 'checkpoint-b')
      addCheckpoint('session-1', 'checkpoint-c')

      expect(getCheckpoints('session-1')).toEqual([
        'checkpoint-a',
        'checkpoint-b',
        'checkpoint-c'
      ])
    })

    it('prevents duplicate checkpoints', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-1', 'checkpoint-a')

      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a'])
    })

    it('limits checkpoints to MAX_CHECKPOINTS_PER_SESSION', () => {
      // Add 105 checkpoints
      for (let i = 0; i < 105; i++) {
        addCheckpoint('session-1', `checkpoint-${i}`)
      }

      const checkpoints = getCheckpoints('session-1')
      expect(checkpoints.length).toBe(100)
      // Should have removed oldest (0-4), keeping 5-104
      expect(checkpoints[0]).toBe('checkpoint-5')
      expect(checkpoints[99]).toBe('checkpoint-104')
    })
  })

  describe('getCheckpoints', () => {
    it('returns empty array for unknown session', () => {
      expect(getCheckpoints('unknown-session')).toEqual([])
    })

    it('returns checkpoints for known session', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      expect(getCheckpoints('session-1')).toEqual(['checkpoint-a'])
    })
  })

  describe('clearCheckpoints', () => {
    it('removes all checkpoints for session', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-1', 'checkpoint-b')

      clearCheckpoints('session-1')

      expect(getCheckpoints('session-1')).toEqual([])
    })

    it('does not affect other sessions', () => {
      addCheckpoint('session-1', 'checkpoint-a')
      addCheckpoint('session-2', 'checkpoint-b')

      clearCheckpoints('session-1')

      expect(getCheckpoints('session-1')).toEqual([])
      expect(getCheckpoints('session-2')).toEqual(['checkpoint-b'])
    })
  })
})
```

---

#### Task 8: Run Validation (AC: #1-6)

**Action:** Run `npm run validate` to ensure all tests pass and types check.

```bash
npm run validate
```

### Acceptance Criteria

**AC1: NDJSON parsing (FR64)**
- **Given** CC is running and producing output
- **When** NDJSON events arrive on stdout
- **Then** each line is parsed as a JSON object in real-time
- **And** events are processed based on their type (system, user, assistant, result)
- **And** malformed JSON lines are logged and skipped

**AC2: Session ID capture from init (FR67c)**
- **Given** the first message arrives (type: system, subtype: init)
- **When** the init event is received
- **Then** the session_id is captured from the message
- **And** onSessionIdCaptured callback is invoked
- **And** stream:init event is emitted to renderer

**AC3: Checkpoint capture from user messages (FR67d)**
- **Given** user messages arrive with --replay-user-messages
- **When** a user message event is received
- **Then** the uuid field is captured as a checkpoint
- **And** addCheckpoint stores the UUID in checkpointRegistry
- **And** checkpoints are limited to 100 per session

**AC4: Assistant streaming display**
- **Given** assistant messages are streaming
- **When** assistant content events arrive
- **Then** text blocks emit stream:chunk events
- **And** tool_use blocks emit stream:tool events
- **And** events include sessionId for renderer filtering

**AC5: Cost/token metadata capture (FR67e)**
- **Given** cost/token data is included in the stream
- **When** assistant messages have usage fields or result has cost_usd
- **Then** tokens are accumulated across messages
- **And** cost is captured from result event
- **And** metadata is persisted to session_metadata table on stream close

**AC6: Stream end handling**
- **Given** the stream ends (readline close event)
- **When** processing completes
- **Then** accumulated metadata is persisted to database
- **And** parser emits close event
- **And** stream:end is emitted by spawner on process exit

## Additional Context

### Dependencies

**Required Stories (Upstream):**
- Story 3b-1 (CC Child Process Spawning): Provides the spawner module to integrate with - MUST BE COMPLETED FIRST

**This Story Provides:**
- Full NDJSON stream parsing
- Real-time IPC event emission
- Checkpoint storage for rewind
- Metadata persistence

**Downstream Stories:**
- Story 3b-3 (Instance State Machine): Will use stream events for state transitions
- Story 3b-4 (Request-Response Model): Will coordinate with parser for lifecycle
- Epic 4 (Rewind): Will use stored checkpoints via sessions:getCheckpoints IPC

### Testing Strategy

1. **Unit Tests (stream-parser.test.ts):**
   - Test init event parsing and session ID capture
   - Test user event checkpoint capture
   - Test assistant text/tool_use emission
   - Test tool_result emission from user messages
   - Test token accumulation
   - Test cost extraction
   - Test malformed JSON handling
   - Test close event and metadata persistence

2. **Unit Tests (checkpoint-registry.test.ts):**
   - Test add/get/clear operations
   - Test duplicate prevention
   - Test limit enforcement

3. **Integration Tests (Manual):**
   - Send message through Grimoire
   - Verify stream:chunk events arrive for text
   - Verify stream:tool events arrive for tool calls
   - Verify stream:end arrives on completion
   - Check session_metadata table for token/cost data

### Notes

**NDJSON Format from CC:**
```json
{"type":"system","subtype":"init","session_id":"uuid","tools":[]}
{"type":"user","uuid":"user-uuid","message":{"role":"user","content":"Hello"}}
{"type":"assistant","uuid":"asst-uuid","message":{"role":"assistant","content":[{"type":"text","text":"Hi"}],"usage":{"input_tokens":10,"output_tokens":5}}}
{"type":"result","subtype":"success","cost_usd":0.01}
```

**AR22 Known Issue:**
The final result event may not emit from CC. The spawner handles this by:
1. Treating exit code 0 as success regardless of result event
2. Including aborted flag when signal is SIGTERM/SIGKILL

**Metadata Persistence:**
Metadata is persisted on stream close (readline close event), not on result event. This ensures metadata is captured even if result event is missing.

### File Checklist

Files to CREATE:
- [ ] `src/main/sessions/stream-parser.ts` - NDJSON parser module
- [ ] `src/main/sessions/stream-parser.test.ts` - Parser tests
- [ ] `src/main/sessions/checkpoint-registry.ts` - Checkpoint storage
- [ ] `src/main/sessions/checkpoint-registry.test.ts` - Registry tests

Files to MODIFY:
- [ ] `src/main/sessions/types.ts` - Add parsed event types
- [ ] `src/main/sessions/cc-spawner.ts` - Integrate stream parser
- [ ] `src/main/sessions/index.ts` - Export new modules

### Implementation Order

Execute tasks in this order to respect dependencies:

1. **Types First:**
   - Task 1: Add parser types to types.ts

2. **Core Modules:**
   - Task 2: Create checkpoint-registry.ts
   - Task 3: Create stream-parser.ts

3. **Integration:**
   - Task 4: Update cc-spawner.ts to use stream parser
   - Task 5: Export from sessions/index.ts

4. **Tests:**
   - Task 6: Create stream-parser.test.ts
   - Task 7: Create checkpoint-registry.test.ts

5. **Validation:**
   - Task 8: Run npm run validate
