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
