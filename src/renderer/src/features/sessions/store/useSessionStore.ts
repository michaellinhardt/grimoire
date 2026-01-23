import { create } from 'zustand'
import type {
  SessionWithExists,
  DiscoveredSession,
  SyncResult
} from '../../../../../shared/types/ipc'

interface SessionStoreState {
  // State
  sessions: SessionWithExists[]
  isLoading: boolean
  isScanning: boolean
  error: string | null
  showHiddenSessions: boolean // Story 2a.5

  // Actions
  loadSessions: () => Promise<void>
  triggerScan: () => Promise<SyncResult | null>
  setSessions: (sessions: SessionWithExists[]) => void
  clearError: () => void
  toggleShowHidden: () => void // Story 2a.5
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  // Initial state
  sessions: [],
  isLoading: false,
  isScanning: false,
  error: null,
  showHiddenSessions: false, // Story 2a.5

  // Actions
  loadSessions: async () => {
    set({ isLoading: true, error: null })
    try {
      const options = { includeHidden: get().showHiddenSessions }
      const sessions = await window.grimoireAPI.sessions.list(options)
      set({ sessions, isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions'
      set({ error: errorMessage, isLoading: false })
    }
  },

  triggerScan: async () => {
    set({ isScanning: true, error: null })
    try {
      // First scan the file system
      const scanResult = await window.grimoireAPI.sessions.scan()
      const discovered: DiscoveredSession[] = scanResult.sessions

      // Then sync to database
      const syncResult = await window.grimoireAPI.sessions.sync(discovered)

      // Reload sessions from database to get latest state
      await get().loadSessions()

      set({ isScanning: false })
      return syncResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan sessions'
      set({ error: errorMessage, isScanning: false })
      return null
    }
  },

  setSessions: (sessions) => {
    set({ sessions })
  },

  clearError: () => {
    set({ error: null })
  },

  // Story 2a.5: Toggle show hidden sessions
  toggleShowHidden: () => {
    set((state) => ({ showHiddenSessions: !state.showHiddenSessions }))
    get().loadSessions() // Reload with new filter
  }
}))

// Selectors (as functions to be used with the store)

/**
 * Find a session by its UUID
 * @param sessions - Array of sessions to search
 * @param sessionId - UUID of the session to find
 * @returns The matching session or undefined if not found
 */
export const selectSessionById = (
  sessions: SessionWithExists[],
  sessionId: string
): SessionWithExists | undefined => {
  return sessions.find((s) => s.id === sessionId)
}

/**
 * Filter sessions to only orphaned ones (folder no longer exists on disk)
 * @param sessions - Array of sessions to filter
 * @returns Sessions where the folder path no longer exists
 */
export const selectOrphanedSessions = (sessions: SessionWithExists[]): SessionWithExists[] => {
  return sessions.filter((s) => !s.exists)
}

/**
 * Filter sessions to only active ones (exists, not archived, not hidden)
 * @param sessions - Array of sessions to filter
 * @returns Sessions that should be displayed in the main session list
 */
export const selectActiveSessions = (sessions: SessionWithExists[]): SessionWithExists[] => {
  return sessions.filter((s) => s.exists && !s.archived && !s.isHidden)
}

/**
 * Filter sessions for display, conditionally including hidden sessions (Story 2a.5)
 * @param sessions - Array of sessions to filter
 * @param showHidden - If true, include hidden sessions in the result
 * @returns Sessions that should be displayed based on showHidden setting
 *
 * Usage notes:
 * - When showHidden = false: Same as selectActiveSessions
 * - When showHidden = true: Includes hidden sessions but still excludes archived/non-existent
 */
export const selectDisplayableSessions = (
  sessions: SessionWithExists[],
  showHidden: boolean
): SessionWithExists[] => {
  return sessions.filter((s) => s.exists && !s.archived && (showHidden || !s.isHidden))
}
