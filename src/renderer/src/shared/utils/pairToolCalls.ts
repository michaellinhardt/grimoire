import type { ToolResultBlock } from '@renderer/features/sessions/components/types'

/**
 * Find the result for a specific tool call by ID.
 * MVP implementation for mock data where results are already available.
 *
 * @param toolId - The tool_use block's id
 * @param results - Array of tool results to search
 * @returns The matching result or null if not found
 *
 * @example
 * const result = findToolResult('toolu_01Read001', message.toolResults)
 */
export function findToolResult(
  toolId: string,
  results: ToolResultBlock[] | undefined
): ToolResultBlock | null {
  if (!results || results.length === 0) return null
  return results.find((r) => r.tool_use_id === toolId) ?? null
}

/**
 * Check if a tool result indicates an error.
 * Priority:
 * 1. If is_error === true, return true (explicit error)
 * 2. If is_error === false, return false (explicitly not an error, even if content has error text)
 * 3. If is_error is undefined, use pattern matching fallback
 *
 * @param result - The tool result to check
 * @returns true if the result indicates an error
 */
export function isToolError(result: ToolResultBlock | null): boolean {
  if (!result) return false

  // Check explicit error indicator first (from Claude Code API)
  // NOTE: is_error: false explicitly means NOT an error, overriding content patterns
  if (result.is_error === true) {
    return true
  }
  if (result.is_error === false) {
    return false
  }

  // Fallback for legacy responses where is_error is undefined:
  // Pattern matching for common error signatures in content
  const content = result.content.toLowerCase()
  return (
    content.includes('error:') ||
    content.includes('failed') ||
    content.includes('not found') ||
    content.includes('permission denied') ||
    content.includes('enoent') ||
    content.startsWith('error')
  )
}

/**
 * Extract a brief error message preview from a tool result.
 * Shows first line or first 100 chars, whichever is shorter.
 *
 * @param result - The tool result containing the error
 * @returns Brief error message for collapsed display
 */
export function getErrorPreview(result: ToolResultBlock): string {
  const content = result.content
  const firstLine = content.split('\n')[0]
  return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine
}
