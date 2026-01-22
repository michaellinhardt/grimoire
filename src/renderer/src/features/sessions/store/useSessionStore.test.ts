import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import {
  useSessionStore,
  selectSessionById,
  selectOrphanedSessions,
  selectActiveSessions
} from './useSessionStore'
import type { SessionWithExists, ScanResult, SyncResult } from '../../../../../shared/types/ipc'

// Mock the grimoireAPI
const mockGrimoireAPI = {
  sessions: {
    scan: vi.fn(),
    sync: vi.fn(),
    list: vi.fn(),
    terminate: vi.fn()
  }
}

vi.stubGlobal('window', {
  grimoireAPI: mockGrimoireAPI
})

describe('useSessionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSessionStore.setState({
      sessions: [],
      isLoading: false,
      isScanning: false,
      error: null
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('loadSessions', () => {
    it('should load sessions and update state', async () => {
      const mockSessions: SessionWithExists[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          folderPath: '/Users/test/project',
          createdAt: 1700000000000,
          updatedAt: 1700000001000,
          lastAccessedAt: null,
          archived: false,
          isPinned: false,
          forkedFromSessionId: null,
          isHidden: false,
          exists: true
        }
      ]

      mockGrimoireAPI.sessions.list.mockResolvedValueOnce(mockSessions)

      await act(async () => {
        await useSessionStore.getState().loadSessions()
      })

      const state = useSessionStore.getState()
      expect(state.sessions).toEqual(mockSessions)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set error state on failure', async () => {
      mockGrimoireAPI.sessions.list.mockRejectedValueOnce(new Error('Failed to load'))

      await act(async () => {
        await useSessionStore.getState().loadSessions()
      })

      const state = useSessionStore.getState()
      expect(state.sessions).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('Failed to load')
    })

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: SessionWithExists[]) => void
      const loadPromise = new Promise<SessionWithExists[]>((resolve) => {
        resolvePromise = resolve
      })
      mockGrimoireAPI.sessions.list.mockReturnValueOnce(loadPromise)

      // Start loading
      const loadPromiseResult = useSessionStore.getState().loadSessions()

      // Check loading state
      expect(useSessionStore.getState().isLoading).toBe(true)

      // Resolve and wait
      await act(async () => {
        resolvePromise!([])
        await loadPromiseResult
      })

      expect(useSessionStore.getState().isLoading).toBe(false)
    })
  })

  describe('triggerScan', () => {
    it('should scan and sync sessions', async () => {
      const mockScanResult: ScanResult = {
        sessions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            filePath: '/path/to/session.jsonl',
            folderPath: '/Users/test/project',
            createdAt: 1700000000000,
            updatedAt: 1700000001000
          }
        ]
      }

      const mockSyncResult: SyncResult = {
        added: 1,
        updated: 0,
        orphaned: 0,
        errors: []
      }

      const mockSessions: SessionWithExists[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          folderPath: '/Users/test/project',
          createdAt: 1700000000000,
          updatedAt: 1700000001000,
          lastAccessedAt: null,
          archived: false,
          isPinned: false,
          forkedFromSessionId: null,
          isHidden: false,
          exists: true
        }
      ]

      mockGrimoireAPI.sessions.scan.mockResolvedValueOnce(mockScanResult)
      mockGrimoireAPI.sessions.sync.mockResolvedValueOnce(mockSyncResult)
      mockGrimoireAPI.sessions.list.mockResolvedValueOnce(mockSessions)

      let result: SyncResult | null = null
      await act(async () => {
        result = await useSessionStore.getState().triggerScan()
      })

      expect(result).toEqual(mockSyncResult)
      expect(mockGrimoireAPI.sessions.scan).toHaveBeenCalled()
      expect(mockGrimoireAPI.sessions.sync).toHaveBeenCalledWith(mockScanResult.sessions)
      expect(useSessionStore.getState().sessions).toEqual(mockSessions)
      expect(useSessionStore.getState().isScanning).toBe(false)
    })

    it('should set error state on scan failure', async () => {
      mockGrimoireAPI.sessions.scan.mockRejectedValueOnce(new Error('Scan failed'))

      await act(async () => {
        await useSessionStore.getState().triggerScan()
      })

      const state = useSessionStore.getState()
      expect(state.error).toBe('Scan failed')
      expect(state.isScanning).toBe(false)
    })

    it('should set isScanning during scan', async () => {
      let resolvePromise: (value: ScanResult) => void
      const scanPromise = new Promise<ScanResult>((resolve) => {
        resolvePromise = resolve
      })
      mockGrimoireAPI.sessions.scan.mockReturnValueOnce(scanPromise)
      mockGrimoireAPI.sessions.sync.mockResolvedValueOnce({
        added: 0,
        updated: 0,
        orphaned: 0,
        errors: []
      })
      mockGrimoireAPI.sessions.list.mockResolvedValueOnce([])

      // Start scanning
      const scanPromiseResult = useSessionStore.getState().triggerScan()

      // Check scanning state
      expect(useSessionStore.getState().isScanning).toBe(true)

      // Resolve and wait
      await act(async () => {
        resolvePromise!({ sessions: [] })
        await scanPromiseResult
      })

      expect(useSessionStore.getState().isScanning).toBe(false)
    })
  })

  describe('setSessions', () => {
    it('should set sessions directly', () => {
      const mockSessions: SessionWithExists[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          folderPath: '/Users/test/project',
          createdAt: 1700000000000,
          updatedAt: 1700000001000,
          lastAccessedAt: null,
          archived: false,
          isPinned: false,
          forkedFromSessionId: null,
          isHidden: false,
          exists: true
        }
      ]

      act(() => {
        useSessionStore.getState().setSessions(mockSessions)
      })

      expect(useSessionStore.getState().sessions).toEqual(mockSessions)
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      useSessionStore.setState({ error: 'Some error' })

      act(() => {
        useSessionStore.getState().clearError()
      })

      expect(useSessionStore.getState().error).toBeNull()
    })
  })
})

