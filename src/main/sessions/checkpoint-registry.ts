/**
 * In-memory storage for user message checkpoints.
 * Key: sessionId, Value: array of checkpoint UUIDs (chronological order)
 *
 * Used for rewind capability - Epic 4 will add sessions:getCheckpoints IPC handler.
 * Checkpoints are user message UUIDs that can be used with CC's --checkpoint flag.
 */
export const checkpointRegistry = new Map<string, string[]>()

/**
 * Maximum checkpoints to store per session (memory limit).
 */
const MAX_CHECKPOINTS_PER_SESSION = 100

/**
 * Add a checkpoint UUID for a session.
 * Maintains chronological order with newest at the end.
 *
 * @param sessionId - Session UUID
 * @param checkpointUuid - User message UUID to store as checkpoint
 */
export function addCheckpoint(sessionId: string, checkpointUuid: string): void {
  const existing = checkpointRegistry.get(sessionId) ?? []

  // Avoid duplicates (shouldn't happen but be safe)
  if (existing.includes(checkpointUuid)) return

  // Add new checkpoint
  const updated = [...existing, checkpointUuid]

  // Trim if over limit (remove oldest)
  if (updated.length > MAX_CHECKPOINTS_PER_SESSION) {
    updated.shift()
  }

  checkpointRegistry.set(sessionId, updated)
}

/**
 * Get all checkpoints for a session.
 *
 * @param sessionId - Session UUID
 * @returns Array of checkpoint UUIDs in chronological order
 */
export function getCheckpoints(sessionId: string): string[] {
  return checkpointRegistry.get(sessionId) ?? []
}

/**
 * Clear checkpoints for a session.
 * Called when session is deleted or app quits.
 *
 * @param sessionId - Session UUID
 */
export function clearCheckpoints(sessionId: string): void {
  checkpointRegistry.delete(sessionId)
}
