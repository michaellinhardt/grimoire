import { describe, it, expect, beforeEach } from 'vitest'
import {
  useConversationStore,
  isMessagePending,
  hasSessionPendingMessages
} from './useConversationStore'

describe('useConversationStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useConversationStore.setState({
      messages: new Map(),
      pendingMessages: new Map(),
      streamingMessages: {}
    })
  })

  const sessionId = '550e8400-e29b-41d4-a716-446655440001'

  describe('addOptimisticMessage', () => {
    it('adds message to session messages', () => {
      const { addOptimisticMessage, getMessages } = useConversationStore.getState()

      const { messageId } = addOptimisticMessage(sessionId, 'Hello world')

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        uuid: messageId,
        role: 'user',
        content: 'Hello world'
      })
    })

    it('returns generated message ID', () => {
      const { addOptimisticMessage } = useConversationStore.getState()

      const { messageId } = addOptimisticMessage(sessionId, 'Hello')

      expect(messageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('marks message as pending', () => {
      const { addOptimisticMessage } = useConversationStore.getState()

      const { messageId } = addOptimisticMessage(sessionId, 'Hello')

      const state = useConversationStore.getState()
      expect(isMessagePending(state.pendingMessages, sessionId, messageId)).toBe(true)
    })

    it('appends multiple messages in order', () => {
      const { addOptimisticMessage, getMessages } = useConversationStore.getState()

      addOptimisticMessage(sessionId, 'First')
      addOptimisticMessage(sessionId, 'Second')
      addOptimisticMessage(sessionId, 'Third')

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe('First')
      expect(messages[1].content).toBe('Second')
      expect(messages[2].content).toBe('Third')
    })
  })

  describe('confirmMessage', () => {
    it('removes message from pending', () => {
      const { addOptimisticMessage, confirmMessage } = useConversationStore.getState()

      const { messageId } = addOptimisticMessage(sessionId, 'Hello')
      expect(
        isMessagePending(useConversationStore.getState().pendingMessages, sessionId, messageId)
      ).toBe(true)

      confirmMessage(sessionId, messageId)

      expect(
        isMessagePending(useConversationStore.getState().pendingMessages, sessionId, messageId)
      ).toBe(false)
    })

    it('keeps message in messages list', () => {
      const { addOptimisticMessage, confirmMessage, getMessages } = useConversationStore.getState()

      const { messageId } = addOptimisticMessage(sessionId, 'Hello')
      confirmMessage(sessionId, messageId)

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0].uuid).toBe(messageId)
    })
  })

  describe('addErrorMessage', () => {
    it('adds system error message to session', () => {
      const { addErrorMessage, getMessages } = useConversationStore.getState()

      addErrorMessage(sessionId, 'Something went wrong')

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        type: 'system',
        content: 'Something went wrong',
        isError: true
      })
    })

    it('appends error after existing messages', () => {
      const { addOptimisticMessage, addErrorMessage, getMessages } = useConversationStore.getState()

      addOptimisticMessage(sessionId, 'Hello')
      addErrorMessage(sessionId, 'Error occurred')

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('Hello')
      expect(messages[1].content).toBe('Error occurred')
    })
  })

  describe('getMessages', () => {
    it('returns empty array for unknown session', () => {
      const { getMessages } = useConversationStore.getState()

      const messages = getMessages('unknown-session-id')

      expect(messages).toEqual([])
    })
  })

  describe('clearSession', () => {
    it('removes all messages for session', () => {
      const { addOptimisticMessage, clearSession, getMessages } = useConversationStore.getState()

      addOptimisticMessage(sessionId, 'Hello')
      addOptimisticMessage(sessionId, 'World')

      clearSession(sessionId)

      expect(getMessages(sessionId)).toEqual([])
    })

    it('removes pending messages for session', () => {
      const { addOptimisticMessage, clearSession } = useConversationStore.getState()

      addOptimisticMessage(sessionId, 'Hello')

      clearSession(sessionId)

      expect(
        hasSessionPendingMessages(useConversationStore.getState().pendingMessages, sessionId)
      ).toBe(false)
    })

    it('does not affect other sessions', () => {
      const { addOptimisticMessage, clearSession, getMessages } = useConversationStore.getState()
      const otherSessionId = '550e8400-e29b-41d4-a716-446655440002'

      addOptimisticMessage(sessionId, 'Session 1')
      addOptimisticMessage(otherSessionId, 'Session 2')

      clearSession(sessionId)

      expect(getMessages(sessionId)).toEqual([])
      expect(getMessages(otherSessionId)).toHaveLength(1)
    })
  })

  describe('setMessages', () => {
    it('replaces all messages for session', () => {
      const { addOptimisticMessage, setMessages, getMessages } = useConversationStore.getState()

      addOptimisticMessage(sessionId, 'Old message')

      setMessages(sessionId, [
        { uuid: 'new-1', role: 'user', content: 'New message', timestamp: Date.now() }
      ])

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('New message')
    })
  })

  describe('selectors', () => {
    it('isMessagePending returns false for unknown session', () => {
      const state = useConversationStore.getState()
      expect(isMessagePending(state.pendingMessages, 'unknown', 'unknown')).toBe(false)
    })

    it('hasSessionPendingMessages returns true when session has pending', () => {
      const { addOptimisticMessage } = useConversationStore.getState()

      addOptimisticMessage(sessionId, 'Hello')

      expect(
        hasSessionPendingMessages(useConversationStore.getState().pendingMessages, sessionId)
      ).toBe(true)
    })

    it('hasSessionPendingMessages returns false when all confirmed', () => {
      const { addOptimisticMessage, confirmMessage } = useConversationStore.getState()

      const { messageId } = addOptimisticMessage(sessionId, 'Hello')
      confirmMessage(sessionId, messageId)

      expect(
        hasSessionPendingMessages(useConversationStore.getState().pendingMessages, sessionId)
      ).toBe(false)
    })
  })

  // Story 3a-3: Streaming state tests
  describe('streaming actions', () => {
    it('startStreaming initializes streaming state', () => {
      const { startStreaming } = useConversationStore.getState()

      startStreaming(sessionId)

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]).toBeDefined()
      expect(state.streamingMessages[sessionId]?.content).toBe('')
      expect(state.streamingMessages[sessionId]?.toolCalls).toEqual([])
      expect(state.streamingMessages[sessionId]?.startedAt).toBeGreaterThan(0)
    })

    it('appendStreamChunk accumulates content', () => {
      const { startStreaming, appendStreamChunk } = useConversationStore.getState()

      startStreaming(sessionId)
      appendStreamChunk(sessionId, 'Hello ')
      appendStreamChunk(sessionId, 'world!')

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]?.content).toBe('Hello world!')
    })

    it('appendStreamChunk does nothing if no streaming state', () => {
      const { appendStreamChunk } = useConversationStore.getState()

      appendStreamChunk(sessionId, 'Hello')

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]).toBeUndefined()
    })

    it('addStreamToolCall adds tool to streaming state', () => {
      const { startStreaming, addStreamToolCall } = useConversationStore.getState()

      startStreaming(sessionId)
      addStreamToolCall(sessionId, {
        type: 'tool_use',
        id: 'tool-1',
        name: 'Read',
        input: { file_path: '/test.ts' }
      })

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]?.toolCalls).toHaveLength(1)
      expect(state.streamingMessages[sessionId]?.toolCalls[0].id).toBe('tool-1')
    })

    it('completeStreaming with success creates assistant message', () => {
      const { startStreaming, appendStreamChunk, completeStreaming, getMessages } =
        useConversationStore.getState()

      startStreaming(sessionId)
      appendStreamChunk(sessionId, 'Response content')
      completeStreaming(sessionId, true)

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]).toBeUndefined()

      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        role: 'assistant',
        content: 'Response content'
      })
    })

    it('completeStreaming with success includes tool calls', () => {
      const {
        startStreaming,
        appendStreamChunk,
        addStreamToolCall,
        completeStreaming,
        getMessages
      } = useConversationStore.getState()

      startStreaming(sessionId)
      appendStreamChunk(sessionId, 'Content')
      addStreamToolCall(sessionId, {
        type: 'tool_use',
        id: 'tool-1',
        name: 'Read',
        input: {}
      })
      completeStreaming(sessionId, true)

      const messages = getMessages(sessionId)
      const msg = messages[0]
      // Type guard for ConversationMessage (has role, toolUseBlocks)
      expect('role' in msg && msg.role === 'assistant').toBe(true)
      if ('toolUseBlocks' in msg) {
        expect(msg.toolUseBlocks).toHaveLength(1)
      }
    })

    it('completeStreaming with failure creates error message', () => {
      const { startStreaming, appendStreamChunk, completeStreaming, getMessages } =
        useConversationStore.getState()

      startStreaming(sessionId)
      appendStreamChunk(sessionId, 'Partial content')
      completeStreaming(sessionId, false, 'Network error')

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]).toBeUndefined()
      const messages = getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        type: 'system',
        content: 'Network error',
        isError: true
      })
    })

    it('completeStreaming does nothing without content', () => {
      const { startStreaming, completeStreaming, getMessages } = useConversationStore.getState()

      startStreaming(sessionId)
      completeStreaming(sessionId, true)

      expect(getMessages(sessionId)).toEqual([])
    })

    it('clearStreaming removes streaming state', () => {
      const { startStreaming, appendStreamChunk, clearStreaming } = useConversationStore.getState()

      startStreaming(sessionId)
      appendStreamChunk(sessionId, 'Content')
      clearStreaming(sessionId)

      const state = useConversationStore.getState()
      expect(state.streamingMessages[sessionId]).toBeUndefined()
    })
  })
})
