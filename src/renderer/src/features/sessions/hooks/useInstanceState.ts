import { useEffect, useCallback } from 'react'
import { useUIStore, type SessionState } from '@renderer/shared/store/useUIStore'

interface UseInstanceStateOptions {
  /** Session ID to track (can be null for new sessions) */
  sessionId: string | null
  /** Tab ID for UI state updates */
  tabId: string
}

interface UseInstanceStateResult {
  /** Current session state */
  state: SessionState
  /** Acknowledge an error and return to idle */
  acknowledgeError: () => Promise<void>
}

/**
 * Hook for tracking instance state changes.
 * Subscribes to instance:stateChanged events and updates tab state.
 * Also fetches initial state on mount to sync with main process.
 *
 * @param options - Session and tab configuration
 * @returns Current state and error acknowledgement function
 */
export function useInstanceState({
  sessionId,
  tabId
}: UseInstanceStateOptions): UseInstanceStateResult {
  const { updateTabSessionState, tabs } = useUIStore()

  // Get current state from tab
  const currentTab = tabs.find((t) => t.id === tabId)
  const state: SessionState = currentTab?.sessionState ?? 'idle'

  // Fetch initial state on mount to sync with main process
  // This handles page refresh scenarios where CC might still be running
  useEffect(() => {
    if (!sessionId) return

    // Fetch current state from main process
    window.grimoireAPI.sessions
      .getInstanceState(sessionId)
      .then((result) => {
        if (result.state !== state) {
          updateTabSessionState(tabId, result.state)
        }
      })
      .catch((error) => {
        console.error('[useInstanceState] Failed to fetch initial state:', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount/sessionId change, not on state change to avoid infinite loop
  }, [sessionId])

  // Subscribe to state change events
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = window.grimoireAPI.sessions.onInstanceStateChanged((event) => {
      // Match by sessionId - could be the tab's sessionId or a pending-* temp ID
      if (event.sessionId === sessionId) {
        updateTabSessionState(tabId, event.state)
      }
    })

    return unsubscribe
  }, [sessionId, tabId, updateTabSessionState])

  // Acknowledge error handler
  const acknowledgeError = useCallback(async () => {
    if (!sessionId) return
    try {
      const result = await window.grimoireAPI.sessions.acknowledgeError(sessionId)
      if (result.success) {
        updateTabSessionState(tabId, result.newState)
      }
    } catch (error) {
      console.error('[useInstanceState] Failed to acknowledge error:', error)
    }
  }, [sessionId, tabId, updateTabSessionState])

  return { state, acknowledgeError }
}
