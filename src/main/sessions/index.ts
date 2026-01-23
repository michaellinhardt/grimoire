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
export type {
  Conversation,
  ConversationEvent,
  SubAgentEntry,
  SubAgentIndex,
  SpawnOptions
} from './types'
