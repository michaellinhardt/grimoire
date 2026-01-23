import { useState, useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useConversationStore } from '../store/useConversationStore'

interface UseAbortSessionResult {
  /** Function to trigger abort */
  abort: () => Promise<void>
  /** Whether abort is currently in progress */
  isAborting: boolean
}

/**
 * Hook for aborting a running CC session.
 * Handles IPC call, state transitions, and aborted message.
 *
 * @param sessionId - Session ID to abort (null if no session)
 * @param tabId - Tab ID for state updates
 * @returns Abort function and loading state
 */
export function useAbortSession(sessionId: string | null, tabId: string): UseAbortSessionResult {
  const [isAborting, setIsAborting] = useState(false)
  const { updateTabSessionState } = useUIStore()
  const { addAbortedMessage } = useConversationStore()

  const abort = useCallback(async () => {
    if (!sessionId || isAborting) return

    setIsAborting(true)

    try {
      const result = await window.grimoireAPI.sessions.abort({ sessionId })

      if (result.success) {
        // Add aborted message to conversation
        addAbortedMessage(sessionId)
        // Transition to idle state
        updateTabSessionState(tabId, 'idle')
      } else {
        // Abort failed - log error but still transition to idle
        console.error('[useAbortSession] Abort failed:', result.error)
        updateTabSessionState(tabId, 'idle')
      }
    } catch (error) {
      console.error('[useAbortSession] Abort error:', error)
      // Even on error, transition to idle (process may have already exited)
      updateTabSessionState(tabId, 'idle')
    } finally {
      setIsAborting(false)
    }
  }, [sessionId, tabId, isAborting, updateTabSessionState, addAbortedMessage])

  return { abort, isAborting }
}
