import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockNetIsOnline = vi.fn()
const mockSend = vi.fn()
const mockGetAllWindows = vi.fn()

vi.mock('electron', () => ({
  net: {
    isOnline: () => mockNetIsOnline()
  },
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows()
  }
}))

import {
  isOnline,
  startNetworkMonitoring,
  stopNetworkMonitoring,
  _resetForTesting
} from './network-monitor'

describe('network-monitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNetIsOnline.mockReturnValue(true)
    mockGetAllWindows.mockReturnValue([{ webContents: { send: mockSend } }])
    mockSend.mockClear()
    _resetForTesting()
  })

  afterEach(() => {
    stopNetworkMonitoring()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('isOnline', () => {
    it('returns true by default', () => {
      expect(isOnline()).toBe(true)
    })

    it('returns current cached state after initialization', () => {
      mockNetIsOnline.mockReturnValue(false)
      startNetworkMonitoring()
      expect(isOnline()).toBe(false)
    })
  })

  describe('startNetworkMonitoring', () => {
    it('initializes with current network state', () => {
      mockNetIsOnline.mockReturnValue(false)
      startNetworkMonitoring()
      expect(isOnline()).toBe(false)
    })

    it('emits event when status changes to offline', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()

      // Change to offline
      mockNetIsOnline.mockReturnValue(false)
      vi.advanceTimersByTime(5000)

      expect(mockSend).toHaveBeenCalledWith('network:statusChanged', { online: false })
    })

    it('emits event when status changes to online', () => {
      mockNetIsOnline.mockReturnValue(false)
      startNetworkMonitoring()

      // Change to online
      mockNetIsOnline.mockReturnValue(true)
      vi.advanceTimersByTime(5000)

      expect(mockSend).toHaveBeenCalledWith('network:statusChanged', { online: true })
    })

    it('does not emit event when status unchanged', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()

      // Keep online
      vi.advanceTimersByTime(5000)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('polls at 5 second intervals', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()

      // Should not have polled yet at 4 seconds
      vi.advanceTimersByTime(4000)
      expect(mockNetIsOnline).toHaveBeenCalledTimes(1) // Only initial call

      // Should poll at 5 seconds
      vi.advanceTimersByTime(1000)
      expect(mockNetIsOnline).toHaveBeenCalledTimes(2)

      // And again at 10 seconds
      vi.advanceTimersByTime(5000)
      expect(mockNetIsOnline).toHaveBeenCalledTimes(3)
    })

    it('emits to all windows', () => {
      const mockSend2 = vi.fn()
      mockGetAllWindows.mockReturnValue([
        { webContents: { send: mockSend } },
        { webContents: { send: mockSend2 } }
      ])

      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()

      // Change to offline
      mockNetIsOnline.mockReturnValue(false)
      vi.advanceTimersByTime(5000)

      expect(mockSend).toHaveBeenCalledWith('network:statusChanged', { online: false })
      expect(mockSend2).toHaveBeenCalledWith('network:statusChanged', { online: false })
    })
  })

  describe('stopNetworkMonitoring', () => {
    it('stops polling', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()
      stopNetworkMonitoring()

      mockNetIsOnline.mockReturnValue(false)
      vi.advanceTimersByTime(5000)

      // No event should be emitted after stop
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('can be called multiple times safely', () => {
      startNetworkMonitoring()
      stopNetworkMonitoring()
      stopNetworkMonitoring()
      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('hot reload safety', () => {
    it('clears previous interval when startNetworkMonitoring called twice', () => {
      mockNetIsOnline.mockReturnValue(true)
      startNetworkMonitoring()
      startNetworkMonitoring() // Second call should clear first interval

      mockNetIsOnline.mockReturnValue(false)
      vi.advanceTimersByTime(5000)

      // Should only emit once (from single active interval)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })
})
