import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  let mockGetStatus: ReturnType<typeof vi.fn>
  let mockOnStatusChanged: ReturnType<typeof vi.fn>
  let statusCallbacks: Array<(data: { online: boolean }) => void>
  let originalGrimoireAPI: typeof window.grimoireAPI

  beforeEach(() => {
    statusCallbacks = []
    mockGetStatus = vi.fn().mockResolvedValue({ online: true })
    mockOnStatusChanged = vi.fn((callback) => {
      statusCallbacks.push(callback)
      return () => {
        const idx = statusCallbacks.indexOf(callback)
        if (idx > -1) statusCallbacks.splice(idx, 1)
      }
    })

    // Store original
    originalGrimoireAPI = window.grimoireAPI

    // Set up mock
    window.grimoireAPI = {
      ...window.grimoireAPI,
      network: {
        getStatus: mockGetStatus,
        onStatusChanged: mockOnStatusChanged
      }
    } as typeof window.grimoireAPI
  })

  afterEach(() => {
    // Restore original
    window.grimoireAPI = originalGrimoireAPI
    vi.clearAllMocks()
  })

  it('returns optimistic online default', async () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.online).toBe(true)

    // Wait for the async getStatus to complete to avoid act() warning
    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalled()
    })
  })

  it('updates with initial status from IPC', async () => {
    mockGetStatus.mockResolvedValue({ online: false })
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(result.current.online).toBe(false)
    })
  })

  it('updates on statusChanged events', async () => {
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(mockOnStatusChanged).toHaveBeenCalled()
    })

    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: false }))
    })

    expect(result.current.online).toBe(false)
  })

  it('cleans up listener on unmount', async () => {
    const { unmount } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(statusCallbacks.length).toBe(1)
    })

    unmount()

    expect(statusCallbacks.length).toBe(0)
  })

  it('updates lastChecked timestamp on initial load', async () => {
    const beforeTime = Date.now()
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalled()
    })

    expect(result.current.lastChecked).toBeGreaterThanOrEqual(beforeTime)
  })

  it('updates lastChecked timestamp on status change', async () => {
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(mockOnStatusChanged).toHaveBeenCalled()
    })

    const timeBeforeChange = Date.now()

    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: false }))
    })

    expect(result.current.lastChecked).toBeGreaterThanOrEqual(timeBeforeChange)
  })

  it('handles multiple status changes', async () => {
    const { result } = renderHook(() => useNetworkStatus())

    await waitFor(() => {
      expect(mockOnStatusChanged).toHaveBeenCalled()
    })

    // Go offline
    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: false }))
    })
    expect(result.current.online).toBe(false)

    // Go online
    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: true }))
    })
    expect(result.current.online).toBe(true)

    // Go offline again
    act(() => {
      statusCallbacks.forEach((cb) => cb({ online: false }))
    })
    expect(result.current.online).toBe(false)
  })
})
