// Internal types that don't need Zod validation (not crossing IPC)

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image'
  text?: string
  // For tool_use blocks
  id?: string // e.g., "toolu_01HXYyux..."
  name?: string // e.g., "Read", "Write", "Edit", "Task"
  input?: Record<string, unknown>
  // For tool_result blocks
  tool_use_id?: string // Matches ToolUseBlock.id
  content?: string | ContentBlock[]
}

/**
 * Token usage information from Claude API responses
 * Uses snake_case field names to match Claude Code JSONL format per architecture.md
 */
export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

/**
 * Base event fields common to all conversation events
 */
interface BaseEventFields {
  uuid: string
  parentUuid: string | null
  sessionId: string
  timestamp: string
  isSidechain: boolean
  agentId?: string
}

/**
 * Regular conversation events (user, assistant, summary, etc.)
 */
interface RegularEvent extends BaseEventFields {
  type: 'user' | 'assistant' | 'summary' | 'file-history-snapshot'
  message?: {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
    model?: string
    usage?: TokenUsage
  }
}

/**
 * System init event (first line of session file)
 */
interface SystemInitEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
  tools?: unknown[]
  // System events may have these but they're optional
  uuid?: string
  sessionId?: string
  parentUuid?: string | null
  timestamp?: string
  isSidechain?: boolean
}

/**
 * Union type for all possible conversation events
 * System events have different structure than regular events
 */
export type ConversationEvent = RegularEvent | SystemInitEvent

export interface Conversation {
  events: ConversationEvent[]
  sessionId: string
  isSubAgent: boolean
}

export interface SubAgentEntry {
  agentId: string
  path: string
  parentId: string
  parentMessageUuid: string
  agentType: string
  label: string
  description?: string
  model?: string
}

export type SubAgentIndex = Map<string, SubAgentEntry>

// ============================================================
// CC Spawner Types (Story 3b-1)
// ============================================================

/**
 * Options for spawning a CC child process.
 */
export interface SpawnOptions {
  /** Session UUID (undefined for new sessions) */
  sessionId?: string
  /** Working directory for the CC process */
  folderPath: string
  /** User message to send via stdin */
  message: string
}

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

// ============================================================
// Instance State Machine Types (Story 3b-3)
// ============================================================

/**
 * Session instance lifecycle states.
 * Matches SessionState in renderer for consistency.
 */
export type InstanceState = 'idle' | 'working' | 'error'

/**
 * State transition events.
 */
export type StateEvent =
  | 'SEND_MESSAGE' // User sends message -> spawns CC
  | 'PROCESS_EXIT' // CC exits normally
  | 'PROCESS_ERROR' // CC exits with error or spawn fails
  | 'ACKNOWLEDGE_ERROR' // User dismisses error

/**
 * Payload for instance:stateChanged IPC event.
 */
export interface InstanceStateChangedEvent {
  sessionId: string
  state: InstanceState
  previousState: InstanceState
}
