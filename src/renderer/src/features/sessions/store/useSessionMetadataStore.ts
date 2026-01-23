import { create } from 'zustand'
import type { SessionMetadata } from '../../../../../shared/types/ipc'

interface SessionMetadataState {
  // State
  metadata: Map<string, SessionMetadata>
  isLoading: boolean
  error: string | null

  // Actions
  loadMetadata: (sessionId: string) => Promise<void>
  updateMetadata: (sessionId: string, data: Partial<SessionMetadata>) => void
  clearMetadata: (sessionId: string) => void
  clearError: () => void
}

export const useSessionMetadataStore = create<SessionMetadataState>((set) => ({
  // Initial state
  metadata: new Map(),
  isLoading: false,
  error: null,

  // Actions
  loadMetadata: async (sessionId: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.grimoireAPI.sessions.getMetadata(sessionId)
      set((state) => {
        const newMap = new Map(state.metadata)
        if (result) {
          newMap.set(sessionId, result)
        } else {
          // Clear any stale entry if metadata no longer exists
          newMap.delete(sessionId)
        }
        return { metadata: newMap, isLoading: false }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load metadata'
      console.error('Failed to load metadata:', error)
      set({ error: errorMessage, isLoading: false })
    }
  },

  updateMetadata: (sessionId: string, data: Partial<SessionMetadata>) => {
    set((state) => {
      const existing = state.metadata.get(sessionId)
      if (!existing) return state
      const updated = { ...existing, ...data }
      return { metadata: new Map(state.metadata).set(sessionId, updated) }
    })
  },

  clearMetadata: (sessionId: string) => {
    set((state) => {
      const newMap = new Map(state.metadata)
      newMap.delete(sessionId)
      return { metadata: newMap }
    })
  },

  clearError: () => {
    set({ error: null })
  }
}))

/**
 * Get metadata for a specific session from the metadata map
 * @param metadata - Map of session metadata keyed by sessionId
 * @param sessionId - UUID of the session
 * @returns The metadata or undefined if not found
 */
export const selectMetadataBySessionId = (
  metadata: Map<string, SessionMetadata>,
  sessionId: string
): SessionMetadata | undefined => {
  return metadata.get(sessionId)
}
