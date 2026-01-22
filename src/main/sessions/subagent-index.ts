import { readdir } from 'fs/promises'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'
import type { SubAgentEntry, SubAgentIndex, ConversationEvent } from './types'

/** Maximum lines to read when parsing sub-agent metadata */
const MAX_METADATA_LINES = 20

/**
 * Extract agent ID from sub-agent filename
 * Format: agent-<6-char-hex>.jsonl -> <6-char-hex>
 * Always returns lowercase for consistent lookups
 */
function extractAgentIdFromFilename(filename: string): string | null {
  const match = filename.match(/^agent-([0-9a-f]{6})\.jsonl$/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * Parse first few events from a sub-agent file to extract metadata
 * Looks for:
 * - Parent message UUID (from init or first event)
 * - Agent type (from Task tool input if available)
 */
async function parseSubAgentMetadata(
  filePath: string
): Promise<{ parentMessageUuid: string; agentType: string; parentId: string } | null> {
  const fileStream = createReadStream(filePath)
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let parentMessageUuid = ''
  let agentType = 'SubAgent' // Default type
  let parentId = ''
  let linesRead = 0

  try {
    for await (const line of rl) {
      if (!line.trim()) continue
      linesRead++

      if (linesRead > MAX_METADATA_LINES) break

      try {
        const event = JSON.parse(line) as ConversationEvent

        // Extract parent info from init message or first event
        if (event.type === 'system' && event.subtype === 'init') {
          // Init message may have parent info
          parentId = event.sessionId || ''
        }

        // Extract parentUuid from events
        if (event.parentUuid && !parentMessageUuid) {
          parentMessageUuid = event.parentUuid
        }

        // Try to extract agent type from Task tool usage
        // Sub-agents are spawned via Task tool, which has input containing the task description
        // Only regular events (not system init) have message property
        if (
          event.type !== 'system' &&
          event.message?.content &&
          Array.isArray(event.message.content)
        ) {
          for (const block of event.message.content) {
            // Use correct field name 'name' per architecture.md (not 'tool_name')
            if (block.type === 'tool_use' && block.name === 'Task') {
              // Extract agent type from task description
              // Use correct field name 'input' per architecture.md (not 'tool_input')
              const input = block.input as { description?: string } | undefined
              if (input?.description) {
                // Try to infer type from common patterns
                const desc = input.description.toLowerCase()
                if (desc.includes('explore') || desc.includes('search') || desc.includes('find')) {
                  agentType = 'Explore'
                } else if (
                  desc.includes('bash') ||
                  desc.includes('terminal') ||
                  desc.includes('command')
                ) {
                  agentType = 'Bash'
                } else if (desc.includes('read') || desc.includes('file')) {
                  agentType = 'Read'
                } else if (
                  desc.includes('write') ||
                  desc.includes('edit') ||
                  desc.includes('modify')
                ) {
                  agentType = 'Write'
                } else if (desc.includes('test')) {
                  agentType = 'Test'
                } else if (desc.includes('agent')) {
                  agentType = 'Agent'
                }
              }
            }
          }
        }

        // Also check sessionId for parent reference
        if (event.sessionId && !parentId) {
          parentId = event.sessionId
        }
      } catch (error) {
        // Skip malformed JSON lines, but log non-JSON errors
        if (!(error instanceof SyntaxError)) {
          console.warn(`Error parsing line in ${filePath}:`, error)
        }
        continue
      }
    }
  } finally {
    // Ensure proper cleanup: close readline interface and destroy the underlying stream
    rl.close()
    fileStream.destroy()
  }

  if (!parentMessageUuid && !parentId) {
    return null
  }

  return {
    parentMessageUuid: parentMessageUuid || 'unknown',
    agentType,
    parentId: parentId || 'unknown'
  }
}

/**
 * Build sub-agent index for a session
 * Scans the subagents directory and extracts metadata for each agent file
 *
 * @param sessionId - The parent session ID
 * @param sessionPath - Path to the session directory (containing uuid.jsonl and uuid/ folder)
 * @returns Map of agentId -> SubAgentEntry
 */
export async function buildSubAgentIndex(
  sessionId: string,
  sessionPath: string
): Promise<SubAgentIndex> {
  const index: SubAgentIndex = new Map()

  // Sub-agents are in {sessionPath}/subagents/agent-<6-char>.jsonl
  const subagentsDir = join(sessionPath, 'subagents')

  let entries
  try {
    entries = await readdir(subagentsDir, { withFileTypes: true })
  } catch {
    // No subagents directory - return empty index
    return index
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue

    const agentId = extractAgentIdFromFilename(entry.name)
    if (!agentId) continue

    const filePath = join(subagentsDir, entry.name)
    const metadata = await parseSubAgentMetadata(filePath)

    if (metadata) {
      const subAgentEntry: SubAgentEntry = {
        agentId,
        path: filePath,
        parentId: metadata.parentId || sessionId,
        parentMessageUuid: metadata.parentMessageUuid,
        agentType: metadata.agentType,
        label: `${metadata.agentType}-${agentId}`
      }

      index.set(agentId, subAgentEntry)
    }
  }

  return index
}
