/**
 * Format duration in milliseconds to human-readable string.
 * - 0-59 seconds: "< 1m"
 * - 60+ seconds and < 60 minutes: "45m"
 * - 60+ minutes: "2h 13m"
 * - Edge cases: negative values treated as 0
 *
 * @param ms Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDuration(ms: number): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '< 1m'

  const totalMinutes = Math.floor(ms / 60000)
  if (totalMinutes < 1) return '< 1m'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
