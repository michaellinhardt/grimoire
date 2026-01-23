import type { ConversationMessage, TimelineEvent, ToolUseBlock, SubAgentBlock } from '../types'

/**
 * Maximum characters for summary truncation
 */
const SUMMARY_MAX_LENGTH = 50

/**
 * Truncate text to max length with ellipsis
 */
function truncateSummary(text: string, maxLength: number = SUMMARY_MAX_LENGTH): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Extract a one-line summary from message content
 * For tool calls, uses tool name + primary parameter
 * For sub-agents, uses agent type + short ID
 */
function extractSummary(
  message: ConversationMessage,
  toolCall?: ToolUseBlock,
  subAgent?: SubAgentBlock
): string {
  // Sub-agent: "Explore-a8b2"
  if (subAgent) {
    const shortId = subAgent.id.slice(-4)
    return `${subAgent.agentType}-${shortId}`
  }

  // Tool call: "Read src/main/index.ts"
  if (toolCall) {
    const input = toolCall.input
    // Extract primary parameter based on tool type
    if (toolCall.name === 'Read' && input.file_path) {
      return `Read ${truncateSummary(String(input.file_path), 40)}`
    }
    if (toolCall.name === 'Write' && input.file_path) {
      return `Write ${truncateSummary(String(input.file_path), 40)}`
    }
    if (toolCall.name === 'Edit' && input.file_path) {
      return `Edit ${truncateSummary(String(input.file_path), 40)}`
    }
    if (toolCall.name === 'Bash' && input.command) {
      return `Bash: ${truncateSummary(String(input.command), 40)}`
    }
    if (toolCall.name === 'Glob' && input.pattern) {
      return `Glob ${truncateSummary(String(input.pattern), 40)}`
    }
    if (toolCall.name === 'Grep' && input.pattern) {
      return `Grep ${truncateSummary(String(input.pattern), 40)}`
    }
    return toolCall.name
  }

  // Regular message: first line, truncated
  const firstLine = message.content.split('\n')[0]
  return truncateSummary(firstLine)
}

/**
 * Estimate token count from message content
 * Uses rough approximation: ~4 chars per token for English text
 * Returns undefined if content is empty
 *
 * FIXME: In Epic 3b, replace this with actual token counts from ConversationMessage.tokenCount
 * or from Claude API response metadata. This estimation will show inaccurate values.
 */
function estimateTokenCount(content: string): number | undefined {
  if (!content) return undefined
  return Math.ceil(content.length / 4)
}

/**
 * Convert a ConversationMessage array to TimelineEvent array.
 * Each message becomes one or more timeline events:
 * - User messages: 1 user event
 * - Assistant messages: 1 assistant event + N tool events + N sub-agent events
 *
 * @param messages - Array of conversation messages
 * @returns Array of timeline events for display
 */
export function convertToTimelineEvents(messages: ConversationMessage[]): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      // User message -> user event
      events.push({
        uuid: message.uuid,
        type: 'user',
        summary: extractSummary(message),
        timestamp: message.timestamp,
        tokenCount: estimateTokenCount(message.content)
      })
    } else {
      // Track if we added any events for this assistant message
      let hasEvents = false

      // Assistant message -> assistant event (if has content)
      if (message.content) {
        events.push({
          uuid: message.uuid,
          type: 'assistant',
          summary: extractSummary(message),
          timestamp: message.timestamp,
          tokenCount: estimateTokenCount(message.content)
        })
        hasEvents = true
      }

      // Tool calls -> tool events
      if (message.toolUseBlocks) {
        for (const tool of message.toolUseBlocks) {
          // Skip Task/Skill tools that have corresponding sub-agents
          if (
            (tool.name === 'Task' || tool.name === 'Skill') &&
            message.subAgentBlocks?.some((sa) => sa.parentMessageUuid === message.uuid)
          ) {
            continue
          }
          events.push({
            uuid: `${message.uuid}-tool-${tool.id}`,
            type: 'tool',
            summary: extractSummary(message, tool),
            timestamp: message.timestamp,
            tokenCount: estimateTokenCount(JSON.stringify(tool.input))
          })
          hasEvents = true
        }
      }

      // Sub-agents -> sub_agent events
      if (message.subAgentBlocks) {
        for (const subAgent of message.subAgentBlocks) {
          const shortId = subAgent.id.slice(-4)
          events.push({
            uuid: `${message.uuid}-subagent-${subAgent.id}`,
            type: 'sub_agent',
            summary: `${subAgent.agentType}-${shortId}`,
            timestamp: message.timestamp,
            tokenCount: undefined, // Sub-agent token count not available at message level
            agentType: subAgent.agentType,
            agentId: shortId
          })
          hasEvents = true
        }
      }

      // Fallback: if assistant message has no content, tools, or sub-agents,
      // still create an event so the message appears in timeline
      if (!hasEvents) {
        events.push({
          uuid: message.uuid,
          type: 'assistant',
          summary: '(empty response)',
          timestamp: message.timestamp,
          tokenCount: undefined
        })
      }
    }
  }

  return events
}
