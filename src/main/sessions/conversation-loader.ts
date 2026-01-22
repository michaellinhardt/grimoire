import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import type { Conversation, ConversationEvent } from './types'

/**
 * Basic validation that parsed object looks like a conversation event
 * Returns true for valid events, false for unexpected structures
 */
function isValidEvent(obj: unknown): obj is ConversationEvent {
  if (typeof obj !== 'object' || obj === null) return false

  const event = obj as Record<string, unknown>

  // System init events have type: 'system', subtype: 'init', and session_id (required per architecture.md)
  if (event.type === 'system' && event.subtype === 'init') {
    // session_id is required for init events per architecture.md
    if (typeof event.session_id !== 'string' || !event.session_id) {
      return false
    }
    return true
  }

  // Regular events must have type field with known value
  const validTypes = ['user', 'assistant', 'summary', 'file-history-snapshot']
  if (!validTypes.includes(event.type as string)) {
    return false
  }

  return true
}

/**
 * Parse JSONL file and yield events one by one
 * Handles malformed lines gracefully by skipping with warning
 * Validates event structure before yielding
 */
async function* parseJsonlFile(filePath: string): AsyncGenerator<ConversationEvent> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (isValidEvent(parsed)) {
        yield parsed
      } else {
        console.warn(
          `Unexpected event structure in ${filePath}: ${JSON.stringify(parsed).slice(0, 100)}...`
        )
      }
    } catch {
      console.warn(`Malformed JSON in ${filePath}: ${line.slice(0, 50)}...`)
    }
  }
}

/**
 * Determine if a file path represents a sub-agent conversation
 * Sub-agents are in paths like: .../subagents/agent-<6-char>.jsonl
 */
function isSubAgentPath(path: string): boolean {
  return path.includes('/subagents/') && /agent-[0-9a-f]{6}\.jsonl$/i.test(path)
}

/**
 * Extract session ID from conversation events
 * Uses init message session_id or falls back to first event's sessionId
 */
function extractSessionId(events: ConversationEvent[]): string {
  for (const event of events) {
    // Init message has session_id field
    if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
      return event.session_id
    }
    // Regular events have sessionId field
    if (event.sessionId) {
      return event.sessionId
    }
  }
  return 'unknown'
}

/**
 * Unified conversation loader
 * Handles both main session files and sub-agent files
 * Determines conversation type from file path structure (AC: 3)
 *
 * @param path - Absolute path to the .jsonl conversation file
 * @returns Parsed conversation with events, sessionId, and isSubAgent flag
 * @throws If file cannot be read (file not found, permissions, etc.)
 */
export async function loadConversation(path: string): Promise<Conversation> {
  const events: ConversationEvent[] = []

  for await (const event of parseJsonlFile(path)) {
    events.push(event)
  }

  const sessionId = extractSessionId(events)
  const isSubAgent = isSubAgentPath(path)

  return {
    events,
    sessionId,
    isSubAgent
  }
}
