import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionMetadataStore, selectMetadataBySessionId } from './useSessionMetadataStore'
import type { SessionMetadata } from '../../../../../shared/types/ipc'

// Mock the grimoireAPI
const mockGrimoireAPI = {
  sessions: {
    getMetadata: vi.fn(),
    upsertMetadata: vi.fn()
  }
}

vi.stubGlobal('window', {
  grimoireAPI: mockGrimoireAPI
})

describe('useSessionMetadataStore', () => {
  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    model: 'claude-sonnet-4-20250514',
    updatedAt: Date.now()
  }

  beforeEach(() => {
    // Reset store state before each test
    useSessionMetadataStore.setState({
      metadata: new Map(),
      isLoading: false,
      error: null
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('loadMetadata', () => {
    it('should load metadata and update state', async () => {
      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(mockMetadata)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.get(mockMetadata.sessionId)).toEqual(mockMetadata)
      expect(state.isLoading).toBe(false)
    })

    it('should handle null result (metadata not found)', async () => {
      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(null)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata('non-existent')
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has('non-existent')).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('should clear stale entry when metadata no longer exists', async () => {
      // Setup: Pre-populate with metadata
      useSessionMetadataStore.setState({
        metadata: new Map([[mockMetadata.sessionId, mockMetadata]]),
        isLoading: false,
        error: null
      })

      // Mock API returning null (metadata was deleted)
      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(null)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      // Stale entry should be cleared
      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has(mockMetadata.sessionId)).toBe(false)
    })

    it('should handle API error and set error state', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGrimoireAPI.sessions.getMetadata.mockRejectedValueOnce(new Error('API Error'))

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('API Error')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load metadata:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    it('should clear error before loading', async () => {
      // Setup: Pre-populate with error
      useSessionMetadataStore.setState({
        metadata: new Map(),
        isLoading: false,
        error: 'Previous error'
      })

      mockGrimoireAPI.sessions.getMetadata.mockResolvedValueOnce(mockMetadata)

      await act(async () => {
        await useSessionMetadataStore.getState().loadMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.error).toBeNull()
    })

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: SessionMetadata | null) => void
      const loadPromise = new Promise<SessionMetadata | null>((resolve) => {
        resolvePromise = resolve
      })
      mockGrimoireAPI.sessions.getMetadata.mockReturnValueOnce(loadPromise)

      // Start loading
      const loadPromiseResult = useSessionMetadataStore
        .getState()
        .loadMetadata(mockMetadata.sessionId)

      // Check loading state
      expect(useSessionMetadataStore.getState().isLoading).toBe(true)

      // Resolve and wait
      await act(async () => {
        resolvePromise!(mockMetadata)
        await loadPromiseResult
      })

      expect(useSessionMetadataStore.getState().isLoading).toBe(false)
    })
  })

  describe('updateMetadata', () => {
    it('should update existing metadata', () => {
      // Setup initial state with metadata
      useSessionMetadataStore.setState({
        metadata: new Map([[mockMetadata.sessionId, mockMetadata]]),
        isLoading: false,
        error: null
      })

      act(() => {
        useSessionMetadataStore.getState().updateMetadata(mockMetadata.sessionId, {
          totalInputTokens: 2000,
          totalOutputTokens: 1000
        })
      })

      const state = useSessionMetadataStore.getState()
      const updated = state.metadata.get(mockMetadata.sessionId)
      expect(updated?.totalInputTokens).toBe(2000)
      expect(updated?.totalOutputTokens).toBe(1000)
      // Other fields should remain unchanged
      expect(updated?.totalCostUsd).toBe(mockMetadata.totalCostUsd)
      expect(updated?.model).toBe(mockMetadata.model)
    })

    it('should do nothing if metadata does not exist', () => {
      const initialState = useSessionMetadataStore.getState()

      act(() => {
        useSessionMetadataStore.getState().updateMetadata('non-existent', {
          totalInputTokens: 2000
        })
      })

      // State should be unchanged
      expect(useSessionMetadataStore.getState()).toEqual(initialState)
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      useSessionMetadataStore.setState({
        metadata: new Map(),
        isLoading: false,
        error: 'Some error'
      })

      act(() => {
        useSessionMetadataStore.getState().clearError()
      })

      expect(useSessionMetadataStore.getState().error).toBeNull()
    })
  })

  describe('clearMetadata', () => {
    it('should remove metadata for sessionId', () => {
      // Setup initial state with metadata
      useSessionMetadataStore.setState({
        metadata: new Map([[mockMetadata.sessionId, mockMetadata]]),
        isLoading: false,
        error: null
      })

      act(() => {
        useSessionMetadataStore.getState().clearMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has(mockMetadata.sessionId)).toBe(false)
    })

    it('should not affect other metadata entries', () => {
      const otherMetadata: SessionMetadata = {
        ...mockMetadata,
        sessionId: '650e8400-e29b-41d4-a716-446655440001'
      }

      // Setup initial state with two metadata entries
      useSessionMetadataStore.setState({
        metadata: new Map([
          [mockMetadata.sessionId, mockMetadata],
          [otherMetadata.sessionId, otherMetadata]
        ]),
        isLoading: false,
        error: null
      })

      act(() => {
        useSessionMetadataStore.getState().clearMetadata(mockMetadata.sessionId)
      })

      const state = useSessionMetadataStore.getState()
      expect(state.metadata.has(mockMetadata.sessionId)).toBe(false)
      expect(state.metadata.has(otherMetadata.sessionId)).toBe(true)
    })
  })
})

describe('selectMetadataBySessionId', () => {
  const mockMetadata: SessionMetadata = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    model: 'claude-sonnet-4-20250514',
    updatedAt: Date.now()
  }

  it('should return metadata for existing sessionId', () => {
    const metadataMap = new Map([[mockMetadata.sessionId, mockMetadata]])
    const result = selectMetadataBySessionId(metadataMap, mockMetadata.sessionId)
    expect(result).toEqual(mockMetadata)
  })

  it('should return undefined for non-existent sessionId', () => {
    const metadataMap = new Map([[mockMetadata.sessionId, mockMetadata]])
    const result = selectMetadataBySessionId(metadataMap, 'non-existent')
    expect(result).toBeUndefined()
  })

  it('should return undefined for empty map', () => {
    const metadataMap = new Map<string, SessionMetadata>()
    const result = selectMetadataBySessionId(metadataMap, mockMetadata.sessionId)
    expect(result).toBeUndefined()
  })
})