describe('selectors', () => {
  const mockSessions: SessionWithExists[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      folderPath: '/Users/test/project1',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      lastAccessedAt: null,
      archived: false,
      isPinned: false,
      forkedFromSessionId: null,
      isHidden: false,
      exists: true
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440001',
      folderPath: '/Users/test/project2',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      lastAccessedAt: null,
      archived: false,
      isPinned: false,
      forkedFromSessionId: null,
      isHidden: false,
      exists: false // orphaned
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440002',
      folderPath: '/Users/test/project3',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      lastAccessedAt: null,
      archived: true,
      isPinned: false,
      forkedFromSessionId: null,
      isHidden: false,
      exists: true
    },
    {
      id: '850e8400-e29b-41d4-a716-446655440003',
      folderPath: '/Users/test/project4',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      lastAccessedAt: null,
      archived: false,
      isPinned: false,
      forkedFromSessionId: null,
      isHidden: true,
      exists: true
    }
  ]

  describe('selectSessionById', () => {
    it('should find session by id', () => {
      const result = selectSessionById(mockSessions, '550e8400-e29b-41d4-a716-446655440000')
      expect(result).toBeDefined()
      expect(result!.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should return undefined for non-existent id', () => {
      const result = selectSessionById(mockSessions, 'non-existent-id')
      expect(result).toBeUndefined()
    })
  })

  describe('selectOrphanedSessions', () => {
    it('should return only orphaned sessions', () => {
      const result = selectOrphanedSessions(mockSessions)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('650e8400-e29b-41d4-a716-446655440001')
    })
  })

  describe('selectActiveSessions', () => {
    it('should return only active (existing, non-archived, non-hidden) sessions', () => {
      const result = selectActiveSessions(mockSessions)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })
  })
})
