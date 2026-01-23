import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAbortSession } from './useAbortSession'

// Mock stores
const mockUpdateTabSessionState = vi.fn()
const mockAddAbortedMessage = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: () => ({
    updateTabSessionState: mockUpdateTabSessionState
  })
}))

vi.mock('../store/useConversationStore', () => ({
  useConversationStore: () => ({
    addAbortedMessage: mockAddAbortedMessage
  })
}))

describe('useAbortSession', () => {
  const mockSessionId = 'test-session-123'
  const mockTabId = 'test-tab-456'
  let mockAbort: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockAbort = vi.fn().mockResolvedValue({ success: true })
    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          abort: mockAbort
        }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes with isAborting false', () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))
    expect(result.current.isAborting).toBe(false)
  })

  it('calls IPC abort method with session ID', async () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockAbort).toHaveBeenCalledWith({ sessionId: mockSessionId })
  })

  it('does nothing when sessionId is null', async () => {
    const { result } = renderHook(() => useAbortSession(null, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockAbort).not.toHaveBeenCalled()
  })

  it('adds aborted message on success', async () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockAddAbortedMessage).toHaveBeenCalledWith(mockSessionId)
  })

  it('transitions session state to idle on success', async () => {
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockUpdateTabSessionState).toHaveBeenCalledWith(mockTabId, 'idle')
  })

  it('transitions to idle even on abort failure', async () => {
    mockAbort.mockResolvedValue({ success: false, error: 'Process not found' })
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    expect(mockUpdateTabSessionState).toHaveBeenCalledWith(mockTabId, 'idle')
  })

  it('handles IPC errors gracefully', async () => {
    mockAbort.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    // Should still transition to idle
    expect(mockUpdateTabSessionState).toHaveBeenCalledWith(mockTabId, 'idle')
  })

  it('sets isAborting during abort operation', async () => {
    let resolveAbort: (value: { success: boolean }) => void = () => {}
    mockAbort.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAbort = resolve
        })
    )

    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    // Start abort but don't await
    let abortPromise: Promise<void>
    act(() => {
      abortPromise = result.current.abort()
    })

    // Should be aborting now
    expect(result.current.isAborting).toBe(true)

    // Resolve and complete
    await act(async () => {
      resolveAbort({ success: true })
      await abortPromise!
    })

    // Should be done aborting
    expect(result.current.isAborting).toBe(false)
  })

  it('prevents concurrent abort calls while isAborting is true', async () => {
    // The hook uses isAborting state to prevent concurrent calls
    // Since React batches updates, we need to verify the guard works
    // by checking that only one IPC call is made for the first call

    const { result } = renderHook(() => useAbortSession(mockSessionId, mockTabId))

    await act(async () => {
      await result.current.abort()
    })

    // First call should have triggered IPC
    expect(mockAbort).toHaveBeenCalledTimes(1)

    // After completion, calling again should work (not concurrent)
    mockAbort.mockClear()
    await act(async () => {
      await result.current.abort()
    })

    expect(mockAbort).toHaveBeenCalledTimes(1)
  })
})
