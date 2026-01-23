import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAppInit } from './useAppInit'

describe('useAppInit', () => {
  let mockVerify: ReturnType<typeof vi.fn>
  let mockOnStepComplete: ReturnType<typeof vi.fn>
  let stepCallbacks: Array<(data: { step: string; success: boolean; error?: string }) => void>

  beforeEach(() => {
    stepCallbacks = []
    mockVerify = vi.fn()
    mockOnStepComplete = vi.fn((callback) => {
      stepCallbacks.push(callback)
      return () => {
        const idx = stepCallbacks.indexOf(callback)
        if (idx > -1) stepCallbacks.splice(idx, 1)
      }
    })

    window.grimoireAPI = {
      ...window.grimoireAPI,
      startup: {
        verify: mockVerify,
        onStepComplete: mockOnStepComplete,
        onAllComplete: vi.fn(() => () => {})
      }
    } as typeof window.grimoireAPI
  })

  it('starts with loading status', () => {
    mockVerify.mockReturnValue(new Promise(() => {})) // Never resolves
    const { result } = renderHook(() => useAppInit())
    expect(result.current.status).toBe('loading')
    expect(result.current.currentStep).toBe('Initializing...')
  })

  it('transitions to ready on successful verification', async () => {
    mockVerify.mockResolvedValue({ success: true })
    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.currentStep).toBe('Ready')
  })

  it('transitions to error on failed verification', async () => {
    mockVerify.mockResolvedValue({
      success: false,
      failedStep: 'claude',
      error: 'Claude not found'
    })
    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.errorMessage).toBe('Claude not found')
    expect(result.current.errorType).toBe('claude')
  })

  it('updates current step on stepComplete events', async () => {
    mockVerify.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAppInit())

    act(() => {
      stepCallbacks.forEach((cb) => cb({ step: 'claude', success: true }))
    })

    expect(result.current.currentStep).toBe('Checking Claude Code...')
  })

  it('retry function restarts verification', async () => {
    mockVerify.mockResolvedValueOnce({ success: false, failedStep: 'claude', error: 'Failed' })
    mockVerify.mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(mockVerify).toHaveBeenCalledTimes(2)
  })

  it('handles exception errors with null errorType', async () => {
    mockVerify.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useAppInit())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.errorMessage).toBe('Network error')
    expect(result.current.errorType).toBeNull()
  })
})
