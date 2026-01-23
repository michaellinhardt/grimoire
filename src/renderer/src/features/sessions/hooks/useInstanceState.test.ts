import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useInstanceState } from './useInstanceState'
import { useUIStore } from '@renderer/shared/store/useUIStore'

describe('useInstanceState', () => {
  const sessionId = 'test-session-123'
  const tabId = 'tab-1'
  let mockOnInstanceStateChanged: ReturnType<typeof vi.fn>
  let mockAcknowledgeError: ReturnType<typeof vi.fn>
  let mockGetInstanceState: ReturnType<typeof vi.fn>
  let stateChangeCallback: ((event: unknown) => void) | null = null

  beforeEach(() => {
    // Reset store
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

    // Setup mocks
    mockOnInstanceStateChanged = vi.fn((cb) => {
      stateChangeCallback = cb
      return vi.fn() // cleanup function
    })
    mockAcknowledgeError = vi.fn().mockResolvedValue({ success: true, newState: 'idle' })
    mockGetInstanceState = vi.fn().mockResolvedValue({ state: 'idle' })

    window.grimoireAPI = {
      sessions: {
        onInstanceStateChanged: mockOnInstanceStateChanged,
        acknowledgeError: mockAcknowledgeError,
        getInstanceState: mockGetInstanceState
      }
    } as unknown as typeof window.grimoireAPI
  })

  afterEach(() => {
    stateChangeCallback = null
  })

  it('returns current state from tab', () => {
    const { result } = renderHook(() => useInstanceState({ sessionId, tabId }))
    expect(result.current.state).toBe('idle')
  })

  it('fetches initial state on mount', async () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))

    await waitFor(() => {
      expect(mockGetInstanceState).toHaveBeenCalledWith(sessionId)
    })
  })

  it('syncs state from main process on mount when different', async () => {
    // Main process has 'working' state but tab has 'idle'
    mockGetInstanceState.mockResolvedValue({ state: 'working' })

    renderHook(() => useInstanceState({ sessionId, tabId }))

    await waitFor(() => {
      const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
      expect(tab?.sessionState).toBe('working')
    })
  })

  it('subscribes to state change events', () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))
    expect(mockOnInstanceStateChanged).toHaveBeenCalled()
  })

  it('updates tab state on state change event', () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))

    act(() => {
      stateChangeCallback?.({
        sessionId,
        state: 'working',
        previousState: 'idle'
      })
    })

    const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
    expect(tab?.sessionState).toBe('working')
  })

  it('ignores events for different session', () => {
    renderHook(() => useInstanceState({ sessionId, tabId }))

    act(() => {
      stateChangeCallback?.({
        sessionId: 'other-session',
        state: 'error',
        previousState: 'idle'
      })
    })

    const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
    expect(tab?.sessionState).toBe('idle') // Unchanged
  })

  it('acknowledges error via IPC', async () => {
    const { result } = renderHook(() => useInstanceState({ sessionId, tabId }))

    await act(async () => {
      await result.current.acknowledgeError()
    })

    expect(mockAcknowledgeError).toHaveBeenCalledWith(sessionId)
  })

  it('updates state after error acknowledgement', async () => {
    // Set initial error state
    useUIStore.setState({
      tabs: [
        {
          id: tabId,
          type: 'session',
          title: 'Test Session',
          sessionId,
          sessionState: 'error'
        }
      ]
    })

    const { result } = renderHook(() => useInstanceState({ sessionId, tabId }))

    await act(async () => {
      await result.current.acknowledgeError()
    })

    const tab = useUIStore.getState().tabs.find((t) => t.id === tabId)
    expect(tab?.sessionState).toBe('idle')
  })

  it('cleans up subscription on unmount', () => {
    const cleanup = vi.fn()
    mockOnInstanceStateChanged.mockReturnValue(cleanup)

    const { unmount } = renderHook(() => useInstanceState({ sessionId, tabId }))
    unmount()

    expect(cleanup).toHaveBeenCalled()
  })

  it('does not subscribe when sessionId is null', () => {
    renderHook(() => useInstanceState({ sessionId: null, tabId }))
    expect(mockOnInstanceStateChanged).not.toHaveBeenCalled()
  })

  it('does not fetch initial state when sessionId is null', () => {
    renderHook(() => useInstanceState({ sessionId: null, tabId }))
    expect(mockGetInstanceState).not.toHaveBeenCalled()
  })
})
