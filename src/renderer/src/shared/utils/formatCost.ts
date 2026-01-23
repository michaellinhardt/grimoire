/**
 * Format cost as USD currency
 * Always shows 2 decimal places
 * Returns '$0.00' for invalid inputs (NaN, undefined, null)
 */
export function formatCost(usd: number): string {
  if (usd == null || Number.isNaN(usd)) return '$0.00'
  return `$${usd.toFixed(2)}`
}
