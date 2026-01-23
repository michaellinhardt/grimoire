import { useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useConversationStore } from '../store/useConversationStore'
import { useSessionStore, selectSessionById } from '../store/useSessionStore'

interface UseSendMessageOptions {
  /** Current session ID (null for new sessions) */
  sessionId: string | null
  /** Current tab ID */
  tabId: string
  /** Folder path override (for new sessions without existing session record) */
  folderPath?: string
}

interface UseSendMessageResult {
  /** Send a message to the session */
  sendMessage: (message: string) => Promise<void>
  /** Whether a send operation is in progress */
  isSending: boolean
}

/**
 * Hook that orchestrates the message send flow.
 * Handles optimistic updates, IPC calls, and state management.
 *
 * @param options - Configuration options
 * @returns Send function and loading state
 */
export function useSendMessage({
  sessionId,
  tabId,
  folderPath: folderPathOverride
}: UseSendMessageOptions): UseSendMessageResult {
  const { updateTabSessionId } = useUIStore()
  const { addOptimisticMessage, confirmMessage, markMessageFailed, addErrorMessage } =
    useConversationStore()
  const { sessions } = useSessionStore()

  const sendMessage = useCallback(
    async (message: string) => {
      // Validate message is not empty
      const trimmed = message.trim()
      if (!trimmed) {
        console.error('[useSendMessage] Empty message cannot be sent')
        return
      }

      // Validate message length (100KB limit)
      const MAX_MESSAGE_LENGTH = 100000
      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        addErrorMessage(
          sessionId ?? crypto.randomUUID(),
          `Message exceeds ${MAX_MESSAGE_LENGTH} character limit (${trimmed.length} chars)`
        )
        return
      }

      // Determine if this is a new session
      const isNewSession = sessionId === null
      const actualSessionId = sessionId ?? crypto.randomUUID()

      // Get folder path from existing session or use override
      let resolvedFolderPath: string | undefined
      if (isNewSession) {
        resolvedFolderPath = folderPathOverride
      } else {
        const session = selectSessionById(sessions, actualSessionId)
        if (!session) {
          const errorMsg = `Session ${actualSessionId} not found in store. App state corruption.`
          console.error('[useSendMessage]', errorMsg)
          addErrorMessage(actualSessionId, errorMsg)
          return
        }
        resolvedFolderPath = session.folderPath
      }

      // Validate folder path is available
      if (!resolvedFolderPath) {
        const errorMsg = `Session ${actualSessionId} missing required folderPath. Database integrity issue.`
        console.error('[useSendMessage]', errorMsg)
        addErrorMessage(actualSessionId, errorMsg)
        return
      }

      // 1. Add optimistic message
      const { messageId } = addOptimisticMessage(actualSessionId, trimmed)

      // Note: State transition to 'working' is now handled by InstanceStateManager
      // in cc-spawner when the process spawns. We subscribe via useInstanceState.
      // DO NOT set state here - let the event-driven flow handle it.

      try {
        // 2. Call IPC to send message
        const result = await window.grimoireAPI.sessions.sendMessage({
          sessionId: actualSessionId,
          message,
          folderPath: resolvedFolderPath,
          isNewSession
        })

        if (result.success) {
          // 3. Confirm the optimistic message
          confirmMessage(actualSessionId, messageId)
          // 3b. For new sessions, update tab with persisted sessionId AFTER IPC success
          if (isNewSession) {
            updateTabSessionId(tabId, actualSessionId)
          }
          // Note: State transitions (working -> idle/error) are handled by
          // InstanceStateManager via instance:stateChanged events (Story 3b-3)
        } else {
          // 4. Handle failure
          markMessageFailed(actualSessionId, messageId)
          addErrorMessage(
            actualSessionId,
            `Failed to send message: ${result.error ?? 'Unknown error'}`
          )
          // Note: State transition to 'error' is handled by InstanceStateManager
          // via PROCESS_ERROR event when spawn fails (Story 3b-3)
        }
      } catch (error) {
        // 5. Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        markMessageFailed(actualSessionId, messageId)
        addErrorMessage(actualSessionId, `Error: ${errorMessage}`)
        // Note: State transition to 'error' is handled by InstanceStateManager
        // via PROCESS_ERROR event (Story 3b-3)
      }
    },
    [
      sessionId,
      tabId,
      folderPathOverride,
      sessions,
      updateTabSessionId,
      addOptimisticMessage,
      confirmMessage,
      markMessageFailed,
      addErrorMessage
    ]
  )

  // Derive isSending from tab state reactively (will be refined in Story 3a-3)
  const isSending = useUIStore(
    (state) => state.tabs.find((t) => t.id === tabId)?.sessionState === 'working'
  )

  return { sendMessage, isSending }
}
