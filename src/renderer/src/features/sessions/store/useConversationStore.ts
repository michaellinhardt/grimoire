import { create } from 'zustand'
import type { ConversationMessage } from '../components/types'

/**
 * System message type for error display
 */
export interface SystemMessage {
  type: 'system'
  uuid: string
  content: string
  timestamp: number
  isError: boolean
}

/**
 * Union type for all displayable messages
 */
export type DisplayMessage = ConversationMessage | SystemMessage

interface ConversationStoreState {
  /** Messages keyed by sessionId */
  messages: Map<string, DisplayMessage[]>

  /** Pending message IDs awaiting confirmation */
  pendingMessages: Map<string, Set<string>>

  // Actions
  /** Add an optimistic user message (before IPC confirmation) */
  addOptimisticMessage: (sessionId: string, content: string) => { messageId: string }

  /** Confirm an optimistic message was persisted */
  confirmMessage: (sessionId: string, messageId: string) => void

  /** Mark a message as failed (but keep it visible with error state) */
  markMessageFailed: (sessionId: string, messageId: string) => void

  /** Add a system error message to the conversation */
  addErrorMessage: (sessionId: string, errorContent: string) => void

  /** Get messages for a session */
  getMessages: (sessionId: string) => DisplayMessage[]

  /** Clear messages for a session (e.g., on session close) */
  clearSession: (sessionId: string) => void

  /** Set messages for a session (e.g., on load from storage) */
  setMessages: (sessionId: string, messages: DisplayMessage[]) => void
}

export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  messages: new Map(),
  pendingMessages: new Map(),

  addOptimisticMessage: (sessionId, content) => {
    const messageId = crypto.randomUUID()
    const message: ConversationMessage = {
      uuid: messageId,
      role: 'user',
      content,
      timestamp: Date.now()
    }

    set((state) => {
      const newMessages = new Map(state.messages)
      const sessionMessages = newMessages.get(sessionId) ?? []
      newMessages.set(sessionId, [...sessionMessages, message])

      const newPending = new Map(state.pendingMessages)
      const pendingSet = new Set(newPending.get(sessionId) ?? [])
      pendingSet.add(messageId)
      newPending.set(sessionId, pendingSet)

      return { messages: newMessages, pendingMessages: newPending }
    })

    return { messageId }
  },

  confirmMessage: (sessionId, messageId) => {
    set((state) => {
      const newPending = new Map(state.pendingMessages)
      const pendingSet = newPending.get(sessionId)
      if (pendingSet) {
        pendingSet.delete(messageId)
        if (pendingSet.size === 0) {
          newPending.delete(sessionId)
        } else {
          newPending.set(sessionId, pendingSet)
        }
      }
      return { pendingMessages: newPending }
    })
  },

  markMessageFailed: (sessionId, messageId) => {
    // Keep the message but remove from pending
    // The error message added separately will indicate failure
    get().confirmMessage(sessionId, messageId)
  },

  addErrorMessage: (sessionId, errorContent) => {
    const errorMessage: SystemMessage = {
      type: 'system',
      uuid: `error-${crypto.randomUUID()}`,
      content: errorContent,
      timestamp: Date.now(),
      isError: true
    }

    set((state) => {
      const newMessages = new Map(state.messages)
      const sessionMessages = newMessages.get(sessionId) ?? []
      newMessages.set(sessionId, [...sessionMessages, errorMessage])
      return { messages: newMessages }
    })
  },

  getMessages: (sessionId) => {
    return get().messages.get(sessionId) ?? []
  },

  clearSession: (sessionId) => {
    set((state) => {
      const newMessages = new Map(state.messages)
      newMessages.delete(sessionId)
      const newPending = new Map(state.pendingMessages)
      newPending.delete(sessionId)
      return { messages: newMessages, pendingMessages: newPending }
    })
  },

  setMessages: (sessionId, messages) => {
    set((state) => {
      const newMessages = new Map(state.messages)
      newMessages.set(sessionId, messages)
      return { messages: newMessages }
    })
  }
}))

// Selectors

/**
 * Check if a message is pending confirmation
 */
export const isMessagePending = (
  pendingMessages: Map<string, Set<string>>,
  sessionId: string,
  messageId: string
): boolean => {
  return pendingMessages.get(sessionId)?.has(messageId) ?? false
}

/**
 * Check if session has any pending messages
 */
export const hasSessionPendingMessages = (
  pendingMessages: Map<string, Set<string>>,
  sessionId: string
): boolean => {
  const pending = pendingMessages.get(sessionId)
  return pending !== undefined && pending.size > 0
}
