// Barrel export for sessions module
export {
  scanClaudeConfigDir,
  syncSessionsToDatabase,
  listSessions,
  extractSessionMetadata
} from './session-scanner'
export { loadConversation } from './conversation-loader'
export { buildSubAgentIndex } from './subagent-index'
export { spawnCC } from './cc-spawner'
export { createStreamParser, emitToRenderer } from './stream-parser'
export { addCheckpoint, getCheckpoints, clearCheckpoints } from './checkpoint-registry'
export type {
  Conversation,
  ConversationEvent,
  SubAgentEntry,
  SubAgentIndex,
  SpawnOptions,
  TokenInfo,
  ParsedInitEvent,
  ParsedUserEvent,
  ParsedAssistantEvent,
  ParsedToolResultEvent,
  ParsedResultEvent,
  ParsedStreamEvent
} from './types'
