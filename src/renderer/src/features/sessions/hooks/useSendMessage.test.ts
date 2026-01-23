import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSendMessage } from './useSendMessage'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useConversationStore } from '../store/useConversationStore'
import { useSessionStore } from '../store/useSessionStore'

// Mock grimoireAPI
const mockSendMessage = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', async () => {
  const actual = await vi.importActual('@renderer/shared/store/useUIStore')
  return actual
})

beforeEach(() => {
  // Reset all stores
  useUIStore.setState({
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    rightPanelActiveTab: 'info',
    tabs: [],
    activeTabId: null,
    activeSection: 'sessions',
    showArchived: false,
    scrollPositions: new Map(),
    activeTimelineEventUuid: null,
    scrollToConversationEvent: null
  })

  useConversationStore.setState({
    messages: new Map(),
    pendingMessages: new Map()
  })

  useSessionStore.setState({
    sessions: [],
    isLoading: false,
    isScanning: false,
    error: null,
    showHiddenSessions: false
  })

  mockSendMessage.mockReset()

  // Setup grimoireAPI mock
  window.grimoireAPI = {
    sessions: {
      sendMessage: mockSendMessage
    }
  } as unknown as typeof window.grimoireAPI
})

describe('useSendMessage', () => {
  const sessionId = '550e8400-e29b-41d4-a716-446655440001'
  const tabId = 'tab-1'
  const folderPath = '/Users/test/project'

  beforeEach(() => {
    // Setup session store with a session
    useSessionStore.setState({
      sessions: [
        {
          id: sessionId,
          folderPath,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: null,
          archived: false,
          isPinned: false,
          forkedFromSessionId: null,
          isHidden: false,
          exists: true
        }
      ],
      isLoading: false,
      isScanning: false,
      error: null,
      showHiddenSessions: false
    })

    // Setup UI store with a tab
    useUIStore.setState({
      tabs: [
        {
          id: tabId,
          type: 'session',
          title: 'Test Session',
          sessionId,
          sessionState: 'idle'
        }
      ],
      activeTabId: tabId
    })
  })

  describe('existing session', () => {
    it('adds optimistic message immediately', async () => {
      mockSendMessage.mockResolvedValue({ success: true })

      const { result } = renderHook(() => useSendMessage({ sessionId, tabId }))

      await act(async () => {
        await result.current.sendMessage('  Hello world  ')
      })

      const messages = useConversationStore.getState().getMessages(sessionId)
      expect(messages).toHaveLength(1)
      // Message should be trimmed
      expect(messages[0].content).toBe('Hello world')
    })

    it('calls IPC with correct parameters', async () => {
      mockSendMessage.mockResolvedValue({ success: true })

      const { result } = renderHook(() => useSendMessage({ sessionId, tabId }))

      await act(async () => {
        await result.current.sendMessage('Hello world')
      })

      expect(mockSendMessage).toHaveBeenCalledWith({
        sessionId,
        message: 'Hello world',
        folderPath,
        isNewSession: false
      })
    })

    it('updates session state to working during send', async () => {
      let resolvePromise: () => void
      mockSendMessage.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = () => resolve({ success: true })
        })
      )

      const { result } = renderHook(() => useSendMessage({ sessionId, tabId }))

      act(() => {
        void result.current.sendMessage('Hello')
      })

      // Check state is 'working' during send
      await waitFor(() => {
        const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
        expect(tab?.sessionState).toBe('working')
      })

      // Resolve the promise
      act(() => {
        resolvePromise!()
      })

      // State returns to idle
      await waitFor(() => {
        const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
        expect(tab?.sessionState).toBe('idle')
      })
    })

    it('handles IPC error gracefully', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      })

      const { result } = renderHook(() => useSendMessage({ sessionId, tabId }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // Error message should be added
      const messages = useConversationStore.getState().getMessages(sessionId)
      expect(messages).toHaveLength(2) // User message + error message
      expect(messages[1].content).toContain('Connection failed')
    })

    it('sets state to error on failure (held until Story 3a-3)', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Failed'
      })

      const { result } = renderHook(() => useSendMessage({ sessionId, tabId }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // State should remain in error state (will be transitioned back to idle by Story 3a-3)
      const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
      expect(tab?.sessionState).toBe('error')
    })
  })

  describe('new session', () => {
    it('generates UUID for new session', async () => {
      mockSendMessage.mockResolvedValue({ success: true })

      // Setup tab without sessionId
      useUIStore.setState({
        tabs: [
          {
            id: tabId,
            type: 'session',
            title: 'New Session',
            sessionId: null,
            sessionState: 'idle'
          }
        ],
        activeTabId: tabId
      })

      const { result } = renderHook(() => useSendMessage({ sessionId: null, tabId, folderPath }))

      await act(async () => {
        await result.current.sendMessage('First message')
      })

      // Verify IPC was called with isNewSession: true
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          isNewSession: true,
          folderPath
        })
      )
    })

    it('updates tab sessionId after new session creation succeeds', async () => {
      mockSendMessage.mockResolvedValue({ success: true })

      useUIStore.setState({
        tabs: [
          {
            id: tabId,
            type: 'session',
            title: 'New Session',
            sessionId: null,
            sessionState: 'idle'
          }
        ],
        activeTabId: tabId
      })

      const { result } = renderHook(() => useSendMessage({ sessionId: null, tabId, folderPath }))

      await act(async () => {
        await result.current.sendMessage('First message')
      })

      // Tab should now have a sessionId (only updated on IPC success)
      const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
      expect(tab?.sessionId).not.toBeNull()
      expect(tab?.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('does not update tab sessionId if creation fails', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Database error'
      })

      useUIStore.setState({
        tabs: [
          {
            id: tabId,
            type: 'session',
            title: 'New Session',
            sessionId: null,
            sessionState: 'idle'
          }
        ],
        activeTabId: tabId
      })

      const { result } = renderHook(() => useSendMessage({ sessionId: null, tabId, folderPath }))

      await act(async () => {
        await result.current.sendMessage('First message')
      })

      // Tab should still have null sessionId (not updated on failure)
      const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
      expect(tab?.sessionId).toBeNull()
    })

    it('shows error when no folder path available', async () => {
      useUIStore.setState({
        tabs: [
          {
            id: tabId,
            type: 'session',
            title: 'New Session',
            sessionId: null,
            sessionState: 'idle'
          }
        ],
        activeTabId: tabId
      })

      // No folderPath provided
      const { result } = renderHook(() => useSendMessage({ sessionId: null, tabId }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // Should not call IPC
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('rejects empty messages', async () => {
      useUIStore.setState({
        tabs: [
          {
            id: tabId,
            type: 'session',
            title: 'New Session',
            sessionId: null,
            sessionState: 'idle'
          }
        ],
        activeTabId: tabId
      })

      const { result } = renderHook(() => useSendMessage({ sessionId: null, tabId, folderPath }))

      await act(async () => {
        await result.current.sendMessage('   ')
      })

      // Should not call IPC for empty message
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('rejects messages exceeding length limit', async () => {
      useUIStore.setState({
        tabs: [
          {
            id: tabId,
            type: 'session',
            title: 'New Session',
            sessionId: null,
            sessionState: 'idle'
          }
        ],
        activeTabId: tabId
      })

      const { result } = renderHook(() => useSendMessage({ sessionId: null, tabId, folderPath }))

      const longMessage = 'x'.repeat(100001)

      await act(async () => {
        await result.current.sendMessage(longMessage)
      })

      // Should not call IPC for oversized message
      expect(mockSendMessage).not.toHaveBeenCalled()
    })
  })
})
