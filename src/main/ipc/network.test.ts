import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockHandle = vi.fn()
const mockIsOnline = vi.fn()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: () => unknown) => mockHandle(channel, handler)
  }
}))

vi.mock('../network-monitor', () => ({
  isOnline: () => mockIsOnline()
}))

import { registerNetworkIPC } from './network'

describe('network IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('registerNetworkIPC', () => {
    it('registers network:getStatus handler', () => {
      registerNetworkIPC()
      expect(mockHandle).toHaveBeenCalledWith('network:getStatus', expect.any(Function))
    })
  })

  describe('network:getStatus handler', () => {
    it('returns online: true when network is available', () => {
      mockIsOnline.mockReturnValue(true)
      registerNetworkIPC()

      // Get the registered handler
      const handler = mockHandle.mock.calls.find((call) => call[0] === 'network:getStatus')?.[1]
      expect(handler).toBeDefined()

      const result = handler!()
      expect(result).toEqual({ online: true })
    })

    it('returns online: false when network is unavailable', () => {
      mockIsOnline.mockReturnValue(false)
      registerNetworkIPC()

      // Get the registered handler
      const handler = mockHandle.mock.calls.find((call) => call[0] === 'network:getStatus')?.[1]
      expect(handler).toBeDefined()

      const result = handler!()
      expect(result).toEqual({ online: false })
    })

    it('calls isOnline from network-monitor', () => {
      mockIsOnline.mockReturnValue(true)
      registerNetworkIPC()

      const handler = mockHandle.mock.calls.find((call) => call[0] === 'network:getStatus')?.[1]
      handler!()

      expect(mockIsOnline).toHaveBeenCalled()
    })
  })
})
