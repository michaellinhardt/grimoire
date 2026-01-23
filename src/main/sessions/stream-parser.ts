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
import { addCheckpoint, clearCheckpoints } from './checkpoint-registry'
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
  emit<K extends keyof StreamParserEvents>(
    event: K,
    ...args: Parameters<StreamParserEvents[K]>
  ): boolean
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
export function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}

/**
 * Emits a tool_result event as stream:tool IPC event.
 * Extracted helper to avoid code duplication (used from both user messages and standalone events).
 */
function emitToolResult(
  sessionId: string,
  toolUseId: string,
  content: string | object,
  isError: boolean
): void {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content ?? '')

  emitToRenderer('stream:tool', {
    sessionId,
    type: 'tool_result',
    toolResult: {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: contentStr,
      is_error: isError
    }
  })
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
  let resultEventReceived = false

  const rl = createInterface({
    input: stdout,
    crlfDelay: Infinity
  })

  rl.on('line', (line) => {
    try {
      // Skip empty lines without attempting parse
      if (!line.trim()) {
        return
      }

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
                content:
                  typeof block.content === 'string'
                    ? block.content
                    : JSON.stringify(block.content ?? ''),
                isError: block.is_error ?? false
              }

              emitter.emit('tool_result', toolResultParsed)

              // Emit stream:tool to renderer using helper
              emitToolResult(
                currentSessionId,
                block.tool_use_id,
                toolResultParsed.content,
                toolResultParsed.isError
              )
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

      // Handle standalone tool_result event (per story spec)
      // Note: tool_result can also appear inside user message content blocks (handled above)
      else if (event.type === 'tool_result') {
        const toolResultParsed: ParsedToolResultEvent = {
          type: 'tool_result',
          toolUseId: event.tool_use_id,
          content:
            typeof event.content === 'string' ? event.content : JSON.stringify(event.content ?? ''),
          isError: event.is_error ?? false
        }

        emitter.emit('tool_result', toolResultParsed)

        // Emit stream:tool to renderer using helper
        emitToolResult(
          currentSessionId,
          event.tool_use_id,
          toolResultParsed.content,
          toolResultParsed.isError
        )
      }

      // Handle result message (end of stream)
      else if (event.type === 'result' && !resultEventReceived) {
        resultEventReceived = true

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

        // Emit stream:end to renderer (AC6 requirement)
        emitToRenderer('stream:end', {
          sessionId: currentSessionId,
          success: event.subtype === 'success',
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          costUsd: totalCostUsd,
          durationMs: event.duration_ms
        })
      }
    } catch (parseError) {
      // Log warning but don't crash - skip invalid lines
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError)
      console.warn(
        `[stream-parser] Failed to parse NDJSON line: ${line.substring(0, 100)} - ${errorMsg}`
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

    // Clean up checkpoints to prevent memory leak
    clearCheckpoints(currentSessionId)

    emitter.emit('close')
  })

  rl.on('error', (error) => {
    console.error('[stream-parser] Readline error:', error)
    emitter.emit('error', error)
  })

  return emitter
}
