import { formatRelativeTime } from './formatRelativeTime'

/**
 * Format message timestamp for display in conversation bubbles.
 * Uses relative time for recent messages (<24h) and absolute for older messages.
 *
 * @param timestamp - Unix timestamp in milliseconds, or null/undefined
 * @returns Formatted timestamp string (e.g., "2m ago", "Jan 15, 14:32")
 */
export function formatMessageTimestamp(timestamp: number | null | undefined): string {
  if (timestamp == null) return ''

  const now = Date.now()
  const diff = now - timestamp
  const hours = diff / (1000 * 60 * 60)

  // Less than 24 hours: use relative time
  if (hours < 24) {
    return formatRelativeTime(timestamp)
  }

  // 24+ hours: show date and time
  const date = new Date(timestamp)
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Include year if different from current year
  const year = date.getFullYear()
  const currentYear = new Date().getFullYear()
  if (year !== currentYear) {
    return `${month} ${day}, ${year}, ${time}`
  }

  return `${month} ${day}, ${time}`
}
