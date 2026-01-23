import type { ToolUseBlock } from '@renderer/features/sessions/components/types'

/**
 * Truncate a file path, showing the end with "..." prefix if too long
 * @param path - File path to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated path string
 */
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path
  return '...' + path.slice(-(maxLength - 3))
}

/**
 * Generate a brief human-readable summary for a tool call.
 * Used in collapsed ToolCallCard to show what the tool did.
 *
 * @param toolCall - The tool use block to summarize
 * @returns A brief summary string (e.g., "src/main/index.ts")
 *
 * @example
 * formatToolSummary({ name: 'Read', input: { file_path: 'src/main/index.ts' } })
 * // Returns: "src/main/index.ts"
 *
 * formatToolSummary({ name: 'Bash', input: { command: 'npm run build && npm test' } })
 * // Returns: "npm run build && npm test"
 */
export function formatToolSummary(toolCall: ToolUseBlock): string {
  const { name, input } = toolCall

  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const filePath = (input.file_path as string) || ''
      return truncatePath(filePath, 40)
    }

    case 'NotebookEdit': {
      const notebookPath = (input.notebook_path as string) || ''
      return truncatePath(notebookPath, 40)
    }

    case 'Bash': {
      const command = (input.command as string) || ''
      return command.length > 50 ? command.slice(0, 50) + '...' : command
    }

    case 'Glob': {
      const pattern = (input.pattern as string) || ''
      return pattern.length > 40 ? pattern.slice(0, 40) + '...' : pattern
    }

    case 'Grep': {
      const pattern = (input.pattern as string) || ''
      return pattern.length > 30 ? pattern.slice(0, 30) + '...' : pattern
    }

    case 'WebSearch': {
      const query = (input.query as string) || ''
      return query.length > 40 ? query.slice(0, 40) + '...' : query
    }

    case 'WebFetch': {
      const url = (input.url as string) || ''
      try {
        const urlObj = new URL(url)
        const display = urlObj.hostname + urlObj.pathname
        return display.length > 40 ? display.slice(0, 40) + '...' : display
      } catch {
        return url.length > 40 ? url.slice(0, 40) + '...' : url
      }
    }

    case 'Task':
      // Sub-agent - handled in Story 2b.3, provide fallback
      return (input.subagent_type as string) || 'Agent task'

    case 'Skill': {
      // Skill invocation - show skill name
      const skillName = (input.skill as string) || ''
      return skillName || 'Skill'
    }

    default:
      return name
  }
}
