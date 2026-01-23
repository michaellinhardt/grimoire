import { create } from 'zustand'
import type { ConversationMessage, ToolUseBlock } from '../components/types'

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

/**
 * Streaming message state (Story 3a-3)
 */
export interface StreamingState {
  content: string
  toolCalls: ToolUseBlock[]
  startedAt: number
}

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

  // Streaming state and actions (Story 3a-3)
  /** Streaming state per session */
  streamingMessages: Record<string, StreamingState | null>

  /** Start streaming for a session */
  startStreaming: (sessionId: string) => void

  /** Append content chunk to streaming message */
  appendStreamChunk: (sessionId: string, chunk: string) => void

  /** Add tool call to streaming message */
  addStreamToolCall: (sessionId: string, toolCall: ToolUseBlock) => void

  /** Complete streaming and convert to permanent message */
  completeStreaming: (sessionId: string, success: boolean, error?: string) => void

  /** Clear streaming state for a session */
  clearStreaming: (sessionId: string) => void
}

export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  messages: new Map(),
  pendingMessages: new Map(),
  streamingMessages: {},

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
  },

  // Streaming actions (Story 3a-3)
  startStreaming: (sessionId) => {
    set((state) => ({
      streamingMessages: {
        ...state.streamingMessages,
        [sessionId]: {
          content: '',
          toolCalls: [],
          startedAt: Date.now()
        }
      }
    }))
  },

  appendStreamChunk: (sessionId, chunk) => {
    set((state) => {
      const current = state.streamingMessages[sessionId]
      if (!current) return state
      return {
        streamingMessages: {
          ...state.streamingMessages,
          [sessionId]: {
            ...current,
            content: current.content + chunk
          }
        }
      }
    })
  },

  addStreamToolCall: (sessionId, toolCall) => {
    set((state) => {
      const current = state.streamingMessages[sessionId]
      if (!current) return state
      return {
        streamingMessages: {
          ...state.streamingMessages,
          [sessionId]: {
            ...current,
            toolCalls: [...current.toolCalls, toolCall]
          }
        }
      }
    })
  },

  completeStreaming: (sessionId, success, error) => {
    const state = get()
    const streaming = state.streamingMessages[sessionId]
    if (!streaming) return

    if (success && (streaming.content || streaming.toolCalls.length > 0)) {
      // Convert streaming content to permanent assistant message
      // Include message if it has text content OR tool calls (AC5: tool-only responses)
      const assistantMessage: ConversationMessage = {
        uuid: `assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: streaming.content,
        timestamp: Date.now(),
        toolUseBlocks: streaming.toolCalls.length > 0 ? streaming.toolCalls : undefined
      }

      set((state) => {
        const newMessages = new Map(state.messages)
        const sessionMessages = newMessages.get(sessionId) ?? []
        newMessages.set(sessionId, [...sessionMessages, assistantMessage])

        const newStreaming = { ...state.streamingMessages }
        delete newStreaming[sessionId]

        return {
          messages: newMessages,
          streamingMessages: newStreaming
        }
      })
    } else if (!success) {
      // Add error message when stream fails (AC6: error state handling)
      const errorMessage: SystemMessage = {
        type: 'system',
        uuid: `error-${crypto.randomUUID()}`,
        content: error ?? 'Stream ended with error',
        timestamp: Date.now(),
        isError: true
      }

      set((state) => {
        const newMessages = new Map(state.messages)
        const sessionMessages = newMessages.get(sessionId) ?? []
        newMessages.set(sessionId, [...sessionMessages, errorMessage])

        const newStreaming = { ...state.streamingMessages }
        delete newStreaming[sessionId]

        return {
          messages: newMessages,
          streamingMessages: newStreaming
        }
      })
    } else {
      // Success but no content and no tool calls - just clear state
      set((state) => {
        const newStreaming = { ...state.streamingMessages }
        delete newStreaming[sessionId]
        return { streamingMessages: newStreaming }
      })
    }
  },

  clearStreaming: (sessionId) => {
    set((state) => {
      const newStreaming = { ...state.streamingMessages }
      delete newStreaming[sessionId]
      return { streamingMessages: newStreaming }
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
