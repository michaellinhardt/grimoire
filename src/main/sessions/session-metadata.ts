import type { SessionMetadata } from '../../shared/types/ipc'

/**
 * DB row type for session_metadata table (snake_case)
 * Exported for IPC handler type annotations
 */
export interface DBSessionMetadataRow {
  session_id: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  model: string | null
  updated_at: number | null
}

/**
 * Transform database row to SessionMetadata type
 * @param row - Database row with snake_case columns
 * @returns SessionMetadata with camelCase properties
 */
export function toSessionMetadata(row: DBSessionMetadataRow): SessionMetadata {
  return {
    sessionId: row.session_id,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalCostUsd: row.total_cost_usd,
    model: row.model,
    updatedAt: row.updated_at
  }
}
