/**
 * Format token count for display
 * < 1000: "123"
 * >= 1000 and < 999500: "1.2k" (rounds to 1 decimal)
 * >= 999500: "1.0M" (avoids awkward "1000.0k")
 * >= 1000000: "1.2M"
 *
 * @param count - The token count to format
 * @returns Formatted string (e.g., "123", "1.2k", "1.5M")
 */
export function formatTokenCount(count: number): string {
  // Handle invalid inputs defensively
  if (count == null || Number.isNaN(count) || count < 0) return '0'
  if (count < 1000) return count.toString()
  // Switch to M before we'd display "1000.0k" (at 999500, toFixed rounds to 1000.0)
  if (count < 999500) return `${(count / 1000).toFixed(1)}k`
  return `${(count / 1000000).toFixed(1)}M`
}
