/**
 * Formats a timestamp as a human-readable relative time string.
 * @param timestamp - Unix timestamp in milliseconds, or null/undefined
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (timestamp == null) return 'Never'

  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  // Older than a week: show date
  return new Date(timestamp).toLocaleDateString()
}
